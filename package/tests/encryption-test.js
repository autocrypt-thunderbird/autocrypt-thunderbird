/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("encryption.jsm"); /*global Encryption: false, nsIEnigmail: false */
component("enigmail/keyRing.jsm"); /*global KeyRing: fales */
component("enigmail/armor.jsm"); /*global EnigmailArmor: fales */

test(withTestGpgHome(withEnigmail(function shouldSignMessage() {
    const secretKey = do_get_file("resources/dev-strike.sec", false);
    const errorMsgObj = {};
    const importedKeysObj = {};
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), secretKey, errorMsgObj, importedKeysObj);
    const parentWindow = JSUnit.createStubWindow();
    const plainText = "Hello there!";
    const strikeAccount = "strike.devtest@gmail.com";
    const exitCodeObj = {};
    const statusFlagObj = {};
    const encryptResult = Encryption.encryptMessage(parentWindow,
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
})));

test(withTestGpgHome(withEnigmail(function shouldEncryptMessage() {
    const publicKey = do_get_file("resources/dev-strike.asc", false);
    const errorMsgObj = {};
    const importedKeysObj = {};
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    const parentWindow = JSUnit.createStubWindow();
    const plainText = "Hello there!";
    const strikeAccount = "strike.devtest@gmail.com";
    const exitCodeObj = {};
    const statusFlagObj = {};
    const encryptResult = Encryption.encryptMessage(parentWindow,
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
})));
