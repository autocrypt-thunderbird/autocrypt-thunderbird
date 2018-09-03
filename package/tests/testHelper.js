/*global do_load_module: false, do_get_cwd: false, Components: false, Assert: false,  CustomAssert: false, FileUtils: false, JSUnit: false, EnigmailFiles: false */
/*global dump: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const osUtils = {};
Components.utils.import("resource://gre/modules/osfile.jsm", osUtils);
Components.utils.import("resource://gre/modules/FileUtils.jsm", osUtils);

var TestHelper = {
  getMyPath: function() {
    let fn = Components.stack.filename.replace(/^.* -> file:\/\//, "");
    let file = osUtils.FileUtils.File(fn);
    return file.parent;
  },

  loadDirectly: function(name) {
    do_load_module("file://" + TestHelper.getMyPath().parent.path + "/" + name);
  },

  loadModule: function(name) {
    let modName = "";
    if (name.search(/^enigmail\//) === 0) {
      modName = "chrome://enigmail/content/modules/" + name.replace(/^enigmail\//, "");
    }
    else {
      modName = "resource://" + name;
    }

    try {
      Components.utils.import(modName);
    }
    catch (ex) {
      dump("Error importing module: '" + modName + "'\n");
      dump(ex.message + "\n" + ex.stack);
      throw ex;
    }
  },

  testing: function(name) {
    TestHelper.currentlyTesting = name;
  },

  registerTest: function(fn) {
    TestHelper.allTests = TestHelper.allTests || [];
    TestHelper.allTests.push(fn);
  },

  resetting: function(on, prop, val, f) {
    let orgVal = on[prop];
    on[prop] = val;
    try {
      return f();
    }
    finally {
      on[prop] = orgVal;
    }
  },

  runTests: function() {
    if (TestHelper.currentlyTesting) {
      TestHelper.loadDirectly(TestHelper.currentlyTesting);
    }
    if (TestHelper.allTests) {
      for (var i = 0; i < TestHelper.allTests.length; i++) {
        TestHelper.allTests[i]();
      }
    }
  },

  initalizeGpgHome: function() {
    component("enigmail/files.jsm");
    var homedir = osUtils.OS.Path.join(EnigmailFiles.getTempDir(), ".gnupgTest");
    var workingDirectory = new osUtils.FileUtils.File(homedir);
    if (!workingDirectory.exists()) {
      workingDirectory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 448);
    }

    var file = workingDirectory.clone();
    file.append("gpg-agent.conf");
    if (!file.exists()) {
      file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 384);
    }

    var s = "pinentry-program " + TestHelper.getMyPath().path.replace(/\\/g, "/") + "/pinentry-auto";
    if (JSUnit.getOS() == "WINNT") {
      s += ".exe";
    }
    s += "\n";

    let encoder = new TextEncoder();
    let array = encoder.encode(s);

    let inspector = Components.classes["@mozilla.org/jsinspector;1"].createInstance(Components.interfaces.nsIJSInspector);

    osUtils.OS.File.writeAtomic(file.path, array, {}).then(x => {
      inspector.exitNestedEventLoop();
    }).catch(err => {
      inspector.exitNestedEventLoop();
    });

    inspector.enterNestedEventLoop(0); // wait for async process to terminate

    var environment = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);

    environment.set("GNUPGHOME", workingDirectory.path);
    return homedir;
  },

  removeGpgHome: function(homedir) {
    var workingDirectory = new osUtils.FileUtils.File(homedir);

    try {
      if (workingDirectory.exists()) workingDirectory.remove(true);
    }
    catch (ex) {
      // print a warning if GpgHome cannot be removed
      Assert.ok(true, "Could not remove GpgHome");
    }
  }
};

TestHelper.loadDirectly("tests/customAssert.jsm");

var testing = TestHelper.testing;
var component = TestHelper.loadModule;
var run_test = TestHelper.runTests;
var test = TestHelper.registerTest;
var resetting = TestHelper.resetting;
var initalizeGpgHome = TestHelper.initalizeGpgHome;
var removeGpgHome = TestHelper.removeGpgHome;

function withEnvironment(vals, f) {
  var environment = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
  var oldVals = {};
  for (let key in vals) {
    oldVals[key] = environment.get(key);
    environment.set(key, vals[key]);
  }
  try {
    return f(environment);
  }
  finally {
    for (let key in oldVals) {
      environment.set(key, oldVals[key]);
    }
  }
}

function withTestGpgHome(f) {
  return function() {
    const homedir = initalizeGpgHome();
    try {
      f();
    }
    finally {
      removeGpgHome(homedir);
    }
  };
}


/**
 * Overwrite functions for the scope of a test, and re-set the original function
 * after the test has completed
 *
 * @param {Array<Object>} overwriteArr:
 *   - obj {Object}: target Object
 *   - fn  {String}: function name
 *   - new {Function}: new function
 */
function withOverwriteFuncs(overwriteArr, func) {
  return function() {
    let origFuncs = [];
    for (let f in overwriteArr) {
      origFuncs.push({
        obj: overwriteArr[f].obj,
        fn: overwriteArr[f].fn,
        origFunc: overwriteArr[f].obj[overwriteArr[f].fn]
      });
      overwriteArr[f].obj[overwriteArr[f].fn] = overwriteArr[f].new;
    }

    try {
      func();
    }
    finally {
      for (let i in origFuncs) {
        origFuncs[i].obj[origFuncs[i].fn] = origFuncs[i].origFunc;
      }
    }
  };
}


function withPreferences(func) {
  return function() {
    const keyRefreshPrefs = EnigmailPrefs.getPref("keyRefreshOn");
    const keyserverPrefs = EnigmailPrefs.getPref("keyserver");
    try {
      func();
    }
    finally {
      EnigmailPrefs.setPref("keyRefreshOn", keyRefreshPrefs);
      EnigmailPrefs.setPref("keyserver", keyserverPrefs);
    }
  };
}

