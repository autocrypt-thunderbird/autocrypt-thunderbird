/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false */
/*global do_test_pending: false, do_test_finished: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("mime.jsm"); /*global EnigmailMime: false */

test(function getBoundaryTest() {
  var got = EnigmailMime.getBoundary("application/pgp-encrypted;\n  boundary='abc'; procol='any'\n");
  Assert.equal(got, "'abc'", "get boundary 1");
  got = EnigmailMime.getBoundary("application/pgp-encrypted; boundary='abc'; protocol='any'");
  Assert.equal(got, "'abc'", "get boundary 2");
  got = EnigmailMime.getBoundary('content-type: application/pgp-encrypted; boundary="abc"; protocol="any"');
  Assert.equal(got, "abc", "get boundary 3");
  got = EnigmailMime.getProtocol('content-type: application/pgp-encrypted; boundary="abc"; protocol="SHA123"');
  Assert.equal(got, "SHA123", "get protocol 1");
  got = EnigmailMime.getParameter('application/pgp-encrypted; boundary="abc"; protocol="any"', "BOUNDARY");
  Assert.equal(got, "abc", "getParameter 1");
  got = EnigmailMime.getParameter('parameter1=abc; Param2=\r\n abc\r\n\t\t\tdef', "param2");
  Assert.equal(got, "abcdef", "getParameter 2");
  got = EnigmailMime.getParameter('parameter1=abc; Param2=\r\n abc\r\n def', "notexist");
  Assert.equal(got, "", "getParameter 3");

});

const msg1 = 'Content-Type: multipart/mixed; boundary="OuterBoundary";\r\n' +
  '  protected-headers="v1"\r\n' +
  'References: <some@msg.id>\r\n' +
  'Subject: Outer hidden subject\r\n' +
  '\r\n' +
  '--OuterBoundary\r\n' +
  'Content-Transfer-Encoding: base64\r\n' +
  'Content-Type: text/rfc822-headers; charset="us-ascii";\r\n' +
  'Content-Disposition: inline\r\n' +
  '\r\n' +
  'U3ViamVjdDogVGhlIGhpZGRlbiBzdWJqZWN0CkRhdGU6IFN1biwgMjEgSnVuIDIwMTUgMT\r\n' +
  'U6MTk6MzIgKzAyMDAKRnJvbTogU3RhcndvcmtzIDxzdHJpa2VmcmVlZG9tQGVuaWdtYWls\r\n' +
  'LXRlc3QubmV0PgpUbzogUGF0cmljayA8cGF0cmlja0BlbmlnbWFpbC10ZXN0Lm5ldD4sIE\r\n' +
  'JpbmdvIDxiaW5nb0BlbmlnbWFpbC10ZXN0Lm5ldD4KQ2M6IFBhdHJpY2sgPHBhdHJpY2sy\r\n' +
  'QGVuaWdtYWlsLXRlc3QubmV0PiwgQmluZ28gPDJiaW5nb0BlbmlnbWFpbC10ZXN0Lm5ldD\r\n' +
  '4KUmVwbHktVG86IFN0YXJ3b3JrcyBhbHRlcm5hdGl2ZSA8YWx0ZXJuYXRpdmVAZW5pZ21h\r\n' +
  'aWwtdGVzdC5uZXQ+Cg==\r\n' +
  '\r\n' +
  '--OuterBoundary\r\n' +
  'Content-Type: multipart/mixed; boundary="innerContent"\r\n' +
  '\r\n' +
  '--innerContent\r\n' +
  'Content-Type: text/plain; charset="us-ascii"\r\n' +
  '\r\n' +
  'Hello World!\r\n' +
  '\r\n' +
  '--innerContent--\r\n' +
  '--OuterBoundary--\r\n\r\n';

const msg2 = 'Content-Type: multipart/mixed; boundary="OuterBoundary"\r\n' +
  'References: <some@msg.id>\r\n' +
  'Subject: Outer hidden subject\r\n' +
  '\r\n' +
  '--OuterBoundary\r\n' +
  'Content-Type: multipart/mixed; boundary="innerContent"\r\n' +
  '\r\n' +
  '--innerContent\r\n' +
  'Content-Type: text/plain; charset="us-ascii"\r\n' +
  '\r\n' +
  'Hello World!\r\n' +
  '\r\n' +
  '--innerContent--\r\n' +
  '--OuterBoundary--\r\n\r\n';

test(function extractProtectedHeadersTest() {

  var r = EnigmailMime.extractProtectedHeaders(msg1);
  //Assert.equal(r, 0);

  var expected = msg2;

  var got = r.startPos;
  Assert.equal(got, 144, "startPos of removed data");

  got = r.endPos;
  Assert.equal(got, 739, "endPos of removed data");

  got = r.newHeaders.subject;
  expected = "The hidden subject";
  Assert.equal(got, expected, "subject");

  got = r.newHeaders.from;
  expected = "Starworks <strikefreedom@enigmail-test.net>";
  Assert.equal(got, expected, "from");

  got = r.newHeaders.to;
  expected = "Patrick <patrick@enigmail-test.net>, Bingo <bingo@enigmail-test.net>";
  Assert.equal(got, expected, "to");

  got = r.newHeaders.cc;
  expected = "Patrick <patrick2@enigmail-test.net>, Bingo <2bingo@enigmail-test.net>";
  Assert.equal(got, expected, "cc");

  got = r.newHeaders["reply-to"];
  expected = "Starworks alternative <alternative@enigmail-test.net>";
  Assert.equal(got, expected, "reply-to");

  got = r.newHeaders.date;
  expected = "Sun, 21 Jun 2015 15:19:32 +0200";
  Assert.equal(got, expected, "date");

  got = r.newHeaders.references;
  expected = "<some@msg.id>";
  Assert.equal(got, expected, "references");
});

test(function getMimeTreeTest() {

  let tree = EnigmailMime.getMimeTree(msg1);

  Assert.ok(tree.headers.contentType.type, "multipart/mixed");
  Assert.equal(tree.subParts[0].headers.contentType.type, "text/rfc822-headers");
  Assert.equal(tree.subParts[0].headers.charset, "us-ascii");
  Assert.equal(tree.subParts[1].subParts[0].headers.contentType.type, "text/plain");
});
