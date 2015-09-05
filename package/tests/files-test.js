/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false */
/*global EnigmailCore: false, Cc: false, Ci: false, EnigmailFiles: false, EnigmailLog: false, EnigmailPrefs: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("files.jsm");

// testing: readFile
test(function readFileReturnsContentOfExistingFile() {
  var md = do_get_cwd().clone();
  md = md.parent.parent;
  md.append("uuid_enig.txt");
  var result = EnigmailFiles.readFile(md);
  Assert.assertContains(result, "847b3a00-7ab1-11d4-8f02-006008948af5");
});

test(function readFileReturnsEmptyStringForNonExistingFile() {
  var md = do_get_cwd().clone();
  md = md.parent.parent;
  md.append("THIS_FILE_DOESNT_EXIST");
  var result = EnigmailFiles.readFile(md);
  Assert.equal("", result);
});

test(function shouldFormatCmdLine() {
  var md = do_get_cwd();

  Assert.equal(EnigmailFiles.formatCmdLine(md, ["1", "2", "3"]), do_get_cwd().path + " 1 2 3");
});
