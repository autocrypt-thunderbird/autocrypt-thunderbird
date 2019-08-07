/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
const AutocryptMasterpass = ChromeUtils.import("chrome://autocrypt/content/modules/masterpass.jsm").AutocryptMasterpass;

var EXPORTED_SYMBOLS = ["AutocryptSessionKeyCache"];

const HEADER_KEY = "autocrypt-sessionkey-v1";
const SALT = "session-key-cache";

var AutocryptSessionKeyCache = {
  getCachedSessionKey: function(uri) {
    EnigmailLog.DEBUG(`messageCache.jsm: getCachedSessionKey(): ${uri}\n`);
    if (!uri || !uri.spec || uri.spec.search(/[&?]header=enigmailConvert/) >= 0) {
      return null;
    }

    let msgDbHdr = uri.QueryInterface(Ci.nsIMsgMessageUrl).messageHeader;
    if (!msgDbHdr) {
      EnigmailLog.DEBUG(`messageCache.jsm: getCachedSessionKey(): error retrieving header for uri\n`);
      return null;
    }

    let session_key_encrypted = msgDbHdr.getStringProperty(HEADER_KEY);
    if (!session_key_encrypted) {
      EnigmailLog.DEBUG(`messageCache.jsm: getCachedSessionKey(): session key not cached\n`);
      return null;
    }

    let session_key_string = this.decryptString(session_key_encrypted);
    let session_key = this.deserializeSessionKey(session_key_string);
    if (!session_key) {
      return null;
    }

    EnigmailLog.DEBUG(`messageCache.jsm: getCachedSessionKey(): ok`);
    return session_key;
  },

  putCachedSessionKey: function(uri, session_key) {
    EnigmailLog.DEBUG(`messageCache.jsm: putCachedSessionKey(): ${uri}\n`);
    if (!uri || !uri.spec || uri.spec.search(/[&?]header=enigmailConvert/) >= 0) {
      return;
    }

    if (!session_key || !session_key.algorithm || !session_key.data) {
      EnigmailLog.ERROR(`messageCache.jsm: putCachedSessionKey(): malformed session key!\n`);
      return;
    }

    let msgDbHdr = uri.QueryInterface(Ci.nsIMsgMessageUrl).messageHeader;
    if (!msgDbHdr) {
      EnigmailLog.DEBUG(`messageCache.jsm: getCachedSessionKey(): error retrieving header for uri\n`);
      return;
    }

    let session_key_string = this.serializeSessionKey(session_key);
    let session_key_encrypted = this.encryptString(session_key_string);
    EnigmailLog.DEBUG(`messageCache.jsm: putCachedSessionKey()\n`);

    msgDbHdr.setStringProperty(HEADER_KEY, session_key_encrypted);

    EnigmailLog.DEBUG(`messageCache.jsm: putCachedSessionKey(): ok\n`);
  },

  encryptString: function(plaintext) {
    const password = AutocryptMasterpass.retrieveAutocryptPassword();
    const cApi = EnigmailCryptoAPI();
    const ciphertext = cApi.wrap(password + SALT, plaintext);
    return ciphertext;
  },

  decryptString: function(ciphertext) {
    const password = AutocryptMasterpass.retrieveAutocryptPassword();
    const cApi = EnigmailCryptoAPI();
    const plaintext = cApi.unwrap(password + SALT, ciphertext);
    return plaintext;
  },

  serializeSessionKey: function(session_key) {
    return JSON.stringify({
      data: btoa(String.fromCharCode.apply(null, session_key.data)),
      algorithm: session_key.algorithm
    });
  },

  deserializeSessionKey: function(session_key_string) {
    let session_key = JSON.parse(session_key_string);
    let data = atob(session_key.data);
    session_key.data = Uint8Array.from(data, c => c.charCodeAt(0));
    return session_key;
  }
};
