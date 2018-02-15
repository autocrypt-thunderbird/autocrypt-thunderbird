/*global test:false, component: false, testing: false, Assert: false, do_load_module: false, do_get_cwd: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withPreferences: false, resetting: false, withEnvironment: false, withEnigmail: false, withTestGpgHome: false, getKeyListEntryOfKey: false, gKeyListObj: true */

testing("keyserver.jsm"); /*global validKeyserversExist: false, currentProxyModule: true, Ci, executeRefresh: false, gpgRequest: false, requestOverTorWithSocks: false, requestOverTorWithHelper: false, build: false, buildRequests: false parseKeyserverUrl: false */
component("enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
component("enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
component("enigmail/gpg.jsm"); /*global EnigmailGpg: false */
component("enigmail/locale.jsm"); /*global EnigmailLocale: false */
component("enigmail/constants.jsm"); /*global EnigmailConstants: false */

function setupKeyserverPrefs(keyservers, autoOn) {
  EnigmailPrefs.setPref("keyserver", keyservers);
  EnigmailPrefs.setPref("autoKeyServerSelection", autoOn);
}

function isGpgExecutable(fullPath) {
  let path = fullPath.replace(/^(.*\/)([^/]+)$/, "$2");
  return (path.search(/^gpg/i) === 0);
}

function torNotAvailableProperties() {
  return {
    isAvailable: false,
    useTorMode: false,
    socks: null,
    helper: null
  }
}

test(function setupRequestWithTorHelper() {
  const torArgs = ["--user", "randomUser", "--pass", "randomPassword", "/usr/bin/gpg2"];
  const torProperties = {
    command: {
      path: "/usr/bin/torsocks"
    },
    args: torArgs,
    envVars: ["TORSOCKS_USERNAME=abc", "TORSOCKS_PASSWORD=def"]
  };
  const expectedArgs = torArgs
    .concat(EnigmailGpg.getStandardArgs(true))
    .concat(["--keyserver", "hkps://keyserver.1:443"])
    .concat(["--recv-keys", "1234"]);
  const action = EnigmailConstants.DOWNLOAD_KEY;

  const request = requestOverTorWithHelper("1234", "hkps://keyserver.1:443", torProperties, action);

  Assert.equal(request.command.path, "/usr/bin/torsocks");
  Assert.deepEqual(request.args, expectedArgs);
  Assert.deepEqual(request.envVars, torProperties.envVars);
});

test(function setupRequestWithTorHelperWithEnvVariables() {
  const torArgs = ["--user", "randomUser", "--pass", "randomPassword", "/usr/bin/gpg2"];
  const torProperties = {
    command: {
      path: "/usr/bin/torsocks"
    },
    args: torArgs,
    envVars: ["TORSOCKS_USERNAME=abc", "TORSOCKS_USERNAME=def"]
  };

  const expectedArgs = torArgs
    .concat(EnigmailGpg.getStandardArgs(true))
    .concat(["--keyserver", "hkps://keyserver.1:443"])
    .concat(["--recv-keys", "1234"]);
  const action = EnigmailConstants.DOWNLOAD_KEY;

  const request = requestOverTorWithHelper("1234", "hkps://keyserver.1:443", torProperties, action);

  Assert.equal(request.command.path, "/usr/bin/torsocks");
  Assert.deepEqual(request.args, expectedArgs);
  Assert.deepEqual(request.envVars, torProperties.envVars);
});

test(withTestGpgHome(withEnigmail(function setupRequestWithTorGpgProxyArguments() {
  const gpgProxyArgs = ["socks5h://randomUser:randomPassword@127.0.0.1:9050"];
  const torProperties = {
    command: "gpg",
    args: gpgProxyArgs,
    envVars: []
  };
  const expectedGpgProxyArgs = ["--keyserver-options", "http-proxy=socks5h://randomUser:randomPassword@127.0.0.1:9050"];
  const expectedArgs = EnigmailGpg.getStandardArgs(true)
    .concat(["--keyserver", "hkps://keyserver.1:443"])
    .concat(expectedGpgProxyArgs)
    .concat(["--recv-keys", "1234"]);
  const action = EnigmailConstants.DOWNLOAD_KEY;

  const request = requestOverTorWithSocks("1234", "hkps://keyserver.1:443", torProperties, action);

  Assert.ok(isGpgExecutable(request.command.path));
  Assert.deepEqual(request.args, expectedArgs);
})));

test(function testBuildNormalRequestWithStandardArgs() {
  const refreshKeyArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", "1234"]);
  const protocol = "hkps://keyserver.1:443";
  const action = EnigmailConstants.DOWNLOAD_KEY;
  const useTor = false;

  const request = gpgRequest("1234", protocol, action, useTor);

  Assert.ok(isGpgExecutable(request.command.path));

  Assert.deepEqual(request.args, refreshKeyArgs);
  Assert.equal(request.usingTor, false);
});

test(function testBuildNormalRequestOverTorWithStandardArgs() {
  const refreshKeyArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", "1234"]);
  const protocol = "hkps://keyserver.1:443";
  const action = EnigmailConstants.DOWNLOAD_KEY;
  const useTor = true;

  const request = gpgRequest("1234", protocol, action, useTor);

  Assert.ok(isGpgExecutable(request.command.path));
  Assert.deepEqual(request.args, refreshKeyArgs);
  Assert.equal(request.isDownload, true);
  Assert.equal(request.usingTor, true);
});

test(withEnigmail(function createsRegularRequests_whenUserDoesNotWantTor() {
  setupKeyserverPrefs("keyserver.1", true);
  const tor = {
    torProperties: function() {
      return {
        helper: null,
        socks: null,
        useTorMode: false,
        isAvailable: false
      };
    },
    isRequired: function() {
      return false;
    },
    isPreferred: function() {
      return false;
    },
    getTorNotAvailableProperties: torNotAvailableProperties
  };
  const expectedKeyId = "1234";

  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests(expectedKeyId, refreshAction, tor);

  Assert.equal(requests[0].command, EnigmailGpgAgent.agentPath);
  Assert.equal(requests[0].usingTor, false);
  Assert.deepEqual(requests[0].args, EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", expectedKeyId]));

  Assert.equal(requests[1].command, EnigmailGpgAgent.agentPath);
  Assert.equal(requests[1].usingTor, false);
  Assert.deepEqual(requests[1].args, EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--recv-keys", expectedKeyId]));
}));

test(withEnigmail(function createsRequestsWithTorAndWithoutTor_whenTorExistsOverHelperAndSocksArguments(enigmail) {
  setupKeyserverPrefs("keyserver.1", true);
  const keyId = "1234";
  const torArgs = ["--user", "randomUser", "--pass", "randomPassword", "/usr/bin/gpg2"];
  const socksArgs = "socks5-hostname://someUser:somePass@127.0.0.1:9050";

  const socks5HkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--keyserver-options", "http-proxy=" + socksArgs, "--recv-keys", keyId]);
  const hkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", keyId]);

  const hkpArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--recv-keys", keyId]);
  const tor = {
    torProperties: function() {
      return {
        helper: {
          command: {
            path: "/usr/bin/torsocks"
          },
          args: torArgs,
          envVars: []
        },
        socks: null,
        isAvailable: true
      };
    },
    isRequired: function(action) {
      return false;
    },
    isPreferred: function(action) {
      return true;
    },
    getTorNotAvailableProperties: torNotAvailableProperties
  };

  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests(keyId, refreshAction, tor);

  Assert.equal(requests.length, 4);

  Assert.equal(requests[0].command.path, "/usr/bin/torsocks");
  Assert.deepEqual(requests[0].args, torArgs.concat(hkpsArgs));

  Assert.equal(requests[1].command.path, "/usr/bin/torsocks");
  Assert.deepEqual(requests[1].args, torArgs.concat(hkpArgs));

  Assert.ok(isGpgExecutable(requests[2].command.path));
  Assert.deepEqual(requests[2].args, hkpsArgs);

  Assert.ok(isGpgExecutable(requests[3].command.path));
  Assert.deepEqual(requests[3].args, hkpArgs);
}));

test(withEnigmail(function createsRequestsWithTorAndWithoutTor_whenTorExistsOverSocksOnly(enigmail) {
  setupKeyserverPrefs("keyserver.1", true);
  const keyId = "1234";
  const torArgs = ["--user", "randomUser", "--pass", "randomPassword", "/usr/bin/gpg2"];
  const socksArgs = "socks5-hostname://someUser:somePass@127.0.0.1:9050";

  const socks5HkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--keyserver-options", "http-proxy=" + socksArgs, "--recv-keys", keyId]);
  const hkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", keyId]);

  const socks5HkpArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--keyserver-options", "http-proxy=" + socksArgs, "--recv-keys", keyId]);
  const hkpArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--recv-keys", keyId]);
  const tor = {
    torProperties: function() {
      return {
        helper: {
          command: {
            path: "/usr/bin/torsocks"
          },
          args: torArgs,
          envVars: []
        },
        socks: {
          command: "gpg",
          args: socksArgs,
          envVars: []
        },
        isAvailable: true
      };
    },
    isRequired: function(action) {
      return false;
    },
    isPreferred: function(action) {
      return true;
    },
    getTorNotAvailableProperties: torNotAvailableProperties
  };

  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests(keyId, refreshAction, tor);

  Assert.equal(requests.length, 6);

  Assert.equal(requests[0].command.path, "/usr/bin/torsocks");
  Assert.deepEqual(requests[0].args, torArgs.concat(hkpsArgs));

  Assert.ok(isGpgExecutable(requests[1].command.path));
  Assert.deepEqual(requests[1].args, socks5HkpsArgs);

  Assert.equal(requests[2].command.path, "/usr/bin/torsocks");
  Assert.deepEqual(requests[2].args, torArgs.concat(hkpArgs));

  Assert.ok(isGpgExecutable(requests[3].command.path));
  Assert.deepEqual(requests[3].args, socks5HkpArgs);

  Assert.ok(isGpgExecutable(requests[4].command.path));
  Assert.deepEqual(requests[4].args, hkpsArgs);

  Assert.ok(isGpgExecutable(requests[4].command.path));
  Assert.deepEqual(requests[5].args, hkpArgs);
}));

test(withEnigmail(function createsNormalRequests_whenTorDoesntExist() {
  setupKeyserverPrefs("keyserver.1", true);
  const keyId = "1234";
  const hkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", keyId]);
  const hkpArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--recv-keys", keyId]);
  const tor = {
    torProperties: function() {
      return {
        helper: null,
        socks: null,
        useTorMode: false,
        isAvailable: false
      };
    },
    isRequired: function() {
      return false;
    },
    isPreferred: function() {
      return true;
    },
    getTorNotAvailableProperties: torNotAvailableProperties
  };
  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests(keyId, refreshAction, tor);

  Assert.equal(requests.length, 2);

  Assert.ok(isGpgExecutable(requests[0].command.path));
  Assert.deepEqual(requests[0].args, hkpsArgs);

  Assert.ok(isGpgExecutable(requests[1].command.path));
  Assert.deepEqual(requests[1].args, hkpArgs);
}));

test(withEnigmail(function createsNormalRequests_whenTorUsesNormal() {
  setupKeyserverPrefs("keyserver.1", true);
  const keyId = "1234";
  const hkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", keyId]);
  const hkpArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--recv-keys", keyId]);
  const tor = {
    torProperties: function() {
      return {
        helper: null,
        socks: null,
        useTorMode: true,
        isAvailable: true
      };
    },
    isRequired: function() {
      return false;
    },
    isPreferred: function() {
      return true;
    },
    getTorNotAvailableProperties: torNotAvailableProperties
  };
  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests(keyId, refreshAction, tor);

  Assert.equal(requests.length, 2);

  Assert.ok(isGpgExecutable(requests[0].command.path));
  Assert.deepEqual(requests[0].args, hkpsArgs);

  Assert.ok(isGpgExecutable(requests[1].command.path));
  Assert.deepEqual(requests[1].args, hkpArgs);
}));


test(withEnigmail(function createsRequestsWithOnlyTor_whenTorIsRequired(enigmail) {
  setupKeyserverPrefs("keyserver.1", true);
  const keyId = "1234";
  const torArgs = ["--user", "randomUser", "--pass", "randomPassword", "/usr/bin/gpg2"];
  const socksArgs = "socks5-hostname://someUser:somePass@127.0.0.1:9050";

  const socks5HkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--keyserver-options", "http-proxy=" + socksArgs, "--recv-keys", keyId]);
  const hkpsArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkps://keyserver.1:443", "--recv-keys", keyId]);

  const socks5HkpArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--keyserver-options", "http-proxy=" + socksArgs, "--recv-keys", keyId]);
  const hkpArgs = EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--recv-keys", keyId]);
  const tor = {
    torProperties: function() {
      return {
        helper: {
          command: {
            path: "/usr/bin/torsocks"
          },
          args: torArgs,
          envVars: []
        },
        socks: {
          command: "gpg",
          args: socksArgs,
          envVars: []
        },
        isAvailable: true,
        useTorMode: false
      };
    },
    isRequired: function(action) {
      return true;
    },
    isPreferred: function(action) {
      return true;
    },
    getTorNotAvailableProperties: torNotAvailableProperties
  };

  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests(keyId, refreshAction, tor);

  Assert.equal(requests.length, 4);

  Assert.equal(requests[0].command.path, "/usr/bin/torsocks");
  Assert.deepEqual(requests[0].args, torArgs.concat(hkpsArgs));

  Assert.ok(isGpgExecutable(requests[1].command.path));
  Assert.deepEqual(requests[1].args, socks5HkpsArgs);

  Assert.equal(requests[2].command.path, "/usr/bin/torsocks");
  Assert.deepEqual(requests[2].args, torArgs.concat(hkpArgs));

  Assert.ok(isGpgExecutable(requests[3].command.path));
  Assert.deepEqual(requests[3].args, socks5HkpArgs);
}));

test(withEnigmail(function returnNoRequests_whenTorIsRequiredButNotAvailable() {
  setupKeyserverPrefs("keyserver.1, keyserver.2", true);
  EnigmailPrefs.setPref("downloadKeyRequireTor", true);
  const tor = {
    torProperties: function() {
      return {
        socks: null,
        helper: null,
        isAvailable: false,
        useTorMode: false
      };
    },
    isRequired: function() {
      return true;
    },
    isPreferred: function() {
      return true;
    },
    getTorNotAvailableProperties: torNotAvailableProperties
  };

  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests("1234", refreshAction, tor);
  Assert.equal(requests.length, 0);
}));

function setupAgentPathAndRequest(enigmail) {
  withEnvironment({}, function(e) {
    resetting(EnigmailGpgAgent, "agentPath", "/usr/bin/gpg-agent", function() {
      enigmail.environment = e;
    });
  });
  return {
    command: EnigmailGpgAgent.agentPath,
    envVars: [],
    args: EnigmailGpg.getStandardArgs(true).concat(["--keyserver", "hkp://keyserver.1:11371", "--recv-keys", "1234"])
  };
}

test(withEnigmail(function executeReportsFailure_whenReceivingConfigurationError(enigmail) {
  const simpleRequest = setupAgentPathAndRequest(enigmail);
  const subproc = {
    callWasCalled: false,
    call: function(proc) {
      subproc.callWasCalled = true;
      proc.stderr("gpg: keyserver receive failed: Configuration error\n");
      proc.done(2);
      return {
        wait: function() {}
      };
    }
  };

  const result = executeRefresh(simpleRequest, subproc);
  Assert.equal(result, false);
}));

test(withEnigmail(function executeReportsSuccess_whenReceivingImportSuccessful(enigmail) {
  const simpleRequest = setupAgentPathAndRequest(enigmail);
  const subproc = {
    callWasCalled: false,
    call: function(proc) {
      subproc.callWasCalled = true;
      proc.stderr("[GNUPG:] IMPORT_OK ");
      proc.stderr("gpg: requesting key KEYID from hkps server keyserver.1\n");
      proc.stderr("gpg: key KEYID: public key KEYOWNER <KEYOWNER@EMAIL> imported\n");
      proc.stderr("gpg: 3 marginal(s) needed, 1 complete(s) needed, PGP trust model\n");
      proc.stderr("gpg: depth: 0  valid:   2  signed:   0  trust: 0-, 0q, 0n, 0m, 0f, 2u\n" +
        "gpg: Total number processed: 1\n" +
        "gpg:               imported: 1  (RSA: 1)\n");
      proc.done(0);
      return {
        wait: function() {}
      };
    }
  };

  const result = executeRefresh(simpleRequest, subproc);
  Assert.equal(result, true);
}));

test(function testBasicNormalQuery() {
  const actionflags = EnigmailConstants.REFRESH_KEY;
  const keyserver = "keyserver0005";
  const searchterms = "";
  const errormsgobj = {};
  currentProxyModule = {
    getHttpProxy: function() {
      return null;
    }
  };

  const expectedArgs = EnigmailGpg.getStandardArgs(true)
    .concat("--keyserver")
    .concat("keyserver0005")
    .concat("--refresh-keys");

  const keyRequest = build(actionflags, keyserver, searchterms, errormsgobj);

  Assert.deepEqual(keyRequest.args, expectedArgs);
  Assert.equal(keyRequest.inputData, null);
  Assert.equal(keyRequest.isDownload, true);
  Assert.equal(errormsgobj.value, null);
});

test(function testBasicNormalQueryWithHTTPPRoxy() {
  const actionflags = EnigmailConstants.REFRESH_KEY;
  const keyserver = "keyserver0005";
  const searchterms = "1";
  const errormsgobj = {};
  currentProxyModule = {
    getHttpProxy: function() {
      return "someHttpProxy";
    }
  };

  const expectedArgs = EnigmailGpg.getStandardArgs(true)
    .concat("--keyserver")
    .concat("keyserver0005")
    .concat("--keyserver-options")
    .concat("http-proxy=someHttpProxy")
    .concat("--refresh-keys");

  const keyRequest = build(actionflags, keyserver, searchterms, errormsgobj);

  Assert.deepEqual(keyRequest.args, expectedArgs);
  Assert.equal(keyRequest.inputData, null);
  Assert.equal(keyRequest.isDownload, true);
  Assert.equal(errormsgobj.value, null);
});

test(function testBasicNormalQueryWithInputData() {
  const actionflags = EnigmailConstants.SEARCH_KEY;
  const keyserver = "keyserver0005";
  const searchterms = "1";
  const errormsgobj = {};
  currentProxyModule = {
    getHttpProxy: function() {
      return null;
    }
  };

  const expectedArgs = EnigmailGpg.getStandardArgs(false)
    .concat(["--command-fd", "0", "--fixed-list", "--with-colons"])
    .concat("--keyserver")
    .concat("keyserver0005")
    .concat("--search-keys")
    .concat("1");

  const keyRequest = build(actionflags, keyserver, searchterms, errormsgobj);

  Assert.deepEqual(keyRequest.args, expectedArgs);
  Assert.equal(keyRequest.inputData, "quit\n");
  Assert.equal(keyRequest.isDownload, false);
  Assert.equal(errormsgobj.value, null);
});

test(function testNormalReceiveKeyQuery() {
  const actionflags = EnigmailConstants.DOWNLOAD_KEY;
  const keyserver = "keyserver0005";
  const searchterms = "0001";
  const errormsgobj = {};
  currentProxyModule = {
    getHttpProxy: function() {
      return null;
    }
  };

  const expectedArgs = EnigmailGpg.getStandardArgs(true)
    .concat("--keyserver")
    .concat("keyserver0005")
    .concat("--recv-keys")
    .concat("0001");

  const keyRequest = build(actionflags, keyserver, searchterms, errormsgobj);

  Assert.deepEqual(keyRequest.args, expectedArgs);
  Assert.equal(keyRequest.inputData, null);
  Assert.equal(keyRequest.isDownload, true);
  Assert.equal(errormsgobj.value, null);
});

test(function testNormalUploadKeyRequest() {
  const actionflags = EnigmailConstants.UPLOAD_KEY;
  const keyserver = "keyserver0005";
  const searchterms = "0001";
  const errormsgobj = {};
  currentProxyModule = {
    getHttpProxy: function() {
      return null;
    }
  };

  const expectedArgs = EnigmailGpg.getStandardArgs(true)
    .concat("--keyserver")
    .concat("keyserver0005")
    .concat("--send-keys")
    .concat("0001");

  const keyRequest = build(actionflags, keyserver, searchterms, errormsgobj);

  Assert.deepEqual(keyRequest.args, expectedArgs);
  Assert.equal(keyRequest.inputData, null);
  Assert.equal(keyRequest.isDownload, false);
  Assert.equal(errormsgobj.value, null);
});

test(function testErrorQueryWithNoKeyserver() {
  const actionflags = EnigmailConstants.UPLOAD_KEY;
  const keyserver = null;
  const searchterms = "0001";
  const errormsgobj = {};
  currentProxyModule = {
    getHttpProxy: function() {
      return null;
    }
  };

  const result = build(actionflags, keyserver, searchterms, errormsgobj);

  Assert.equal(result, null);
  Assert.equal(errormsgobj.value, EnigmailLocale.getString("failNoServer"));
});

test(function testErrorSearchQueryWithNoID() {
  const actionflags = EnigmailConstants.SEARCH_KEY;
  const keyserver = "keyserver0005";
  const searchterms = null;
  const errormsgobj = {};
  currentProxyModule = {
    getHttpProxy: function() {
      return null;
    }
  };

  const result = build(actionflags, keyserver, searchterms, errormsgobj);

  Assert.equal(result, null);
  Assert.equal(errormsgobj.value, EnigmailLocale.getString("failNoID"));
});

test(function testParseUrl() {
  let srv = "abc.de.fg";
  const HKP = "hkp";
  const HKP_PORT = "11371";
  let r = parseKeyserverUrl(srv);

  Assert.equal(r.host, srv);
  Assert.equal(r.protocol, HKP);
  Assert.equal(r.port, HKP_PORT);

  r = parseKeyserverUrl("hkps://" + srv);
  Assert.equal(r.host, srv);
  Assert.equal(r.protocol, "hkps");
  Assert.equal(r.port, "443");

  r = parseKeyserverUrl("ldap://" + srv + ":765");
  Assert.equal(r.host, srv);
  Assert.equal(r.protocol, "ldap");
  Assert.equal(r.port, "765");

});
