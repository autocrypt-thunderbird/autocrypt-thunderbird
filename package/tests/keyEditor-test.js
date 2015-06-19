/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, withTestGpgHome:false */
/*global Ec: false, Cc: false, Ci: false, do_print: false, EnigmailCore: false, EnigmailKeyEditor: false, Components: false, component: false, EnigmailPrefs: false, EnigmailExecution: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false */

testing("keyEditor.jsm"); /*global editKey: false */
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
component("enigmail/time.jsm"); /*global EnigmailTime: false */

test(withTestGpgHome(withEnigmail(function shouldEditKey() {
    importKeys();
    do_test_pending();
    var window = JSUnit.createStubWindow();
    editKey(
        window,
        false,
        null,
        "781617319CE311C4",
        "trust",
        {trustLevel: 5},
        function (inputData, keyEdit, ret) {
            ret.writeTxt = "";
            ret.errorMsg = "";
            ret.quitNow=true;
            ret.exitCode=0;
        },
        null,
        function (exitCode, errorMsg) {
            Assert.equal(exitCode, 0);
            Assert.equal("", errorMsg);
            do_test_finished();
        }
    );
})));

test(withTestGpgHome(withEnigmail(function shouldSetTrust() {
    importKeys();
    do_test_pending();
    var window = JSUnit.createStubWindow();
    EnigmailKeyEditor.setKeyTrust(window,
                          "781617319CE311C4",
                          5,
                          function (exitCode, errorMsg) {
                              Assert.equal(exitCode, 0);
                              Assert.equal("", errorMsg);
                              do_test_finished();
                          }
                         );
})));

test(withTestGpgHome(withEnigmail(function shouldSignKey() {
    importKeys();
    do_test_pending();
    var window = JSUnit.createStubWindow();
    EnigmailKeyEditor.signKey(window,
                      "anonymous strike <strike.devtest@gmail.com>",
                      "781617319CE311C4",
                      false,
                      5,
                      function (exitCode, errorMsg) {
                          Assert.equal(exitCode, 0);
                          Assert.equal("The key is already signed, you cannot sign it twice.",errorMsg);
                          do_test_finished();
                      }
                     );
})));

test(withTestGpgHome(function importKeyForEdit() {
    const result = importKeys();
    Assert.equal(result[0], 0);
    Assert.equal(result[1], 0);
}));


test(withTestGpgHome(withEnigmail(function shouldGetSecretKeys() {
    const secretKey = do_get_file("resources/dev-strike.sec", false);
    const errorMsgObj = {};
    const importedKeysObj = {};
    const window = JSUnit.createStubWindow();
    const importResult = EnigmailKeyRing.importKeyFromFile(window, secretKey, errorMsgObj, importedKeysObj);

    const createDate = EnigmailTime.getDateTime(1430756251, true, false);

    const expectedKey = [{"name": "anonymous strike <strike.devtest@gmail.com>", "id": "781617319CE311C4", "created": createDate}];
    do_test_pending();
    EnigmailKeyEditor.setKeyTrust(window,
        "781617319CE311C4",
        5,
        function() {
            const result = EnigmailKeyRing.getSecretKeys(window);
            Assert.equal(result.length, 1);
            Assert.equal(result[0].name, expectedKey[0].name);
            Assert.equal(result[0].id, expectedKey[0].id);
            // FIXME: The expected date needs to be converted to the locale of the enviroment
            Assert.equal(result[0].created, expectedKey[0].created);
            do_test_finished();
        }
    );
})));

function importKeys() {
    var window = JSUnit.createStubWindow();
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var secretKey = do_get_file("resources/dev-strike.sec", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    var publicImportResult = EnigmailKeyRing.importKeyFromFile(window, publicKey, errorMsgObj, importedKeysObj);
    var secretImportResult = EnigmailKeyRing.importKeyFromFile(window, secretKey, errorMsgObj, importedKeysObj);
    return [publicImportResult, secretImportResult];
}
