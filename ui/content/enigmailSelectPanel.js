// enigmailSelectPanel.js

const DEBUG = true; /* set to false to suppress debug messages */
const NS_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";

if (DEBUG)
    debug = function (s) { dump(s); }
else
    debug = function (s) {}

function OnLoadEnigmailSelectPanel() {
  debug("enigmailSelectPanel.js: OnLoadEnigmailSelectPanel\n");
}

function OnUnloadEnigmailSelectPanel() {
  debug("enigmailSelectPanel.js: OnUnloadEnigmailSelectPanel\n");
}

function SelectPanel() {

  var gEnigmailSvc;

  try {
    gEnigmailSvc = Components.classes[NS_ENIGMAIL_CONTRACTID].createInstance(Components.interfaces.nsIEnigmail);

  } catch (ex) {
    debug("enigmailSelectPanel.js: Error in instantiating EnigmailService\n");
  }

  debug("enigmailSelectPanel.js: gEnigmailSvc = " + gEnigmailSvc + "\n");

  gEnigmailSvc.selectPanel(document.location.href);
}
