/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EnigmailAutoSetup = ChromeUtils.import("chrome://autocrypt/content/modules/autoSetup.jsm").EnigmailAutoSetup;
var EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
var EnigmailApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").EnigmailApp;
var EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
var EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
var EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
var EnigmailTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").EnigmailTimer;
var EnigmailLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").EnigmailLazy;
var EnigmailOS = ChromeUtils.import("chrome://autocrypt/content/modules/os.jsm").EnigmailOS;
var EnigmailDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").EnigmailFiles;
var EnigmailConfigBackup = ChromeUtils.import("chrome://autocrypt/content/modules/configBackup.jsm").EnigmailConfigBackup;
var EnigmailGpgAgent = ChromeUtils.import("chrome://autocrypt/content/modules/gpgAgent.jsm").EnigmailGpgAgent;
var EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
var EnigmailWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").EnigmailWindows;

const getCore = EnigmailLazy.loader("autocrypt/core.jsm", "EnigmailCore");

/* Imported from commonWorkflows.js: */
/* global EnigmailCommon_importKeysFromFile: false */

const FINAL_ACTION_DONOTHING = 0;
const FINAL_ACTION_CREATEKEYS = 2;

var gEnigmailSvc = null;
var gResolveInstall = null;
var gDownoadObj = null;
var gFoundSetupType = null;
var gSecretKeys = [];
var gFinalAction = FINAL_ACTION_DONOTHING;

function onLoad() {
  EnigmailLog.DEBUG(`setupWizard2.js: onLoad()\n`);
  let dlg = document.getElementById("setupWizardDlg");
  dlg.getButton("accept").setAttribute("disabled", "true");

  document.getElementById("foundAcSetupMessage").innerHTML = EnigmailLocale.getString("setupWizard.foundAcSetupMessage");
  document.getElementById("foundAcNoSetupMsg").innerHTML = EnigmailLocale.getString("setupWizard.foundAcNoSetupMsg");
  document.getElementById("setupComplete").innerHTML = EnigmailLocale.getString("setupWizard.setupComplete");

  // let the dialog be loaded asynchronously such that we can disply the dialog
  // before we start working on it.
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
      gSecretKeys = EnigmailKeyRing.getAllSecretKeys(true);
    }
  });

  let setupPromise = EnigmailAutoSetup.getDeterminedSetupType().then(r => {
    EnigmailLog.DEBUG(`setupWizard2.js: onLoadAsync: got setupType ${r.value}\n`);
    gFoundSetupType = r;
  });

  Promise.all([installPromise, setupPromise]).then(r => {
    displayExistingEmails();
  });
}

/**
 * Main function to display the found case matching the user's setup
 */
function displayExistingEmails() {
  EnigmailLog.DEBUG(`setupWizard2.js: displayExistingEmails(): found setup type ${gFoundSetupType.value}\n`);
  let prevInstallElem = "previousInstall_none";
  let unhideButtons = [];

  if (gSecretKeys.length > 0) {
    // secret keys are already available
    EnigmailLog.DEBUG(`setupWizard2.js: displayExistingEmails: found existing keys\n`);
    prevInstallElem = "previousInstall_keysAvailable";
  } else {
    switch (gFoundSetupType.value) {
      case EnigmailConstants.AUTOSETUP_AC_SETUP_MSG:
        // found Autocrypt Setup Message
        prevInstallElem = "previousInstall_acSetup";
        break;
      case EnigmailConstants.AUTOSETUP_AC_HEADER:
        // found Autocrypt messages
        prevInstallElem = "previousInstall_ac";
        unhideButtons = ["btnRescanInbox", "btnImportSettings"];
        break;
      case EnigmailConstants.AUTOSETUP_ENCRYPTED_MSG:
        // encrypted messages without pEp or Autocrypt found
        prevInstallElem = "previousInstall_encrypted";
        unhideButtons = ["btnImportKeys"];
        enableDoneButton();
        break;
      default:
        // no encrypted messages found
        enableDoneButton();
        gFinalAction = FINAL_ACTION_CREATEKEYS;
    }
  }
  document.getElementById("determineInstall").style.visibility = "collapse";
  document.getElementById(prevInstallElem).style.visibility = "visible";

  for (let e of unhideButtons) {
    document.getElementById(e).style.visibility = "visible";
  }
}

