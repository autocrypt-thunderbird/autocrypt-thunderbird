/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["getGnuPGAPI"];

Components.utils.import("resource://gre/modules/Services.jsm"); /* global Services: false */

// Load OpenPGP.js (including generic) API
Services.scriptloader.loadSubScript("chrome://enigmail/content/modules/cryptoAPI/openpgp-js.js",
  null, "UTF-8"); /* global OpenPGPjsCryptoAPI: false */

/* globals loaded from openpgp-js.js: */
/* global Cc: false, Cu: false, Ci: false */
/* global getOpenPGP: false, EnigmailLog: false */

const EnigmailGpg = Cu.import("chrome://enigmail/content/modules/gpg.jsm").EnigmailGpg;
const EnigmailExecution = Cu.import("chrome://enigmail/content/modules/execution.jsm").EnigmailExecution;
const EnigmailFiles = Cu.import("chrome://enigmail/content/modules/files.jsm").EnigmailFiles;
const EnigmailConstants = Cu.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
const EnigmailTime = Cu.import("chrome://enigmail/content/modules/time.jsm").EnigmailTime;
const EnigmailData = Cu.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailLocale = Cu.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailPassword = Cu.import("chrome://enigmail/content/modules/passwords.jsm").EnigmailPassword;
const EnigmailErrorHandling = Cu.import("chrome://enigmail/content/modules/errorHandling.jsm").EnigmailErrorHandling;
const GnuPGDecryption = Cu.import("chrome://enigmail/content/modules/cryptoAPI/gnupg-decryption.jsm").GnuPGDecryption;

const {
  obtainKeyList, createKeyObj, getPhotoFileFromGnuPG, extractSignatures
} = Cu.import("chrome://enigmail/content/modules/cryptoAPI/gnupg-keylist.jsm");

const {
  GnuPG_importKeyFromFile, GnuPG_extractSecretKey
} = Cu.import("chrome://enigmail/content/modules/cryptoAPI/gnupg-key.jsm");

/**
 * GnuPG implementation of CryptoAPI
 */

class GnuPGCryptoAPI extends OpenPGPjsCryptoAPI {
  constructor() {
    super();
    this.api_name = "GnuPG";
  }

  /**
   * Get the list of all knwn keys (including their secret keys)
   * @param {Array of String} onlyKeys: [optional] only load data for specified key IDs
   *
   * @return {Promise<Array of Object>}
   */
  async getKeys(onlyKeys = null) {
    let keyList = await obtainKeyList(onlyKeys);
    return keyList.keys;
  }

  /**
   * Get groups defined in gpg.conf in the same structure as KeyObject
   *
   * @return {Array of KeyObject} with type = "grp"
   */
  getGroups() {
    let groups = EnigmailGpg.getGpgGroups();

    let r = [];
    for (var i = 0; i < groups.length; i++) {

      let keyObj = createKeyObj(["grp"]);
      keyObj.keyTrust = "g";
      keyObj.userId = EnigmailData.convertGpgToUnicode(groups[i].alias).replace(/\\e3A/g, ":");
      keyObj.keyId = keyObj.userId;
      var grpMembers = EnigmailData.convertGpgToUnicode(groups[i].keylist).replace(/\\e3A/g, ":").split(/[,;]/);
      for (var grpIdx = 0; grpIdx < grpMembers.length; grpIdx++) {
        keyObj.userIds.push({
          userId: grpMembers[grpIdx],
          keyTrust: "q"
        });
      }
      r.push(keyObj);
    }

    return r;
  }


