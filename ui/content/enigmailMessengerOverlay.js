// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMessengerOverlay");

window.addEventListener("load", enigMessengerStartup, false);

function enigMessengerStartup() {
    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessengerStartup\n");

    // Commented out; clean-up now handled by HdrView
    ///var outliner = GetThreadOutliner();
    ///outliner.addEventListener("click", enigThreadPaneOnClick, true);
}

function enigThreadPaneOnClick() {
    //DEBUG_LOG("enigmailMessengerOverlay.js: enigThreadPaneOnClick\n");
    var statusBox = document.getElementById("expandedEnigmailBox");
    var statusText = document.getElementById("expandedEnigmailText");

    statusText.setAttribute("value", "");
    statusBox.setAttribute("collapsed", "true");
}

function enigMessageDecrypt(event) {
    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: "+event+"\n");

    var msgFrame = window.frames["messagepane"];
    DEBUG_LOG("enigmailMessengerOverlay.js: msgFrame="+msgFrame+"\n");

    EnigDumpHTML(msgFrame.document.documentElement);

    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
    DEBUG_LOG("enigmailMessengerOverlay.js: bodyElement="+bodyElement+"\n");

    var cipherText = EnigGetDeepText(bodyElement);
    DEBUG_LOG("enigmailMessengerOverlay.js: cipherText='"+cipherText+"'\n");

    if (event && (cipherText.indexOf("----BEGIN PGP ") == -1)) {
      // No PGP content
      return;
    }

    var statusCodeObj = new Object();
    var statusMsgObj  = new Object();
    var plainText = EnigDecryptMessage(cipherText,
                                       statusCodeObj, statusMsgObj);
    DEBUG_LOG("enigmailMessengerOverlay.js: plainText='"+plainText+"'\n");

    var statusCode = statusCodeObj.value;
    var statusMsg  = statusMsgObj.value;

    var statusBox = document.getElementById("expandedEnigmailBox");
    var statusText = document.getElementById("expandedEnigmailText");

    var statusLines = statusMsg.split(/\r?\n/);

    if (statusLines && statusLines.length) {
      statusText.setAttribute("value", statusLines[0]);
      statusBox.removeAttribute("collapsed");
    }

    if (statusCode != 0) {
       if (!event)
         EnigAlert(statusMsg);
       return;
    }

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

addEventListener('messagepane-loaded', enigMessageLoad, true);
