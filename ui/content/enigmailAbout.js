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
    versionElement.firstChild.data = "Running Enigmail version "+gEnigmailVersion;

  var enigmimeElement = contentFrame.document.getElementById('enigmime');

  try {
    var enigMimeService = Components.classes[NS_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

    var binaryVersion = enigMimeService.version.replace(/\.\d+\.\d+$/, "");
    var textVersion = gEnigmimeVersion.replace(/\.\d+\.\d+$/, "");

    if (binaryVersion != textVersion) {
      if (enigmimeElement)
        enigmimeElement.firstChild.data = "Warning: Incompatible EnigMime version "+enigMimeService.version;
    }

    DEBUG_LOG("enigmailAbout.js: enigAboutLoad: EnigMime: "+binaryVersion+", "+textVersion+"\n");

  } catch (ex) {
    if (enigmimeElement)
      enigmimeElement.firstChild.data = "Warning: EnigMime module not available";
  }

  var enigmailSvc = GetEnigmailSvc();

  var agentStr;
  if (enigmailSvc) {
    agentStr = "Using "+enigmailSvc.agentType+" executable "+enigmailSvc.agentPath.replace(/\\\\/g, "\\")+" to encrypt and decrypt";

  } else {
    agentStr = "ERROR: Failed to access enigmail service!";

    if (gEnigmailSvc && gEnigmailSvc.initializationError)
      agentStr += "\n" + gEnigmailSvc.initializationError;
  }

  var agentElement = contentFrame.document.getElementById('agent');
  if (agentElement)
    agentElement.firstChild.data = agentStr;

}

window.onload = enigAboutLoad;
