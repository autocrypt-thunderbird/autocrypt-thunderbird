// enigmailSelectPanel.js

const ENIG_DEBUG = true; /* set to false to suppress debug messages */
const ENIG_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";

if (ENIG_DEBUG)
    EnigDebug = function (s) { dump(s); }
else
    EnigDebug = function (s) {}

function OnLoadEnigmailSelectPanel() {
  EnigDebug("enigmailSelectPanel.js: OnLoadEnigmailSelectPanel\n");
}

function OnUnloadEnigmailSelectPanel() {
  EnigDebug("enigmailSelectPanel.js: OnUnloadEnigmailSelectPanel\n");
}

function SelectPanel() {

  var enigmailSvc;

  try {
    enigmailSvc = Components.classes[ENIG_ENIGMAIL_CONTRACTID].createInstance(Components.interfaces.nsIEnigmail);

  } catch (ex) {
    EnigDebug("enigmailSelectPanel.js: Error in instantiating EnigmailService\n");
  }

  EnigDebug("enigmailSelectPanel.js: enigmailSvc = " + enigmailSvc + "\n");

  enigmailSvc.selectPanel(document.location.href);
}
