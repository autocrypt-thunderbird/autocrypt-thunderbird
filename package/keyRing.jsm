/*global Components: false, btoa: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailKeyRing"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("chrome://enigmail/content/modules/core.jsm"); /*global EnigmailCore: false */
Cu.import("chrome://enigmail/content/modules/log.jsm"); /*global EnigmailLog: false */
Cu.import("chrome://enigmail/content/modules/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("chrome://enigmail/content/modules/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("chrome://enigmail/content/modules/files.jsm"); /*global EnigmailFiles: false */
Cu.import("chrome://enigmail/content/modules/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("chrome://enigmail/content/modules/trust.jsm"); /*global EnigmailTrust: false */
Cu.import("chrome://enigmail/content/modules/armor.jsm"); /*global EnigmailArmor: false */
Cu.import("chrome://enigmail/content/modules/os.jsm"); /*global EnigmailOS: false */
Cu.import("chrome://enigmail/content/modules/time.jsm"); /*global EnigmailTime: false */
Cu.import("chrome://enigmail/content/modules/data.jsm"); /*global EnigmailData: false */
Cu.import("chrome://enigmail/content/modules/subprocess.jsm"); /*global subprocess: false */
Cu.import("chrome://enigmail/content/modules/lazy.jsm"); /*global EnigmailLazy: false */
Cu.import("chrome://enigmail/content/modules/keyObj.jsm"); /*global EnigmailKeyObj: false */
Cu.import("chrome://enigmail/content/modules/timer.jsm"); /*global EnigmailTimer: false */
Cu.import("resource://gre/modules/Services.jsm"); /* global Services: false */
Cu.import("chrome://enigmail/content/modules/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("chrome://enigmail/content/modules/cryptoAPI.jsm"); /*global EnigmailCryptoAPI: false */


const getDialog = EnigmailLazy.loader("enigmail/dialog.jsm", "EnigmailDialog");
const getWindows = EnigmailLazy.loader("enigmail/windows.jsm", "EnigmailWindows");
const getKeyUsability = EnigmailLazy.loader("enigmail/keyUsability.jsm", "EnigmailKeyUsability");


const NS_RDONLY = 0x01;
const NS_WRONLY = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
  "@mozilla.org/network/file-output-stream;1";

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)


let gKeygenProcess = null;
let gKeyListObj = null;
let gKeyIndex = [];
let gSubkeyIndex = [];
let gKeyCheckDone = false;
let gLoadingKeys = false;

/*

  This module operates with a Key Store (array) containing objects with the following properties:

  * keyList [Array] of EnigmailKeyObj

  * keySortList [Array]:  used for quickly sorting the keys
    - userId (in lower case)
    - keyId
    - keyNum
  * trustModel: [String]. One of:
            - p: pgp/classical
            - t: always trust
            - a: auto (:0) (default, currently pgp/classical)
            - T: TOFU
            - TP: TOFU+PGP

*/

const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();

var EnigmailKeyRing = {

  /**
   * Get the complete list of all public keys, optionally sorted by a column
   *
   * @param  win           - optional |object| holding the parent window for displaying error messages
   * @param  sortColumn    - optional |string| containing the column name for sorting. One of:
   *                            userid, keyid, keyidshort, fpr, keytype, validity, trust, expiry
   * @param  sortDirection - |number| 1 = ascending / -1 = descending
   *
   * @return keyListObj    - |object| { keyList, keySortList } (see above)
   */
  getAllKeys: function(win, sortColumn, sortDirection) {
    if (gKeyListObj.keySortList.length === 0) {
      loadKeyList(win, sortColumn, sortDirection);
      getWindows().keyManReloadKeys();
      if (!gKeyCheckDone) {
        gKeyCheckDone = true;
        runKeyUsabilityCheck();
      }
    }
    else {
      if (sortColumn) {
        gKeyListObj.keySortList.sort(getSortFunction(sortColumn.toLowerCase(), gKeyListObj, sortDirection));
      }
    }

    return gKeyListObj;
  },

  /**
   * get a list of all (valid, usable) keys that have a secret key
   *
   * @param Boolean onlyValidKeys: if true, only filter valid usable keys
   *
   * @return Array of KeyObjects containing the found keys (sorted by userId)
   **/

  getAllSecretKeys: function(onlyValidKeys = false) {
    this.getAllKeys(); // ensure keylist is loaded;

    let res = [];

    this.getAllKeys(); // ensure keylist is loaded;

    if (!onlyValidKeys) {
      for (let key of gKeyListObj.keyList) {
        if (key.secretAvailable) res.push(key);
      }
    }
    else {
      for (let key of gKeyListObj.keyList) {
        if (key.secretAvailable && key.keyUseFor.search(/D/) < 0) {
          // key is not disabled and _usable_ for encryption signing and certification
          if (key.keyUseFor.search(/E/) >= 0 &&
            key.keyUseFor.search(/S/) >= 0 &&
            key.keyUseFor.search(/C/) >= 0) {
            res.push(key);
          }
        }
      }
    }

    res.sort(function(a, b) {
      return a.userId == b.userId ? (a.keyId < b.keyId ? -1 : 1) : (a.userId.toLowerCase() < b.userId.toLowerCase() ? -1 : 1);
    });

    return res;
  },


  /**
   * get 1st key object that matches a given key ID or subkey ID
   *
   * @param keyId      - String: key Id with 16 characters (preferred) or 8 characters),
   *                             or fingerprint (40 or 32 characters).
   *                             Optionally preceeded with "0x"
   * @param noLoadKeys - Boolean [optional]: do not try to load the key list first
   *
   * @return Object - found KeyObject or null if key not found
   */
  getKeyById: function(keyId, noLoadKeys) {
    EnigmailLog.DEBUG("keyRing.jsm: getKeyById: " + keyId + "\n");
    let s;

    if (keyId.search(/^0x/) === 0) {
      keyId = keyId.substr(2);
    }

    if (!noLoadKeys) {
      this.getAllKeys(); // ensure keylist is loaded;
    }

    let keyObj = gKeyIndex[keyId];

    if (keyObj === undefined) {
      keyObj = gSubkeyIndex[keyId];
    }

    return keyObj !== undefined ? keyObj : null;
  },

  /**
   * get all key objects that match a given user ID
   *
   * @param searchTerm   - String: a regular expression to match against all UIDs of the keys.
   *                               The search is always performed case-insensitively
   *                               An empty string will return no result
   * @param onlyValidUid - Boolean: if true (default), invalid (e.g. revoked) UIDs are not matched
   *
   * @return Array of KeyObjects with the found keys (array length is 0 if no key found)
   */
  getKeysByUserId: function(searchTerm, onlyValidUid = true) {
    EnigmailLog.DEBUG("keyRing.jsm: getKeysByUserId: '" + searchTerm + "'\n");
    let s = new RegExp(searchTerm, "i");

    let res = [];

    this.getAllKeys(); // ensure keylist is loaded;

    if (searchTerm === "") return res;

    for (let i in gKeyListObj.keyList) {
      let k = gKeyListObj.keyList[i];

      for (let j in k.userIds) {
        if (k.userIds[j].type === "uid" && k.userIds[j].userId.search(s) >= 0) {
          if (!onlyValidUid || (!EnigmailTrust.isInvalid(k.userIds[j].keyTrust))) {
            res.push(k);
            continue;
          }
        }
      }
    }

    return res;
  },

  /**
   * Specialized function for getSecretKeyByUserId() that takes into account
   * the specifics of email addresses in UIDs.
   *
   * @param emailAddr: String - email address to search for without any angulars
   *                            or names
   *
   * @return KeyObject with the found key, or null if no key found
   */
  getSecretKeyByEmail: function(emailAddr) {
    // sanitize email address
    emailAddr = emailAddr.replace(/([\.\[\]\-\\])/g, "\\$1");

    let searchTerm = "(<" + emailAddr + ">| " + emailAddr + "$|^" + emailAddr + "$)";

    return this.getSecretKeyByUserId(searchTerm);
  },

  /**
   * get the "best" possible secret key for a given user ID
   *
   * @param searchTerm   - String: a regular expression to match against all UIDs of the keys.
   *                               The search is always performed case-insensitively
   * @return KeyObject with the found key, or null if no key found
   */
  getSecretKeyByUserId: function(searchTerm) {
    EnigmailLog.DEBUG("keyRing.jsm: getSecretKeyByUserId: '" + searchTerm + "'\n");
    let keyList = this.getKeysByUserId(searchTerm, true);

    let foundKey = null;

    for (let key of keyList) {
      if (key.secretAvailable && key.getEncryptionValidity().keyValid && key.getSigningValidity().keyValid) {
        if (!foundKey) {
          foundKey = key;
        }
        else {
          // prefer RSA or DSA over ECC (long-term: change this once ECC keys are widely supported)
          if (foundKey.algoSym === key.algoSym && foundKey.keySize === key.keySize) {
            if (key.expiryTime > foundKey.expiryTime) foundKey = key;
          }
          else if (foundKey.algoSym.search(/^(DSA|RSA)$/) < 0 && key.algoSym.search(/^(DSA|RSA)$/) === 0) {
            foundKey = key;
          }
          else {
            if (key.getVirtualKeySize() > foundKey.getVirtualKeySize()) foundKey = key;
          }
        }
      }
    }
    return foundKey;
  },

  /**
   * get a list of keys for a given set of (sub-) key IDs
   *
   * @param keyIdList: Array of key IDs
                       OR String, with space-separated list of key IDs
   */
  getKeyListById: function(keyIdList) {
    EnigmailLog.DEBUG("keyRing.jsm: getKeyListById: '" + keyIdList + "'\n");
    let keyArr;
    if (typeof keyIdList === "string") {
      keyArr = keyIdList.split(/ +/);
    }
    else {
      keyArr = keyIdList;
    }

    let ret = [];
    for (let i in keyArr) {
      let r = this.getKeyById(keyArr[i]);
      if (r) ret.push(r);
    }

    return ret;
  },

  importKeyFromFile: function(inputFile, errorMsgObj, importedKeysObj) {
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.importKeyFromFile: fileName=" + inputFile.path + "\n");
    var command = EnigmailGpg.agentPath;
    var args = EnigmailGpg.getStandardArgs(false).concat(["--no-verbose", "--status-fd", "2", "--no-auto-check-trustdb", "--import"]);
    importedKeysObj.value = "";

    var fileName = EnigmailFiles.getEscapedFilename((inputFile.QueryInterface(Ci.nsIFile)).path);

    args.push(fileName);

    var statusFlagsObj = {};
    var statusMsgObj = {};
    var exitCodeObj = {};

    var output = EnigmailExecution.execCmd(command, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.importKeyFromFile: error=" + errorMsgObj.value + "\n");

    var statusMsg = statusMsgObj.value;

    var keyList = [];
    let importedKeys = [];
    let importSum = 0;
    let importUnchanged = 0;

    // IMPORT_RES <count> <no_user_ids> <imported> 0 <unchanged>
    if (statusMsg) {
      let import_res = statusMsg.match(/^IMPORT_RES ([0-9]+) ([0-9]+) ([0-9]+) 0 ([0-9]+)/m);

      if (import_res !== null) {
        // Normal
        importSum = parseInt(import_res[1], 10);
        importUnchanged = parseInt(import_res[4], 10);
        exitCodeObj.value = 0;
        var statusLines = statusMsg.split(/\r?\n/);

        for (let j = 0; j < statusLines.length; j++) {
          var matches = statusLines[j].match(/IMPORT_OK ([0-9]+) (\w+)/);
          if (matches && (matches.length > 2)) {
            if (typeof(keyList[matches[2]]) != "undefined") {
              keyList[matches[2]] |= Number(matches[1]);
            }
            else
              keyList[matches[2]] = Number(matches[1]);

            importedKeys.push(matches[2]);
            EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.importKeyFromFile: imported " + matches[2] + ":" + matches[1] + "\n");
          }
        }

        for (let j in keyList) {
          importedKeysObj.value += j + ":" + keyList[j] + ";";
        }
      }
    }

    if (importedKeys.length > 0) {
      EnigmailKeyRing.updateKeys(importedKeys);
    }
    else if (importSum > importUnchanged) {
      EnigmailKeyRing.clearCache();
    }

    return exitCodeObj.value;
  },


  /**
   * empty the key cache, such that it will get loaded next time it is accessed
   *
   * no input or return values
   */
  clearCache: function() {
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.clearCache\n");
    gKeyListObj = {
      keyList: [],
      keySortList: []
    };

    gKeyIndex = [];
    gSubkeyIndex = [];
  },

  /**
   * Check if the cache is empty
   *
   * @return  Boolean: true: cache cleared
   */
  getCacheEmpty: function() {
    return (gKeyIndex.length === 0);
  },

  /**
   * Get a list of UserIds for a given key.
   * Only the Only UIDs with highest trust level are returned.
   *
   * @param  String  keyId   key, optionally preceeded with 0x
   *
   * @return Array of String: list of UserIds
   */
  getValidUids: function(keyId) {
    let r = [];
    let keyObj = this.getKeyById(keyId);

    if (keyObj) {
      const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
      let hideInvalidUid = true;
      let maxTrustLevel = TRUSTLEVELS_SORTED.indexOf(keyObj.keyTrust);

      if (EnigmailTrust.isInvalid(keyObj.keyTrust)) {
        // pub key not valid (anymore)-> display all UID's
        hideInvalidUid = false;
      }

      for (let i in keyObj.userIds) {
        if (keyObj.userIds[i].type !== "uat") {
          if (hideInvalidUid) {
            let thisTrust = TRUSTLEVELS_SORTED.indexOf(keyObj.userIds[i].keyTrust);
            if (thisTrust > maxTrustLevel) {
              r = [keyObj.userIds[i].userId];
              maxTrustLevel = thisTrust;
            }
            else if (thisTrust === maxTrustLevel) {
              r.push(keyObj.userIds[i].userId);
            }
            // else do not add uid
          }
          else if (!EnigmailTrust.isInvalid(keyObj.userIds[i].keyTrust) || !hideInvalidUid) {
            // UID valid  OR  key not valid, but invalid keys allowed
            r.push(keyObj.userIds[i].userId);
          }
        }
      }
    }

    return r;
  },

  /**
   * Export public and possibly secret key(s) to a file
   *
   * @param includeSecretKey  Boolean  - if true, secret keys are exported
   * @param userId            String   - space or comma separated list of keys to export. Specification by
   *                                     key ID, fingerprint, or userId
   * @param outputFile        String or nsIFile - output file name or Object - or NULL
   * @param exitCodeObj       Object   - o.value will contain exit code
   * @param errorMsgObj       Object   - o.value will contain error message from GnuPG
   *
   * @return String - if outputFile is NULL, the key block data; "" if a file is written
   */
  extractKey: function(includeSecretKey, userId, outputFile, exitCodeObj, errorMsgObj) {
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.extractKey: " + userId + "\n");
    let args = EnigmailGpg.getStandardArgs(true).concat(["-a", "--export"]);

    if (userId) {
      args = args.concat(userId.split(/[ ,\t]+/));
    }

    const cmdErrorMsgObj = {};
    let keyBlock = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, {}, {}, cmdErrorMsgObj);

    if ((exitCodeObj.value === 0) && !keyBlock) {
      exitCodeObj.value = -1;
    }

    if (exitCodeObj.value !== 0) {
      errorMsgObj.value = EnigmailLocale.getString("failKeyExtract");

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    if (includeSecretKey) {

      const secKeyBlock = this.extractSecretKey(false, userId, exitCodeObj, cmdErrorMsgObj);
      if (keyBlock.substr(-1, 1).search(/[\r\n]/) < 0) {
        keyBlock += "\n";
      }
      keyBlock += secKeyBlock;
    }

    if (outputFile) {
      if (!EnigmailFiles.writeFileContents(outputFile, keyBlock, DEFAULT_FILE_PERMS)) {
        exitCodeObj.value = -1;
        errorMsgObj.value = EnigmailLocale.getString("fileWriteFailed", [outputFile]);
      }
      return "";
    }
    return keyBlock;
  },

  /**
   * Export secret key(s) to a file
   *
   * @param minimalKey  Boolean  - if true, reduce key to minimum required
   * @param userId            String   - space or comma separated list of keys to export. Specification by
   *                                     key ID, fingerprint, or userId
   * @param exitCodeObj       Object   - o.value will contain exit code
   * @param errorMsgObj       Object   - o.value will contain error message from GnuPG
   *
   * @return String
   */
  extractSecretKey: function(minimalKey, userId, exitCodeObj, errorMsgObj) {
    let args = EnigmailGpg.getStandardArgs(true);

    if (minimalKey) {
      args.push("--export-options");
      args.push("export-minimal,no-export-attributes");
    }

    args.push("-a");
    args.push("--export-secret-keys");

    if (userId) {
      args = args.concat(userId.split(/[ ,\t]+/));
    }

    let cmdErrorMsgObj = {};
    const secKeyBlock = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, {}, {}, cmdErrorMsgObj);

    if (secKeyBlock) {
      exitCodeObj.value = 0;
    }
    else {
      exitCodeObj.value = -1;
    }

    if (exitCodeObj.value !== 0) {
      errorMsgObj.value = EnigmailLocale.getString("failKeyExtract");

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    return secKeyBlock;
  },

  /**
   * Export the ownertrust database from GnuPG
   * @param outputFile        String or nsIFile - output file name or Object - or NULL
   * @param exitCodeObj       Object   - o.value will contain exit code
   * @param errorMsgObj       Object   - o.value will contain error message from GnuPG
   *
   * @return String - if outputFile is NULL, the key block data; "" if a file is written
   */
  extractOwnerTrust: function(outputFile, exitCodeObj, errorMsgObj) {
    let args = EnigmailGpg.getStandardArgs(true).concat(["--export-ownertrust"]);

    let trustData = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, {}, {}, errorMsgObj);

    if (outputFile) {
      if (!EnigmailFiles.writeFileContents(outputFile, trustData, DEFAULT_FILE_PERMS)) {
        exitCodeObj.value = -1;
        errorMsgObj.value = EnigmailLocale.getString("fileWriteFailed", [outputFile]);
      }
      return "";
    }

    return trustData;
  },

  /**
   * Import the ownertrust database into GnuPG
   * @param inputFile        String or nsIFile - input file name or Object - or NULL
   * @param errorMsgObj       Object   - o.value will contain error message from GnuPG
   *
   * @return exit code
   */
  importOwnerTrust: function(inputFile, errorMsgObj) {
    let args = EnigmailGpg.getStandardArgs(true).concat(["--import-ownertrust"]);

    let exitCodeObj = {};
    try {
      let trustData = EnigmailFiles.readFile(inputFile);
      EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, trustData, exitCodeObj, {}, {}, errorMsgObj);
    }
    catch (ex) {}

    return exitCodeObj.value;
  },

  /**
   * import key from provided key data
   *
   * @param parent          nsIWindow
   * @param isInteractive   Boolean  - if true, display confirmation dialog
   * @param keyBlock        String   - data containing key
   * @param keyId           String   - key ID expected to import (no meaning)
   * @param errorMsgObj     Object   - o.value will contain error message from GnuPG
   * @param importedKeysObj Object   - [OPTIONAL] o.value will contain an array of the FPRs imported
   *
   * @return Integer -  exit code:
   *      ExitCode == 0  => success
   *      ExitCode > 0   => error
   *      ExitCode == -1 => Cancelled by user
   */
  importKey: function(parent, isInteractive, keyBlock, keyId, errorMsgObj, importedKeysObj) {
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.importKey: id=" + keyId + ", " + isInteractive + "\n");

    const beginIndexObj = {};
    const endIndexObj = {};
    const blockType = EnigmailArmor.locateArmoredBlock(keyBlock, 0, "", beginIndexObj, endIndexObj, {});
    if (!blockType) {
      errorMsgObj.value = EnigmailLocale.getString("noPGPblock");
      return 1;
    }

    if (blockType.search(/^(PUBLIC|PRIVATE) KEY BLOCK$/) !== 0) {
      errorMsgObj.value = EnigmailLocale.getString("notFirstBlock");
      return 1;
    }

    const pgpBlock = keyBlock.substr(beginIndexObj.value,
      endIndexObj.value - beginIndexObj.value + 1);

    if (isInteractive) {
      if (!(getDialog().confirmDlg(parent, EnigmailLocale.getString("importKeyConfirm"), EnigmailLocale.getString("keyMan.button.import")))) {
        errorMsgObj.value = EnigmailLocale.getString("failCancel");
        return -1;
      }
    }

    const args = EnigmailGpg.getStandardArgs(false).concat(["--no-verbose", "--status-fd", "2", "--no-auto-check-trustdb", "--import"]);

    const exitCodeObj = {};
    const statusMsgObj = {};

    EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, pgpBlock, exitCodeObj, {}, statusMsgObj, errorMsgObj);

    const statusMsg = statusMsgObj.value;

    if (!importedKeysObj) {
      importedKeysObj = {};
    }
    importedKeysObj.value = [];

    let exitCode = 1;
    if (statusMsg && (statusMsg.search(/^IMPORT_RES /m) > -1)) {
      exitCode = 0;
      // Normal return
      if (statusMsg.search(/^IMPORT_OK /m) > -1) {
        let l = statusMsg.split(/\r|\n/);
        for (let i = 0; i < l.length; i++) {
          const matches = l[i].match(/^(IMPORT_OK [0-9]+ )(([0-9a-fA-F]{8}){2,5})/);
          if (matches && (matches.length > 2)) {
            EnigmailLog.DEBUG("enigmail.js: Enigmail.importKey: IMPORTED 0x" + matches[2] + "\n");
            importedKeysObj.value.push(matches[2]);
          }
        }

        if (importedKeysObj.value.length > 0) {
          EnigmailKeyRing.updateKeys(importedKeysObj.value);
        }
      }
    }

    return exitCode;
  },

  /**
   * Extract a photo ID from a key, store it as file and return the file object.
   * @keyId:       String  - Key ID
   * @photoNumber: Number  - number of the photo on the key, starting with 0
   * @exitCodeObj: Object  - value holds exitCode (0 = success)
   * @errorMsgObj: Object  - value holds errorMsg
   *
   * @return: nsIFile object or null in case no data / error.
   */
  getPhotoFile: function(keyId, photoNumber, exitCodeObj, errorMsgObj) {
    EnigmailLog.DEBUG("keyRing.js: EnigmailKeyRing.getPhotoFile, keyId=" + keyId + " photoNumber=" + photoNumber + "\n");

    const GPG_ADDITIONAL_OPTIONS = ["--no-secmem-warning", "--no-verbose", "--no-auto-check-trustdb",
      "--batch", "--no-tty", "--no-verbose", "--status-fd", "1", "--attribute-fd", "2",
      "--fixed-list-mode", "--list-keys", keyId
    ];
    const args = EnigmailGpg.getStandardArgs(false).concat(GPG_ADDITIONAL_OPTIONS);

    const photoDataObj = {};
    const outputTxt = EnigmailExecution.simpleExecCmd(EnigmailGpg.agentPath, args, exitCodeObj, photoDataObj);

    if (!outputTxt) {
      exitCodeObj.value = -1;
      return null;
    }

    if (EnigmailOS.isDosLike && EnigmailGpg.getGpgFeature("windows-photoid-bug")) {
      // workaround for error in gpg
      photoDataObj.value = photoDataObj.value.replace(/\r\n/g, "\n");
    }

    // [GNUPG:] ATTRIBUTE A053069284158FC1E6770BDB57C9EB602B0717E2 2985
    let foundPicture = -1;
    let skipData = 0;
    let imgSize = -1;
    const statusLines = outputTxt.split(/[\n\r+]/);

    for (let i = 0; i < statusLines.length; i++) {
      const matches = statusLines[i].match(/\[GNUPG:\] ATTRIBUTE ([A-F\d]+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)/);
      if (matches && matches[3] == "1") {
        // attribute is an image
        foundPicture++;
        if (foundPicture === photoNumber) {
          imgSize = Number(matches[2]);
          break;
        }
        else {
          skipData += Number(matches[2]);
        }
      }
    }

    if (foundPicture >= 0 && foundPicture === photoNumber) {
      if (photoDataObj.value.search(/^gpg: /) === 0) {
        // skip disturbing gpg output
        let i = photoDataObj.value.search(/\n/) + 1;
        skipData += i;
      }

      const pictureData = photoDataObj.value.substr(16 + skipData, imgSize);
      if (!pictureData.length) {
        return null;
      }

      try {
        const flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;
        const picFile = EnigmailFiles.getTempDirObj();

        picFile.append(keyId + ".jpg");
        picFile.createUnique(picFile.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);

        const fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
        fileStream.init(picFile, flags, DEFAULT_FILE_PERMS, 0);
        if (fileStream.write(pictureData, pictureData.length) !== pictureData.length) {
          fileStream.close();
          throw Components.results.NS_ERROR_FAILURE;
        }

        fileStream.flush();
        fileStream.close();

        // delete picFile upon exit
        let extAppLauncher = Cc["@mozilla.org/mime;1"].getService(Ci.nsPIExternalAppLauncher);
        extAppLauncher.deleteTemporaryFileOnExit(picFile);
        return picFile;
      }
      catch (ex) {
        exitCodeObj.value = -1;
        return null;
      }
    }
    return null;
  },

  isGeneratingKey: function() {
    return gKeygenProcess !== null;
  },

  /**
   * Generate a new key pair with GnuPG
   *
   * @name:       String     - name part of UID
   * @comment:    String     - comment part of UID (brackets are added)
   * @comment:    String     - email part of UID (<> will be added)
   * @expiryDate: Number     - Unix timestamp of key expiry date; 0 if no expiry
   * @keyLength:  Number     - size of key in bytes (e.g 4096)
   * @keyType:    String     - RSA or ECC
   * @passphrase: String     - password; null if no password
   * @listener:   Object     - {
   *                             function onDataAvailable(data) {...},
   *                             function onStopRequest(exitCode) {...}
   *                           }
   *
   * @return: handle to process
   */
  generateKey: function(name, comment, email, expiryDate, keyLength, keyType,
    passphrase, listener) {
    EnigmailLog.WRITE("keyRing.jsm: generateKey:\n");

    if (EnigmailKeyRing.isGeneratingKey()) {
      // key generation already ongoing
      throw Components.results.NS_ERROR_FAILURE;
    }

    const args = EnigmailGpg.getStandardArgs(true).concat(["--gen-key"]);

    EnigmailLog.CONSOLE(EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args));

    let inputData = "%echo Generating key\nKey-Type: ";

    switch (keyType) {
      case "RSA":
        inputData += "RSA\nKey-Usage: sign,auth\nKey-Length: " + keyLength;
        inputData += "\nSubkey-Type: RSA\nSubkey-Usage: encrypt\nSubkey-Length: " + keyLength + "\n";
        break;
      case "ECC":
        inputData += "EDDSA\nKey-Curve: Ed25519\nKey-Usage: sign\n";
        inputData += "Subkey-Type: ECDH\nSubkey-Curve: Curve25519\nSubkey-Usage: encrypt\n";
        break;
      default:
        return null;
    }

    if (name.replace(/ /g, "").length) {
      inputData += "Name-Real: " + name + "\n";
    }
    if (comment && comment.replace(/ /g, "").length) {
      inputData += "Name-Comment: " + comment + "\n";
    }
    inputData += "Name-Email: " + email + "\n";
    inputData += "Expire-Date: " + String(expiryDate) + "\n";

    EnigmailLog.CONSOLE(inputData + " \n");

    if (passphrase.length) {
      inputData += "Passphrase: " + passphrase + "\n";
    }
    else {
      if (EnigmailGpg.getGpgFeature("genkey-no-protection")) {
        inputData += "%echo no-protection\n";
        inputData += "%no-protection\n";
      }
    }

    inputData += "%commit\n%echo done\n";

    let proc = null;

    try {
      proc = subprocess.call({
        command: EnigmailGpg.agentPath,
        arguments: args,
        environment: EnigmailCore.getEnvList(),
        charset: null,
        stdin: function(pipe) {
          pipe.write(inputData);
          pipe.close();
        },
        stderr: function(data) {
          listener.onDataAvailable(data);
        },
        done: function(result) {
          gKeygenProcess = null;
          try {
            if (result.exitCode === 0) {
              EnigmailKeyRing.clearCache();
            }
            listener.onStopRequest(result.exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    }
    catch (ex) {
      EnigmailLog.ERROR("keyRing.jsm: generateKey: subprocess.call failed with '" + ex.toString() + "'\n");
      throw ex;
    }

    gKeygenProcess = proc;

    EnigmailLog.DEBUG("keyRing.jsm: generateKey: subprocess = " + proc + "\n");

    return proc;
  },

  /**
   * try to find valid key for encryption to passed email address
   *
   * @param details if not null returns error in details.msg
   *
   * @return: found key ID (without leading "0x") or null
   */
  getValidKeyForRecipient: function(emailAddr, minTrustLevelIndex, details) {
    EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient(): emailAddr=\"" + emailAddr + "\"\n");
    const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
    const fullTrustIndex = TRUSTLEVELS_SORTED.indexOf("f");

    emailAddr = emailAddr.toLowerCase();
    var embeddedEmailAddr = "<" + emailAddr + ">";

    // note: we can't take just the first matched because we might have faked keys as duplicates
    var foundKeyId = null;
    var foundTrustLevel = null;
    var foundKeyTrustIndex = null;

    let k = this.getAllKeys(null, "validity", -1);
    let keyList = k.keyList;
    let keySortList = k.keySortList;

    // **** LOOP to check against each key
    // - note: we have sorted the keys according to validity
    //         to abort the loop as soon as we reach keys that are not valid enough
    for (var idx = 0; idx < keySortList.length; idx++) {
      var keyObj = keyList[keySortList[idx].keyNum];
      var keyTrust = keyObj.keyTrust;
      var keyTrustIndex = TRUSTLEVELS_SORTED.indexOf(keyTrust);
      //EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  check key " + keyObj.keyId + "\n");

      // key trust (our sort criterion) too low?
      // => *** regular END of the loop
      if (keyTrustIndex < minTrustLevelIndex) {
        if (!foundKeyId) {
          if (details) {
            details.msg = "ProblemNoKey";
          }
          let msg = "no key with enough trust level for '" + emailAddr + "' found";
          EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  " + msg + "\n");
        }
        return foundKeyId; // **** regular END OF LOOP (return NULL or found single key)
      }

      // key valid for encryption?
      if (keyObj.keyUseFor.indexOf("E") < 0) {
        //EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  skip key " + keyObj.keyId + " (not provided for encryption)\n");
        continue; // not valid for encryption => **** CONTINUE the LOOP
      }
      // key disabled?
      if (keyObj.keyUseFor.indexOf("D") >= 0) {
        //EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  skip key " + keyObj.keyId + " (disabled)\n");
        continue; // disabled => **** CONTINUE the LOOP
      }

      // check against the user ID
      var userId = keyObj.userId.toLowerCase();
      if (userId && (userId == emailAddr || userId.indexOf(embeddedEmailAddr) >= 0)) {
        if (keyTrustIndex < minTrustLevelIndex) {
          EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  matching key=" + keyObj.keyId + " found but not enough trust\n");
        }
        else {
          // key with enough trust level found
          EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  key=" + keyObj.keyId + " keyTrust=\"" + keyTrust + "\" found\n");

          // immediately return if a fully or ultimately trusted key is found
          // (faked keys should not be an issue here, so we don't have to check other keys)
          if (keyTrustIndex >= fullTrustIndex) {
            return keyObj.keyId;
          }

          if (foundKeyId != keyObj.keyId) {
            // new matching key found (note: might find same key via subkeys)
            if (foundKeyId) {
              // different matching keys found
              if (foundKeyTrustIndex > keyTrustIndex) {
                return foundKeyId; // OK, previously found key has higher trust level
              }
              // error because we have two keys with same trust level
              // => let the user decide (to prevent from using faked keys with default trust level)
              if (details) {
                details.msg = "ProblemMultipleKeys";
              }
              let msg = "multiple matching keys with same trust level found for '" + emailAddr + "' ";
              EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  " + msg +
                " trustLevel=\"" + keyTrust + "\" (0x" + foundKeyId + " and 0x" + keyObj.keyId + ")\n");
              return null;
            }
            // save found key to compare with other matching keys (handling of faked keys)
            foundKeyId = keyObj.keyId;
            foundKeyTrustIndex = keyTrustIndex;
          }
          continue; // matching key found (again) => **** CONTINUE the LOOP (don't check Sub-UserIDs)
        }
      }

      // check against the sub user ID
      // (if we are here, the primary user ID didn't match)
      // - Note: sub user IDs have NO owner trust
      for (var subUidIdx = 1; subUidIdx < keyObj.userIds.length; subUidIdx++) {
        var subUidObj = keyObj.userIds[subUidIdx];
        var subUserId = subUidObj.userId.toLowerCase();
        var subUidTrust = subUidObj.keyTrust;
        var subUidTrustIndex = TRUSTLEVELS_SORTED.indexOf(subUidTrust);
        //EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  check subUid " + subUidObj.keyId + "\n");

        if (subUserId && (subUserId == emailAddr || subUserId.indexOf(embeddedEmailAddr) >= 0)) {
          if (subUidTrustIndex < minTrustLevelIndex) {
            EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  matching subUid=" + keyObj.keyId + " found but not enough trust\n");
          }
          else {
            // subkey with enough trust level found
            EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  matching subUid in key=" + keyObj.keyId + " keyTrust=\"" + keyTrust + "\" found\n");

            if (keyTrustIndex >= fullTrustIndex) {
              // immediately return if a fully or ultimately trusted key is found
              // (faked keys should not be an issue here, so we don't have to check other keys)
              return keyObj.keyId;
            }

            if (foundKeyId != keyObj.keyId) {
              // new matching key found (note: might find same key via different subkeys)
              if (foundKeyId) {
                // different matching keys found
                if (foundKeyTrustIndex > subUidTrustIndex) {
                  return foundKeyId; // OK, previously found key has higher trust level
                }
                // error because we have two keys with same trust level
                // => let the user decide (to prevent from using faked keys with default trust level)
                if (details) {
                  details.msg = "ProblemMultipleKeys";
                }
                let msg = "multiple matching keys with same trust level found for '" + emailAddr + "' ";
                EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  " + msg +
                  " trustLevel=\"" + keyTrust + "\" (0x" + foundKeyId + " and 0x" + keyObj.keyId + ")\n");
                return null;
              }
              // save found key to compare with other matching keys (handling of faked keys)
              foundKeyId = keyObj.keyId;
              foundKeyTrustIndex = subUidTrustIndex;
            }
          }
        }
      }

    } // **** LOOP to check against each key

    if (!foundKeyId) {
      EnigmailLog.DEBUG("keyRing.jsm: getValidKeyForRecipient():  no key for '" + emailAddr + "' found\n");
    }
    return foundKeyId;
  },

  /**
   *  Determine the key ID for a set of given addresses
   *
   * @param addresses: Array of String - email addresses
   * @param minTrustLevel: String      - f for Fully trusted keys / ? for any valid key
   * @param details:  Object           - holds details for invalid keys:
   *                                      - errArray: {
   *                                       * addr: email addresses
   *                                       * msg:  related error
   *                                       }
   * @param resultingArray: Array of String - list of found key IDs
   *
   * @return Boolean: true if at least one key missing; false otherwise
   */
  getValidKeysForAllRecipients: function(addresses, minTrustLevel, details, resultingArray) {

    let minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf(minTrustLevel);

    // check whether each address is or has a key:
    let keyMissing = false;
    if (details) {
      details.errArray = [];
    }
    for (let i = 0; i < addresses.length; i++) {
      let addr = addresses[i];
      // try to find current address in key list:
      var found = false;
      var errMsg = null;
      if (addr.indexOf('@') >= 0) {
        // try email match:
        var addrErrDetails = {};
        let keyId = this.getValidKeyForRecipient(addr, minTrustLevelIndex, addrErrDetails);
        if (details && addrErrDetails.msg) {
          errMsg = addrErrDetails.msg;
        }
        if (keyId) {
          found = true;
          resultingArray.push("0x" + keyId.toUpperCase());
        }
      }
      else {
        // try key match:
        var keyObj = this.getKeyById(addr);

        if (keyObj) {
          // if found, check whether the trust level is enough
          if (TRUSTLEVELS_SORTED.indexOf(keyObj.keyTrust) >= minTrustLevelIndex) {
            found = true;
            resultingArray.push("0x" + keyObj.keyId.toUpperCase());
          }
        }
      }
      if (!found) {
        // no key for this address found
        keyMissing = true;
        if (details) {
          if (!errMsg) {
            errMsg = "ProblemNoKey";
          }
          var detailsElem = {};
          detailsElem.addr = addr;
          detailsElem.msg = errMsg;
          details.errArray.push(detailsElem);
        }
        EnigmailLog.DEBUG("keyRing.jsm: doValidKeysForAllRecipients(): return null (no single valid key found for=\"" + addr + "\" with minTrustLevel=\"" + minTrustLevel + "\")\n");
      }
    }
    return keyMissing;
  },

  /**
   * Rebuild the quick access search indexes after the key list was loaded
   */
  rebuildKeyIndex: function() {
    gKeyIndex = [];
    gSubkeyIndex = [];

    for (let i in gKeyListObj.keyList) {
      let k = gKeyListObj.keyList[i];
      gKeyIndex[k.keyId] = k;
      gKeyIndex[k.fpr] = k;
      gKeyIndex[k.keyId.substr(-8, 8)] = k;

      // add subkeys
      for (let j in k.subKeys) {
        gSubkeyIndex[k.subKeys[j].keyId] = k;
      }
    }
  },

  /**
   * Update specific keys in the key cache. If the key objects don't exist yet,
   * they will be created
   *
   * @param keys: Array of String - key IDs or fingerprints
   */
  updateKeys: function(keys) {
    EnigmailLog.DEBUG("keyRing.jsm: updateKeys(" + keys.join(",") + ")\n");
    let uniqueKeys = [...new Set(keys)]; // make key IDs unique

    deleteKeysFromCache(uniqueKeys);

    if (gKeyListObj.keyList.length > 0) {
      loadKeyList(null, null, 1, uniqueKeys);
    }
    else {
      loadKeyList(null, null, 1);
    }

    getWindows().keyManReloadKeys();
  }
}; //  EnigmailKeyRing


