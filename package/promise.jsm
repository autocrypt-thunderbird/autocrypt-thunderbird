/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 This module is a shim module to make it easier to load
 Promise from the various potential sources
*/

const EXPORTED_SYMBOLS = ["Promise"];

const Cu = Components.utils;

if (typeof(this.Promise) !== "function") {
  try {
    Cu.import("resource://gre/modules/commonjs/promise/core.js"); // Gecko 17 to 20
  }
  catch (ex) {
    try {
      Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js"); // Gecko 21 to 24
    }
    catch (ex2) {
      Cu.import("resource://gre/modules/Promise.jsm"); // Gecko >= 25
    }
  }
}

// This module looks a little weird, since it doesn't actually define the symbol it exports.
// As it turns out, Thunderbird already defines Promise in most cases, and if not, the above
// imports will do it.