/*global do_subtest: false, Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

function execTest(filename) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);

  let testcases = env.get("JS_TEST");

  if (testcases && testcases.length > 0) {
    if (testcases.search(filename) >= 0) do_subtest(filename);
  }
  else
    do_subtest(filename);
}


// the subprocess tests
execTest("enigmailMsgComposeOverlay-test-a_e.js");
execTest("enigmailMsgComposeOverlay-test-f_h.js");
execTest("enigmailMsgComposeOverlay-test-i_r.js");
execTest("enigmailMsgComposeOverlay-test-s_t.js");
execTest("enigmailMsgComposeOverlay-test-u_z.js");
