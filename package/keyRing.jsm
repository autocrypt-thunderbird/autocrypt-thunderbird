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

Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/trust.jsm"); /*global EnigmailTrust: false */
Cu.import("resource://enigmail/armor.jsm"); /*global EnigmailArmor: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/time.jsm"); /*global EnigmailTime: false */
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("resource://enigmail/lazy.jsm"); /*global EnigmailLazy: false */
Cu.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */
Cu.import("resource://gre/modules/Services.jsm"); /* global Services: false */
Cu.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */

const getDialog = EnigmailLazy.loader("enigmail/dialog.jsm", "EnigmailDialog");
const getWindows = EnigmailLazy.loader("enigmail/windows.jsm", "EnigmailWindows");
const getKeyUsability = EnigmailLazy.loader("enigmail/keyUsability.jsm", "EnigmailKeyUsability");
const getOpenPGP = EnigmailLazy.loader("enigmail/openpgp.jsm", "EnigmailOpenPGP");


const NS_RDONLY = 0x01;
const NS_WRONLY = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
  "@mozilla.org/network/file-output-stream;1";

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const ENTRY_ID = 0;
const KEY_TRUST_ID = 1;
const KEY_SIZE_ID = 2;
const KEY_ALGO_ID = 3;
const KEY_ID = 4;
const CREATED_ID = 5;
const EXPIRY_ID = 6;
const UID_ID = 7;
const OWNERTRUST_ID = 8;
const USERID_ID = 9;
const SIG_TYPE_ID = 10;
const KEY_USE_FOR_ID = 11;

const UNKNOWN_SIGNATURE = "[User ID not found]";

const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;
const KEYTYPE_ECC = 3;

const ALGO_SYMBOL = {
  1: "RSA",
  2: "RSA",
  3: "RSA",
  16: "ELG",
  17: "DSA",
  18: "ECDH",
  19: "ECDSA",
  20: "ELG",
  22: "EDDSA"
};

let gKeygenProcess = null;
let gKeyListObj = null;
let gKeyIndex = [];
let gSubkeyIndex = [];
let gKeyCheckDone = false;
let gLoadingKeys = false;

/*

  This module operates with a Key Store (array) containing objects with the following properties:

  * keyList [Array] of |KeyObject|:
    - keyId           - 16 digits (8-byte) public key ID (/not/ preceeded with 0x)
    - userId          - main user ID
    - fpr             - fingerprint
    - fprFormatted    - a formatted version of the fingerprint followin the scheme .... .... ....
    - expiry          - Expiry date as printable string
    - expiryTime      - Expiry time as seconds after 01/01/1970
    - created         - Key creation date as printable string
    - keyTrust        - key trust code as provided by GnuPG (calculated key validity)
    - keyUseFor       - key usage type as provided by GnuPG (key capabilities)
    - ownerTrust      - owner trust as provided by GnuPG
    - photoAvailable  - [Boolean] true if photo is available
    - secretAvailable - [Boolean] true if secret key is available
    - algorithm       - public key algorithm type (number)
    - algoSym         - public key algorithm type (String, e.g. RSA)
    - keySize         - size of public key
    - type            - "pub" or "grp"
    - userIds  - [Array]: - Contains ALL UIDs (including the primary UID)
                      * userId     - User ID
                      * keyTrust   - trust level of user ID
                      * uidFpr     - fingerprint of the user ID
                      * type       - one of "uid" (regular user ID), "uat" (photo)
                      * uatNum     - photo number (starting with 0 for each key)
    - subKeys     - [Array]:
                      * keyId      - subkey ID (16 digits (8-byte))
                      * expiry     - Expiry date as printable string
                      * expiryTime - Expiry time as seconds after 01/01/1970
                      * created    - Key creation date as printable string
                      * keyTrust   - key trust code as provided by GnuPG
                      * keyUseFor  - key usage type as provided by GnuPG
                      * algorithm  - subkey algorithm type (number)
                      * algoSym    - subkey algorithm type (String, e.g. RSA)
                      * keySize    - subkey size
                      * type       -  "sub"

    - signatures  - [Array]: list of signature objects
                      * userId
                      * uidLabel
                      * created
                      * fpr
                      * sigList: Array of object: { userId, created, signerKeyId, sigType, sigKnown }
    - methods:
       * hasSubUserIds
       * getKeyExpiry
       * getEncryptionValidity
       * getSigningValidity
       * getPubKeyValidity
       * clone
       * getMinimalPubKey
       * getVirtualKeySize

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
    var args = EnigmailGpg.getStandardArgs(false).concat(["--status-fd", "2", "--no-auto-check-trustdb", "--import"]);
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
   * Get groups defined in gpg.conf in the same structure as KeyObject
   *
   * @return Array of KeyObject, with type = "grp"
   */
  getGroups: function() {
    let groups = EnigmailGpg.getGpgGroups();

    let r = [];
    for (var i = 0; i < groups.length; i++) {

      let keyObj = new KeyObject(["grp"]);
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
   * @param importedKeysObj Object   - [OPTIONAL] o.value will contain an array of the key IDs imported
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

    const args = EnigmailGpg.getStandardArgs(false).concat(["--status-fd", "2", "--no-auto-check-trustdb", "--import"]);

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

    const args = EnigmailGpg.getStandardArgs(false).
    concat(["--no-secmem-warning", "--no-verbose", "--no-auto-check-trustdb",
      "--batch", "--no-tty", "--status-fd", "1", "--attribute-fd", "2",
      "--fixed-list-mode", "--list-keys", keyId
    ]);

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
          throw Components.results.NS_ERROR_FAILURE;
        }

        fileStream.flush();
        fileStream.close();
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
   * @keyType:    Number     - 1 = DSA / 2 = RSA
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
      case KEYTYPE_DSA:
        inputData += "DSA\nKey-Length: " + keyLength + "\nSubkey-Type: 16\nSubkey-Length: " + keyLength + "\n";
        break;
      case KEYTYPE_RSA:
        inputData += "RSA\nKey-Usage: sign,auth\nKey-Length: " + keyLength;
        inputData += "\nSubkey-Type: RSA\nSubkey-Usage: encrypt\nSubkey-Length: " + keyLength + "\n";
        break;
      case KEYTYPE_ECC:
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

/**
 * returns the output of --with-colons --list[-secret]-keys
 */
function getUserIdList(secretOnly, exitCodeObj, statusFlagsObj, errorMsgObj) {

  let args = EnigmailGpg.getStandardArgs(true);

  if (secretOnly) {
    args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"]);
  }
  else {
    args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-keys"]);
  }

  statusFlagsObj.value = 0;

  const cmdErrorMsgObj = {};
  let listText = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, cmdErrorMsgObj);

  if (!(statusFlagsObj.value & EnigmailConstants.BAD_SIGNATURE)) {
    // ignore exit code as recommended by GnuPG authors
    exitCodeObj.value = 0;
  }

  if (exitCodeObj.value !== 0) {
    errorMsgObj.value = EnigmailLocale.getString("badCommand");
    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n" + EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args);
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    return "";
  }

  listText = listText.replace(/(\r\n|\r)/g, "\n");

  return listText;
}

