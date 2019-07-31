/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailEncryption"];

const EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
const EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").EnigmailApp;
const EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
const EnigmailDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").EnigmailDialog;
const EnigmailFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").EnigmailFiles;
const EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
const EnigmailSqliteDb = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;


var EnigmailEncryption = {
  encryptMessage: async function(plainText, encodedPrivKey, encodedPubKeys) {
    EnigmailLog.DEBUG("encryption.js: Enigmail.encryptMessage: " + plainText.length + " bytes to " + encodedPubKeys.length + " keys\n");

    if (!plainText) {
      EnigmailLog.DEBUG("encryption.js: Enigmail.encryptMessage: NO ENCRYPTION!\n");
      EnigmailLog.DEBUG("  <=== encryptMessage()\n");
      return "";
    }

    // First convert all linebreaks to newlines
    plainText = plainText.replace(/\r\n/g, "\n");
    plainText = plainText.replace(/\r/g, "\n");

    // we need all data in CRLF according to RFC 4880
    plainText = plainText.replace(/\n/g, "\r\n");

    const cApi = EnigmailCryptoAPI();
    let ciphertext = await cApi.encrypt(plainText, encodedPrivKey, encodedPubKeys);

    // Normal return
    EnigmailLog.DEBUG("  <=== encryptMessage()\n");
    return EnigmailData.getUnicodeData(ciphertext);
  },

  encryptAttachment: function(parent, fromMailAddr, toMailAddr, bccMailAddr, sendFlags, inFile, outFile,
    exitCodeObj, statusFlagsObj, errorMsgObj) {
    EnigmailLog.DEBUG("encryption.jsm: EnigmailEncryption.encryptAttachment infileName=" + inFile.path + "\n");

    statusFlagsObj.value = 0;
    errorMsgObj.value = "Not yet implemented";
    return "";
  }
};
