/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js
/*global Components */

/* global EnigmailLog: false, EnigmailLocale: false, EnigmailGpgAgent: false, EnigmailPrefs: false */

// from enigmailCommon.js:
/* global EnigInitCommon: false, EnigGetPref: false, EnigSetPref: false, GetEnigmailSvc: false */
/* global gEnigmailSvc: true, EnigGetString: false, EnigError: false, EnigGetVersion: false */
/* global EnigGetDefaultPref: false, EnigConvertToUnicode: false, EnigCollapseAdvanced: false, EnigGetOS: false */
/* global EnigGetFilePath: false, EnigAlert: false, EnigAlertPref: false, EnigFilePicker: false */
/* global EnigDisplayRadioPref: false, EnigSavePrefs: false, EnigConvertFromUnicode: false */
/* global ENIG_C: false, ENIG_I: false, ENIG_ENIGMAIL_CONTRACTID: false */
/* global gEnigEncryptionModel: true, gEnigAcceptedKeys: true, gEnigAutoSendEncrypted: true, gEnigConfirmBeforeSending: true */


"use strict";

Components.utils.import("resource://enigmail/configBackup.jsm"); /* global EnigmailConfigBackup: false */

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail");

var gMimePartsElement, gMimePartsValue, gAdvancedMode;

// saved old manual preferences to switch back
// to them if we temporarily enabled convenient encryption
// (not persistent)
var gSavedManualPrefKeepSettingsForReply = true;
var gSavedManualPrefAcceptedKeys = 1;
var gSavedManualPrefAutoSendEncrypted = 1;
var gSavedManualPrefConfirmBeforeSending = 0;
var gOrigMaxIdle = "-";

function displayPrefs(showDefault, showPrefs, setPrefs) {
  EnigmailLog.DEBUG("pref-enigmail.js displayPrefs\n");

  var s = gEnigmailSvc;

  var obj = {};
  var prefList = EnigmailPrefs.getPrefBranch().getChildList("", obj);

  for (var prefItem in prefList) {
    var prefName = prefList[prefItem];
    var prefElement = document.getElementById("enigmail_" + prefName);

    if (prefElement) {
      var prefType = EnigmailPrefs.getPrefBranch().getPrefType(prefName);
      var prefValue;
      if (showDefault) {
        prefValue = EnigGetDefaultPref(prefName);
      }
      else {
        prefValue = EnigGetPref(prefName);
      }

      EnigmailLog.DEBUG("pref-enigmail.js displayPrefs: " + prefName + "=" + prefValue + "\n");

      switch (prefType) {
        case EnigmailPrefs.getPrefBranch().PREF_BOOL:
          if (showPrefs) {
            if (prefElement.getAttribute("invert") == "true") {
              prefValue = !prefValue;
            }
            if (prefValue) {
              prefElement.setAttribute("checked", "true");
            }
            else {
              prefElement.removeAttribute("checked");
            }
          }
          if (setPrefs) {
            if (prefElement.getAttribute("invert") == "true") {
              if (prefElement.checked) {
                EnigSetPref(prefName, false);
              }
              else {
                EnigSetPref(prefName, true);
              }
            }
            else {
              if (prefElement.checked) {
                EnigSetPref(prefName, true);
              }
              else {
                EnigSetPref(prefName, false);
              }
            }
          }
          break;

        case EnigmailPrefs.getPrefBranch().PREF_INT:
          if (showPrefs) {
            prefElement.value = prefValue;
          }
          if (setPrefs) {
            try {
              EnigSetPref(prefName, 0 + prefElement.value);
            }
            catch (ex) {}
          }
          break;

        case EnigmailPrefs.getPrefBranch().PREF_STRING:
          if (showPrefs) {
            prefElement.value = prefValue;
          }
          if (setPrefs) {
            EnigSetPref(prefName, prefElement.value);
          }
          break;

        default:
          EnigmailLog.DEBUG("pref-enigmail.js displayPrefs: " + prefName + " does not have a type?!\n");
      }
    }
  }
}

