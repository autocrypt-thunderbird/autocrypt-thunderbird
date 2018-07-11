/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, withTestGpgHome:false */
/*global Ec: false, Cc: false, Ci: false, do_print: false, EnigmailCore: false, EnigmailKeyEditor: false, Components: false, component: false, EnigmailPrefs: false, EnigmailExecution: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
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
    "trust", {
      trustLevel: 5
    },
    function(inputData, keyEdit, ret) {
      ret.writeTxt = "";
      ret.errorMsg = "";
      ret.quitNow = true;
      ret.exitCode = 0;
    },
    null,
    function(exitCode, errorMsg) {
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
    function(exitCode, errorMsg) {
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
    function(exitCode, errorMsg) {
      Assert.equal(exitCode, -1);
      Assert.equal("The key is already signed, you cannot sign it twice.", errorMsg);
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
  const importResult = EnigmailKeyRing.importKeyFromFile(secretKey, errorMsgObj, importedKeysObj);

  const createDate = EnigmailTime.getDateTime(1430756251, true, false);

  const expectedKey = [{
    userId: "anonymous strike <strike.devtest@gmail.com>",
    keyId: "781617319CE311C4",
    created: createDate,
    keyTrust: "u"
  }];
  do_test_pending();
  EnigmailKeyEditor.setKeyTrust(window,
    "781617319CE311C4",
    5,
    function() {
      let result = EnigmailKeyRing.getAllSecretKeys();
      Assert.equal(result.length, 1);
      Assert.equal(result[0].userId, expectedKey[0].userId);
      Assert.equal(result[0].keyId, expectedKey[0].keyId);
      Assert.equal(result[0].created, expectedKey[0].created);
      Assert.equal(result[0].keyTrust, expectedKey[0].keyTrust);
      do_test_finished();
    }
  );
})));

test(function shouldDoErrorHandling() {
  let nextCmd = "";

  /* global GpgEditorInterface: false */
  let editor = new GpgEditorInterface(null, null, "");
  editor._stdin = {
    write: function processStdin(data) {
      nextCmd = data;
    }
  };

  editor.gotData("[GNUPG:] FAILURE sign 85\n");
  Assert.ok(editor.errorMsg.length > 0);
  Assert.equal("save\n", nextCmd);

});

function importKeys() {
  var publicKey = do_get_file("resources/dev-strike.asc", false);
  var secretKey = do_get_file("resources/dev-strike.sec", false);
  var errorMsgObj = {};
  var importedKeysObj = {};
  var publicImportResult = EnigmailKeyRing.importKeyFromFile(publicKey, errorMsgObj, importedKeysObj);
  var secretImportResult = EnigmailKeyRing.importKeyFromFile(secretKey, errorMsgObj, importedKeysObj);
  return [publicImportResult, secretImportResult];
}
