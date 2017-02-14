/*global do_subtest: false, Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

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

execTest("armor-test.js");
execTest("data-test.js");
execTest("system-test.js");
execTest("decryption-test.js");
execTest("decryptPermanently-test.js");
execTest("errorHandling-test.js");
execTest("encryption-test.js");
execTest("gpgAgent-test.js");
execTest("enigmail-test.js");
execTest("files-test.js");
execTest("streams-test.js");
execTest("keyRing-test.js");
execTest("keyEditor-test.js");
execTest("keyserver-test.js");
execTest("keyserverUris-test.js");
execTest("locale-test.js");
execTest("log-test.js");
execTest("mime-test.js");
execTest("os-test.js");
execTest("prefs-test.js");
execTest("rules-test.js");
execTest("funcs-test.js");
execTest("mimeDecrypt-test.js");
execTest("expiry-test.js");
execTest("installGnuPG-test.js");
execTest("keyRefreshService-test.js");
execTest("tor-test.js");
execTest("versioning-test.js");
execTest("rng-test.js");
execTest("filters-test.js");

// execTest("pep-test.js"); // not yet enabled
