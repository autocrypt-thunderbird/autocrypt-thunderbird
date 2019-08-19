/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*eslint no-loop-func: 0*/

/**
 *  Module to determine the type of setup of the user, based on existing emails
 *  found in the inbox
 */

var EXPORTED_SYMBOLS = ["EnigmailAutocryptSetup"];

const EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
const EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
const EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailArmor = ChromeUtils.import("chrome://autocrypt/content/modules/armor.jsm").EnigmailArmor;
const EnigmailOpenPGP = ChromeUtils.import("chrome://autocrypt/content/modules/openpgp.jsm").EnigmailOpenPGP;
const EnigmailRNG = ChromeUtils.import("chrome://autocrypt/content/modules/rng.jsm").EnigmailRNG;
const EnigmailSend = ChromeUtils.import("chrome://autocrypt/content/modules/send.jsm").EnigmailSend;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

const getOpenPGP = EnigmailLazy.loader("autocrypt/openpgp.jsm", "EnigmailOpenPGP");
const openpgp = getOpenPGP().openpgp;

const nsIMsgAccountManager = Ci.nsIMsgAccountManager;

var gCreatedSetupIds = [];

var EnigmailAutocryptSetup = {
  createBackupOuterMsg: function(toEmail, encryptedMsg) {
    let boundary = EnigmailMime.createBoundary();

    let msgStr = 'To: ' + toEmail + '\r\n' +
      'From: ' + toEmail + '\r\n' +
      'Autocrypt-Setup-Message: v1\r\n' +
      'Subject: ' + EnigmailLocale.getString("autocrypt.setupMsg.subject") + '\r\n' +
      'Content-type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      EnigmailLocale.getString("autocryptSetupReq.setupMsg.desc") + '\r\n\r\n' +
      EnigmailLocale.getString("autocrypt.setupMsg.msgBody") + '\r\n\r\n' +
      EnigmailLocale.getString("autocryptSetupReq.setupMsg.backup") + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: application/autocrypt-setup\r\n' +
      'Content-Disposition: attachment; filename="autocrypt-setup-message.html"\r\n\r\n' +
      '<html><body>\r\n' +
      '<p>' + EnigmailLocale.getString("autocrypt.setupMsg.fileTxt") + '</p>\r\n' +
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

    EnigmailLog.DEBUG("autocrypt.jsm: importSetupKey()\n");

    let preferEncrypt = "nopreference"; // Autocrypt default according spec
    let start = {},
      end = {},
      keyObj = {};

    let msgType = EnigmailArmor.locateArmoredBlock(keyData, 0, "", start, end, {});
    if (msgType === "PRIVATE KEY BLOCK") {

      let headers = EnigmailArmor.getArmorHeaders(keyData);
      if ("autocrypt-prefer-encrypt" in headers) {
        preferEncrypt = headers["autocrypt-prefer-encrypt"];
      }

      let r = EnigmailKeyRing.importKey(null, false, keyData, "", {}, keyObj);

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
    EnigmailLog.DEBUG("autocrypt.jsm: createBackupFile()\n");

    if (!EnigmailCore.getService(null, false)) {
      throw new Error("EnigmailCore not available!");
    }

    try {
      let preferEncrypt = "mutual"; // : "nopreference";
      let armoredBackup = await this.createArmoredBackup(secret_key, preferEncrypt);
      return armoredBackup;
    } catch(e) {
      EnigmailLog.DEBUG(`autocrypt.jsm: createBackupFile: error ${e}\n`);
      throw e;
    }
  },

  createArmoredBackup: async function(secret_key, preferEncrypt) {
    let key_data = secret_key.armor();
    let innerMsg = EnigmailArmor.replaceArmorHeaders(key_data, {
      'Autocrypt-Prefer-Encrypt': preferEncrypt
    }) + '\r\n';

    let bkpCode = this.createBackupCode();
    let enc = {
      message: EnigmailOpenPGP.openpgp.message.fromText(innerMsg),
      passwords: bkpCode,
      armor: true
    };

    // create symmetrically encrypted message
    let msg = await EnigmailOpenPGP.openpgp.encrypt(enc);
    let msgData = EnigmailArmor.replaceArmorHeaders(msg.data, {
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
    EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage()\n");

    return new Promise((resolve, reject) => {
      try {

        if (!EnigmailCore.getService(null, false)) {
          reject(0);
          return;
        }

        let key_data = secret_key.armor();

        let preferEncrypt = "mutual"; // : "nopreference";

        let innerMsg = EnigmailArmor.replaceArmorHeaders(key_data, {
          'Autocrypt-Prefer-Encrypt': preferEncrypt
        }) + '\r\n';

        let bkpCode = this.createBackupCode();
        let enc = {
          message: EnigmailOpenPGP.openpgp.message.fromText(innerMsg),
          passwords: bkpCode,
          armor: true
        };

        // create symmetrically encrypted message
        EnigmailOpenPGP.openpgp.encrypt(enc).then(msg => {
          let msgData = EnigmailArmor.replaceArmorHeaders(msg.data, {
            'Passphrase-Format': 'numeric9x4',
            'Passphrase-Begin': bkpCode.substr(0, 2)
          }).replace(/\n/g, "\r\n");

          let m = this.createBackupOuterMsg(email, msgData);
          resolve({
            msg: m,
            passwd: bkpCode
          });
        }).catch(e => {
          EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage: error " + e + "\n");
          reject(2);
        });
      } catch (ex) {
        EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage: error " + ex.toString() + "\n");
        reject(4);
      }
    });
  },

  sendSetupMessage: async function(email) {
    EnigmailLog.DEBUG("autocrypt.jsm: sendSetupMessage()\n");

    let autocrypt_info = await EnigmailAutocrypt.getAutocryptSettingsForIdentity(email);
    if (!autocrypt_info.is_secret) {
      throw "not a secret key!";
    }
    let secret_keys = await EnigmailKeyRing.getAllSecretKeysMap();
    let secret_key = secret_keys[autocrypt_info.fpr_primary];

    let res = await this.createSetupMessage(email, secret_key);

    let composeFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
    composeFields.characterSet = "UTF-8";
    composeFields.messageId = EnigmailRNG.generateRandomString(27) + "-enigmail";
    composeFields.from = email;
    composeFields.to = email;
    gCreatedSetupIds.push(composeFields.messageId);

    let now = new Date();
    let mimeStr = "Message-Id: " + composeFields.messageId + "\r\n" +
      "Date: " + now.toUTCString() + "\r\n" + res.msg;

    if (EnigmailSend.sendMessage(mimeStr, composeFields, null)) {
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