function prefOnLoad() {
  EnigmailLog.DEBUG("pref-enigmail.js: prefOnLoad()\n");

  GetEnigmailSvc();
  displayPrefs(false, true, false);

  document.getElementById("enigmail_agentPath").value = EnigConvertToUnicode(EnigGetPref("agentPath"), "utf-8");

  var maxIdle = -1;
  if (!gEnigmailSvc) {
    maxIdle = EnigmailPrefs.getPref("maxIdleMinutes");
  }
  else {
    maxIdle = EnigmailGpgAgent.getMaxIdlePref(window);
  }

  document.getElementById("maxIdleMinutes").value = maxIdle;
  gOrigMaxIdle = String(maxIdle);
  gAdvancedMode = EnigGetPref("advancedUser");

  if (window.arguments) {
    if (!window.arguments[0].showBasic) {
      // hide basic tab
      document.getElementById("basic").setAttribute("collapsed", true);
      document.getElementById("basicTab").setAttribute("collapsed", true);
      selectPrefTabPanel("sendingTab");
    }
    else {
      EnigCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
      //EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);
      enigShowUserModeButtons(gAdvancedMode);
    }

    if ((typeof window.arguments[0].selectTab) == "string") {
      selectPrefTabPanel(window.arguments[0].selectTab);
    }

  }
  else {
    enigShowUserModeButtons(gAdvancedMode);
  }

  if (!EnigmailGpgAgent.gpgAgentIsOptional) {
    document.getElementById("enigmail_noPassphrase").setAttribute("collapsed", true);
    document.getElementById("enigmail_useGpgAgent").setAttribute("collapsed", true);
  }

  if ((!window.arguments) || (window.arguments[0].clientType != "seamonkey")) {
    EnigCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
    //EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);
  }

  // init "saved manual preferences" with current settings:
  gSavedManualPrefKeepSettingsForReply = EnigGetPref("keepSettingsForReply");
  gSavedManualPrefAcceptedKeys = EnigGetPref("acceptedKeys");
  gSavedManualPrefAutoSendEncrypted = EnigGetPref("autoSendEncrypted");
  gSavedManualPrefConfirmBeforeSending = EnigGetPref("confirmBeforeSending");
  gEnigEncryptionModel = EnigGetPref("encryptionModel");
  if (gEnigEncryptionModel === 0) { // convenient encryption
    resetSendingPrefsConvenient();
  }
  else {
    resetSendingPrefsManually();
  }

  gMimePartsElement = document.getElementById("mime_parts_on_demand");

  try {
    gMimePartsValue = EnigmailPrefs.getPrefRoot().getBoolPref("mail.server.default.mime_parts_on_demand");
  }
  catch (ex) {
    gMimePartsValue = true;
  }

  if (gMimePartsValue) {
    gMimePartsElement.setAttribute("checked", "true");
  }
  else {
    gMimePartsElement.removeAttribute("checked");
  }

  var overrideGpg = document.getElementById("enigOverrideGpg");
  if (EnigGetPref("agentPath")) {
    overrideGpg.checked = true;
  }
  else {
    overrideGpg.checked = false;
  }
  enigActivateDependent(overrideGpg, "enigmail_agentPath enigmail_browsePath");

  var testEmailElement = document.getElementById("enigmail_test_email");
  var userIdValue = EnigGetPref("userIdValue");

  enigDetermineGpgPath();

  if (testEmailElement && userIdValue) {
    testEmailElement.value = userIdValue;
  }
}

function enigDetermineGpgPath() {
  if (!gEnigmailSvc) {
    try {
      gEnigmailSvc = ENIG_C[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_I.nsIEnigmail);
      if (!gEnigmailSvc.initialized) {
        // attempt to initialize Enigmail
        gEnigmailSvc.initialize(window, EnigGetVersion());
      }
    }
    catch (ex) {}
  }

  if (gEnigmailSvc.initialized && typeof(EnigmailGpgAgent.agentPath) == "object") {
    try {
      var agentPath = "";
      if (EnigGetOS() == "WINNT") {
        agentPath = EnigGetFilePath(EnigmailGpgAgent.agentPath).replace(/\\\\/g, "\\");
      }
      else {
        agentPath = EnigmailGpgAgent.agentPath.path;
        // EnigGetFilePath(EnigmailGpgAgent.agentPath); // .replace(/\\\\/g, "\\");
      }
      if (agentPath.length > 50) {
        agentPath = agentPath.substring(0, 50) + "...";
      }
      document.getElementById("enigmailGpgPath").setAttribute("value", EnigGetString("prefs.gpgFound", agentPath));
    }
    catch (ex) {
      document.getElementById("enigmailGpgPath").setAttribute("value", "error 2");
    }
  }
  else {
    document.getElementById("enigmailGpgPath").setAttribute("value", EnigGetString("prefs.gpgNotFound"));
  }
}

