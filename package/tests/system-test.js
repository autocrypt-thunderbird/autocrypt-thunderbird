/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global TestHelper: false, withEnvironment: false, nsIWindowsRegKey: true */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");
/*global TestHelper: false, withEnvironment: false, withEnigmail: false, component: false,
  withTestGpgHome: false, osUtils: false, unescape: false */

testing("system.jsm"); /*global EnigmailSystem: false, Cc: false, Ci: false */
component("enigmail/os.jsm"); /*global EnigmailOS: false */


function testEncoding(charset, from, to) {
  from = unescape(from);
  to = unescape(to);
  let result = EnigmailSystem.convertNativeToUnicode(from, charset);
  Assert.equal(result, to, "Charset=" + charset);
}

// Test functions simulating a Windows environment
test(function shouldTestWindowsCharsetConversion() {
  EnigmailOS.isWin32 = true;

  testEncoding("65001", "%E3%82%B5%E3%83%9D%E3%83%BC%E3", "%u30B5%u30DD%u30FC");
  testEncoding("20932", "%A7%B1%A7%E0%A7%D5%A7%D5%A7%D6", "%u041F%u043E%u0434%u0434%u0435");
});

// Test functions simulating a Unix environment
test(function shouldTestUnixCharsetConversion() {
  EnigmailOS.isWin32 = false;

  let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
  let lc = env.set("LC_ALL", "ru_RU.UTF-8");
  let cs = EnigmailSystem.determineSystemCharset();
  Assert.equal(cs, "UTF-8");
  testEncoding(cs, "%E3%82%B5%E3%83%9D%E3%83%BC%E3", "%u30B5%u30DD%u30FC");
});
