/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["getGnuPGAPI"];


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const {
  Services
} = Cu.import("resource://gre/modules/Services.jsm");

// Load generic API
Services.scriptloader.loadSubScript("resource://enigmail/cryptoAPI/interface.js",
  null, "UTF-8"); /* global CryptoAPI */


/**
 * GnuPG implementation of CryptoAPI
 */

class GnuPGCryptoAPI extends CryptoAPI {
  constructor() {
    super();
    this.api_name = "GnuPG";
  }
}


function getGnuPGAPI() {
  return new GnuPGCryptoAPI();
}
