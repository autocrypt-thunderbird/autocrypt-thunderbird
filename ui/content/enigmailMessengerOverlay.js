// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMessengerOverlay");

window.addEventListener("load", enigMessengerStartup, false);

var gCreatedURIs = [];

var gDecryptedMessage;
var gLastSaveDir = "";

function enigMessengerStartup() {
  DEBUG_LOG("enigmailMessengerOverlay.js: Startup\n");

  // Override print command
  var printElementIds = ["cmd_print", "key_print", "button-print",
                         "threadPaneContext-print",
                         "messagePaneContext-print"];

  for (var index = 0; index < printElementIds.length; index++) {
    var elementId = printElementIds[index];
    var element = document.getElementById(elementId);
    if (element)
      element.setAttribute("oncommand", "enigMsgPrint('"+elementId+"');");
  }

  enigUpdateOptionsDisplay();

  // Commented out; clean-up now handled by HdrView and Unload
  ///var outliner = GetThreadOutliner();
  ///outliner.addEventListener("click", enigThreadPaneOnClick, true);
}

function enigMessengerUnload() {
  DEBUG_LOG("enigmailMessengerOverlay.js: Unload\n");

  var enigmailBox = document.getElementById("expandedEnigmailBox");

  if (enigmailBox && !enigmailBox.collapsed) {
    enigmailBox.setAttribute("collapsed", "true");

    var statusText = document.getElementById("expandedEnigmailStatusText");

    if (statusText)
      statusText.setAttribute("value", "");
  }

  if (gCreatedURIs.length) {
    // Cleanup messages belonging to this window (just in case)
    var enigmailSvc = GetEnigmailSvc();
    if (enigmailSvc) {
      DEBUG_LOG("enigmailMessengerOverlay.js: Unload: Deleting messages\n");
      for (var index=0; index < gCreatedURIs.length; index++) {
        enigmailSvc.deleteMessageURI(gCreatedURIs[index]);
      }
      gCreatedURIs = [];
    }
  }
}

function enigThreadPaneOnClick() {
    //DEBUG_LOG("enigmailMessengerOverlay.js: enigThreadPaneOnClick\n");
}

function enigGetCurrentMsgUrl() {
  try {
    if (GetNumSelectedMessages() != 1)
      return null;

    var uriSpec = GetFirstSelectedMessage();
    //DEBUG_LOG("enigmailMessengerOverlay.js: enigGetCurrentMsgUrl: uriSpec="+uriSpec+"\n");

    var msgService = messenger.messageServiceFromURI(uriSpec);

    var urlObj = new Object();
    msgService.GetUrlForUri(uriSpec, urlObj, msgWindow);

    var url = urlObj.value;

    var mailNewsUrl = url.QueryInterface(Components.interfaces.nsIMsgMailNewsUrl);
    //DEBUG_LOG("enigmailMessengerOverlay.js: enigGetCurrentMsgUrl: mailNewsUrl.spec="+mailNewsUrl.spec+"\n");

    return mailNewsUrl;

  } catch (ex) {
    return null;
  }

}

function enigUpdateOptionsDisplay() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigUpdateOptionsDisplay: \n");
   var optList = ["autoDecrypt"];

   for (var j=0; j<optList.length; j++) {
     var menuElement = document.getElementById("enigmail_"+optList[j]);
     menuElement.setAttribute("checked", EnigGetPref(optList[j]) ? "true" : "false");
   }
}


function enigToggleAttribute(attrName)
{
  DEBUG_LOG("enigmailMsgessengerOverlay.js: enigToggleAttribute('"+attrName+"')\n");

  var menuElement = document.getElementById("enigmail_"+attrName);

  var oldValue = EnigGetPref(attrName);
  EnigSetPref(attrName, !oldValue);

  enigUpdateOptionsDisplay();

  if (attrName == "autoDecrypt")
    ReloadMessage();
}

function enigMessageImport(event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageImport: "+event+"\n");

  return enigMessageParse(!event, true);
}

function enigMessageDecrypt(event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: "+event+"\n");

  return enigMessageParse(!event, false);
}

