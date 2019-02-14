/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailFiles = ChromeUtils.import("chrome://enigmail/content/modules/files.jsm").EnigmailFiles;
var EnigmailConfigBackup = ChromeUtils.import("chrome://enigmail/content/modules/configBackup.jsm").EnigmailConfigBackup;
var EnigmailGpgAgent = ChromeUtils.import("chrome://enigmail/content/modules/gpgAgent.jsm").EnigmailGpgAgent;
var EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;

var gImportFile = null;
var gImportInProgress = false;

function onLoad() {
  let dlg = document.getElementById("importSettingsDialog");
  dlg.getButton("accept").setAttribute("disabled", "true");
}

function browseFile() {
  gImportFile = EnigmailDialog.filePicker(window,
    EnigmailLocale.getString("setupWizard.importSettingsFile"),
    "", false, "*.zip", EnigmailLocale.getString("defaultBackupFileName") + ".zip", [EnigmailLocale.getString("enigmailSettings"), "*.zip"]);

  if (!gImportFile) return;

  if (!gImportFile.exists()) {
    EnigmailLog.DEBUG("importSettings.js: importSettings: Importfile doesn't exist!\n");
    return;
  }

  gImportFile.normalize();
  if (!gImportFile.isFile()) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("importSettings.errorNoFile"));
    return;
  }

  document.getElementById("importFileName").setAttribute("value", gImportFile.path);
  document.getElementById("btnStartImport").removeAttribute("disabled");
}

function startImport() {
  document.getElementById("btnBrowse").setAttribute("disabled", "true");
  document.getElementById("btnStartImport").setAttribute("disabled", "true");
  gImportInProgress = true;

  if (!importSettings()) {
    document.getElementById("btnBrowse").removeAttribute("disabled");
  }
  gImportInProgress = false;
}

