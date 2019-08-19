/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptSecret"];

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;


var AutocryptSecret = {
  generateKeysForAllIdentities: async function() {
    const identities = EnigmailStdlib.getIdentities();
    const emails = identities.map(identity => identity.identity.email);
    const autocrypt_rows = await sqlite.retrieveAutocryptRows(emails);

    for (let email of emails) {
      if (autocrypt_rows && autocrypt_rows.find(row => row.email == email && row.fpr_primary)) {
        EnigmailLog.DEBUG(`autocryptSecret.jsm: generateKeysForAllIdentities(): skipping ${email}\n`);
        continue;
      }
      await this.generateKeyForEmail(email);
    }
  },

  generateKeyForEmail: async function(email) {
    EnigmailLog.DEBUG(`autocryptSecret.jsm: generateKeyForEmail(${email})\n`);

    const openpgp = EnigmailCryptoAPI();
    let secret_key = await openpgp.generateAutocryptKey(email);
    let fpr_primary = secret_key.getFingerprint().toUpperCase();

    await EnigmailKeyRing.insertSecretKey(secret_key);

    let is_mutual = false;
    let autocrypt_rows = await sqlite.retrieveAutocryptRows([email]);
    if (autocrypt_rows && autocrypt_rows.length) {
      is_mutual = autocrypt_rows[0].is_mutual;
    }

    let effective_date = new Date();
    await sqlite.autocryptInsertOrUpdateLastSeenMessage(email, effective_date);
    await sqlite.autocryptUpdateKey(email, effective_date, fpr_primary, is_mutual, true);

    EnigmailLog.DEBUG(`autocryptSecret.jsm: generateKeyForEmail(): ok\n`);
  },

  changeSecretKeyForEmail: async function(email, fpr_primary) {
    EnigmailLog.DEBUG(`autocryptSecret.jsm: changeSecretKeyForEmail()\n`);

    let secret_keys_map = await EnigmailKeyRing.getAllSecretKeysMap();
    if (fpr_primary && !(fpr_primary in secret_keys_map)) {
      EnigmailLog.DEBUG(`autocryptSecret.jsm: changeSecretKeyForEmail(): unknown key!\n`);
      return;
    }

    let is_mutual = 1;
    let autocrypt_rows = await sqlite.retrieveAutocryptRows([email]);
    if (autocrypt_rows && email in autocrypt_rows) {
      is_mutual = autocrypt_rows[email].is_mutual;
    }

    let effective_date = new Date();
    await sqlite.autocryptInsertOrUpdateLastSeenMessage(email, effective_date);
    await sqlite.autocryptUpdateKey(email, effective_date, fpr_primary, is_mutual, true);

    EnigmailLog.DEBUG(`autocryptSecret.jsm: changeSecretKeyForEmail(): ok\n`);
  }
};
