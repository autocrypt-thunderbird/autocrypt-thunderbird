/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global TestHelper: false, withEnvironment: false, nsIWindowsRegKey: true */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");
/*global TestHelper: false, withEnvironment: false, withEnigmail: false, component: false, withTestGpgHome: false, osUtils: false */

testing("gpg.jsm"); /*global EnigmailGpg: false, getGpgFeature: false, lazyEnv: true, usesDirmngr: false, dirmngrConfiguredWithTor: false */
component("enigmail/execution.jsm"); /*global EnigmailExecution: false, MINIMUM_GPG_VERSION: false */
component("enigmail/subprocess.jsm"); /*global subprocess: false */
component("enigmail/files.jsm"); /*global EnigmailFiles: false */
component("enigmail/os.jsm"); /*global EnigmailOS: false */
component("enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
component("enigmail/versioning.jsm"); /*global EnigmailVersioning: false */

function withStubFormatCmdLine(f) {
  return function() {
    TestHelper.resetting(EnigmailFiles, "formatCmdLine", function(executable) {
      return "";
    }, function() {
      f();
    });
  };
}

test(withStubFormatCmdLine(function shouldUseResolveToolPathWhenCheckingDirmngrConfiguration() {
  TestHelper.resetting(EnigmailGpgAgent, "resolveToolPath", function(executable) {
    Assert.equal(executable, "gpg-connect-agent");
    return;
  }, function() {
    TestHelper.resetting(subprocess, "call", function(subprocObj) {
      return {
        wait: function() {}
      };
    }, function() {
      dirmngrConfiguredWithTor();
    });
  });
}));

test(withStubFormatCmdLine(function returnsFalseWhenNotConfiguredToUseTor() {
  TestHelper.resetting(EnigmailGpg, "getGpgFeature", function(feature) {
    return false;
  }, function() {
    Assert.equal(dirmngrConfiguredWithTor(), false);
  });
}));

test(withStubFormatCmdLine(function returnsTrueWhenConfiguredToUseTor() {
  TestHelper.resetting(EnigmailGpg, "getGpgFeature", function(feature) {
    return true;
  }, function() {
    TestHelper.resetting(EnigmailGpgAgent, "resolveToolPath", function(executable) {
      return {
        path: "/usr/bin/gpg-connect-agent"
      };
    }, function() {
      TestHelper.resetting(subprocess, "call", function(subprocObj) {
        subprocObj.stdout("OK - Tor mode is enabled\n OK closing connection\n");

        if (typeof subprocObj.done === "function") {
          subprocObj.done({
            exitCode: 0
          });
        }
        return {
          wait: function() {
            return 0;
          }
        };
      }, function() {

        Assert.equal(dirmngrConfiguredWithTor(), true);
      });
    });
  });
}));

test(withStubFormatCmdLine(function returnsFalseWhenNotConfiguredToUseTor() {
  TestHelper.resetting(EnigmailGpg, "getGpgFeature", function(feature) {
    return true;
  }, function() {
    TestHelper.resetting(EnigmailGpgAgent, "resolveToolPath", function(executable) {
      return {
        path: "/usr/bin/gpg-connect-agent"
      };
    }, function() {
      TestHelper.resetting(subprocess, "call", function(subprocObj) {
        subprocObj.stdout("OK - Tor mode is NOT enabled\n OK closing connection\n");

        if (typeof subprocObj.done === "function") {
          subprocObj.done({
            exitCode: 0
          });
        }

        return {
          wait: function() {
            return 0;
          }
        };
      }, function() {

        Assert.equal(dirmngrConfiguredWithTor(), false);
      });
    });
  });
}));

test(withStubFormatCmdLine(function returnsFalseWhenGpgConnectAgentPathIsNotFound() {
  TestHelper.resetting(EnigmailGpgAgent, "resolveToolPath", function(executable) {
    return null;
  }, function() {

    Assert.equal(dirmngrConfiguredWithTor(), false);
  });
}));

test(withStubFormatCmdLine(function returnsFalseWhenExitCodeIndicatesErrorInExecution() {
  TestHelper.resetting(EnigmailGpgAgent, "resolveToolPath", function(executable) {
    return {
      path: "/usr/bin/gpg-connect-agent"
    };
  }, function() {
    TestHelper.resetting(subprocess, "call", function(subprocObj) {
      subprocObj.stdout("");
      subprocObj.done();
      return {
        wait: function() {}
      };
    }, function() {

      Assert.equal(dirmngrConfiguredWithTor(), false);
    });
  });
}));


test(function testGetGpgFeatureForWhenVersionIsSupported() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", MINIMUM_GPG_VERSION, function() {
    const output = EnigmailGpg.getGpgFeature("version-supported");
    Assert.equal(output, true);
  });
});