function selectPrefTabPanel(panelName) {
  var prefTabs = document.getElementById("prefTabs");
  var selectTab = document.getElementById(panelName);
  prefTabs.selectedTab = selectTab;
}

function resetPrefs() {
  EnigmailLog.DEBUG("pref-enigmail.js: resetPrefs\n");

  displayPrefs(true, true, false);

  EnigSetPref("configuredVersion", EnigGetVersion());

  // init "saved manual preferences" with current settings:
  gSavedManualPrefKeepSettingsForReply = EnigGetPref("keepSettingsForReply");
  gSavedManualPrefAcceptedKeys = EnigGetPref("acceptedKeys");
  gSavedManualPrefAutoSendEncrypted = EnigGetPref("autoSendEncrypted");
  gSavedManualPrefConfirmBeforeSending = EnigGetPref("confirmBeforeSending");
  // and process encryption model:
  gEnigEncryptionModel = EnigGetPref("encryptionModel");
  if (gEnigEncryptionModel === 0) { // convenient encryption
    resetSendingPrefsConvenient();
  }
  else {
    resetSendingPrefsManually();
  }
}

// Serializes various Enigmail settings into a separate file.
function backupPrefs() {

  window.open("chrome://enigmail/content/exportSettingsWizard.xul",
    "", "chrome,centerscreen,resizable,modal");
}


function restorePrefs() {

  window.open("chrome://enigmail/content/enigmailSetupWizard.xul?doRestore=true",
    "", "chrome,centerscreen,resizable,modal");
}

function disableManually(disable) {
  var elems = [
    "enigmail_keepSettingsForReply",
    "acceptedKeysValid",
    "acceptedKeysAll",
    "autoSendEncryptedNever",
    "autoSendEncryptedIfKeys",
    "confirmBeforeSendingNever",
    "confirmBeforeSendingAlways",
    "confirmBeforeSendingIfEncrypted",
    "confirmBeforeSendingIfNotEncrypted",
    "confirmBeforeSendingIfRules",
  ];
  var elem;
  for (var i = 0; i < elems.length; ++i) {
    elem = document.getElementById(elems[i]);
    if (disable) {
      elem.setAttribute("disabled", "true");
    }
    else {
      elem.removeAttribute("disabled");
    }
  }
}

function updateSendingPrefs() {
  EnigDisplayRadioPref("acceptedKeys", EnigGetPref("acceptedKeys"),
    gEnigAcceptedKeys);
  EnigDisplayRadioPref("autoSendEncrypted", EnigGetPref("autoSendEncrypted"),
    gEnigAutoSendEncrypted);
  EnigDisplayRadioPref("confirmBeforeSending", EnigGetPref("confirmBeforeSending"),
    gEnigConfirmBeforeSending);
  gEnigEncryptionModel = EnigGetPref("encryptionModel");
  disableManually(gEnigEncryptionModel === 0);
  displayPrefs(false, true, false);
}

