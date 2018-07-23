/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false */
/*global EnigmailCore: false, Cc: false, Ci: false, EnigmailFiles: false, EnigmailLog: false, EnigmailPrefs: false */
/*global Components: false, setupTestAccounts: false, setupTestAccount: false, getCurrentTime: true */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, addMacPaths: false, withEnigmail: false, withTestGpgHome: false, Cu: false*/
TestHelper.loadDirectly("tests/mailHelper.js"); /*global MailHelper: false */

MailHelper.deleteAllAccounts();

component("enigmail/files.jsm"); /*global EnigmailFiles: false */

test(withTestGpgHome(function setupTest() {
  let t = EnigmailFiles.getTempDirObj();
  t.append(".gnupgTest");
  Assert.ok(t.exists(), ".gnupg exists in tempDir");

  t.append("gpg-agent.conf");
  Assert.ok(t.exists(), ".gnupg/gpg-agent.conf exists in tempDir");

  let cfg = EnigmailFiles.readFile(t);

  Assert.ok(cfg.length > 10, "gpg-agent.conf is not empty");
}));
