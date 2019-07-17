/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for dealing with received Autocrypt headers, level 0
 *  See details at https://github.com/mailencrypt/autocrypt
 */

var EXPORTED_SYMBOLS = ["createVerifyStatus"];

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


function VerifyStatus(sig_ok, sig_key_id, sender_address, public_key) {
  this.sig_ok = sig_ok;
  this.sig_key_id = sig_key_id;
  this.sender_address = sender_address;
  this.public_key = public_key;
}

VerifyStatus.prototype.isDecrypted = function() {
  return true;
};

VerifyStatus.prototype.isDecryptFailed = function() {
  return false;
};

VerifyStatus.prototype.isSigned = function() {
  return Boolean(this.sig_key_id);
};


VerifyStatus.prototype.isSignKeyKnown = function() {
  return true;
};

VerifyStatus.prototype.isSignOk = function() {
  return this.sign_ok;
};

VerifyStatus.prototype.getSignKeyId = function() {
  return this.sig_key_id;
};

VerifyStatus.prototype.isSignKeyTrusted = function() {
  return true;
};

VerifyStatus.prototype.getStatusFlags = function() {
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



async function createVerifyStatus(sig_ok, sig_key_id, sender_address, public_key) {
  return new VerifyStatus(sig_ok, sig_key_id, sender_address, public_key);
}
