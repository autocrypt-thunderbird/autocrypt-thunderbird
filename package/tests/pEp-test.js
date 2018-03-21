/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*global dump: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("pEp.jsm"); /*global EnigmailpEp: false */
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: fales */


test(withTestGpgHome(withEnigmail(function shouldEncryptMessage() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const errorMsgObj = {};
  const importedKeysObj = {};
  EnigmailKeyRing.importKeyFromFile(publicKey, errorMsgObj, importedKeysObj);
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(secretKey, errorMsgObj, importedKeysObj);

  do_test_pending();
  //EnigmailpEp.encryptMessage("strike.devtest@gmail.com", ["strike.devtest@gmail.com"], "Hello", "Test message", 1).
  EnigmailpEp.encryptMessage("strike.devtest@gmail.com", ["strike.devtest@gmail.com"], "Hello", {"longmsg":"Test message"}, 1).
  then(function _encryptedMessage(a) {
    let txt = a.result[0].longmsg;
    Assert.equal("-----BEGIN PGP MESSAGE-----", txt.substr(0, 27));

    return EnigmailpEp.decryptMessage(txt, "strike.devtest@gmail.com");
  }).
  then(function _decryptedMessage(b) {
    let txt = b.result[3].longmsg;
    Assert.equal("Subject: Hello\n\nTest message", txt.replace(/\r\n/g, "\n"));

    return EnigmailpEp.getPepVersion();
  }).
  then(function _f(a) {
    Assert.ok(a && a.length > 0);

    return EnigmailpEp.setIdentity("strike.devtest@gmail.com", "Enigmail-UnitTest-User", "anonymous strike", "65537E212DC19025AD38EDB2781617319CE311C4");
  }).
  then(function _f(a) {
    Assert.equal(0, a.result[0].status);

    return EnigmailpEp.getIdentity({ address: "strike.devtest@gmail.com"});
  }).
  then(function _f(a) {
    Assert.equal("65537E212DC19025AD38EDB2781617319CE311C4", a.result[0].fpr);

    return EnigmailpEp.getIdentityRating("strike.devtest@gmail.com", "Enigmail-UnitTest-User");
  }).
  then(function _f(a) {

    Assert.equal(6, a.result[0].color);
    return EnigmailpEp.getTrustWords("65537E212DC19025AD38EDB2781617319CE311C4", "en", 6);
  }).
  then(function _f(a) {
    Assert.equal("KATINKA NETTLE CULTIVATION PREFACE STANDARDIZE CHIMERA ", a.result[1]);
    do_test_finished();
  }).
  catch(function _f(t) {
    Assert.equal("", "Error: " + t.code);
    do_test_finished();
  });
})));