/**
 * Create a test account called Enigmail Unit Test with 3 identities:
 * - user1@enigmail-test.net - uses a specific key ID
 * - user2@enigmail-test.net - determine key be Email addresses
 * - user3@enigmail-test.net - Enigmail disabled
 * - user4@enigmail-test.net - determine key be Email addresses
 */

function setupTestAccounts(primaryEmail = null, primaryKeyId = null) {

  const UNITTEST_ACCT_NAME = "Enigmail Unit Test";
  setupTestAccount(UNITTEST_ACCT_NAME, "dummy", primaryEmail, primaryKeyId);
}

function setupTestAccount(accountName, incomingServerUserName, primaryEmail = null, primaryKeyId = null) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;

  // sanity check
  let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);


  function reportError() {
    return "Your profile is not set up correctly for Enigmail Unit Tests\n" +
      "Please ensure that your profile contains only one Accounts of type POP3.\n";
  }

  function setIdentityData(ac, idNumber, idName, fullName, email, useEnigmail, keyId) {

    let id;

    if (ac.identities.length < idNumber - 1) throw "error - cannot add Identity with gaps";
    else if (ac.identities.length === idNumber - 1) {
      id = accountManager.createIdentity();
      ac.addIdentity(id);
    }
    else {
      id = ac.identities.queryElementAt(idNumber - 1, Ci.nsIMsgIdentity);
    }

    id.fullName = fullName;
    id.email = email;
    id.composeHtml = true;
    id.setBoolAttribute("enablePgp", useEnigmail);

    if (keyId) {
      id.setIntAttribute("pgpKeyMode", 1);
      id.setCharAttribute("pgpkeyId", keyId);
    }
  }

  function setupAccount(ac) {
    let is = ac.incomingServer;
    is.downloadOnBiff = false;
    is.doBiff = false;
    is.performingBiff = false;
    is.loginAtStartUp = false;

    if (primaryKeyId === null) primaryKeyId = "ABCDEF0123456789";
    if (primaryEmail === null) primaryEmail = "user1@enigmail-test.net";

    setIdentityData(ac, 1, "Enigmail Unit Test 1", "John Doe I.", primaryEmail, true, primaryKeyId);
    setIdentityData(ac, 2, "Enigmail Unit Test 2", "John Doe II.", "user2@enigmail-test.net", true);
    setIdentityData(ac, 3, "Enigmail Unit Test 3", "John Doe III.", "user3@enigmail-test.net", false);
    setIdentityData(ac, 4, "Enigmail Unit Test 4", "John Doe IV.", "user4@enigmail-test.net", true);
  }

  for (let acct = 0; acct < accountManager.accounts.length; acct++) {
    let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);
    if (ac.incomingServer.type !== "none" && ac.incomingServer.type !== "pop3") {
      throw reportError();
    }
  }

  let configured = 0;
  let gotAc = null;

  // try to configure existing account
  for (let acct = 0; acct < accountManager.accounts.length; acct++) {
    let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);
    if (ac.incomingServer.type === "pop3" && ac.incomingServer.prettyName === accountName) {
      setupAccount(ac);
      gotAc = ac;
      ++configured;
    }
  }

  // if no account existed, create new account
  if (configured === 0) {
    let ac = accountManager.createAccount();
    let is = accountManager.createIncomingServer(incomingServerUserName, "localhost", "pop3");
    is.prettyName = accountName;
    ac.incomingServer = is;
    gotAc = ac;
    setupAccount(ac);
  }

  return gotAc;
}

Components.utils.import("chrome://enigmail/content/modules/core.jsm"); /*global EnigmailCore: false */

function withEnigmail(f) {
  return function() {
    try {
      const enigmail = EnigmailCore.createInstance();
      const window = JSUnit.createStubWindow();
      enigmail.initialize(window, "");
      return f(EnigmailCore.getEnigmailService(), window);
    }
    finally {
      shutdownGpgAgent();
      EnigmailCore.setEnigmailService(null);
    }
  };
}

function shutdownGpgAgent() {
  const EnigmailGpgAgent = Components.utils.import("chrome://enigmail/content/modules/gpgAgent.jsm").EnigmailGpgAgent;
  const subprocess = Components.utils.import("chrome://enigmail/content/modules/subprocess.jsm").subprocess;

  if (EnigmailGpgAgent.gpgconfPath) {
    const proc = {
      command: EnigmailGpgAgent.gpgconfPath,
      arguments: ["--kill", "gpg-agent"],
      environment: EnigmailCore.getEnvList(),
      charset: null,
      mergeStderr: false
    };

    try {
      subprocess.call(proc).wait();
    }
    catch (ex) {
      Assert.ok(false, "Could not kill gpg-agent");
    }
  }
}


CustomAssert.registerExtraAssertionsOn(Assert);

Components.utils.import("chrome://enigmail/content/modules/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("chrome://enigmail/content/modules/prefs.jsm"); /*global EnigmailPrefs: false */
function withLogFiles(f) {
  return function() {
    try {
      EnigmailLog.setLogLevel(5);
      f();
    }
    finally {
      EnigmailLog.onShutdown();
      EnigmailLog.createLogFiles();
    }
  };
}

function assertLogContains(expected) {
  let failureMessage = "Expected log to contain: " + expected;
  Assert.ok(EnigmailLog.getLogData(EnigmailCore.version, EnigmailPrefs).indexOf(expected) !== -1, failureMessage);
}

function assertLogDoesNotContain(expected) {
  Assert.equal(EnigmailLog.getLogData(EnigmailCore.version, EnigmailPrefs).indexOf(expected), -1);
}
