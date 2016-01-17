/*global Components: false, document: false, window: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/configBackup.jsm"); /*global EnigmailConfigBackup: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */

var osUtils = {};
Components.utils.import("resource://gre/modules/FileUtils.jsm", osUtils);

var gWorkFile = {
  file: null
};

function getWizard() {
  return document.getElementById("overallWizard");
}

function enableNext(status) {
  let wizard = getWizard();
  wizard.canAdvance = status;
}


function onCancel() {
  return true;
}

function browseExportFile(referencedId) {
  var filePath = EnigmailDialog.filePicker(window, EnigmailLocale.getString("specifyExportFile"),
    "", true, "*.zip", EnigmailLocale.getString("defaultBackupFileName") + ".zip", [EnigmailLocale.getString("enigmailSettings"), "*.zip"]);

  if (filePath) {

    if (filePath.exists()) filePath.normalize();

    if ((filePath.exists() && !filePath.isDirectory() && filePath.isWritable()) ||
      (!filePath.exists() && filePath.parent.isWritable())) {
      document.getElementById(referencedId).value = filePath.path;
      gWorkFile.file = filePath;
    }
    else {
      EnigmailDialog.alert(window, EnigmailLocale.getString("cannotWriteToFile", filePath.path));
    }
  }

  enableNext(gWorkFile.file !== null);
}

function doExport(tmpDir) {

  let exitCodeObj = {},
    errorMsgObj = {};

  let keyRingFile = tmpDir.clone();
  keyRingFile.append("keyring.asc");

  EnigmailLog.DEBUG("importExportWizard: doExport - temp file: " + keyRingFile.path + "\n");

  EnigmailKeyRing.extractKey(true, null, keyRingFile, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("dataExportError"));
    return false;
  }

  let otFile = tmpDir.clone();
  otFile.append("ownertrust.txt");
  EnigmailKeyRing.extractOwnerTrust(otFile, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("dataExportError"));
    return false;
  }

  let prefsFile = tmpDir.clone();
  prefsFile.append("prefs.json");
  if (EnigmailConfigBackup.backupPrefs(prefsFile) !== 0) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("dataExportError"));
    return false;
  }

  let homeDir = EnigmailGpgAgent.getGpgHomeDir();
  let gpgConfgFile = null;
  let zipW = EnigmailFiles.createZipFile(gWorkFile.file);

  zipW.addEntryFile("keyring.asc", Ci.nsIZipWriter.COMPRESSION_DEFAULT, keyRingFile, false);
  zipW.addEntryFile("ownertrust.txt", Ci.nsIZipWriter.COMPRESSION_DEFAULT, otFile, false);
  zipW.addEntryFile("prefs.json", Ci.nsIZipWriter.COMPRESSION_DEFAULT, prefsFile, false);

  if (homeDir) {
    gpgConfgFile = new osUtils.FileUtils.File(homeDir);
    gpgConfgFile.append("gpg.conf");
  }

  if (gpgConfgFile && gpgConfgFile.exists()) {
    zipW.addEntryFile("gpg.conf", Ci.nsIZipWriter.COMPRESSION_DEFAULT, gpgConfgFile, false);
  }
  zipW.close();

  tmpDir.remove(true);
  document.getElementById("doneMessage").removeAttribute("hidden");

  return true;
}

function exportFailed() {
  let wizard = getWizard();
  wizard.getButton("cancel").removeAttribute("disabled");
  wizard.canRewind = true;
  document.getElementById("errorMessage").removeAttribute("hidden");

  return false;
}

function startExport() {
  EnigmailLog.DEBUG("importExportWizard: doExport\n");
  document.getElementById("errorMessage").setAttribute("hidden", "true");

  let wizard = getWizard();
  wizard.canAdvance = false;
  wizard.canRewind = false;
  wizard.getButton("finish").setAttribute("disabled", "true");

  let svc = EnigmailCore.getService();
  if (!svc) return exportFailed();

  if (!gWorkFile.file) return exportFailed();

  let tmpDir = EnigmailFiles.createTempSubDir("enig-exp", true);

  wizard.getButton("cancel").setAttribute("disabled", "true");
  document.getElementById("spinningWheel").removeAttribute("hidden");

  let retVal = false;

  try {
    retVal = doExport(tmpDir);
  }
  catch (ex) {}

  // stop spinning the wheel
  document.getElementById("spinningWheel").setAttribute("hidden", "true");

  if (retVal) {
    wizard.getButton("finish").removeAttribute("disabled");
    wizard.canAdvance = true;
  }
  else {
    exportFailed();
  }

  return retVal;
}

function checkAdditionalParam() {
  let param = EnigmailPrefs.getPref("agentAdditionalParam");

  if (param) {
    if (param.search(/--(homedir|trustdb-name|options)/) >= 0 || param.search(/--(primary-|secret-)?keyring/) >= 0) {
      EnigmailDialog.alert(null, EnigmailLocale.getString("homedirParamNotSUpported"));
      return false;
    }
  }
  return true;
}

function onLoad() {
  enableNext(false);

  if (!checkAdditionalParam()) {
    window.close();
  }
}
