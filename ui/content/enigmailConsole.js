// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailConsole");

function enigConsoleLoad() {
  DEBUG_LOG("enigmailConsole.js: enigConsoleLoad\n");

  top.controllers.insertControllerAt(0, CommandController);

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

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

  if (enigmailSvc.console.hasNewData()) {
    DEBUG_LOG("enigmailConsole.js: enigRefreshConsole(): hasNewData\n");

    var contentFrame = EnigGetFrame(window, "contentFrame");
    if (!contentFrame)
      return;

    var consoleElement = contentFrame.document.getElementById('console');

    consoleElement.firstChild.data = enigmailSvc.console.getData();

    if (!contentFrame.mouseDownState)
       contentFrame.scrollTo(0,9999);
  }

  return false;
}

function enigConsoleCopy()
{
  var selText = enigConsoleGetSelectionStr();

  DEBUG_LOG("enigmailConsole.js: enigConsoleCopy: selText='"+selText+"'\n");

  if (selText) {
    var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);

    clipHelper.copyString(selText);
  }

  return true;
}

function enigConsoleGetSelectionStr()
{
  try {
    var contentFrame = EnigGetFrame(window, "contentFrame");

    var sel = contentFrame.getSelection();
    return sel.toString();

  } catch (ex) {
    return "";
  }
}

function isItemSelected()
{
  DEBUG_LOG("enigmailConsole.js: isItemSelected\n");
  return enigConsoleGetSelectionStr() != "";
}

function UpdateCopyMenu()
{
  DEBUG_LOG("enigmailConsole.js: enigConsoleUpdateCopyMenu\n");
  goUpdateCommand("cmd_copy");
}

var CommandController = 
{
  isCommandEnabled: function (aCommand)
  {
    switch (aCommand) {
      case "cmd_copy":
        return isItemSelected();
      default:
        return false;
    }
  },
  
  supportsCommand: function (aCommand) 
  {
    switch (aCommand) {
      case "cmd_copy":
        return true;
      default:
        return false;
    }
  },
  
  doCommand: function (aCommand)
  {
    switch (aCommand) {
      case "cmd_copy":
        enigConsoleCopy();
        break;
      default:
        break;
    }
  },
  
  onEvent: function (aEvent) 
  {
  }
};