/**
 * Get key list from GnuPG. If the keys may be pre-cached already
 *
 * @param win        - Object      : parent window for displaying error messages
 * @param secretOnly - Boolean     : true: get secret keys / false: get public keys
 * @param onlyKeys   - Array of String: only load data for specified key IDs
 *
 * @return Promise(Array of : separated key list entries as specified in GnuPG doc/DETAILS)
 */
function obtainKeyList(win, secretOnly, onlyKeys = null) {
  return new Promise((resolve, reject) => {
    EnigmailLog.DEBUG("keyRing.jsm: obtainKeyList\n");

    let args = EnigmailGpg.getStandardArgs(true);

    if (secretOnly) {
      args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"]);
    }
    else {
      args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-keys"]);
    }

    if (onlyKeys) {
      args = args.concat(onlyKeys);
    }

    let statusFlagsObj = {};
    let keyListStr = "";
    let listener = {
      stdout: data => {
        keyListStr += data;
      },
      stderr: data => {},
      done: exitCode => {
        resolve(keyListStr.split(/\n/));
      }
    };
    EnigmailExecution.execStart(EnigmailGpg.agentPath, args, false, win, listener, statusFlagsObj);
  });
}

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
 * Return string with all colon-separated data of key list entry of given key.
 * - key may be pub or sub key.
 *
 * @param  String  keyId of 8 or 16 chars key with optionally leading 0x
 * @return String  entry of first found user IDs with keyId or null if none
 */
