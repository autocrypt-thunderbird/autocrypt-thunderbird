/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("encryption.jsm"); /*global EnigmailEncryption: false, nsIEnigmail: false */
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: fales */
component("enigmail/armor.jsm"); /*global EnigmailArmor: fales */
component("enigmail/Locale.jsm"); /*global EnigmailLocale: fales */

test(withTestGpgHome(withEnigmail(function shouldSignMessage() {
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  const revocationCert = do_get_file("resources/dev-strike.rev", false);
  const errorMsgObj = {};
  const importedKeysObj = {};
  EnigmailKeyRing.importKeyFromFile(secretKey, errorMsgObj, importedKeysObj);
  const parentWindow = JSUnit.createStubWindow();
  const plainText = "Hello there!";
  const strikeAccount = "strike.devtest@gmail.com";
  const exitCodeObj = {};
  const statusFlagObj = {};
  const encryptResult = EnigmailEncryption.encryptMessage(parentWindow,
    nsIEnigmail.UI_TEST,
    plainText,
    strikeAccount,
    strikeAccount,
    "",
    nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED,
    exitCodeObj,
    statusFlagObj,
    errorMsgObj
  );
  Assert.equal(0, exitCodeObj.value);
  Assert.equal(0, errorMsgObj.value);
  Assert.equal(true, (statusFlagObj.value == nsIEnigmail.SIG_CREATED));
  const blockType = EnigmailArmor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
  Assert.equal("SIGNED MESSAGE", blockType);

  let r = EnigmailEncryption.determineOwnKeyUsability(nsIEnigmail.SEND_SIGNED, "strike.devtest@gmail.com");
  Assert.equal(r.keyId, "65537E212DC19025AD38EDB2781617319CE311C4");

  EnigmailKeyRing.importKeyFromFile(revocationCert, errorMsgObj, importedKeysObj);
  r = EnigmailEncryption.determineOwnKeyUsability(nsIEnigmail.SEND_SIGNED, "0x65537E212DC19025AD38EDB2781617319CE311C4");
  Assert.equal(r.errorMsg, EnigmailLocale.getString("keyRing.pubKeyRevoked", ["anonymous strike <strike.devtest@gmail.com>", "0x781617319CE311C4"]));
})));

test(withTestGpgHome(withEnigmail(function shouldEncryptMessage() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const errorMsgObj = {};
  const importedKeysObj = {};
  EnigmailKeyRing.importKeyFromFile(publicKey, errorMsgObj, importedKeysObj);
  const parentWindow = JSUnit.createStubWindow();
  const plainText = "Hello there!";
  const strikeAccount = "strike.devtest@gmail.com";
  const exitCodeObj = {};
  const statusFlagObj = {};
  const encryptResult = EnigmailEncryption.encryptMessage(parentWindow,
    nsIEnigmail.UI_TEST,
    plainText,
    strikeAccount,
    strikeAccount,
    "",
    nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_ENCRYPTED | nsIEnigmail.SEND_ALWAYS_TRUST,
    exitCodeObj,
    statusFlagObj,
    errorMsgObj
  );
  Assert.equal(0, exitCodeObj.value);
  Assert.equal(0, errorMsgObj.value);
  Assert.equal(true, (statusFlagObj.value & nsIEnigmail.END_ENCRYPTION) !== 0);
  const blockType = EnigmailArmor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
  Assert.equal("MESSAGE", blockType);

  let r = EnigmailEncryption.determineOwnKeyUsability(nsIEnigmail.SEND_ENCRYPTED, "strike.devtest@gmail.com");
  Assert.equal(r.keyId, "65537E212DC19025AD38EDB2781617319CE311C4");
})));

test(withTestGpgHome(withEnigmail(function shouldGetErrorReason() {
  let r = EnigmailEncryption.determineOwnKeyUsability(nsIEnigmail.SEND_SIGNED, "strike.devtest@gmail.com");
  let expected = EnigmailLocale.getString("keyRing.noSecretKey", ["anonymous strike <strike.devtest@gmail.com>", "0x781617319CE311C4"]) + "\n";
  Assert.equal(r.errorMsg, expected);

  r = EnigmailEncryption.determineOwnKeyUsability(nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED, "nobody@notfound.net");
  expected = EnigmailLocale.getString("errorOwnKeyUnusable", "nobody@notfound.net");
  Assert.equal(r.errorMsg, expected);

})));
