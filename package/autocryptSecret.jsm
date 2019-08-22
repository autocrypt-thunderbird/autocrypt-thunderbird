/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptSecret"];

const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").AutocryptStdlib;
const AutocryptKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").AutocryptKeyRing;
const AutocryptCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").AutocryptCryptoAPI;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").AutocryptSqliteDb;


var AutocryptSecret = {
  generateKeysForAllIdentities: async function() {
    const identities = AutocryptStdlib.getIdentities();
    const emails = identities.map(identity => identity.identity.email);
    const autocrypt_rows = await sqlite.retrieveAutocryptRows(emails);

    for (let email of emails) {
      if (autocrypt_rows && autocrypt_rows.find(row => row.email == email && row.fpr_primary)) {
        AutocryptLog.DEBUG(`autocryptSecret.jsm: generateKeysForAllIdentities(): skipping ${email}\n`);
        continue;
      }
      await this.generateKeyForEmail(email);
    }
  },

  generateKeyForEmail: async function(email) {
    AutocryptLog.DEBUG(`autocryptSecret.jsm: generateKeyForEmail(${email})\n`);

    const openpgp = AutocryptCryptoAPI();
    let secret_key = await openpgp.generateAutocryptKey(email);
    let fpr_primary = secret_key.getFingerprint().toUpperCase();

    await AutocryptKeyRing.insertSecretKey(secret_key);

    let is_mutual = false;
    let autocrypt_rows = await sqlite.retrieveAutocryptRows([email]);
    if (autocrypt_rows && autocrypt_rows.length) {
      is_mutual = autocrypt_rows[0].is_mutual;
    }

    let effective_date = new Date();
    await sqlite.autocryptInsertOrUpdateLastSeenMessage(email, effective_date);
    await sqlite.autocryptUpdateKey(email, effective_date, fpr_primary, is_mutual, true);

    AutocryptLog.DEBUG(`autocryptSecret.jsm: generateKeyForEmail(): ok\n`);
  },

  changeSecretKeyForEmail: async function(email, fpr_primary) {
    AutocryptLog.DEBUG(`autocryptSecret.jsm: changeSecretKeyForEmail()\n`);

    let secret_keys_map = await AutocryptKeyRing.getAllSecretKeysMap();
    if (fpr_primary && !(fpr_primary in secret_keys_map)) {
      AutocryptLog.DEBUG(`autocryptSecret.jsm: changeSecretKeyForEmail(): unknown key!\n`);
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

    AutocryptLog.DEBUG(`autocryptSecret.jsm: changeSecretKeyForEmail(): ok\n`);
  }
};
