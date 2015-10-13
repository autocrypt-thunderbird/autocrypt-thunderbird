/*global Components: false */
/*jshint -W097 */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailKeyRing"];

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
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/time.jsm"); /*global EnigmailTime: false */
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Cu.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false */

const nsIEnigmail = Ci.nsIEnigmail;

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

let userIdList = null;
let secretKeyList = null;
let keygenProcess = null;
let gKeyListObj = null;

/*

  This module operates with a Key Store (array) containing objects with the following properties:

  * keyList [Array] of |KeyObject|:
    - keyId           - 16 digits (8-byte) public key ID (/not/ preceeded with 0x)
    - userId          - main user ID
    - fpr             - fingerprint
    - expiry          - Expiry date as printable string
    - expiryTime      - Expiry time as seconds after 01/01/1970
    - created         - Key creation date as printable string
    - keyTrust        - key trust code as provided by GnuPG
    - keyUseFor       - key usage type as provided by GnuPG
    - ownerTrust      - owner trust as provided by GnuPG
    - photoAvailable  - [Boolean] true if photo is available
    - secretAvailable - [Boolean] true if secret key is available
    - algorithm       - public key algorithm type
    - keySize         - size of public key
    - type            - "pub" or "grp"
    - SubUserIds  - [Array]:
                      * userId     - additional User ID
                      * keyTrust   - trust level of user ID
                      * type       - one of "uid" (regular user ID), "uat" (photo)
                      * uatNum     - photo number (starting with 0 for each key)
    - subKeys     - [Array]:
                      * keyId      - subkey ID (16 digits (8-byte))
                      * expiry     - Expiry date as printable string
                      * expiryTime - Expiry time as seconds after 01/01/1970
                      * created    - Key creation date as printable string
                      * keyTrust   - key trust code as provided by GnuPG
                      * keyUseFor  - key usage type as provided by GnuPG
                      * algorithm  - subkey algorithm type
                      * keySize    - subkey size
                      * type       -  "sub"

    - signatures  - [Array]: list of signatures
                      * userId
                      * uidLabel
                      * created
                      * fpr
                      * sigList: Array of object: { userId, created, signerKeyId, sigType, sigKnown }

  * keySortList [Array]:  used for quickly sorting the keys
    - user ID (in lower case)
    - key ID
  * trustModel: [String]. One of:
            - p: pgp/classical
            - t: always trust
            - a: auto (:0) (default, currently pgp/classical)
*/

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
      this.loadKeyList(win, false, gKeyListObj, sortColumn, sortDirection);
    }
    else {
      if (sortColumn) {
        gKeyListObj.keySortList.sort(getSortFunction(sortColumn.toLowerCase(), gKeyListObj, sortDirection));
      }
    }

    return gKeyListObj;
  },


  /**
   * get a list of all keys that have a secret key
   *
   * @return Array of KeyObjects containing the found keys
   **/

  getAllSecretKeys: function() {
    this.getAllKeys(); // ensure keylist is loaded;

    let res = [];

    this.getAllKeys(); // ensure keylist is loaded;

    for (let i in gKeyListObj.keyList) {
      if (gKeyListObj.keyList[i].secretAvailable) {
        res.push(gKeyListObj.keyList[i]);
      }
    }

    return res;
  },


  /**
   * get 1st key object that matches a given key ID or subkey ID
   *
   * @param keyId - String: key Id (16 characters (preferred) or 8 characters), optionally preceeded with "0x"
   *
   * @return Object - found KeyObject or null if key not found
   */
  getKeyById: function(keyId) {
    EnigmailLog.DEBUG("keyRing.jsm: getKeyById: " + keyId + "\n");
    let s;

    if (keyId.search(/^0x/) === 0) {
      keyId = keyId.substr(2);
    }

    if (keyId.length === 16) {
      s = new RegExp("^" + keyId + "$", "i");
    }
    else {
      s = new RegExp(keyId + "$", "i");
    }

    this.getAllKeys(); // ensure keylist is loaded;

    for (let i in gKeyListObj.keyList) {
      if (gKeyListObj.keyList[i].keyId.search(s) >= 0) {
        return gKeyListObj.keyList[i];
      }
      for (let j in gKeyListObj.keyList[i].subKeys) {
        if (gKeyListObj.keyList[i].subKeys[j].keyId.search(s) >= 0) {
          return gKeyListObj.keyList[i];
        }
      }
    }

    return null;
  },

  /**
   * get 1st key object that matches a given fingerprint
   *
   * @param keyId - String: key Id (8 or 16 characters), optionally preceeded with "0x"
   *
   * @return Object - found KeyObject or null if key not found
   */
  getKeyByFingerprint: function(fpr) {
    if (fpr.search(/^0x/) === 0) {
      fpr = fpr.substr(2);
    }

    this.getAllKeys(); // ensure keylist is loaded;

    for (let i in gKeyListObj.keyList) {
      if (gKeyListObj.keyList[i].fpr === fpr) {
        return gKeyListObj.keyList[i];
      }
    }

    return null;
  },

  /**
   * get all key objects that match a given user ID
   *
   * @param searchTerm   - String: a regular expression to match against all UIDs of the keys.
   *                               The search is always performed case-insensitively
   * @param onlyValidUid - Boolean: if true (default), invalid (e.g. revoked) UIDs are not matched
   *
   * @return Array of KeyObjects with the found keys
   */
  getKeysByUserId: function(searchTerm, onlyValidUid = true) {
    let s = new RegExp(searchTerm, "i");

    let res = [];

    this.getAllKeys(); // ensure keylist is loaded;

    for (let i in gKeyListObj.keyList) {
      let k = gKeyListObj.keyList[i];

      if (k.userId.search(s) >= 0) {
        res.push(gKeyListObj.keyList[i]);
      }
      else {
        for (let j in k.SubUserIds) {
          if (k.SubUserIds[j].type === "uid" && k.SubUserIds[j].userId.search(s) >= 0) {
            if (!onlyValidUid || (!EnigmailTrust.isInvalid(k.SubUserIds[j].keyTrust))) {
              res.push(k);
              continue;
            }
          }
        }
      }
    }

    return res;
  },

  /**
   * get a list of keys for a given set of (sub-) key IDs
   *
   * @param keyIdList: Array of key IDs
                       OR String, with space-separated list of key IDs
   */
  getKeyListById: function(keyIdList) {
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

  importKeyFromFile: function(parent, inputFile, errorMsgObj, importedKeysObj) {
    var command = EnigmailGpg.agentPath;
    var args = EnigmailGpg.getStandardArgs(true);
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.importKeyFromFile: fileName=" + inputFile.path + "\n");
    importedKeysObj.value = "";

    var fileName = EnigmailFiles.getEscapedFilename((inputFile.QueryInterface(Ci.nsIFile)).path);

    args.push("--import");
    args.push(fileName);

    var statusFlagsObj = {};
    var statusMsgObj = {};
    var exitCodeObj = {};

    var output = EnigmailExecution.execCmd(command, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);
    EnigmailLog.ERROR("keyRing.jsm: EnigmailKeyRing.importKeyFromFile: error=" + errorMsgObj.value + "\n");

    var statusMsg = statusMsgObj.value;

    var keyList = [];

    if (exitCodeObj.value === 0) {
      // Normal
      EnigmailKeyRing.invalidateUserIdList();

      var statusLines = statusMsg.split(/\r?\n/);

      // Discard last null string, if any

      for (var j = 0; j < statusLines.length; j++) {
        var matches = statusLines[j].match(/IMPORT_OK ([0-9]+) (\w+)/);
        if (matches && (matches.length > 2)) {
          if (typeof(keyList[matches[2]]) != "undefined") {
            keyList[matches[2]] |= Number(matches[1]);
          }
          else
            keyList[matches[2]] = Number(matches[1]);

          EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.importKeyFromFile: imported " + matches[2] + ":" + matches[1] + "\n");
        }
      }

      for (j in keyList) {
        importedKeysObj.value += j + ":" + keyList[j] + ";";
      }
    }

    return exitCodeObj.value;
  },

  /**
   * return key ID of public key for subkey
   *
   * @param  String  keyId key with or without leading 0x
   * @return String  public key ID, or null if key not found
   */
  getPubKeyIdForSubkey: function(keyId) {
    const entry = getKeyListEntryOfKey(keyId);
    if (!entry) {
      return null;
    }

    const lineArr = entry.split(/\n/);
    for (let i = 0; i < lineArr.length; ++i) {
      const lineTokens = lineArr[i].split(/:/);
      if (lineTokens[ENTRY_ID] === "pub") {
        return lineTokens[KEY_ID];
      }
    }
    return null;
  },

  /**
   * Return first found userId of given key.
   * - key may be pub or sub key.
   * @param  String  keyId key with leading 0x
   * @return String  First found of user IDs or null if none
   */
  getFirstUserIdOfKey: function(keyId) {
    EnigmailLog.DEBUG("enigmail.js: Enigmail.getFirstUserIdOfKey() keyId='" + keyId + "'\n");

    const entry = getKeyListEntryOfKey(keyId);
    if (!entry) {
      return null;
    }

    const lineArr = entry.split(/\n/);
    for (let i = 0; i < lineArr.length; ++i) {
      const lineTokens = lineArr[i].split(/:/);
      if (lineTokens[ENTRY_ID] === "uid") {
        return lineTokens[USERID_ID];
      }
    }
    return null;
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
        keyObj.SubUserIds.push({
          userId: grpMembers[grpIdx],
          keyTrust: "q"
        });
      }
      r.push(keyObj);
    }

    return r;
  },

  invalidateUserIdList: function() {
    // clean the userIdList to force reloading the list at next usage
    this.clearCache();
  },

  clearCache: function() {
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.clearCache\n");
    gKeyListObj = {
      keyList: [],
      keySortList: []
    };

    userIdList = null;
    secretKeyList = null;
  },


  /**
   * returns the output of --with-colons --list[-secret]-keys
   * INTERNAL USE ONLY
   */
  getUserIdList: function(secretOnly, refresh, exitCodeObj, statusFlagsObj, errorMsgObj) {
    if (refresh ||
      (secretOnly && secretKeyList === null) ||
      ((!secretOnly) && userIdList === null)) {
      let args = EnigmailGpg.getStandardArgs(true);

      if (secretOnly) {
        args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"]);
      }
      else {
        if (refresh) this.clearCache();
        args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-keys"]);
      }

      statusFlagsObj.value = 0;

      const cmdErrorMsgObj = {};
      let listText = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, cmdErrorMsgObj);

      if (!(statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
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
      if (secretOnly) {
        secretKeyList = listText;
        return listText;
      }
      userIdList = listText;
    }
    else {
      exitCodeObj.value = 0;
      statusFlagsObj.value = 0;
      errorMsgObj.value = "";
    }

    if (secretOnly) {
      return secretKeyList;
    }

    return userIdList;
  },

  // returns the output of --with-colons --list-sig
  getKeySig: function(keyId, exitCodeObj, errorMsgObj) {
    const args = EnigmailGpg.getStandardArgs(true).
    concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]).
    concat(keyId.split(" "));

    const statusFlagsObj = {};
    const cmdErrorMsgObj = {};
    const listText = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, cmdErrorMsgObj);

    if (!(statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
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
  },

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

  extractSignatures: function(gpgKeyList, ignoreUnknownUid) {
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
  },

  /**
   * Return details of given keys.
   * @deprecated - use getKeyListById instead
   *
   * @param  String  keyId              List of keys with 0x, separated by spaces.
   * @param  Boolean uidOnly            false:
   *                                      return all key details (full output of GnuPG)
   *                                    true:
   *                                      return only the user ID fields. Only UIDs with highest trust
   *                                      level are returned.
   * @param  Boolean withUserAttributes true: if uidOnly include "uat:jpegPhoto" (but not subkey IDs)
   *
   * @return String all key details or list of user IDs separated by \n.
   */
  getKeyDetails: function(keyId, uidOnly, withUserAttributes) {
    const args = EnigmailGpg.getStandardArgs(true).
    concat(["--fixed-list-mode", "--with-fingerprint", "--with-colons", "--list-keys"]).
    concat(keyId.split(" "));

    const statusFlagsObj = {};
    const exitCodeObj = {};
    let listText = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, {});

    if (!(statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
      // ignore exit code as recommended by GnuPG authors
      exitCodeObj.value = 0;
    }

    if (exitCodeObj.value !== 0) {
      return "";
    }

    listText = listText.replace(/(\r\n|\r)/g, "\n");

    const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
    let maxTrustLevel = -1;

    if (uidOnly) {
      let userList = "";
      let hideInvalidUid = true;
      const lineArr = listText.split(/\n/);
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
            if (EnigmailTrust.isInvalid(lineTokens[KEY_TRUST_ID])) {
              // pub key not valid (anymore)-> display all UID's
              hideInvalidUid = false;
            }
            break;
          case "uid":
            if (uidOnly && hideInvalidUid) {
              const thisTrust = TRUSTLEVELS_SORTED.indexOf(lineTokens[KEY_TRUST_ID]);
              if (thisTrust > maxTrustLevel) {
                userList = lineTokens[USERID_ID] + "\n";
                maxTrustLevel = thisTrust;
              }
              else if (thisTrust == maxTrustLevel) {
                userList += lineTokens[USERID_ID] + "\n";
              }
              // else do not add uid
            }
            else if (!EnigmailTrust.isInvalid(lineTokens[KEY_TRUST_ID]) || !hideInvalidUid) {
              // UID valid  OR  key not valid, but invalid keys allowed
              userList += lineTokens[USERID_ID] + "\n";
            }
            break;
          case "uat":
            if (withUserAttributes) {
              if (!EnigmailTrust.isInvalid(lineTokens[KEY_TRUST_ID]) || !hideInvalidUid) {
                // IF  UID valid  OR  key not valid and invalid keys allowed
                userList += "uat:jpegPhoto:" + lineTokens[KEY_ID] + "\n";
              }
            }
            break;
        }
      }
      return userList.
      replace(/^\n+/, "").
      replace(/\n+$/, "").
      replace(/\n\n+/g, "\n");
    }

    return listText;
  },

  extractKey: function(parent, exportFlags, userId, outputFile, exitCodeObj, errorMsgObj) {
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.extractKey: " + userId + "\n");
    const args = EnigmailGpg.getStandardArgs(true).
    concat(["-a", "--export"]).
    concat(userId.split(/[ ,\t]+/));

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

    if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
      const secretArgs = EnigmailGpg.getStandardArgs(true).
      concat(["-a", "--export-secret-keys"]).
      concat(userId.split(/[ ,\t]+/));

      const secKeyBlock = EnigmailExecution.execCmd(EnigmailGpg.agentPath, secretArgs, "", exitCodeObj, {}, {}, cmdErrorMsgObj);

      if ((exitCodeObj.value === 0) && !secKeyBlock) {
        exitCodeObj.value = -1;
      }

      if (exitCodeObj.value !== 0) {
        errorMsgObj.value = EnigmailLocale.getString("failKeyExtract");

        if (cmdErrorMsgObj.value) {
          errorMsgObj.value += "\n" + EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, secretArgs);
          errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
        }

        return "";
      }

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

  // ExitCode == 0  => success
  // ExitCode > 0   => error
  // ExitCode == -1 => Cancelled by user
  importKey: function(parent, uiFlags, msgText, keyId, errorMsgObj) {
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyRing.importKey: id=" + keyId + ", " + uiFlags + "\n");

    const beginIndexObj = {};
    const endIndexObj = {};
    const blockType = EnigmailArmor.locateArmoredBlock(msgText, 0, "", beginIndexObj, endIndexObj, {});
    if (!blockType) {
      errorMsgObj.value = EnigmailLocale.getString("noPGPblock");
      return 1;
    }

    if (blockType != "PUBLIC KEY BLOCK") {
      errorMsgObj.value = EnigmailLocale.getString("notFirstBlock");
      return 1;
    }

    const pgpBlock = msgText.substr(beginIndexObj.value,
      endIndexObj.value - beginIndexObj.value + 1);

    if (uiFlags & nsIEnigmail.UI_INTERACTIVE) {
      if (!EnigmailDialog.confirmDlg(parent, EnigmailLocale.getString("importKeyConfirm"), EnigmailLocale.getString("keyMan.button.import"))) {
        errorMsgObj.value = EnigmailLocale.getString("failCancel");
        return -1;
      }
    }

    const args = EnigmailGpg.getStandardArgs(true).
    concat(["--import"]);

    const exitCodeObj = {};
    const statusMsgObj = {};

    EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, pgpBlock, exitCodeObj, {}, statusMsgObj, errorMsgObj);

    const statusMsg = statusMsgObj.value;

    if (exitCodeObj.value === 0) {
      // Normal return
      EnigmailKeyRing.invalidateUserIdList();
      if (statusMsg && (statusMsg.search("IMPORTED ") > -1)) {
        const matches = statusMsg.match(/(^|\n)IMPORTED (\w{8})(\w{8})/);
        if (matches && (matches.length > 3)) {
          EnigmailLog.DEBUG("enigmail.js: Enigmail.importKey: IMPORTED 0x" + matches[3] + "\n");
        }
      }
    }

    return exitCodeObj.value;
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

    const args = EnigmailGpg.getStandardArgs().
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

    if (EnigmailOS.isDosLike() && EnigmailGpg.getGpgFeature("windows-photoid-bug")) {
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


  /**
   * Return fingerprint for a given key ID
   *
   * @param keyId:  String of 8 or 16 chars key with optionally leading 0x
   *
   * @return: String containing the fingerprint or null if key not found
   */
  getFingerprintForKey: function(keyId) {
    let key = this.getKeyById(keyId);
    if (key) {
      return key.fpr;
    }
    else
      return null;
  },

  /**
   * Create a list of objects representing the keys in a key list
   *
   * @keyListString: array of |string| formatted output from GnuPG for key listing
   * @keyListObj:    |object| holding the resulting key list:
   *                     obj.keyList:     Array holding key objects
   *                     obj.keySortList: Array holding values to make sorting easier
   *
   * no return value
   */
  createKeyObjects: function(keyListString, keyListObj) {
    keyListObj.keyList = [];
    keyListObj.keySortList = [];
    keyListObj.trustModel = "?";

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
              keyListObj.keySortList.push({
                userId: keyObj.userId.toLowerCase(),
                keyId: keyObj.keyId,
                keyNum: numKeys - 1
              });
              if (TRUSTLEVELS_SORTED.indexOf(listRow[KEY_TRUST_ID]) < TRUSTLEVELS_SORTED.indexOf(keyObj.keyTrust)) {
                // reduce key trust if primary UID is less trusted than public key
                keyObj.keyTrust = listRow[KEY_TRUST_ID];
              }
            }
            else {
              keyObj.SubUserIds.push({
                userId: EnigmailData.convertGpgToUnicode(listRow[USERID_ID]),
                keyTrust: listRow[KEY_TRUST_ID],
                type: "uid"
              });
            }
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
              created: EnigmailTime.getDateTime(listRow[CREATED_ID], true, false),
              type: "sub"
            });
            break;
          case "uat":
            if (listRow[USERID_ID].indexOf("1 ") === 0) {
              const userId = EnigmailLocale.getString("userAtt.photo");
              keyObj.SubUserIds.push({
                userId: userId,
                keyTrust: listRow[KEY_TRUST_ID],
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
              if (listRow[KEY_SIZE_ID] === "0") {
                keyListObj.trustModel = "p";
              }
              else if (listRow[KEY_SIZE_ID] === "1") {
                keyListObj.trustModel = "t";
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
  },

  /**
   * Load the key list into memory and return it sorted by a specified column
   * @deprecated  -  RESERVED FOR INTERNAL USE of the module!
   *
   * @win        - |object|  holding the parent window for displaying error messages
   * @refresh    - |boolean| if true, cache is cleared and all keys are loaded from GnuPG
   * @keyListObj - |object|  holding the resulting key list
   * @sortColumn - |string|  containing the column name for sorting. One of:
   *                         userid, keyid, keyidshort, fpr, keytype, validity, trust, expiry.
   *                         Null will sort by userid.
   * @sortDirection - |number| 1 = ascending / -1 = descending
   *
   * no return value
   */
  loadKeyList: function(win, refresh, keyListObj, sortColumn, sortDirection) {
    EnigmailLog.DEBUG("keyRing.jsm: loadKeyList\n");

    if (!sortColumn) sortColumn = "userid";
    if (!sortDirection) sortDirection = 1;

    const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();

    var aGpgUserList = obtainKeyList(win, false, refresh);
    if (!aGpgUserList) return;

    var aGpgSecretsList = obtainKeyList(win, true, refresh);
    if (!aGpgSecretsList && !refresh) {
      if (EnigmailDialog.confirmDlg(EnigmailLocale.getString("noSecretKeys"),
          EnigmailLocale.getString("keyMan.button.generateKey"),
          EnigmailLocale.getString("keyMan.button.skip"))) {
        EnigmailWindows.openKeyGen();
        EnigmailKeyRing.loadKeyList(win, true, keyListObj);
      }
    }

    EnigmailKeyRing.createKeyObjects(aGpgUserList, keyListObj);

    // search and mark keys that have secret keys
    for (let i = 0; i < aGpgSecretsList.length; i++) {
      let listRow = aGpgSecretsList[i].split(/:/);
      if (listRow.length >= 0) {
        if (listRow[ENTRY_ID] == "sec") {
          let k = this.getKeyById(listRow[KEY_ID]);
          if (typeof(k) === "object") {
            k.secretAvailable = true;
          }
        }
      }
    }

    keyListObj.keySortList.sort(getSortFunction(sortColumn.toLowerCase(), keyListObj, sortDirection));
  },

  isGeneratingKey: function() {
    return keygenProcess !== null;
  },

  /**
   * Generate a new key pair with GnuPG
   *
   * @parent:     nsIWindow  - parent window (not used anymore)
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
  generateKey: function(parent, name, comment, email, expiryDate, keyLength, keyType,
    passphrase, listener) {
    EnigmailLog.WRITE("keyRing.jsm: generateKey:\n");

    if (EnigmailKeyRing.isGeneratingKey()) {
      // key generation already ongoing
      throw Components.results.NS_ERROR_FAILURE;
    }

    const args = EnigmailGpg.getStandardArgs(true).
    concat(["--gen-key"]);

    EnigmailLog.CONSOLE(EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args));

    let inputData = "%echo Generating key\nKey-Type: ";

    switch (keyType) {
      case KEYTYPE_DSA:
        inputData += "DSA\nKey-Length: " + keyLength + "\nSubkey-Type: 16\nSubkey-Length: ";
        break;
      case KEYTYPE_RSA:
        inputData += "RSA\nKey-Usage: sign,auth\nKey-Length: " + keyLength;
        inputData += "\nSubkey-Type: RSA\nSubkey-Usage: encrypt\nSubkey-Length: ";
        break;
      default:
        return null;
    }

    inputData += keyLength + "\n";
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
          keygenProcess = null;
          try {
            if (result.exitCode === 0) {
              EnigmailKeyRing.invalidateUserIdList();
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

    keygenProcess = proc;

    EnigmailLog.DEBUG("keyRing.jsm: generateKey: subprocess = " + proc + "\n");

    return proc;
  },

  /**
   * Get a list of all valid (= usable) secret keys
   *
   *  win:     nsIWindow: optional parent window
   *  refresh: Boolean:   optional. true ->  re-load keys from gpg
   *                                false -> use cached values if available
   */
  getSecretKeys: function(win, refresh) {
    // return a sorted array containing objects of (valid, usable) secret keys.
    // @return: [ {name: <userId>, id: 0x1234ABCD, created: YYYY-MM-DD },  { ... } ]
    const exitCodeObj = {};
    const errorMsgObj = {};

    if (!refresh) refresh = false;
    const keyList = EnigmailKeyRing.getUserIdList(true, refresh, exitCodeObj, {}, errorMsgObj);

    if (exitCodeObj.value !== 0 && keyList.length === 0) {
      EnigmailDialog.alert(win, errorMsgObj.value);
      return null;
    }

    const userList = keyList.split(/\n/);
    const secretKeyList = [];
    const secretKeyCreated = [];

    let keyId = null;
    const keys = [];
    for (let i = 0; i < userList.length; i++) {
      if (userList[i].substr(0, 4) == "sec:") {
        let aLine = userList[i].split(/:/);
        keyId = aLine[KEY_ID];
        secretKeyCreated[keyId] = EnigmailTime.getDateTime(aLine[CREATED_ID], true, false);
        secretKeyList.push(keyId);
      }
    }

    const userList2 = EnigmailKeyRing.getKeyDetails(secretKeyList.join(" "), false, false).split(/\n/);

    for (let i = 0; i < userList2.length; i++) {
      let aLine = userList2[i].split(/:/);
      switch (aLine[ENTRY_ID]) {
        case "pub":
          if (aLine[KEY_TRUST_ID].search(/[muf]/) === 0) keyId = aLine[KEY_ID]; // public key is valid
          break;
        case "uid":
          if ((keyId) && (aLine[KEY_TRUST_ID].search(/[muf]/) === 0)) {
            // UID is valid
            keys.push({
              name: EnigmailData.convertGpgToUnicode(aLine[USERID_ID]),
              id: keyId,
              created: secretKeyCreated[keyId]
            });
            keyId = null;
          }
      }
    }

    keys.sort(function(a, b) {
      return a.name == b.name ? (a.id < b.id ? -1 : 1) : (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1);
    });
    return keys;
  }
};

/**
 * Get key list from GnuPG. If the keys may be pre-cached already
 *
 * @win        - |object| parent window for displaying error messages
 * @secretOnly - |boolean| true: get secret keys / false: get public keys
 * @refresh    - |boolean| if true, cache is cleared and all keys are loaded from GnuPG
 *
 * @return - |array| of : separated key list entries as specified in GnuPG doc/DETAILS
 */
function obtainKeyList(win, secretOnly, refresh) {
  EnigmailLog.DEBUG("keyRing.jsm: obtainKeyList\n");

  let userList = null;
  try {
    const exitCodeObj = {};
    const errorMsgObj = {};

    userList = EnigmailKeyRing.getUserIdList(secretOnly,
      refresh,
      exitCodeObj, {},
      errorMsgObj);
    if (exitCodeObj.value !== 0) {
      EnigmailDialog.alert(win, errorMsgObj.value);
      return null;
    }
  }
  catch (ex) {
    EnigmailLog.ERROR("ERROR in keyRing.jsm: obtainKeyList: " + ex.toString() + "\n");
  }

  if (typeof(userList) == "string") {
    return userList.split(/\n/);
  }
  else {
    return [];
  }
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
      return (EnigmailTrust.trustLevelsSorted().indexOf(keyListObj.keyList[a.keyNum].ownerTrust) < EnigmailTrust.trustLevelsSorted().indexOf(keyListObj.keyList[b.keyNum].ownerTrust)) ? -
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
  let listText = EnigmailKeyRing.getUserIdList(false, false, exitCodeObj, statusFlags, errorMsg);

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
  let regexPub = new RegExp("^pub:", "ym");
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
    this.keySize = "";
  }
  this.type = lineArr[ENTRY_ID];
  this.SubUserIds = [];
  this.subKeys = [];
  this.fpr = "";
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
      let r = EnigmailKeyRing.getKeySig(this.keyId, exitCodeObj, errorMsgObj);

      if (r.length > 0) {
        this._sigList = EnigmailKeyRing.extractSignatures(r, false);
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
      if (typeof i === "object") {
        cp[i] = EnigmailFuncs.cloneObj(this[i]);
      }
      else if (i !== "signatures") {
        cp[i] = this[i];
      }
    }

    return cp;
  }
};

EnigmailKeyRing.clearCache();
