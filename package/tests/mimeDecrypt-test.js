/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false */
/*global component: false, withEnigmail: false  withTestGpgHome: false */
/*global Cu: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

/*global EnigmailMime: true, EnigmailVerify: true */
var overwriteEnigmailMime = {
  extractProtectedHeaders: function(str) {
    return {
      startPos: 10,
      endPos: 22,
      newHeaders: {
        subject: "The hidden subject"
      }
    };
  }
};

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("mimeDecrypt.jsm"); /* global EnigmailMimeDecrypt: false */
component("enigmail/files.jsm"); /* global EnigmailFiles: false */
component("enigmail/keyRing.jsm"); /* global EnigmailKeyRing: false */
component("enigmail/singletons.jsm"); /* global EnigmailSingletons: false */
component("enigmail/singletons.jsm"); /* global EnigmailSingletons: false */
component("enigmail/mimeVerify.jsm"); /*global EnigmailVerify: false */

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */

test(withTestGpgHome(withEnigmail(function processPgpMimeMsg() {
  const secKey = do_get_file("resources/dev-strike.sec", false);
  const importedKeysObj = {};
  const importResult = EnigmailKeyRing.importKeyFromFile(secKey, {}, importedKeysObj);

  let k = EnigmailKeyRing.getKeyById("0x781617319CE311C4");
  Assert.ok(k !== null);

  let msgFile = do_get_file("resources/pgpMime-msg.eml", false);
  let msgTxt = EnigmailFiles.readFile(msgFile);

  let i = msgTxt.search(/\n\n/);
  Assert.ok(i > 0);
  msgTxt = msgTxt.substr(i + 2);

  let dataArr = msgTxt.split(/\n/);

  let dec = EnigmailMimeDecrypt.newPgpMimeHandler();
  EnigmailVerify.lastMsgWindow = 1;
  EnigmailVerify.lastMsgUri = null;


  EnigmailSingletons.messageReader = {
    processDecryptionResult: function(uri, funcName, jsonString, mimePartNumber) {
      Assert.equal(uri.spec, "test");
      Assert.equal(funcName, "modifyMessageHeaders");
      Assert.equal(jsonString, "{}");
      Assert.equal(mimePartNumber, "1");
    },
    updateSecurityStatus: function(msgUriSpec, exitCode, statusFlags, keyId, userId, sigDetails,
      errorMsg, blockSeparation, uri, jsonStr, mimePartNumber) {
      Assert.equal(msgUriSpec, null);
      Assert.equal(keyId, "65537E212DC19025AD38EDB2781617319CE311C4");
      Assert.equal(userId, "anonymous strike <strike.devtest@gmail.com>");
      let s = JSON.parse(jsonStr);
      Assert.ok("encryptedTo" in s);
      Assert.equal(mimePartNumber, "1");
    }
  };

  let pgpMimeProxy = {
    QueryInterface: XPCOMUtils.generateQI(["nsIPgpMimeProxy"]),
    mimePart: "1",
    contentType: 'multipart/encrypted; protocol="application/pgp-encrypted"; boundary="DELIMITER"',
    outputDecryptedData: function(data, dataLen) {
      Assert.equal(dataLen, 15, "data length matches");
      Assert.equal(data, "This is a test\n", "data matches");
    }
  };

  let inputStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);

  let testUri = {
    QueryInterface: XPCOMUtils.generateQI(["nsIURI"]),
    schemeIs: function() {
      return true;
    },
    pathQueryRef: "test",
    spec: "test"
  };

  dec.onStartRequest(pgpMimeProxy, testUri);
  for (i = 0; i < dataArr.length; i++) {
    let s = dataArr[i] + "\r\n";
    inputStream.setData(s, s.length);
    dec.onDataAvailable(null, null, inputStream, 0, s.length);
  }

  dec.onStopRequest(null, null, null);
})));


test(function extractEncryptedHeadersTest() {
  EnigmailMime = overwriteEnigmailMime;
  var dec = EnigmailMimeDecrypt.newPgpMimeHandler();
  dec.decryptedData = 'This is a Hello World example';

  dec.extractEncryptedHeaders();

  var expected = 'This is a example';

  var got = dec.decryptedData;
  Assert.equal(got, expected, "removed rfc822 header");

  got = dec.decryptedHeaders.subject;
  expected = "The hidden subject";
  Assert.equal(got, expected, "subject");
});
