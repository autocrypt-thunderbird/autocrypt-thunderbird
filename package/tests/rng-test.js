/* global test: false, do_load_module: false, do_get_cwd: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("rng.jsm"); /*global EnigmailRNG: false, testing: false, Assert: false, bytesToUInt: false */

test(function getDifferentUint32() {
  Assert.notEqual(EnigmailRNG.generateRandomUint32(), EnigmailRNG.generateRandomUint32());
  Assert.notEqual(EnigmailRNG.generateRandomString(15), EnigmailRNG.generateRandomString(15));
  Assert.equal(EnigmailRNG.generateRandomString(15).length, 15);
});