function getKeyListEntryOfKey(keyId) {
  keyId = keyId.replace(/^0x/, "");

  let statusFlags = {};
  let errorMsg = {};
  let exitCodeObj = {};
  let listText = getUserIdList(false, exitCodeObj, statusFlags, errorMsg);

  // listText contains lines such as:
  // tru::0:1407688184:1424970931:3:1:5
  // pub:f:1024:17:D581C6F8EBB80E50:1107251639:::-:::scESC:
  // fpr:::::::::492A198AEA5EBE5574A1CE00D581C6F8EBB80E50:
  // uid:f::::1107251639::2D505D1F6E744365B3B35FF11F32A19779E3A417::Giosue Vitaglione <gvi@whitestein.com>:
  // sub:f:2048:16:2223D7E0301A66C6:1107251647::::::e:

  // search for key or subkey
  let regexKey = new RegExp("^(pub|sub):[^:]*:[^:]*:[^:]*:[A-Fa-f0-9]*" + keyId + ":", "m");
  let foundPos = listText.search(regexKey);
  if (foundPos < 0) {
    return null;
  }

  // find area of key entries in key list
  // note: if subkey matches, key entry starts before
  let regexPub = new RegExp("^pub:", "gm");
  let startPos;

  if (listText[foundPos] == "p") { // ^pub:
    // KEY matches
    startPos = foundPos;
  }
  else {
    // SUBKEY matches
    // search for pub entry right before sub entry
    startPos = 0;
    let match = regexPub.exec(listText.substr(0, foundPos));
    while (match && match.index < foundPos) {
      startPos = match.index;
      match = regexPub.exec(listText);
    }
  }
  // find end of entry (next pub entry or end):
  let match = regexPub.exec(listText.substr(startPos + 1));
  let res;
  if (match && match.index) {
    res = listText.substring(startPos, startPos + 1 + match.index);
  }
  else {
    res = listText.substring(startPos);
  }
  return res;
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

  let aGpgUserList, aGpgSecretsList;

  try {
    const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();

    obtainKeyList(win, false, onlyKeys)
      .then(keyList => {
        return new Promise((resolve, reject) => {
          if (!keyList) {
            reject();
          }
          aGpgUserList = keyList;
          EnigmailLog.DEBUG("keyRing.jsm: loadKeyList: got pubkey lines: " + keyList.length + "\n");

          let r = obtainKeyList(win, true, onlyKeys);
          resolve(r);
        });
      })
      .then(keyList => {
        EnigmailLog.DEBUG("keyRing.jsm: loadKeyList: got seckey lines: " + keyList.length + "\n");
        aGpgSecretsList = keyList;

        if ((!onlyKeys) && ((!aGpgSecretsList) || aGpgSecretsList.length === 0)) {
          gLoadingKeys = false;
          if (getDialog().confirmDlg(EnigmailLocale.getString("noSecretKeys"),
              EnigmailLocale.getString("keyMan.button.generateKey"),
              EnigmailLocale.getString("keyMan.button.skip"))) {
            getWindows().openKeyGen();
            EnigmailKeyRing.clearCache();
            EnigmailKeyRing.loadKeyList();
          }
        }
        else {
          createAndSortKeyList(aGpgUserList, aGpgSecretsList, sortColumn, sortDirection, onlyKeys === null);
          gLoadingKeys = false;
        }
      })
      .catch(() => {
        EnigmailLog.ERROR("keyRing.jsm: loadKeyList: error\n");
        gLoadingKeys = false;
      });
    waitForKeyList();
  }
  catch (ex) {
    EnigmailLog.ERROR("keyRing.jsm: loadKeyList: exception: " + ex.toString());
  }
}


// returns the output of --with-colons --list-sig
function getKeySig(keyId, exitCodeObj, errorMsgObj) {
  const args = EnigmailGpg.getStandardArgs(true).
  concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]).
  concat(keyId.split(" "));

  const statusFlagsObj = {};
  const cmdErrorMsgObj = {};
  const listText = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, cmdErrorMsgObj);

  if (!(statusFlagsObj.value & EnigmailConstants.BAD_SIGNATURE)) {
    // ignore exit code as recommended by GnuPG authors
    exitCodeObj.value = 0;
  }

  if (exitCodeObj.value !== 0) {
    errorMsgObj.value = EnigmailLocale.getString("badCommand");
    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n" + EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args);
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    return "";
  }
  return listText;
}

/**
 * Return signatures for a given key list
 *
 * @param String gpgKeyList         Output from gpg such as produced by getKeySig()
 *                                  Only the first public key is processed!
 * @param Boolean ignoreUnknownUid  true if unknown signer's UIDs should be filtered out
 *
 * @return Array of Object:
 *     - uid
 *     - uidLabel
 *     - creationDate
 *     - sigList: [uid, creationDate, signerKeyId, sigType ]
 */

