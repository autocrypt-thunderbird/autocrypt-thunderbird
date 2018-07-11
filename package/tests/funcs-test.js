/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, EnigmailApp: false */
/*global EnigmailFuncs: false, rulesListHolder: false, EC: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("funcs.jsm");

var EnigmailFuncsTests = {
  testStripEmail(str, res) {
    let addr;
    addr = EnigmailFuncs.stripEmail(str);
    Assert.equal(addr, res);
  }
};

test(function stripEmail() {
  EnigmailFuncsTests.testStripEmail("some stuff <a@b.de>",
    "a@b.de");

  EnigmailFuncsTests.testStripEmail("\"some stuff\" a@b.de",
    "a@b.de");

  EnigmailFuncsTests.testStripEmail("\"some, stuff\" a@b.de",
    "a@b.de");

  EnigmailFuncsTests.testStripEmail("some stuff <a@b.de>, xyz<xy@a.xx>",
    "a@b.de,xy@a.xx");

  EnigmailFuncsTests.testStripEmail(" a@b.de , <aa@bb.de>",
    "a@b.de,aa@bb.de");

  EnigmailFuncsTests.testStripEmail("    ,,,,;;;; , ; , ;",
    "");

  EnigmailFuncsTests.testStripEmail(";",
    "");


  EnigmailFuncsTests.testStripEmail("    ,,oneRule,;;; , ;",
    "oneRule");

  EnigmailFuncsTests.testStripEmail("    ,,,nokey,;;;; , nokey2 ; , ;",
    "nokey,nokey2");

  EnigmailFuncsTests.testStripEmail(",,,newsgroupa ",
    "newsgroupa");

  // test invalid email addresses:
  Assert.throws(
    function() {
      EnigmailFuncs.stripEmail(" a@b.de , <aa@bb.de> <aa@bb.dd>");
    }
  );
  Assert.throws(
    function() {
      EnigmailFuncs.stripEmail("\"some stuff a@b.de");
    }
  );
  Assert.throws(
    function() {
      EnigmailFuncs.stripEmail("<evil@example.com,><good@example.com>");
    }
  );

});

test(function compareMimePartLevel() {
  Assert.throws(
    function() {
      EnigmailFuncs.compareMimePartLevel("1.2.e", "1.2");
    }
  );

  let e = EnigmailFuncs.compareMimePartLevel("1.1", "1.1.2");
  Assert.equal(e, -2);

  e = EnigmailFuncs.compareMimePartLevel("1.1", "1.2.2");
  Assert.equal(e, -1);

  e = EnigmailFuncs.compareMimePartLevel("1", "2");
  Assert.equal(e, -1);

  e = EnigmailFuncs.compareMimePartLevel("1.2", "1.1.2");
  Assert.equal(e, 1);

  e = EnigmailFuncs.compareMimePartLevel("1.2.2", "1.2");
  Assert.equal(e, 2);

  e = EnigmailFuncs.compareMimePartLevel("1.2.2", "1.2.2");
  Assert.equal(e, 0);

});
