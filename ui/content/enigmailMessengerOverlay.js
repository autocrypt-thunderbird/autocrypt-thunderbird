// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMessengerOverlay");

window.addEventListener("load", enigMessengerStartup, false);

function enigMessengerStartup() {
    DEBUG_LOG("enigmailMessengerOverlay.js: Startup\n");
    // Commented out; clean-up now handled by HdrView
    ///var outliner = GetThreadOutliner();
    ///outliner.addEventListener("click", enigThreadPaneOnClick, true);
}

function enigThreadPaneOnClick() {
    //DEBUG_LOG("enigmailMessengerOverlay.js: enigThreadPaneOnClick\n");
    var enigmailBox = document.getElementById("expandedEnigmailBox");
    var statusText = document.getElementById("expandedEnigmailStatusText");

    statusText.setAttribute("value", "");
    enigmailBox.setAttribute("collapsed", "true");
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

  enigMessageDecryptCallback(msgText, interactive, "");
}


function enigMessageDecryptCallback(msgText, interactive, signature) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCallback: "+interactive+", "+"signature='"+signature+"'\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();
  var signatureObj = new Object();
  signatureObj.value = signature;

  var plainText = enigmailSvc.decryptMessage(window, interactive, msgText,
                                     exitCodeObj, errorMsgObj, signatureObj);
  //DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCallback: plainText='"+plainText+"'\n");

  var newSignature = signatureObj.value;
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCallback: newSignature='"+newSignature+"'\n");

  var exitCode = exitCodeObj.value;
  var errorMsg = errorMsgObj.value;

  var enigmailBox = document.getElementById("expandedEnigmailBox");
  var statusText  = document.getElementById("expandedEnigmailStatusText");

  var statusLines = errorMsg.split(/\r?\n/);

  var displayMsg;
  if (statusLines && statusLines.length) {
    statusText.setAttribute("value", statusLines[0]);
    enigmailBox.removeAttribute("collapsed");

    // Display only first ten lines of error message
    while (statusLines.length > 10)
      statusLines.pop();

    displayMsg = statusLines.join("\n");
  }

  if (!signature && newSignature) {
    return enigMsgDirect(interactive, newSignature);
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

  return;
}

function enigMsgDirect(interactive, signature) {
  WRITE_LOG("enigmailMessengerOverlay.js: enigMsgDirect: signature="+signature+"\n");
  var mailNewsUrl = enigGetCurrentMsgUrl();

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  var callbackArg = { interactive:interactive,
                      signature:signature,
                      messageUrl:mailNewsUrl.spec,
                      pipeConsole:pipeConsole };

  var requestObserver = new RequestObserver(enigMsgDirectCallback,
                                            callbackArg);

  pipeConsole.openURI(mailNewsUrl, MESSAGE_BUFFER_SIZE,
                      false, requestObserver, mailNewsUrl);
}

function enigMsgDirectCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: "+ctxt+"\n");

  var mailNewsUrl = enigGetCurrentMsgUrl();

  if (mailNewsUrl.spec != callbackArg.messageUrl) {
    ERROR_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: Message URL mismatch "+mailNewsUrl.spec+" vs. "+callbackArg.messageUrl+"\n");
    return;
  }

  var msgText = callbackArg.pipeConsole.data;
  callbackArg.pipeConsole.close();

  //DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: msgText='"+msgText+"'\n");

  enigMessageDecryptCallback(msgText, callbackArg.interactive,
                             callbackArg.signature);
}