function enigMessageParse(interactive, importOnly) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParse: "+interactive+"\n");

  for (var index in currentHeaderData) {
    var currentHeader = currentHeaderData[index];
    //DEBUG_LOG("enigmailMessengerOverlay.js: "+index+": "+currentHeader.headerValue+"\n");
  }

  for (var index in currentAttachments) {
    var attachment = currentAttachments[index];
    DEBUG_LOG("enigmailMessengerOverlay.js: "+index+": "+attachment.contentType+"\n");
    DEBUG_LOG("enigmailMessengerOverlay.js: "+index+": "+attachment.url+"\n");
  }

  var msgFrame = window.frames["messagepane"];
  DEBUG_LOG("enigmailMessengerOverlay.js: msgFrame="+msgFrame+"\n");

  ///EnigDumpHTML(msgFrame.document.documentElement);

  var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
  DEBUG_LOG("enigmailMessengerOverlay.js: bodyElement="+bodyElement+"\n");

  var msgText = EnigGetDeepText(bodyElement);

  if (!interactive && (msgText.indexOf("-----BEGIN PGP") == -1)
                   && (msgText.indexOf("-----BEGIN\xA0PGP") == -1) ) {
    // No PGP content
    return;
  }

  if (msgText.indexOf("\xA0") != -1) {
    // Replace non-breaking spaces with plain spaces
    msgText = msgText.replace(/\xA0/g, " ");
    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParse: replaced non-breaking spaces\n");
  }

  var charset = msgWindow ? msgWindow.mailCharacterSet : "";

  // Encode ciphertext to charset from unicode
  msgText = EnigConvertFromUnicode(msgText, charset);

  //DEBUG_LOG("enigmailMessengerOverlay.js: msgText='"+msgText+"'\n");

  var mailNewsUrl = enigGetCurrentMsgUrl();

  var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

  enigMessageParseCallback(msgText, charset, interactive, importOnly,
                           urlSpec, "");
}


