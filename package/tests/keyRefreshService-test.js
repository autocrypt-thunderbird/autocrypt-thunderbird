/*global do_load_module: false, do_get_file: false, do_get_cwd: false, test: false, Assert: false, resetting: false */
/*global Cc: false, Ci: false, testing: false, component: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, withEnigmail: false, withTestGpgHome: false, withLogFiles: false, assertLogContains: false, assertLogDoesNotContain: false, withPreferences: false */

testing("keyRefreshService.jsm"); /*global EnigmailKeyRefreshService: false, calculateMaxTimeForRefreshInMilliseconds, HOURS_PER_WEEK_ENIGMAIL_IS_ON_PREF, calculateWaitTimeInMilliseconds, startWith, ONE_HOUR_IN_MILLISEC, refreshWith, refreshKey: false, getRandomKeyId: false, setupNextRefresh: false */

component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
component("enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
component("enigmail/rng.jsm"); /*global EnigmailRNG: false */
component("enigmail/keyserverUris.jsm"); /*global EnigmailKeyserverURIs: false */

function withKeys(f) {
  return function() {
    try {
      EnigmailKeyRing.clearCache();
      f();
    }
    finally {
      EnigmailKeyRing.clearCache();
    }
  };
}

const emptyFunction = function() {};
const HOURS_PER_WEEK_ENIGMAIL_IS_ON = 40;

test(function calculateMaxTimeForRefreshForFortyHoursAWeek() {
  let totalKeys = 3;
  let millisecondsAvailableForRefresh = HOURS_PER_WEEK_ENIGMAIL_IS_ON * 60 * 60 * 1000;
  let maxTimeForRefresh = millisecondsAvailableForRefresh / totalKeys;
  EnigmailPrefs.setPref(HOURS_PER_WEEK_ENIGMAIL_IS_ON_PREF, 40);

  Assert.ok(calculateMaxTimeForRefreshInMilliseconds(totalKeys) == maxTimeForRefresh);
});

test(function calculateMaxTimeForRefreshForTenHoursAWeek() {
  let totalKeys = 2;
  let millisecondsAvailableForRefresh = HOURS_PER_WEEK_ENIGMAIL_IS_ON * 60 * 60 * 1000;
  let maxTimeForRefresh = millisecondsAvailableForRefresh / totalKeys;
  EnigmailPrefs.setPref(HOURS_PER_WEEK_ENIGMAIL_IS_ON_PREF, 40);

  Assert.ok(calculateMaxTimeForRefreshInMilliseconds(totalKeys) == maxTimeForRefresh);
});

test(function waitTimeShouldBeLessThanMax() {
  let totalKeys = 4;
  let millisecondsAvailableForRefresh = HOURS_PER_WEEK_ENIGMAIL_IS_ON * 60 * 60 * 1000;
  let maxTimeForRefresh = millisecondsAvailableForRefresh / totalKeys;
  EnigmailPrefs.setPref(HOURS_PER_WEEK_ENIGMAIL_IS_ON_PREF, 40);

  Assert.ok(calculateWaitTimeInMilliseconds(totalKeys) <= maxTimeForRefresh);
});

test(function calculateNewTimeEachCall() {
  let totalKeys = 3;
  let firstTime = calculateWaitTimeInMilliseconds(totalKeys);
  let secondTime = calculateWaitTimeInMilliseconds(totalKeys);
  EnigmailPrefs.setPref(HOURS_PER_WEEK_ENIGMAIL_IS_ON_PREF, 40);

  Assert.ok(firstTime != secondTime);
});

test(function calculateWaitTimeReturnsWholeNumber() {
  const totalKeys = 11;
  EnigmailPrefs.setPref(HOURS_PER_WEEK_ENIGMAIL_IS_ON_PREF, 40);

  const number = calculateWaitTimeInMilliseconds(totalKeys);

  Assert.equal(number % 1, 0);
});

function importKeys() {
  const publicKey = do_get_file("resources/dev-tiger.asc", false);
  const anotherKey = do_get_file("resources/notaperson.asc", false);
  const strikeKey = do_get_file("resources/dev-strike.asc", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(anotherKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(strikeKey, {}, {});
}

function importAndReturnOneKey() {
  EnigmailKeyRing.importKeyFromFile(do_get_file("resources/dev-strike.asc", false), {}, {});
  return EnigmailKeyRing.getAllKeys().keyList[0].keyId;
}

test(withTestGpgHome(withEnigmail(withKeys(function shouldBeAbleToGetAllKeyIdsFromKeyList() {
  importKeys();

  const publicKeyId = "8439E17046977C46";
  const anotherKeyId = "8A411E28A056E2A3";
  const strikeKeyId = "781617319CE311C4";

  Assert.equal(getRandomKeyId(0), publicKeyId);
  Assert.equal(getRandomKeyId(1), anotherKeyId);
  Assert.equal(getRandomKeyId(2), strikeKeyId);
  Assert.equal(getRandomKeyId(3), publicKeyId);
  Assert.equal(getRandomKeyId(4), anotherKeyId);

}))));

test(withTestGpgHome(withEnigmail(withKeys(function shouldReturnNullIfNoKeysAvailable() {
  Assert.equal(getRandomKeyId(100), null);
}))));

test(withTestGpgHome(withEnigmail(withKeys(function shouldGetDifferentRandomKeys() {
  importKeys();

  Assert.notEqual(getRandomKeyId(4), getRandomKeyId(5));
}))));

test(withTestGpgHome(withEnigmail(withKeys(function ifOnlyOneKey_shouldGetOnlyKey() {
  const expectedKeyId = importAndReturnOneKey();

  Assert.equal(getRandomKeyId(100), expectedKeyId);
}))));

test(withTestGpgHome(withEnigmail(withKeys(function refreshesKeyOnlyIfWaitTimeHasBeenSetup_AndRefreshIsReady() {
  TestHelper.resetting(EnigmailKeyserverURIs, "validKeyserversExist", function() {
    return true;
  }, function() {
    EnigmailPrefs.setPref("keyserver", "keyserver.1");
    const expectedKeyId = importAndReturnOneKey();
    const timer = {
      initWithCallbackWasCalled: false,
      initWithCallback: function(f, timeUntilNextRefresh, timerType) {
        timer.initWithCallbackWasCalled = true;
      }
    };

    const keyserver = {
      refreshWasCalled: false,
      refresh: function(keyId) {
        Assert.equal(keyId, expectedKeyId);
        keyserver.refreshWasCalled = true;
      }
    };

    refreshWith(keyserver, timer, false);

    Assert.equal(keyserver.refreshWasCalled, false, "keyserver.refresh was called and shouldn't have been");
    Assert.equal(timer.initWithCallbackWasCalled, true, "timer.initWithCallback was not called");

    refreshWith(keyserver, timer, true);

    Assert.equal(keyserver.refreshWasCalled, true, "keyserver.refresh was not called");
    Assert.equal(timer.initWithCallbackWasCalled, true, "timer.initWithCallback was not called");
  });
}))));

test(withTestGpgHome(withEnigmail(withKeys(function setUpRefreshTimer_withWaitTime() {
  const expectedRandomTime = EnigmailRNG.generateRandomUint32();
  const timer = {
    initWithCallbackWasCalled: false,
    initWithCallback: function(f, time, timerType) {
      Assert.equal(time, expectedRandomTime);
      Assert.equal(timerType, Ci.nsITimer.TYPE_ONE_SHOT);
      timer.initWithCallbackWasCalled = true;
    }
  };

  setupNextRefresh(timer, expectedRandomTime);

  Assert.equal(timer.initWithCallbackWasCalled, true, "timer.initWithCallback was not called");
}))));

test(withTestGpgHome(withEnigmail(withKeys(function whenNoKeysExist_retryInOneHour() {
  TestHelper.resetting(EnigmailKeyserverURIs, "validKeyserversExist", function() {
    return true;
  }, function() {
    const timer = {
      initWithCallbackWasCalled: false,
      initWithCallback: function(f, time, timerType) {
        Assert.equal(time, ONE_HOUR_IN_MILLISEC);
        Assert.equal(timerType, Ci.nsITimer.TYPE_ONE_SHOT);
        timer.initWithCallbackWasCalled = true;
      }
    };

    const keyserver = {};

    refreshWith(keyserver, timer, false);

    Assert.equal(timer.initWithCallbackWasCalled, true, "timer.initWithCallback was not called");
    assertLogContains("keyRefreshService.jsm: No keys available to refresh yet. Will recheck in an hour.");
  });
}))));

test(withPreferences(function ifKeyserverListIsInvalid_checkAgainInAnHour() {
  TestHelper.resetting(EnigmailKeyserverURIs, "validKeyserversExist", function() {
    return false;
  }, function() {
    const timer = {
      initWithCallbackWasCalled: false,
      initWithCallback: function(f, time, timerType) {
        Assert.equal(time, ONE_HOUR_IN_MILLISEC);
        Assert.equal(timerType, Ci.nsITimer.TYPE_ONE_SHOT);
        timer.initWithCallbackWasCalled = true;
      }
    };
    const keyserver = {};

    refreshWith(keyserver, timer, false);

    assertLogContains("keyRefreshService.jsm: Either no keyservers exist or the protocols specified are invalid. Will recheck in an hour.");
    Assert.equal(timer.initWithCallbackWasCalled, true, "timer.initWithCallback was not called");
  });
}));

test(withLogFiles(withPreferences(function keyRefreshServiceIsTurnedOffByDefault() {
  const keyRefreshStartMessage = "keyRefreshService.jsm: Started";
  const keyserver = {};

  EnigmailKeyRefreshService.start(keyserver);
  assertLogDoesNotContain(keyRefreshStartMessage);
})));

test(withLogFiles(withPreferences(function keyRefreshServiceStartsWhenPreferenceIsOn() {
  TestHelper.resetting(EnigmailKeyserverURIs, "validKeyserversExist", function() {
    return false;
  }, function() {
    const keyRefreshStartMessage = "keyRefreshService.jsm: Started";
    const keyserver = {};

    EnigmailPrefs.setPref("keyRefreshOn", true);
    EnigmailKeyRefreshService.start(keyserver);
    assertLogContains(keyRefreshStartMessage);
  });
})));
