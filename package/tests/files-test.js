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

testing("files.jsm");
component("enigmail/os.jsm"); /*global EnigmailOS: false */

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

test(function shouldNotAppendExeInDosLikeEnvironment() {
  TestHelper.resetting(EnigmailOS, "isDosLike", true, function() {
    const expectedPath = "C:\\Program Files\\GnuPG\\bin\\gpg.exe";

    const actualPath = EnigmailFiles.resolvePath(expectedPath, "C:\\Program Files\\GnuPG\\bin", true);

    Assert.equal(actualPath, expectedPath);
  });
});

test(function checkDirectory() {
  let md = do_get_cwd();

  Assert.equal(0, EnigmailFiles.ensureWritableDirectory(md, 0x1C0));

  md.append("should-exist");
  Assert.equal(0, EnigmailFiles.ensureWritableDirectory(md, 0x1C0));

  try {
    md.permissions = 0;
    Assert.equal(0, EnigmailFiles.ensureWritableDirectory(md, 0x1C0));
  }
  catch (x) {
    // don't try if permissions cannot be modified
  }

  md.remove(true);
  md.create(Ci.nsIFile.FILE_TYPE, 0x1C0);
  Assert.equal(3, EnigmailFiles.ensureWritableDirectory(md, 0x1C0));

  md.remove(false);

  md.initWithPath("/does/not/exist");
  Assert.equal(1, EnigmailFiles.ensureWritableDirectory(md, 0x1C0));

  if (EnigmailOS.isDosLike) {
    let envS = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    let sysRoot = envS.get("SystemRoot");
    md.initWithPath(sysRoot);
  }
  else
    md.initWithPath("/");

  Assert.equal(2, EnigmailFiles.ensureWritableDirectory(md, 0x1C0));
});
