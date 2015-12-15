/*global Components: false, EnigmailLog: false, EnigmailPrefs: false, EnigmailTimer: false, EnigmailApp: false, EnigmailLocale: false, EnigmailDialog: false, EnigmailWindows: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailConfigure"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/prefs.jsm");
Cu.import("resource://enigmail/timer.jsm");
Cu.import("resource://enigmail/app.jsm");
Cu.import("resource://enigmail/locale.jsm");
Cu.import("resource://enigmail/dialog.jsm");
Cu.import("resource://enigmail/windows.jsm");

function upgradeRecipientsSelection() {
  // Upgrade perRecipientRules and recipientsSelectionOption to
  // new recipientsSelection

  var keySel = EnigmailPrefs.getPref("recipientsSelectionOption");
  var perRecipientRules = EnigmailPrefs.getPref("perRecipientRules");

  var setVal = 2;

  /*
   1: rules only
   2: rules & email addresses (normal)
   3: email address only (no rules)
   4: manually (always prompt, no rules)
   5: no rules, no key selection
   */

  switch (perRecipientRules) {
    case 0:
      switch (keySel) {
        case 0:
          setVal = 5;
          break;
        case 1:
          setVal = 3;
          break;
        case 2:
          setVal = 4;
          break;
        default:
          setVal = 2;
      }
      break;
    case 1:
      setVal = 2;
      break;
    case 2:
      setVal = 1;
      break;
    default:
      setVal = 2;
  }

  // set new pref
  EnigmailPrefs.setPref("recipientsSelection", setVal);

  // clear old prefs
  EnigmailPrefs.getPrefBranch().clearUserPref("perRecipientRules");
  EnigmailPrefs.getPrefBranch().clearUserPref("recipientsSelectionOption");
}

function upgradePrefsSending() {
  EnigmailLog.DEBUG("enigmailCommon.jsm: upgradePrefsSending()\n");

  var cbs = EnigmailPrefs.getPref("confirmBeforeSend");
  var ats = EnigmailPrefs.getPref("alwaysTrustSend");
  var ksfr = EnigmailPrefs.getPref("keepSettingsForReply");
  EnigmailLog.DEBUG("enigmailCommon.jsm: upgradePrefsSending cbs=" + cbs + " ats=" + ats + " ksfr=" + ksfr + "\n");

  // Upgrade confirmBeforeSend (bool) to confirmBeforeSending (int)
  switch (cbs) {
    case false:
      EnigmailPrefs.setPref("confirmBeforeSending", 0); // never
      break;
    case true:
      EnigmailPrefs.setPref("confirmBeforeSending", 1); // always
      break;
  }

  // Upgrade alwaysTrustSend (bool)   to acceptedKeys (int)
  switch (ats) {
    case false:
      EnigmailPrefs.setPref("acceptedKeys", 0); // valid
      break;
    case true:
      EnigmailPrefs.setPref("acceptedKeys", 1); // all
      break;
  }

  // if all settings are default settings, use convenient encryption
  if (cbs === false && ats === true && ksfr === true) {
    EnigmailPrefs.setPref("encryptionModel", 0); // convenient
    EnigmailLog.DEBUG("enigmailCommon.jsm: upgradePrefsSending() encryptionModel=0 (convenient)\n");
  }
  else {
    EnigmailPrefs.setPref("encryptionModel", 1); // manually
    EnigmailLog.DEBUG("enigmailCommon.jsm: upgradePrefsSending() encryptionModel=1 (manually)\n");
  }

  // clear old prefs
  EnigmailPrefs.getPrefBranch().clearUserPref("confirmBeforeSend");
  EnigmailPrefs.getPrefBranch().clearUserPref("alwaysTrustSend");
}


function upgradeHeadersView() {
  // all headers hack removed -> make sure view is correct
  var hdrMode = null;
  try {
    hdrMode = EnigmailPrefs.getPref("show_headers");
  }
  catch (ex) {}

  if (!hdrMode) hdrMode = 1;
  try {
    EnigmailPrefs.getPrefBranch().clearUserPref("show_headers");
  }
  catch (ex) {}

  EnigmailPrefs.getPrefRoot().setIntPref("mail.show_headers", hdrMode);
}

