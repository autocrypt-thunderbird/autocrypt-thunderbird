/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const EnigmailAutocryptSetup = ChromeUtils.import("chrome://enigmail/content/modules/autocryptSetup.jsm").EnigmailAutocryptSetup;
const EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
const EnigmailApp = ChromeUtils.import("chrome://enigmail/content/modules/app.jsm").EnigmailApp;
const EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const EnigmailLazy = ChromeUtils.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailOS = ChromeUtils.import("chrome://enigmail/content/modules/os.jsm").EnigmailOS;
const EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
const EnigmailFiles = ChromeUtils.import("chrome://enigmail/content/modules/files.jsm").EnigmailFiles;
const InstallGnuPG = ChromeUtils.import("chrome://enigmail/content/modules/installGnuPG.jsm").InstallGnuPG;

const getCore = EnigmailLazy.loader("enigmail/core.jsm", "EnigmailCore");
var gEnigmailSvc = null;
var gResolveInstall = null;
var gDownoadObj = null;


function onLoad() {
  EnigmailTimer.setTimeout(onLoadAsync, 1);
}

function onLoadAsync() {
  let installPromise = checkGnupgInstallation().then(foundGpg => {
    if (foundGpg) {
      document.getElementById("searchingGnuPG").style.visibility = "visible";
      document.getElementById("foundGnuPG").style.visibility = "visible";
      document.getElementById("findGpgBox").style.visibility = "collapse";
      document.getElementById("requireGnuPG").style.visibility = "collapse";
      document.getElementById("determineInstall").style.visibility = "visible";
    }
  });

  let setupType = null;
  let setupPromise = EnigmailAutocryptSetup.getDeterminedSetupType().then(r => {
    EnigmailLog.DEBUG(`setupWizard2.js: onLoad: got setupType ${r.value}\n`);
    setupType = r;
  });

  Promise.all([installPromise, setupPromise]).then(r => {
    EnigmailLog.DEBUG(`setupWizard2.js: onLoad: all promises completed\n`);
    displayExistingEmails(setupType);
  });
}

function onCancel() {
  if (gDownoadObj) {
    gDownoadObj.abort();
    gDownoadObj = null;
  }

  return true;
}

function onAccept() {
  return true;
}

function displayExistingEmails(setupType) {
  let prevInstallElem = "previousInstall_none";
  switch (setupType.value) {
    case EnigmailConstants.AUTOSETUP_AC_SETUP_MSG:
    case EnigmailConstants.AUTOSETUP_AC_HEADER:
      prevInstallElem = "previousInstall_ac";
      break;
    case EnigmailConstants.AUTOSETUP_PEP_HEADER:
      prevInstallElem = "previousInstall_pEp";
      break;
    case EnigmailConstants.AUTOSETUP_ENCRYPTED_MSG:
      prevInstallElem = "previousInstall_encrypted";
      break;
  }
  document.getElementById("determineInstall").style.visibility = "collapse";
  document.getElementById(prevInstallElem).style.visibility = "visible";
}

/**
 * Check if GnuPG is available and set dialog parts accordingly
 */
function checkGnupgInstallation() {
  return new Promise((resolve, reject) => {
    if (getEnigmailService(true)) {
      resolve(true);
      return;
    }
    else {
      gResolveInstall = resolve;
      document.getElementById("searchingGnuPG").style.visibility = "collapse";
      document.getElementById("requireGnuPG").style.visibility = "visible";

      if (InstallGnuPG.checkAvailability()) {
        document.getElementById("installBox").style.visibility = "visible";
      }
      else {
        document.getElementById("findGpgBox").style.visibility = "visible";
      }
    }
  });
}


/**
 * Try to initialize Enigmail (which will determine the location of GnuPG)
 */
