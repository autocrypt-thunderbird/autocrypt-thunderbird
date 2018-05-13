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
    "\n" + "Comment: GPGTools - https://gpgtools.org" +
    "\n" +
    "\n" + "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" +
    "\n" + "LBn4tb400iHp7byO85tF/H0OOI1K" +
    "\n" + "=CVNK" +
    "\n" + "-----END PGP PUBLIC KEY BLOCK-----";

  let minKey = cApi.sync(cApi.getStrippedKey(pubKey));
  let got = btoa(String.fromCharCode.apply(null, minKey));
  Assert.equal(got.substr(0, 127), "xsFNBFVHm5sBEACs94Ln+RMdeyBpWQtTZ/NZnwntsB10Wd3HTgo5sdA/OOFOJrWetJfAZ/HRxiSu1bwRaFVC8p061ftTbxf8bsdfsykYJQQqPODfcO0/oY2n/Z93ya8");
  Assert.equal(got.substr(-127), "4Qq+ollo8K3gJgH0QONrUaRY84/hil05T4EnUZiXdzPWvhMv5lEK+pTMlO8FbOG31+aB8rxCg+wp1ovyC/fp5XjZaLHcyPAWAXKLBn4tb400iHp7byO85tF/H0OOI1K");
  Assert.equal(got.length, 2972);

});
