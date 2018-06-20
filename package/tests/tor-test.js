/*global do_load_module: false, do_get_cwd: false, testing: false, test: false, Assert:false, component: false, Cc: false, Ci: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";
do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, assertContains: false, withEnigmail: false, withTestGpgHome: false, withEnvironment: false, resetting: false */

testing("tor.jsm"); /*global createRandomCredential, EnigmailTor, torProperties, meetsOSConstraints, MINIMUM_CURL_SOCKS5H_VERSION, MINIMUM_CURL_SOCKS5_PROXY_VERSION, createHelperArgs, gpgProxyArgs, findTorExecutableHelper: false*/

component("enigmail/rng.jsm"); /*global EnigmailRNG*/
component("enigmail/gpg.jsm"); /*global EnigmailGpg: false */
component("enigmail/files.jsm"); /*global EnigmailFiles: false */
component("enigmail/os.jsm"); /*global EnigmailOS: false */
component("enigmail/versioning.jsm"); /*global EnigmailVersioning: false */

let self = this; // eslint-disable-line no-invalid-this

function withStandardGpg(f) {
  return function() {
    EnigmailGpg.dirmngrConfiguredWithTor = function() {
      return false;
    };
    try {
      f();
    }
    finally {}
  };
}

test(function evaluateGpgVersionWhenOsIsWindows() {
  TestHelper.resetting(EnigmailOS, "isDosLike", true, function() {
    TestHelper.resetting(EnigmailGpg, "agentVersion", "1.4.0", function() {
      TestHelper.resetting(EnigmailVersioning, "greaterThanOrEqual", function(version, minimumVersion) {
        Assert.equal(version, "1.4.0");
        return false;
      }, function() {
        Assert.equal(meetsOSConstraints(), false);
      });
    });
  });
});

test(function evaluateMeetsMinimumCurlSocksVersion() {
  TestHelper.resetting(EnigmailOS, "isDosLike", false, function() {
    TestHelper.resetting(EnigmailVersioning, "versionFoundMeetsMinimumVersionRequired", function(executable, minimumVersion) {
      Assert.equal(executable, "curl");
      Assert.deepEqual(minimumVersion, MINIMUM_CURL_SOCKS5_PROXY_VERSION);
      return true;
    }, function() {
      Assert.equal(meetsOSConstraints(), true);
    });
  });
});

test(withEnigmail(function createHelperArgsForTorsocks1(enigmail) {
  EnigmailGpg.setAgentPath("/usr/bin/gpg2");
  const firstSet = createHelperArgs("torsocks", false);
  Assert.deepEqual(firstSet[0], "/usr/bin/gpg2");
}));

test(function createHelperArgsForTorsocks2() {
  EnigmailGpg.setAgentPath("/usr/bin/gpg");
  const args = createHelperArgs("torsocks2", true);

  Assert.deepEqual(args[0], "--user");
  Assert.deepEqual(args[2], "--pass");
  Assert.deepEqual(args[4], "/usr/bin/gpg");
});

test(function createHelperArgsAlwaysReturnsRandomUserAndPass() {
  const firstSet = createHelperArgs("torsocks2", true);
  const secondSet = createHelperArgs("torsocks2", true);

  Assert.notEqual(firstSet[1], secondSet[1]);
  Assert.notEqual(firstSet[3], secondSet[3]);
});

test(function createGpgProxyArgs_forWindows() {
  TestHelper.resetting(EnigmailOS, "isDosLike", true, function() {
    TestHelper.resetting(EnigmailRNG, "generateRandomUint32", function() {
      return "dummyData";
    }, function() {
      const tor = {
        ip: "127.0.0.1",
        port: 9050
      };
      const versioning = {
        versionFoundMeetsMinimumVersionRequired: function(executable, minimum) {
          Assert.equal(executable, "curl");
          Assert.deepEqual(minimum, MINIMUM_CURL_SOCKS5H_VERSION);
          return false;
        }
      };

      const args = gpgProxyArgs(tor, versioning);
      Assert.deepEqual(args, "socks5-hostname://dummyData:dummyData@127.0.0.1:9050");
    });
  });
});

