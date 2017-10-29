/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailRNG"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/openpgp.jsm"); /*global EnigmailOpenPGP: false */

const SECURITY_RANDOM_GENERATOR = "@mozilla.org/security/random-generator;1";

let crypto = null;

function getCrypto() {
  if (crypto === null) {
    crypto = EnigmailOpenPGP.enigmailFuncs.getCrypto(); // get the browser crypto API
  }
  return crypto;
}

/**
 * Create a string of random characters with numChars length, using the
 * browser crypto API that gets cryptographically strong random values
 */
function generateRandomString(numChars) {
  let arr = new Uint8Array(numChars + 10); // add some more numbers such that we will have enough chars at the end
  getCrypto().getRandomValues(arr);

  let b = "";

  for (let i = 0; i < numChars; i++) {
    b += String.fromCharCode(arr[i]);
  }

  let s = btoa(b).replace(/[=+\/]/g, "");
  return s.substr(0, numChars);
}


/**
 * Generates a random UInt32 for use in randomising key selection and wait times between refreshing keys.
 *
 * @return random UInt32
 */
function generateRandomUint32() {
  let randomNumber = new Uint32Array(1);
  getCrypto().getRandomValues(randomNumber);
  return randomNumber[0];
}

const EnigmailRNG = {
  generateRandomUint32: generateRandomUint32,
  generateWeakRandomString: generateWeakRandomString,
  generateRandomString: generateRandomString
};
