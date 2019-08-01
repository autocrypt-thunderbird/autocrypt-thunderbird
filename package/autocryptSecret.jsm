/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for dealing with received Autocrypt headers, level 0
 *  See details at https://github.com/mailencrypt/autocrypt
 */

var EXPORTED_SYMBOLS = ["AutocryptSecret"];

const Cr = Components.results;

Components.utils.importGlobalProperties(["crypto"]); /* global crypto: false */

const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
const PromiseUtils = ChromeUtils.import("resource://gre/modules/PromiseUtils.jsm").PromiseUtils;
const EnigmailTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").EnigmailTimer;
const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailKey = ChromeUtils.import("chrome://autocrypt/content/modules/key.jsm").EnigmailKey;
const EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
const EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;


var AutocryptSecret = {
  generateKeyForEmail: async function(email, is_mutual) {
    EnigmailLog.DEBUG(`keyRing.jsm: generateKeyForEmail()\n`);

    const openpgp = EnigmailCryptoAPI();
    let secret_key = await openpgp.generateAutocryptKey(email);
    let fpr_primary = secret_key.getFingerprint().toUpperCase();

    await EnigmailKeyRing.insertSecretKey(secret_key, email);

    let effective_date = new Date();
    await sqlite.autocryptInsertOrUpdateLastSeenMessage(email, effective_date);
    await sqlite.autocryptUpdateKey(email, effective_date, fpr_primary, is_mutual);

    EnigmailLog.DEBUG(`keyRing.jsm: generateKeyForEmail(): ok\n`);
  }
};