function extractSignatures(gpgKeyList, ignoreUnknownUid) {
  EnigmailLog.DEBUG("keyRing.jsm: extractSignatures: " + gpgKeyList + "\n");

  var listObj = {};

  let havePub = false;
  let currUid = "",
    keyId = "",
    fpr = "";

  const lineArr = gpgKeyList.split(/\n/);
  for (let i = 0; i < lineArr.length; i++) {
    // process lines such as:
    //  tru::1:1395895453:1442881280:3:1:5
    //  pub:f:4096:1:C1B875ED336XX959:2299509307:1546189300::f:::scaESCA:
    //  fpr:::::::::102A1C8CC524A966849C33D7C8B157EA336XX959:
    //  uid:f::::1388511201::67D5B96DC564598D4D4D9E0E89F5B83C9931A154::Joe Fox <joe@fox.com>:
    //  sig:::1:C8B157EA336XX959:2299509307::::Joe Fox <joe@fox.com>:13x:::::2:
    //  sub:e:2048:1:B214734F0F5C7041:1316219469:1199912694:::::e:
    //  sub:f:2048:1:70E7A471DABE08B0:1316221524:1546189300:::::s:
    const lineTokens = lineArr[i].split(/:/);
    switch (lineTokens[ENTRY_ID]) {
      case "pub":
        if (havePub) {
          return listObj;
        }
        havePub = true;
        keyId = lineTokens[KEY_ID];
        break;
      case "fpr":
        if (fpr === "") fpr = lineTokens[USERID_ID];
        break;
      case "uid":
      case "uat":
        currUid = lineTokens[UID_ID];
        listObj[currUid] = {
          userId: lineTokens[ENTRY_ID] == "uat" ? EnigmailLocale.getString("keyring.photo") : EnigmailData.convertGpgToUnicode(lineTokens[USERID_ID]),
          rawUserId: lineTokens[USERID_ID],
          keyId: keyId,
          fpr: fpr,
          created: EnigmailTime.getDateTime(lineTokens[CREATED_ID], true, false),
          sigList: []
        };
        break;
      case "sig":
        if (lineTokens[SIG_TYPE_ID].substr(0, 2).toLowerCase() !== "1f") {
          // ignrore revoked signature

          let sig = {
            userId: EnigmailData.convertGpgToUnicode(lineTokens[USERID_ID]),
            created: EnigmailTime.getDateTime(lineTokens[CREATED_ID], true, false),
            signerKeyId: lineTokens[KEY_ID],
            sigType: lineTokens[SIG_TYPE_ID],
            sigKnown: lineTokens[USERID_ID] != UNKNOWN_SIGNATURE
          };

          if (!ignoreUnknownUid || sig.userId != UNKNOWN_SIGNATURE) {
            listObj[currUid].sigList.push(sig);
          }
        }
        break;
    }
  }

  return listObj;
}

/**
 * Create a list of objects representing the keys in a key list.
 * The internal cache is first deleted.
 *
 * @param keyListString: Array of String formatted output from GnuPG for key listing
 * @param keyListObj:    Object holding the resulting key list:
 *                         obj.keyList:     Array holding key objects
 *                         obj.keySortList: Array holding values to make sorting easier
 * @param reset:        Boolean - true: delete existting key cache
 *
 * no return value
 */
function createKeyObjects(keyListString, keyListObj, reset = true) {
  if (reset) {
    keyListObj.keyList = [];
    keyListObj.keySortList = [];
    keyListObj.trustModel = "?";
  }

  appendKeyItems(keyListString, keyListObj);
}

/**
 * Append key objects to a given key cache
 *
 * @param keyListString: array of |string| formatted output from GnuPG for key listing
 * @param keyListObj:    |object| holding the resulting key list
 *                         obj.keyList:     Array holding key objects
 *                         obj.keySortList: Array holding values to make sorting easier
 *
 * no return value
 */
function appendKeyItems(keyListString, keyListObj) {
  let keyObj = {};
  let uatNum = 0; // counter for photos (counts per key)
  let numKeys = 0;

  const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();

  for (let i = 0; i < keyListString.length; i++) {
    const listRow = keyListString[i].split(/:/);
    if (listRow.length >= 0) {
      switch (listRow[ENTRY_ID]) {
        case "pub":
          keyObj = new KeyObject(listRow);
          uatNum = 0;
          ++numKeys;
          keyListObj.keyList.push(keyObj);
          break;
        case "fpr":
          // only take first fpr line, this is the fingerprint of the primary key and what we want
          if (keyObj.fpr === "") {
            keyObj.fpr = listRow[USERID_ID];
          }
          break;
        case "uid":
          if (listRow[USERID_ID].length === 0) {
            listRow[USERID_ID] = "-";
          }
          if (typeof(keyObj.userId) !== "string") {
            keyObj.userId = EnigmailData.convertGpgToUnicode(listRow[USERID_ID]);
            if (TRUSTLEVELS_SORTED.indexOf(listRow[KEY_TRUST_ID]) < TRUSTLEVELS_SORTED.indexOf(keyObj.keyTrust)) {
              // reduce key trust if primary UID is less trusted than public key
              keyObj.keyTrust = listRow[KEY_TRUST_ID];
            }
          }
          keyObj.userIds.push({
            userId: EnigmailData.convertGpgToUnicode(listRow[USERID_ID]),
            keyTrust: listRow[KEY_TRUST_ID],
            uidFpr: listRow[UID_ID],
            type: "uid"
          });
          break;
        case "sub":
          keyObj.subKeys.push({
            keyId: listRow[KEY_ID],
            expiry: EnigmailTime.getDateTime(listRow[EXPIRY_ID], true, false),
            expiryTime: Number(listRow[EXPIRY_ID]),
            keyTrust: listRow[KEY_TRUST_ID],
            keyUseFor: listRow[KEY_USE_FOR_ID],
            keySize: listRow[KEY_SIZE_ID],
            algorithm: listRow[KEY_ALGO_ID],
            algoSym: ALGO_SYMBOL[listRow[KEY_ALGO_ID]],
            created: EnigmailTime.getDateTime(listRow[CREATED_ID], true, false),
            type: "sub"
          });
          break;
        case "uat":
          if (listRow[USERID_ID].indexOf("1 ") === 0) {
            const userId = EnigmailLocale.getString("userAtt.photo");
            keyObj.userIds.push({
              userId: userId,
              keyTrust: listRow[KEY_TRUST_ID],
              uidFpr: listRow[UID_ID],
              type: "uat",
              uatNum: uatNum
            });
            keyObj.photoAvailable = true;
            ++uatNum;
          }
          break;
        case "tru":
          keyListObj.trustModel = "?";
          if (listRow[KEY_TRUST_ID].indexOf("t") >= 0) {
            switch (listRow[KEY_SIZE_ID]) {
              case "0":
                keyListObj.trustModel = "p";
                break;
              case "1":
                keyListObj.trustModel = "t";
                break;
              case "6":
                keyListObj.trustModel = "TP";
                break;
              case "7":
                keyListObj.trustModel = "T";
                break;
            }
          }
          else {
            if (listRow[KEY_SIZE_ID] === "0") {
              keyListObj.trustModel = "a";
            }
          }
      }
    }
  }

  // (re-) build key sort list (quick index to keys)
  keyListObj.keySortList = [];
  for (let i = 0; i < keyListObj.keyList.length; i++) {
    let keyObj = keyListObj.keyList[i];
    keyListObj.keySortList.push({
      userId: keyObj.userId.toLowerCase(),
      keyId: keyObj.keyId,
      fpr: keyObj.fpr,
      keyNum: i
    });
  }

}