function upgradeCustomHeaders() {
  try {
    var extraHdrs = " " + EnigmailPrefs.getPrefRoot().getCharPref("mailnews.headers.extraExpandedHeaders").toLowerCase() + " ";

    var extraHdrList = [
      "x-enigmail-version",
      "content-transfer-encoding",
      "openpgp",
      "x-mimeole",
      "x-bugzilla-reason",
      "x-php-bug"
    ];

    for (let hdr in extraHdrList) {
      extraHdrs = extraHdrs.replace(" " + extraHdrList[hdr] + " ", " ");
    }

    extraHdrs = extraHdrs.replace(/^ */, "").replace(/ *$/, "");
    EnigmailPrefs.getPrefRoot().setCharPref("mailnews.headers.extraExpandedHeaders", extraHdrs);
  }
  catch (ex) {}
}

function upgradePgpMime() {
  var pgpMimeMode = false;
  try {
    pgpMimeMode = (EnigmailPrefs.getPref("usePGPMimeOption") == 2);
  }
  catch (ex) {
    return;
  }

  try {
    if (pgpMimeMode) {
      var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
      try {
        // Gecko >= 20
        for (var i = 0; i < accountManager.allIdentities.length; i++) {
          var id = accountManager.allIdentities.queryElementAt(i, Ci.nsIMsgIdentity);
          if (id.getBoolAttribute("enablePgp")) {
            id.setBoolAttribute("pgpMimeMode", true);
          }
        }
      }
      catch (ex) {
        // Gecko < 20
        for (var i = 0; i < accountManager.allIdentities.Count(); i++) {
          var id = accountManager.allIdentities.QueryElementAt(i, Ci.nsIMsgIdentity);
          if (id.getBoolAttribute("enablePgp")) {
            id.setBoolAttribute("pgpMimeMode", true);
          }
        }
      }
    }
    EnigmailPrefs.getPrefBranch().clearUserPref("usePGPMimeOption");
  }
  catch (ex) {}
}


const EnigmailConfigure = {
  configureEnigmail: function(win, startingPreferences) {
    EnigmailLog.DEBUG("configure.jsm: configureEnigmail\n");
    let oldVer = EnigmailPrefs.getPref("configuredVersion");

    try {
      let vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
      if (oldVer === "") {
        EnigmailWindows.openSetupWizard(win, false);
      }
      else {
        if (oldVer < "0.95") {
          try {
            upgradeHeadersView();
            upgradePgpMime();
            upgradeRecipientsSelection();
          }
          catch (ex) {}
        }
        if (vc.compare(oldVer, "1.0") < 0) {
          upgradeCustomHeaders();
        }
        if (vc.compare(oldVer, "1.7a1pre") < 0) {
          // MISSING:
          // - upgrade extensions.enigmail.recipientsSelection
          //   to      extensions.enigmail.assignKeys*
          // 1: rules only
          //     => assignKeysByRules true; rest false
          // 2: rules & email addresses (normal)
          //     => assignKeysByRules/assignKeysByEmailAddr/assignKeysManuallyIfMissing true
          // 3: email address only (no rules)
          //     => assignKeysByEmailAddr/assignKeysManuallyIfMissing true
          // 4: manually (always prompt, no rules)
          //     => assignKeysManuallyAlways true
          // 5: no rules, no key selection
          //     => assignKeysByRules/assignKeysByEmailAddr true

          upgradePrefsSending();
        }
        if (vc.compare(oldVer, "1.7") < 0) {
          // open a modal dialog. Since this might happen during the opening of another
          // window, we have to do this asynchronously
          EnigmailTimer.setTimeout(
            function _cb() {
              var doIt = EnigmailDialog.confirmDlg(win,
                EnigmailLocale.getString("enigmailCommon.versionSignificantlyChanged"),
                EnigmailLocale.getString("enigmailCommon.checkPreferences"),
                EnigmailLocale.getString("dlg.button.close"));
              if (!startingPreferences && doIt) {
                // same as:
                // - EnigmailWindows.openPrefWindow(window, true, 'sendingTab');
                // but
                // - without starting the service again because we do that right now
                // - and modal (waiting for its end)
                win.openDialog("chrome://enigmail/content/pref-enigmail.xul",
                  "_blank", "chrome,resizable=yes,modal", {
                    'showBasic': true,
                    'clientType': 'thunderbird',
                    'selectTab': 'sendingTab'
                  });
              }
            }, 100);

        }
      }
    }
    catch (ex) {}

    EnigmailPrefs.setPref("configuredVersion", EnigmailApp.getVersion());
    EnigmailPrefs.savePrefs();
  }
};
