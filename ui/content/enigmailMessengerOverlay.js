// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMessengerOverlay");

var gEnigCreatedURIs = [];

var gEnigDecryptedMessage;
var gEnigSecurityInfo = null;
var gEnigLastSaveDir = "";

var gEnigMessagePane = null;
var gEnigNoShowReload = false;
var gEnigLastEncryptedURI = null;

var gEnigRemoveListener = false;

var gEnigHeadersList = ["content-type", "content-transfer-encoding",
                        "x-enigmail-version"];
var gEnigSavedHeaders = null;

var gShowHeadersObj = {"viewallheaders":2,
                       "viewnormalheaders":1,
                       "viewbriefheaders":0};

window.addEventListener("load",   enigMessengerStartup, false);
window.addEventListener("unload", enigMessengerFinish,  false);


function enigMessengerStartup() {
  DEBUG_LOG("enigmailMessengerOverlay.js: Startup\n");

  enigUpdateOptionsDisplay();

  // Override SMIME ui
  var smimeStatusElement = document.getElementById("cmd_viewSecurityStatus");
  if (smimeStatusElement) {
    smimeStatusElement.setAttribute("oncommand", "enigViewSecurityInfo();");
  }

  // Override print command
  var printElementIds = ["cmd_print", "cmd_printpreview", "key_print", "button-print",
                         "threadPaneContext-print",
                         "messagePaneContext-print"];

  EnigOverrideAttribute( printElementIds, "oncommand",
                         "enigMsgPrint('", "');");

  // Override forward command
  var forwardCmdElementIds = ["cmd_forward", "cmd_forwardInline",
                              "cmd_forwardAttachment", "key_forward"];

  EnigOverrideAttribute( forwardCmdElementIds, "oncommand",
                         "enigMsgForward('", "', null);");

  var forwardEventElementIds = [ "button-forward",
                                 "threadPaneContext-forward",
                                 "threadPaneContext-forwardAsAttachment",
                                 "messagePaneContext-forward"];

  EnigOverrideAttribute( forwardEventElementIds, "oncommand",
                         "enigMsgForward('", "', event);");

  // Override message headers view
  var element = document.getElementById("viewallheaders");
  if (element) {
    var parentElement = element.parentNode;
    if (parentElement) {
      parentElement.setAttribute("onpopupshowing", "enigInitViewHeadersMenu();");
    }
  }

  var viewElementIds = ["viewallheaders", "viewnormalheaders",
                        "viewbriefheaders"];

  EnigOverrideAttribute( viewElementIds, "oncommand",
                         "enigMsgViewHeaders('", "');");

  EnigShowHeadersAll(true);
  gEnigSavedHeaders = null;

  gEnigMessagePane = document.getElementById("messagepane");

  // Need to add event listener to gEnigMessagePane to make it work
  // Adding to msgFrame doesn't seem to work
  gEnigMessagePane.addEventListener("unload", enigMessageFrameUnload, true);

  // Commented out; clean-up now handled by HdrView and Unload
  //var tree = GetThreadTree();
  //tree.addEventListener("click", enigThreadPaneOnClick, true);

  if (EnigGetPref("handleDoubleClick")) {
    // ovveride function for double clicking an attachment
    EnigOverrideAttribute(["attachmentList"], "onclick",
                         "enigAttachmentListClick('", "', event);");
  }
}


function enigMessengerFinish() {
  DEBUG_LOG("enigmailMessengerOverlay.js: Finish\n");
}

function enigViewSecurityInfo() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigViewSecurityInfo\n");

  if (gEnigSecurityInfo) {
    // Display OpenPGP security info

    var keyserver = EnigGetPref("keyserver");

    if (keyserver && gEnigSecurityInfo.keyId &&
        (gEnigSecurityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) ) {

      var pubKeyId = "0x" + gEnigSecurityInfo.keyId.substr(8, 8);

      var mesg =  gEnigSecurityInfo.statusInfo + EnigGetString("keyImport",pubKeyId);

      if (EnigConfirm(mesg)) {
        var recvErrorMsgObj = new Object();
        var recvFlags = nsIEnigmail.UI_INTERACTIVE;

        var enigmailSvc = GetEnigmailSvc();
        var exitStatus = enigmailSvc.receiveKey(window, recvFlags, pubKeyId,
                                                recvErrorMsgObj);

        if (exitStatus == 0) {
          enigMessageReload(false);
        } else {
          EnigAlert(EnigGetString("keyImportError")+recvErrorMsgObj.value);
        }
      }

    } else if ( (gEnigSecurityInfo.statusFlags & nsIEnigmail.NODATA) &&
         (gEnigSecurityInfo.statusFlags &
           (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ) {

      if (typeof(ReloadWithAllParts) == "function") {

        var mesg = EnigGetString("reloadImapMessage");

        if (EnigConfirm(mesg))
          ReloadWithAllParts();

      } else {
          EnigAlert(EnigGetString("reloadImapError"));
      }

    } else {
      EnigAlert(EnigGetString("securityInfo")+gEnigSecurityInfo.statusInfo);
    }

  } else {
    // Display SMIME security info
    showMessageReadSecurityInfo();
  }
}

function enigInitViewHeadersMenu() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigInitViewHeadersMenu\n");

  var id;

  var pref = 1;

  if (EnigGetPref("parseAllHeaders")) {
    pref = EnigGetPref("show_headers");

  } else try {
    pref = gEnigPrefRoot.getIntPref("mail.show_headers");
  } catch (ex) {}

  switch (pref) {
  case 2:
    id = "viewallheaders";
    break;
  case 1:	
  default:
    id = "viewnormalheaders";
    break;
  }

  var menuitem = document.getElementById(id);
  if (menuitem)
    menuitem.setAttribute("checked", "true"); 
}

