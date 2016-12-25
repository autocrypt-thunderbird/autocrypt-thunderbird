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
Cu.import("resource://gre/modules/jsmime.jsm"); /*global jsmime: false*/
Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false*/
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false*/
Cu.import("resource://enigmail/mime.jsm"); /* global EnigmailMime: false*/
Cu.import("resource://enigmail/promise.jsm"); /*global Promise: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */

var EnigmailAutocrypt = {
  /**
   * Process the "Autocrypt:" header and if successful store the update in the database
   *
   * @param fromAddr:      String - Address of sender (From: header)
   * @param headerDataArr: Array of String: all instances of the Autocrypt: header found in the message
   * @param dateSent:      String - Date: field of the message
   */
  processAutocryptHeader: function(fromAddr, headerDataArr, dateSent) {
    EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: from=" + fromAddr + "\n");

    // critical parameters: {param: mandatory}
    const CRITICAL = {
      to: true,
      key: true,
      type: false,
      "prefer-encrypted": false
    };

    fromAddr = EnigmailFuncs.stripEmail(fromAddr).toLowerCase();
    let foundTypes = {};
    let paramArr = [];

    for (let hdrNum = 0; hdrNum < headerDataArr.length; hdrNum++) {
      paramArr = EnigmailMime.getAllParameters(headerDataArr[hdrNum]);

      for (let i in CRITICAL) {
        if (CRITICAL[i]) {
          // found mandatory parameter
          if (!(i in paramArr)) {
            EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: cannot find param " + i + "\n");
            return; // do nothing if not all mandatory parts are present
          }
        }
      }

      for (let i in paramArr) {
        if (i.substr(0, 1) !== "_") {
          if (!(i in CRITICAL)) {
            EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: unknown critical param " + i + "\n");
            return; // do nothing if an unknown critical parameter is found
          }
        }
      }

      if (fromAddr !== paramArr.to.toLowerCase()) {
        EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: from Addr " + fromAddr + " != " + paramArr.to.toLowerCase() + "\n");

        return;
      }

      if (!("type" in paramArr)) {
        paramArr.type = "p";
      }
      else {
        paramArr.type = paramArr.type.toLowerCase();
        if (paramArr.type !== "p") {
          EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: unknown type " + paramArr.type + "\n");
          return; // we currently only support p (=OpenPGP)
        }
      }

      try {
        let keyData = atob(paramArr.key);
      }
      catch (ex) {
        EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: key is not base64-encoded\n");
        return;
      }

      if (paramArr.type in foundTypes) {
        EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader: duplicate header for type=" + paramArr.type + "\n");
        return; // do not process anything if more than one Autocrypt header for the same type is found
      }

      foundTypes[paramArr.type] = 1;
    }

    if (!("prefer-encrypted" in paramArr)) {
      paramArr["prefer-encrypted"] = "?";
    }

    if ("_enigmail_artificial" in paramArr && paramArr.paramArr === "yes" && "_enigmail_fpr" in paramArr) {
      paramArr.fpr = paramArr._enigmail_fpr;
      paramArr.key = "";
    }

    let lastDate = jsmime.headerparser.parseDateHeader(dateSent);
    let now = new Date();
    if (lastDate > now) {
      lastDate = now;
    }
    paramArr.dateSent = lastDate;

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
      }
    ).then(
      function _f() {
        return findUserRecord(conn, fromAddr, paramArr.type);
      }
    ).then(
      function gotData(resultObj) {
        EnigmailLog.DEBUG("autocrypt.jsm: got " + resultObj.numRows + " rows\n");
        if (resultObj.data === null) {
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
      }
    ).catch(
      function _err(reason) {
        EnigmailLog.DEBUG("autocrypt.jsm: error - closing connection: " + reason + "\n");
        conn.close();
      }
    );
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

  let deferred = Promise.defer();

  connection.tableExists("autocrypt_keys").then(
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
 * Create the "autocrypt_keys" table and the corresponding index
 *
 * @param connection: Object - SQLite connection
 * @param deferred:   Promise
 */
function createAutocryptTable(connection, deferred) {
  EnigmailLog.DEBUG("autocrypt.jsm: createAutocryptTable\n");

  connection.execute("create table autocrypt_keys (" +
      "email text not null, " + // email address of correspondent
      "encryption_pref text not null, " + // encryption prefrence (yes / no / ?)
      "keydata text not null, " + // base64-encoded key as received
      "fpr text, " + // fingerprint of key (once key was imported in keyring)
      "type text not null, " + // key type (currently only OpenPGP)
      "last_changed text not null, " + // timestamp since when keydata and encryption_pref are unchanged
      "last_seen text not null);"). // timestamp of last mail received for the email/type combination
  then(
    function _ok() {
      EnigmailLog.DEBUG("autocrypt.jsm: createAutocryptTable - index\n");
      connection.execute("create unique index autocrypt_keys_i1 on autocrypt_keys(email, type)").
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
 * @param email:      String - Email address to search (in lowercase)
 * @param type:       String - type to search (in lowercase)
 *
 * @return Promise
 */
function findUserRecord(connection, email, type) {
  EnigmailLog.DEBUG("autocrypt.jsm: findUserRecord\n");

  let deferred = Promise.defer();
  let data = null;
  let numRows = 0;

  connection.execute(
    "select * from autocrypt_keys where email = :email and type = :type", {
      email: email,
      type: type
    },
    function _onRow(row) {
      EnigmailLog.DEBUG("autocrypt.jsm: findUserRecord - got row\n");
      if (numRows === 0) {
        data = row;
      }
      else {
        data = null;
      }
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

  let deferred = Promise.defer();

  connection.executeTransaction(function _trx() {
    connection.execute("insert into autocrypt_keys (email, encryption_pref, keydata, fpr, type, last_changed, last_seen) values " +
      "(:email, :pref, :keyData, :fpr, :type, :lastChange, :lastSeen)", {
        email: paramsArr.to,
        pref: paramsArr["prefer-encrypted"],
        keyData: paramsArr.key,
        fpr: ("fpr" in paramsArr ? paramsArr.fpr : ""),
        type: paramsArr.type,
        lastChange: paramsArr.dateSent.toJSON(),
        lastSeen: paramsArr.dateSent.toJSON()
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
 * @param currData:   Object (mozIStorageRow) - current data stored in the database
 *
 * @return Promise
 */
 function updateUser(connection, paramsArr, currData) {
  EnigmailLog.DEBUG("autocrypt.jsm: updateUser\n");

  let deferred = Promise.defer();

  let lastSeen = new Date(currData.getResultByName("last_seen"));
  let lastChanged = new Date(currData.getResultByName("last_changed"));

  if (lastSeen >= paramsArr.dateSent) {
    EnigmailLog.DEBUG("autocrypt.jsm: updateUser: not a new latest message\n");

    EnigmailTimer.setTimeout(function _f() {
      deferred.resolve();
    }, 0);
    return deferred.promise;
  }

  EnigmailLog.DEBUG("autocrypt.jsm: updateUser: updating latest message\n");

  let pref = currData.getResultByName("encryption_pref");
  if (pref !== "?" && paramsArr["prefer-encrypted"] === "?") {
    paramsArr["prefer-encrypted"] = pref;
  }

  if (paramsArr["prefer-encrypted"] !== pref ||
    currData.getResultByName("keydata") !== paramsArr.key) {
    lastChanged = paramsArr.dateSent;
  }

  connection.executeTransaction(function _trx() {
    connection.execute("update autocrypt_keys set encryption_pref = :pref, keydata = :keyData, last_changed = :lastChanged, " +
      "fpr = :fpr, last_seen = :lastSeen where email = :email and type = :type", {
        email: paramsArr.to,
        pref: paramsArr["prefer-encrypted"],
        keyData: paramsArr.key,
        fpr: ("fpr" in paramsArr ? paramsArr.fpr : ""),
        type: paramsArr.type,
        lastChanged: lastChanged.toJSON(),
        lastSeen: paramsArr.dateSent.toJSON()
      }).then(
      function _ok() {
        deferred.resolve();
      }
    ).catch(function _err() {
      deferred.reject("update failed");
    });
  });

  return deferred.promise;
}
