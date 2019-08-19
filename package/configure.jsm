/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailConfigure"];

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").EnigmailWindows;
const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
const AutocryptWelcomeMessage = ChromeUtils.import("chrome://autocrypt/content/modules/welcomeMessage.jsm").AutocryptWelcomeMessage;
const AutocryptSecret = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSecret.jsm").AutocryptSecret;

// Interfaces
const nsIFolderLookupService = Ci.nsIFolderLookupService;
const nsIMsgAccountManager = Ci.nsIMsgAccountManager;


var EnigmailConfigure = {
  configureAutocrypt: async function(oldVersion, newVersion) {
    EnigmailLog.DEBUG("configure.jsm: configureEnigmail()\n");
    if (oldVersion == newVersion) {
      EnigmailLog.DEBUG("configure.jsm: configureEnigmail(): version up to date,nothing to do)\n");
      return;
    }

    EnigmailPrefs.setPref("configuredVersion", newVersion);
    EnigmailPrefs.savePrefs();

    if (!oldVersion && EnigmailStdlib.hasConfiguredAccounts()) {
      await AutocryptSecret.generateKeysForAllIdentities();
      await AutocryptWelcomeMessage.sendWelcomeMessage();
    }
  }
};
