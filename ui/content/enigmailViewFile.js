/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Components.utils.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Components.utils.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */


var logFileData; // global definition of log file data to be able to save
// same data as displayed

function saveLogFile() {
  let fileObj = EnigmailDialog.filePicker(window, EnigmailLocale.getString("saveLogFile.title"), null,
    true, "txt");

  EnigmailFiles.writeFileContents(fileObj, logFileData, null);

}

function enigLoadPage() {
  EnigmailLog.DEBUG("enigmailHelp.js: enigLoadPage\n");
  EnigmailCore.getService();

  var contentFrame = EnigmailWindows.getFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var winOptions = getWindowOptions();

  if ("fileUrl" in winOptions) {
    contentFrame.document.location.href = winOptions.fileUrl;
  }

  if ("viewLog" in winOptions) {
    let cf = document.getElementById("contentFrame");
    cf.setAttribute("collapsed", "true");

    let cb = document.getElementById("contentBox");
    logFileData = EnigmailLog.getLogData(EnigmailCore.version, EnigmailPrefs);
    cb.value = logFileData;

    let cfb = document.getElementById("logFileBox");
    cfb.removeAttribute("collapsed");
  }

  if ("title" in winOptions) {
    document.getElementById("EnigmailViewFile").setAttribute("title", winOptions.title);
  }
}

function getWindowOptions() {
  var winOptions = [];
  if (window.location.search) {
    var optList = window.location.search.substr(1).split(/\&/);
    for (var i = 0; i < optList.length; i++) {
      var anOption = optList[i].split(/\=/);
      winOptions[anOption[0]] = unescape(anOption[1]);
    }
  }
  return winOptions;
}
