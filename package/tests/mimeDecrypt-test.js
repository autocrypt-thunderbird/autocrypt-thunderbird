/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("mimeDecrypt.js"); /* global PgpMimeDecrypt: false */

test(function extractEncryptedHeadersTest() {
  var dec = new PgpMimeDecrypt();
  dec.decryptedData = 'Content-Type: multipart/mixed; boundary="OuterBoundary"\n'+
    '\n'+
    '--OuterBoundary\n'+
    'Content-Transfer-Encoding: base64\n'+
    'Content-Type: text/rfc822-headers; charset="us-ascii";\n'+
    '  memoryhole="v1,<12345678@enigmail-test.net>"\n'+
    'Content-Disposition: inline\n'+
    '\n'+
    'U3ViamVjdDogVGhlIGhpZGRlbiBzdWJqZWN0CkRhdGU6IFN1biwgMjEgSnVuIDIwMTUgMT\n'+
    'U6MTk6MzIgKzAyMDAKRnJvbTogU3RhcndvcmtzIDxzdHJpa2VmcmVlZG9tQGVuaWdtYWls\n'+
    'LXRlc3QubmV0PgpUbzogUGF0cmljayA8cGF0cmlja0BlbmlnbWFpbC10ZXN0Lm5ldD4sIE\n'+
    'JpbmdvIDxiaW5nb0BlbmlnbWFpbC10ZXN0Lm5ldD4KQ2M6IFBhdHJpY2sgPHBhdHJpY2sy\n'+
    'QGVuaWdtYWlsLXRlc3QubmV0PiwgQmluZ28gPDJiaW5nb0BlbmlnbWFpbC10ZXN0Lm5ldD\n'+
    '4KUmVwbHktVG86IFN0YXJ3b3JrcyBhbHRlcm5hdGl2ZSA8YWx0ZXJuYXRpdmVAZW5pZ21h\n'+
    'aWwtdGVzdC5uZXQ+Cg==\n'+
    '\n'+
    '--OuterBoundary\n'+
    'Content-Type: multipart/mixed; boundary="innerContent"\n'+
    '\n'+
    '--innerContent\n'+
    'Content-Type: text/plain; charset="us-ascii"\n'+
    '\n'+
    'Hello World!\n'+
    '\n'+
    '--innerContent--\n'+
    '--OuterBoundary--\n\n';

  dec.extractEncryptedHeaders();

  var expected = 'Content-Type: multipart/mixed; boundary="OuterBoundary"\n'+
    '\n'+
    '--OuterBoundary\n'+
    'Content-Type: multipart/mixed; boundary="innerContent"\n'+
    '\n'+
    '--innerContent\n'+
    'Content-Type: text/plain; charset="us-ascii"\n'+
    '\n'+
    'Hello World!\n'+
    '\n'+
    '--innerContent--\n'+
    '--OuterBoundary--\n\n';

  var got = dec.decryptedData;
  Assert.equal(got, expected, "removed rfc822 header");

  got = dec.decryptedHeaders.subject;
  expected = "The hidden subject";
  Assert.equal(got, expected, "subject");

  got = dec.decryptedHeaders.from;
  expected = "Starworks <strikefreedom@enigmail-test.net>";
  Assert.equal(got, expected, "from");

  got = dec.decryptedHeaders.to;
  expected = "Patrick <patrick@enigmail-test.net>, Bingo <bingo@enigmail-test.net>";
  Assert.equal(got, expected, "to");

  got = dec.decryptedHeaders.cc;
  expected = "Patrick <patrick2@enigmail-test.net>, Bingo <2bingo@enigmail-test.net>";
  Assert.equal(got, expected, "cc");

  got = dec.decryptedHeaders["reply-to"];
  expected = "Starworks alternative <alternative@enigmail-test.net>";
  Assert.equal(got, expected, "reply-to");

  got = dec.decryptedHeaders.date;
  expected = "Sun, 21 Jun 2015 15:19:32 +0200";
  Assert.equal(got, expected, "Sun, 21 Jun 2015 15:19:32 +0200");

});
