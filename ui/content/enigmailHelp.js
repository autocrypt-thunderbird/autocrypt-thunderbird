// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailHelp");

function enigHelpLoad() {
  DEBUG_LOG("enigmailHelp.js: enigHelpLoad\n");

  var contentFrame = EnigGetFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var winOptions = EnigGetWindowOptions();
  var helpFile = winOptions["src"];
  contentFrame.document.location.href="chrome://enigmail/locale/help/"+helpFile+".html";
}

window.onload = enigHelpLoad;
