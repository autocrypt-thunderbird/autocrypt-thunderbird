/* global Components: false, Assert: false, do_get_file: false, do_print: false, do_get_cwd: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


/**
 * This file tests the implementation of subprocess.jsm
 */

Components.utils.import("resource://enigmail/subprocess.jsm"); /* global subprocess: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

var gTestLines;
var gResultData;
var gResultStdErr;

function run_test() {
  var isWindows = ("@mozilla.org/windows-registry-key;1" in Components.classes);
  var dataFile = do_get_file("ipc-data.txt", true);

  var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);

  var plPath = env.get("PL_PATH");
  Assert.ok(plPath.length > 0, "PL_PATH length is > 0");
  if (plPath.length === 0) throw "perl path undefined";

  var pl = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  pl.initWithPath(plPath);
  if (!pl.exists())
    throw "Could not locate the perl executable";

  var processDir = do_get_cwd();
  var cmd = processDir.clone();
  cmd.append("IpcCat.pl");


  if (!cmd.exists())
    throw "Could not locate the IpcCat.pl helper executable";

  var dirSvc = Cc["@mozilla.org/file/directory_service;1"].
  getService(Ci.nsIProperties).
  QueryInterface(Ci.nsIDirectoryService);
  var greDir = dirSvc.get("GreD", Ci.nsIFile);


  var envList = [
    "DYLD_LIBRARY_PATH=" + greDir.path, // for Mac
    "LD_LIBRARY_PATH=" + greDir.path // for Linux
  ];

  var eol = isWindows ? "\r\n" : "\n";
  gTestLines = ["Writing example data" + eol,
    "Writing something more" + eol,
    "And yet some more text" + eol
  ];


  /////////////////////////////////////////////////////////////////
  // Test standard scenario
  /////////////////////////////////////////////////////////////////

  do_print("Standard scenario");

  gResultData = "";
  gResultStdErr = "";
  var p = subprocess.call({
    command: pl,
    arguments: [cmd.path, 'dump'],
    environment: envList,
    stdin: function(pipe) {
      for (var i = 0; i < gTestLines.length; i++) {
        pipe.write(gTestLines[i]);
      }
      pipe.close();
    },
    stdout: function(data) {
      gResultData += data;
    },
    stderr: function(data) {
      gResultStdErr += data;
    },
    done: function(result) {
      Assert.equal(0, result.exitCode, "exit code");
    },
    mergeStderr: false
  });

  p.wait();
  Assert.equal(
    gTestLines.join(""),
    gResultData,
    "result matching"
  );

  let len = gTestLines.join("").length;
  if (isWindows) {
    len -= gTestLines.length;
  }
  Assert.equal(
    "Starting dump\nDumped " + len + " bytes\n",
    gResultStdErr.replace(/\r\n/g, "\n"),
    "stderr result matching"
  );


  /////////////////////////////////////////////////////////////////
  // Test mergeStderr=true & stdin as string
  /////////////////////////////////////////////////////////////////

  do_print("mergeStderr=true & stdin as string");

  gResultData = "";
  p = subprocess.call({
    command: pl,
    arguments: [cmd.path, 'dump'],
    environment: envList,
    stdin: gTestLines.join(""),
    stdout: function(data) {
      gResultData += data;
    },
    stderr: function(data) {
      Assert.ok(false, "Got unexpected data '" + data + "' on stderr\n");
    },
    done: function(result) {
      Assert.equal(0, result.exitCode, "exit code");
    },
    mergeStderr: true
  });

  p.wait();
  Assert.equal(gTestLines.join("").length + (isWindows ? 32 : 30), gResultData.length, "comparing result");


  /////////////////////////////////////////////////////////////////
  // Test with workdir & no stderr
  /////////////////////////////////////////////////////////////////

  do_print("workdir & no stderr");

  gResultData = "";
  p = subprocess.call({
    command: pl,
    arguments: [cmd.path, 'dump'],
    environment: envList,
    workdir: do_get_file(".", true),
    stdin: function(pipe) {
      for (var i = 0; i < gTestLines.length; i++) {
        pipe.write(gTestLines[i]);
      }
      pipe.close();
    },
    done: function(result) {
      gResultData = result.stdout;
      Assert.equal(0, result.exitCode, "exit code");
    },
    mergeStderr: false
  });

  p.wait();

  Assert.equal(gTestLines.join(""), gResultData, "comparing result");

  /////////////////////////////////////////////////////////////////
  // Test exit code != 0
  /////////////////////////////////////////////////////////////////

  gResultData = "";
  gResultStdErr = "";
  p = subprocess.call({
    command: pl,
    arguments: [cmd.path, 'wrong', 'arguments'],
    environment: envList,
    stdin: "Dummy text",
    stdout: function(data) {
      gResultData += data;
    },
    stderr: function(data) {
      gResultStdErr += data;
    },
    done: function(result) {},
    mergeStderr: false
  });

  var exitCode = p.wait();
  // Assert.notEqual(0, exitCode, "expecting non-zero exit code"); // fails from time to time
  Assert.equal("", gResultData, "comapring result");
  gResultStdErr = gResultStdErr.replace(/\r\n/g, "\n");
  Assert.equal(18, gResultStdErr.length, "check error message");

  /////////////////////////////////////////////////////////////////
  // Test minimal scenario with stdout only
  /////////////////////////////////////////////////////////////////

  do_print("minimal scenario with stdin and stdout separately");

  gResultData = "";
  gResultStdErr = "";
  p = subprocess.call({
    command: pl,
    arguments: [cmd.path, 'write', dataFile.path],
    stdin: gTestLines.join("")
  });

  p.wait();

  p = subprocess.call({
    command: pl,
    arguments: [cmd.path, 'read', dataFile.path],
    environment: envList,
    stdin: "",
    stdout: function(data) {
      gResultData += data;
    }
  });

  p.wait();
  Assert.equal(gTestLines.join(""), gResultData, "read file");

  /////////////////////////////////////////////////////////////////
  // Test minimal scenario with done only
  /////////////////////////////////////////////////////////////////

  do_print("minimal scenario with done only");

  gResultData = "";
  gResultData = "";
  p = subprocess.call({
    command: pl,
    charset: null,
    arguments: [cmd.path, 'read', dataFile.path],
    environment: envList,
    done: function(result) {
      gResultData = result.stdout;
      gResultStdErr = result.stderr.replace(/\r\n/g, "\n");

      Assert.equal(0, result.exitCode, "exit code");
      Assert.equal(gTestLines.join(""), gResultData, "stdout");
      Assert.equal(gResultStdErr.length, 28, "stderr");
    }
  });

  p.wait();

  /////////////////////////////////////////////////////////////////
  // Test environment variables
  /////////////////////////////////////////////////////////////////

  do_print("environment variables");

  gTestLines = ["This is a test variable"];
  envList.push("TESTVAR=" + gTestLines[0]);

  gResultData = "";
  p = subprocess.call({
    command: pl.path,
    arguments: [cmd.path, 'getenv', 'TESTVAR'],
    cwd: do_get_file(".", true),
    environment: envList,
    done: function(result) {
      gResultData = result.stdout;
      Assert.equal(0, result.exitCode, "exit code");
    },
    mergeStderr: false
  });

  p.wait();
  Assert.equal(gTestLines.join(""), gResultData, "variable comparison");

}
