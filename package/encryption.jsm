/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["AutocryptEncryption"];

const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
const AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;
const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").AutocryptApp;
const AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
const AutocryptDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").AutocryptDialog;
const AutocryptFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").AutocryptFiles;
const AutocryptFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").AutocryptFuncs;
const AutocryptKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").AutocryptKeyRing;
const AutocryptConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").AutocryptConstants;
const AutocryptCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").AutocryptCryptoAPI;
const AutocryptSqliteDb = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").AutocryptSqliteDb;


var AutocryptEncryption = {
  encryptMessage: async function(plainText, encodedPrivKey, encodedPubKeys) {
    AutocryptLog.DEBUG("encryption.js: Autocrypt.encryptMessage: " + plainText.length + " bytes to " + encodedPubKeys.length + " keys\n");

    if (!plainText) {
      AutocryptLog.DEBUG("encryption.js: Autocrypt.encryptMessage: NO ENCRYPTION!\n");
      AutocryptLog.DEBUG("  <=== encryptMessage()\n");
      return "";
    }

    // First convert all linebreaks to newlines
    plainText = plainText.replace(/\r\n/g, "\n");
    plainText = plainText.replace(/\r/g, "\n");

    // we need all data in CRLF according to RFC 4880
    plainText = plainText.replace(/\n/g, "\r\n");

    const cApi = AutocryptCryptoAPI();
    let ciphertext = await cApi.encrypt(plainText, encodedPrivKey, encodedPubKeys);

    // Normal return
    AutocryptLog.DEBUG("  <=== encryptMessage()\n");
    return AutocryptData.getUnicodeData(ciphertext);
  },

  encryptAttachment: function(parent, fromMailAddr, toMailAddr, bccMailAddr, sendFlags, inFile, outFile,
    exitCodeObj, statusFlagsObj, errorMsgObj) {
    AutocryptLog.DEBUG("encryption.jsm: AutocryptEncryption.encryptAttachment infileName=" + inFile.path + "\n");

    statusFlagsObj.value = 0;
    errorMsgObj.value = "Not yet implemented";
    return "";
  }
};