function getEnigmailService(resetCheck) {
  if (resetCheck)
    gEnigmailSvc = null;

  if (gEnigmailSvc) {
    return gEnigmailSvc.initialized ? gEnigmailSvc : null;
  }

  try {
    gEnigmailSvc = getCore().createInstance();
  }
  catch (ex) {
    EnigmailLog.ERROR("setupWizard2.js: getEnigmailService: Error in instantiating EnigmailService\n");
    return null;
  }

  EnigmailLog.DEBUG("setupWizard2.js: getEnigmailService: gEnigmailSvc = " + gEnigmailSvc + "\n");

  if (!gEnigmailSvc.initialized) {
    // Try to initialize Enigmail

    try {
      // Initialize enigmail
      gEnigmailSvc.initialize(window, EnigmailApp.getVersion());

      // Reset alert count to default value
      EnigmailPrefs.getPrefBranch().clearUserPref("initAlert");
    }
    catch (ex) {
      return null;
    }

    let configuredVersion = EnigmailPrefs.getPref("configuredVersion");
    EnigmailLog.DEBUG("setupWizard2.js: getEnigmailService: " + configuredVersion + "\n");
  }

  return gEnigmailSvc.initialized ? gEnigmailSvc : null;
}


/**
 * Locate GnuPG using the "Browse" button
 */
function locateGpg() {
  const fileName = "gpg";
  let ext = "";
  if (EnigmailOS.isDosLike) {
    ext = ".exe";
  }

  let filePath = EnigmailDialog.filePicker(window,
    EnigmailLocale.getString("locateGpg"),
    "", false, ext,
    fileName + ext, null);

  if (filePath) {
    EnigmailPrefs.setPref("agentPath", EnigmailFiles.getFilePath(filePath));
    let svc = getEnigmailService(true);

    if (!svc) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("setupWizard.invalidGpg"));
    }
    else {
      gResolveInstall(true);
    }
  }
}

function installGnuPG() {
  let progressBox = document.getElementById("progressBox");
  let downloadProgress = document.getElementById("downloadProgress");
  let installProgressBox = document.getElementById("installProgressBox");
  let installProgress = document.getElementById("installProgress");
  let btnInstallGnupg = document.getElementById("btnInstallGnupg");
  let btnLocateGnuPG = document.getElementById("btnLocateGnuPG");

  btnInstallGnupg.setAttribute("disabled", true);
  btnLocateGnuPG.setAttribute("disabled", true);
  progressBox.style.visibility = "visible";

  InstallGnuPG.startInstaller({
    onStart: function(reqObj) {
      gDownoadObj = reqObj;
    },

    onError: function(errorMessage) {
      if (typeof(errorMessage) == "object") {
        var s = EnigmailLocale.getString("errorType." + errorMessage.type);
        if (errorMessage.type.startsWith("Security")) {
          s += "\n" + EnigmailLocale.getString("setupWizard.downloadForbidden");
        }
        else
          s += "\n" + EnigmailLocale.getString("setupWizard.downloadImpossible");

        EnigmailDialog.alert(window, s);
      }
      else {
        EnigmailDialog.alert(window, EnigmailLocale.getString(errorMessage));
      }

      this.returnToDownload();
    },

    onWarning: function(message) {
      var ret = false;
      if (message == "hashSumMismatch") {
        ret = EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("setupWizard.hashSumError"), EnigmailLocale.getString("dlgYes"),
          EnigmailLocale.getString("dlgNo"));
      }

      if (!ret) this.returnToDownload();

      return ret;
    },

    onProgress: function(event) {
      if (event.lengthComputable) {
        var percentComplete = event.loaded / event.total * 100;
        downloadProgress.setAttribute("value", percentComplete);
      }
      else {
        downloadProgress.removeAttribute("value");
      }
    },

    onDownloaded: function() {
      gDownoadObj = null;
      downloadProgress.setAttribute("value", 100);
      installProgressBox.style.visibility = "visible";
    },


    returnToDownload: function() {
      btnInstallGnupg.removeAttribute("disabled");
      btnLocateGnuPG.removeAttribute("disabled");
      progressBox.style.visibility = "collapse";
      downloadProgress.setAttribute("value", 0);
      installProgressBox.style.visibility = "collapse";
    },

    onLoaded: function() {
      installProgress.setAttribute("value", 100);
      progressBox.style.visibility = "collapse";
      installProgressBox.style.visibility = "collapse";
      document.getElementById("installBox").style.visibility = "collapse";

      let origPath = EnigmailPrefs.getPref("agentPath");
      EnigmailPrefs.setPref("agentPath", "");

      let svc = getEnigmailService(true);

      if (!svc) {
        EnigmailPrefs.setPref("agentPath", origPath);
        this.returnToDownload();
        EnigmailDialog.alert(window, EnigmailLocale.getString("setupWizard.installFailed"));
      }
      else {
        gResolveInstall(true);
      }
    }
  });
}