/************************ INTERNAL FUNCTIONS ************************/

function sortByUserId(keyListObj, sortDirection) {
  return function(a, b) {
    return (a.userId < b.userId) ? -sortDirection : sortDirection;
  };
}

const sortFunctions = {
  keyid: function(keyListObj, sortDirection) {
    return function(a, b) {
      return (a.keyId < b.keyId) ? -sortDirection : sortDirection;
    };
  },

  keyidshort: function(keyListObj, sortDirection) {
    return function(a, b) {
      return (a.keyId.substr(-8, 8) < b.keyId.substr(-8, 8)) ? -sortDirection : sortDirection;
    };
  },

  fpr: function(keyListObj, sortDirection) {
    return function(a, b) {
      return (keyListObj.keyList[a.keyNum].fpr < keyListObj.keyList[b.keyNum].fpr) ? -sortDirection : sortDirection;
    };
  },

  keytype: function(keyListObj, sortDirection) {
    return function(a, b) {
      return (keyListObj.keyList[a.keyNum].secretAvailable < keyListObj.keyList[b.keyNum].secretAvailable) ? -sortDirection : sortDirection;
    };
  },

  validity: function(keyListObj, sortDirection) {
    return function(a, b) {
      return (EnigmailTrust.trustLevelsSorted().indexOf(EnigmailTrust.getTrustCode(keyListObj.keyList[a.keyNum])) < EnigmailTrust.trustLevelsSorted().indexOf(EnigmailTrust.getTrustCode(
        keyListObj.keyList[b.keyNum]))) ? -sortDirection : sortDirection;
    };
  },

  trust: function(keyListObj, sortDirection) {
    return function(a, b) {
      return (EnigmailTrust.trustLevelsSorted().indexOf(keyListObj.keyList[a.keyNum].ownerTrust) < EnigmailTrust.trustLevelsSorted().indexOf(keyListObj.keyList[b.keyNum].ownerTrust)) ?
        -
        sortDirection : sortDirection;
    };
  },

  expiry: function(keyListObj, sortDirection) {
    return function(a, b) {
      return (keyListObj.keyList[a.keyNum].expiryTime < keyListObj.keyList[b.keyNum].expiryTime) ? -sortDirection : sortDirection;
    };
  }
};

