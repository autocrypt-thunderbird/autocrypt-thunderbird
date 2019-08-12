/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["getOpenPGPjsAPI"];


var Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const EnigmailLog = Cu.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailLazy = Cu.import("chrome://autocrypt/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailConstants = Cu.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailFuncs = Cu.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;

const getOpenPGP = EnigmailLazy.loader("autocrypt/openpgp.jsm", "EnigmailOpenPGP");
const getArmor = EnigmailLazy.loader("autocrypt/armor.jsm", "EnigmailArmor");

// Load generic API
Services.scriptloader.loadSubScript("chrome://autocrypt/content/modules/cryptoAPI/interface.js",
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

  async decrypt(ciphertext, openpgp_secret_keys, openpgp_public_key, cached_session_key, openpgp_public_key_callback) {
    EnigmailLog.DEBUG(`openpgp-js.js: decrypt()\n`);

    const openpgp = getOpenPGP().openpgp;
    let startTime = new Date();

    if (openpgp_public_key) {
      EnigmailLog.DEBUG(`openpgp-js.js: decrypt(): expected pubKey: ${openpgp_public_key.getFingerprint().toUpperCase()}\n`);
    }

    // TODO limit output to 100 times message size to avoid DoS attack?

    EnigmailLog.DEBUG(`openpgp-js.js: decrypting...\n`);
    try {
      let session_key;
      if (!cached_session_key) {
        const startTimeAsym = new Date();
        const decrypted_session_keys = await openpgp.decryptSessionKeys({
          message: await openpgp.message.readArmored(ciphertext),
          privateKeys: openpgp_secret_keys
        });
        if (!decrypted_session_keys) {
          throw new Error("session failed to decrypt");
        }
        const time_diff_asym_ms = new Date() - startTimeAsym;
        EnigmailLog.DEBUG(`openpgp-js.js: asymmetric decrypt took in ${time_diff_asym_ms}ms\n`);

        session_key = decrypted_session_keys[0];
      } else {
        EnigmailLog.DEBUG(`openpgp-js.js: got cached session key, skipping asymmetric decrypt\n`);
        session_key = cached_session_key;
      }

      const openpgp_result = await openpgp.decrypt({
        message: await openpgp.message.readArmored(ciphertext),
        sessionKeys: session_key,
        publicKeys: openpgp_public_key,
        privateKeys: openpgp_secret_keys
      });
      const plaintext = String(openpgp_result.data);

      let sig_ok = false;
      let sig_key_id;
      let sig_openpgp_key;
      if (openpgp_result.signatures && openpgp_result.signatures.length) {
        let sig = openpgp_result.signatures[0];

        sig_key_id = sig.keyid.toHex().toUpperCase();
        if (sig.valid) {
          sig_ok = true;
          sig_openpgp_key = openpgp_public_key;
        } else if (openpgp_public_key_callback) {
          let message = openpgp.message.fromText(plaintext);
          let verify_result = await this.verifyWith(message, sig.signature, sig_key_id, openpgp_public_key_callback, openpgp_public_key);
          if (verify_result && verify_result.sig_ok) {
            sig_ok = true;
            sig_openpgp_key = verify_result.sig_openpgp_key;
          }
        }
      }

      const time_diff_ms = new Date() - startTime;
      EnigmailLog.DEBUG(`openpgp-js.js: decrypt ok in ${time_diff_ms}ms\n`);

      return {
        plaintext: plaintext,
        sig_ok: sig_ok,
        sig_key_id: sig_key_id,
        sig_openpgp_key: sig_openpgp_key,
        session_key: session_key
      };
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: decrypt error! ex: ${ex}\n`);
      throw ex;
    }
  }

  async verifyWith(message, signature, sig_key_id, openpgp_public_key_callback, excluded_keys) {
    // TODO make this less ugly? :)
    EnigmailLog.DEBUG(`openpgp-js.js: bad sig, looking for foreign signing key..\n`);
    let foreign_key = await openpgp_public_key_callback(sig_key_id);
    if (!foreign_key) {
      EnigmailLog.DEBUG(`openpgp-js.js: no foreign signing key found\n`);
      return false;
    }
    let is_different = excluded_keys && foreign_key.getFingerprint() == excluded_keys.getFingerprint();
    if (is_different) {
      EnigmailLog.DEBUG(`openpgp-js.js: foreign signing key was previously checked\n`);
      return false;
    }
    const openpgp = getOpenPGP().openpgp;

    EnigmailLog.DEBUG(`openpgp-js.js: found foreign signing key\n`);
    try {
      let foreign_result = await openpgp.verify({
        message: message,
        publicKeys: foreign_key,
        signature: signature
      });
      EnigmailLog.DEBUG(`openpgp-js.js: verified ${stringify(foreign_result)}\n`);
      if (foreign_result && foreign_result.signatures && foreign_result.signatures.length) {
        let sig = foreign_result.signatures[0];
        if (sig.valid) {
          EnigmailLog.DEBUG(`openpgp-js.js: foreign signature ok\n`);
          return {
            sig_ok: true,
            sig_openpgp_key: foreign_key
          };
        }
        EnigmailLog.DEBUG(`openpgp-js.js: foreign signature failed to verify\n`);
      }
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: signature verification error: ${ex}\n`);
    }
    return false;
  }

  async verify(plaintext, sig_data, openpgp_public_key, openpgp_public_key_callback) {
    EnigmailLog.DEBUG(`openpgp-js.js: verify()\n`);

    const openpgp = getOpenPGP().openpgp;
    let startTime = new Date();

    const verify_options = {
      message: openpgp.cleartext.fromText(plaintext),
      publicKeys: openpgp_public_key,
      signature: await openpgp.signature.readArmored(sig_data)
    };

    // EnigmailLog.DEBUG(`openpgp-js.js: ${JSON.stringify(verify_options)}\n`);
    // TODO limit output to 100 times message size to avoid DoS attack?

    EnigmailLog.DEBUG(`openpgp-js.js: verifying...\n`);
    try {
      let openpgp_result = await openpgp.verify(verify_options);
      let time_diff_ms = new Date() - startTime;
      EnigmailLog.DEBUG(`openpgp-js.js: verify ok in ${time_diff_ms}ms\n`);
      // EnigmailLog.DEBUG(`openpgp-js.js: ${stringify(openpgp_result)}\n`);

      let sig_key_id;
      let sig_ok;
      let sig_data;
      if (openpgp_result.signatures && openpgp_result.signatures.length) {
        let sig = openpgp_result.signatures[0];

        sig_ok = sig.valid;
        sig_key_id = sig.keyid.toHex().toUpperCase();

        if (!sig_ok && openpgp_public_key_callback) {
          EnigmailLog.DEBUG(`openpgp-js.js: bad sig, looking for foreign signing key..\n`);
          let foreign_keys = await openpgp_public_key_callback(sig_key_id);
          if (foreign_keys) {
            verify_options.publicKeys = foreign_keys;
            EnigmailLog.DEBUG(`openpgp-js.js: found foreign signing key\n`);
            let foreign_signature = await openpgp.verify(verify_options);
            sig_ok = foreign_signature.valid;
          } else {
            EnigmailLog.DEBUG(`openpgp-js.js: no foreign signing key found\n`);
          }
        }
      }

      return {
        sig_key_id: sig_key_id,
        sig_ok: sig_ok
      };
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: verify error! ex: ${ex}\n`);
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

  wrap(password, plaintext) {
    const openpgp = getOpenPGP().openpgp;
    // This is NOT an actual KDF! We only use this with a full entropy password
    // from masterpass. do not use otherwise!
    const password_array = openpgp.util.str_to_Uint8Array(password);
    const key = this.sync(openpgp.crypto.hash.sha256(password_array));

    const plaintext_array = openpgp.util.str_to_Uint8Array(plaintext);
    const IV = this.sync(openpgp.crypto.random.getRandomBytes(openpgp.crypto.cipher.aes256.blockSize));

    const ciphertext_array = openpgp.crypto.cfb.encrypt('aes256', key, plaintext_array, IV);

    const result_array = new Uint8Array(IV.length + ciphertext_array.length);
    result_array.set(IV);
    result_array.set(ciphertext_array, IV.length);

    const result_string = openpgp.util.Uint8Array_to_b64(result_array);
    return result_string;
  }

  unwrap(password, result_string) {
    const openpgp = getOpenPGP().openpgp;
    // This is NOT an actual KDF! We only use this with a full entropy password
    // from masterpass. do not use otherwise!
    const password_array = openpgp.util.str_to_Uint8Array(password);
    const key = this.sync(openpgp.crypto.hash.sha256(password_array));

    const result_array = openpgp.util.b64_to_Uint8Array(result_string);
    const IV = result_array.slice(0, openpgp.crypto.cipher.aes256.blockSize);
    const ciphertext_array = result_array.slice(openpgp.crypto.cipher.aes256.blockSize);

    const plaintext_array = this.sync(openpgp.crypto.cfb.decrypt('aes256', key, ciphertext_array, IV));

    const plaintext = openpgp.util.Uint8Array_to_str(plaintext_array);
    return plaintext;
  }

  async parseOpenPgpKey(key_data) {
    let keys = await this.parseOpenPgpKeys(key_data);
    if (keys && keys.length) {
      return keys[0];
    }
    return null;
  }

  async parseOpenPgpKeys(key_data, clean = true) {
    EnigmailLog.DEBUG("openpgp-js.js: parseOpenPgpKey()\n");
    try {
      const openpgp = getOpenPGP().openpgp;

      let result;
      if (key_data instanceof Uint8Array) {
        result = await openpgp.key.read(key_data);
      } else if (key_data.startsWith('-----')) {
        result = await openpgp.key.readArmored(key_data);
      } else {
        let binary_data = Uint8Array.from(key_data, c => c.charCodeAt(0));
        result = await openpgp.key.read(binary_data);
      }
      // EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): parsed ${JSON.stringify(result)}\n`);

      if (!result || !result.keys || !result.keys.length) {
        EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): no key parsed\n`);
        return [];
      }

      let keys;
      if (clean) {
        keys = result.keys.map(key => cleanOpenPgpKey(key));
      } else {
        keys = result.keys;
      }
      EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): ok\n`);
      return keys;
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): error ${ex}\n`);
      return [];
    }
  }

  async parseOpenPgpKeyInfo(key_data) {
    EnigmailLog.DEBUG("openpgp-js.js: parseOpenPgpKey()\n");
    try {
      const openpgp = getOpenPGP().openpgp;

      let result;
      if (key_data instanceof Uint8Array) {
        result = await openpgp.key.read(key_data);
      } else if (key_data.startsWith('-----')) {
        result = await openpgp.key.readArmored(key_data);
      } else {
        let binary_data = Uint8Array.from(key_data, c => c.charCodeAt(0));
        result = await openpgp.key.read(binary_data);
      }
      // EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): parsed ${JSON.stringify(result)}\n`);

      let key = result.keys[0];
      if (!key) {
        EnigmailLog.DEBUG(`openpgp-js.js: parseOpenPgpKey(): no key parsed\n`);
        return null;
      }

      key = cleanOpenPgpKey(key);

      const parsed_key = {
        fpr_primary: key.getFingerprint().toUpperCase(),
        key_data: key.toPacketlist().write(),
        key_fprs: [key.getFingerprint().toUpperCase()],
        key_ids: [key.getKeyId().toHex().toUpperCase()],
        addresses: key.getUserIds().map(uid => EnigmailFuncs.stripEmail(uid))
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

  async generateAutocryptKey(email) {
    EnigmailLog.DEBUG(`autocryptSetup.jsm: createAutocryptKey(): ${email}\n`);

    const openpgp = getOpenPGP().openpgp;
    var options = {
      userIds: [{ email: email }],
      curve: "ed25519"
    };

    let gen_result = await openpgp.generateKey(options);
    return gen_result.key;
  }

  async decryptSymmetric(ciphertext, password) {
    EnigmailLog.DEBUG("openpgp-js.js: decryptSymmetric()\n");
    const start_time = new Date();

    const openpgp = getOpenPGP().openpgp;
    try {
      const decrypt_options = {
        message: await openpgp.message.readArmored(ciphertext),
        passwords: password
      };

      let result = await openpgp.decrypt(decrypt_options);

      EnigmailLog.DEBUG(`openpgp-js.js: decryptSymmetric(): ok\n`);
      return result.data;
    } catch (ex) {
      EnigmailLog.DEBUG(`openpgp-js.js: decryptSymmetric(): decrypt error! ex: ${ex}\n`);
      throw ex;
    }
  }

  // TODO this was intended to "warm up" the js crypto routines. doesn't
  // actually help, so we don't do it for now.
  async initialize() {
    EnigmailLog.DEBUG("openpgp-js.js: initialize()\n");
    const start_time = new Date();
    const dummy_msg = `-----BEGIN PGP MESSAGE-----

jA0EBwMCe6agrgUPkAT/0jkBc+WUaiK5AuuRvVXiS/GSA0HMih5JeTmqqZRmGu9Z
8kFeiOjkuwu+L6ttYjpH5lTIwR7LwaTljE4=
=fWHy
-----END PGP MESSAGE-----`;

    const openpgp = getOpenPGP().openpgp;
    const decrypt_options = {
      message: await openpgp.message.readArmored(dummy_msg),
      passwords: 'abc'
    };

    await openpgp.decrypt(decrypt_options);

    let time_diff_ms = new Date() - start_time;
    EnigmailLog.DEBUG(`openpgp-js.js: initialize(): ok (${time_diff_ms}ms)\n`);
  }
}

