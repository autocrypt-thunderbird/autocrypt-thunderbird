// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailAbout");

function enigAboutLoad() {
  DEBUG_LOG("enigmailAbout.js: enigAboutLoad\n");

  var contentFrame = window.frames["contentFrame"];
  if (!contentFrame)
    return;

  var versionElement = contentFrame.document.getElementById('version');
  if (versionElement)
    versionElement.firstChild.data = EnigGetString("usingVersion",gEnigmailVersion);

  var enigmimeElement = contentFrame.document.getElementById('enigmime');

  try {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

    var binaryVersion = enigMimeService.version.replace(/\.\d+\.\d+$/, "");
    var textVersion = gEnigmimeVersion.replace(/\.\d+\.\d+$/, "");

    if (binaryVersion != textVersion) {
      if (enigmimeElement)
        enigmimeElement.firstChild.data = EnigGetString("versionWarning",enigMimeService.version);
    }

    DEBUG_LOG("enigmailAbout.js: enigAboutLoad: EnigMime: "+binaryVersion+", "+textVersion+"\n");

  } catch (ex) {
    if (enigmimeElement)
      enigmimeElement.firstChild.data = EnigGetString("enigmimeWarning");
  }

  var enigmailSvc = GetEnigmailSvc();

  var agentStr;
  if (enigmailSvc) {
    agentStr = EnigGetString("usingAgent", enigmailSvc.agentType, enigmailSvc.agentPath.replace(/\\\\/g, "\\"));

  } else {
    agentStr = EnigGetString("agentError");

    if (gEnigmailSvc && gEnigmailSvc.initializationError)
      agentStr += "\n" + gEnigmailSvc.initializationError;
  }

  var agentElement = contentFrame.document.getElementById('agent');
  if (agentElement)
    agentElement.firstChild.data = agentStr;

}

window.onload = enigAboutLoad;