function enigMsgViewHeaders(elementId) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgViewHeaders:"+elementId+"\n");

  var value = gShowHeadersObj[elementId];
  if (!value) value = 0;

  EnigSetPref("show_headers", value);

  if (!EnigGetPref("parseAllHeaders")) {
    gEnigPrefRoot.setIntPref("mail.show_headers", value);
  }

  enigMessageReload(false);

  return true;
}

function enigMessageReload(noShowReload) {
  DEBUG_LOG("enigmailMessengerOverlay.js: MessageReload: "+noShowReload+"\n");

  gEnigNoShowReload = noShowReload;

  if (noShowReload) {
    EnigShowHeadersAll(false);
  }

  MsgReload();
}

function enigMessageCleanup() {
  DEBUG_LOG("enigmailMessengerOverlay.js: MessageCleanup\n");

  var enigmailBox = document.getElementById("expandedEnigmailBox");

  if (enigmailBox && !enigmailBox.collapsed) {
    enigmailBox.setAttribute("collapsed", "true");

    var statusText = document.getElementById("expandedEnigmailStatusText");

    if (statusText)
      statusText.firstChild.data="";
  }

  if (gEnigCreatedURIs.length) {
    // Cleanup messages belonging to this window (just in case)
    var enigmailSvc = GetEnigmailSvc();
    if (enigmailSvc) {
      DEBUG_LOG("enigmailMessengerOverlay.js: Cleanup: Deleting messages\n");
      for (var index=0; index < gEnigCreatedURIs.length; index++) {
        enigmailSvc.deleteMessageURI(gEnigCreatedURIs[index]);
      }
      gEnigCreatedURIs = [];
    }
  }

  gEnigDecryptedMessage = null;
  gEnigSecurityInfo = null;
}

function enigMimeInit() {
  DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit\n");

  try {
    const ENIG_ENIGCONTENTHANDLER_CID =
      Components.ID("{847b3a51-7ab1-11d4-8f02-006008948af5}");

    const ENIG_ENIGENCRYPTEDHANDLER_CONTRACTID = "@mozilla.org/mimecth;1?type=multipart/encrypted";

    var compMgr = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);

    var enigContentHandlerCID = compMgr.contractIDToCID(ENIG_ENIGENCRYPTEDHANDLER_CONTRACTID);

    var handlePGPMime = (enigContentHandlerCID.toString() ==
                     ENIG_ENIGCONTENTHANDLER_CID);

    DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: handlePGPMime="+handlePGPMime+"\n");

  } catch (ex) {}

  if (gEnigRemoveListener) {
    gEnigMessagePane.removeEventListener("load", enigMimeInit, true);
    gEnigRemoveListener = false;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
     return;

  if (enigmailSvc.mimeInitialized()) {
    // Reload message ONLY if enigMimeService has been initialized;
    // enigMimeInit is only called if enigMimeService was not initialized;
    // this prevents looping.
    DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: RELOADING MESSAGE\n");

    enigMessageReload(false);

  } else {
    // Error in MIME initialization; forget saved headers (to avoid looping)
    gEnigSavedHeaders = null;
    ERROR_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: Error in MIME initialization\n");
  }
}

function enigMessageFrameLoad() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageFrameLoad\n");
}

function enigMessageFrameUnload() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageFrameUnload\n");

  if (gEnigNoShowReload) {
    EnigShowHeadersAll(false);
    gEnigNoShowReload = false;

  } else {
    EnigShowHeadersAll(true);
    gEnigSavedHeaders = null;

    enigMessageCleanup();
  }
}

function enigThreadPaneOnClick() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigThreadPaneOnClick\n");
}

function enigGetCurrentMsgUriSpec() {
  try {
    if (GetNumSelectedMessages() != 1)
      return "";

    var uriSpec = GetFirstSelectedMessage();
    //DEBUG_LOG("enigmailMessengerOverlay.js: enigGetCurrentMsgUrl: uriSpec="+uriSpec+"\n");

    return uriSpec;

  } catch (ex) {
    return "";
  }
}

