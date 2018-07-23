/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/**
 * CryptoAPI - abstract interface
 */

/*global Components: false, Cc: false, Ci: false, Cu: false */

var inspector;

class CryptoAPI {
  constructor() {
    this.api_name = "null";
  }

  get apiName() {
    return this.api_name;
  }

  /**
   * Synchronize a promise: wait synchonously until a promise has completed and return
   * the value that the promise returned.
   *
   * @param {Promise} promise: the promise to wait for
   *
   * @return {Variant} whatever the promise returns
   */
  sync(promise) {
    if (!inspector) {
      inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
    }

    let res = null;
    let p = promise.then(gotResult => {
      res = gotResult;
      inspector.exitNestedEventLoop();
    }).catch(gotResult => {
      res = gotResult;
      inspector.exitNestedEventLoop();
    });

    inspector.enterNestedEventLoop(0);

    return res;
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
    return null;
  }

  /**
   * Export the minimum key for the public key object:
   * public key, primary user ID, newest encryption subkey
   *
   * @param {String} fpr: a single FPR
   *
   * @return {Promise<Object>}:
   *    - exitCode (0 = success)
   *    - errorMsg (if exitCode != 0)
   *    - keyData: BASE64-encded string of key data
   */
  async getMinimalPubKey(fpr) {
    return {
      exitCode: -1,
      errorMsg: "",
      keyData: ""
    };
  }

  /**
   * Get a minimal stripped key containing only:
   * - The public key
   * - the primary UID + its self-signature
   * - the newest valild encryption key + its signature packet
   *
   * @param {String} armoredKey: Key data (in OpenPGP armored format)
   *
   * @return {Promise<Uint8Array, or null>}
   */

  async getStrippedKey(armoredKey) {
    return null;
  }

  /**
   * Get the list of all konwn keys (including their secret keys)
   * @param {Array of String} onlyKeys: [optional] only load data for specified key IDs
   *
   * @return {Promise<Array of Object>}
   */
  async getKeys(onlyKeys = null) {
    return [];
  }

  /**
   * Get groups defined in gpg.conf in the same structure as KeyObject
   * [synchronous]
   *
   * @return {Array of KeyObject} with type = "grp"
   */
  getGroups() {
    return [];
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
    return null;
  }

  /**
   * Import key(s) from a file
   *
   * @param {nsIFile} inputFile:  the file holding the keys
   *
   * @return {Object} or null in case no data / error:
   *   - {Number}          exitCode:        result code (0: OK)
   *   - {Array of String) importedKeys:    imported fingerprints
   *   - {Number}          importSum:       total number of processed keys
   *   - {Number}          importUnchanged: number of unchanged keys
   */

  async importKeyFromFile(inputFile) {
    return null;
  }

  /**
   * Export secret key(s) to a file
   *
   * @param {String}  keyId       Specification by fingerprint or keyID
   * @param {Boolean} minimalKey  if true, reduce key to minimum required
   *
   * @return {Object}:
   *   - {Number} exitCode:  result code (0: OK)
   *   - {String} keyData:   ASCII armored key data material
   *   - {String} errorMsg:  error message in case exitCode !== 0
   */

  async extractSecretKey(keyId, minimalKey) {
    return null;
  }

  /**
   *
   * @param {byte} byteData    The encrypted data
   *
   * @return {String} - the name of the attached file
   */

  async getFileName(byteData) {
    return null;
  }
}
