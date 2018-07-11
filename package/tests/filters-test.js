/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false */
/*global EnigmailCore: false, Cc: false, Ci: false, EnigmailFiles: false, EnigmailLog: false, EnigmailPrefs: false */
/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, addMacPaths: false */

testing("filters.jsm"); /* global JsmimeEmitter: false, EnigmailFilters: false, processIncomingMail: false */
component("enigmail/files.jsm"); /* global EnigmailFiles: false */

// testing: JsmimeEmitter
test(function mimeEmitterBasicTest() {

  let msgPart = 0;
  let msgStruct = [
    ["1", "multipart/mixed"],
    ["1.1", "text/plain; part=1"],
    ["1.2", "multipart/mixed; part=2"],
    ["1.2.1", "text/plain; part=2.1"],
    ["1.3", "text/plain; part=3"]
  ];

  function walkMimeTree(node) {
    Assert.equal(msgStruct[msgPart][0], node.partNum);
    Assert.equal(msgStruct[msgPart][1], node.headers["content-type"]);
    ++msgPart;

    for (let i of node.subParts) {
      walkMimeTree(i);
    }
  }

  let p = new JsmimeEmitter(false);

  p.startMessage();
  p.startPart("1", {
    "content-type": "multipart/mixed"
  });
  p.deliverPartData("1", "");
  p.startPart("1.1", {
    "content-type": "text/plain; part=1"
  });
  p.deliverPartData("1.1", "test1");
  p.endPart("1.1");
  p.startPart("1.2", {
    "content-type": "multipart/mixed; part=2"
  });
  p.deliverPartData("1.2", "test2");
  p.startPart("1.2.1", {
    "content-type": "text/plain; part=2.1"
  });
  p.deliverPartData("1.2.1", "test2.1");
  p.endPart("1.2.1");
  p.endPart("1.2");
  p.startPart("1.3", {
    "content-type": "text/plain; part=3"
  });
  p.deliverPartData("1.3", "test3");
  p.endPart("1.3");
  p.endPart("1");
  p.endMessage();

  let t = p.getMimeTree();
  walkMimeTree(t);
});


// testing: processIncomingMail
test(function processIncomingMailTest() {

  var testString = "Subject: Test\r\nContent-Type: text/plain\r\n\r\nThis is a test\r\n";

  EnigmailFilters.addNewMailConsumer({
    consumeMessage: function(msg, rawMessageData) {
      try {
        Assert.equal(rawMessageData, testString);
        let ct = msg.headers.contentType.type;
        Assert.equal(ct, "text/plain");
      }
      catch (ex) {
        Assert.equal(ex.toString(), "");
      }
      do_test_finished();
    }
  });
  var md = do_get_cwd().clone();
  md.append("test-message.txt");

  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);

  EnigmailFiles.writeFileContents(md, testString, null);

  do_test_pending();

  var fileUri = ioService.newFileURI(md);
  processIncomingMail(fileUri.spec, true);
});
