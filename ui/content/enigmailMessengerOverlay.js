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

    var plainText = EnigDecryptMessage(cipherText);
    dump("enigmailMessengerOverlay.js: plainText='"+plainText+"'\n");
}



