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

var osUtils = {};
Components.utils.import("resource://gre/modules/FileUtils.jsm", osUtils);

var gWorkFile = {
  file: null
};

function getWizard() {
  return document.getElementById("enigmailImportExportWizard");
}

function setNextPage(pageId) {
  let wizard = getWizard();
  wizard.currentPage.next = pageId;
}

function setExport() {
  setNextPage("pgExport");
}

function setImport() {
  setNextPage("pgImport");
}

function onCancel() {
  return true;
}



function browseExportFile(referencedId, referencedVar) {
  var filePath = EnigmailDialog.filePicker(window, "Set export file name",
    "", true, "*.enig", "", ["Enigmail Settings", "*.enig"]);

  if (filePath) {
    document.getElementById(referencedId).value = filePath.path;
    referencedVar.file = filePath;
  }
}

function doExport() {
  EnigmailLog.DEBUG("importExportWizard: doExport\n");
  let svc = EnigmailCore.getService();

  if (!svc) return false;

  if (!gWorkFile.file) return;

  //let wizard = getWizard();
  //wizard.canAdvance = false;
  document.getElementById("progressBox").removeAttribute("hidden");


  let tmpDir = EnigmailFiles.createTempSubDir("enig-exp", true);
  let exitCodeObj = {},
    errorMsgObj = {};

  let keyRingFile = tmpDir.clone();
  keyRingFile.append("keyring.asc");

  EnigmailLog.DEBUG("importExportWizard: doExport - temp file: " + keyRingFile.path + "\n");

  EnigmailKeyRing.extractKey(true, null, keyRingFile, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigmailDialog.alert(window, "Error while exporting");
    return false;
  }

  let otFile = tmpDir.clone();
  otFile.append("ownertrust.txt");
  EnigmailKeyRing.extractOwnerTrust(otFile, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigmailDialog.alert(window, "Error while exporting");
    return false;
  }

  let prefsFile = tmpDir.clone();
  prefsFile.append("prefs.json");
  if (EnigmailConfigBackup.backupPrefs(prefsFile) !== 0) {
    EnigmailDialog.alert(window, "Error while exporting");
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

  zipW.addEntryFile("gpg.conf", Ci.nsIZipWriter.COMPRESSION_DEFAULT, gpgConfgFile, false);
  zipW.close();

  tmpDir.remove(true);

  //wizard.canAdvance = true;
  return true;
}


function onLoad() {}
