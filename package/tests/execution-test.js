/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("execution.jsm"); /*global EnigmailExecution: false */
component("enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
component("enigmail/gpg.jsm"); /*global EnigmailGpg: false */

test(withTestGpgHome(withEnigmail(function shouldExecCmd() {
  const command = EnigmailGpgAgent.agentPath;

  const args = EnigmailGpg.getStandardArgs(false).
  concat(["--no-tty", "--status-fd", "1", "--logger-fd", "1", "--command-fd", "0"]).
  concat(["--list-packets", "resources/dev-strike.asc"]);
  let output = "";
  EnigmailExecution.execCmd2(command, args,
    function(pipe) {
      //Assert.equal(stdin, 0);
    },
    function(stdout) {
      output += stdout;
    },
    function(result) {
      Assert.deepEqual(result, {
        "exitCode": 0,
        "stdout": "",
        "stderr": ""
      });
    }
  );
  Assert.assertContains(output, ":public key packet:");
  Assert.assertContains(output, ":user ID packet:");
  Assert.assertContains(output, ":signature packet:");
  Assert.assertContains(output, ":public sub key packet:");
})));
