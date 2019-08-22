/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*eslint no-loop-func: 0*/

/**
 *  Module to determine the type of setup of the user, based on existing emails
 *  found in the inbox
 */

var EXPORTED_SYMBOLS = ["AutocryptAutocryptSetup"];

const AutocryptAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").AutocryptAutocrypt;
const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").AutocryptLazy;
const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
const AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
const AutocryptMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").AutocryptMime;
const AutocryptKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").AutocryptKeyRing;
const AutocryptArmor = ChromeUtils.import("chrome://autocrypt/content/modules/armor.jsm").AutocryptArmor;
const AutocryptOpenPGP = ChromeUtils.import("chrome://autocrypt/content/modules/openpgp.jsm").AutocryptOpenPGP;
const AutocryptRNG = ChromeUtils.import("chrome://autocrypt/content/modules/rng.jsm").AutocryptRNG;
const AutocryptSend = ChromeUtils.import("chrome://autocrypt/content/modules/send.jsm").AutocryptSend;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").AutocryptSqliteDb;

const getOpenPGP = AutocryptLazy.loader("autocrypt/openpgp.jsm", "AutocryptOpenPGP");
const openpgp = getOpenPGP().openpgp;

const nsIMsgAccountManager = Ci.nsIMsgAccountManager;

var gCreatedSetupIds = [];

