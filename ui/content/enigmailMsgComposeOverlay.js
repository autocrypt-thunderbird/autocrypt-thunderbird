// enigmailMsgComposeOverlay.js

window.addEventListener("load", enigMsgComposeStartup, false);

function enigMsgComposeStartup() {
   dump("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");
   var origSendButton = document.getElementById("button-send");
   origSendButton.disabled = "true";
}

