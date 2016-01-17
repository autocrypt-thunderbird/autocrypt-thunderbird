/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, */
/*global Components: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-useless-concat: 0*/
"use strict";

/* global EnigmailFiles: false */
do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false, getKeyListEntryOfKey: false, gKeyListObj: true */
Components.utils.import("resource://enigmail/trust.jsm"); /*global EnigmailTrust: false */
component("enigmail/locale.jsm"); /*global EnigmailLocale: false */

/* global getUserIdList: false, createAndSortKeyList: false, Number: false */

testing("keyRing.jsm"); /*global EnigmailKeyRing: false */

test(withTestGpgHome(withEnigmail(function shouldImportFromFileAndGetKeyDetails() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const errorMsgObj = {};
  const importedKeysObj = {};
  const importResult = EnigmailKeyRing.importKeyFromFile(publicKey, errorMsgObj, importedKeysObj);
  Assert.assertContains(importedKeysObj.value, "65537E212DC19025AD38EDB2781617319CE311C4");
  Assert.equal(importResult, 0, errorMsgObj);
  const keyDetails = EnigmailKeyRing.getValidUids("0xD535623BB60E9E71").join("\n");
  Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
})));

test(withTestGpgHome(withEnigmail(function shouldGetKeyListEntryOfKey() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const importResult = EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  const keyDetails = getKeyListEntryOfKey("0xD535623BB60E9E71");


  // Output from GnuPG varies sligtly between different versions (new output data is added
  // at the end of the list). Therefore each line is only compared to the length provided below
  let expectedListing = [
    "pub:-:4096:1:781617319CE311C4:1430756251:1556986651::-:::scESC:",
    "fpr:::::::::65537E212DC19025AD38EDB2781617319CE311C4:",
    "uid:-::::1430756251::DB54FB278F6AE719DE0DE881B17D4C762F5752A9::anonymous strike <strike.devtest@gmail.com>:",
    "sub:-:4096:1:D535623BB60E9E71:1430756251:1556986651:::::e:"
  ];

  let keyDetList = keyDetails.split(/\n\r?/);

  for (let i = 0; i < expectedListing.length; i++) {
    Assert.equal(keyDetList[i].substr(0, expectedListing[i].length), expectedListing[i]);
  }

})));


test(withTestGpgHome(withEnigmail(function shouldGetKeyFunctions() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(secretKey, {}, {});

  // search for key ID
  let k = EnigmailKeyRing.getKeyById("0x9CE311C4");
  Assert.equal(k.subKeys[0].keyId, "D535623BB60E9E71");

  // search for subkey ID
  k = EnigmailKeyRing.getKeyById("0xD535623BB60E9E71");
  Assert.equal(k.fpr, "65537E212DC19025AD38EDB2781617319CE311C4");

  Assert.equal(gKeyListObj.keySortList.length, 1);
  EnigmailKeyRing.clearCache();
  Assert.equal(gKeyListObj.keySortList.length, 0);

  // search for fingerprint
  k = EnigmailKeyRing.getKeyById("65537E212DC19025AD38EDB2781617319CE311C4");
  Assert.equal(k.fpr, "65537E212DC19025AD38EDB2781617319CE311C4");

  let s = k.signatures;

  let fpr = "DB54FB278F6AE719DE0DE881B17D4C762F5752A9";
  Assert.equal(fpr in s, true);
  if (fpr in s) {
    Assert.equal(s[fpr].sigList[0].signerKeyId, "781617319CE311C4");
  }

  let ka = EnigmailKeyRing.getKeysByUserId("devtest@gmail.com>$");
  Assert.equal(ka.length, 1);

  ka = EnigmailKeyRing.getAllSecretKeys();
  Assert.equal(ka.length, 1);

  ka = EnigmailKeyRing.getKeyListById("0x9CE311C4 D535623BB60E9E71"); // the space is on purpose(!)
  Assert.equal(ka.length, 2);
})));

