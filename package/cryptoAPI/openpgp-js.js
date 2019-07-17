/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["getOpenPGPjsAPI"];


var Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const EnigmailLog = Cu.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailLazy = Cu.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailConstants = Cu.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;

const getOpenPGP = EnigmailLazy.loader("enigmail/openpgp.jsm", "EnigmailOpenPGP");
const getArmor = EnigmailLazy.loader("enigmail/armor.jsm", "EnigmailArmor");

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
      const openpgp = getOpenPGP().openpgp;
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

  async decrypt(ciphertext, openpgp_secret_keys, openpgp_public_keys) {
    EnigmailLog.DEBUG(`openpgp-js.js: decrypt()\n`);

    const openpgp = getOpenPGP().openpgp;
    let startTime = new Date();

    const decrypt_options = {
      message: await openpgp.message.readArmored(ciphertext),
      publicKeys: openpgp_public_keys,
      privateKeys: openpgp_secret_keys
    };

    // TODO limit output to 100 times message size to avoid DoS attack?

    EnigmailLog.DEBUG(`openpgp-js.js: decrypting...\n`);
    try {
      let openpgp_result = await openpgp.decrypt(decrypt_options);
      let time_diff_ms = new Date() - startTime;
      EnigmailLog.DEBUG(`openpgp-js.js: decrypt ok in ${time_diff_ms}ms\n`);
      // EnigmailLog.DEBUG(`openpgp-js.js: ${stringify(openpgp_result)}\n`);

      let sig_key_id;
      let sig_ok;
      if (openpgp_result.signatures && openpgp_result.signatures.length) {
        let sig = openpgp_result.signatures[0];

        sig_key_id = sig.keyid.toHex().toUpperCase();
        sig_ok = sig.valid;
      }

      return {
        plaintext: openpgp_result.data,
        sig_key_id: sig_key_id,
        sig_ok: sig_ok
        /*
          userId: 'juja@example.net',
          sigDetails: '',
          errorMsg: 'no error',
          blockSeparation: '',
          encToDetails: ''
        */
      };
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: decrypt error! ex: ${ex}\n`);
      throw ex;
    }
  }

  async encrypt(plaintext, openPgpSecretKey, openPgpPubKeys) {
    EnigmailLog.DEBUG(`openpgp-js.js: encrypt()\n`);
    const openpgp = getOpenPGP().openpgp;

    // encrypt to self, too
    if (openPgpSecretKey) {
      openPgpPubKeys.push(openPgpSecretKey.toPublic());
    }

    try {
      const encrypt_options = {
        message: openpgp.message.fromText(plaintext),
        publicKeys: openPgpPubKeys,
        privateKeys: [openPgpSecretKey]
      };

      EnigmailLog.DEBUG(`openpgp-js.js: encrypting to ${encrypt_options.publicKeys.length} pubkeys..\n`);
      let openpgp_result = await openpgp.encrypt(encrypt_options);
      EnigmailLog.DEBUG("openpgp-js.js: encrypt ok\n");
      return openpgp_result.data;
    } catch (ex) {
      EnigmailLog.DEBUG("openpgp-js.js: encrypt error: " + ex + "\n");
      throw ex;
    }
  }

  async parseOpenPgpKey(key_data) {
    EnigmailLog.DEBUG("openpgp-js.js: parseOpenPgpKey()\n");
    try {
      const openpgp = getOpenPGP().openpgp;

      let binary_data;
      if (key_data instanceof Uint8Array) {
        binary_data = key_data;
      } else {
        binary_data = Uint8Array.from(key_data, c => c.charCodeAt(0));
      }
      let result = await openpgp.key.read(binary_data);
      // EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): parsed ${JSON.stringify(result)}\n`);

      let key = result.keys[0];
      if (!key) {
        EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): no key parsed\n`);
        return null;
      }

      EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): ok\n`);
      return key;
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): error ${ex}\n`);
      return null;
    }
  }

  async parseOpenPgpKeyInfo(key_data) {
    EnigmailLog.DEBUG("openpgp-js.js: parseOpenPgpKey()\n");
    try {
      const openpgp = getOpenPGP().openpgp;

      let binary_data;
      if (key_data instanceof Uint8Array) {
        binary_data = key_data;
      } else {
        binary_data = Uint8Array.from(key_data, c => c.charCodeAt(0));
      }

      let result = await openpgp.key.read(binary_data);
      // EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): parsed ${JSON.stringify(result)}\n`);

      let key = result.keys[0];
      if (!key) {
        EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): no key parsed\n`);
        return null;
      }

      const parsed_key = {
        fpr_primary: key.getFingerprint().toUpperCase(),
        key_data: key.toPacketlist().write(),
        key_fprs: [key.getFingerprint().toUpperCase()],
        key_ids: [key.getKeyId().toHex().toUpperCase()]
      };

      for (let subkey of key.getSubkeys()) {
        parsed_key.key_fprs.push(subkey.getFingerprint().toUpperCase());
        parsed_key.key_ids.push(subkey.getKeyId().toHex().toUpperCase());
      }

      EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): ok (${parsed_key.fpr_primary})\n`);
      return parsed_key;
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): error ${ex}\n`);
      return null;
    }
  }

  async getKeyListFromKeyBlock(keyBlockStr) {
    return await this.OPENPGPjs_getKeyListFromKeyBlockkeyBlockStr(keyBlockStr);
  }

  async OPENPGPjs_getKeyListFromKeyBlock(keyBlockStr) {
    EnigmailLog.DEBUG("openpgp-js.js: getKeyListFromKeyBlock()\n");

    const SIG_TYPE_REVOCATION = 0x20;

    let keyList = [];
    let key = {};
    let blocks;
    let isBinary = false;
    const EOpenpgp = getOpenPGP();

    if (keyBlockStr.search(/-----BEGIN PGP (PUBLIC|PRIVATE) KEY BLOCK-----/) >= 0) {
      blocks = getArmor().splitArmoredBlocks(keyBlockStr);
    } else {
      isBinary = true;
      blocks = [EOpenpgp.enigmailFuncs.bytesToArmor(EOpenpgp.openpgp.enums.armor.public_key, keyBlockStr)];
    }

    for (let b of blocks) {
      let m = await EOpenpgp.openpgp.message.readArmored(b);

      for (let i = 0; i < m.packets.length; i++) {
        let packetType = EOpenpgp.openpgp.enums.read(EOpenpgp.openpgp.enums.packet, m.packets[i].tag);
        switch (packetType) {
          case "publicKey":
          case "secretKey":
            key = {
              id: m.packets[i].getKeyId().toHex().toUpperCase(),
              fpr: m.packets[i].getFingerprint().toUpperCase(),
              name: null,
              isSecret: false
            };

            if (!(key.id in keyList)) {
              keyList[key.id] = key;
            }

            if (packetType === "secretKey") {
              keyList[key.id].isSecret = true;
            }
            break;
          case "userid":
            if (!key.name) {
              key.name = m.packets[i].userid.replace(/[\r\n]+/g, " ");
            }
            break;
          case "signature":
            if (m.packets[i].signatureType === SIG_TYPE_REVOCATION) {
              let keyId = m.packets[i].issuerKeyId.toHex().toUpperCase();
              if (keyId in keyList) {
                keyList[keyId].revoke = true;
              } else {
                keyList[keyId] = {
                  revoke: true,
                  id: keyId
                };
              }
            }
            break;
        }
      }
    }

    return keyList;
  }
}

function streamToString(stream, enc, cb) {
    if (typeof enc === 'function') {
        cb = enc;
        enc = null;
    }
    cb = cb || function () {};

    var str = '';

    return new Promise (function (resolve, reject) {
        stream.on('data', function (data) {
            str += (typeof enc === 'string') ? data.toString(enc) : data.toString();
        });
        stream.on('end', function () {
            resolve(str);
            cb(null, str);
        });
        stream.on('error', function (err) {
            reject(err);
            cb(err);
        });
    });
}

// Note: cache should not be re-used by repeated calls to JSON.stringify.
function stringify(o) {
  const cache = [];
  return JSON.stringify(o, function(key, value) {
      if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
              // Duplicate reference found, discard key
              return undefined;
          }
          // Store value in our collection
          cache.push(value);
      }
      return value;
  });
}

function getOpenPGPjsAPI() {
  return new OpenPGPjsCryptoAPI();
}
