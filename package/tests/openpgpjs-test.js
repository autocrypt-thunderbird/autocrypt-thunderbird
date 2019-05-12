/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false */
/*global do_test_pending: false, do_test_finished: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("cryptoAPI/openpgp-js.js"); /*global getOpenPGPjsAPI: false */

test(function testGetStrippedKey() {
  const cApi = getOpenPGPjsAPI();

  const pubKey = "-----BEGIN PGP PUBLIC KEY BLOCK-----" +
    "\n" +
    "\n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" +
    "\nsnHSt1DRJA==" +
    "\n=I9l9" +
    "\n-----END PGP PUBLIC KEY BLOCK-----";

  let minKey = cApi.sync(cApi.getStrippedKey(pubKey));
  let got = btoa(String.fromCharCode.apply(null, minKey));
  Assert.equal(got.substr(0, 127), "xsFNBFVHm5sBEACs94Ln+RMdeyBpWQtTZ/NZnwntsB10Wd3HTgo5sdA/OOFOJrWetJfAZ/HRxiSu1bwRaFVC8p061ftTbxf8bsdfsykYJQQqPODfcO0/oY2n/Z93ya8");
  Assert.equal(got.substr(-127), "QriSRXV4ZhMhGtnhHEYqHP982gBxk4RPvEp7APCLrqgC0+N8N29eC4s3JkVkHAZx+fj5YV2H9/5wJRJ1w+kwmazhpTQsy01kEwS4NZMPe8Uvz0MgoNuF7Jx0rdQ0SQ=");
  Assert.equal(got.length, 3080);
});