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
   * Synchronize a promise
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

  async getKeySignatures(keyId) {
    return null;
  }
}