function enigGetCurrentMsgUrl() {
  try {
    var uriSpec = enigGetCurrentMsgUriSpec();

    if (!uriSpec)
      return null;

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
    enigMessageReload(false);
}

function enigMessageImport(event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageImport: "+event+"\n");

  return enigMessageParse(!event, true, "");
}

function enigMessageDecrypt(event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: "+event+"\n");

  if (EnigGetPref("parseAllHeaders")) {
    var showHeaders = 1;
    try {
      showHeaders = gEnigPrefRoot.getIntPref("mail.show_headers");
    } catch (ex) {
    }

    DEBUG_LOG("enigmailMessengerOverlay.js: mail.show_headers="+showHeaders+"\n");

    if (showHeaders == 2) {
      // Copy selected headers
      gEnigSavedHeaders = {};

      for (var index=0; index < gEnigHeadersList.length; index++) {
        var headerName = gEnigHeadersList[index];
        var headerValue = "";

        if (currentHeaderData[headerName]) {
          headerValue = currentHeaderData[headerName].headerValue;
        }

        gEnigSavedHeaders[headerName] = headerValue;
        DEBUG_LOG("enigmailMessengerOverlay.js: "+headerName+": "+headerValue+"\n");
      }

      var emailAttachment = false;
      for (var indexb in currentAttachments) {
        var attachment = currentAttachments[indexb];
        if (attachment.contentType.search(/^message\/rfc822(;|$)/i)  == 0) {
          emailAttachment = true;
        }
        DEBUG_LOG("enigmailMessengerOverlay.js: "+indexb+": "+attachment.contentType+"\n");
        //DEBUG_LOG("enigmailMessengerOverlay.js: "+indexb+": "+attachment.url+"\n");
      }

      if (emailAttachment && (EnigGetPref("show_headers") != 2)) {
        DEBUG_LOG("enigmailMessengerOverlay.js: Email attachment; reloading to hide headers\n");
        enigMessageReload(true);
        return;
      }

    } else if (!gEnigSavedHeaders) {
      ERROR_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: ERROR mail.show_headers="+showHeaders+" while parseAllHeaders is true\n");
    }

  }

  EnigShowHeadersAll(false);

  var contentType = "";
  var contentEncoding = "";
  var xEnigmailVersion = "";

  if (gEnigSavedHeaders) {
    contentType      = gEnigSavedHeaders["content-type"];
    contentEncoding  = gEnigSavedHeaders["content-transfer-encoding"];
    xEnigmailVersion = gEnigSavedHeaders["x-enigmail-version"];
  }

  if (contentType.search(/^multipart\/encrypted(;|$)/i) == 0) {
    // multipart/encrypted
    DEBUG_LOG("enigmailMessengerOverlay.js: multipart/encrypted\n");

    var enigmailSvc = GetEnigmailSvc();
    if (!enigmailSvc)
      return;

    if (!enigmailSvc.mimeInitialized()) {
      // Display enigmail:dummy URL in message pane to initialize

      // Need to add event listener to gEnigMessagePane to make it work
      // Adding to msgFrame doesn't seem to work
      gEnigMessagePane.addEventListener("load",   enigMimeInit, true);
      gEnigRemoveListener = true;

      DEBUG_LOG("enigmailMessengerOverlay.js: loading enigmail:dummy ...\n");
      gEnigNoShowReload = true;

      var msgFrame = EnigGetFrame(window, "messagepane");
      msgFrame.location = "enigmail:dummy";

      return;
    }
  }

  if ( (contentType.search(/^multipart\/signed(;|$)/i) == 0) &&
       (contentType.search(/application\/pgp-signature/i) >= 0) ) {
    // multipart/signed
    DEBUG_LOG("enigmailMessengerOverlay.js: multipart/signed\n");

    var enigmailSvc = GetEnigmailSvc();
    if (!enigmailSvc)
      return;

    var msgUriSpec = enigGetCurrentMsgUriSpec();
    var mailNewsUrl = enigGetCurrentMsgUrl();

    if (mailNewsUrl) {
      const ENIG_ENIGMIMEVERIFY_CONTRACTID = "@mozilla.org/enigmail/mime-verify;1";
      var verifier = Components.classes[ENIG_ENIGMIMEVERIFY_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeVerify);

      verifier.init(mailNewsUrl, msgWindow, msgUriSpec, true);

      return;
    }
  }

  return enigMessageParse(!event, false, contentEncoding);
}


function enigMessageParse(interactive, importOnly, contentEncoding) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParse: "+interactive+"\n");
  var msgFrame = EnigGetFrame(window, "messagepane");
  DEBUG_LOG("enigmailMessengerOverlay.js: msgFrame="+msgFrame+"\n");

  ///EnigDumpHTML(msgFrame.document.documentElement);

  var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
  DEBUG_LOG("enigmailMessengerOverlay.js: bodyElement="+bodyElement+"\n");

  var findStr = interactive ? "" : "-----BEGIN PGP";
  var msgText = EnigGetDeepText(bodyElement, findStr);

  if (!msgText) {
    // No PGP content
    return;
  }

  var charset = msgWindow ? msgWindow.mailCharacterSet : "";

  // Encode ciphertext to charset from unicode
  msgText = EnigConvertFromUnicode(msgText, charset);

  // extract text preceeding and/or following armored block
  var head="";
  var tail="";
  if (findStr) {
    head=msgText.substring(0,msgText.indexOf(findStr)).replace(/^[\n\r\s]*/,"");
    head=head.replace(/[\n\r\s]*$/,"");
    var endStart=msgText.indexOf("-----END PGP");
    var nextLine=msgText.substring(endStart).search(/[\n\r]/);
    if (nextLine>0) {
      tail=msgText.substring(endStart+nextLine).replace(/^[\n\r\s]*/,"");
    }
  }
  
  //DEBUG_LOG("enigmailMessengerOverlay.js: msgText='"+msgText+"'\n");

  var mailNewsUrl = enigGetCurrentMsgUrl();

  var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

  enigMessageParseCallback(msgText, contentEncoding, charset, interactive,
                           importOnly, urlSpec, "", true, head, tail);
}


