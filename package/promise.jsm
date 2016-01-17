/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/*
 This module is a shim module to make it easier to load
 Promise from the various potential sources
*/

var EXPORTED_SYMBOLS = ["Promise"];

const Cu = Components.utils;

var scope = {};

try {
  Cu.import("resource://gre/modules/Promise.jsm", scope); // Gecko >= 25
}
catch (ex) {
  try {
    Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js", scope); // Gecko 21 to 24}
  }
  catch (ex2) {
    Cu.import("resource://gre/modules/commonjs/promise/core.js", scope); // Gecko 17 to 20
  }
}

var Promise = scope.Promise;