function enigMessageParseCallback(msgText, charset, interactive, importOnly,
                                  messageUrl, signStatus) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: "+interactive+", "+importOnly+", charset="+charset+", msgUrl="+messageUrl+", signStatus='"+signStatus+"'\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var plainText;
  var exitCode;
  var newSignStatus = "";
  var errorMsgObj = new Object();

  if (importOnly) {
    // Import public key
    var importFlags = nsIEnigmail.UI_INTERACTIVE;
    exitCode = enigmailSvc.importKey(window, importFlags, msgText, "",
                                     errorMsgObj);

  } else {
    var exitCodeObj = new Object();
    var signStatusObj = new Object();
    signStatusObj.value = signStatus;

    var uiFlags = interactive ? (nsIEnigmail.UI_INTERACTIVE |
                                 nsIEnigmail.ALLOW_KEY_IMPORT |
                                 nsIEnigmail.UNVERIFIED_ENC_OK) : 0;


    plainText = enigmailSvc.decryptMessage(window, uiFlags, msgText,
                                     exitCodeObj, errorMsgObj, signStatusObj);

    //DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: plainText='"+plainText+"'\n");

    exitCode = exitCodeObj.value;
    newSignStatus = signStatusObj.value;

    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: newSignStatus='"+newSignStatus+"'\n");

    // Decode plaintext to unicode
    plainText = EnigConvertToUnicode(plainText, charset);
  }

  var errorMsg = errorMsgObj.value;

  var statusLines = errorMsg.split(/\r?\n/);

  var statusLine = "";
  var displayMsg = "";

  if (statusLines && statusLines.length) {
    statusLine = statusLines[0];

    // Display only first ten lines of error message
    while (statusLines.length > 10)
      statusLines.pop();

    displayMsg = statusLines.join("\n");
  }

  if (importOnly) {
     if (interactive && displayMsg)
       EnigAlert(displayMsg);
     return;

  } else if (statusLine) {
    var enigmailBox = document.getElementById("expandedEnigmailBox");
    var statusText  = document.getElementById("expandedEnigmailStatusText");

    statusText.setAttribute("value", statusLine);
    enigmailBox.removeAttribute("collapsed");
  }

  if (newSignStatus.indexOf("BADSIG_ARMOR ") == 0) {
    // Bad signature
    if (!signStatus) {
      // Try to verify signature by accessing raw message text directly
      // (avoid recursion by checking if we already have a signStatus)
      return enigMsgDirect(interactive, importOnly, charset, newSignStatus);
    }
  }

  if (!plainText) {
     if (interactive && displayMsg)
       EnigAlert(displayMsg);
     return;
  }

  var msgFrame = window.frames["messagepane"];
  var bodyElement = msgFrame.document.getElementsByTagName("body")[0];

  try {
    // Display plain text with hyperlinks

    // Get selection range for inserting HTML
    var domSelection = msgFrame._content.getSelection();

    var privateSelection = domSelection.QueryInterface(Components.interfaces.nsISelectionPrivate);
    var selection = privateSelection.QueryInterface(Components.interfaces.nsISelection);

    selection.collapse(bodyElement, 0);
    var selRange = selection.getRangeAt(0);

    var htmlText = enigEscapeTextForHTML(plainText, true);

    var docFrag = selRange.createContextualFragment("<pre>"+htmlText+"</pre>");

    // Clear HTML body
    while (bodyElement.hasChildNodes())
        bodyElement.removeChild(bodyElement.childNodes[0]);

    bodyElement.appendChild(docFrag.firstChild);

   } catch (ex) {
    // Display raw text

    // Clear HTML body
    while (bodyElement.hasChildNodes())
        bodyElement.removeChild(bodyElement.childNodes[0]);

    var newPlainTextNode  = msgFrame.document.createTextNode(plainText);
    var newPreElement     = msgFrame.document.createElement("pre");
    newPreElement.appendChild(newPlainTextNode);

    var newDivElement     = msgFrame.document.createElement("div");
    newDivElement.appendChild(newPreElement);

    bodyElement.appendChild(newDivElement);
  }

  // Save decrypted message status, headers, and content
  var headerList = {"subject":"", "from":"", "date":"", "to":"", "cc":""};

  if (!gViewAllHeaders) {
    for (var index = 0; index < gCollapsedHeaderList.length; index++) {
      headerList[gCollapsedHeaderList[index].name] = "";
    }

  } else {
    for (index = 0; index < gExpandedHeaderList.length; index++) {
      headerList[gExpandedHeaderList[index].name] = "";
    }

    for (var headerName in currentHeaderData) {
      headerList[headerName] = "";
    }
  }

  for (var headerName in headerList) {
    if (currentHeaderData[headerName])
      headerList[headerName] = currentHeaderData[headerName].headerValue;
  }

  // WORKAROUND
  if (headerList["cc"] == headerList["to"])
    headerList["cc"] = "";

  gDecryptedMessage = {url:messageUrl,
                       statusLine:statusLine,
                       headerList:headerList,
                       charset:charset,
                       plainText:plainText};
  return;
}