function enigMessageParseCallback(msgText, contentEncoding, charset, interactive,
                                  importOnly, messageUrl, signature, retry,
                                  head, tail) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: "+interactive+", "+interactive+", importOnly="+importOnly+", charset="+charset+", msgUrl="+messageUrl+", retry="+retry+", signature='"+signature+"'\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var plainText;
  var exitCode;
  var newSignature = "";
  var statusFlags = 0;
  var errorMsgObj = new Object();
  var keyIdObj    = new Object();

  if (importOnly) {
    // Import public key
    var importFlags = nsIEnigmail.UI_INTERACTIVE;
    exitCode = enigmailSvc.importKey(window, importFlags, msgText, "",
                                     errorMsgObj);

  } else {

    if (msgText.indexOf("\nCharset:") > 0) {
      // Check if character set needs to be overridden
      var startOffset = msgText.indexOf("-----BEGIN PGP ");

      if (startOffset >= 0) {
        var subText = msgText.substr(startOffset);

        subText = subText.replace(/\r\n/g, "\n");
        subText = subText.replace(/\r/g,   "\n");

        var endOffset = subText.search(/\n\n/);
        if (endOffset > 0) {
          subText = subText.substr(0,endOffset) + "\n";

          var matches = subText.match(/\nCharset: *(.*) *\n/i)
          if (matches && (matches.length > 1)) {
            // Override character set
            charset = matches[1];
            DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: OVERRIDING charset="+charset+"\n");
          }
        }
      }
    }

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var userIdObj      = new Object();

    var signatureObj = new Object();
    signatureObj.value = signature;

    var uiFlags = interactive ? (nsIEnigmail.UI_INTERACTIVE |
                                 nsIEnigmail.UI_ALLOW_KEY_IMPORT |
                                 nsIEnigmail.UI_UNVERIFIED_ENC_OK) : 0;


    plainText = enigmailSvc.decryptMessage(window, uiFlags, msgText,
                                 signatureObj, exitCodeObj, statusFlagsObj,
                                 keyIdObj, userIdObj, errorMsgObj);

    //DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: plainText='"+plainText+"'\n");

    exitCode = exitCodeObj.value;
    newSignature = signatureObj.value;

    statusFlags = statusFlagsObj.value;

    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: newSignature='"+newSignature+"'\n");
  }

  var errorMsg = errorMsgObj.value;

  if (importOnly) {
     if (interactive && errorMsg)
       EnigAlert(errorMsg);
     return;
  }

  enigUpdateHdrIcons(exitCode, statusFlags, keyIdObj.value, userIdObj.value, errorMsg);

  if (statusFlags & (nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.BAD_ARMOR)) {
    // Bad signature/armor
    if (retry) {
      // Try to verify signature by accessing raw message text directly
      // (avoid recursion by setting retry parameter to false on callback)
      enigMsgDirect(interactive, importOnly, contentEncoding, charset, newSignature, head, tail);
      return;
    }
  }

  if (!plainText) {
     if (interactive && gEnigSecurityInfo && gEnigSecurityInfo.statusInfo)
       EnigAlert(gEnigSecurityInfo.statusInfo);
     return;
  }

  // Save decrypted message status, headers, and content
  var headerList = {"subject":"", "from":"", "date":"", "to":"", "cc":""};

  var index, headerName;
  if (!gViewAllHeaders) {
    for (index = 0; index < gCollapsedHeaderList.length; index++) {
      headerList[gCollapsedHeaderList[index].name] = "";
    }

  } else {
    for (index = 0; index < gExpandedHeaderList.length; index++) {
      headerList[gExpandedHeaderList[index].name] = "";
    }

    for (headerName in currentHeaderData) {
      headerList[headerName] = "";
    }
  }

  for (headerName in headerList) {
    if (currentHeaderData[headerName])
      headerList[headerName] = currentHeaderData[headerName].headerValue;
  }

  // WORKAROUND
  if (headerList["cc"] == headerList["to"])
    headerList["cc"] = "";

  var hasAttachments = currentAttachments && currentAttachments.length;
  var attachmentsEncrypted = true;

  for (index in currentAttachments) {
    if (! enigCheckEncryptedAttach(currentAttachments[index]))
      attachmentsEncrypted=false;
  }

  var msgRfc822Text = "";
  if (head || tail) {
    if (head) {
      // print a warning if the signed or encrypted part doesn't start
      // quite early in the message
      var matches=head.match(/(\n)/g);
      if (matches.length >10) {
        msgRfc822Text=EnigGetString("notePartEncrypted")+"\n\n";
      }
      msgRfc822Text+=head+"\n\n";
    }
    msgRfc822Text += EnigGetString("beginPgpPart")+"\n\n";
  }
  msgRfc822Text+=plainText;
  if (head || tail) {
    msgRfc822Text+="\n\n"+EnigGetString("endPgpPart")+"\n\n"+tail;
  }

  gEnigDecryptedMessage = {url:messageUrl,
                           headerList:headerList,
                           hasAttachments:hasAttachments,
                           attachmentsEncrypted:attachmentsEncrypted,
                           charset:charset,
                           plainText:msgRfc822Text};

  var msgFrame = EnigGetFrame(window, "messagepane");
  var bodyElement = msgFrame.document.getElementsByTagName("body")[0];

  try {
    // Create and load one-time message URI
    var messageContent = enigGetDecryptedMessage("message/rfc822", false);

    gEnigNoShowReload = true;

    var uri = enigmailSvc.createMessageURI(messageUrl,
                                           "message/rfc822",
                                           "",
                                           messageContent,
                                           false);
    gEnigCreatedURIs.push(uri);

    msgFrame.location = uri;

  } catch (ex) {
    // Display plain text with hyperlinks

    // Get selection range for inserting HTML
    var domSelection = msgFrame._content.getSelection();

    var privateSelection = domSelection.QueryInterface(Components.interfaces.nsISelectionPrivate);
    var selection = privateSelection.QueryInterface(Components.interfaces.nsISelection);

    selection.collapse(bodyElement, 0);
    var selRange = selection.getRangeAt(0);

    // Decode plaintext to unicode
    tail = EnigConvertToUnicode(tail, charset);
    var uniText = EnigConvertToUnicode(plainText, charset);

    var htmlText="";
    if (head) {
       htmlText += "<pre>"+enigEscapeTextForHTML(EnigConvertToUnicode(head, charset),true)+"</pre><p/>\n";
    }
    htmlText += '<table border="0" cellspacing="0" width="100%"><tbody><tr><td bgcolor="#9490FF" width="10"></td>' +
      '<td bgcolor="#9490FF" width="10"><pre>Begin Signed or Encrypted Text</pre></td></tr>\n'+
      '<tr><td bgcolor="#9490FF"></td>'+
      '<td><pre>' +
      enigEscapeTextForHTML(uniText, true) +
      '</pre></td></tr>\n' +
      '<tr><td bgcolor="#9490FF" width="10"></td>' +
      '<td bgcolor="#9490FF" width="10"><pre>End Signed or Encrypted Text</pre></td></tr>' +
      '</tbody></table>\n'

    if (tail) {
       htmlText += "<p/><pre>"+enigEscapeTextForHTML(EnigConvertToUnicode(tail, charset),true)+"</pre>";
    }

    var docFrag = selRange.createContextualFragment(htmlText);

    // Clear HTML body
    while (bodyElement.hasChildNodes())
        bodyElement.removeChild(bodyElement.childNodes[0]);

    if (hasAttachments && (! attachmentsEncrypted)) {
      var newTextNode = msgFrame.document.createTextNode(EnigGetString("enigNote"));

      var newEmElement = msgFrame.document.createElement("em");
      newEmElement.appendChild(newTextNode);

      bodyElement.appendChild(newEmElement);
      bodyElement.appendChild(msgFrame.document.createElement("p"));
    }

    bodyElement.appendChild(docFrag.firstChild);

  }

  return;
}