test(function createGpgProxyArgs_forLinux() {
  TestHelper.resetting(EnigmailOS, "isDosLike", false, function() {
    TestHelper.resetting(EnigmailRNG, "generateRandomUint32", function() {
      return "dummyData";
    }, function() {
      const tor = {
        ip: "192.8.8.4",
        port: 9150
      };
      const versioning = {
        versionFoundMeetsMinimumVersionRequired: function(executable, minimum) {
          Assert.equal(executable, "curl");
          Assert.deepEqual(minimum, MINIMUM_CURL_SOCKS5H_VERSION);
          return true;
        }
      };

      const args = gpgProxyArgs(tor, versioning);
      Assert.equal(args, "socks5h://dummyData:dummyData@192.8.8.4:9150");
    });
  });
});

test(withStandardGpg(function testTorPropertiesSearchesForTor() {
  TestHelper.resetting(EnigmailVersioning, "versionFoundMeetsMinimumVersionRequired", function() {
    return true;
  }, function() {
    TestHelper.resetting(self, "usesDirmngr", function() {
      return false;
    }, function() {
      const system = {
        findTorWasCalled: false,
        findTor: function() {
          system.findTorWasCalled = true;
          return torOn9150;
        },
        findTorExecutableHelperWasCalled: false,
        findTorExecutableHelper: function() {
          system.findTorExecutableHelperWasCalled = true;
          return {
            command: "torsocks",
            args: ["--user", "12345", "--pass", "12345", "/usr/bin/gpg2"]
          };
        }
      };

      torProperties(system);
      Assert.equal(system.findTorWasCalled, true);
      Assert.equal(system.findTorExecutableHelperWasCalled, true);
    });
  });
}));

test(function createGpgProxyArgs_forLinux_whenSystemDOESNTMeetSocks5hVersion() {
  TestHelper.resetting(EnigmailOS, "isDosLike", false, function() {
    TestHelper.resetting(EnigmailRNG, "generateRandomUint32", function() {
      return "dummyData";
    }, function() {
      const tor = {
        ip: "192.8.8.4",
        port: 9150
      };
      const versioning = {
        versionFoundMeetsMinimumVersionRequiredWasCalled: false,
        versionFoundMeetsMinimumVersionRequired: function(executable, minimum) {
          Assert.equal(executable, "curl");
          Assert.deepEqual(minimum, MINIMUM_CURL_SOCKS5H_VERSION);
          versioning.versionFoundMeetsMinimumVersionRequiredWasCalled = true;
          return false;
        }
      };

      const args = gpgProxyArgs(tor, versioning);

      Assert.equal(args, "socks5-hostname://dummyData:dummyData@192.8.8.4:9150");
      Assert.equal(versioning.versionFoundMeetsMinimumVersionRequiredWasCalled, true, "versionFoundMeetsMinimumVersionRequired was not called");
    });
  });
});


test(function returnsFailure_whenSystemCannotFindTor() {
  TestHelper.resetting(EnigmailVersioning, "versionFoundMeetsMinimumVersionRequired", function() {
    return true;
  }, function() {
    const system = {
      findTor: function() {
        return null;
      }
    };

    const properties = torProperties(system);

    Assert.equal(properties.socks, null);
    Assert.equal(properties.helper, null);
    Assert.equal(properties.useTorMode, false);
  });
});

