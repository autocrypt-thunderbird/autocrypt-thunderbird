/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global TestHelper: false, withEnvironment: false, nsIWindowsRegKey: true */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");
/*global TestHelper: false, withEnvironment: false, withEnigmail: false, component: false,
  withTestGpgHome: false, osUtils: false, EnigmailFiles */

testing("gpgAgent.jsm"); /*global EnigmailGpgAgent: false, EnigmailOS: false, getHomedirFromParam: false */
component("enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
component("enigmail/gpg.jsm"); /*global EnigmailGpg: false */

// testing: determineGpgHomeDir
//   environment: GNUPGHOME
//   isWin32:
//     registry Software\GNU\GNUPG\HomeDir
//     environment: USERPROFILE + \Application Data\GnuPG
//     environment: SystemRoot + \Application Data\GnuPG
//     c:\gnupg
//   environment: HOME + .gnupg

test(function determineGpgHomeDirReturnsGNUPGHOMEIfExists() {
  withEnvironment({
    "GNUPGHOME": "stuffResult1"
  }, function(e) {
    var enigmail = {
      environment: e
    };
    Assert.equal("stuffResult1", EnigmailGpgAgent.determineGpgHomeDir(enigmail));
  });
});

// this test cannot be reliably performed on Windows
if (JSUnit.getOS() != "WINNT") {
  test(function determineGpgHomeDirReturnsHomePlusGnupgForNonWindowsIfNoGNUPGHOMESpecificed() {
    withEnvironment({
      "HOME": "/my/little/home"
    }, function(e) {
      e.set("GNUPGHOME", null);
      var enigmail = {
        environment: e
      };
      Assert.equal("/my/little/home/.gnupg", EnigmailGpgAgent.determineGpgHomeDir(enigmail));
    });
  });
}

test(function determineGpgHomeDirReturnsRegistryValueForWindowsIfExists() {
  withEnvironment({}, function(e) {
    e.set("GNUPGHOME", null);
    resetting(EnigmailOS, 'getWinRegistryString', function(a, b, c) {
      if (a === "Software\\GNU\\GNUPG" && b === "HomeDir" && c === "foo bar") {
        return "\\foo\\bar\\gnupg";
      }
      else {
        return "\\somewhere\\else";
      }
    }, function() {
      resetting(EnigmailOS, 'isWin32', true, function() {
        var enigmail = {
          environment: e
        };
        nsIWindowsRegKey = {
          ROOT_KEY_CURRENT_USER: "foo bar"
        };
        Assert.equal("\\foo\\bar\\gnupg", EnigmailGpgAgent.determineGpgHomeDir(enigmail));
      });
    });
  });
});

test(function determineGpgHomeDirReturnsUserprofileIfItExists() {
  withEnvironment({
    "USERPROFILE": "\\bahamas"
  }, function(e) {
    e.set("GNUPGHOME", null);
    resetting(EnigmailOS, 'getWinRegistryString', function(a, b, c) {}, function() {
      resetting(EnigmailOS, 'isWin32', true, function() {
        var enigmail = {
          environment: e
        };
        nsIWindowsRegKey = {
          ROOT_KEY_CURRENT_USER: "foo bar"
        };
        Assert.equal("\\bahamas\\Application Data\\GnuPG", EnigmailGpgAgent.determineGpgHomeDir(enigmail));
      });
    });
  });
});

test(function determineGpgHomeDirReturnsSystemrootIfItExists() {
  withEnvironment({
    "SystemRoot": "\\tahiti",
    "USERPROFILE": null
  }, function(e) {
    e.set("GNUPGHOME", null);
    resetting(EnigmailOS, 'getWinRegistryString', function(a, b, c) {}, function() {
      resetting(EnigmailOS, 'isWin32', true, function() {
        var enigmail = {
          environment: e
        };
        nsIWindowsRegKey = {
          ROOT_KEY_CURRENT_USER: "foo bar"
        };
        Assert.equal("\\tahiti\\Application Data\\GnuPG", EnigmailGpgAgent.determineGpgHomeDir(enigmail));
      });
    });
  });
});

test(function determineGpgHomeDirReturnsDefaultForWin32() {
  withEnvironment({
    "SystemRoot": null,
    "USERPROFILE": null
  }, function(e) {
    e.set("GNUPGHOME", null);
    resetting(EnigmailOS, 'getWinRegistryString', function(a, b, c) {}, function() {
      resetting(EnigmailOS, 'isWin32', true, function() {
        var enigmail = {
          environment: e
        };
        nsIWindowsRegKey = {
          ROOT_KEY_CURRENT_USER: "foo bar"
        };
        Assert.equal("C:\\gnupg", EnigmailGpgAgent.determineGpgHomeDir(enigmail));
      });
    });
  });
});

function withGpgFeatures(features, f) {
  resetting(EnigmailGpg, 'getGpgFeature', function(feature) {
    return features.indexOf(feature) != -1;
  }, f);
}


// // setAgentPath

test(withEnigmail(function setAgentPathDefaultValues(enigmail) {
  withEnvironment({}, function(e) {
    enigmail.environment = e;
    EnigmailGpgAgent.setAgentPath(JSUnit.createStubWindow(), enigmail);
    Assert.equal("gpg", EnigmailGpgAgent.agentType);
    Assert.equal("gpg", EnigmailGpgAgent.agentPath.leafName.substr(0, 3));
    Assert.equal("gpgconf", EnigmailGpgAgent.gpgconfPath.leafName.substr(0, 7));
    Assert.equal("gpg-connect-agent", EnigmailGpgAgent.connGpgAgentPath.leafName.substr(0, 17));
    // Basic check to test if GnuPG version was properly extracted
    Assert.ok(EnigmailGpg.agentVersion.search(/^[2-9]\.[0-9]+(\.[0-9]+)?/) === 0);
  });
}));

// // resolveToolPath

test(withEnigmail(function resolveToolPathDefaultValues(enigmail) {
  withEnvironment({}, function(e) {
    resetting(EnigmailGpgAgent, 'agentPath', "/usr/bin/gpg-agent", function() {
      enigmail.environment = e;
      var result = EnigmailGpgAgent.resolveToolPath("sort");
      Assert.equal("sort", result.leafName.substr(0, 4));
    });
  });
}));

// route cannot be tested reliably on non-Unix systems
// test(withEnigmail(function resolveToolPathFromPATH(enigmail) {
//     withEnvironment({PATH: "/sbin"}, function(e) {
//         resetting(EnigmailGpgAgent, 'agentPath', "/usr/bin/gpg-agent", function() {
//             enigmail.environment = e;
//             var result = EnigmailGpgAgent.resolveToolPath("route");
//             Assert.equal("/sbin/route", result.path);
//         });
//     });
// }));

// detectGpgAgent
test(withEnigmail(function detectGpgAgentSetsAgentInfoFromEnvironmentVariable(enigmail) {
  withEnvironment({
    GPG_AGENT_INFO: "a happy agent"
  }, function(e) {
    enigmail.environment = e;
    EnigmailGpgAgent.detectGpgAgent(JSUnit.createStubWindow(), enigmail);

    Assert.ok(EnigmailGpgAgent.gpgAgentInfo.preStarted);
    Assert.equal("a happy agent", EnigmailGpgAgent.gpgAgentInfo.envStr);
    Assert.ok(!EnigmailGpgAgent.gpgAgentIsOptional);
  });
}));


test(withEnigmail(function detectGpgAgentWithNoAgentInfoInEnvironment(enigmail) {
  withEnvironment({}, function(e) {
    enigmail.environment = e;
    EnigmailGpgAgent.detectGpgAgent(JSUnit.createStubWindow(), enigmail);

    Assert.ok(!EnigmailGpgAgent.gpgAgentInfo.preStarted);
    Assert.ok(!EnigmailGpgAgent.gpgAgentIsOptional);
    Assert.equal("none", EnigmailGpgAgent.gpgAgentInfo.envStr);
  });
}));


//getGpgHomeDir
test(withTestGpgHome(withEnigmail(function shouldGetGpgHomeDir() {
  let homedirExpected = osUtils.OS.Path.join(EnigmailFiles.getTempDir(), ".gnupgTest");

  let homeDir = EnigmailGpgAgent.getGpgHomeDir();
  Assert.equal(homedirExpected, homeDir);
})));

// getHomedirFromParam
test(function shouldGetHomedirFromParam() {
  let hd = getHomedirFromParam('--homedir /some1/path');
  Assert.equal(hd, "/some1/path");

  hd = getHomedirFromParam('--opt1 --homedir /some2/path --opt2');
  Assert.equal(hd, "/some2/path");

  hd = getHomedirFromParam('--opt1 --homedir   "C:\\My Path\\is\\Very \\"long 1\\"" --opt2');
  Assert.equal(hd, 'C:\\My Path\\is\\Very \\"long 1\\"');

  hd = getHomedirFromParam('--opt1 --homedir "C:\\My Path\\is\\Very \\"long 2\\"" --opt2 "Some \\"more\\" fun"');
  Assert.equal(hd, 'C:\\My Path\\is\\Very \\"long 2\\"');
});