function getSortFunction(type, keyListObj, sortDirection) {
  return (sortFunctions[type] || sortByUserId)(keyListObj, sortDirection);
}

/**
 * Load the key list into memory and return it sorted by a specified column
 *
 * @param win        - |object|  holding the parent window for displaying error messages
 * @param sortColumn - |string|  containing the column name for sorting. One of:
 *                               userid, keyid, keyidshort, fpr, keytype, validity, trust, expiry.
 *                              Null will sort by userid.
 * @param sortDirection - |number| 1 = ascending / -1 = descending
 * @param onlyKeys   - |array| of Strings: if defined, only (re-)load selected key IDs
 *
 * no return value
 */
function loadKeyList(win, sortColumn, sortDirection, onlyKeys = null) {
  EnigmailLog.DEBUG("keyRing.jsm: loadKeyList( " + onlyKeys + ")\n");

  if (gLoadingKeys) {
    waitForKeyList();
    return;
  }
  gLoadingKeys = true;

  try {
    const cApi = EnigmailCryptoAPI();
    cApi.getKeys(onlyKeys)
      .then(keyList => {
        createAndSortKeyList(keyList, sortColumn, sortDirection, onlyKeys === null);
        gLoadingKeys = false;

      })
      .catch(e => {
        EnigmailLog.ERROR(`keyRing.jsm: loadKeyList: error ${e}\n`);
        gLoadingKeys = false;
      });
    waitForKeyList();
  }
  catch (ex) {
    EnigmailLog.ERROR("keyRing.jsm: loadKeyList: exception: " + ex.toString());
  }
}

