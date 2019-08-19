/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailConfigure"];

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").EnigmailTimer;
const EnigmailApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").EnigmailApp;
const EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
const EnigmailDialog=ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").EnigmailDialog;
const EnigmailWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").EnigmailWindows;
const EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailAutoSetup = ChromeUtils.import("chrome://autocrypt/content/modules/autoSetup.jsm").EnigmailAutoSetup;
const EnigmailSqliteDb = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;
const AutocryptWelcomeMessage = ChromeUtils.import("chrome://autocrypt/content/modules/welcomeMessage.jsm").AutocryptWelcomeMessage;

// Interfaces
const nsIFolderLookupService = Ci.nsIFolderLookupService;
const nsIMsgAccountManager = Ci.nsIMsgAccountManager;


var EnigmailConfigure = {
  configureEnigmail: async function(win, startingPreferences) {
    EnigmailLog.DEBUG("configure.jsm: configureEnigmail()\n");

    EnigmailPrefs.setPref("configuredVersion", EnigmailApp.getVersion());
    EnigmailPrefs.savePrefs();

    if (EnigmailStdlib.hasConfiguredAccounts()) {
      EnigmailWindows.openSetupWizard(win, false);
      AutocryptWelcomeMessage.sendWelcomeMessage();
    }
  }
};