function enigEscapeTextForHTML(text, hyperlink) {
  // Escape special characters
  if (text.indexOf("&") > -1)
    text = text.replace(/&/g, "&amp;")

  if (text.indexOf("<") > -1)
    text = text.replace(/</g, "&lt;")

  if (text.indexOf(">") > -1)
    text = text.replace(/>/g, "&gt;")

  if (text.indexOf("\"") > -1)
    text = text.replace(/"/g, "&quot;")

  if (!hyperlink)
    return text;

  // Hyperlink email addresses
  var addrs = text.match(/\b[A-Za-z0-9_+\-\.]+@[A-Za-z0-9\-\.]+\b/g);

  if (addrs && addrs.length) {
    var newText = "";
    var offset = 0;

    for (var j=0; j < addrs.length; j++) {
      var addr = addrs[j];

      var loc = text.indexOf(addr, offset);
      if (loc < offset)
        break;

      if (loc > offset)
        newText += text.substr(offset, loc-offset);

      // Strip any period off the end of address
      addr = addr.replace(/[\.]$/, "");

      if (!addr.length)
        continue;

      newText += "<a href=\"mailto:"+addr+"\">" + addr + "</a>";

      offset = loc + addr.length;
    }

    newText += text.substr(offset, text.length-offset);

    text = newText;
  }

  // Hyperlink URLs
  var urls = text.match(/\b(http|https|ftp):\S+\s/g);

  if (urls && urls.length) {
    var newText = "";
    var offset = 0;

    for (var j=0; j < urls.length; j++) {
      var url = urls[j];

      var loc = text.indexOf(url, offset);
      if (loc < offset)
        break;

      if (loc > offset)
        newText += text.substr(offset, loc-offset);

      // Strip delimiters off the end of URL
      url = url.replace(/\s$/, "");
      url = url.replace(/([\),\.']|&gt;|&quot;)$/, "");

      if (!url.length)
        continue;

      newText += "<a href=\""+url+"\">" + url + "</a>";

      offset = loc + url.length;
    }

    newText += text.substr(offset, text.length-offset);

    text = newText;
  }

  return text;
}

function GetDecryptedMessage(contentType) {
  DEBUG_LOG("enigmailMessengerOverlay.js: GetDecryptedMessage: "+contentType+"\n");

  if (!gDecryptedMessage)
    return "No decrypted message found!\n";

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return "";

  var statusLine = gDecryptedMessage.statusLine;
  var headerList = gDecryptedMessage.headerList;

  var contentData = "";

  if (contentType == "text/html")
    contentData += "<html><head></head><body>\r\n";


  if (statusLine) {
    if (contentType == "text/html") {
      contentData += "<b>Enigmail:</b> " +
                     enigEscapeTextForHTML(statusLine, false) + "<br>\r\n<hr>\r\n";
    } else {
      contentData += "Enigmail: " + statusLine + "\r\n\r\n";
    }
  }

  for (var headerName in headerList) {
    var headerValue = headerList[headerName];

    if (headerValue) {
      if (contentType == "text/html") {
        contentData += "<b>"+enigEscapeTextForHTML(headerName, false)+":</b> "+
                             enigEscapeTextForHTML(headerValue, false)+"<br>\r\n";
      } else {
        contentData += headerName + ": " + headerValue + "\r\n";
      }
    }
  }

  if (contentType == "text/html") {
    contentData += "<pre>"+enigEscapeTextForHTML(gDecryptedMessage.plainText, false)+"</pre>\r\n";
  } else {
    contentData += "\r\n"+gDecryptedMessage.plainText;
  }

  if (contentType == "text/html")
    contentData += "</body></html>\r\n";

  if (!(enigmailSvc.isWin32)) {
    contentData = contentData.replace(/\r\n/g, "\n");
  }

  return contentData;
}

function enigMsgDefaultPrint(contextMenu) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDefaultPrint: "+contextMenu+"\n");

  if (contextMenu)
    PrintEnginePrint();
  else
    goDoCommand('cmd_print');
}

function enigMsgPrint(elementId) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgPrint: "+elementId+"\n");

  var contextMenu = (elementId.search("Context") > -1);

  if (!gDecryptedMessage)
    enigMsgDefaultPrint(contextMenu);

  var mailNewsUrl = enigGetCurrentMsgUrl();

  if (!mailNewsUrl)
    enigMsgDefaultPrint(contextMenu);

  if (gDecryptedMessage.url != mailNewsUrl.spec) {
    gDecryptedMessage = null;
    enigMsgDefaultPrint(contextMenu);
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    enigMsgDefaultPrint(contextMenu);

  var htmlContent = GetDecryptedMessage("text/html");

  var uri = enigmailSvc.createMessageURI(gDecryptedMessage.url,
                                         "text/html",
                                         gDecryptedMessage.charset,
                                         htmlContent,
                                         false);

  gCreatedURIs.push(uri);

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgPrint: uri="+uri+"\n");

  var messageList = [uri];
  var numMessages = messageList.length;

  if (gPrintSettings == null) {
    gPrintSettings = GetPrintSettings();
  }

  var printEngineWindow = window.openDialog("chrome://messenger/content/msgPrintEngine.xul",
                                        "",
                                        "chrome,dialog=no,all",
                                        numMessages, messageList, statusFeedback, gPrintSettings);

  return true;
}

function enigMessageSave() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageSave: \n");

  if (!gDecryptedMessage) {
    EnigAlert("No decrypted message to save!\nUse Save command from File menu");
    return;
  }

  var mailNewsUrl = enigGetCurrentMsgUrl();

  if (!mailNewsUrl) {
    EnigAlert("No message to save!");
    return;
  }

  if (gDecryptedMessage.url != mailNewsUrl.spec) {
    gDecryptedMessage = null;
    EnigAlert("Please click Decypt button to decrypt message");
    return;
  }

  var saveFile = EnigFilePicker("Enigmail: Save decrypted message",
                                gLastSaveDir, true, "txt",
                                ["Text files", "*.txt"]);
  if (!saveFile) return;

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageSave: path="+saveFile.path+"\n");

  if (saveFile.parent)
    gLastSaveDir = saveFile.parent.path;

  var textContent = GetDecryptedMessage("text/plain");

  if (!WriteFileContents(saveFile.path, textContent, null)) {
    EnigAlert("Error in saving to file "+saveFile.path);
    return;
  }

  return true;
}


function EnigFilePicker(title, displayDir, save, defaultExtension, filterPairs) {
  DEBUG_LOG("enigmailMessengerOverlay.js: EnigFilePicker: "+save+"\n");

  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance();
  filePicker = filePicker.QueryInterface(nsIFilePicker);

  var mode = save ? nsIFilePicker.modeSave : nsIFilePicker.modeOpen;

  filePicker.init(window, title, mode);

  if (displayDir) {
    var localFile = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);

    try {
      localFile.initWithPath(displayDir);
      filePicker.displayDirectory = localFile;
    } catch (ex) {
    }
  }

  if (defaultExtension)
    filePicker.defaultExtension = defaultExtension;

  var nfilters = 0;
  if (filterPairs && filterPairs.length)
    nfilters = filterPairs.length / 2;

  for (var index=0; index < nfilters; index++) {
    filePicker.appendFilter(filterPairs[2*index], filterPairs[2*index+1]);
  }

  filePicker.appendFilters(nsIFilePicker.filterAll);

  if (filePicker.show() == nsIFilePicker.returnCancel)
    return null;

  var file = filePicker.file.QueryInterface(Components.interfaces.nsILocalFile);

  return file;
}


