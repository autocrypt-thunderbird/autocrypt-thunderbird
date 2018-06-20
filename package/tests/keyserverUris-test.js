/*global test:false, component: false, testing: false, Assert: false, do_load_module: false, do_get_cwd: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper:false, resetting, withEnvironment, getKeyListEntryOfKey: false, gKeyListObj: true, withPreferences: false */

testing("keyserverUris.jsm"); /*global isValidProtocol: false, validKeyserversExist: false, buildKeyserverUris: false */

component("enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
component("enigmail/os.jsm"); /*global EnigmailOS: false */

function setupKeyserverPrefs(keyservers, autoOn) {
  EnigmailPrefs.setPref("keyserver", keyservers);
  EnigmailPrefs.setPref("autoKeyServerSelection", autoOn);
}

test(withPreferences(function organizeProtocols_withOneHkpsServer() {
  setupKeyserverPrefs("keyserver.1", true);

  const keyserverUris = buildKeyserverUris();

  Assert.equal(keyserverUris[0], "hkps://keyserver.1:443");
  Assert.equal(keyserverUris[1], "hkp://keyserver.1:11371");
  Assert.equal(keyserverUris.length, 2);
}));

test(withPreferences(function buildUrisFromKeyservers_withoutSpecifiedProtocols() {
  setupKeyserverPrefs("keyserver.1, keyserver.2, keyserver.3", false);

  const keyserverUris = buildKeyserverUris();

  Assert.equal(keyserverUris[0], "hkps://keyserver.1:443");
  Assert.equal(keyserverUris[1], "hkp://keyserver.1:11371");
  Assert.equal(keyserverUris[2], "hkps://keyserver.2:443");
  Assert.equal(keyserverUris[3], "hkp://keyserver.2:11371");
  Assert.equal(keyserverUris[4], "hkps://keyserver.3:443");
  Assert.equal(keyserverUris[5], "hkp://keyserver.3:11371");
  Assert.equal(keyserverUris.length, 6);
}));

test(withPreferences(function buildUrisFromKeyservers_withMixOfProtocols() {
  setupKeyserverPrefs("hkp://keyserver.1, hkps://keyserver.2, keyserver.3, hkps://keyserver.4, ldap://keyserver.5", false);

  const keyserverUris = buildKeyserverUris();

  Assert.equal(keyserverUris[0], "hkp://keyserver.1:11371");
  Assert.equal(keyserverUris[1], "hkps://keyserver.2:443");
  Assert.equal(keyserverUris[2], "hkps://keyserver.3:443");
  Assert.equal(keyserverUris[3], "hkp://keyserver.3:11371");
  Assert.equal(keyserverUris[4], "hkps://keyserver.4:443");
  Assert.equal(keyserverUris[5], "ldap://keyserver.5:389");

}));

test(withPreferences(function should_UseCorrectCorrespondingHkpsAddressForHkpPoolServers_IfNonDos() {
  TestHelper.resetting(EnigmailOS, "isDosLike", false, function() {
    setupKeyserverPrefs("pool.sks-keyservers.net, keys.gnupg.net, pgp.mit.edu", true);

    const keyserverUris = buildKeyserverUris();

    Assert.equal(keyserverUris.length, 2);
    Assert.equal(keyserverUris[0], "hkps://hkps.pool.sks-keyservers.net:443");
    Assert.equal(keyserverUris[1], "hkp://pool.sks-keyservers.net:11371");
  });
}));

test(withPreferences(function should_UseCorrectCorrespondingHkpsAddressForHkpPoolServers_IfDos() {
  TestHelper.resetting(EnigmailOS, "isDosLike", true, function() {
    setupKeyserverPrefs("pool.sks-keyservers.net, keys.gnupg.net, pgp.mit.edu", true);

    const keyserverUris = buildKeyserverUris();

    Assert.equal(keyserverUris.length, 2);
    Assert.equal(keyserverUris[0], "hkps.pool.sks-keyservers.net");
    Assert.equal(keyserverUris[1], "hkp://pool.sks-keyservers.net:11371");
  });
}));

test(withPreferences(function should_AddProtocolAndPortForHkpsPoolServers_IfNotDos() {
  TestHelper.resetting(EnigmailOS, "isDosLike", false, function() {
    setupKeyserverPrefs("hkps.pool.sks-keyservers.net", false);

    const keyserverUris = buildKeyserverUris();

    Assert.equal(keyserverUris.length, 1);
    Assert.equal(keyserverUris[0], "hkps://hkps.pool.sks-keyservers.net:443");
  });
}));

test(withPreferences(function shouldNot_AddProtocolAndPortForForHkpsPoolServers_IfDos() {
  TestHelper.resetting(EnigmailOS, "isDosLike", true, function() {
    setupKeyserverPrefs("hkps.pool.sks-keyservers.net", false);

    const keyserverUris = buildKeyserverUris();

    Assert.equal(keyserverUris.length, 1);
    Assert.equal(keyserverUris[0], "hkps.pool.sks-keyservers.net");
  });
}));

test(withPreferences(function validKeyserversExistWithDefaultPreferences() {
  setupKeyserverPrefs("pool.sks-keyservers.net, keys.gnupg.net, pgp.mit.edu", true);

  Assert.equal(validKeyserversExist(), true);
}));

test(withPreferences(function noValidKeyserversExistWithEmptyKeyserverList() {
  setupKeyserverPrefs(" ", true);

  Assert.equal(validKeyserversExist(), false);
}));

test(withPreferences(function noValidKeyserversExistWhenAllProtocolsAreInvalid() {
  setupKeyserverPrefs("xyz://pool.sks-keyservers.net, abc://keys.gnupg.net, def://pgp.mit.edu", true);

  Assert.equal(validKeyserversExist(), false);
}));

test(withPreferences(function validKeyserversExistWhenOneProtocolIsValid() {
  setupKeyserverPrefs("hkps://pool.sks-keyservers.net, abc://keys.gnupg.net, def://pgp.mit.edu", true);

  Assert.equal(validKeyserversExist(), true);
}));

test(withPreferences(function buildUrisFromKeyservers_oneValidProtocol() {
  setupKeyserverPrefs("hkp://keys.gnupg.net, abc://pgp.mit.edu", true);

  const keyserverUris = buildKeyserverUris();

  Assert.deepEqual(keyserverUris, ["hkp://keys.gnupg.net:11371"]);
}));

test(withPreferences(function considerPoolHkpsServerValidWithProtocolAndPortSpecified() {
  Assert.equal(isValidProtocol("hkps://hkps.pool.sks-keyservers.net:443"), true);
}));

test(withPreferences(function detectInvalidKeyserverWhenProtocolIsMadeOfTwoValidProtocols() {
  Assert.equal(isValidProtocol("hkpsldap://domain"), false);
}));

test(withPreferences(function detectInvalidKeyserverWhenProtocolIsMadeOfTwoValidProtocols() {
  setupKeyserverPrefs("HKPS://domain", true);

  const keyserverUris = buildKeyserverUris();

  Assert.deepEqual(keyserverUris, ["hkps://domain:443"]);
}));

test(withPreferences(function considerCapitalSchemesLegitimate() {
  Assert.equal(isValidProtocol("HKPS://domain"), true);
}));

test(withPreferences(function considerLowerCaseAndCapitalSchemesLegitimate() {
  Assert.equal(isValidProtocol("HkP://domain"), true);
}));
