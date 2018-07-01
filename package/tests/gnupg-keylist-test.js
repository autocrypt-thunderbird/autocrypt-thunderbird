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

/*global EnigmailFiles: false */
do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

component("enigmail/trust.jsm"); /*global EnigmailTrust: false */
component("enigmail/locale.jsm"); /*global EnigmailLocale: false */

/*createAndSortKeyList: false, Number: false */

testing("cryptoAPI/gnupg-keylist.jsm");
/*global appendKeyItems: false */

test(function shouldCreateKeyListObject() {
  // from: gpg2 --charset utf-8 --display-charset utf-8 --batch --no-tty --status-fd 2 --with-fingerprint --fixed-list-mode --with-colons --list-keys
  let pubKeyInfo = [
    // user with trust level "o" (unknown)
    "tru::1:1443339321:1451577200:3:1:5",
    // Key 1
    "pub:o:4096:1:DEF9FC808A3FF001:1388513885:1546188604::u:::scaESCA:",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:o::::1389038412::44F73158EF0F47E4595B1FD8EC740519DE24B994::A User ID with CAPITAL letters <user1@enigmail-test.de>:",
    "uid:-::::1389038405::3FC8999BDFF08EF4210026D3F1C064C072517376::A second User ID with CAPITAL letters <user1@enigmail-test.com>:",
    "sub:o:4096:1:E2DEDFFB80C14584:1388513885:1546188604:::::e:",
    "sub:o:3072:1:AB908C90BED8AC3E:1388513886:1746188604:::::c:",
    // Key 2
    "pub:-:2048:1:8439E17046977C46:1464214329:::-:::scESC::::::23::0:",
    "fpr:::::::::8C140834F2D683E9A016D3098439E17046977C46:",
    "uid:-::::1464214329::6D3876B55C560A589EDF6CC109B4A9DCB50614D6::dev-tiger <dev-tiger@test.notreal>::::::::::0:",
    "sub:-:2048:1:55927D0F0E5A9DF5:1464214329::::::e::::::23:",
    "fpr:::::::::BB5227C62D575DC0857AFC2755927D0F0E5A9DF5:"
  ];

  // from: gpg2 --charset utf-8 --display-charset utf-8 --batch --no-tty --status-fd 2 --with-fingerprint --fixed-list-mode --with-colons --list-secret-keys
  let secKeyInfo = [
    // Key 3 (does not exist on pubkey list)
    "sec:u:3072:1:D59E3B46243D2AA4:1530205118:::u:::cESC:::+:::23::0:",
    "fpr:::::::::09933176C72A34576C1EB444D59E3B46243D2AA4:",
    "grp:::::::::AFF4F764AF0A9B1A5A1EC6C2DB5749C848252033:",
    "uid:u::::1530205118::18B030504D1756B186D2EF8642F53EFA63B14148::Something <else@enigmail-test.net>::::::::::0:",
    "ssb:u:3072:1:BA3C01011F0EECD2:1530205137::::::s:::+:::23:",
    "fpr:::::::::0A82F10C8E14AE909176F8DABA3C01011F0EECD2:",
    "grp:::::::::EDA4C757CE3587DC8CE677A032397F21F9930319:",
    "ssb:u:3072:1:3AB1459E2DABC99A:1530205155::::::e:::+:::23:",
    "fpr:::::::::0EF326B8FFA4A6564650E4763AB1459E2DABC99A:",
    "grp:::::::::7EA9BAC4F20EB5CA23DD3D55A55377D2307035AC:",
    // Key 1 (exists on pubkey list)
    "sec::4096:1:DEF9FC808A3FF001:1388513885:1546188604:::::::::",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:::::::44F73158EF0F47E4595B1FD8EC740519DE24B994::a user id with no capital letters <user1@enigmail-test.de>:",
    "uid:::::::3FC8999BDFF08EF4210026D3F1C064C072517376::A second User ID with CAPITAL letters <user1@enigmail-test.com>:",
    "ssb::4096:1:E2DEDFFB80C14584:1388513885::::::::::"
  ];

  let keyListObj = {
    keys: [],
    index: []
  };
  appendKeyItems(pubKeyInfo, keyListObj);
  appendKeyItems(secKeyInfo, keyListObj);

  Assert.notEqual(keyListObj.keys.length, 0);
  Assert.equal(keyListObj.keys[0].userId, "A User ID with CAPITAL letters <user1@enigmail-test.de>");
  Assert.equal(keyListObj.keys[0].keyId, "DEF9FC808A3FF001");
  Assert.equal(keyListObj.keys[0].fpr, "EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001");
  Assert.ok(keyListObj.keys[0].secretAvailable);
  Assert.equal(keyListObj.keys[0].subKeys.length, 2);
  Assert.equal(keyListObj.keys[0].subKeys[1].keyUseFor, "c");
  Assert.equal(keyListObj.keys[0].userIds.length, 2);
  Assert.equal(keyListObj.keys[0].userIds[1].keyTrust, "-");
  Assert.equal(keyListObj.index.DEF9FC808A3FF001.userId, "A User ID with CAPITAL letters <user1@enigmail-test.de>");
  Assert.equal(keyListObj.keys[1].keyId, "8439E17046977C46");
  Assert.equal(keyListObj.index["8439E17046977C46"].userId, "dev-tiger <dev-tiger@test.notreal>");
  Assert.equal(keyListObj.keys[1].secretAvailable, undefined);
  Assert.equal(keyListObj.keys[2].fpr, "09933176C72A34576C1EB444D59E3B46243D2AA4");
  Assert.ok(keyListObj.keys[2].secretAvailable);
  Assert.equal(keyListObj.keys[2].userId, "Something <else@enigmail-test.net>");
});
