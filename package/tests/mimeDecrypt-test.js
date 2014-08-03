/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


function getBoundary_test() {
  var got = getBoundary("content-type: application/pgp-encrypted;\n  boundary='abc'; procol='any'\n");
  Assert.equal(got, "abc", "get boundary 1");
  got = getBoundary("content-type: application/pgp-encrypted; boundary='abc'; protocol='any'");
  Assert.equal(got, "abc", "get boundary 2");
  got = getBoundary('content-type: application/pgp-encrypted; boundary="abc"; protocol="any"');
  Assert.equal(got, "abc", "get boundary 2");
}

function run_test() {

  // load mimeDecrypt.js into current context
  var md = do_get_cwd().parent;
  md.append("mimeDecrypt.js");
  do_load_module("file://" + md.path);

  getBoundary_test();
}

