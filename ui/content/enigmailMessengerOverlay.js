// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMessengerOverlay");

window.addEventListener("load", enigMessengerStartup, false);

var gCreatedURIs = [];

var gDecryptedMessage;

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

    // Commented out; clean-up now handled by HdrView and Unload
    ///var outliner = GetThreadOutliner();
    ///outliner.addEventListener("click", enigThreadPaneOnClick, true);
}

function enigMessengerUnload() {
    DEBUG_LOG("enigmailMessengerOverlay.js: Unload\n");

    var enigmailBox = document.getElementById("expandedEnigmailBox");
    var statusText = document.getElementById("expandedEnigmailStatusText");

    if (statusText)
      statusText.setAttribute("value", "");

    if (enigmailBox)
      enigmailBox.setAttribute("collapsed", "true");

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

function enigMessageDecrypt(event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: "+event+"\n");

  var interactive = !event;

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
    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: replaced non-breaking spaces\n");
  }

  //DEBUG_LOG("enigmailMessengerOverlay.js: msgText='"+msgText+"'\n");

  var mailNewsUrl = enigGetCurrentMsgUrl();

  var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

  enigMessageDecryptCallback(msgText, interactive, urlSpec, "");
}


function enigMessageDecryptCallback(msgText, interactive,
                                    messageUrl, signStatus) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCallback: "+interactive+", msgUrl="+messageUrl+", signStatus='"+signStatus+"'\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();
  var signStatusObj = new Object();
  signStatusObj.value = signStatus;

  var uiFlags = interactive ? (nsIEnigmail.UI_INTERACTIVE |
                               nsIEnigmail.ALLOW_KEY_IMPORT |
                               nsIEnigmail.UNVERIFIED_ENC_OK) : 0;
  var plainText = enigmailSvc.decryptMessage(window, uiFlags, msgText,
                                     exitCodeObj, errorMsgObj, signStatusObj);
  //DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCallback: plainText='"+plainText+"'\n");

  var newSignStatus = signStatusObj.value;
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCallback: newSignStatus='"+newSignStatus+"'\n");

  var exitCode = exitCodeObj.value;
  var errorMsg = errorMsgObj.value;

  var enigmailBox = document.getElementById("expandedEnigmailBox");
  var statusText  = document.getElementById("expandedEnigmailStatusText");

  var statusLines = errorMsg.split(/\r?\n/);

  var statusLine, displayMsg;
  if (statusLines && statusLines.length) {
    statusLine = statusLines[0];
    statusText.setAttribute("value", statusLine);
    enigmailBox.removeAttribute("collapsed");

    // Display only first ten lines of error message
    while (statusLines.length > 10)
      statusLines.pop();

    displayMsg = statusLines.join("\n");
  }

  if (newSignStatus.indexOf("BADSIG_ARMOR ") == 0) {
    // Bad signature
    if (!signStatus) {
      // Try to verify signature by accessing raw message text directly
      // (avoid recursion by checking if we already have a signStatus)
      return enigMsgDirect(interactive, newSignStatus);
    }
  }

  if (!plainText) {
     if (interactive && displayMsg)
       EnigAlert(displayMsg);
     return;
  }

  var msgFrame = window.frames["messagepane"];
  var bodyElement = msgFrame.document.getElementsByTagName("body")[0];

  // Clear HTML body
  while (bodyElement.hasChildNodes())
      bodyElement.removeChild(bodyElement.childNodes[0]);

  var newPlainTextNode  = msgFrame.document.createTextNode(plainText);
  var newPreElement     = msgFrame.document.createElement("pre");
  newPreElement.appendChild(newPlainTextNode);

  var newDivElement     = msgFrame.document.createElement("div");
  newDivElement.appendChild(newPreElement);

  bodyElement.appendChild(newDivElement);

  // Create MIME content

  var headerList = {"subject":1, "from":1, "date":1, "to":1};

  if (!gViewAllHeaders) {
    for (var index = 0; index < gCollapsedHeaderList.length; index++) {
      headerList[gCollapsedHeaderList[index].name] = 1;
    }

  } else {
    for (index = 0; index < gExpandedHeaderList.length; index++) {
      headerList[gExpandedHeaderList[index].name] = 1;
    }

    for (var headerName in currentHeaderData) {
      headerList[headerName] = 1;
    }
  }

  var contentData = "";

  if (statusLine) {
    contentData += "<b>Enigmail:</b> " +
                   enigEscapeTextForHTML(statusLine) + "<br>\n<hr>\n";
  }

  for (var headerName in headerList) {
    var headerValue;

    if (currentHeaderData[headerName])
      headerValue = currentHeaderData[headerName].headerValue;

    if (headerValue) {
      contentData += "<b>"+enigEscapeTextForHTML(headerName)+":</b> "+
                           enigEscapeTextForHTML(headerValue)+"<br>\n";
    }
  }

  contentData += "<pre>"+enigEscapeTextForHTML(plainText)+"</pre>\n";

  gDecryptedMessage = {url:messageUrl,
                       contentType: "text/html",
                       contentData: contentData};

  return;
}


function enigEscapeTextForHTML(text) {
  if (text.indexOf("&") > -1)
    text = text.replace(/&/g, "&amp;")

  if (text.indexOf("<") > -1)
    text = text.replace(/</g, "&lt;")

  if (text.indexOf(">") > -1)
    text = text.replace(/>/g, "&gt;")

  if (text.indexOf("\"") > -1)
    text = text.replace(/"/g, "&quot;")

  return text;
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

  var uri = enigmailSvc.createMessageURI(gDecryptedMessage.url,
                                         gDecryptedMessage.contentType,
                                         gDecryptedMessage.contentData,
                                         false);

  gCreatedURIs.push(uri);

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgPrint: uri="+uri+"\n");

  var messageList = [uri];
  var numMessages = messageList.length;

  var printEngineWindow = window.openDialog("chrome://messenger/content/msgPrintEngine.xul",
                                        "",
                                        "chrome,dialog=no,all",
                                        numMessages, messageList, statusFeedback);
    return true;
}

function enigMsgDirect(interactive, signStatus) {
  WRITE_LOG("enigmailMessengerOverlay.js: enigMsgDirect: signStatus="+signStatus+"\n");
  var mailNewsUrl = enigGetCurrentMsgUrl();
  if (!mailNewsUrl)
    return;

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  var callbackArg = { interactive:interactive,
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

  enigMessageDecryptCallback(msgText, callbackArg.interactive,
                             callbackArg.messageUrl, callbackArg.signStatus);
}
