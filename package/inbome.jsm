/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for dealing with received INBOME headers, level 0
 *  See details at https://github.com/mailencrypt/inbome
 */

var EXPORTED_SYMBOLS = ["EnigmailInbome"];

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

var EnigmailInbome = {
  processInbomeHeader: function(fromAddr, headerData, dateSent) {
    EnigmailLog.DEBUG("inbome.jsm: processInbomeHeader: from=" + fromAddr + "\n");

    const MANDATORY = ["to", "key"];
    const CRITICAL = ["type", "prefer-encrypted", "to", "key"];

    fromAddr = EnigmailFuncs.stripEmail(fromAddr).toLowerCase();

    let paramArr = EnigmailMime.getAllParameters(headerData);

    for (let i = 0; i < MANDATORY.length; i++) {
      if (!(MANDATORY[i] in paramArr)) return; // do nothing if not all mandatory parts are present
    }

    for (let i = 0; i < paramArr.length; i++) {
      if (paramArr[i].substr(0, 1) !== "_") {
        if (!(paramArr[i] in CRITICAL)) return; // do nothing if an unknown critical parameter is found
      }
    }

    if (fromAddr !== paramArr.to.toLowerCase()) return;

    if (!("type" in paramArr)) {
      paramArr.type = "p";
    }
    else {
      paramArr.type = paramArr.type.toLowerCase();
      if (paramArr.type !== "p") return; // we currently only support p (=OpenPGP)
    }

    if (!("prefer-encrypted" in paramArr)) {
      paramArr["prefer-encrypted"] = "?";
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
        EnigmailLog.DEBUG("inbome.jsm: could not open database\n");
      }
    ).then(
      function _f() {
        return findLastUpdate(conn, fromAddr, paramArr.type);
      }
    ).then(
      function gotData(resultObj) {
        EnigmailLog.DEBUG("inbome.jsm: got " + resultObj.numRows + " rows\n");
        if (resultObj.data === null) {
          return appendUser(conn, paramArr);
        }
        else {
          return updateUser(conn, paramArr, resultObj.data);
        }
      }
    ).then(
      function _done() {
        EnigmailLog.DEBUG("inbome.jsm: OK - closing connection\n");
        conn.close();
      }
    ).catch(
      function _err() {
        EnigmailLog.DEBUG("inbome.jsm: error - closing connection\n");
        conn.close();
      }
    );
  }
};


/**
 * Ensure that the database structure matches the latest version
 */
function checkDatabaseStructure(connection) {
  EnigmailLog.DEBUG("inbome.jsm: checkDatabaseStructure\n");

  let deferred = Promise.defer();

  connection.tableExists("inbome_keys").then(
    function onSuccess(exists) {
      EnigmailLog.DEBUG("inbome.jsm: checkDatabaseStructure - success\n");
      if (!exists) {
        createInbomeTable(connection, deferred);
      }
      else {
        deferred.resolve();
      }
    },
    function onError(error) {
      EnigmailLog.DEBUG("inbome.jsm: checkDatabaseStructure - error\n");
      deferred.reject(error);
    }
  );

  return deferred.promise;
}

/**
 * Ensure that the database structure matches the latest version
 */
function createInbomeTable(connection, deferred) {
  EnigmailLog.DEBUG("inbome.jsm: createInbomeTable\n");

  connection.execute("create table inbome_keys (" +
      "email text not null, " + // email address of correspondent
      "encryption_pref text not null, " + // encryption prefrence (yes / no / ?)
      "keydata text not null, " + // base64-encoded key as received
      "fpr text, " + // fingerprint of key (once key was imported in keyring)
      "type text not null, " + // key type (currently only OpenPGP)
      "last_changed text not null, " + // timestamp since when keydata and encryption_pref are unchanged
      "last_seen text not null);"). // timestamp of last mail received for the email/type combination
  then(
    function _ok() {
      EnigmailLog.DEBUG("inbome.jsm: createInbomeTable - index\n");
      connection.execute("create unique index inbome_keys_i1 on inbome_keys(email, type)").
      then(function _f() {
        deferred.resolve();
      });
    }
  );
}

function findLastUpdate(connection, email, type) {
  EnigmailLog.DEBUG("inbome.jsm: findLastUpdate\n");

  let deferred = Promise.defer();
  let data = null;
  let numRows = 0;

  connection.execute(
    "select * from inbome_keys where email = :email and type = :type", {
      email: email,
      type: type
    },
    function _onRow(row) {
      EnigmailLog.DEBUG("inbome.jsm: findLastUpdate - got row\n");
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


function appendUser(connection, paramsArr) {
  EnigmailLog.DEBUG("inbome.jsm: appendUser\n");

  let deferred = Promise.defer();

  connection.executeTransaction(function _trx() {
    connection.execute("insert into inbome_keys (email, encryption_pref, keydata, type, last_changed, last_seen) values " +
      "(:email, :pref, :keyData, :type, :lastChange, :lastSeen)", {
        email: paramsArr.to,
        pref: paramsArr["prefer-encrypted"],
        keyData: paramsArr.key,
        type: paramsArr.type,
        lastChange: paramsArr.dateSent.toJSON(),
        lastSeen: paramsArr.dateSent.toJSON()
      }).then(
      function _ok() {
        deferred.resolve();
      }
    ).catch(function _err() {
      deferred.reject();
    });
  });

  return deferred.promise;
}

function updateUser(connection, paramsArr, currData) {
  EnigmailLog.DEBUG("inbome.jsm: updateUser\n");

  let deferred = Promise.defer();

  let lastSeen = new Date(currData.getResultByName("last_seen"));
  let lastChanged = new Date(currData.getResultByName("last_changed"));

  if (lastSeen >= paramsArr.dateSent) {
    EnigmailLog.DEBUG("inbome.jsm: updateUser: not a new latest message\n");

    EnigmailTimer.setTimeout(0, function _f() {
      deferred.resolve();
    });
    return deferred.promise;
  }

  EnigmailLog.DEBUG("inbome.jsm: updateUser: updating latest message\n");

  let pref = currData.getResultByName("encryption_pref");
  if (pref !== "?" && paramsArr["prefer-encrypted"] === "?") {
    paramsArr["prefer-encrypted"] = pref;
  }

  if (paramsArr["prefer-encrypted"] !== pref ||
      currData.getResultByName("keydata") !== paramsArr.key) {
    lastChanged = paramsArr.dateSent;
  }

  connection.executeTransaction(function _trx() {
    connection.execute("update inbome_keys set encryption_pref = :pref, keydata = :keyData, last_changed = :lastChanged, " +
      "last_seen = :lastSeen where email = :email and type = :type", {
        email: paramsArr.to,
        pref: paramsArr["prefer-encrypted"],
        keyData: paramsArr.key,
        type: paramsArr.type,
        lastChanged: lastChanged.toJSON(),
        lastSeen: paramsArr.dateSent.toJSON()
      }).then(
      function _ok() {
        deferred.resolve();
      }
    ).catch(function _err() {
      deferred.reject();
    });
  });

  return deferred.promise;
}