/**
 * Handle secret keys for which gpg 2.0 does not create a public key record
 */
function appendUnkownSecretKey(keyId, aKeyList, startIndex, endIndex) {
  EnigmailLog.DEBUG("keyRing.jsm: appendUnkownSecretKey: keyId: " + keyId + "\n");

  let keyListStr = [];
  for (let j = startIndex; j < endIndex; j++) {
    keyListStr.push(aKeyList[j]);
  }

  // make the listing a "public" key
  keyListStr[0] = keyListStr[0].replace(/^sec/, "pub");

  appendKeyItems(keyListStr, gKeyListObj);
  EnigmailKeyRing.rebuildKeyIndex();

  let k = EnigmailKeyRing.getKeyById(keyId, true);

  if (k) {
    k.secretAvailable = true;
    k.keyUseFor = "";
    k.keyTrust = "i";
    k.ownerTrust = "i";
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

function createAndSortKeyList(aGpgUserList, aGpgSecretsList, sortColumn, sortDirection, resetKeyCache) {
  EnigmailLog.DEBUG("keyRing.jsm: createAndSortKeyList()\n");

  if (typeof sortColumn !== "string") sortColumn = "userid";
  if (!sortDirection) sortDirection = 1;

  createKeyObjects(aGpgUserList, gKeyListObj, resetKeyCache);

  // create a hash-index on key ID (8 and 16 characters and fingerprint)
  // in a single array

  EnigmailKeyRing.rebuildKeyIndex();

  let startRow = -1;
  let lastKeyId = "";
  // search and mark keys that have secret keys
  for (let i = 0; i < aGpgSecretsList.length; i++) {
    let listRow = aGpgSecretsList[i].split(/:/);
    if (listRow.length >= 0) {
      if (listRow[ENTRY_ID] == "sec") {

        if (startRow >= 0) {
          // handle secret key not found on public key ring
          appendUnkownSecretKey(lastKeyId, aGpgSecretsList, startRow, i);
        }
        startRow = -1;

        let k = EnigmailKeyRing.getKeyById(listRow[KEY_ID], true);
        if (k && typeof(k) === "object") {
          k.secretAvailable = true;
        }
        else {
          startRow = i;
          lastKeyId = listRow[KEY_ID];
        }
      }
    }
  }

  if (startRow >= 0) {
    // handle secret key not found on public key ring
    appendUnkownSecretKey(lastKeyId, aGpgSecretsList, startRow, aGpgSecretsList.length);
  }

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
      EnigmailLog.DEBUG("keyRing.jsm: runKeyUsabilityCheck: exception " + ex.toString() + "\n");
    }

  }, 60 * 1000); // 1 minute
}

function waitForKeyList() {
  let mainThread = Services.tm.mainThread;
  while (gLoadingKeys)
    mainThread.processNextEvent(true);
}

/************************ IMPLEMENTATION of KeyObject ************************/


