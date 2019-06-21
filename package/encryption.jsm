/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailEncryption"];

const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailApp = ChromeUtils.import("chrome://enigmail/content/modules/app.jsm").EnigmailApp;
const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
const EnigmailGpgAgent = ChromeUtils.import("chrome://enigmail/content/modules/gpgAgent.jsm").EnigmailGpgAgent;
const EnigmailGpg = ChromeUtils.import("chrome://enigmail/content/modules/gpg.jsm").EnigmailGpg;
const EnigmailErrorHandling = ChromeUtils.import("chrome://enigmail/content/modules/errorHandling.jsm").EnigmailErrorHandling;
const EnigmailExecution = ChromeUtils.import("chrome://enigmail/content/modules/execution.jsm").EnigmailExecution;
const EnigmailFiles = ChromeUtils.import("chrome://enigmail/content/modules/files.jsm").EnigmailFiles;
const EnigmailPassword = ChromeUtils.import("chrome://enigmail/content/modules/passwords.jsm").EnigmailPassword;
const EnigmailFuncs = ChromeUtils.import("chrome://enigmail/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://enigmail/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;


var EnigmailEncryption = {
  encryptMessage: function(parent, uiFlags, plainText, encodedPrivKey, encodedPubKeys, bccMailAddr, sendFlags,
    exitCodeObj, statusFlagsObj, errorMsgObj) {
    EnigmailLog.DEBUG("enigmail.js: Enigmail.encryptMessage: " + plainText.length + " bytes to " + encodedPubKeys.length + " keys (" + sendFlags + ")\n");

    exitCodeObj.value = -1;
    statusFlagsObj.value = 0;
    errorMsgObj.value = "";

    if (!plainText) {
      EnigmailLog.DEBUG("enigmail.js: Enigmail.encryptMessage: NO ENCRYPTION!\n");
      exitCodeObj.value = 0;
      EnigmailLog.DEBUG("  <=== encryptMessage()\n");
      return plainText;
    }

    // First convert all linebreaks to newlines
    plainText = plainText.replace(/\r\n/g, "\n");
    plainText = plainText.replace(/\r/g, "\n");

    // we need all data in CRLF according to RFC 4880
    plainText = plainText.replace(/\n/g, "\r\n");

    const cApi = EnigmailCryptoAPI();
    let ciphertext = cApi.sync(cApi.encrypt(plainText, encodedPrivKey, encodedPubKeys));

    var retStatusObj = {};
    exitCodeObj.value = 0;

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
