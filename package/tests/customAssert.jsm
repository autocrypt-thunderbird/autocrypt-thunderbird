/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const CustomAssert = {
  registerExtraAssertionsOn: function(assertModule) {
    assertModule.assertContains = CustomAssert.assertContains;
    assertModule.assertArrayContains = CustomAssert.assertArrayContains;
    assertModule.assertArrayNotContains = CustomAssert.assertArrayNotContains;
  },

  assertContains: function(actual, expected, message) {
    var msg = message || "Searching for <".concat(expected)
      .concat("> to be contained within ")
      .concat("<").concat(actual).concat(">");
    this.report(actual.search(expected) == -1, actual, expected, msg);
  },

  assertArrayContains: function(array, value, message) {
    this.report(array.indexOf(value) == -1, array, value, message, "contains");
  },

  assertArrayNotContains: function(array, value, message) {
    this.report(array.indexOf(value) > -1, array, value, message, "not contains");
  }
};
