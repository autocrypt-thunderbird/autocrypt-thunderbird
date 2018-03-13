/*global Components: false: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailCryptoAPI"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var gCurrentApi = null;

const {
  Services
} = Cu.import("resource://gre/modules/Services.jsm");


function EnigmailCryptoAPI() {
  if (!gCurrentApi) {
    const {
      getGnuPGAPI
    } = Cu.import("resource://enigmail/cryptoAPI/gnupg.js");

    gCurrentApi = getGnuPGAPI();
  }

  return gCurrentApi;
}
