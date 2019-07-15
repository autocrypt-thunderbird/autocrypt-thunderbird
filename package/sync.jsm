/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailSync"];

/*global Cc: false, Ci: false */

var inspector;

var EnigmailSync = {
  /**
   * Synchronize a promise: wait synchonously until a promise has completed and return
   * the value that the promise returned.
   *
   * @param {Promise} promise: the promise to wait for
   *
   * @return {Variant} whatever the promise returns
   */
  sync: function(promise) {
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
};
