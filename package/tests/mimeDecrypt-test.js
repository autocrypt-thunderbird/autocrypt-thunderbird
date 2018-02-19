/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EnigmailMime = {
  extractProtectedHeaders: function(str) {
    return {
      startPos: 10,
      endPos: 22,
      newHeaders: {
        subject: "The hidden subject"
      }
    };
  }
};

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("mimeDecrypt.jsm"); /* global EnigmailMimeDecrypt: false */


test(function extractEncryptedHeadersTest() {
  var dec = EnigmailMimeDecrypt.newPgpMimeHandler();
  dec.decryptedData = 'This is a Hello World example';

  dec.extractEncryptedHeaders();

  var expected = 'This is a example';

  var got = dec.decryptedData;
  Assert.equal(got, expected, "removed rfc822 header");

  got = dec.decryptedHeaders.subject;
  expected = "The hidden subject";
  Assert.equal(got, expected, "subject");
});