function resetSendingPrefsConvenient() {
  EnigmailLog.DEBUG("pref-enigmail.js: resetSendingPrefsConvenient()\n");

  // save current manual preferences to be able to switch back to them:
  gSavedManualPrefKeepSettingsForReply = document.getElementById("enigmail_keepSettingsForReply").checked;
  gSavedManualPrefAcceptedKeys = document.getElementById("enigmail_acceptedKeys").value;
  gSavedManualPrefAutoSendEncrypted = document.getElementById("enigmail_autoSendEncrypted").value;
  gSavedManualPrefConfirmBeforeSending = document.getElementById("enigmail_confirmBeforeSending").value;

  // switch encryption model:
  gEnigEncryptionModel = 0; // convenient encryption settings
  EnigSetPref("encryptionModel", gEnigEncryptionModel);

  // update GUI elements and corresponding setting variables:
  var keepSettingsForReply = true; // reply encrypted on encrypted emails
  gEnigAcceptedKeys = 1; // all keys accepted
  gEnigAutoSendEncrypted = 1; // auto.send-encrypted if accepted keys exist
  gEnigConfirmBeforeSending = 0; // never confirm before sending
  EnigSetPref("keepSettingsForReply", keepSettingsForReply);
  EnigSetPref("acceptedKeys", gEnigAcceptedKeys);
  EnigSetPref("autoSendEncrypted", gEnigAutoSendEncrypted);
  EnigSetPref("confirmBeforeSending", gEnigConfirmBeforeSending);

  updateSendingPrefs();
}

function resetSendingPrefsManually() {
  EnigmailLog.DEBUG("pref-enigmail.js: resetSendingPrefsManually()\n");

  // switch encryption model:
  gEnigEncryptionModel = 1; // manual encryption settings
  EnigSetPref("encryptionModel", gEnigEncryptionModel);

  // update GUI elements and corresponding setting variables
  // with saved old manual preferences:
  var keepSettingsForReply = gSavedManualPrefKeepSettingsForReply;
  gEnigAcceptedKeys = gSavedManualPrefAcceptedKeys;
  gEnigAutoSendEncrypted = gSavedManualPrefAutoSendEncrypted;
  gEnigConfirmBeforeSending = gSavedManualPrefConfirmBeforeSending;
  EnigSetPref("keepSettingsForReply", keepSettingsForReply);
  EnigSetPref("acceptedKeys", gEnigAcceptedKeys);
  EnigSetPref("autoSendEncrypted", gEnigAutoSendEncrypted);
  EnigSetPref("confirmBeforeSending", gEnigConfirmBeforeSending);

  updateSendingPrefs();
}

function resetRememberedValues() {
  EnigmailLog.DEBUG("pref-enigmail.js: resetRememberedValues\n");
  var prefs = ["confirmBeforeSend",
    "displaySignWarn",
    "encryptAttachmentsSkipDlg",
    "initAlert",
    "mimePreferPgp",
    "quotedPrintableWarn",
    "warnOnRulesConflict",
    "warnGpgAgentAndIdleTime",
    "warnClearPassphrase",
    "warnOnSendingNewsgroups",
    "warnDownloadContactKeys",
    "warnRefreshAll",
    "warnDeprecatedGnuPG"
  ];

  for (var j = 0; j < prefs.length; j++) {
    EnigSetPref(prefs[j], EnigGetDefaultPref(prefs[j]));
  }
  EnigAlert(EnigGetString("warningsAreReset"));
}