// check if the attachment could be encrypted
function enigCheckEncryptedAttach(attachment) {
  return (attachment.displayName.match(/\.(gpg|pgp|asc)$/) ||
      attachment.contentType.match(/^application\/pgp(\-.*)?$/));
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

  var newText, offset, loc;
  if (addrs && addrs.length) {
    newText = "";
    offset = 0;

    for (var j=0; j < addrs.length; j++) {
      var addr = addrs[j];

      loc = text.indexOf(addr, offset);
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
    newText = "";
    offset = 0;

    for (var k=0; k < urls.length; k++) {
      var url = urls[k];

      loc = text.indexOf(url, offset);
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

function enigGetDecryptedMessage(contentType, includeHeaders) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigGetDecryptedMessage: "+contentType+", "+includeHeaders+"\n");

  if (!gEnigDecryptedMessage)
    return "No decrypted message found!\n";

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return "";

  var headerList = gEnigDecryptedMessage.headerList;

  var statusLine = gEnigSecurityInfo ? gEnigSecurityInfo.statusLine : "";

  var contentData = "";

  var headerName, headerValue;

  if (contentType == "message/rfc822") {
    // message/rfc822

    if (includeHeaders) {
      for (headerName in headerList) {
        headerValue = headerList[headerName];

        if (headerValue)
          contentData += headerName + ": " + headerValue + "\r\n";
      }
    }

    contentData += "Content-Type: text/plain";

    if (gEnigDecryptedMessage.charset) {
      contentData += "; charset="+gEnigDecryptedMessage.charset;
    }

    contentData += "\r\n\r\n";

    if (gEnigDecryptedMessage.hasAttachments && (! gEnigDecryptedMessage.attachmentsEncrypted)) {
      contentData += EnigGetString("enigContentNote");
    }

    contentData += gEnigDecryptedMessage.plainText;

  } else {
    // text/html or text/plain

    if (contentType == "text/html") {
      contentData += "<meta http-equiv=\"Content-Type\" content=\"text/html; charset="+gEnigDecryptedMessage.charset+"\">\r\n";

      contentData += "<html><head></head><body>\r\n";
    }

    if (statusLine) {
      if (contentType == "text/html") {
        contentData += "<b>"+EnigGetString("enigHeader")+"</b> " +
                       enigEscapeTextForHTML(statusLine, false) + "<br>\r\n<hr>\r\n";
      } else{
        contentData += EnigGetString("enigHeader")+" " + statusLine + "\r\n\r\n";
      }
    }

    if (includeHeaders) {
      for (headerName in headerList) {
        headerValue = headerList[headerName];

        if (headerValue) {
          if (contentType == "text/html") {
            contentData += "<b>"+enigEscapeTextForHTML(headerName, false)+":</b> "+
                                 enigEscapeTextForHTML(headerValue, false)+"<br>\r\n";
          } else {
            contentData += headerName + ": " + headerValue + "\r\n";
          }
        }
      }
    }

    if (contentType == "text/html") {
      contentData += "<pre>"+enigEscapeTextForHTML(gEnigDecryptedMessage.plainText, false)+"</pre>\r\n";

      contentData += "</body></html>\r\n";

    } else {

      contentData += "\r\n"+gEnigDecryptedMessage.plainText;
    }

    if (!(enigmailSvc.isWin32)) {
      contentData = contentData.replace(/\r\n/g, "\n");
    }
  }

  return contentData;
}

function enigMsgDefaultPrint(contextMenu, elementId) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDefaultPrint: "+contextMenu+"\n");

  // Reset mail.show_headers pref to "original" value
  EnigShowHeadersAll(false);

  if (contextMenu)
    PrintEnginePrint();
  else
    goDoCommand(elementId == "cmd_printpreview" ? "cmd_printpreview" : "cmd_print");
}

function enigMsgForward(elementId, event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgForward: "+elementId+", "+event+"\n");

  // Reset mail.show_headers pref to "original" value
  EnigShowHeadersAll(false);

  if ((elementId == "cmd_forwardAttachment") ||
      (elementId == "threadPaneContext-forwardAsAttachment")) {
    MsgForwardAsAttachment(event);

  } else if (elementId == "cmd_forwardInline") {
    MsgForwardAsInline(event);

  } else {
    MsgForwardMessage(event);
  }
}

function enigMsgPrint(elementId) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgPrint: "+elementId+"\n");

  var contextMenu = (elementId.search("Context") > -1);

  if (!gEnigDecryptedMessage)
    enigMsgDefaultPrint(contextMenu, elementId);

  var mailNewsUrl = enigGetCurrentMsgUrl();

  if (!mailNewsUrl)
    enigMsgDefaultPrint(contextMenu, elementId);

  if (gEnigDecryptedMessage.url != mailNewsUrl.spec) {
    gEnigDecryptedMessage = null;
    enigMsgDefaultPrint(contextMenu);
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    enigMsgDefaultPrint(contextMenu, elementId);

  // Note: Trying to print text/html content does not seem to work with
  //       non-ASCII chars
  var msgContent = enigGetDecryptedMessage("message/rfc822", true);

  var uri = enigmailSvc.createMessageURI(gEnigDecryptedMessage.url,
                                         "message/rfc822",
                                         "",
                                         msgContent,
                                         false);

  gEnigCreatedURIs.push(uri);

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgPrint: uri="+uri+"\n");

  var messageList = [uri];

  if (gPrintSettings == null) {
    gPrintSettings = GetPrintSettings();
  }

  var printPreview = (elementId == "cmd_printpreview");
  var printEngineWindow = window.openDialog("chrome://messenger/content/msgPrintEngine.xul",
                                        "",
                                        "chrome,dialog=no,all,centerscreen",
                                        1, messageList, statusFeedback, gPrintSettings,
                                        printPreview, Components.interfaces.nsIMsgPrintEngine.MNAB_PRINTPREVIEW_MSG,
                                        window);

  return true;

}

function enigMessageSave() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageSave: \n");

  if (!gEnigDecryptedMessage) {
    EnigAlert(EnigGetString("noDecrypted"));
    return;
  }

  var mailNewsUrl = enigGetCurrentMsgUrl();

  if (!mailNewsUrl) {
    EnigAlert(EnigGetString("noMessage"));
    return;
  }

  if (gEnigDecryptedMessage.url != mailNewsUrl.spec) {
    gEnigDecryptedMessage = null;
    EnigAlert(EnigGetString("useButton"));
    return;
  }

  var saveFile = EnigFilePicker(EnigGetString("saveHeader"),
                                gEnigLastSaveDir, true, "txt",
                                null, ["Text files", "*.txt"]);
  if (!saveFile) return;

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageSave: path="+saveFile.path+"\n");

  if (saveFile.parent)
    gEnigLastSaveDir = saveFile.parent.path;

  var textContent = enigGetDecryptedMessage("text/plain", true);

  if (!EnigWriteFileContents(saveFile.path, textContent, null)) {
    EnigAlert("Error in saving to file "+saveFile.path);
    return;
  }

  return;
}


function EnigFilePicker(title, displayDir, save, defaultExtension, defaultName, filterPairs) {
  DEBUG_LOG("enigmailMessengerOverlay.js: EnigFilePicker: "+save+"\n");

  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance();
  filePicker = filePicker.QueryInterface(nsIFilePicker);

  var mode = save ? nsIFilePicker.modeSave : nsIFilePicker.modeOpen;

  filePicker.init(window, title, mode);

  if (displayDir) {
    var localFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);

    try {
      localFile.initWithPath(displayDir);
      filePicker.displayDirectory = localFile;
    } catch (ex) {
    }
  }

  if (defaultExtension)
    filePicker.defaultExtension = defaultExtension;

  if (defaultName)
    filePicker.defaultString=defaultName;

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


function enigMsgDirect(interactive, importOnly, contentEncoding, charset, signature, head, tail) {
  WRITE_LOG("enigmailMessengerOverlay.js: enigMsgDirect: contentEncoding="+contentEncoding+", signature="+signature+"\n");
  var mailNewsUrl = enigGetCurrentMsgUrl();
  if (!mailNewsUrl)
    return;

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

  ipcBuffer.open(ENIG_MSG_BUFFER_SIZE, false);

  var callbackArg = { interactive:interactive,
                      importOnly:importOnly,
                      contentEncoding:contentEncoding,
                      charset:charset,
                      messageUrl:mailNewsUrl.spec,
                      signature:signature,
                      ipcBuffer:ipcBuffer,
                      head:head,
                      tail:tail };

  var requestObserver = new EnigRequestObserver(enigMsgDirectCallback,
                                                callbackArg);

  ipcBuffer.observe(requestObserver, mailNewsUrl);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  var channel = ioServ.newChannelFromURI(mailNewsUrl);

  var pipeFilter = Components.classes[ENIG_PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);

  pipeFilter.init(ipcBuffer, null,
                "-----BEGIN PGP",
                "-----END PGP",
                0, true, false, null);

  var listener;

  try {
    var mimeListener = Components.classes[ENIG_ENIGMIMELISTENER_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeListener);

    mimeListener.init(pipeFilter, null, ENIG_MSG_HEADER_SIZE, true, false, true);

    listener = mimeListener;

  } catch (ex) {
    listener = pipeFilter;
  }

  channel.asyncOpen(listener, mailNewsUrl);
}


function enigMsgDirectCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: "+ctxt+"\n");

  var mailNewsUrl = enigGetCurrentMsgUrl();
  var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

  if (urlSpec != callbackArg.messageUrl) {
    ERROR_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: Message URL mismatch "+mailNewsUrl.spec+" vs. "+callbackArg.messageUrl+"\n");
    return;
  }

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: MESSAGE BUFFER OVERFLOW\n");
  }

  var msgText = callbackArg.ipcBuffer.getData();

  callbackArg.ipcBuffer.shutdown();

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: msgText='"+msgText+"'\n");

  enigMessageParseCallback(msgText, callbackArg.contentEncoding,
                           callbackArg.charset,
                           callbackArg.interactive,
                           callbackArg.importOnly,
                           callbackArg.messageUrl,
                           callbackArg.signature,
                           false,
                           callbackArg.head,
                           callbackArg.tail);
}


