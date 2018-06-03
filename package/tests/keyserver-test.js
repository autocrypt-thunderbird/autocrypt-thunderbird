/*global test:false, component: false, testing: false, Assert: false, do_load_module: false, do_get_cwd: false, do_get_file: false
  do_test_finished: false: do_test_pending: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withPreferences: false, resetting: false, withEnvironment: false, withEnigmail: false, withTestGpgHome: false, getKeyListEntryOfKey: false, gKeyListObj: true */

testing("keyserver.jsm"); /*global false parseKeyserverUrl: false, keyServerBuiltin: false */
component("enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
component("enigmail/constants.jsm"); /*global EnigmailConstants: false */

function setupKeyserverPrefs(keyservers, autoOn) {
  EnigmailPrefs.setPref("keyserver", keyservers);
  EnigmailPrefs.setPref("autoKeyServerSelection", autoOn);
}

function isGpgExecutable(fullPath) {
  let path = fullPath.replace(/^(.*\/)([^/]+)$/, "$2");
  return (path.search(/^gpg/i) === 0);
}

test(function testParseUrl() {
  let srv = "abc.de.fg";
  const HKP = "hkp";
  const HKP_PORT = "11371";
  let r = parseKeyserverUrl(srv);

  Assert.equal(r.host, srv);
  Assert.equal(r.protocol, HKP);
  Assert.equal(r.port, HKP_PORT);

  r = parseKeyserverUrl("hkps://" + srv);
  Assert.equal(r.host, srv);
  Assert.equal(r.protocol, "hkps");
  Assert.equal(r.port, "443");

  r = parseKeyserverUrl("ldap://" + srv + ":765");
  Assert.equal(r.host, srv);
  Assert.equal(r.protocol, "ldap");
  Assert.equal(r.port, "765");
});

test(function testCreateRequestUrl() {
  let r = keyServerBuiltin.createRequestUrl("hkps://example.com", EnigmailConstants.DOWNLOAD_KEY, "12345678");
  Assert.equal(r.method, "GET");
  Assert.equal(r.url, "https://example.com:443/pks/lookup?search=0x12345678&op=get&options=mr");

  r = keyServerBuiltin.createRequestUrl("example.com", EnigmailConstants.SEARCH_KEY, "abc");
  Assert.equal(r.method, "GET");
  Assert.equal(r.url, "http://example.com:11371/pks/lookup?search=abc&fingerprint=on&op=index&options=mr");

  r = keyServerBuiltin.createRequestUrl("example.com", EnigmailConstants.UPLOAD_KEY, "abc");
  Assert.equal(r.method, "POST");
  Assert.equal(r.url, "http://example.com:11371/pks/add");

});

test(withTestGpgHome(withEnigmail(function testAccessKeyServer() {
  // overwrite createRequestUrl to get local files
  keyServerBuiltin.createRequestUrl = function(keyserver, actionFlag, searchTerm) {
    let fn = "";
    let method = "GET";
    let allowNonExist = false;

    switch (actionFlag) {
      case EnigmailConstants.DOWNLOAD_KEY:
        fn = "dev-strike.asc";
        break;
      case EnigmailConstants.SEARCH_KEY:
        fn = "hkp-listing.txt";
        break;
      case EnigmailConstants.UPLOAD_KEY:
        fn = "test-upload.txt";
        method = "PUT";
        allowNonExist = true;
        break;
    }

    let file = do_get_file("resources/" + fn, allowNonExist);
    let ioServ = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let fileUri = ioServ.newFileURI(file);

    return {
      url: fileUri.spec,
      method: method
    };
  };

  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  keyServerBuiltin.download("781617319CE311C4", "dummy").then(res => {
    Assert.equal(res.gotKeys.length, 1);
    Assert.equal(res.result, 0);

    let o = EnigmailKeyRing.getKeyById("0x781617319CE311C4");
    Assert.notEqual(o, null);
    Assert.equal(o.fpr, "65537E212DC19025AD38EDB2781617319CE311C4");

    let data = keyServerBuiltin.buildHkpPayload(EnigmailConstants.UPLOAD_KEY, "0x781617319CE311C4", );
    Assert.equal(data.substr(0, 75), "keytext=-----BEGIN%20PGP%20PUBLIC%20KEY%20BLOCK-----%0A%0AmQINBFVHm5sBEACs9");

    return keyServerBuiltin.search("anything", "dummy");
  }).then(res => {
    Assert.equal(res.length, 3);
    Assert.equal(res[0].keyId, "CCCCCCCCCCCCCCCCCCCCCCCC0003AAAA00010001");
    Assert.equal(res[1].keyId, "CCCCCCCCCCCCCCCCCCCCCCCC0004AAAA00010001");
    Assert.equal(res[1].created, "2017-12-30");
    Assert.equal(res[1].uid[1], "User Three <test-3@enigmail-test.net>");
    Assert.equal(res[2].keyId, "CCCCCCCCCCCCCCCCCCCCCCCC0005AAAA00010001");
    Assert.equal(res[2].status, "r");

    return keyServerBuiltin.upload("0x781617319CE311C4", "dummy");
  }).then(res => {
    Assert.equal(res, 5); // this is bound to fail ;-)

    inspector.exitNestedEventLoop();
  }).catch(res => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
})));
