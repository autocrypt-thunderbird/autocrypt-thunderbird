// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailAbout");

function enigAboutLoad() {
  DEBUG_LOG("enigmailAbout.js: enigAboutLoad\n");

  var contentFrame = window.frames["contentFrame"];
  if (!contentFrame)
    return;

  var versionStr = "Running Enigmail version "+gEnigmailVersion;

  var enigmailSvc = GetEnigmailSvc();

  var agentStr;
  if (enigmailSvc) {
    agentStr = "Using "+enigmailSvc.agentType+" executable "+enigmailSvc.agentPath.replace(/\\\\/g, "\\")+" to encrypt and decrypt";
  } else {
    agentStr = "ERROR: Failed to access enigmail service!";

    if (gEnigmailSvc && gEnigmailSvc.initializationError)
      agentStr += "\n" + gEnigmailSvc.initializationError;
  }

  var versionElement = contentFrame.document.getElementById('version');
  if (versionElement)
    versionElement.firstChild.data = versionStr;

  var agentElement = contentFrame.document.getElementById('agent');
  if (agentElement)
    agentElement.firstChild.data = agentStr;

}

window.onload = enigAboutLoad;