/**
 * Update the global key sort-list (quick index to keys)
 *
 * no return value
 */
function updateSortList() {
  gKeyListObj.keySortList = [];
  for (let i = 0; i < gKeyListObj.keyList.length; i++) {
    let keyObj = gKeyListObj.keyList[i];
    gKeyListObj.keySortList.push({
      userId: keyObj.userId.toLowerCase(),
      keyId: keyObj.keyId,
      fpr: keyObj.fpr,
      keyNum: i
    });
  }

}


/**
 * Delete a set of keys from the key cache. Does not rebuild key indexes.
 * Not found keys are skipped.
 *
 * @param keyList: Array of Strings: key IDs (or fpr) to delete
 *
 * @return Array of deleted key objects
 */

function deleteKeysFromCache(keyList) {
  EnigmailLog.DEBUG("keyRing.jsm: deleteKeysFromCache(" + keyList.join(",") + ")\n");

  let deleted = [];
  let foundKeys = [];
  for (let keyId of keyList) {
    let k = EnigmailKeyRing.getKeyById(keyId, true);
    if (k) {
      foundKeys.push(k);
    }
  }

  for (let k of foundKeys) {
    let foundIndex = -1;
    for (let i = 0; i < gKeyListObj.keyList.length; i++) {
      if (gKeyListObj.keyList[i].fpr == k.fpr) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex >= 0) {
      gKeyListObj.keyList.splice(foundIndex, 1);
      deleted.push(k);
    }
  }

  return deleted;
}