function cleanOpenPgpKey(openpgp_key) {
  const openpgp = getOpenPGP().openpgp;
  const primary_keyid = openpgp_key.getKeyId();
  const primary_fingerprint = openpgp_key.getFingerprint();
  const packet_list = openpgp_key.toPacketlist();
  let filtered_keys = 0;
  const filtered_list = packet_list.filter(function(packet) {
    let packetType = openpgp.enums.read(openpgp.enums.packet, packet.tag);
    switch (packetType) {
      case 'publicKey':
      case 'publicSubkey':
      case 'secretKey':
      case 'secretSubkey':
      case 'userid':
        return true;
      case 'signature':
        if (packet.issuerFingerprint && packet.issuerFingerprint == primary_fingerprint ||
          packet.issuerKeyId && packet.issuerKeyId.equals(primary_keyid)) {
          return true;
        }
        filtered_keys += 1;
        return false;
    }
    EnigmailLog.DEBUG(`openpgp-js.js: cleanOpenPgpKey(): dropping unexpected packet ${packetType}\n`);
    return false;
  });
  if (filtered_keys) {
    EnigmailLog.DEBUG(`openpgp-js.js: cleanOpenPgpKey(): dropped ${filtered_keys} third party sigs\n`);
  }
  return openpgp.key.Key(filtered_list);
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
