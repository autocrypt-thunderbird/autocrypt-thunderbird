/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailConfigure"];

const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const EnigmailApp = ChromeUtils.import("chrome://enigmail/content/modules/app.jsm").EnigmailApp;
const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailDialog=ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
const EnigmailWindows = ChromeUtils.import("chrome://enigmail/content/modules/windows.jsm").EnigmailWindows;
const EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailStdlib = ChromeUtils.import("chrome://enigmail/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailLazy = ChromeUtils.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailAutoSetup = ChromeUtils.import("chrome://enigmail/content/modules/autoSetup.jsm").EnigmailAutoSetup;
const EnigmailSqliteDb = ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

// Interfaces
const nsIFolderLookupService = Ci.nsIFolderLookupService;
const nsIMsgAccountManager = Ci.nsIMsgAccountManager;

/**
 * set the Autocrypt prefer-encrypt option to "mutual" for all existing
 * accounts
 */
function setAutocryptForOldAccounts() {
  try {
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
    let changedSomething = false;

    for (let acct = 0; acct < accountManager.accounts.length; acct++) {
      let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);
      if (ac.incomingServer.type.search(/(pop3|imap|movemail)/) >= 0) {
        ac.incomingServer.setIntValue("acPreferEncrypt", 1);
      }
    }
  }
  catch (ex) {}
}


function displayUpgradeInfo() {
  EnigmailLog.DEBUG("configure.jsm: displayUpgradeInfo()\n");
  try {
    EnigmailWindows.openMailTab("chrome://enigmail/content/ui/upgradeInfo.html");
  }
  catch (ex) {}
}


var EnigmailConfigure = {
  /**
   * configureEnigmail: main function for configuring Enigmail during the first run
   * this method is called from core.jsm if Enigmail has not been set up before
   * (determined via checking the configuredVersion in the preferences)
   *
   * @param {nsIWindow} win:                 The parent window. Null if no parent window available
   * @param {Boolean}   startingPreferences: if true, called while switching to new preferences
   *                        (to avoid re-check for preferences)
   *
   * @return {Promise<null>}
   */
  configureEnigmail: async function(win, startingPreferences) {
    EnigmailLog.DEBUG("configure.jsm: configureEnigmail()\n");

    if (!EnigmailStdlib.hasConfiguredAccounts()) {
      EnigmailLog.DEBUG("configure.jsm: configureEnigmail: no account configured. Waiting 60 seconds.\n");

      // try again in 60 seconds
      EnigmailTimer.setTimeout(
        function _f() {
          EnigmailConfigure.configureEnigmail(win, startingPreferences);
        },
        60000);
      return;
    }

    let oldVer = EnigmailPrefs.getPref("configuredVersion");

    let vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);

    if (oldVer === "") {
      let setupResult = await EnigmailAutoSetup.determinePreviousInstallType();

      switch (EnigmailAutoSetup.value) {
        case EnigmailConstants.AUTOSETUP_NOT_INITIALIZED:
        case EnigmailConstants.AUTOSETUP_NO_ACCOUNT:
          break;
        default:
          EnigmailPrefs.setPref("configuredVersion", EnigmailApp.getVersion());
          EnigmailWindows.openSetupWizard(win);
      }
    }
    else {
      // TODO upgrades
      // if (vc.compare(oldVer, "1.0") < 0) {
        // this.upgradeTo100();
      // }
    }

    EnigmailPrefs.setPref("configuredVersion", EnigmailApp.getVersion());
    EnigmailPrefs.savePrefs();
  }
};
