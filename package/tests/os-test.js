/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global TestHelper: false, withEnvironment: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, withEnigmail: false, component: false, withTestGpgHome: false, osUtils: false */

testing("os.jsm"); /*global EnigmailOS: false, operatingSystem: true, isMac: false, isDosLike: false, isWin32: false */

component("enigmail/execution.jsm"); /*global EnigmailExecution: false */

function withOS(os, f) {
  return function() {
    const oldOs = operatingSystem;
    operatingSystem = os;
    try {
      f();
    }
    finally {
      operatingSystem = oldOs;
    }
  };
}

test(withOS("Darwin", function shouldReturnTrueWhenSystemIsMac() {
  Assert.equal(isMac(), true);
}));

test(withOS("Linux", function shouldReturnFalseWhenSystemIsLinux() {
  Assert.equal(isMac(), false);
}));

test(withOS("Linux", function shouldReturnFalseWhenSystemIsLinux() {
  Assert.equal(isWin32(), false);
}));

test(withOS("WINNT", function shouldReturnTrueWhenSystemIsWin32() {
  Assert.equal(isWin32(), true);
}));

test(withOS("OS2", function shouldBeDosLikeWhenSystemIsWindows() {
  Assert.equal(isDosLike(), true);
}));

test(withOS("WINNT", function shouldBeDosLikeWhenSystemIsWindows32() {
  Assert.equal(isDosLike(), true);
}));

test(withOS("Darwin", function shouldNotBeDosLikeWhenSystemIsMac() {
  Assert.equal(isDosLike(), false);
}));
