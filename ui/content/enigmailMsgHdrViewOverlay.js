// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgHdrViewOverlay");

function enigStartHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigStartHeaders\n");

  var statusBox = document.getElementById("expandedEnigmailBox");
  var statusText = document.getElementById("expandedEnigmailText");

  statusText.setAttribute("value", "");
  statusBox.setAttribute("collapsed", "true");

  if (EnigGetPref("autoDecrypt")) {
    var msgFrame = window.frames["messagepane"];
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");
    msgFrame.addEventListener("load", enigMessageDecrypt, false);
  }
}

function enigEndHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigEndHeaders\n");
}

function enigMsgHdrViewLoad(event)
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewLoad\n");

  var listener = {};
  listener.onStartHeaders = enigStartHeaders;
  listener.onEndHeaders = enigEndHeaders;
  gMessageListeners.push(listener);
}

addEventListener('messagepane-loaded', enigMsgHdrViewLoad, true);
