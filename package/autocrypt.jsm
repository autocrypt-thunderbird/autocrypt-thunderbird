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
Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false*/
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false*/
Cu.import("resource://enigmail/mime.jsm"); /* global EnigmailMime: false*/
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */
Cu.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/openpgp.jsm"); /*global EnigmailOpenPGP: false */

var EnigmailAutocrypt = {
  /**
   * Process the "Autocrypt:" header and if successful store the update in the database
   *
   * @param fromAddr:      String - Address of sender (From: header)
   * @param headerDataArr: Array of String: all instances of the Autocrypt: header found in the message
   * @param dateSent:      String - Date: field of the message
   *
   * @return Promise (success) - success: Number (0 = success, 1+ = failure)
   */
  processAutocryptHeader: function(fromAddr, headerDataArr, dateSent) {
    EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader(): from=" + fromAddr + "\n");

    return new Promise((resolve, reject) => {
      // critical parameters: {param: mandatory}
      const CRITICAL = {
        addr: true,
        keydata: true,
        type: false,
        "prefer-encrypt": false
      };

      fromAddr = EnigmailFuncs.stripEmail(fromAddr).toLowerCase();
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

        if (fromAddr !== paramArr.addr.toLowerCase()) {
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
            return updateUser(conn, paramArr, resultObj.data);
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

                let pubkey = EnigmailOpenPGP.enigmailFuncs.bytesToArmor(EnigmailOpenPGP.enums.armor.public_key, keyData);
                EnigmailKeyRing.importKey(null, false, pubkey, keyArr[i].fpr, {}, keysObj);

                if (keysObj.value) {
                  importedKeys = importedKeys.concat(keysObj.value);
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
    EnigmailLog.DEBUG("autocrypt.jsm: getKeyForEmail(" + emailAddr.join(",") + ")\n");

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
          EnigmailLog.DEBUG("autocrypt.jsm: getKeyForEmail: could not open database\n");
          reject("error");
        }
      ).then(
        function _f() {
          return findUserRecord(conn, emailAddr, "1");
        }
      ).then(
        function gotData(resultObj) {
          EnigmailLog.DEBUG("autocrypt.jsm: getKeyForEmail got " + resultObj.numRows + " rows\n");
          if (resultObj.data.length === 0) {
            resolve(null);
          }
          else {
            let retArr = [];
            for (let i in resultObj.data) {
              let record = resultObj.data[i];
              retArr.push({
                fpr: record.getResultByName("fpr"),
                keyData: record.getResultByName("keydata"),
                lastAutocrypt: new Date(record.getResultByName("last_seen_autocrypt"))
              });
            }

            resolve(retArr);
          }
          conn.close();
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
   * @return String - complete setup message
   */
  createSetupMessage: function(identity) {
    //let keyData = EnigmailKeyRing.extractKey(true, keyId, null, {}, {});
    // complete me
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
  EnigmailLog.DEBUG("autocrypt.jsm: appendUser\n");

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
        email: paramsArr.addr,
        keyData: paramsArr.keydata,
        fpr: ("fpr" in paramsArr ? paramsArr.fpr : ""),
        type: paramsArr.type,
        lastAutocrypt: paramsArr.dateSent.toJSON(),
        lastSeen: paramsArr.dateSent.toJSON(),
        state: paramsArr["prefer-encrypt"]
      }).then(
      function _ok() {
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
 *
 * @return Promise
 */
function updateUser(connection, paramsArr, resultRows) {
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

    updateStr = "update autocrypt_keydata set state = :state, keydata = :keyData, last_seen_autocrypt = :lastAutocrypt, " +
      "fpr = :fpr, last_seen = :lastSeen where email = :email and type = :type";
    updateObj = {
      email: paramsArr.addr,
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
      email: paramsArr.addr,
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
