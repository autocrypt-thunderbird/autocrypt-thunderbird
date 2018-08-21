/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("verify.jsm"); /*global EnigmailVerifyAttachment: false */
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */

/* TODO: write higher level test based on actual message */

test(withTestGpgHome(withEnigmail(function shouldVerifyAttachment() {
  loadSecretKey();
  loadPublicKey();

  const attachment = do_get_file("resources/attachment.txt", false);
  const signature = do_get_file("resources/attachment.txt.asc", false);
  do_test_pending();
  let promise = EnigmailVerifyAttachment.attachment(attachment, signature);
  promise.then(function(result) {
    Assert.assertContains(result, 'Good signature from anonymous strike');
    Assert.assertContains(result, 'Key ID: 0x0x65537E212DC19025AD38EDB2781617319CE311C');
    do_test_finished();
  });
})));


var loadSecretKey = function() {
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(secretKey, [], {});
};

var loadPublicKey = function() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, [], {});
};
