// Uses: chrome://enigmail/content/enigmailCommon.js

function OnLoadEnigPanel() {
  DEBUG_LOG("enigmailPanel.js: OnLoadEnigPanel\n");

  var contentWin = top._content;
  var contentURL = contentWin.location.href;

  DEBUG_LOG("enigmailPanel.js: contentURL="+contentURL+"\n");
}

function OnUnloadEnigPanel() {
  DEBUG_LOG("enigmailPanel.js: OnUnloadEnigPanel\n");
}
