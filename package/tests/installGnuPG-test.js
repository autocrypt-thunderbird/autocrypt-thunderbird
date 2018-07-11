/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false */
/*global do_test_finished: false, component: false, Cc: false, Ci: false, setupTestAccounts: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("installGnuPG.jsm"); /*global EnigmailInstallGnuPG: false, Installer: false */


test(function shouldCheckHashSum() {
  let inst = new Installer(null);
  inst.installerFile = do_get_file("resources/dev-strike.asc", false);
  inst.hash = "041af0b00ea712bf5ebe349e5cceda148e0797539ee85acd8e06ac8921c6667d"; // SHA256 sum of installerFile

  Assert.ok(inst.checkHashSum());
});
