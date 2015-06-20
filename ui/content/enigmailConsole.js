/*global Components: false, EnigmailWindows: false */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false*/
Components.utils.import("resource://enigmail/pipeConsole.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/windows.jsm");

function consoleLoad() {
  EnigmailLog.DEBUG("enigmailConsole.js: consoleLoad\n");

  top.controllers.insertControllerAt(0, CommandController);

  EnigmailCore.getService(window);

  // Refresh console every 2 seconds
  window.consoleIntervalId = window.setInterval(refreshConsole, 2000);
  updateData();
}

function consoleUnload() {
  EnigmailLog.DEBUG("enigmailConsole.js: consoleUnload\n");

  // Cancel console refresh
  if (window.consoleIntervalId) {
    window.clearInterval(window.consoleIntervalId);
    window.consoleIntervalId = null;
  }
}

window.onload = consoleLoad;
window.onunload = consoleUnload;

function refreshConsole() {
  //EnigmailLog.DEBUG("enigmailConsole.js: refreshConsole():\n");

  if (EnigmailConsole.hasNewData()) {
    EnigmailLog.DEBUG("enigmailConsole.js: refreshConsole(): hasNewData\n");

    updateData();
  }

  return false;
}

function updateData() {
  //EnigmailLog.DEBUG("enigmailConsole.js: updateData():\n");

    var contentFrame = EnigmailWindows.getFrame(window, "contentFrame");
    if (!contentFrame)
      return;

    var consoleElement = contentFrame.document.getElementById('console');

    consoleElement.firstChild.data = EnigmailData.convertToUnicode(EnigmailConsole.getData(), "utf-8");

    if (!contentFrame.mouseDownState)
       contentFrame.scrollTo(0,9999);
}


function enigmailConsoleCopy()
{
  var selText = getSelectionStr();

  EnigmailLog.DEBUG("enigmailConsole.js: enigmailConsoleCopy: selText='"+selText+"'\n");

  if (selText) {
    var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);

    clipHelper.copyString(selText);
  }

  return true;
}

function getSelectionStr()
{
  try {
    var contentFrame = EnigmailWindows.getFrame(window, "contentFrame");

    var sel = contentFrame.getSelection();
    return sel.toString();

  } catch (ex) {
    return "";
  }
}

function isItemSelected()
{
  EnigmailLog.DEBUG("enigmailConsole.js: isItemSelected\n");
  return getSelectionStr() !== "";
}

function UpdateCopyMenu()
{
  EnigmailLog.DEBUG("enigmailConsole.js: UpdateCopyMenu\n");
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
        enigmailConsoleCopy();
        break;
      default:
        break;
    }
  },

  onEvent: function (aEvent)
  {
  }
};
