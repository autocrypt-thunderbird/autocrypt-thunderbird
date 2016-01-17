/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false*/
Components.utils.import("resource://enigmail/pipeConsole.jsm"); /*global EnigmailConsole: false */
Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */

/* global goUpdateCommand: false */

var gConsoleIntervalId;

function consoleLoad() {
  EnigmailLog.DEBUG("enigmailConsole.js: consoleLoad\n");

  top.controllers.insertControllerAt(0, CommandController);

  EnigmailCore.getService(window);

  // Refresh console every 2 seconds
  gConsoleIntervalId = window.setInterval(refreshConsole, 2000);
  updateData();
}

function consoleUnload() {
  EnigmailLog.DEBUG("enigmailConsole.js: consoleUnload\n");

  // Cancel console refresh
  if (window.consoleIntervalId) {
    window.clearInterval(gConsoleIntervalId);
    gConsoleIntervalId = null;
  }
}

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
    contentFrame.scrollTo(0, 9999);
}


function enigmailConsoleCopy() {
  var selText = getSelectionStr();

  EnigmailLog.DEBUG("enigmailConsole.js: enigmailConsoleCopy: selText='" + selText + "'\n");

  if (selText) {
    var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);

    clipHelper.copyString(selText);
  }

  return true;
}

function getSelectionStr() {
  try {
    var contentFrame = EnigmailWindows.getFrame(window, "contentFrame");

    var sel = contentFrame.getSelection();
    return sel.toString();

  }
  catch (ex) {
    return "";
  }
}

function isItemSelected() {
  EnigmailLog.DEBUG("enigmailConsole.js: isItemSelected\n");
  return getSelectionStr() !== "";
}

function UpdateCopyMenu() {
  EnigmailLog.DEBUG("enigmailConsole.js: UpdateCopyMenu\n");
  goUpdateCommand("cmd_copy");
}

var CommandController = {
  isCommandEnabled: function(aCommand) {
    switch (aCommand) {
      case "cmd_copy":
        return isItemSelected();
      default:
        return false;
    }
  },

  supportsCommand: function(aCommand) {
    switch (aCommand) {
      case "cmd_copy":
        return true;
      default:
        return false;
    }
  },

  doCommand: function(aCommand) {
    switch (aCommand) {
      case "cmd_copy":
        enigmailConsoleCopy();
        break;
      default:
        break;
    }
  },

  onEvent: function(aEvent) {}
};
