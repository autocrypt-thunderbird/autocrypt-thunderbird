// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgPrintOverlay");

window.addEventListener("load", enigMsgPrintLoad, false);
window.addEventListener("unload", enigMsgPrintUnload, false);

function enigMsgPrintLoad()
{
  DEBUG_LOG("enigmailMsgPrintOverlay.js: enigMsgPrintLoad\n");
}

function enigMsgPrintUnload()
{
  DEBUG_LOG("enigmailMsgPrintOverlay.js: enigMsgPrintUnload\n");

  if (EnigGetPref("parseAllHeaders")) {
    gEnigPrefRoot.setIntPref("mail.show_headers", 2);
  }
}
