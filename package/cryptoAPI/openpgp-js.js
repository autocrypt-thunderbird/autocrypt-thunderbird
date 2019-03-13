/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

//var EXPORTED_SYMBOLS = ["getOpenPGPjsAPI"];


var Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const EnigmailLog = Cu.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailLazy = Cu.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;

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

  async getStrippedKey(armoredKey, emailAddr) {
    EnigmailLog.DEBUG("openpgp-js.js: getStrippedKey()\n");

    let searchUid = undefined;
    if (emailAddr) {
      if (emailAddr.search(/^<.{1,500}>$/) < 0) {
        searchUid = `<${emailAddr}>`;
      } else searchUid = emailAddr;
    }

    try {
      let openpgp = getOpenPGP().openpgp;
      let msg = await openpgp.key.readArmored(armoredKey);

      if (!msg || msg.keys.length === 0) {
        if (msg.err) {
          EnigmailLog.writeException("openpgp-js.js", msg.err[0]);
        }
        return null;
      }

      let key = msg.keys[0];
      let uid = await key.getPrimaryUser(null, searchUid);
      if (!uid || !uid.user) return null;

      let signSubkey = await key.getSigningKey();
      let encSubkey = await key.getEncryptionKey();
      /*
            let encSubkey = null,
              signSubkey = null;

            for (let i = 0; i < key.subKeys.length; i++) {
              if (key.subKeys[i].subKey === encSubkeyPacket) {
                encSubkey = key.subKeys[i];
                break;
              }
            }
            if (!encSubkey) return null;

            if (!signSubkeyPacket.keyid) {
              for (let i = 0; i < key.subKeys.length; i++) {
                if (key.subKeys[i].subKey === signSubkeyPacket) {
                  signSubkey = key.subKeys[i];
                  break;
                }
              }
              if (!signSubkey) return null;
            }
      */

      let p = new openpgp.packet.List();
      p.push(key.primaryKey);
      p.concat(uid.user.toPacketlist());
      if (key !== signSubkey) {
        p.concat(signSubkey.toPacketlist());
      }
      if (key !== encSubkey) {
        p.concat(encSubkey.toPacketlist());
      }

      return p.write();
    } catch (ex) {
      EnigmailLog.DEBUG("openpgp-js.js: getStrippedKey: ERROR " + ex.message + "\n" + ex.stack + "\n");
    }
    return null;
  }
}


function getOpenPGPjsAPI() {
  return new OpenPGPjsCryptoAPI();
}