function KeyObject(lineArr) {
  if (lineArr[ENTRY_ID] === "pub") {
    this.keyId = lineArr[KEY_ID];
    this.expiry = EnigmailTime.getDateTime(lineArr[EXPIRY_ID], true, false);
    this.expiryTime = Number(lineArr[EXPIRY_ID]);
    this.created = EnigmailTime.getDateTime(lineArr[CREATED_ID], true, false);
    this.keyTrust = lineArr[KEY_TRUST_ID];
    this.keyUseFor = lineArr[KEY_USE_FOR_ID];
    this.ownerTrust = lineArr[OWNERTRUST_ID];
    this.algorithm = lineArr[KEY_ALGO_ID];
    this.algoSym = ALGO_SYMBOL[lineArr[KEY_ALGO_ID]];
    this.keySize = lineArr[KEY_SIZE_ID];
  }
  else {
    this.keyId = "";
    this.expiry = "";
    this.expiryTime = 0;
    this.created = "";
    this.keyTrust = "";
    this.keyUseFor = "";
    this.ownerTrust = "";
    this.algorithm = "";
    this.algoSym = "";
    this.keySize = "";
  }
  this.type = lineArr[ENTRY_ID];
  this.userIds = [];
  this.subKeys = [];
  this.fpr = "";
  this.minimalKeyBlock = null;
  this.photoAvailable = false;
  this.secretAvailable = false;
  this._sigList = null;
}