test(withTestGpgHome(withEnigmail(function shouldGetUserIdList() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(secretKey, {}, {});
  let l = null;
  l = getUserIdList(false, {}, {}, {});
  Assert.notEqual(l, null);
  l = getUserIdList(true, {}, {}, {});
  Assert.notEqual(l, null);
})));

test(withTestGpgHome(withEnigmail(function shouldCleanupClearCache() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(secretKey, {}, {});
  EnigmailKeyRing.getAllKeys();
  Assert.notEqual(gKeyListObj.keyList.length, 0);
  EnigmailKeyRing.clearCache();
  Assert.equal(gKeyListObj.keyList.length, 0);
})));

test(withTestGpgHome(withEnigmail(function shouldImportFromTextAndGetKeyDetails() {
  EnigmailKeyRing.importKey(
    JSUnit.createStubWindow(),
    false,
    "-----BEGIN PGP PUBLIC KEY BLOCK-----" +
    "\n" + "Comment: GPGTools - https://gpgtools.org" +
    "\n" +
    "\n" + "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" +
    "\n" + "LBn4tb400iHp7byO85tF/H0OOI1K" +
    "\n" + "=CVNK" +
    "\n" + "-----END PGP PUBLIC KEY BLOCK-----" +
    "\n" + "-----BEGIN PGP PRIVATE KEY BLOCK-----" +
    "\n" + "Comment: GPGTools - https://gpgtools.org" +
    "\n" +
    "\n" + "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" +
    "\n" + "=h0dN" +
    "\n" + "-----END PGP PRIVATE KEY BLOCK-----",
    null, {});
  const keyDetails = EnigmailKeyRing.getValidUids("0xD535623BB60E9E71").join("\n");
  Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
  EnigmailKeyRing.getAllKeys();
  Assert.notEqual(gKeyListObj.keyList.length, 0);
})));

