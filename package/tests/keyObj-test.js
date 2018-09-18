/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, */
/*global Components: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* eslint no-useless-concat: 0*/
"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false, gKeyListObj: true */

/*global createAndSortKeyList: false */
component("enigmail/gpg.jsm"); /*global EnigmailGpg: false */
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */

testing("keyObj.jsm"); /*global EnigmailKeyObj: false */

test(withTestGpgHome(withEnigmail(function shouldExportMinimalSubkey() {
  const publicKey = do_get_file("resources/multi-uid.asc", false);
  const errorMsgObj = {};
  const importedKeysObj = {};
  const importResult = EnigmailKeyRing.importKeyFromFile(publicKey, errorMsgObj, importedKeysObj);

  Assert.assertContains(importedKeysObj.value, "ADC49530CB6B132412D856107F1568CB8997F7BA");
  Assert.equal(importResult, 0, errorMsgObj);

  const keyObj = EnigmailKeyRing.getKeyById("0x7F1568CB8997F7BA");
  Assert.assertContains(keyObj.userId, "alice@example.invalid");

  if (EnigmailGpg.getGpgFeature("export-specific-uid")) {
    // only perform test if GnuPG 2.2.9+ is available
    let minKey = keyObj.getMinimalPubKey("bob@somewhere.invalid");
    Assert.equal(minKey.exitCode, 0);

    Assert.equal(minKey.keyData.substr(0, 50), "mQGNBFub08oBDACmb04i4u8xUV1ADbnbN5l83mpr70OyWVJb5E");
    Assert.equal(minKey.keyData.substr(-50, 50), "p9TFNKjguUrrGrVnmnmy/YoGTJWuGqrZy8kcC3LCjg0k2mV0M=");
  }

  EnigmailGpg.agentVersion = "2.2.1";
  Assert.ok(!EnigmailGpg.getGpgFeature("export-specific-uid"));

  let minKey = keyObj.getMinimalPubKey("bob@somewhere.invalid");
  Assert.equal(minKey.exitCode, 0);
  Assert.equal(minKey.keyData.substr(3, 50), "NBFub08oBDACmb04i4u8xUV1ADbnbN5l83mpr70OyWVJb5ElIc");
  Assert.equal(minKey.keyData.substr(-50, 50), "p9TFNKjguUrrGrVnmnmy/YoGTJWuGqrZy8kcC3LCjg0k2mV0M=");

  minKey = keyObj.getMinimalPubKey("does@not.exist");
  Assert.equal(minKey.exitCode, 0);

  Assert.equal(minKey.keyData.substr(0, 50), "xsDNBFub08oBDACmb04i4u8xUV1ADbnbN5l83mpr70OyWVJb5E");
  Assert.equal(minKey.keyData.substr(-50, 50), "p9TFNKjguUrrGrVnmnmy/YoGTJWuGqrZy8kcC3LCjg0k2mV0M=");
})));