test(withStandardGpg(function returnsSuccessWithArgs_whenAbleToFindTorAndTorsocks() {
  TestHelper.resetting(EnigmailVersioning, "versionFoundMeetsMinimumVersionRequired", function() {
    return true;
  }, function() {
    TestHelper.resetting(self, "usesDirmngr", function() {
      return false;
    }, function() {
      TestHelper.resetting(EnigmailRNG, "generateRandomUint32", function() {
        return "dummyData";
      }, function() {
        const torArgs = ["--user", "dummyUsername", "--pass", "dummyPassword", "/usr/bin/gpg2"];
        const gpgArgs = "socks5h://dummyData:dummyData@127.0.0.1:9050";
        const system = {
          findTor: function() {
            return {
              ip: "127.0.0.1",
              port: 9050
            };
          },
          findTorExecutableHelper: function() {
            return {
              command: "torsocks",
              args: torArgs
            };
          }
        };

        const properties = torProperties(system);
        Assert.equal(properties.useTorMode, false);

        const socksProperties = properties.socks;
        const helperProperties = properties.helper;

        Assert.equal(helperProperties.command, "torsocks");
        Assert.equal(helperProperties.args, torArgs);

        Assert.equal(socksProperties.command, "gpg");
        Assert.equal(socksProperties.args, gpgArgs);
      });
    });
  });
}));

const torOn9150 = {
  ip: "127.0.0.1",
  port: 9150
};

test(function testThatTorModeIsTrueWhenUserHasEnabledTorMode() {
  TestHelper.resetting(EnigmailVersioning, "versionFoundMeetsMinimumVersionRequired", function() {
    return true;
  }, function() {
    TestHelper.resetting(self, "usesDirmngr", function() {
      return true;
    }, function() {
      let dirmngrConfiguredWithTorFunctionWasCalled = false;
      TestHelper.resetting(EnigmailGpg, "dirmngrConfiguredWithTor", function() {
        return true;
      }, function() {
        dirmngrConfiguredWithTorFunctionWasCalled = true;
        const system = {
          findTor: function() {
            return torOn9150;
          },
          findTorExecutableHelper: function() {
            return null;
          }
        };

        const properties = torProperties(system);
        Assert.equal(properties.useTorMode, true);
        Assert.equal(properties.socks, null);
        Assert.equal(dirmngrConfiguredWithTorFunctionWasCalled, true, "dirmngrConfiguredWithTor() was not called");
      });
    });
  });
});

function contains(string, substring) {
  return string.indexOf(substring) > -1;
}

test(function testUsingTorsocksWithEnvironmentVariables() {
  const versioning = {
    versionFoundMeetsMinimumVersionRequired: function() {
      return false;
    }
  };

  TestHelper.resetting(EnigmailFiles, "resolvePathWithEnv", function(exe) {
    if (exe === "torsocks") {
      return {
        path: "/usr/bin/torsocks"
      };
    }
    else {
      return null;
    }
  }, function() {
    const result = findTorExecutableHelper(versioning);
    Assert.equal(result.command.path, "/usr/bin/torsocks");
    Assert.ok(contains(result.envVars[0], "TORSOCKS_USERNAME"));
    Assert.ok(contains(result.envVars[1], "TORSOCKS_PASSWORD"));
    Assert.equal(result.args.length, 1);
  });
});

test(function testUsingTorsocksWithCommandArguments() {
  const versioning = {
    versionFoundMeetsMinimumVersionRequired: function() {
      return true;
    }
  };

  TestHelper.resetting(EnigmailFiles, "resolvePathWithEnv", function(exe) {
    if (exe === "torsocks") {
      return {
        path: "/usr/bin/torsocks"
      };
    }
    else {
      return null;
    }
  }, function() {
    const result = findTorExecutableHelper(versioning);

    Assert.equal(result.command.path, "/usr/bin/torsocks");
    Assert.equal(result.args.length, 5);
    Assert.equal(result.args[0], "--user");
    Assert.equal(result.args[2], "--pass");
    Assert.equal(result.args[4], "/usr/bin/gpg");
  });
});

test(function testUseNothingIfNoTorHelpersAreAvailable() {
  const versioning = {
    findExecutable: function() {
      return null;
    }
  };

  TestHelper.resetting(EnigmailFiles, "resolvePathWithEnv", function(exe) {
    return null;
  }, function() {
    const result = findTorExecutableHelper(versioning);
    Assert.equal(findTorExecutableHelper(versioning), null);
  });
});

test(function creatingRandomCredential() {
  Assert.equal(typeof createRandomCredential(), "string");

  Assert.notEqual(createRandomCredential(), createRandomCredential());
});