function enigMsgDirect(interactive, importOnly, charset, signStatus) {
  WRITE_LOG("enigmailMessengerOverlay.js: enigMsgDirect: signStatus="+signStatus+"\n");
  var mailNewsUrl = enigGetCurrentMsgUrl();
  if (!mailNewsUrl)
    return;

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  var callbackArg = { interactive:interactive,
                      importOnly:importOnly,
                      charset:charset,
                      messageUrl:mailNewsUrl.spec,
                      signStatus:signStatus,
                      pipeConsole:pipeConsole };

  var requestObserver = new RequestObserver(enigMsgDirectCallback,
                                            callbackArg);

  pipeConsole.openURI(mailNewsUrl, MESSAGE_BUFFER_SIZE,
                      false, requestObserver, mailNewsUrl);
}


function enigMsgDirectCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: "+ctxt+"\n");

  var mailNewsUrl = enigGetCurrentMsgUrl();
  var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

  if (urlSpec != callbackArg.messageUrl) {
    ERROR_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: Message URL mismatch "+mailNewsUrl.spec+" vs. "+callbackArg.messageUrl+"\n");
    return;
  }

  if (callbackArg.pipeConsole.overflow) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: MESSAGE BUFFER OVERFLOW\n");
  }

  var msgText = callbackArg.pipeConsole.data;

  callbackArg.pipeConsole.close();

  //DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: msgText='"+msgText+"'\n");

  enigMessageParseCallback(msgText, callbackArg.charset,
                           callbackArg.interactive,
                           callbackArg.importOnly,
                           callbackArg.messageUrl, callbackArg.signStatus);
}