function createAndSortKeyList(keyList, sortColumn, sortDirection, resetKeyCache) {
  EnigmailLog.DEBUG("keyRing.jsm: createAndSortKeyList()\n");

  if (typeof sortColumn !== "string") sortColumn = "userid";
  if (!sortDirection) sortDirection = 1;

  if ((!("keyList" in gKeyListObj)) || (resetKeyCache)) {
    gKeyListObj.keyList = [];
    gKeyListObj.keySortList = [];
    gKeyListObj.trustModel = "?";
  }

  gKeyListObj.keyList = gKeyListObj.keyList.concat(keyList.map(k => {
    return new EnigmailKeyObj(k);
  }));

  // update the quick index for sorting keys
  updateSortList();

  // create a hash-index on key ID (8 and 16 characters and fingerprint)
  // in a single array

  EnigmailKeyRing.rebuildKeyIndex();

  gKeyListObj.keySortList.sort(getSortFunction(sortColumn.toLowerCase(), gKeyListObj, sortDirection));
}


function runKeyUsabilityCheck() {
  EnigmailLog.DEBUG("keyRing.jsm: runKeyUsabilityCheck()\n");

  EnigmailTimer.setTimeout(function _f() {
    try {
      let msg = getKeyUsability().keyExpiryCheck();

      if (msg && msg.length > 0) {
        getDialog().info(null, msg);
      }
      else {
        getKeyUsability().checkOwnertrust();
      }
    }
    catch (ex) {
      EnigmailLog.DEBUG("keyRing.jsm: runKeyUsabilityCheck: exception " + ex.message + "\n" + ex.stack + "\n");
    }

  }, 60 * 1000); // 1 minute
}

function waitForKeyList() {
  let mainThread = Services.tm.mainThread;
  while (gLoadingKeys)
    mainThread.processNextEvent(true);
}


EnigmailKeyRing.clearCache();
