/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptConfigure"];

const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").AutocryptPrefs;
const AutocryptWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").AutocryptWindows;
const AutocryptStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").AutocryptStdlib;
const AutocryptWelcomeMessage = ChromeUtils.import("chrome://autocrypt/content/modules/welcomeMessage.jsm").AutocryptWelcomeMessage;
const AutocryptSecret = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSecret.jsm").AutocryptSecret;

// Interfaces
const nsIFolderLookupService = Ci.nsIFolderLookupService;
const nsIMsgAccountManager = Ci.nsIMsgAccountManager;


var AutocryptConfigure = {
  configureAutocrypt: async function(oldVersion, newVersion) {
    AutocryptLog.DEBUG("configure.jsm: configureAutocrypt()\n");
    // oldVersion = null;
    if (oldVersion == newVersion) {
      AutocryptLog.DEBUG("configure.jsm: configureAutocrypt(): version up to date,nothing to do)\n");
      return;
    }

    AutocryptPrefs.setPref("configuredVersion", newVersion);
    AutocryptPrefs.savePrefs();

    if (!oldVersion && AutocryptStdlib.hasConfiguredAccounts()) {
      await AutocryptSecret.generateKeysForAllIdentities();
      await AutocryptWelcomeMessage.sendWelcomeMessage();
    }
  }
};
