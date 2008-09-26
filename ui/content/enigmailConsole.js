/*
The contents of this file are subject to the Mozilla Public
License Version 1.1 (the "MPL"); you may not use this file
except in compliance with the MPL. You may obtain a copy of
the MPL at http://www.mozilla.org/MPL/

Software distributed under the MPL is distributed on an "AS
IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
implied. See the MPL for the specific language governing
rights and limitations under the MPL.

The Original Code is Enigmail.

The Initial Developer of the Original Code is Ramalingam Saravanan.
Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.

Contributor(s):
Patrick Brunschwig <patrick.brunschwig@gmx.net>

Alternatively, the contents of this file may be used under the
terms of the GNU General Public License (the "GPL"), in which case
the provisions of the GPL are applicable instead of
those above. If you wish to allow use of your version of this
file only under the terms of the GPL and not to allow
others to use your version of this file under the MPL, indicate
your decision by deleting the provisions above and replace them
with the notice and other provisions required by the GPL.
If you do not delete the provisions above, a recipient
may use your version of this file under either the MPL or the
GPL.
*/

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

    consoleElement.firstChild.data = EnigConvertToUnicode(enigmailSvc.console.getData(), "utf-8");

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