/**
 * Check if GnuPG is available and set dialog parts accordingly
 */
function checkGnupgInstallation() {
  return new Promise((resolve, reject) => {
    if (getEnigmailService(true)) {
      resolve(true);
      return;
    } else {
      gResolveInstall = resolve;
      document.getElementById("searchingGnuPG").style.visibility = "collapse";
      document.getElementById("requireGnuPG").style.visibility = "visible";
      document.getElementById("findGpgBox").style.visibility = "visible";
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
  } catch (ex) {
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
    } catch (ex) {
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
    } else {
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
  window.outerHeight += 100;

  btnInstallGnupg.setAttribute("disabled", true);
  btnLocateGnuPG.setAttribute("disabled", true);
  progressBox.style.visibility = "visible";
}


/**
 * Import Autocrypt Setup Messages
 */
function importAcSetup() {
  let btnInitiateAcSetup = document.getElementById("btnInitiateAcSetup");
  btnInitiateAcSetup.setAttribute("disabled", true);
  EnigmailAutoSetup.performAutocryptSetup(gFoundSetupType).then(r => {
    if (r > 0) {
      document.getElementById("previousInstall_none").style.visibility = "visible";
      enableDoneButton();
    }
  });
}

/**
 * Actively re-scan the inbox to find (for example) a new Autocrypt Setup Message
 */
function rescanInbox() {
  EnigmailAutoSetup.determinePreviousInstallType().then(r => {
    EnigmailLog.DEBUG(`setupWizard2.js: onLoad: got rescanInbox ${r.value}\n`);
    gFoundSetupType = r;

    for (let i of["previousInstall_ac", "btnRescanInbox", "btnImportSettings"]) {
      document.getElementById(i).style.visibility = "collapse";
    }

    displayExistingEmails();
  });
}

/**
 * open the "Restore Settings and Keys" wizard
 */
function importSettings() {
  EnigmailWindows.openImportSettings(window);
}


function enableDoneButton() {
  let dlg = document.getElementById("setupWizardDlg");
  dlg.getButton("cancel").setAttribute("collapsed", "true");
  dlg.getButton("accept").removeAttribute("disabled");
}


function onCancel() {
  if (gDownoadObj) {
    gDownoadObj.abort();
    gDownoadObj = null;
  }

  return true;
}


function onAccept() {
  if (gFinalAction === FINAL_ACTION_CREATEKEYS) {
    EnigmailAutoSetup.createKeyForAllAccounts();
  }
  return true;
}

function importKeysFromFile() {
  EnigmailCommon_importKeysFromFile();
  applyExistingKeys();
}

function applyExistingKeys() {
  EnigmailAutoSetup.applyExistingKeys();

  document.getElementById("btnApplyExistingKeys").setAttribute("disabled", "true");
  document.getElementById("applyExistingKeysOK").style.visibility = "visible";
  document.getElementById("previousInstall_none").style.visibility = "visible";
  enableDoneButton();
}

function handleClick(event) {
  if (event.target.hasAttribute("href")) {
    let target = event.target;
    event.stopPropagation();
    EnigmailWindows.openMailTab(target.getAttribute("href"));
  }
}


document.addEventListener("dialogaccept", function(event) {
  if (!onAccept())
    event.preventDefault(); // Prevent the dialog closing.
});

document.addEventListener("dialogcancel", function(event) {
  if (!onCancel())
    event.preventDefault(); // Prevent the dialog closing.
});