function enigKeyRequest(interactive, keyId, urlSpec) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequest: keyId="+keyId+", urlSpec="+urlSpec+"\n");

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

  ipcBuffer.open(ENIG_KEY_BUFFER_SIZE, false);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  try {
    var uri = ioServ.newURI(urlSpec, "", null);

    var channel = ioServ.newChannelFromURI(uri);

    var httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);

    // Disable HTTP redirection
    httpChannel.redirectionLimit = 0;

    var callbackArg = { interactive:interactive,
                        keyId:keyId,
                        urlSpec:urlSpec,
                        httpChannel:httpChannel,
                        ipcBuffer:ipcBuffer };

    var requestObserver = new EnigRequestObserver(enigKeyRequestCallback,
                                                  callbackArg);

    ipcBuffer.observe(requestObserver, null);

    DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequest: httpChannel="+httpChannel+", asyncOpen ...\n");

    httpChannel.asyncOpen(ipcBuffer, null);

  } catch (ex) {
    ERROR_LOG("enigmailMessengerOverlay.js: enigKeyRequest: Error - failed to create channel\n");
  }

}


function enigKeyRequestCallback(callbackArg, ctxt) {
  var urlSpec = callbackArg.urlSpec;
  var httpChannel = callbackArg.httpChannel;

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: urlSpec="+urlSpec+"\n");

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: KEY BUFFER OVERFLOW\n");
  }

  var eTag = httpChannel.getResponseHeader("ETag");

  var keyText = callbackArg.ipcBuffer.getData();

  callbackArg.ipcBuffer.shutdown();

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: keyText='"+keyText+"'\n");

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: NoCache='"+httpChannel.isNoCacheResponse()+"'\n");

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: ETag: "+eTag+"\n");

  // NEED TO EXTRACT KEY ETC.
}

