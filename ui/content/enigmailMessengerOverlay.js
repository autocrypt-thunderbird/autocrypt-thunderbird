// enigmailMessengerOverlay.js

window.addEventListener("load", enigMessengerStartup, false);

function enigMessengerStartup() {
    dump("enigmailMessengerOverlay.js: enigMessengerStartup\n");

    var messagePaneWindow = top.frames['messagepane'];
    dump("enigmailMessengerOverlay.js: messagePaneWindow = "+messagePaneWindow+"\n");

    messagePaneWindow.addEventListener("load", enigMessageLoad, false);
}

function enigMessageLoad() {
    dump("enigmailMessengerOverlay.js: enigMessageLoad\n");
}

function enigDecryptMessage() {
    dump("enigmailMessengerOverlay.js: enigDecryptMessage\n");

    var msgFrame = window.frames["messagepane"];
    dump("enigmailMessengerOverlay.js: msgFrame="+msgFrame+"\n");

    EnigDumpHTML(msgFrame.document.documentElement);

    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
    dump("enigmailMessengerOverlay.js: bodyElement="+bodyElement+"\n");

    var cipherText = EnigGetDeepText(bodyElement);
    dump("enigmailMessengerOverlay.js: cipherText='"+cipherText+"'\n");

    var statusLineObj = new Object();
    var plainText = EnigDecryptMessage(cipherText, statusLineObj);
    dump("enigmailMessengerOverlay.js: plainText='"+plainText+"'\n");

    var statusBox = document.getElementById("expandedEnigmailBox");
    var statusText = document.getElementById("expandedEnigmailText");

    statusText.setAttribute("value", statusLineObj.value);
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

