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
   * @param promise: Promise object - the promise to wait for
   *
   * @return Variant
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
   * @param keyId:            String  - space-separated list of key IDs
   * @param ignoreUnknownUid: Boolean - if true, filter out unknown signer's UIDs
   *
   * @return Promise<Array of Object> - see extractSignatures()
   */
  async getKeySignatures(keyId, ignoreUnknownUid = false) {
      return null;
    }
    /**
     * Export the minimum key for the public key object:
     * public key, primary user ID, newest encryption subkey
     *
     * @param fpr: String  - a single FPR
     *
     * @return Promise<Object>:
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
   * @param armoredKey - String: Key data (in OpenPGP armored format)
   *
   * @return Promise<Uint8Array, or null>
   */

  async getStrippedKey(armoredKey) {
    return null;
  }
}