function importSettings() {
  EnigmailLog.DEBUG("importSettings.js: importSettings()\n");
  document.getElementById("btnBrowse").setAttribute("disabled", "true");
  document.getElementById("btnStartImport").setAttribute("disabled", "true");

  let zipR;
  try {
    zipR = EnigmailFiles.openZipFile(gImportFile);
  } catch (ex) {
    EnigmailLog.DEBUG("importSettings.js: importSettings - openZipFile() failed with " + ex.toString() + "\n" + ex.stack + "\n");
    EnigmailDialog.alert(window, EnigmailLocale.getString("setupWizard.invalidSettingsFile"));
    return false;
  }

  let cfg;
  try {
    cfg = ensureGpgHomeDir();
  } catch (ex) {
    EnigmailDialog.alert(window, "importSettings - ensureGpgHomeDir() failed with " + ex.toString() + "\n" + ex.stack + "\n");
    return false;
  }

  let tmpDir = EnigmailFiles.createTempSubDir("enig-imp", true);

  EnigmailLog.DEBUG("importSettings.js: tmpDir=" + tmpDir.path + "\n");

  let files = ["keyring.asc", "ownertrust.txt", "prefs.json"];

  let filesAreMissing = false;

  // check if mandatory files are included
  for (let i in files) {
    if (!zipR.hasEntry(files[i])) {
      filesAreMissing = true;
      EnigmailLog.DEBUG("importSettings.js: importSettings: InvalidSettingsFile, missing: " + files[i] + "\n");
    }
  }

  if (filesAreMissing) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("setupWizard.invalidSettingsFile"));
    return false;
  }

  // append optional files
  files.push("gpg.conf");

  for (let i in files) {
    if (zipR.hasEntry(files[i])) {
      EnigmailLog.DEBUG("importSettings.js: extracting " + files[i] + "\n");
      let outF = tmpDir.clone();
      outF.append(files[i]);
      zipR.extract(files[i], outF);
    }
  }

  document.getElementById("importingKeys").style.visibility = "visible";

  let tmpFile = tmpDir.clone();
  tmpFile.append("keyring.asc");
  let errorMsgObj = {};
  EnigmailKeyRing.importKeyFromFile(tmpFile, errorMsgObj);
  if (!gImportInProgress) return false;

  document.getElementById("spinningWheel").style.visibility = "hidden";
  document.getElementById("importingKeysOK").style.visibility = "visible";
  document.getElementById("restoreGnuPGSettings").style.visibility = "visible";

  tmpFile = tmpDir.clone();
  tmpFile.append("ownertrust.txt");
  EnigmailKeyRing.importOwnerTrust(tmpFile, errorMsgObj);
  if (!gImportInProgress) return false;

  tmpFile = tmpDir.clone();
  tmpFile.append("gpg.conf");

  if (tmpFile.exists()) {
    let doCfgFile = true;
    if (cfg.existed) {
      let cfgFile = cfg.homeDir.clone();
      cfgFile.append("gpg.conf");
      if (cfgFile.exists()) {
        if (!EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("setupWizard.gpgConfExists"), EnigmailLocale.getString("dlg.button.overwrite"), EnigmailLocale.getString("dlg.button.skip"))) {
          EnigmailLog.DEBUG("importSettings.js: importSettings:  User has chosen to keep the already existing local gpg.conf.\n");
          doCfgFile = false;
        }
      }
    }

    try {
      if (doCfgFile) tmpFile.moveTo(cfg.homeDir, "gpg.conf");
    } catch (ex) {
      EnigmailLog.DEBUG("importSettings.js: importSettings: Error with gpg.conf " + ex.toString() + "\n");
    }
  } else {
    EnigmailLog.DEBUG("importSettings.js: importSettings: Remark: no gpg.conf file in archive.\n");
  }
  if (!gImportInProgress) return false;

  document.getElementById("restoreGnuPGSettingsOK").style.visibility = "visible";
  document.getElementById("restoreEnigmailPrefs").style.visibility = "visible";

  tmpFile = tmpDir.clone();
  tmpFile.append("prefs.json");
  try {
    let r = EnigmailConfigBackup.restorePrefs(tmpFile);

    if (r.retVal === 0 && r.unmatchedIds.length > 0) {
      displayUnmatchedIds(r.unmatchedIds);
    }
  } catch (ex) {
    EnigmailLog.DEBUG(`importSettings.js: importSettings: exception in restorePrefs: ${ex.toString()}\n`);
  }

  document.getElementById("restoreEnigmailPrefsOK").style.visibility = "visible";

  let dlg = document.getElementById("importSettingsDialog");
  dlg.getButton("cancel").setAttribute("disabled", "true");
  dlg.getButton("accept").removeAttribute("disabled");
  tmpDir.remove(true);

  return true;
}

function ensureGpgHomeDir() {
  let homeDirPath = EnigmailGpgAgent.getGpgHomeDir();
  if (!homeDirPath)
    throw "no gpghome dir";

  let homeDir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  homeDir.initWithPath(homeDirPath);

  if (!homeDir.exists()) {
    homeDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0x1C0);
    return {
      homeDir: homeDir,
      existed: false
    };
  }
  homeDir.normalize();

  if (!homeDir.isDirectory()) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("setupWizard.noGpgHomeDir", [homeDirPath]));
    throw "not a directory";
  }
  return {
    homeDir: homeDir,
    existed: true
  };
}

function displayUnmatchedIds(emailArr) {
  EnigmailDialog.info(window, EnigmailLocale.getString("setupWizard.unmachtedIds", ["- " + emailArr.join("\n- ")]));
}

function closeWindow() {
  window.close();
}

function onCancel() {
  if (gImportInProgress) {
    let r = EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("importSettings.cancelWhileInProgress"),
      EnigmailLocale.getString("importSettings.button.abortImport"), EnigmailLocale.getString("dlg.button.continue"));
    if (r) {
      gImportInProgress = false;
    }
    return r;
  }

  return true;
}