/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false */
/*global Components: false, EnigmailCore: false, Cc: false, Ci: false, */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("streams.jsm"); /*global EnigmailStreams: false,  EnigmailLog: false, EnigmailPrefs: false */
const EnigmailFiles = component("enigmail/files.jsm").EnigmailFiles;

let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

function makeURI(aURL, aOriginCharset, aBaseURI) {
  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);
  return ioService.newURI(aURL, aOriginCharset, aBaseURI);
}

// testing: newStringChannel
test(function stringChannelTest() {
  var testString = "Hello world";

  let uri = makeURI("dummy:none");
  var ch = EnigmailStreams.newStringChannel(uri, "text/plain", "UTF-8", testString);
  var stringListener = EnigmailStreams.newStringStreamListener(
    function compareResults(gotData) {
      Assert.equal(testString, gotData);
      inspector.exitNestedEventLoop();
    }
  );
  ch.asyncOpen(stringListener, null);
  inspector.enterNestedEventLoop(0);
});


// testing: newFileChannel
test(function readFileChannel() {
  var md = do_get_cwd().clone();
  md.append("file-test.txt");

  var testString = "Hello world\n \x00what's next";

  var f = EnigmailFiles.writeFileContents(md, testString, null);
  Assert.ok(f, "file written");

  let uri = makeURI("dummy:none");
  var ch = EnigmailStreams.newFileChannel(uri, md, "application/octet-stream", true);
  var stringListener = EnigmailStreams.newStringStreamListener(
    function compareResults(gotData) {
      Assert.equal(testString, gotData);
      Assert.ok(md.exists(), false, "file was deleted:");
      inspector.exitNestedEventLoop();
    }
  );
  ch.asyncOpen(stringListener, null);
  inspector.enterNestedEventLoop(0);

});