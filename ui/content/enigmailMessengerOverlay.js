// Uses: chrome://enigmail/content/enigmailCommon.js

window.addEventListener("load", enigMessengerStartup, false);

function enigMessengerStartup() {
    WRITE_LOG("enigmailMessengerOverlay.js: enigMessengerStartup\n");

    var messagePaneWindow = top.frames['messagepane'];
    WRITE_LOG("enigmailMessengerOverlay.js: messagePaneWindow = "+messagePaneWindow+"\n");

    messagePaneWindow.addEventListener("load", enigMessageLoad, false);
}

function enigMessageLoad() {
    WRITE_LOG("enigmailMessengerOverlay.js: enigMessageLoad\n");
}

function enigDecryptMessage() {
    WRITE_LOG("enigmailMessengerOverlay.js: enigDecryptMessage\n");

    var msgFrame = window.frames["messagepane"];
    WRITE_LOG("enigmailMessengerOverlay.js: msgFrame="+msgFrame+"\n");

    EnigDumpHTML(msgFrame.document.documentElement);

    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
    WRITE_LOG("enigmailMessengerOverlay.js: bodyElement="+bodyElement+"\n");

    var cipherText = EnigGetDeepText(bodyElement);
    WRITE_LOG("enigmailMessengerOverlay.js: cipherText='"+cipherText+"'\n");

    var statusCodeObj = new Object();
    var statusMsgObj  = new Object();
    var plainText = EnigDecryptMessage(cipherText,
                                       statusCodeObj, statusMsgObj);
    WRITE_LOG("enigmailMessengerOverlay.js: plainText='"+plainText+"'\n");

    var statusCode = statusCodeObj.value;
    var statusMsg  = statusMsgObj.value;

    var statusBox = document.getElementById("expandedEnigmailBox");
    var statusText = document.getElementById("expandedEnigmailText");

    statusText.setAttribute("value", statusMsg);
    statusBox.removeAttribute("collapsed");

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

