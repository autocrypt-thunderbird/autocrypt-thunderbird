/*global Components: false, Number: false, Math: false, Date: false, JSON: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailExpiry"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */

const nsIEnigmail = Ci.nsIEnigmail;
const DAY = 86400; // number of seconds of 1 day

var EnigmailExpiry = {
  /**
   * Check whether some key pairs expire in less than N days from now.
   *
   * @param keySpecArr  - Array: list of key IDs or User IDs
   * @param numDay      - Number: number of days from now
   *
   * @return Array      - list of keys that will expire
   */

  getExpiryForKeySpec: function(keySpecArr, numDays) {
    EnigmailLog.DEBUG("expiry.jsm: getExpiryForKeySpec()\n");
    let now = Math.floor(Date.now() / 1000);
    let enigmailSvc = EnigmailCore.getService();
    if (!enigmailSvc) return [];

    let result = keySpecArr.reduce(function(p, keySpec) {
      let keys;

      if (keySpec.search(/^(0x)?[0-9A-F]{8,40}$/i) === 0) {
        let key = EnigmailKeyRing.getKeyById(keySpec);
        if (!key) return p;
        keys = [key];
      }
      else {
        keys = EnigmailKeyRing.getKeysByUserId(keySpec);
        if (keys.length === 0) return p;
      }

      let maxExpiry = Number.MIN_VALUE;
      let maxKey = null;

      for (let i in keys) {
        let ex = keys[i].getKeyExpiry();
        if (ex > maxExpiry) {
          maxExpiry = ex;
          maxKey = keys[i];
        }
      }

      if (maxExpiry < now + (DAY * numDays) && maxExpiry >= now) p.push(maxKey);

      return p;
    }, []);

    result = uniqueKeyList(result);
    return result;
  },

  /**
   * Determine the configured key specifications for all identities
   * where Enigmail is enabled
   *
   * @return  Array of Strings - list of keyId and email addresses
   */
  getKeysSpecForIdentities: function() {
    EnigmailLog.DEBUG("expiry.jsm: getKeysSpecForIdentities()\n");
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);

    let keySpecList = [];

    for (let acct = 0; acct < accountManager.accounts.length; acct++) {
      let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);

      for (let i = 0; i < ac.identities.length; i++) {
        let id = ac.identities.queryElementAt(i, Ci.nsIMsgIdentity);
        if (id.getBoolAttribute("enablePgp")) {
          if (id.getIntAttribute("pgpKeyMode") === 1) {
            keySpecList.push(id.getCharAttribute("pgpkeyId"));
          }
          else {
            keySpecList.push(id.email);
          }
        }
      }
    }

    return keySpecList;
  },

  /**
   * Check if all keys of all configured identities are still valid in N days.
   * (N is configured via warnKeyExpiryNumDays; 0 = disable the check)
   *
   * @return  Array of keys - the keys that have expired since the last check
   *          null in case no check was performed
   */
  getNewlyExpiredKeys: function() {
    EnigmailLog.DEBUG("expiry.jsm: getNewlyExpiredKeys()\n");

    let numDays = EnigmailPrefs.getPref("warnKeyExpiryNumDays");
    if (numDays < 1) return null;

    let now = Date.now();

    let lastResult = {
      expiredList: [],
      lastCheck: 0
    };

    let lastRes = EnigmailPrefs.getPref("keyCheckResult");
    if (lastRes.length > 0) {
      lastResult = JSON.parse(lastRes);
    }

    if (now - lastResult.lastCheck < DAY * 1000) return null;

    let keys = this.getKeysSpecForIdentities();

    if (keys.length === 0) {
      lastResult.lastCheck = now;
      EnigmailPrefs.setPref("keyCheckResult", JSON.stringify(lastResult));
      return [];
    }

    let expired = this.getExpiryForKeySpec(keys, numDays);

    let expiredList = expired.reduce(function _f(p, key) {
      p.push(key.keyId);
      return p;
    }, []);

    let newResult = {
      expiredList: expiredList,
      lastCheck: now
    };

    EnigmailPrefs.setPref("keyCheckResult", JSON.stringify(newResult));

    let warnList = expired.reduce(function _f(p, key) {
      if (lastResult.expiredList.indexOf(key.keyId) < 0) {
        p.push(key);
      }
      return p;
    }, []);

    return warnList;
  },

  keyExpiryCheck: function() {
    EnigmailLog.DEBUG("expiry.jsm: keyExpiryCheck()\n");

    let expiredKeys = this.getNewlyExpiredKeys();
    if (!expiredKeys || expiredKeys.length === 0) return "";

    let numDays = EnigmailPrefs.getPref("warnKeyExpiryNumDays");

    if (expiredKeys.length === 1) {
      return EnigmailLocale.getString("expiry.keyExpiresSoon", [getKeyDesc(expiredKeys[0]), numDays]);
    }
    else {
      let keyDesc = "";
      for (let i = 0; i < expiredKeys.length; i++) {
        keyDesc += "- " + getKeyDesc(expiredKeys[i]) + "\n";
      }
      return EnigmailLocale.getString("expiry.keysExpireSoon", [numDays, keyDesc]);
    }
  }
};

/**
 * Remove duplicate key Object elements from an array
 *
 * @param arr - Array of key Objects to be worked on
 *
 * @return Array - the array without duplicates
 */

function uniqueKeyList(arr) {
  return arr.reduce(function(p, c) {

    let r = p.find(function _f(e, i, a) {
      if (e.keyId === c.keyId) return true;
    });

    if (r === undefined) p.push(c);
    return p;
  }, []);
}


function getKeyDesc(key) {
  return '"' + key.userId + '" (key ID ' + key.fprFormatted + ')';
}