KeyObject.prototype = {
  /**
   * gettter that returns a list of all signatures found on the key
   *
   * @return Array of Object, or null in case of error:
   *     - uid
   *     - uidLabel
   *     - creationDate
   *     - sigList: Array of object: { uid, creationDate, signerKeyId, sigType }
   */
  get signatures() {
    if (this._sigList === null) {
      let exitCodeObj = {},
        errorMsgObj = {};
      let r = getKeySig(this.keyId, exitCodeObj, errorMsgObj);

      if (r.length > 0) {
        this._sigList = extractSignatures(r, false);
      }
    }

    return this._sigList;
  },

  /**
   * create a copy of the object
   */
  clone: function() {
    let cp = new KeyObject(["copy"]);
    for (let i in this) {
      if (i !== "signatures" && i !== "fprFormatted") {
        // caution: don't try to evaluate this[i] if i==="signatures";
        // it would immediately get all signatures for the key (slow!)
        if (typeof this[i] !== "function") {
          if (typeof this[i] === "object") {
            cp[i] = EnigmailFuncs.cloneObj(this[i]);
          }
          else
            cp[i] = this[i];
        }
      }
    }

    return cp;
  },

  /**
   * Does the key have secondary user IDs?
   *
   * @return: Boolean - true if yes; false if no
   */
  hasSubUserIds: function() {
    let nUid = 0;
    for (let i in this.userIds) {
      if (this.userIds[i].type === "uid") ++nUid;
    }

    return nUid >= 2;
  },

  /**
   * Get a formatted version of the fingerprint:
   * 1234 5678 90AB CDEF .... ....
   *
   * @return String - the formatted fingerprint
   */
  get fprFormatted() {
    let f = EnigmailKey.formatFpr(this.fpr);
    if (f.length === 0) f = this.fpr;
    return f;
  },

  /**
   * Determine if the public key is valid. If not, return a description why it's not
   *
   * @return Object:
   *   - keyValid: Boolean (true if key is valid)
   *   - reason: String (explanation of invalidity)
   */
  getPubKeyValidity: function() {
    let retVal = {
      keyValid: false,
      reason: ""
    };
    if (this.keyTrust.search(/r/i) >= 0) {
      // public key revoked
      retVal.reason = EnigmailLocale.getString("keyRing.pubKeyRevoked", [this.userId, "0x" + this.keyId]);
    }
    else if (this.keyTrust.search(/e/i) >= 0) {
      // public key expired
      retVal.reason = EnigmailLocale.getString("keyRing.pubKeyExpired", [this.userId, "0x" + this.keyId]);
    }
    else if (this.keyTrust.search(/d/i) >= 0 || this.keyUseFor.search(/D/i) >= 0) {
      // public key disabled
      retVal.reason = EnigmailLocale.getString("keyRing.keyDisabled", [this.userId, "0x" + this.keyId]);
    }
    else if (this.keyTrust.search(/i/i) >= 0) {
      // public key invalid
      retVal.reason = EnigmailLocale.getString("keyRing.keyInvalid", [this.userId, "0x" + this.keyId]);
    }
    else
      retVal.keyValid = true;

    return retVal;
  },


  /**
   * Check whether a key can be used for signing and return a description of why not
   *
   * @return Object:
   *   - keyValid: Boolean (true if key is valid)
   *   - reason: String (explanation of invalidity)
   */
  getSigningValidity: function() {
    let retVal = this.getPubKeyValidity();

    if (!retVal.keyValid) return retVal;

    if (!this.secretAvailable) {
      retVal.reason = EnigmailLocale.getString("keyRing.noSecretKey", [this.userId, "0x" + this.keyId]);
      retVal.keyValid = false;
    }
    else if (this.keyUseFor.search(/S/) < 0) {
      retVal.keyValid = false;

      if (this.keyTrust.search(/u/i) < 0) {
        // public key invalid
        retVal.reason = EnigmailLocale.getString("keyRing.keyNotTrusted", [this.userId, "0x" + this.keyId]);
      }
      else {
        let expired = 0,
          revoked = 0,
          unusable = 0,
          found = 0;
        // public key is valid; check for signing subkeys
        for (let sk in this.subKeys) {
          if (this.subKeys[sk].keyUseFor.search(/[sS]/) >= 0) {
            // found subkey usable for signing
            ++found;
            if (this.subKeys[sk].keyTrust.search(/e/i) >= 0) ++expired;
            if (this.subKeys[sk].keyTrust.search(/r/i) >= 0) ++revoked;
            if (this.subKeys[sk].keyTrust.search(/[di-]/i) >= 0 || this.subKeys[sk].keyUseFor.search(/D/) >= 0) ++unusable;
          }
        }

        if (found > 0 && (expired > 0 || revoked > 0)) {
          if (found === expired) {
            retVal.reason = EnigmailLocale.getString("keyRing.signSubKeysExpired", [this.userId, "0x" + this.keyId]);
          }
          else if (found === revoked) {
            retVal.reason = EnigmailLocale.getString("keyRing.signSubKeysRevoked", [this.userId, "0x" + this.keyId]);
          }
          else {
            retVal.reason = EnigmailLocale.getString("keyRing.signSubKeysUnusable", [this.userId, "0x" + this.keyId]);
          }
        }
        else
          retVal.reason = EnigmailLocale.getString("keyRing.pubKeyNotForSigning", [this.userId, "0x" + this.keyId]);
      }
    }

    return retVal;
  },

  /**
   * Check whether a key can be used for encryption and return a description of why not
   *
   * @return Object:
   *   - keyValid: Boolean (true if key is valid)
   *   - reason: String (explanation of invalidity)
   */
  getEncryptionValidity: function() {
    let retVal = this.getPubKeyValidity();

    if (!retVal.keyValid) return retVal;

    if (this.keyUseFor.search(/E/) < 0) {
      retVal.keyValid = false;

      if (this.keyTrust.search(/u/i) < 0) {
        // public key invalid
        retVal.reason = EnigmailLocale.getString("keyRing.keyInvalid", [this.userId, "0x" + this.keyId]);
      }
      else {
        let expired = 0,
          revoked = 0,
          unusable = 0,
          found = 0;
        // public key is valid; check for encryption subkeys

        for (let sk in this.subKeys) {
          if (this.subKeys[sk].keyUseFor.search(/[eE]/) >= 0) {
            // found subkey usable for signing
            ++found;
            if (this.subKeys[sk].keyTrust.search(/e/i) >= 0) ++expired;
            if (this.subKeys[sk].keyTrust.search(/r/i) >= 0) ++revoked;
            if (this.subKeys[sk].keyTrust.search(/[di-]/i) >= 0 || this.subKeys[sk].keyUseFor.search(/D/) >= 0) ++unusable;
          }
        }

        if (found > 0 && (expired > 0 || revoked > 0)) {
          if (found === expired) {
            retVal.reason = EnigmailLocale.getString("keyRing.encSubKeysExpired", [this.userId, "0x" + this.keyId]);
          }
          else if (found === revoked) {
            retVal.reason = EnigmailLocale.getString("keyRing.encSubKeysRevoked", [this.userId, "0x" + this.keyId]);
          }
          else {
            retVal.reason = EnigmailLocale.getString("keyRing.encSubKeysUnusable", [this.userId, "0x" + this.keyId]);
          }
        }
        else
          retVal.reason = EnigmailLocale.getString("keyRing.pubKeyNotForEncryption", [this.userId, "0x" + this.keyId]);
      }
    }

    return retVal;
  },

  /**
   * Determine the next expiry date of the key. This is either the public key expiry date,
   * or the maximum expiry date of a signing or encryption subkey. I.e. this returns the next
   * date at which the key cannot be used for signing and/or encryption anymore
   *
   * @return Number - The expiry date as seconds after 01/01/1970
   */
  getKeyExpiry: function() {
    let expiryDate = Number.MAX_VALUE;
    let encryption = -1;
    let signing = -1;


    // check public key expiry date
    if (this.expiryTime > 0) {
      expiryDate = this.expiryTime;
    }

    for (let sk in this.subKeys) {
      if (this.subKeys[sk].keyUseFor.search(/[eE]/) >= 0) {
        let expiry = this.subKeys[sk].expiryTime;
        if (expiry === 0) expiry = Number.MAX_VALUE;
        encryption = Math.max(encryption, expiry);
      }
      else if (this.subKeys[sk].keyUseFor.search(/[sS]/) >= 0) {
        let expiry = this.subKeys[sk].expiryTime;
        if (expiry === 0) expiry = Number.MAX_VALUE;
        signing = Math.max(signing, expiry);
      }
    }

    if (expiryDate > encryption) {
      if (this.keyUseFor.search(/[eE]/) < 0) {
        expiryDate = encryption;
      }
    }

    if (expiryDate > signing) {
      if (this.keyUseFor.search(/[Ss]/) < 0) {
        expiryDate = signing;
      }
    }

    return expiryDate;
  },

  /**
   * Export the minimum key for the public key object:
   * public key, primary user ID, newest encryption subkey
   *
   * @return Object:
   *    - exitCode (0 = success)
   *    - errorMsg (if exitCode != 0)
   *    - keyData: BASE64-encded string of key data
   */

  getMinimalPubKey: function() {
    EnigmailLog.DEBUG("keyRing.jsm: KeyObject.getMinimalPubKey: " + this.keyId + "\n");

    let retObj = {
      exitCode: 0,
      errorMsg: "",
      keyData: ""
    };


    // TODO: remove ECC special case once OpenPGP.js supports it
    let isECC = (this.algoSym.search(/(ECDH|ECDSA|EDDSA)/) >= 0);

    if (!this.minimalKeyBlock) {
      let args = EnigmailGpg.getStandardArgs(true);

      if (!isECC) {
        args = args.concat(["--export-options", "export-minimal,no-export-attributes", "-a", "--export", this.fpr]);
      }
      else {
        args = args.concat(["--export-options", "export-minimal,no-export-attributes", "--export", this.fpr]);
      }

      const statusObj = {};
      const exitCodeObj = {};
      let keyBlock = EnigmailExecution.simpleExecCmd(EnigmailGpg.agentPath, args, exitCodeObj, statusObj);

      let r = new RegExp("^\\[GNUPG:\\] EXPORTED " + this.fpr, "m");
      if (statusObj.value.search(r) < 0) {
        retObj.exitCode = 2;
        retObj.errorMsg = EnigmailLocale.getString("failKeyExtract");
      }
      else {
        this.minimalKeyBlock = null;

        if (isECC) {
          this.minimalKeyBlock = btoa(keyBlock);
        }
        else {
          let minKey = getStrippedKey(keyBlock);
          if (minKey) {
            this.minimalKeyBlock = btoa(String.fromCharCode.apply(null, minKey));
          }
        }

        if (!this.minimalKeyBlock) {
          retObj.exitCode = 1;
          retObj.errorMsg = "No valid (sub-)key";
        }
      }
    }

    retObj.keyData = this.minimalKeyBlock;
    return retObj;
  },

  /**
   * Obtain a "virtual" key size that allows to compare different algorithms with each other
   * e.g. elliptic curve keys have small key sizes with high cryptographic strength
   *
   *
   * @return Number: a virtual size
   */
  getVirtualKeySize: function() {
    EnigmailLog.DEBUG("keyRing.jsm: KeyObject.getVirtualKeySize: " + this.keyId + "\n");

    switch (this.algoSym) {
      case "DSA":
        return this.keySize / 2;
      case "ECDSA":
        return this.keySize * 8;
      case "EDDSA":
        return this.keySize * 32;
      default:
        return this.keySize;
    }
  }
};

