/* global test: false, do_load_module: false, do_get_cwd: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("rng.jsm"); /*global EnigmailRNG: false, testing: false, Assert: false, bytesToUInt: false */

test(function testConversionFromByteObjectToUnsignedInteger(){
  // 1100 1110 0000 1001 1100 0111 1101 1111
  let expected = 3456747487;
  let byteObject = {
    0:206, // 1100 1110
    1:9,   // 0000 1001
    2:199, // 1100 0111
    3:223  // 1101 1111
  };

  Assert.equal(bytesToUInt(byteObject), expected);
});

test(function getDifferentUint32(){
  Assert.notEqual(EnigmailRNG.generateRandomUint32(), EnigmailRNG.generateRandomUint32());
});
