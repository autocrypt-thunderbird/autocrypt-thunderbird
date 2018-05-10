/*global Components: false, btoa: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailKeyObj"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

/**
 This module implements the EnigmailKeyObj class with the following members:

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
*/

Cu.import("chrome://enigmail/content/modules/log.jsm"); /*global EnigmailLog: false */
Cu.import("chrome://enigmail/content/modules/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("chrome://enigmail/content/modules/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("chrome://enigmail/content/modules/key.jsm"); /*global EnigmailKey: false */
Cu.import("chrome://enigmail/content/modules/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("chrome://enigmail/content/modules/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("chrome://enigmail/content/modules/time.jsm"); /*global EnigmailTime: false */
Cu.import("chrome://enigmail/content/modules/data.jsm"); /*global EnigmailData: false */
Cu.import("chrome://enigmail/content/modules/lazy.jsm"); /*global EnigmailLazy: false */
Cu.import("chrome://enigmail/content/modules/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("chrome://enigmail/content/modules/files.jsm"); /*global EnigmailFiles: false */

const getDialog = EnigmailLazy.loader("enigmail/dialog.jsm", "EnigmailDialog");
const getOpenPGP = EnigmailLazy.loader("enigmail/openpgp.jsm", "EnigmailOpenPGP");

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

const UNKNOWN_SIGNATURE = "[User ID not found]";

class EnigmailKeyObj {
  constructor(keyData) {
    this.keyId = "";
    this.expiry = "";
    this.expiryTime = 0;
    this.created = "";
    this.keyTrust = "";
    this.keyUseFor = "";
    this.ownerTrust = "";
    this.algoSym = "";
    this.keySize = "";
    this.type = keyData.type;
    if ("keyId" in keyData) this.keyId = keyData.keyId;
    if ("expiryTime" in keyData) {
      this.expiryTime = keyData.expiryTime;
      this.expiry = EnigmailTime.getDateTime(keyData.expiryTime, true, false);
    }
    if ("created" in keyData) this.created = keyData.created;
    if ("keyTrust" in keyData) this.keyTrust = keyData.keyTrust;
    if ("keyUseFor" in keyData) this.keyUseFor = keyData.keyUseFor;
    if ("ownerTrust" in keyData) this.ownerTrust = keyData.ownerTrust;
    if ("algoSym" in keyData) this.algoSym = keyData.algoSym;
    if ("keySize" in keyData) this.keySize = keyData.keySize;

    this.userIds = [];
    this.subKeys = [];
    this.fpr = "";
    this.minimalKeyBlock = null;
    this.photoAvailable = false;
    this.secretAvailable = false;
    this._sigList = null;
  }

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
  }

  /**
   * create a copy of the object
   */
  clone() {
    let cp = new EnigmailKeyObj(["copy"]);
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
  }

  /**
   * Does the key have secondary user IDs?
   *
   * @return: Boolean - true if yes; false if no
   */
  hasSubUserIds() {
    let nUid = 0;
    for (let i in this.userIds) {
      if (this.userIds[i].type === "uid") ++nUid;
    }

    return nUid >= 2;
  }

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
  }

  /**
   * Is the function to set owner trust available for the key?
   * Requirements: The key is signed with at least medium validity level,
   * or the secret key is available.
   *
   * @return Boolean true if yes
   */
  isOwnerTrustUseful() {
    if (this.secretAvailable) return true;
    if (this.keyTrust.search(/^[fu]/) === 0) return true;

    return false;
  }

  /**
   * Determine if the public key is valid. If not, return a description why it's not
   *
   * @return Object:
   *   - keyValid: Boolean (true if key is valid)
   *   - reason: String (explanation of invalidity)
   */
  getPubKeyValidity() {
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
  }


  /**
   * Check whether a key can be used for signing and return a description of why not
   *
   * @return Object:
   *   - keyValid: Boolean (true if key is valid)
   *   - reason: String (explanation of invalidity)
   */
  getSigningValidity() {
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
  }

  /**
   * Check whether a key can be used for encryption and return a description of why not
   *
   * @return Object:
   *   - keyValid: Boolean (true if key is valid)
   *   - reason: String (explanation of invalidity)
   */
  getEncryptionValidity() {
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
  }

  /**
   * Determine the next expiry date of the key. This is either the public key expiry date,
   * or the maximum expiry date of a signing or encryption subkey. I.e. this returns the next
   * date at which the key cannot be used for signing and/or encryption anymore
   *
   * @return Number - The expiry date as seconds after 01/01/1970
   */
  getKeyExpiry() {
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
  }

  /**
   * Export the minimum key for the public key object:
   * public key, primary user ID, newest encryption subkey
   *
   * @return Object:
   *    - exitCode (0 = success)
   *    - errorMsg (if exitCode != 0)
   *    - keyData: BASE64-encded string of key data
   */

  getMinimalPubKey() {
    EnigmailLog.DEBUG("keyObj.jsm: EnigmailKeyObj.getMinimalPubKey: " + this.keyId + "\n");

    let retObj = {
      exitCode: 0,
      errorMsg: "",
      keyData: ""
    };

    if (!this.minimalKeyBlock) {
      let args = EnigmailGpg.getStandardArgs(true);
      args = args.concat(["--export-options", "export-minimal,no-export-attributes", "-a", "--export", this.fpr]);

      const statusObj = {};
      const exitCodeObj = {};
      let keyBlock = EnigmailExecution.simpleExecCmd(EnigmailGpg.agentPath, args, exitCodeObj, statusObj);
      let exportOK = true;

      if (EnigmailGpg.getGpgFeature("export-result")) {
        // GnuPG 2.1.10+
        let r = new RegExp("^\\[GNUPG:\\] EXPORTED " + this.fpr, "m");
        if (statusObj.value.search(r) < 0) {
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
        this.minimalKeyBlock = null;
        let minKey = getStrippedKey(keyBlock);
        if (minKey) {
          this.minimalKeyBlock = btoa(String.fromCharCode.apply(null, minKey));
        }

        if (!this.minimalKeyBlock) {
          retObj.exitCode = 1;
          retObj.errorMsg = "No valid (sub-)key";
        }
      }
    }

    retObj.keyData = this.minimalKeyBlock;
    return retObj;
  }

  /**
   * Obtain a "virtual" key size that allows to compare different algorithms with each other
   * e.g. elliptic curve keys have small key sizes with high cryptographic strength
   *
   *
   * @return Number: a virtual size
   */
  getVirtualKeySize() {
    EnigmailLog.DEBUG("keyObj.jsm: EnigmailKeyObj.getVirtualKeySize: " + this.keyId + "\n");

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
}

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
  EnigmailLog.DEBUG("keyObj.jsm: EnigmailKeyObj.getStrippedKey()\n");

  try {
    let openpgp = getOpenPGP().openpgp;
    let msg = openpgp.key.readArmored(armoredKey);

    if (!msg || msg.keys.length === 0) return null;

    let key = msg.keys[0];
    let uid = EnigmailFuncs.syncPromise(key.getPrimaryUser());
    if (!uid || !uid.user) return null;

    let encSubkey = EnigmailFuncs.syncPromise(key.getEncryptionKeyPacket());
    let foundSubKey = null;

    for (let i = 0; i < key.subKeys.length; i++) {
      if (key.subKeys[i].subKey === encSubkey) {
        foundSubKey = key.subKeys[i];
        break;
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
    EnigmailLog.DEBUG("keyRing.jsm: EnigmailKeyObj.getStrippedKey: ERROR " + ex.message + "\n");
  }
  return null;
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
