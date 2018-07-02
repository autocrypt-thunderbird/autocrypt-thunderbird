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

const {
  obtainKeyList, createKeyObj, getPhotoFileFromGnuPG, extractSignatures
} = Cu.import("chrome://enigmail/content/modules/cryptoAPI/gnupg-keylist.jsm");

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
}


function getGnuPGAPI() {
  return new GnuPGCryptoAPI();
}