function enigOnShowAttachmentContextMenu() {
  // if no attachments are selected, disable the Open and Save...
  // this is Messenger's onShowAttachmentContextMenu, extended by
  // Enigmail specific stuff!
  var attachmentList = document.getElementById('attachmentList');
  var selectedAttachments = attachmentList.selectedItems;
  var openMenu = document.getElementById('context-openAttachment');
  var saveMenu = document.getElementById('context-saveAttachment');
  var decryptOpenMenu = document.getElementById('enigmail_ctxDecryptOpen');
  var decryptSaveMenu = document.getElementById('enigmail_ctxDecryptSave');
  if (selectedAttachments.length > 0)
  {
    openMenu.removeAttribute('disabled');
    saveMenu.removeAttribute('disabled');

    if (enigCheckEncryptedAttach(selectedAttachments[0].attachment)) {
      decryptOpenMenu.removeAttribute('disabled');
      decryptSaveMenu.removeAttribute('disabled');
      if (! selectedAttachments[0].attachment.displayName) {
        selectedAttachments[0].attachment.displayName="message.pgp"
      }
    }
    else {
      decryptOpenMenu.setAttribute('disabled', true);
      decryptSaveMenu.setAttribute('disabled', true);
    }
  }
  else
  {
    openMenu.setAttribute('disabled', true);
    saveMenu.setAttribute('disabled', true);
    decryptOpenMenu.setAttribute('disabled', true);
    decryptSaveMenu.setAttribute('disabled', true);
  }
}

// handle a selected attachment (decrypt & open or save)
function enigHandleAttachmentSel(actionType) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigHandleAttachmentSel: actionType="+actionType+"\n");

  var attachmentList = document.getElementById('attachmentList');
  var selectedAttachments = attachmentList.selectedItems;
  var anAttachment = selectedAttachments[0].attachment;

  if (actionType=="saveAttachment" || actionType=="openAttachment") {
    enigHandleAttachment(actionType, anAttachment);
  }
}


function enigHandleAttachment(actionType, anAttachment) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigHandleAttachment: actionType="+actionType+", anAttachment(url)="+anAttachment.url+"\n");

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);


  var callbackArg = { actionType:actionType,
                      attachment:anAttachment,
                      forceBrowser:false,
                      ipcBuffer:ipcBuffer
                    };

  var requestObserver = new EnigRequestObserver(enigHandleAttachmentCallback,
                                                callbackArg);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  ipcBuffer.open(100, false); // get just the first bit
  var msgUri = ioServ.newURI(anAttachment.url, null, null);

  ipcBuffer.observe(requestObserver, msgUri);

  var channel = ioServ.newChannelFromURI(msgUri);

  var pipeFilter = Components.classes[ENIG_PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);

  pipeFilter.init(ipcBuffer, null,
                "",
                "",
                0, false, false, null);

  var listener;
  listener = pipeFilter;

  channel.asyncOpen(listener, msgUri);
}

function enigHandleAttachmentCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigHandleAttachmentCallback: "+ctxt+"\n");

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigHandleAttachmentCallback: MESSAGE BUFFER OVERFLOW\n");
  }

  var dataLengthObj = new Object();
  var attachmentHead = callbackArg.ipcBuffer.getByteData(dataLengthObj);
  callbackArg.ipcBuffer.shutdown();


  if (attachmentHead.match(/\-\-\-\-\-BEGIN PGP \w+ KEY BLOCK\-\-\-\-\-/)) {
    // attachment appears to be a PGP key file

    if (EnigConfirm(EnigGetString("attachmentPgpKey", callbackArg.attachment.displayName))) {
      enigImportAttachment(callbackArg);
    }
    else {
      EnigLoadURLInNavigatorWindow(callbackArg.attachment.url, true)
    }
  }
  else {
    // attachment is probably encrypted
    enigDecryptAttachment(callbackArg);
  }
}

// try to decrypt an attachment
function enigDecryptAttachment(argumentsObj) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDecryptAttachment: url"+argumentsObj.attachment.url+"\n");

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

  argumentsObj.ipcBuffer=ipcBuffer;

  var requestObserver = new EnigRequestObserver(enigDecryptAttachmentCallback,
                                                argumentsObj);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  ipcBuffer.open(99999999999, false); // -1 doesn't work, so I set it to a _big_ number ...
  var msgUri = ioServ.newURI(argumentsObj.attachment.url, null, null);

  ipcBuffer.observe(requestObserver, msgUri);

  var channel = ioServ.newChannelFromURI(msgUri);

  var pipeFilter = Components.classes[ENIG_PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);

  pipeFilter.init(ipcBuffer, null,
                "",
                "",
                0, false, false, null);

  var listener;
  listener = pipeFilter;

  channel.asyncOpen(listener, msgUri);
}


function enigDecryptAttachmentCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDecryptAttachmentCallback: "+ctxt+"\n");

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigDecryptAttachmentCallback: MESSAGE BUFFER OVERFLOW\n");
  }

  var exitCodeObj = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj= new Object();
  var enigmailSvc =  GetEnigmailSvc();
  var outFile;
  var rawFileName=callbackArg.attachment.displayName.replace(/\.(asc|pgp|gpg)$/,"");

  if (callbackArg.actionType == "saveAttachment") {
    outFile = EnigFilePicker(EnigGetString("saveAttachmentHeader"),
                                gEnigLastSaveDir, true, "",
                                rawFileName, null);
    if (! outFile) return;
  }
  else {
    // open
    var tmpDir = EnigGetTempDir();
    try {
      outFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
      outFile.initWithPath(tmpDir);
      if (!(outFile.isDirectory() && outFile.isWritable())) {
        errorMsgObj.value=EnigGetString("noTempDir");
        return -1;
      }
      outFile.append(rawFileName);
      outFile.createUnique(Components.interfaces.NORMAL_FILE_TYPE, 0600);
    }
    catch (ex) {
      errorMsgObj.value=EnigGetString("noTempDir");
      return -1;
    }
  }

  var exitStatus=enigmailSvc.decryptAttachment(window, outFile.path, callbackArg.ipcBuffer,
                                exitCodeObj, statusFlagsObj,
                                errorMsgObj);

  callbackArg.ipcBuffer.shutdown();
  if ((! exitStatus) || exitCodeObj.value != 0) {
    exitStatus=false;
    if (statusFlagsObj.value &
        (nsIEnigmail.DECRYPTION_OKAY | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
      if (callbackArg.actionType == "openAttachment") {
        exitStatus = EnigConfirm(EnigGetString("decryptOkNoSig")+"\n\n"+EnigGetString("contAnyway"));
      }
      else {
        EnigAlert(EnigGetString("decryptOkNoSig"));
      }
    }
    else {
      EnigAlert(EnigGetString("failedDecrypt")+"\n\n"+errorMsgObj.value);
      exiStatus=false;
    }
  }
  if (exitStatus && callbackArg.actionType == "openAttachment") {
    var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
    var outFileUri = ioServ.newFileURI(outFile);
    var fileExt = outFile.leafName.replace(/(.*\.)(\w+)$/, "$2")
    if (fileExt && ! callbackArg.forceBrowser) {
      try {
        var extAppLauncher = Components.classes[ENIG_MIME_CONTRACTID].getService(Components.interfaces.nsPIExternalAppLauncher);
        extAppLauncher.deleteTemporaryFileOnExit(outFile);

        var mimeService = Components.classes[ENIG_MIME_CONTRACTID].getService(Components.interfaces.nsIMIMEService);
        var fileMimeType = mimeService.GetTypeFromFile(outFile);
        var fileMimeInfo = mimeService.GetFromMIMEType(fileMimeType);
        if ((fileMimeInfo.preferredAction == fileMimeInfo.useHelperApp ||
            fileMimeInfo.preferredAction == fileMimeInfo.useSystemDefault) &&
            (! fileMimeType.indexOf("text/")==0)) {
          // open attachment with a helper application
          window.OpenURL(outFileUri.asciiSpec);
          return;
        }
      }
      catch (ex) {
        // if the attachment file type is unknown, an exception is thrown,
        // so let it be handled by a browser window
        EnigLoadURLInNavigatorWindow(outFileUri.asciiSpec, true)
        return;
      }
    }

    // open the attachment in a browser window
    EnigLoadURLInNavigatorWindow(outFileUri.asciiSpec, true)
  }
}


// try to import the PGP keys contained in an attachment
function enigImportAttachment(argumentsObj) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigImportAttachment: url"+argumentsObj.attachment.url+"\n");

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

  argumentsObj.ipcBuffer=ipcBuffer;

  var requestObserver = new EnigRequestObserver(enigImportAttachmentCallback,
                                                argumentsObj);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  ipcBuffer.open(99999999999, false); // -1 doesn't work, so I set it to a _big_ number ...
  var msgUri = ioServ.newURI(argumentsObj.attachment.url, null, null);

  ipcBuffer.observe(requestObserver, msgUri);

  var channel = ioServ.newChannelFromURI(msgUri);

  var pipeFilter = Components.classes[ENIG_PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);

  pipeFilter.init(ipcBuffer, null,
                "",
                "",
                0, false, false, null);

  var listener;
  listener = pipeFilter;

  channel.asyncOpen(listener, msgUri);
}


function enigImportAttachmentCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigImportAttachmentCallback: "+ctxt+"\n");

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigImportAttachmentCallback: MESSAGE BUFFER OVERFLOW\n");
  }

  var dataLengthObj = new Object();
  var dataText = callbackArg.ipcBuffer.getByteData(dataLengthObj);
  callbackArg.ipcBuffer.shutdown();

  var errorMsgObj= new Object();
  var enigmailSvc =  GetEnigmailSvc();
  var exitCode = enigmailSvc.importKey (window, 0, dataText, "", errorMsgObj);

  if (exitCode == 0) {
    EnigAlert(EnigGetString("successKeyImport")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigError(EnigGetString("failKeyImport")+"\n\n"+errorMsgObj.value);
  }

}

// handle double click events on Attachments
function enigAttachmentListClick (elementId, event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigAttachmentListClick: event="+event+"\n");

  var attachment=event.target.attachment;
  if (enigCheckEncryptedAttach(attachment)) {
    if (event.button != 0) return;

    if (event.detail == 2) // double click
      enigHandleAttachment("openAttachment", attachment);
  }
  else {
    attachmentListClick(event);
  }
}
