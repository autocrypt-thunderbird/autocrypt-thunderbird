/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailConfigure"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;


/*global EnigmailLog: false, EnigmailPrefs: false, EnigmailTimer: false, EnigmailApp: false, EnigmailLocale: false, EnigmailDialog: false, EnigmailWindows: false */

Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/prefs.jsm");
Cu.import("resource://enigmail/timer.jsm");
Cu.import("resource://enigmail/app.jsm");
Cu.import("resource://enigmail/locale.jsm");
Cu.import("resource://enigmail/dialog.jsm");
Cu.import("resource://enigmail/windows.jsm");
Cu.import("resource://enigmail/pEpAdapter.jsm"); /* global EnigmailPEPAdapter: false */
Cu.import("resource://enigmail/installPep.jsm"); /* global EnigmailInstallPep: false */


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

/**
 * Change from global PGP/MIME setting to per-identity setting
 */
function upgradeOldPgpMime() {
  var pgpMimeMode = false;
  try {
    pgpMimeMode = (EnigmailPrefs.getPref("usePGPMimeOption") == 2);
  }
  catch (ex) {
    return;
  }

  try {
    var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
    for (var i = 0; i < accountManager.allIdentities.length; i++) {
      var id = accountManager.allIdentities.queryElementAt(i, Ci.nsIMsgIdentity);
      if (id.getBoolAttribute("enablePgp")) {
        id.setBoolAttribute("pgpMimeMode", pgpMimeMode);
      }
    }

    EnigmailPrefs.getPrefBranch().clearUserPref("usePGPMimeOption");
  }
  catch (ex) {}
}

/**
 * Replace short key IDs with FPR in identity settings
 */
function replaceKeyIdWithFpr() {
  // TODO: completeme!
}


/**
 * Change the default to PGP/MIME for all accounts, except nntp
 */
function defaultPgpMime() {
  let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
  let changedSomething = false;

  for (let acct = 0; acct < accountManager.accounts.length; acct++) {
    let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);
    if (ac.incomingServer.type.search(/(pop3|imap|movemail)/) >= 0) {

      for (let i = 0; i < ac.identities.length; i++) {
        let id = ac.identities.queryElementAt(i, Ci.nsIMsgIdentity);
        if (id.getBoolAttribute("enablePgp") && !id.getBoolAttribute("pgpMimeMode")) {
          changedSomething = true;
        }
        id.setBoolAttribute("pgpMimeMode", true);
      }
    }
  }

  if (EnigmailPrefs.getPref("advancedUser") && changedSomething) {
    EnigmailDialog.alert(null,
      EnigmailLocale.getString("preferences.defaultToPgpMime"));
  }
}

/**
 * Determin if pEp is avaliable, and if it is not available,
 * whether it can be downaloaded and installed. This does not
 * trigger installation.
 */

function isPepInstallable() {
  if (EnigmailPEPAdapter.isPepAvailable(false)) {
    return true;
  }

  return EnigmailInstallPep.isPepInstallerAvailable();
}

const EnigmailConfigure = {
  configureEnigmail: function(win, startingPreferences) {
    EnigmailLog.DEBUG("configure.jsm: configureEnigmail\n");
    let oldVer = EnigmailPrefs.getPref("configuredVersion");

    let vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);

    if (oldVer === "") {
      EnigmailPrefs.setPref("configuredVersion", EnigmailApp.getVersion());

      if (EnigmailPrefs.getPref("juniorMode") === 0 || (!isPepInstallable())) {
        // start wizard if pEp Junior Mode is fored off or if pep cannot
        // be installed/used
        EnigmailWindows.openSetupWizard(win, false);
      }
    }
    else {
      if (oldVer < "0.95") {
        try {
          upgradeHeadersView();
          upgradeOldPgpMime();
          upgradeRecipientsSelection();
        }
        catch (ex) {}
      }
      if (vc.compare(oldVer, "1.0") < 0) {
        upgradeCustomHeaders();
      }
      if (vc.compare(oldVer, "1.7a1pre") < 0) {
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

      if (vc.compare(oldVer, "1.9a2pre") < 0) {
        defaultPgpMime();
      }
      if (vc.compare(oldVer, "2.0a1pre") < 0) {
        replaceKeyIdWithFpr();
      }
    }

    EnigmailPrefs.setPref("configuredVersion", EnigmailApp.getVersion());
    EnigmailPrefs.savePrefs();
  }
};