  /**
   * Obtain signatures for a given set of key IDs.
   *
   * @param {String}  keyId:            space-separated list of key IDs
   * @param {Boolean} ignoreUnknownUid: if true, filter out unknown signer's UIDs
   *
   * @return {Promise<Array of Object>} - see extractSignatures()
   */
  async getKeySignatures(keyId, ignoreUnknownUid = false) {
    EnigmailLog.DEBUG(`gnupg.js: getKeySignatures: ${keyId}\n`);
    const args = EnigmailGpg.getStandardArgs(true).
    concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]).
    concat(keyId.split(" "));

    let res = await EnigmailExecution.execAsync(EnigmailGpg.agentPath, args, "");

    if (!(res.statusFlags & EnigmailConstants.BAD_SIGNATURE)) {
      // ignore exit code as recommended by GnuPG authors
      res.exitCode = 0;
    }

    if (res.exitCode !== 0) {
      if (res.errorMsg) {
        res.errorMsg += "\n" + EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args);
        res.errorMsg += "\n" + res.errorMsg;
      }
      return "";
    }

    if (res.stdoutData.length > 0) {
      return extractSignatures(res.stdoutData, ignoreUnknownUid);
    }
    return null;
  }


  /**
   * Export the minimum key for the public key object:
   * public key, primary user ID, newest encryption subkey
   *
   * @param {String} fpr: a single fingerprint
   *
   * @return {Promise<Object>}:
   *    - exitCode (0 = success)
   *    - errorMsg (if exitCode != 0)
   *    - keyData: BASE64-encded string of key data
   */
  async getMinimalPubKey(fpr) {
    EnigmailLog.DEBUG(`gnupg.js: EnigmailKeyObj.getMinimalPubKey: ${fpr}\n`);

    let retObj = {
      exitCode: 0,
      errorMsg: "",
      keyData: ""
    };
    let minimalKeyBlock = null;

    let args = EnigmailGpg.getStandardArgs(true);
    args = args.concat(["--export-options", "export-minimal,no-export-attributes", "-a", "--export", fpr]);

    const statusObj = {};
    const exitCodeObj = {};
    let res = await EnigmailExecution.execAsync(EnigmailGpg.agentPath, args);
    let exportOK = true;
    let keyBlock = res.stdoutData;

    if (EnigmailGpg.getGpgFeature("export-result")) {
      // GnuPG 2.1.10+
      let r = new RegExp("^\\[GNUPG:\\] EXPORTED " + fpr, "m");
      if (res.stderrData.search(r) < 0) {
        retObj.exitCode = 2;
        retObj.errorMsg = EnigmailLocale.getString("failKeyExtract");
        exportOK = false;
      }
    }
    else {
      // GnuPG older than 2.1.10
      if (keyBlock.length < 50) {
        retObj.exitCode = 2;
        retObj.errorMsg = EnigmailLocale.getString("failKeyExtract");
        exportOK = false;
      }
    }

    if (exportOK) {
      let minKey = await this.getStrippedKey(keyBlock);
      if (minKey) {
        minimalKeyBlock = btoa(String.fromCharCode.apply(null, minKey));
      }

      if (!minimalKeyBlock) {
        retObj.exitCode = 1;
        retObj.errorMsg = EnigmailLocale.getString("failKeyNoSubkey");
      }
    }

    retObj.keyData = minimalKeyBlock;
    return retObj;
  }

  /**
   * Extract a photo ID from a key, store it as file and return the file object.
   *
   * @param {String} keyId:       Key ID / fingerprint
   * @param {Number} photoNumber: number of the photo on the key, starting with 0
   *
   * @return {nsIFile} object or null in case no data / error.
   */
  async getPhotoFile(keyId, photoNumber) {
    let file = await getPhotoFileFromGnuPG(keyId, photoNumber);
    return file;
  }

  /**
   * Import key(s) from a file
   *
   * @param {nsIFile} inputFile:  the file holding the keys
   *
   * @return {Object} or null in case no data / error:
   *   - {Number}          exitCode:        result code (0: OK)
   *   - {Array of String) importedKeys:    imported fingerprints
   *   - {String}          errorMsg:        human readable error message
   *   - {Number}          importSum:       total number of processed keys
   *   - {Number}          importUnchanged: number of unchanged keys
   */
  async importKeyFromFile(inputFile) {
    let keys = await GnuPG_importKeyFromFile(inputFile);
    return keys;
  }

  /**
   * Export secret key(s) to a file
   *
   * @param {String}  keyId      Specification by fingerprint or keyID
   * @param {Boolean} minimalKey  if true, reduce key to minimum required
   *
   * @return {Object}:
   *   - {Number} exitCode:  result code (0: OK)
   *   - {String} keyData:   ASCII armored key data material
   *   - {String} errorMsg:  error message in case exitCode !== 0
   */

  async extractSecretKey(keyId, minimalKey) {
    let ret = await GnuPG_extractSecretKey(keyId, minimalKey);

    if (ret.exitCode !== 0) {
      ret.errorMsg = EnigmailLocale.getString("failKeyExtract") + "\n" + ret.errorMsg;
    }
    return ret;
  }

  /**
   *
   * @param {byte} byteData    The encrypted data
   *
   * @return {String or null} - the name of the attached file
   */

  async getFileName(byteData) {
    EnigmailLog.DEBUG(`gnupg.js: getFileName\n`);
    const args = EnigmailGpg.getStandardArgs(true).
    concat(EnigmailPassword.command()).
    concat(["--decrypt"]);

    let res = await EnigmailExecution.execAsync(EnigmailGpg.agentPath, args, byteData + "\n");

    const matches = res.stderrData.match(/^(\[GNUPG:\] PLAINTEXT [0-9]+ [0-9]+ )(.*)$/m);
    if (matches && (matches.length > 2)) {
      var filename = matches[2];
      if (filename.indexOf(" ") > 0) {
        filename = filename.replace(/ .*$/, "");
      }
      return EnigmailData.convertToUnicode(unescape(filename), "utf-8");
    }
    else {
      return null;
    }
  }

  /**
   *
   * @param {Path} filePath    The signed file
   * @param {Path} sigPath       The signature to verify
   *
   * @return {Promise<String>} - A message from the verification.
   *
   * Use Promise.catch to handle failed verifications.
   * The message will be an error message in this case.
   */

  async verifyAttachment(filePath, sigPath) {
    EnigmailLog.DEBUG(`gnupg.js: verifyAttachment\n`);
    return Promise.new (function(resolve, reject) {
      const args = EnigmailGpg.getStandardArgs(true).
      concat(["--verify", sigPath, filePath]);
      const promise = EnigmailExecution.execAsync(EnigmailGpg.agentPath, args);
      promise.then(function(retObj){
        const decrypted = {};
        GnuPGDecryption.decryptMessageEnd(retObj.stderrData, retObj.exitCode, 1, true, true, EnigmailConstants.UI_INTERACTIVE, decrypted);
        if (retObj.exitCode === 0) {
          const detailArr = decrypted.sigDetails.split(/ /);
          const dateTime = EnigmailTime.getDateTime(detailArr[2], true, true);
          const msg1 = decrypted.errorMsg.split(/\n/)[0];
          const msg2 = EnigmailLocale.getString("keyAndSigDate", ["0x" + decrypted.keyId, dateTime]);
          const message = msg1 + "\n" + msg2;
          resolve(message);
        }
        else {
          reject(decrypted.errorMsg);
        }
      });
      promise.catch(function(retObj){
        reject(retObj.errorMsg);
      });
    });
  }

  /**
   *
   * @param {String} encrypted     The encrypted data
   * @param {Object} options       Decryption options
   *
   * @return {Promise<Object>} - Return object with decryptedData and
   * status information
   *
   * Use Promise.catch to handle failed decryption.
   * retObj.errorMsg will be an error message in this case.
   */

  async decryptMime(encrypted, options) {
    EnigmailLog.DEBUG(`gnupg.js: decryptMime\n`);

    // write something to gpg such that the process doesn't get stuck
    if (encrypted.length === 0) {
      encrypted = "NO DATA\n";
    }

    options.logFile = EnigmailErrorHandling.getTempLogFile();

    return Promise.new (function(resolve, reject) {
      const args = GnuPGDecryption.getDecryptionArgs(options);
      const promise = EnigmailExecution.execAsync(EnigmailGpg.agentPath, args, encrypted);
      promise.then(function(retObj){
        EnigmailErrorHandling.appendLogFileToDebug(options.logFile);
        if (retObj.statusFlags & EnigmailConstants.MISSING_PASSPHRASE) {
          EnigmailLog.ERROR("decryption.jsm: decryptMessageStart: Error - no passphrase supplied\n");

          reject(EnigmailLocale.getString("noPassphrase"));
          return;
        }
        const result = {
          exitCode: retObj.exitCode,
          decryptedData: retObj.stdoutData
        };
        GnuPGDecryption.decryptMessageEnd(retObj.stderrData, retObj.exitCode, retObj.stdoutData.length, false, false, EnigmailConstants.UI_PGP_MIME, result);
        resolve(result);
      });
      promise.catch(function(retObj){
        reject(retObj);
      });
    });
  }

  /**
   *
   * @param {String} signed        The signed data
   * @param {Object} options       Decryption options
   *
   * @return {Promise<Object>} - Return object with decryptedData and
   * status information
   *
   * Use Promise.catch to handle failed decryption.
   * retObj.errorMsg will be an error message in this case.
   */

  async verifyMime(signed, options) {
    EnigmailLog.DEBUG(`gnupg.js: verifyMime\n`);

    options.logFile = EnigmailErrorHandling.getTempLogFile();

    return Promise.new (function(resolve, reject) {
      const args = GnuPGDecryption.getDecryptionArgs(options);
      const promise = EnigmailExecution.execAsync(EnigmailGpg.agentPath, args, signed);
      promise.then(function(retObj){
        EnigmailErrorHandling.appendLogFileToDebug(options.logFile);
        if (retObj.statusFlags & EnigmailConstants.MISSING_PASSPHRASE) {
          EnigmailLog.ERROR("decryption.jsm: decryptMessageStart: Error - no passphrase supplied\n");

          reject(EnigmailLocale.getString("noPassphrase"));
          return;
        }
        const result = {
          exitCode: retObj.exitCode
        };
        GnuPGDecryption.decryptMessageEnd(retObj.stderrData, retObj.exitCode, retObj.stdoutData.length, true, true, EnigmailConstants.UI_PGP_MIME, result);
        resolve(result);
      });
      promise.catch(function(retObj){
        reject(retObj);
      });
    });
  }
}

function getGnuPGAPI() {
  return new GnuPGCryptoAPI();
}
