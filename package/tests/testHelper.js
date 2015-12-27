/*global do_load_module: false, do_get_cwd: false, Components: false, Assert: false,  CustomAssert: false, FileUtils: false, JSUnit: false, EnigmailFiles: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const osUtils = {};
Components.utils.import("resource://gre/modules/osfile.jsm", osUtils);
Components.utils.import("resource://gre/modules/FileUtils.jsm", osUtils);

var TestHelper = {
  loadDirectly: function(name) {
    do_load_module("file://" + do_get_cwd().parent.path + "/" + name);
  },

  loadModule: function(name) {
    Components.utils.import("resource://" + name);
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
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
    createInstance(Components.interfaces.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, 384, 0);
    var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
    createInstance(Components.interfaces.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);
    converter.writeString("pinentry-program " + do_get_cwd().path.replace(/\\/g, "/") + "/pinentry-auto");
    if (JSUnit.getOS() == "WINNT") {
      converter.writeString(".exe");
    }
    converter.writeString("\n");
    converter.close();

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
      // do nothing about it
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
 * Create a test account called Enigmail Unit Test with 3 identities:
 * - user1@enigmail-test.net - uses a specific key ID
 * - user2@enigmail-test.net - determine key be Email addresses
 * - user3@enigmail-test.net - Enigmail disabled
 * - user4@enigmail-test.net - determine key be Email addresses
 */

function setupTestAccounts() {

  const UNITTEST_ACCT_NAME = "Enigmail Unit Test";
  const Cc = Components.classes;
  const Ci = Components.interfaces;

  // sanity check
  let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);


  function reportError() {
    return "Your profile is not set up correctly for Enigmail Unit Tests\n" +
      "Please ensure that your profile contains exactly one Account of type POP3.\n" +
      "The account name must be set to '" + UNITTEST_ACCT_NAME + "'.\n" +
      "Alternatively, you can simply delete all accounts except for the Local Folders\n";
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

    id.identityName = idName;
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

    setIdentityData(ac, 1, "Enigmail Unit Test 1", "John Doe I.", "user1@enigmail-test.net", true, "ABCDEF0123456789");
    setIdentityData(ac, 2, "Enigmail Unit Test 2", "John Doe II.", "user2@enigmail-test.net", true);
    setIdentityData(ac, 3, "Enigmail Unit Test 3", "John Doe III.", "user3@enigmail-test.net", false);
    setIdentityData(ac, 4, "Enigmail Unit Test 4", "John Doe IV.", "user4@enigmail-test.net", true);
  }

  for (let acct = 0; acct < accountManager.accounts.length; acct++) {
    let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);
    if (ac.incomingServer.type !== "none") {
      if (ac.incomingServer.type !== "pop3" || ac.incomingServer.prettyName !== UNITTEST_ACCT_NAME) {
        throw reportError();
      }
    }
  }

  let configured = 0;

  // try to configure existing account
  for (let acct = 0; acct < accountManager.accounts.length; acct++) {
    let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);
    if (ac.incomingServer.type !== "none") {
      setupAccount(ac);
      ++configured;
    }
  }

  // if no account existed, create new account
  if (configured === 0) {
    let ac = accountManager.createAccount();
    let is = accountManager.createIncomingServer("dummy", "localhost", "pop3");
    is.prettyName = UNITTEST_ACCT_NAME;
    ac.incomingServer = is;
    setupAccount(ac);
  }
}

Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
function withEnigmail(f) {
  return function() {
    try {
      const enigmail = Components.classes["@mozdev.org/enigmail/enigmail;1"].
      createInstance(Components.interfaces.nsIEnigmail);
      const window = JSUnit.createStubWindow();
      enigmail.initialize(window, "");
      return f(EnigmailCore.getEnigmailService(), window);
    }
    finally {
      EnigmailCore.setEnigmailService(null);
    }
  };
}

CustomAssert.registerExtraAssertionsOn(Assert);
