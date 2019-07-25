/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for dealing with received Autocrypt headers, level 0
 *  See details at https://github.com/mailencrypt/autocrypt
 */

var EXPORTED_SYMBOLS = ["createVerifyStatus", "createBadEncryptionStatus"];

const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailFuncs = ChromeUtils.import("chrome://enigmail/content/modules/funcs.jsm").EnigmailFuncs;
const PromiseUtils = ChromeUtils.import("resource://gre/modules/PromiseUtils.jsm").PromiseUtils;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const EnigmailStdlib = ChromeUtils.import("chrome://enigmail/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailKey = ChromeUtils.import("chrome://enigmail/content/modules/key.jsm").EnigmailKey;
const EnigmailMime = ChromeUtils.import("chrome://enigmail/content/modules/mime.jsm").EnigmailMime;
const EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
const EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;
const sqlite = ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm").EnigmailSqliteDb;


function MessageCryptoStatus(sig_ok, sig_key_id, sender_address, public_key, is_decrypt_error) {
  this.sig_ok = sig_ok;
  this.sig_key_id = sig_key_id;
  this.sender_address = sender_address;
  this.public_key = public_key;
  this.is_decrypt_error = is_decrypt_error;
}

MessageCryptoStatus.prototype.isDecrypted = function() {
  return true;
};

MessageCryptoStatus.prototype.isDecryptFailed = function() {
  return this.is_decrypt_error;
};

MessageCryptoStatus.prototype.isSigned = function() {
  return Boolean(this.sig_key_id);
};


MessageCryptoStatus.prototype.isSignKeyKnown = function() {
  return true;
};

MessageCryptoStatus.prototype.isSignOk = function() {
  return this.sign_ok;
};

MessageCryptoStatus.prototype.getSignKeyId = function() {
  return this.sig_key_id;
};

MessageCryptoStatus.prototype.isSignKeyTrusted = function() {
  return true;
};

MessageCryptoStatus.prototype.getStatusFlags = function() {
  let status_flags = EnigmailConstants.PGP_MIME_ENCRYPTED
    | EnigmailConstants.DECRYPTION_OKAY
    | EnigmailConstants.STATUS_DECRYPTION_OK;

  status_flags |= EnigmailConstants.PGP_MIME_SIGNED;
  if (this.sig_ok) {
    status_flags |= EnigmailConstants.GOOD_SIGNATURE;
  } else {
    status_flags |= EnigmailConstants.BAD_SIGNATURE;
  }

  return status_flags;
};


async function createBadEncryptionStatus(sender_address) {
  return new MessageCryptoStatus(false, null, sender_address, null, true);
}

async function createVerifyStatus(sig_ok, sig_key_id, sender_address, public_key) {
  return new MessageCryptoStatus(sig_ok, sig_key_id, sender_address, public_key, false);
}
