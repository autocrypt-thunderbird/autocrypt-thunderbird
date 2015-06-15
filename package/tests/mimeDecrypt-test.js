/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false */
/*global getBoundary: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("mimeDecrypt.js");

test(function getBoundaryTest() {
  var got = getBoundary("content-type: application/pgp-encrypted;\n  boundary='abc'; procol='any'\n");
  Assert.equal(got, "abc", "get boundary 1");
  got = getBoundary("content-type: application/pgp-encrypted; boundary='abc'; protocol='any'");
  Assert.equal(got, "abc", "get boundary 2");
  got = getBoundary('content-type: application/pgp-encrypted; boundary="abc"; protocol="any"');
  Assert.equal(got, "abc", "get boundary 2");
});
