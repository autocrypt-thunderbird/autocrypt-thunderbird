// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailConsole");

function enigConsoleLoad() {
  DEBUG_LOG("enigmailConsole.js: enigConsoleLoad\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  enigmailSvc.console.hasNewData = true;

  // Refresh console every 2 seconds
  window.consoleIntervalId = window.setInterval(enigRefreshConsole, 2000);
  enigRefreshConsole();
}

function enigConsoleUnload() {
  DEBUG_LOG("enigmailConsole.js: enigConsoleUnload\n");

  // Cancel console refresh
  if (window.consoleIntervalId) {
    window.clearInterval(window.consoleIntervalId);
    window.consoleIntervalId = null;
  }
}

window.onload = enigConsoleLoad;
window.onunload = enigConsoleUnload;

function enigRefreshConsole() {
  //DEBUG_LOG("enigmailConsole.js: enigRefreshConsole():\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (enigmailSvc.console.hasNewData) {
    DEBUG_LOG("enigmailConsole.js: enigRefreshConsole(): hasNewData\n");
    enigmailSvc.console.hasNewData = true;

    var contentFrame = window.frames["contentFrame"];
    if (!contentFrame)
      return;

    var consoleElement = contentFrame.document.getElementById('console');

    consoleElement.firstChild.data = enigmailSvc.console.data;

    if (!contentFrame.mouseDownState)
       contentFrame.scrollTo(0,9999);
  }

  return false;
}

function UpdateCopyMenu()
{
  goUpdateCommand("cmd_copy");
}