var AutocryptAutocryptSetup = {
  createBackupOuterMsg: function(toEmail, encryptedMsg) {
    let boundary = AutocryptMime.createBoundary();

    let msgStr = 'To: ' + toEmail + '\r\n' +
      'From: ' + toEmail + '\r\n' +
      'Autocrypt-Setup-Message: v1\r\n' +
      'Subject: ' + AutocryptLocale.getString("autocrypt.setupMsg.subject") + '\r\n' +
      'Content-type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      AutocryptLocale.getString("autocryptSetupReq.setupMsg.desc") + '\r\n\r\n' +
      AutocryptLocale.getString("autocrypt.setupMsg.msgBody") + '\r\n\r\n' +
      AutocryptLocale.getString("autocryptSetupReq.setupMsg.backup") + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: application/autocrypt-setup\r\n' +
      'Content-Disposition: attachment; filename="autocrypt-setup-message.html"\r\n\r\n' +
      '<html><body>\r\n' +
      '<p>' + AutocryptLocale.getString("autocrypt.setupMsg.fileTxt") + '</p>\r\n' +
      '<pre>\r\n' +
      encryptedMsg +
      '</pre></body></html>\r\n' +
      '--' + boundary + '--\r\n';

    return msgStr;
  },


  /**
  * @return Object:
  *          fpr:           String - FPR of the imported key
  *          preferEncrypt: String - Autocrypt preferEncrypt value (e.g. mutual)
  */
  importSetupKey: function(keyData) {

    AutocryptLog.DEBUG("autocrypt.jsm: importSetupKey()\n");

    let preferEncrypt = "nopreference"; // Autocrypt default according spec
    let start = {},
      end = {},
      keyObj = {};

    let msgType = AutocryptArmor.locateArmoredBlock(keyData, 0, "", start, end, {});
    if (msgType === "PRIVATE KEY BLOCK") {

      let headers = AutocryptArmor.getArmorHeaders(keyData);
      if ("autocrypt-prefer-encrypt" in headers) {
        preferEncrypt = headers["autocrypt-prefer-encrypt"];
      }

      let r = AutocryptKeyRing.importKey(null, false, keyData, "", {}, keyObj);

      if (r === 0 && keyObj.value && keyObj.value.length > 0) {
        return {
          fpr: keyObj.value[0],
          preferEncrypt: preferEncrypt
        };
      }
    }

    return null;
  },


  /**
  * Create the 9x4 digits backup code as defined in the Autocrypt spec
  *
  * @return String: xxxx-xxxx-...
  */

  createBackupCode: function() {
    let bkpCode = "";

    for (let i = 0; i < 9; i++) {
      if (i > 0) bkpCode += "-";

      let a = new Uint8Array(4);
      crypto.getRandomValues(a);
      for (let j = 0; j < 4; j++) {
        bkpCode += String(a[j] % 10);
      }
    }
    return bkpCode;
  },

  /**
   * Create Autocrypt Backup File
   *
   * @param identity: Object - nsIMsgIdentity
   *
   * @return Promise({str, passwd}):
   *             msg:    String - complete setup message
   *             passwd: String - backup password
   */
  createBackupFile: async function(secret_key) {
    AutocryptLog.DEBUG("autocrypt.jsm: createBackupFile()\n");

    if (!AutocryptCore.getService(null, false)) {
      throw new Error("AutocryptCore not available!");
    }

    try {
      let preferEncrypt = "mutual"; // : "nopreference";
      let armoredBackup = await this.createArmoredBackup(secret_key, preferEncrypt);
      return armoredBackup;
    } catch(e) {
      AutocryptLog.DEBUG(`autocrypt.jsm: createBackupFile: error ${e}\n`);
      throw e;
    }
  },

  createArmoredBackup: async function(secret_key, preferEncrypt) {
    let key_data = secret_key.armor();
    let innerMsg = AutocryptArmor.replaceArmorHeaders(key_data, {
      'Autocrypt-Prefer-Encrypt': preferEncrypt
    }) + '\r\n';

    let bkpCode = this.createBackupCode();
    let enc = {
      message: AutocryptOpenPGP.openpgp.message.fromText(innerMsg),
      passwords: bkpCode,
      armor: true
    };

    // create symmetrically encrypted message
    let msg = await AutocryptOpenPGP.openpgp.encrypt(enc);
    let msgData = AutocryptArmor.replaceArmorHeaders(msg.data, {
      'Passphrase-Format': 'numeric9x4',
      'Passphrase-Begin': bkpCode.substr(0, 2)
    }).replace(/\n/g, "\r\n");

    return {
      msg: msgData,
      passwd: bkpCode
    };
  },

  /**
   * Create Autocrypt Setup Message
   *
   * @param identity: Object - nsIMsgIdentity
   *
   * @return Promise({str, passwd}):
   *             msg:    String - complete setup message
   *             passwd: String - backup password
   */
  createSetupMessage: function(email, secret_key) {
    AutocryptLog.DEBUG("autocrypt.jsm: createSetupMessage()\n");

    return new Promise((resolve, reject) => {
      try {

        if (!AutocryptCore.getService(null, false)) {
          reject(0);
          return;
        }

        let key_data = secret_key.armor();

        let preferEncrypt = "mutual"; // : "nopreference";

        let innerMsg = AutocryptArmor.replaceArmorHeaders(key_data, {
          'Autocrypt-Prefer-Encrypt': preferEncrypt
        }) + '\r\n';

        let bkpCode = this.createBackupCode();
        let enc = {
          message: AutocryptOpenPGP.openpgp.message.fromText(innerMsg),
          passwords: bkpCode,
          armor: true
        };

        // create symmetrically encrypted message
        AutocryptOpenPGP.openpgp.encrypt(enc).then(msg => {
          let msgData = AutocryptArmor.replaceArmorHeaders(msg.data, {
            'Passphrase-Format': 'numeric9x4',
            'Passphrase-Begin': bkpCode.substr(0, 2)
          }).replace(/\n/g, "\r\n");

          let m = this.createBackupOuterMsg(email, msgData);
          resolve({
            msg: m,
            passwd: bkpCode
          });
        }).catch(e => {
          AutocryptLog.DEBUG("autocrypt.jsm: createSetupMessage: error " + e + "\n");
          reject(2);
        });
      } catch (ex) {
        AutocryptLog.DEBUG("autocrypt.jsm: createSetupMessage: error " + ex.toString() + "\n");
        reject(4);
      }
    });
  },

  sendSetupMessage: async function(email) {
    AutocryptLog.DEBUG("autocrypt.jsm: sendSetupMessage()\n");

    let autocrypt_info = await AutocryptAutocrypt.getAutocryptSettingsForIdentity(email);
    if (!autocrypt_info.is_secret) {
      throw "not a secret key!";
    }
    let secret_keys = await AutocryptKeyRing.getAllSecretKeysMap();
    let secret_key = secret_keys[autocrypt_info.fpr_primary];

    let res = await this.createSetupMessage(email, secret_key);

    let composeFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
    composeFields.characterSet = "UTF-8";
    composeFields.messageId = AutocryptRNG.generateRandomString(27) + "-enigmail";
    composeFields.from = email;
    composeFields.to = email;
    gCreatedSetupIds.push(composeFields.messageId);

    let now = new Date();
    let mimeStr = "Message-Id: " + composeFields.messageId + "\r\n" +
      "Date: " + now.toUTCString() + "\r\n" + res.msg;

    if (AutocryptSend.sendMessage(mimeStr, composeFields, null)) {
      return res.passwd;
    } else {
      throw "error sending message";
    }
  },

  /**
   * Determine if a message id was self-created (only during same TB session)
   */
  isSelfCreatedSetupMessage: function(messageId) {
    return (gCreatedSetupIds.indexOf(messageId) >= 0);
  }
};