function prefOnAccept() {

  EnigmailLog.DEBUG("pref-enigmail.js: prefOnAccept\n");

  var autoKey = document.getElementById("enigmail_autoKeyRetrieve").value;

  if (autoKey.search(/.[ ,;\t]./) >= 0) {
    EnigAlert(EnigGetString("prefEnigmail.oneKeyserverOnly"));
    return false;
  }

  var oldAgentPath = EnigGetPref("agentPath");

  if (!document.getElementById("enigOverrideGpg").checked) {
    document.getElementById("enigmail_agentPath").value = "";
  }
  var newAgentPath = document.getElementById("enigmail_agentPath").value;

  displayPrefs(false, false, true);
  EnigSetPref("agentPath", EnigConvertFromUnicode(newAgentPath, "utf-8"));

  if (gMimePartsElement &&
    (gMimePartsElement.checked != gMimePartsValue)) {

    EnigmailPrefs.getPrefRoot().setBoolPref("mail.server.default.mime_parts_on_demand", (gMimePartsElement.checked ? true : false));
  }

  EnigSetPref("configuredVersion", EnigGetVersion());
  EnigSetPref("advancedUser", gAdvancedMode);
  let maxIdle = document.getElementById("maxIdleMinutes").value;

  if (gOrigMaxIdle != maxIdle) {
    // only change setting in gpg-agent if value has actually changed
    // because gpg-agent deletes cache upon changing timeout settings
    EnigmailGpgAgent.setMaxIdlePref(maxIdle);
  }

  EnigSavePrefs();

  if (oldAgentPath != newAgentPath) {
    if (!gEnigmailSvc) {
      try {
        gEnigmailSvc = ENIG_C[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_I.nsIEnigmail);
      }
      catch (ex) {}
    }

    if (gEnigmailSvc.initialized) {
      try {
        gEnigmailSvc.reinitialize();
      }
      catch (ex) {
        EnigError(EnigGetString("invalidGpgPath"));
      }
    }
    else {
      gEnigmailSvc = null;
      GetEnigmailSvc();
    }
  }

  // detect use of gpg-agent and warn if needed
  if (EnigmailGpgAgent.useGpgAgent()) {
    if (!EnigmailGpgAgent.isAgentTypeGpgAgent()) {
      if ((document.getElementById("maxIdleMinutes").value > 0) &&
        (!document.getElementById("enigmail_noPassphrase").checked)) {
        EnigAlertPref(EnigGetString("prefs.warnIdleTimeForUnknownAgent"), "warnGpgAgentAndIdleTime");
      }
    }
  }

  // update status bar because whether/how to process rules might have changed
  // NO EFFECT, TB hangs:
  //Enigmail.msg.updateStatusBar();

  return true;
}

function enigActivateDependent(obj, dependentIds) {
  var idList = dependentIds.split(/ /);
  var depId;

  for (depId in idList) {
    if (obj.checked) {
      document.getElementById(idList[depId]).removeAttribute("disabled");
    }
    else {
      document.getElementById(idList[depId]).setAttribute("disabled", "true");
    }
  }
  return true;
}

function enigShowUserModeButtons(expertUser) {
  var advUserButton = document.getElementById("enigmail_advancedUser");
  var basicUserButton = document.getElementById("enigmail_basicUser");
  if (!expertUser) {
    basicUserButton.setAttribute("hidden", true);
    advUserButton.removeAttribute("hidden");
  }
  else {
    advUserButton.setAttribute("hidden", true);
    basicUserButton.removeAttribute("hidden");
  }
}

function enigSwitchAdvancedMode(expertUser) {

  var origPref = EnigGetPref("advancedUser");
  enigShowUserModeButtons(expertUser);
  gAdvancedMode = expertUser;

  if (expertUser) {
    EnigSetPref("advancedUser", true);
  }
  else {
    EnigSetPref("advancedUser", false);
  }

  var prefTabBox = document.getElementById("prefTabBox");
  if (prefTabBox) {
    // Thunderbird
    //    EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);
    EnigCollapseAdvanced(prefTabBox, "collapsed", null);
  }
  else {
    // Seamonkey
    EnigCollapseAdvanced(document.getElementById("enigmailPrefsBox"), "hidden", null);
  }
  EnigSetPref("advancedUser", origPref);
}

function enigAlertAskNever() {
  EnigAlert(EnigGetString("prefs.warnAskNever"));
}

function activateRulesButton(radioListObj, buttonId) {
  switch (radioListObj.value) {
    case "3":
    case "4":
      document.getElementById(buttonId).setAttribute("disabled", "true");
      break;
    default:
      document.getElementById(buttonId).removeAttribute("disabled");
  }
}


function enigLocateGpg() {
  var fileName = "gpg";
  var ext = "";
  if (EnigGetOS() == "WINNT") {
    ext = ".exe";
  }
  var filePath = EnigFilePicker(EnigGetString("locateGpg"),
    "", false, ext,
    fileName + ext, null);
  if (filePath) {
    //     if (EnigmailOS.getOS() == "WINNT") {
    //       document.getElementById("enigmail_agentPath").value = EnigGetFilePath(filePath);
    //     }
    document.getElementById("enigmail_agentPath").value = filePath.path;
  }
}
