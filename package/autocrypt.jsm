/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for dealing with received Autocrypt headers, level 0
 *  See details at https://github.com/mailencrypt/autocrypt
 */

var EXPORTED_SYMBOLS = ["EnigmailAutocrypt"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Sqlite.jsm"); /* global Sqlite: false */
Cu.import("resource:///modules/jsmime.jsm"); /*global jsmime: false*/
Cu.import("chrome://enigmail/content/modules/core.jsm"); /*global EnigmailCore: false */
Cu.import("chrome://enigmail/content/modules/log.jsm"); /* global EnigmailLog: false*/
Cu.import("chrome://enigmail/content/modules/locale.jsm"); /* global EnigmailLocale: false*/
Cu.import("chrome://enigmail/content/modules/funcs.jsm"); /* global EnigmailFuncs: false*/
Cu.import("chrome://enigmail/content/modules/mime.jsm"); /* global EnigmailMime: false*/
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("chrome://enigmail/content/modules/timer.jsm"); /*global EnigmailTimer: false */
Cu.import("chrome://enigmail/content/modules/key.jsm"); /*global EnigmailKey: false */
Cu.import("chrome://enigmail/content/modules/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("chrome://enigmail/content/modules/openpgp.jsm"); /*global EnigmailOpenPGP: false */
Cu.import("chrome://enigmail/content/modules/mime.jsm"); /*global EnigmailMime: false */
Cu.import("chrome://enigmail/content/modules/rng.jsm"); /*global EnigmailRNG: false */
Cu.import("chrome://enigmail/content/modules/send.jsm"); /*global EnigmailSend: false */
Cu.import("chrome://enigmail/content/modules/streams.jsm"); /*global EnigmailStreams: false */
Cu.import("chrome://enigmail/content/modules/armor.jsm"); /*global EnigmailArmor: false */
Cu.import("chrome://enigmail/content/modules/data.jsm"); /*global EnigmailData: false */
Cu.import("chrome://enigmail/content/modules/rules.jsm"); /*global EnigmailRules: false */
Cu.import("chrome://enigmail/content/modules/keyEditor.jsm"); /*global EnigmailKeyEditor: false */
Cu.import("chrome://enigmail/content/modules/stdlib.jsm"); /*global EnigmailStdlib: false */
Cu.import("chrome://enigmail/content/modules/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("chrome://enigmail/content/modules/constants.jsm"); /*global EnigmailConstants: false */

var gCreatedSetupIds = [];

var EnigmailAutocrypt = {
  /**
   * Process the "Autocrypt:" header and if successful store the update in the database
   *
   * @param fromAddr:      String - Address of sender (From: header)
   * @param headerDataArr: Array of String: all instances of the Autocrypt: header found in the message
   * @param dateSent:      String - Date: field of the message
   * @param autoCryptEnabled: Boolean - if true, autocrypt is enabled for the context of the message
   *
   * @return Promise (success) - success: Number (0 = success, 1+ = failure)
   */
  processAutocryptHeader: function(fromAddr, headerDataArr, dateSent, autoCryptEnabled = false) {
    EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader(): from=" + fromAddr + "\n");

    return new Promise((resolve, reject) => {
      // critical parameters: {param: mandatory}
      const CRITICAL = {
        addr: true,
        keydata: true,
        type: false, // That's actually oboslete according to the Level 1 spec.
        "prefer-encrypt": false
      };

      try {
        fromAddr = EnigmailFuncs.stripEmail(fromAddr).toLowerCase();
      }
      catch (ex) {
        reject("error");
      }
      let foundTypes = {};
      let paramArr = [];

      for (let hdrNum = 0; hdrNum < headerDataArr.length; hdrNum++) {

        let hdr = headerDataArr[hdrNum].replace(/[\r\n \t]/g, "");
        let k = hdr.search(/keydata=/);
        if (k > 0) {
          let d = hdr.substr(k);
          if (d.search(/"/) < 0) {
            hdr = hdr.replace(/keydata=/, 'keydata="') + '"';
          }
        }

        paramArr = EnigmailMime.getAllParameters(hdr);

        for (let i in CRITICAL) {
          if (CRITICAL[i]) {
            // found mandatory parameter
            if (!(i in paramArr)) {
              EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: cannot find param '" + i + "'\n");
              resolve(1);
              return; // do nothing if not all mandatory parts are present
            }
          }
        }

        for (let i in paramArr) {
          if (i.substr(0, 1) !== "_") {
            if (!(i in CRITICAL)) {
              EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: unknown critical param " + i + "\n");
              resolve(2);
              return; // do nothing if an unknown critical parameter is found
            }
          }
        }

        paramArr.addr = paramArr.addr.toLowerCase();

        if (fromAddr !== paramArr.addr) {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: from Addr " + fromAddr + " != " + paramArr.addr.toLowerCase() + "\n");

          resolve(3);
          return;
        }

        if (!("type" in paramArr)) {
          paramArr.type = "1";
        }
        else {
          paramArr.type = paramArr.type.toLowerCase();
          if (paramArr.type !== "1") {
            EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: unknown type " + paramArr.type + "\n");
            resolve(4);
            return; // we currently only support 1 (=OpenPGP)
          }
        }

        try {
          let keyData = atob(paramArr.keydata);
        }
        catch (ex) {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: key is not base64-encoded\n");
          resolve(5);
          return;
        }

        if (paramArr.type in foundTypes) {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: duplicate header for type=" + paramArr.type + "\n");
          resolve(6);
          return; // do not process anything if more than one Autocrypt header for the same type is found
        }

        foundTypes[paramArr.type] = 1;
      }

      if (!("prefer-encrypt" in paramArr)) {
        paramArr["prefer-encrypt"] = "nopreference";
      }

      let lastDate = jsmime.headerparser.parseDateHeader(dateSent);
      let now = new Date();
      if (lastDate > now) {
        lastDate = now;
      }
      paramArr.dateSent = lastDate;

      if (("_enigmail_artificial" in paramArr) && (paramArr._enigmail_artificial === "yes")) {
        if ("_enigmail_fpr" in paramArr) {
          paramArr.fpr = paramArr._enigmail_fpr;
        }

        paramArr.keydata = "";
        paramArr.autocryptDate = 0;
      }
      else {
        paramArr.autocryptDate = lastDate;
      }


      let conn;

      Sqlite.openConnection({
        path: "enigmail.sqlite",
        sharedMemoryCache: false
      }).then(
        function onConnection(connection) {
          conn = connection;
          return checkDatabaseStructure(conn);
        },
        function onError(error) {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: could not open database\n");
          resolve(7);
        }
      ).then(
        function _f() {
          return findUserRecord(conn, [fromAddr], paramArr.type);
        }
      ).then(
        function gotData(resultObj) {
          EnigmailLog.DEBUG("autocrypt.jsm: got " + resultObj.numRows + " rows\n");
          if (resultObj.data.length === 0) {
            return appendUser(conn, paramArr);
          }
          else {
            return updateUser(conn, paramArr, resultObj.data, autoCryptEnabled);
          }
        }
      ).then(
        function _done() {
          EnigmailLog.DEBUG("autocrypt.jsm: OK - closing connection\n");
          conn.close();
          resolve(0);
        }
      ).catch(
        function _err(reason) {
          EnigmailLog.DEBUG("autocrypt.jsm: error - closing connection: " + reason + "\n");
          conn.close();
          resolve(8);
        }
      );
    });
  },

  /**
   * Import autocrypt OpenPGP keys for a given list of email addresses
   * @param emailAddr: Array of String - emai addresses
   *
   * @return Promise().resolve { }
   */
  importAutocryptKeys: function(emailAddr) {
    EnigmailLog.DEBUG("autocrypt.jsm importAutocryptKeys()\n");

    return new Promise((resolve, reject) => {
      this.getOpenPGPKeyForEmail(emailAddr).
      then(keyArr => {
        let importedKeys = [];
        let now = new Date();

        for (let i in keyArr) {
          if ((now - keyArr[i].lastAutocrypt) / (1000 * 60 * 60 * 24) < 366) {
            // only import keys received less than 12 months ago
            try {
              let keyData = atob(keyArr[i].keyData);
              if (keyData.length > 1) {
                let keysObj = {};

                let pubkey = EnigmailOpenPGP.enigmailFuncs.bytesToArmor(EnigmailOpenPGP.openpgp.enums.armor.public_key, keyData);
                EnigmailKeyRing.importKey(null, false, pubkey, keyArr[i].fpr, {}, keysObj);

                if (keysObj.value) {
                  importedKeys = importedKeys.concat(keysObj.value);

                  if (keysObj.value.length > 0) {
                    let key = EnigmailKeyRing.getKeyById(keysObj.value[0]);

                    // enable encryption if state (prefer-encrypt) is "mutual";
                    // otherwise, disable it explicitely
                    let signEncrypt = (keyArr[i].state === "mutual" ? 1 : 0);

                    if (key && key.fpr) {
                      let ruleObj = {
                        email: "{" + EnigmailConstants.AC_RULE_PREFIX + keyArr[i].email + "}",
                        keyList: "0x" + key.fpr,
                        sign: signEncrypt,
                        encrypt: signEncrypt,
                        pgpMime: 2,
                        flags: 0
                      };

                      EnigmailRules.insertOrUpdateRule(ruleObj);
                    }
                  }
                }
              }
            }
            catch (ex) {
              EnigmailLog.DEBUG("autocrypt.jsm importAutocryptKeys: exception " + ex.toString() + "\n");
            }
          }
        }

        resolve(importedKeys);
      });
    });
  },

  /**
   * Find an autocrypt OpenPGP key for a given list of email addresses
   * @param emailAddr: Array of String - emai addresses
   *
   * @return Promise().resolve { fpr, keyData, lastAutocrypt}
   */
  getOpenPGPKeyForEmail: function(emailAddr) {
    EnigmailLog.DEBUG("autocrypt.jsm: getOpenPGPKeyForEmail(" + emailAddr.join(",") + ")\n");

    let conn;

    return new Promise((resolve, reject) => {
      Sqlite.openConnection({
        path: "enigmail.sqlite",
        sharedMemoryCache: false
      }).then(
        function onConnection(connection) {
          conn = connection;
          return checkDatabaseStructure(conn);
        },
        function onError(error) {
          EnigmailLog.DEBUG("autocrypt.jsm: getOpenPGPKeyForEmail: could not open database\n");
          reject("error");
        }
      ).then(
        function _f() {
          return findUserRecord(conn, emailAddr, "1");
        }
      ).then(
        function gotData(resultObj) {
          EnigmailLog.DEBUG("autocrypt.jsm: getOpenPGPKeyForEmail got " + resultObj.numRows + " rows\n");
          conn.close();

          if (resultObj.data.length === 0) {
            resolve(null);
          }
          else {
            let retArr = [];
            for (let i in resultObj.data) {
              let record = resultObj.data[i];
              retArr.push({
                email: record.getResultByName("email"),
                fpr: record.getResultByName("fpr"),
                keyData: record.getResultByName("keydata"),
                state: record.getResultByName("state"),
                lastAutocrypt: new Date(record.getResultByName("last_seen_autocrypt"))
              });
            }

            resolve(retArr);
          }
        }
      ).
      catch((err) => {
        conn.close();
        reject("error");
      });
    });
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

      if (!EnigmailCore.getService(null, false)) {
        reject(0);
        return;
      }

      if (identity.getIntAttribute("pgpKeyMode") === 1) {
        keyId = identity.getCharAttribute("pgpkeyId");
      }

      if (keyId.length > 0) {
        key = EnigmailKeyRing.getKeyById(keyId);
      }
      else {
        key = EnigmailKeyRing.getSecretKeyByUserId(identity.email);
      }

      if (!key) {
        EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage: no key found for " + identity.email + "\n");
        reject(1);
        return;
      }

      let keyData = EnigmailKeyRing.extractSecretKey(true, "0x" + key.fpr, {}, {});

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

      let bkpCode = createBackupCode();
      let enc = {
        data: innerMsg,
        passwords: bkpCode,
        armor: true
      };

      // create symmetrically encrypted message
      EnigmailOpenPGP.openpgp.encrypt(enc).then(msg => {
        let msgData = EnigmailArmor.replaceArmorHeaders(msg.data, {
          'Passphrase-Format': 'numeric9x4',
          'Passphrase-Begin': bkpCode.substr(0, 2)
        }).replace(/\n/g, "\r\n");

        let m = createBackupOuterMsg(identity.email, msgData);
        resolve({
          msg: m,
          passwd: bkpCode
        });
      }).catch(e => {
        EnigmailLog.DEBUG("autocrypt.jsm: createSetupMessage: error " + e + "\n");
        reject(2);
      });
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
        }
        else {
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
        }
        else {
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

      let encMessage = EnigmailOpenPGP.openpgp.message.readArmored(attachmentData.substring(start.value, end.value));

      let enc = {
        message: encMessage,
        passwords: [passwd],
        format: 'utf8'
      };

      EnigmailOpenPGP.openpgp.decrypt(enc).then(msg => {
        EnigmailLog.DEBUG("autocrypt.jsm: handleBackupMessage: data: " + msg.data.length + "\n");

        let setupData = importSetupKey(msg.data);
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
              EnigmailPrefs.setPref("juniorMode", 1);
              resolve(setupData);
            }
            else {
              reject("keyImportFailed");
            }
          });
        }
        else {
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
  },

  /**
   * Check if an account is set up with OpenPGP and if the configured key is valid
   *
   * @param emailAddr: String - email address identifying the account
   *
   * @return Boolean: true: account is valid / false: OpenPGP not configured or key not valid
   */
  isAccountSetupForPgp: function(emailAddr) {
    let id = EnigmailStdlib.getIdentityForEmail(EnigmailFuncs.stripEmail(emailAddr).toLowerCase());
    let keyObj = null;

    if (!(id && id.identity)) return false;
    if (!id.identity.getBoolAttribute("enablePgp")) return false;

    if (id.identity.getIntAttribute("pgpKeyMode") === 1) {
      keyObj = EnigmailKeyRing.getKeyById(id.identity.getCharAttribute("pgpkeyId"));
    }
    else {
      keyObj = EnigmailKeyRing.getSecretKeyByUserId(emailAddr);
    }

    if (!keyObj) return false;
    if (!keyObj.secretAvailable) return false;

    let o = keyObj.getEncryptionValidity();
    if (!o.keyValid) return false;
    o = keyObj.getSigningValidity();
    if (!o.keyValid) return false;

    return true;
  }
};

/**
 * Ensure that the database structure matches the latest version
 * (table is available)
 *
 * @param connection: Object - SQLite connection
 *
 * @return Promise
 */
function checkDatabaseStructure(connection) {
  EnigmailLog.DEBUG("autocrypt.jsm: checkDatabaseStructure\n");

  let deferred = PromiseUtils.defer();

  connection.tableExists("autocrypt_keydata").then(
    function onSuccess(exists) {
      EnigmailLog.DEBUG("autocrypt.jsm: checkDatabaseStructure - success\n");
      if (!exists) {
        createAutocryptTable(connection, deferred);
      }
      else {
        deferred.resolve();
      }
    },
    function onError(error) {
      EnigmailLog.DEBUG("autocrypt.jsm: checkDatabaseStructure - error\n");
      deferred.reject(error);
    }
  );

  return deferred.promise;
}

/**
 * Create the "autocrypt_keydata" table and the corresponding index
 *
 * @param connection: Object - SQLite connection
 * @param deferred:   Promise
 */
function createAutocryptTable(connection, deferred) {
  EnigmailLog.DEBUG("autocrypt.jsm: createAutocryptTable\n");

  connection.execute("create table autocrypt_keydata (" +
      "email text not null, " + // email address of correspondent
      "keydata text not null, " + // base64-encoded key as received
      "fpr text, " + // fingerprint of key
      "type text not null, " + // key type (currently only 1==OpenPGP)
      "last_seen_autocrypt text, " +
      "last_seen text not null, " +
      "state text not null);"). // timestamp of last mail received for the email/type combination
  then(
    function _ok() {
      EnigmailLog.DEBUG("autocrypt.jsm: createAutocryptTable - index\n");
      connection.execute("create unique index autocrypt_keydata_i1 on autocrypt_keydata(email, type)").
      then(function _f() {
        deferred.resolve();
      });
    }
  );
}

/**
 * Find the database record for a given email address and type
 *
 * @param connection: Object - SQLite connection
 * @param emails      Array of String - Email addresses to search
 * @param type:       String - type to search (in lowercase)
 *
 * @return Promise
 */
function findUserRecord(connection, emails, type) {
  EnigmailLog.DEBUG("autocrypt.jsm: findUserRecord\n");

  let deferred = PromiseUtils.defer();
  let data = [];
  let queryParam = {
    type: type,
    e0: emails[0]
  };

  let numRows = 0;

  let search = ":e0";
  for (let i = 1; i < emails.length; i++) {
    search += ", :e" + i;
    queryParam["e" + i] = emails[i].toLowerCase();
  }

  connection.execute(
    "select * from autocrypt_keydata where email in (" + search + ") and type = :type", queryParam,
    function _onRow(row) {
      EnigmailLog.DEBUG("autocrypt.jsm: findUserRecord - got row\n");
      data.push(row);
      ++numRows;
    }
  ).then(function _f() {
    deferred.resolve({
      data: data,
      numRows: numRows
    });
  });

  return deferred.promise;
}

/**
 * Create new database record for an Autorypt header
 *
 * @param connection: Object - SQLite connection
 * @param paramsArr:  Object - the Autocrypt header parameters
 *
 * @return Promise
 */
function appendUser(connection, paramsArr) {
  EnigmailLog.DEBUG("autocrypt.jsm: appendUser(" + paramsArr.addr + ")\n");

  let deferred = PromiseUtils.defer();

  if (!("fpr" in paramsArr)) {
    getFprForKey(paramsArr);
  }

  if (paramsArr.autocryptDate == 0) {
    // do not insert record for non-autocrypt mail
    deferred.resolve();
    return deferred.promise;
  }

  connection.executeTransaction(function _trx() {
    connection.execute("insert into autocrypt_keydata (email, keydata, fpr, type, last_seen_autocrypt, last_seen, state) values " +
      "(:email, :keyData, :fpr, :type, :lastAutocrypt, :lastSeen, :state)", {
        email: paramsArr.addr.toLowerCase(),
        keyData: paramsArr.keydata,
        fpr: ("fpr" in paramsArr ? paramsArr.fpr : ""),
        type: paramsArr.type,
        lastAutocrypt: paramsArr.dateSent.toJSON(),
        lastSeen: paramsArr.dateSent.toJSON(),
        state: paramsArr["prefer-encrypt"]
      }).then(
      function _ok() {
        EnigmailLog.DEBUG("autocrypt.jsm: appendUser - OK\n");
        deferred.resolve();
      }
    ).catch(function _err() {
      deferred.reject("appendUser");
    });
  });

  return deferred.promise;
}

/**
 * Update the record for an email address and type, if the email we got is newer
 * than the latest record we already stored
 *
 * @param connection: Object - SQLite connection
 * @param paramsArr:  Object - the Autocrypt header parameters
 * @param resultRows: Array of mozIStorageRow - records stored in the database
 * @param autoCryptEnabled: Boolean: is autocrypt enabled for this transaction
 *
 * @return Promise
 */
function updateUser(connection, paramsArr, resultRows, autoCryptEnabled) {
  EnigmailLog.DEBUG("autocrypt.jsm: updateUser\n");

  let currData = resultRows[0];
  let deferred = PromiseUtils.defer();

  let lastSeen = new Date(currData.getResultByName("last_seen"));
  let lastAutocrypt = new Date(currData.getResultByName("last_seen_autocrypt"));

  if (lastSeen >= paramsArr.dateSent) {
    EnigmailLog.DEBUG("autocrypt.jsm: updateUser: not a new latest message\n");

    EnigmailTimer.setTimeout(function _f() {
      deferred.resolve();
    }, 0);
    return deferred.promise;
  }

  EnigmailLog.DEBUG("autocrypt.jsm: updateUser: updating latest message\n");

  let updateStr;
  let updateObj;

  if (paramsArr.autocryptDate > 0) {
    lastAutocrypt = paramsArr.autocryptDate;
    if (!("fpr" in paramsArr)) {
      getFprForKey(paramsArr);
    }

    if (autoCryptEnabled) {
      updateRuleForEmail(paramsArr.addr, paramsArr["prefer-encrypt"]);
    }

    updateStr = "update autocrypt_keydata set state = :state, keydata = :keyData, last_seen_autocrypt = :lastAutocrypt, " +
      "fpr = :fpr, last_seen = :lastSeen where email = :email and type = :type";
    updateObj = {
      email: paramsArr.addr.toLowerCase(),
      state: paramsArr["prefer-encrypt"],
      keyData: paramsArr.keydata,
      fpr: ("fpr" in paramsArr ? paramsArr.fpr : ""),
      type: paramsArr.type,
      lastAutocrypt: lastAutocrypt.toJSON(),
      lastSeen: paramsArr.dateSent.toJSON()
    };
  }
  else {
    updateStr = "update autocrypt_keydata set state = :state, last_seen = :lastSeen where email = :email and type = :type";
    updateObj = {
      email: paramsArr.addr.toLowerCase(),
      state: paramsArr["prefer-encrypt"],
      type: paramsArr.type,
      lastSeen: paramsArr.dateSent.toJSON()
    };
  }

  if (!("fpr" in paramsArr)) {
    getFprForKey(paramsArr);
  }

  connection.executeTransaction(function _trx() {
    connection.execute(updateStr, updateObj).then(
      function _ok() {
        deferred.resolve();
      }
    ).catch(function _err() {
      deferred.reject("update failed");
    });
  });

  return deferred.promise;
}

/**
 * Set the fpr attribute for a given key parameter object
 */
function getFprForKey(paramsArr) {
  try {
    let keyData = atob(paramsArr.keydata);
    let err = {};
    let keyInfo = EnigmailKey.getKeyListFromKeyBlock(keyData, err, false);
    if (keyInfo.length === 1) {
      paramsArr.fpr = keyInfo[0].fpr;
    }
  }
  catch (x) {}
}


/**
 * Create the 9x4 digits backup code as defined in the Autocrypt spec
 *
 * @return String: xxxx-xxxx-...
 */

function createBackupCode() {
  let bkpCode = "";
  let crypto = EnigmailOpenPGP.enigmailFuncs.getCrypto();

  for (let i = 0; i < 9; i++) {
    if (i > 0) bkpCode += "-";

    let a = new Uint8Array(4);
    crypto.getRandomValues(a);
    for (let j = 0; j < 4; j++) {
      bkpCode += String(a[j] % 10);
    }
  }
  return bkpCode;
}


function createBackupOuterMsg(toEmail, encryptedMsg) {

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
}


/**
 * @return Object:
 *          fpr:           String - FPR of the imported key
 *          preferEncrypt: String - Autocrypt preferEncrypt value (e.g. mutual)
 */
function importSetupKey(keyData) {

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
}


function updateRuleForEmail(email, preferEncrypt) {
  let node = EnigmailRules.getRuleByEmail(EnigmailConstants.AC_RULE_PREFIX + email);

  if (node) {
    let signEncrypt = (preferEncrypt === "mutual" ? "1" : "0");

    if (node.getAttribute("sign") !== signEncrypt ||
      node.getAttribute("encrypt") !== signEncrypt) {

      node.setAttribute("sign", signEncrypt);
      node.setAttribute("encrypt", signEncrypt);
      EnigmailRules.saveRulesFile();
    }
  }
}
