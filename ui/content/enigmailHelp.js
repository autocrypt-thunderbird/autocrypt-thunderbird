// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailHelp");

function enigHelpLoad() {
  DEBUG_LOG("enigmailHelp.js: enigHelpLoad\n");

  var contentFrame = EnigGetFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  contentFrame.document.location.href=window.arguments[0];
}

window.onload = enigHelpLoad;
