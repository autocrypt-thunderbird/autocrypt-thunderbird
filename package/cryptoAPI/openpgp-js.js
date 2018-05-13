/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["getOpenPGPjsAPI"];


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Components.utils.import("resource://gre/modules/Services.jsm"); /* global Services: false */
const {
  EnigmailLog
} = Cu.import("chrome://enigmail/content/modules/log.jsm");
const {
  EnigmailLazy
} = Cu.import("chrome://enigmail/content/modules/lazy.jsm");

const getOpenPGP = EnigmailLazy.loader("enigmail/openpgp.jsm", "EnigmailOpenPGP");

// Load generic API
Services.scriptloader.loadSubScript("chrome://enigmail/content/modules/cryptoAPI/interface.js",
  null, "UTF-8"); /* global CryptoAPI */


/**
 * OpenPGP.js implementation of CryptoAPI
 */

class OpenPGPjsCryptoAPI extends CryptoAPI {
  constructor() {
    super();
    this.api_name = "OpenPGP.js";
  }

  async getStrippedKey(armoredKey) {
    EnigmailLog.DEBUG("openpgp-js.js: getStrippedKey()\n");

    try {
      let openpgp = getOpenPGP().openpgp;
      let msg = openpgp.key.readArmored(armoredKey);

      if (!msg || msg.keys.length === 0) return null;

      let key = msg.keys[0];
      let uid = await key.getPrimaryUser();
      if (!uid || !uid.user) return null;

      let encSubkey = await key.getEncryptionKeyPacket();
      let foundSubKey = null;

      for (let i = 0; i < key.subKeys.length; i++) {
        if (key.subKeys[i].subKey === encSubkey) {
          foundSubKey = key.subKeys[i];
          break;
        }
      }

      if (!foundSubKey) return null;

      let p = new openpgp.packet.List();
      p.push(key.primaryKey);
      p.concat(uid.user.toPacketlist());
      p.concat(foundSubKey.toPacketlist());

      return p.write();
    }
    catch (ex) {
      EnigmailLog.DEBUG("openpgp-js.js: getStrippedKey: ERROR " + ex.message + "\n");
    }
    return null;
  }
}


function getOpenPGPjsAPI() {
  return new OpenPGPjsCryptoAPI();
}
