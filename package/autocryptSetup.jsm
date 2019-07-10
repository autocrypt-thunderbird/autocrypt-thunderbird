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

const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailLazy = ChromeUtils.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailMime = ChromeUtils.import("chrome://enigmail/content/modules/mime.jsm").EnigmailMime;
const EnigmailKey = ChromeUtils.import("chrome://enigmail/content/modules/key.jsm").EnigmailKey;
const EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailArmor = ChromeUtils.import("chrome://enigmail/content/modules/armor.jsm").EnigmailArmor;
const EnigmailFuncs = ChromeUtils.import("chrome://enigmail/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailStdlib = ChromeUtils.import("chrome://enigmail/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailStreams = ChromeUtils.import("chrome://enigmail/content/modules/streams.jsm").EnigmailStreams;
const EnigmailOpenPGP = ChromeUtils.import("chrome://enigmail/content/modules/openpgp.jsm").EnigmailOpenPGP;
const EnigmailRNG = ChromeUtils.import("chrome://enigmail/content/modules/rng.jsm").EnigmailRNG;
const EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailKeyEditor = ChromeUtils.import("chrome://enigmail/content/modules/keyEditor.jsm").EnigmailKeyEditor;
const EnigmailSend = ChromeUtils.import("chrome://enigmail/content/modules/send.jsm").EnigmailSend;
const sqlite = ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

const getOpenPGP = EnigmailLazy.loader("enigmail/openpgp.jsm", "EnigmailOpenPGP");
const openpgp = getOpenPGP().openpgp;

const nsIMsgAccountManager = Ci.nsIMsgAccountManager;

var gCreatedSetupIds = [];

var EnigmailAutocryptSetup = {

  /**
   * Create a new autocrypt key for every configured account and configure the account
   * to use that key. The keys are not protected by a password.
   *
   * The creation is done in the background after waiting timeoutValue ms
   * @param {Number} timeoutValue: number of miliseconds to wait before starting
   *                               the process
   */
  createKeyForAllAccounts: function() {
    EnigmailLog.DEBUG("autocryptSetup.jsm: createKeyForAllAccounts()\n");

      let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(nsIMsgAccountManager);
      let accounts = msgAccountManager.accounts;
      let createdKeys = [];

      for (let i = 0; i < accounts.length; i++) {
        let account = accounts.queryElementAt(i, Ci.nsIMsgAccount);
        let id = account.defaultIdentity;

        if (id && id.email) {
          let keyId = this.createAutocryptKey(id.fullName, id.email);
          EnigmailLog.DEBUG(`autocryptSetup.jsm: createKeyForAllAccounts: created key\n`);
          id.setBoolAttribute("enablePgp", true);
          id.setIntAttribute("pgpKeyMode", 1);
          id.setBoolAttribute("pgpMimeMode", true);
          id.setBoolAttribute("pgpSignEncrypted", true);
        }
      }
  },

  /**
   * Create a new autocrypt-complinant key
   * The keys will not be protected by passwords.
   *
   * @param {String} userName:  Display name
   * @param {String} userEmail: Email address
   *
   * @return {Promise<Boolean>}: Success (true = successful)
   */
  createAutocryptKey: function(userName, userEmail) {
      EnigmailLog.DEBUG("autocryptSetup.jsm: createAutocryptKey()\n");

      var options = {
        userIds: [{ name:userName, email:userEmail }], // multiple user IDs
        curve: "ed25519"                                         // ECC curve name
      };

      openpgp.generateKey(options).then(function(generated) {
        EnigmailKeyRing.insertSecretKey(generated.key, userName, userEmail);
      });
  },

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
   * Create Autocrypt Setup Message
   *
   * @param identity: Object - nsIMsgIdentity
   *
   * @return Promise({str, passwd}):
   *             msg:    String - complete setup message
   *             passwd: String - backup password
   */
  createSetupMessage: function(identity) {
    EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage()\n");

    return new Promise((resolve, reject) => {
      let keyId = "";
      let key;
      try {

        if (!EnigmailCore.getService(null, false)) {
          reject(0);
          return;
        }

        if (identity.getIntAttribute("pgpKeyMode") === 1) {
          keyId = identity.getCharAttribute("pgpkeyId");
        }

        if (keyId.length > 0) {
          key = EnigmailKeyRing.getKeyById(keyId);
        } else {
          key = EnigmailKeyRing.getSecretKeyByUserId(identity.email);
        }

        if (!key) {
          EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage: no key found for " + identity.email + "\n");
          reject(1);
          return;
        }

        let keyData = key.getSecretKey(true).keyData;

        if (!keyData || keyData.length === 0) {
          EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage: no key found for " + identity.email + "\n");
          reject(1);
          return;
        }

        let ac = EnigmailFuncs.getAccountForIdentity(identity);
        let preferEncrypt = ac.incomingServer.getIntValue("acPreferEncrypt") > 0 ? "mutual" : "nopreference";

        let innerMsg = EnigmailArmor.replaceArmorHeaders(keyData, {
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

          let m = this.createBackupOuterMsg(identity.email, msgData);
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

  /**
   * Create and send the Autocrypt Setup Message to yourself
   * The message is sent asynchronously.
   *
   * @param identity: Object - nsIMsgIdentity
   *
   * @return Promise(passwd):
   *   passwd: String - backup password
   *
   */
  sendSetupMessage: function(identity) {
    EnigmailLog.DEBUG("autocrypt.jsm: sendSetupMessage()\n");

    let self = this;
    return new Promise((resolve, reject) => {
      self.createSetupMessage(identity).then(res => {
        let composeFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
        composeFields.characterSet = "UTF-8";
        composeFields.messageId = EnigmailRNG.generateRandomString(27) + "-enigmail";
        composeFields.from = identity.email;
        composeFields.to = identity.email;
        gCreatedSetupIds.push(composeFields.messageId);

        let now = new Date();
        let mimeStr = "Message-Id: " + composeFields.messageId + "\r\n" +
          "Date: " + now.toUTCString() + "\r\n" + res.msg;

        if (EnigmailSend.sendMessage(mimeStr, composeFields, null)) {
          resolve(res.passwd);
        } else {
          reject(99);
        }
      });
    });
  },


  /**
   * get the data of the attachment of a setup message
   *
   * @param attachmentUrl: String - URL of the attachment
   *
   * @return Promise(Object):
   *            attachmentData:   String - complete attachment data
   *            passphraseFormat: String - extracted format from the header (e.g. numeric9x4) [optional]
   *            passphraseHint:   String - 1st two digits of the password [optional]
   */
  getSetupMessageData: function(attachmentUrl) {
    EnigmailLog.DEBUG("autocrypt.jsm: getSetupMessageData()\n");

    return new Promise((resolve, reject) => {
      let s = EnigmailStreams.newStringStreamListener(data => {
        let start = {},
          end = {};
        let msgType = EnigmailArmor.locateArmoredBlock(data, 0, "", start, end, {});

        if (msgType === "MESSAGE") {
          EnigmailLog.DEBUG("autocrypt.jsm: getSetupMessageData: got backup key\n");
          let armorHdr = EnigmailArmor.getArmorHeaders(data);

          let passphraseFormat = "generic";
          if ("passphrase-format" in armorHdr) {
            passphraseFormat = armorHdr["passphrase-format"];
          }
          let passphraseHint = "";
          if ("passphrase-begin" in armorHdr) {
            passphraseHint = armorHdr["passphrase-begin"];
          }

          resolve({
            attachmentData: data,
            passphraseFormat: passphraseFormat,
            passphraseHint: passphraseHint
          });
        } else {
          reject("getSetupMessageData");
        }
      });

      let channel = EnigmailStreams.createChannel(attachmentUrl);
      channel.asyncOpen(s, null);
    });
  },

  /**
   * @return Promise(Object):
   *          fpr:           String - FPR of the imported key
   *          preferEncrypt: String - Autocrypt preferEncrypt value (e.g. mutual)
   */
  handleBackupMessage: function(passwd, attachmentData, fromAddr) {
    EnigmailLog.DEBUG("autocrypt.jsm: handleBackupMessage()\n");

    return new Promise((resolve, reject) => {
      let start = {},
        end = {};
      let msgType = EnigmailArmor.locateArmoredBlock(attachmentData, 0, "", start, end, {});

      EnigmailOpenPGP.openpgp.message.readArmored(attachmentData.substring(start.value, end.value)).then(encMessage => {
          let enc = {
            message: encMessage,
            passwords: [passwd],
            format: 'utf8'
          };

          return EnigmailOpenPGP.openpgp.decrypt(enc);
        })
        .then(msg => {
          EnigmailLog.DEBUG("autocrypt.jsm: handleBackupMessage: data: " + msg.data.length + "\n");

          let setupData = this.importSetupKey(msg.data);
          if (setupData) {
            EnigmailKeyEditor.setKeyTrust(null, "0x" + setupData.fpr, "5", function(returnCode) {
              if (returnCode === 0) {
                let id = EnigmailStdlib.getIdentityForEmail(EnigmailFuncs.stripEmail(fromAddr).toLowerCase());
                let ac = EnigmailFuncs.getAccountForIdentity(id.identity);
                ac.incomingServer.setBoolValue("enableAutocrypt", true);
                ac.incomingServer.setIntValue("acPreferEncrypt", (setupData.preferEncrypt === "mutual" ? 1 : 0));
                id.identity.setCharAttribute("pgpkeyId", "0x" + setupData.fpr);
                id.identity.setBoolAttribute("enablePgp", true);
                id.identity.setBoolAttribute("pgpSignEncrypted", true);
                id.identity.setBoolAttribute("pgpMimeMode", true);
                id.identity.setIntAttribute("pgpKeyMode", 1);
                resolve(setupData);
              } else {
                reject("keyImportFailed");
              }
            });
          } else {
            reject("keyImportFailed");
          }
        }).
      catch(err => {
        reject("wrongPasswd");
      });
    });
  },

  /**
   * Determine if a message id was self-created (only during same TB session)
   */
  isSelfCreatedSetupMessage: function(messageId) {
    return (gCreatedSetupIds.indexOf(messageId) >= 0);
  }
};