test(function testGetGpgFeatureForWhenVersionIsSupported() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.0.0", function() {
    const output = EnigmailGpg.getGpgFeature("version-supported");
    Assert.equal(output, false);
  });
});

test(function testGetGpgFeatureForWhenVersionSupportsGpgAgent() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.0.0", function() {
    const output = EnigmailGpg.getGpgFeature("supports-gpg-agent");
    Assert.equal(output, true);
  });
});

test(function testGetGpgFeatureForWhenVersionDoesNotSupportGpgAgent() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "1.4", function() {
    const output = EnigmailGpg.getGpgFeature("supports-gpg-agent");
    Assert.equal(output, false);
  });
});


test(function testGetGpgFeatureForWhenVersionDoesNotSupportKeygenPassPhrase() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.1", function() {
    const output = EnigmailGpg.getGpgFeature("keygen-passphrase");
    Assert.equal(output, false);
  });
});

test(function testGetGpgFeatureForWhenVersionSupportsKeygenPassPhrase() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.1.2", function() {
    const output = EnigmailGpg.getGpgFeature("keygen-passphrase");
    Assert.equal(output, true);
  });
});

test(function testGetGpgFeatureForWhenVersionSupportsGenKeyNoProtection() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.1.2", function() {
    const output = EnigmailGpg.getGpgFeature("genkey-no-protection");
    Assert.equal(output, true);
  });
});

test(function testGetGpgFeatureForWhenVersionDoesNotSupportSender() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.1.14", function() {
    const output = EnigmailGpg.getGpgFeature("supports-sender");
    Assert.equal(output, false);
  });
});

test(function testGetGpgFeatureForWhenVersionDoesSupportSender() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.1.15", function() {
    const output = EnigmailGpg.getGpgFeature("supports-sender");
    Assert.equal(output, true);
  });
});

test(function testGetGpgFeatureForWhenVersionDoesNotSupportGenKeyNoProtection() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.0", function() {
    const output = EnigmailGpg.getGpgFeature("genkey-no-protection");
    Assert.equal(output, false);
  });
});

test(function testGetGpgFeatureForWhenVersionSupportsWindowsPhotoidBug() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.0.16", function() {
    const output = EnigmailGpg.getGpgFeature("windows-photoid-bug");
    Assert.equal(output, false);
  });
});

test(function testGetGpgFeatureForWhenVersionDoesNotSupportWindowsPhotoidBug() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.0.15", function() {
    const output = EnigmailGpg.getGpgFeature("windows-photoid-bug");
    Assert.equal(output, true);
  });
});

test(function testGetGpgFeatureForUnkownFeature() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "2.0.15", function() {
    const output = EnigmailGpg.getGpgFeature("I_am_unsupported");
    Assert.equal(output, undefined);
  });
});

test(function testGetGpgFeatureForNullAgentVersion() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", null, function() {
    const output = EnigmailGpg.getGpgFeature("version-supported");
    Assert.equal(output, undefined);
  });
});

test(function testGetGpgFeatureForInvalidAgentVersion() {
  TestHelper.resetting(EnigmailGpg, "agentVersion", "not a digit", function() {
    const output = EnigmailGpg.getGpgFeature("version-supported");
    Assert.equal(output, undefined);
  });
});