test(function shouldCreateKeyListObject() {
  // from: "P:\Program Files (x86)\GNU\GnuPG\pub\gpg2.exe" --charset utf-8 --display-charset utf-8 --batch --no-tty --status-fd 2 --with-fingerprint --fixed-list-mode --with-colons --list-keys
  let keyInfo = [
    // user with trust level "o" (unknown)
    "tru::1:1443339321:1451577200:3:1:5",
    "pub:o:4096:1:DEF9FC808A3FF001:1388513885:1546188604::u:::scaESCA:",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:o::::1389038412::44F73158EF0F47E4595B1FD8EC740519DE24B994::A User ID with CAPITAL letters <user1@enigmail-test.de>:",
    "uid:o::::1389038405::3FC8999BDFF08EF4210026D3F1C064C072517376::A second User ID with CAPITAL letters <user1@enigmail-test.com>:",
    "sub:o:4096:1:E2DEDFFB80C14584:1388513885:1546188604:::::e:",
  ];

  // from: "P:\Program Files (x86)\GNU\GnuPG\pub\gpg2.exe" --charset utf-8 --display-charset utf-8 --batch --no-tty --status-fd 2 --with-fingerprint --fixed-list-mode --with-colons --list-secret-keys
  let secKeyInfo = [
    "sec::4096:1:DEF9FC808A3FF001:1388513885:1546188604:::::::::",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:::::::44F73158EF0F47E4595B1FD8EC740519DE24B994::A User ID with CAPITAL letters <user1@enigmail-test.de>:",
    "uid:::::::3FC8999BDFF08EF4210026D3F1C064C072517376::A second User ID with CAPITAL letters <user1@enigmail-test.com>:",
    "ssb::4096:1:E2DEDFFB80C14584:1388513885::::::::::",
  ];

  createAndSortKeyList(keyInfo, secKeyInfo,
    "validity", // sorted acc. to key validity
    -1); // descending

  let keyListObj = gKeyListObj;
  Assert.notEqual(keyListObj, null);
  Assert.notEqual(keyListObj.keySortList, null);
  Assert.notEqual(keyListObj.keySortList.length, null);
  Assert.equal(keyListObj.keySortList.length, 1);
  Assert.equal(keyListObj.keySortList[0].userId, "a user id with capital letters <user1@enigmail-test.de>");
  Assert.equal(keyListObj.keySortList[0].keyId, "DEF9FC808A3FF001");
  Assert.notEqual(keyListObj.keyList, null);
  Assert.equal(keyListObj.keyList[keyListObj.keySortList[0].keyNum].userId, "A User ID with CAPITAL letters <user1@enigmail-test.de>");

  const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
  let minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  let details = {};
  let key = EnigmailKeyRing.getValidKeyForRecipient("user1@enigmail-test.de", minTrustLevelIndex, details);
  Assert.notEqual(key, null);
  Assert.equal(key, "DEF9FC808A3FF001");

  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("user1@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.notEqual(details.msg, null);
});


const KeyRingHelper = {
  loadTestKeyList: function() {
    const pkFile = do_get_file("resources/pub-keys.asc", false);
    let publicKeys = EnigmailFiles.readFile(pkFile);
    let rows = publicKeys.split("\n");
    let testKeyList = [];
    for (let i = 0; i < rows.length; ++i) {
      let row = rows[i];
      if (row !== "" && row[0] != "#") {
        testKeyList.push(row);
      }
    }
    createAndSortKeyList(testKeyList, [],
      "validity", // sorted acc. to key validity
      -1); // descending

    let keyListObj = gKeyListObj;
    Assert.notEqual(keyListObj, null);
    Assert.notEqual(keyListObj.keySortList, null);
    Assert.notEqual(keyListObj.keySortList.length, null);
  }
};

test(function testGetValidKeyForOneRecipient() {
  KeyRingHelper.loadTestKeyList();

  const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
  let minTrustLevelIndex = null;
  let details = null;
  let key = null;

  // unknown key:
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("unknown@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, null);
  //Assert.equal(details.msg, "undefined");

  // ordinary full trusted key:
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("full@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0003AAAA00010001");
  Assert.equal(details.msg, null);
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("full@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0003AAAA00010001");
  Assert.equal(details.msg, null);

  // key not valid for encryption:
  // - no details because it would take time to check details of such a key
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("no-encrypt@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, null);

  // disabled key:
  // - no details because it would take time to check details of such a key
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {
    all: ""
  };
  key = EnigmailKeyRing.getValidKeyForRecipient("disabled@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, null);

  // multiple non-trusted and one full trusted keys
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-onefull@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0030AAAA00020001");
  Assert.equal(details.msg, null);

  // multiple non-trusted and two full trusted keys (first taken)
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-twofull@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0034AAAA00020001");
  Assert.equal(details.msg, null);

  // multiple non-trusted and one marginal trusted keys
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-onemarginal@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, "ProblemNoKey");
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-onemarginal@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0031AAAA00020001");
  Assert.equal(details.msg, null);

  // multiple non-trusted keys with same trust level
  // (faked keys case if no special trust given)
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-nofull@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, "ProblemMultipleKeys");

  // some key with subkey that encrypts:
  // we return first main key
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("withsubkey-uid1@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0040EEEE00010001");
  Assert.equal(details.msg, null);
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("withsubkey-uid2@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0040EEEE00010001");
  Assert.equal(details.msg, null);
});

test(function testGetValidKeysForMultipleRecipients() {
  KeyRingHelper.loadTestKeyList();

  const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
  let minTrustLevel = null;
  let details = null;
  let addrs = null;
  let keys = null;
  let keyMissing = null;

  // some matching keys:
  minTrustLevel = "?";
  addrs = ["full@enigmail-test.de",
    "multiple-onefull@enigmail-test.de",
    "multiple-twofull@enigmail-test.de",
    "multiple-onemarginal@enigmail-test.de",
    "withsubkey-uid1@enigmail-test.de",
    "withsubkey-uid2@enigmail-test.de",
  ];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, false);
  Assert.notEqual(keys, null);
  Assert.equal(keys.length, 6);
  Assert.equal(keys[0], "0x0003AAAA00010001");
  Assert.equal(keys[1], "0x0030AAAA00020001");
  Assert.equal(keys[2], "0x0034AAAA00020001");
  Assert.equal(keys[3], "0x0031AAAA00020001");
  Assert.equal(keys[4], "0x0040EEEE00010001");
  Assert.equal(keys[5], "0x0040EEEE00010001");
  Assert.equal(details.errArray.length, 0);

  // some non-matching keys:
  minTrustLevel = "?";
  addrs = ["no-encrypt@enigmail-test.de",
    "disabled@enigmail-test.de",
    "multiple-nofull@enigmail-test.de",
  ];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, true);
  Assert.equal(keys.length, 0);
  Assert.notEqual(details, null);
  Assert.equal(details.errArray.length, 3);
  Assert.equal(details.errArray[0].msg, "ProblemNoKey");
  Assert.equal(details.errArray[1].msg, "ProblemNoKey");
  Assert.equal(details.errArray[2].msg, "ProblemMultipleKeys");

  // just two keys:
  minTrustLevel = "?";
  addrs = ["0x0040EEEE00010001",
    "0x0003AAAA00010001",
    "0003AAAA00010001",
  ];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, false);
  Assert.notEqual(keys, null);
  Assert.equal(keys.length, 3);
  Assert.equal(keys[0], "0x0040EEEE00010001");
  Assert.equal(keys[1], "0x0003AAAA00010001");
  Assert.equal(keys[2], "0x0003AAAA00010001");
  Assert.equal(details.errArray.length, 0);

  // disabled key:
  // - this BEHAVIOR is PROBABLY WRONG:
  minTrustLevel = "?";
  addrs = ["0005AAAA00010001", ];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, false);
  Assert.notEqual(keys, null);
  Assert.equal(keys.length, 1);
  Assert.equal(keys[0], "0x0005AAAA00010001");
  Assert.equal(details.errArray.length, 0);
});