/**
 * Get a minimal stripped key containing only:
 * - The public key
 * - the primary UID + its self-signature
 * - the newest valild encryption key + its signature packet
 *
 * @param armoredKey - String: Key data (in OpenPGP armored format)
 *
 * @return Uint8Array, or null
 */

function getStrippedKey(armoredKey) {
  EnigmailLog.DEBUG("keyRing.jsm: KeyObject.getStrippedKey()\n");

  try {
    let openpgp = getOpenPGP().openpgp;
    let msg = openpgp.key.readArmored(armoredKey);

    if (!msg || msg.keys.length === 0) return null;

    let key = msg.keys[0];
    let uid = key.getPrimaryUser();
    if (!uid || !uid.user) return null;

    let foundSubKey = null;
    let foundCreationDate = new Date(0);

    // go backwards through the subkeys as the newest key is usually
    // later in the list
    for (let i = key.subKeys.length - 1; i >= 0; i--) {
      if (key.subKeys[i].subKey.created > foundCreationDate &&
        key.subKeys[i].isValidEncryptionKey(key.primaryKey)) {
        foundCreationDate = key.subKeys[i].subKey.created;
        foundSubKey = key.subKeys[i];
      }
    }

    if (!foundSubKey) return null;

    let p = new openpgp.packet.List();
    p.push(key.primaryKey);
    p.concat(uid.user.toPacketlist());
    p.concat(foundSubKey.toPacketlist());

    return p.write();
  }
  catch (ex) {
    EnigmailLog.DEBUG("keyRing.jsm: KeyObject.getStrippedKey: ERROR " + ex.message + "\n");
  }
  return null;
}

EnigmailKeyRing.clearCache();
