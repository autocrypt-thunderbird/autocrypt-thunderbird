/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for dealing with received Autocrypt headers, level 0
 *  See details at https://github.com/mailencrypt/autocrypt
 */

var EXPORTED_SYMBOLS = ["EnigmailAutocrypt"];

const Cr = Components.results;

Components.utils.importGlobalProperties(["crypto"]); /* global crypto: false */

const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailFuncs = ChromeUtils.import("chrome://enigmail/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailMime = ChromeUtils.import("chrome://enigmail/content/modules/mime.jsm").EnigmailMime;
const EnigmailSqliteDb = ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm").EnigmailSqliteDb;
const PromiseUtils = ChromeUtils.import("resource://gre/modules/PromiseUtils.jsm").PromiseUtils;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const EnigmailKey = ChromeUtils.import("chrome://enigmail/content/modules/key.jsm").EnigmailKey;
const EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailOpenPGP = ChromeUtils.import("chrome://enigmail/content/modules/openpgp.jsm").EnigmailOpenPGP;
const EnigmailRNG = ChromeUtils.import("chrome://enigmail/content/modules/rng.jsm").EnigmailRNG;
const EnigmailSend = ChromeUtils.import("chrome://enigmail/content/modules/send.jsm").EnigmailSend;
const EnigmailStreams = ChromeUtils.import("chrome://enigmail/content/modules/streams.jsm").EnigmailStreams;
const EnigmailArmor = ChromeUtils.import("chrome://enigmail/content/modules/armor.jsm").EnigmailArmor;
const EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailKeyEditor = ChromeUtils.import("chrome://enigmail/content/modules/keyEditor.jsm").EnigmailKeyEditor;
const EnigmailStdlib = ChromeUtils.import("chrome://enigmail/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;

var gCreatedSetupIds = [];

var EnigmailAutocrypt = {
  /**
   * Process the "Autocrypt:" header and if successful store the update in the database
   *
   * @param {String} fromAddr:               Address of sender (From: header)
   * @param {Array of String} headerDataArr: all instances of the Autocrypt: header found in the message
   * @param {String or Number} dateSent:     "Date:" field of the message as readable string or in seconds after 1970-01-01
   * @param {Boolean} autoCryptEnabled:      if true, autocrypt is enabled for the context of the message
   *
   * @return {Promise<Number>}: success: 0 = success, 1+ = failure
   */
  processAutocryptHeader: async function(fromAddr, headerDataArr, dateSent, autoCryptEnabled = false, isGossip = false) {
    EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader(): from=" + fromAddr + "\n");
    let conn;

    try {
      // critical parameters: {param: mandatory}
      const CRITICAL = {
        addr: true,
        keydata: true,
        type: false, // That's actually oboslete according to the Level 1 spec.
        "prefer-encrypt": false
      };

      try {
        fromAddr = EnigmailFuncs.stripEmail(fromAddr).toLowerCase();
      } catch (ex) {
        throw "processAutocryptHeader error " + ex;
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
              return 1; // do nothing if not all mandatory parts are present
            }
          }
        }

        for (let i in paramArr) {
          if (i.substr(0, 1) !== "_") {
            if (!(i in CRITICAL)) {
              EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: unknown critical param " + i + "\n");
              return 2; // do nothing if an unknown critical parameter is found
            }
          }
        }

        paramArr.addr = paramArr.addr.toLowerCase();

        if (fromAddr !== paramArr.addr) {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: from Addr " + fromAddr + " != " + paramArr.addr.toLowerCase() + "\n");

          return 3;
        }

        if (!("type" in paramArr)) {
          paramArr.type = (isGossip ? "1g" : "1");
        } else {
          paramArr.type = paramArr.type.toLowerCase();
          if (paramArr.type !== "1") {
            EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: unknown type " + paramArr.type + "\n");
            return 4; // we currently only support 1 (=OpenPGP)
          }
        }

        try {
          let keyData = atob(paramArr.keydata);
        } catch (ex) {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: key is not base64-encoded\n");
          return 5;
        }

        if (paramArr.type in foundTypes) {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: duplicate header for type=" + paramArr.type + "\n");
          return 6; // do not process anything if more than one Autocrypt header for the same type is found
        }

        foundTypes[paramArr.type] = 1;
      }

      if (isGossip) {
        paramArr["prefer-encrypt"] = "nopreference";
      }

      if (!("prefer-encrypt" in paramArr)) {
        paramArr["prefer-encrypt"] = "nopreference";
      }

      let lastDate;
      if (typeof dateSent === "string") {
        lastDate = jsmime.headerparser.parseDateHeader(dateSent);
      } else {
        lastDate = new Date(dateSent * 1000);
      }
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
      } else {
        paramArr.autocryptDate = lastDate;
      }

      try {
        conn = await EnigmailSqliteDb.openDatabase();
      } catch (ex) {
        EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: could not open database\n");
        return 7;
      }

      let resultObj = await findUserRecord(conn, [fromAddr], paramArr.type);
      EnigmailLog.DEBUG("autocrypt.jsm: got " + resultObj.numRows + " rows\n");
      if (resultObj.data.length === 0) {
        await appendUser(conn, paramArr);
      } else {
        await updateUser(conn, paramArr, resultObj.data, autoCryptEnabled);
      }

      EnigmailLog.DEBUG("autocrypt.jsm: OK - closing connection\n");
      conn.close();
      return 0;
    } catch (err) {
      EnigmailLog.DEBUG("autocrypt.jsm: error - closing connection: " + err + "\n");
      conn.close();
      return 8;
    }
  },

  /**
   * Find an autocrypt OpenPGP key for a given list of email addresses
   * @param emailAddr: Array of String - email addresses
   *
   * @return Promise(<Array of Object>)
   *      Object: {fpr, keyData, lastAutocrypt}
   */
  getOpenPGPKeyForEmail: function(emailAddr) {
    EnigmailLog.DEBUG("autocrypt.jsm: getOpenPGPKeyForEmail(" + emailAddr.join(",") + ")\n");

    let conn;

    return new Promise((resolve, reject) => {
      EnigmailSqliteDb.openDatabase().then(
        function onConnection(connection) {
          conn = connection;
          return findUserRecord(conn, emailAddr, "1,1g");
        },
        function onError(error) {
          EnigmailLog.DEBUG("autocrypt.jsm: getOpenPGPKeyForEmail: could not open database\n");
          reject("getOpenPGPKeyForEmail1 error " + error);
        }
      ).then(
        function gotData(resultObj) {
          EnigmailLog.DEBUG("autocrypt.jsm: getOpenPGPKeyForEmail got " + resultObj.numRows + " rows\n");
          conn.close();

          if (resultObj.data.length === 0) {
            resolve(null);
          } else {
            let retArr = [];
            for (let i in resultObj.data) {
              let record = resultObj.data[i];
              retArr.push({
                email: record.getResultByName("email"),
                fpr: record.getResultByName("fpr"),
                keyData: record.getResultByName("keydata"),
                state: record.getResultByName("state"),
                type: record.getResultByName("type"),
                lastAutocrypt: new Date(record.getResultByName("last_seen_autocrypt"))
              });
            }

            resolve(retArr);
          }
        }
      ).
      catch((err) => {
        conn.close();
        reject("getOpenPGPKeyForEmail: error " + err);
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

        let bkpCode = createBackupCode();
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

          let m = createBackupOuterMsg(identity.email, msgData);
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
    } else {
      keyObj = EnigmailKeyRing.getSecretKeyByUserId(emailAddr);
    }

    if (!keyObj) return false;
    if (!keyObj.secretAvailable) return false;

    let o = keyObj.getEncryptionValidity();
    if (!o.keyValid) return false;
    o = keyObj.getSigningValidity();
    if (!o.keyValid) return false;

    return true;
  },

  /**
   * Delete the record for a user from the autocrypt keystore
   * The record with the highest precedence is deleted (i.e. type=1 before type=1g)
   */
  deleteUser: async function(email, type) {
    EnigmailLog.DEBUG(`autocrypt.jsm: deleteUser(${email})\n`);
    let conn = await EnigmailSqliteDb.openDatabase();

    let updateStr = "delete from autocrypt_keydata where email = :email and type = :type";
    let updateObj = {
      email: email,
      type: type
    };

    await new Promise((resolve, reject) => {
      conn.executeTransaction(function _trx() {
        conn.execute(updateStr, updateObj).then(
          function _ok() {
            resolve();
          }
        ).catch(function _err() {
          reject("update failed");
        });
      });
    });
    EnigmailLog.DEBUG(" deletion complete\n");

    conn.close();
  }

};

/**
 * Find the database record for a given email address and type
 *
 * @param connection: Object - SQLite connection
 * @param emails      Array of String - Email addresses to search
 * @param type:       String - types to search (in lowercase), separated by comma
 *
 * @return {Promise<Object>}:
 *   numRows: number of results
 *   data:    array of RowObject. Query columns using data[i].getResultByName(columnName);
 */
async function findUserRecord(connection, emails, type) {
  EnigmailLog.DEBUG("autocrypt.jsm: findUserRecord\n");

  let data = [];
  let t = type.split(/[ ,]+/);

  let queryParam = {
    e0: emails[0],
    t0: t[0]
  };

  let numRows = 0;

  let search = ":e0";
  for (let i = 1; i < emails.length; i++) {
    search += ", :e" + i;
    queryParam["e" + i] = emails[i].toLowerCase();
  }

  let typeParam = ":t0";
  for (let i = 1; i < t.length; i++) {
    typeParam += ", :t" + i;
    queryParam["t" + i] = t[i];
  }

  try {
    await connection.execute(
      "select * from autocrypt_keydata where email in (" + search + ") and type in (" + typeParam + ") order by email, type", queryParam,
      function _onRow(row) {
        EnigmailLog.DEBUG("autocrypt.jsm: findUserRecord - got row\n");
        data.push(row);
        ++numRows;
      });
  } catch (x) {
    EnigmailLog.DEBUG(`autocrypt.jsm: findUserRecord: error ${x}\n`);
    throw x;
  }

  return {
    data: data,
    numRows: numRows
  };
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
async function updateUser(connection, paramsArr, resultRows, autoCryptEnabled) {
  EnigmailLog.DEBUG("autocrypt.jsm: updateUser\n");

  let currData = resultRows[0];
  let deferred = PromiseUtils.defer();

  let lastSeen = new Date(currData.getResultByName("last_seen"));
  let lastAutocrypt = new Date(currData.getResultByName("last_seen_autocrypt"));
  let notGossip = (currData.getResultByName("state") !== "gossip");
  let currentKeyData = currData.getResultByName("keydata");
  let isKeyInKeyring = (currData.getResultByName("keyring_inserted") === "1");

  if (lastSeen >= paramsArr.dateSent ||
    (paramsArr["prefer-encrypt"] === "gossip" && notGossip)) {
    EnigmailLog.DEBUG("autocrypt.jsm: updateUser: not a relevant new latest message\n");

    return;
  }

  EnigmailLog.DEBUG("autocrypt.jsm: updateUser: updating latest message\n");

  let updateStr;
  let updateObj;

  if (paramsArr.autocryptDate > 0) {
    lastAutocrypt = paramsArr.autocryptDate;
    if (!("fpr" in paramsArr)) {
      getFprForKey(paramsArr);
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
  } else {
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

  await new Promise((resolve, reject) => {
    connection.executeTransaction(function _trx() {
      connection.execute(updateStr, updateObj).then(
        function _ok() {
          resolve();
        }
      ).catch(function _err() {
        reject("update failed");
      });
    });
  });

  return;
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
  } catch (x) {}
}


/**
 * Create the 9x4 digits backup code as defined in the Autocrypt spec
 *
 * @return String: xxxx-xxxx-...
 */

function createBackupCode() {
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