test(function shouldGetKeyValidityErrors() {
  // from: gpg2 --with-fingerprint --fixed-list-mode --with-colons --list-keys
  let keyInfo = [
    // Key 1: Revoked key
    "tru::1:1443339321:1451577200:3:1:5",
    "pub:r:4096:1:DEF9FC808A3FF001:1388513885:1546188604::u:::sca:",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:r::::1389038412::44F73158EF0F47E4595B1FD8EC740519DE24B994::User ID 1 <user1@enigmail-test.net>:",
    "sub:r:4096:1:E2DEDFFB80C14584:1388513885:1546188603:::::e:",

    // Key 2: valid public key, usable for signing, with expired subkeys for encryption
    "pub:u:1024:17:F05B29A5CEFE4B70:1136219252:::u:::scaSCA:::::::",
    "fpr:::::::::6D67E7817D588BEA263F41B9F05B29A5CEFE4B70:",
    "uid:u::::1446568426::560DE55D9C611718F777EDD11A84F126CCD71965::User ID 2 <user2@enigmail-test.net>:::::::::",
    "sub:e:2048:1:B2417304FFC57041:1136219469:1199291469:::::e::::::",
    "sub:e:2048:1:770EA47A1DB0E8B0:1136221524:1293901524:::::s::::::",
    "sub:e:2048:1:805B29A5CEFB2B70:1199298291:1262370291:::::e::::::",
    "sub:e:2048:1:0F6B6901667E633C:1262537932:1325437132:::::e::::::",

    // Key 3: valid public key, usable subkey for encryption, no secret key
    "pub:u:1024:17:86345DFA372ADB32:1136219252:::u:::scESC:::::::",
    "fpr:::::::::9876E7817D588BEA263F41B986345DFA372ADB32:",
    "uid:u::::1446568426::560DE55D9C611718F777EDD11A84F126CCD71965::User ID 3 <user3@enigmail-test.net>:::::::::",
    "sub:u:2048:1:B2417304FFC57041:1136219469::::::s::::::",
    "sub:u:2048:1:770EA47A1DB0E8B0:1136221524::::::e::::::",
  ];

  // from: gpg2 --with-fingerprint --fixed-list-mode --with-colons --list-secret-keys
  let secKeyInfo = [
    // Key 1
    "sec::4096:1:DEF9FC808A3FF001:1388513885:1546188604:::::::::",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:::::::44F73158EF0F47E4595B1FD8EC740519DE24B994::User ID 1 <user1@enigmail-test.net>:",
    "ssb::4096:1:E2DEDFFB80C14584:1388513885::::::::::",
    // Key 2
    "sec:u:1024:17:F05B29A5CEFE4B70:1136219252:1507997328::u:::scaSCA:::::::",
    "fpr:::::::::6D67E7817D588BEA263F41B9F05B29A5CEFE4B70:",
    "uid:u::::1446568426::560DE55D9C611718F777EDD11A84F126CCD71965::User ID 2 <user2@enigmail-test.net>:::::::::",
    "ssb:e:2048:1:B2417304FFC57041:1136219469:1199291469:::::e::::::",
    "ssb:e:2048:1:770EA47A1DB0E8B0:1136221524:1293901524:::::s::::::",
    "ssb:e:2048:1:805B29A5CEFB2B70:1199298291:1262370291:::::e::::::",
    "ssb:e:2048:1:0F6B6901667E633C:1262537932:1325437132:::::e::::::",
    // NO Key 3
  ];

  createAndSortKeyList(keyInfo, secKeyInfo,
    "validity", // sorted acc. to key validity
    -1); // descending

  let key = EnigmailKeyRing.getKeyById("DEF9FC808A3FF001");
  let result = key.getSigningValidity();
  Assert.equal(result.reason, EnigmailLocale.getString("keyRing.pubKeyRevoked", [key.userId, "0x" + key.keyId]));

  key = EnigmailKeyRing.getKeyById("F05B29A5CEFE4B70");
  result = key.getEncryptionValidity();
  Assert.equal(result.keyValid, false);
  Assert.equal(result.reason, EnigmailLocale.getString("keyRing.encSubKeysExpired", [key.userId, "0x" + key.keyId]));

  result = key.getSigningValidity();
  Assert.equal(result.keyValid, true);

  key = EnigmailKeyRing.getKeyById("86345DFA372ADB32");
  result = key.getSigningValidity();
  Assert.equal(result.keyValid, false);
  Assert.equal(result.reason, EnigmailLocale.getString("keyRing.noSecretKey", [key.userId, "0x" + key.keyId]));

  result = key.getEncryptionValidity();
  Assert.equal(result.keyValid, true);
});

test(function shouldGetKeyExpiry() {
  // uses the key listing from shouldGetKeyValidityErrors
  let key = EnigmailKeyRing.getKeyById("DEF9FC808A3FF001");
  Assert.equal(key.getKeyExpiry(), 1546188603);

  key = EnigmailKeyRing.getKeyById("F05B29A5CEFE4B70");
  Assert.equal(key.getKeyExpiry(), 1325437132);

  key = EnigmailKeyRing.getKeyById("86345DFA372ADB32");
  Assert.equal(key.getKeyExpiry(), Number.MAX_VALUE);
});

test(function shouldClone() {
  // uses the key listing from shouldGetKeyValidityErrors
  let key = EnigmailKeyRing.getKeyById("DEF9FC808A3FF001");

  let cp = key.clone();

  Assert.equal(cp.fprFormatted, "EA25 EF48 BF20 01E4 1FAB 0C1C DEF9 FC80 8A3F F001");
  Assert.equal(cp.getEncryptionValidity().keyValid, false);
});
