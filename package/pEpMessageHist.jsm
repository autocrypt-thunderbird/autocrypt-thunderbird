/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailPEPMessageHist"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Sqlite.jsm"); /* global Sqlite: false */
Cu.import("resource://gre/modules/jsmime.jsm"); /*global jsmime: false*/
Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false*/
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false*/
Cu.import("resource://enigmail/mime.jsm"); /* global EnigmailMime: false*/
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */

var EnigmailPEPMessageHist = {
  /**
   * Determine if message is latest messager from sender
   *
   * @param fromAddr:      String - Address of sender (From: header)
   * @param dateSent:      String - Date: field of the message
   *
   * @return Promise (Boolean). If true, message is latest message
   */
  isLatestMessage: function(fromAddr, dateSent) {
    EnigmailLog.DEBUG("pEpMessageHist.jsm: isLatestMessage: from=" + fromAddr + "\n");

    let deferred = PromiseUtils.defer();

    fromAddr = EnigmailFuncs.stripEmail(fromAddr).toLowerCase();
    let lastDate = jsmime.headerparser.parseDateHeader(dateSent);
    let now = new Date();
    if (lastDate > now) {
      lastDate = now;
    }

    let paramArr = {
      dateSent: lastDate,
      fromAddr: fromAddr
    };

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
        EnigmailLog.DEBUG("pEpMessageHist.jsm: isLatestMessage: could not open database\n");
      }
    ).then(
      function _f() {
        return findUserRecord(conn, fromAddr);
      }
    ).then(
      function gotData(resultObj) {
        EnigmailLog.DEBUG("pEpMessageHist.jsm: got " + resultObj.numRows + " rows\n");
        if (resultObj.data === null) {
          return appendUser(conn, paramArr);
        }
        else {
          return updateUser(conn, paramArr, resultObj.data);
        }
      }
    ).then(
      function _done(isNewestMessage) {
        EnigmailLog.DEBUG("pEpMessageHist.jsm: OK - closing connection: " + isNewestMessage + "\n");
        deferred.resolve(true); // TODO: revert to isNewestMessage
        conn.close();
      }
    ).catch(
      function _err(reason) {
        EnigmailLog.DEBUG("pEpMessageHist.jsm: error - closing connection: " + reason + "\n");
        deferred.resolve(false);
        conn.close();
      }
    );

    return deferred.promise;
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
  EnigmailLog.DEBUG("pEpMessageHist.jsm: checkDatabaseStructure\n");

  let deferred = PromiseUtils.defer();

  connection.tableExists("pep_senderlist").then(
    function onSuccess(exists) {
      EnigmailLog.DEBUG("pEpMessageHist.jsm: checkDatabaseStructure - success\n");
      if (!exists) {
        createSenderListTable(connection, deferred);
      }
      else {
        deferred.resolve();
      }
    },
    function onError(error) {
      EnigmailLog.DEBUG("pEpMessageHist.jsm: checkDatabaseStructure - error\n");
      deferred.reject(error);
    }
  );

  return deferred.promise;
}

/**
 * Create the "pep_senderlist" table and the corresponding index
 *
 * @param connection: Object - SQLite connection
 * @param deferred:   Promise
 */
function createSenderListTable(connection, deferred) {
  EnigmailLog.DEBUG("pEpMessageHist.jsm: createSenderListTable\n");

  connection.execute("create table pep_senderlist (" +
      "email text not null, " + // email address of correspondent
      "last_date text not null);"). // timestamp of last mail received for the email combination
  then(
    function _ok() {
      EnigmailLog.DEBUG("pEpMessageHist.jsm: createSenderListTable - index\n");
      connection.execute("create unique index pep_senderlist_i1 on pep_senderlist(email)").
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
 *
 * @return Promise
 */
function findUserRecord(connection, email) {
  EnigmailLog.DEBUG("pEpMessageHist.jsm: findUserRecord\n");

  let deferred = PromiseUtils.defer();
  let data = null;
  let numRows = 0;

  connection.execute(
    "select * from pep_senderlist where email = :email", {
      email: email
    },
    function _onRow(row) {
      EnigmailLog.DEBUG("pEpMessageHist.jsm: findUserRecord - got row\n");
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
 * @param paramsArr:  Object - the message headers
 *
 * @return Promise
 */
function appendUser(connection, paramsArr) {
  EnigmailLog.DEBUG("pEpMessageHist.jsm: appendUser\n");

  let deferred = PromiseUtils.defer();

  connection.executeTransaction(function _trx() {
    connection.execute("insert into pep_senderlist (email, last_date) values " +
      "(:email, :lastDate)", {
        email: paramsArr.fromAddr,
        lastDate: paramsArr.dateSent.toJSON()
      }).then(
      function _ok() {
        deferred.resolve(true);
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
 * @param paramsArr:  Object - the message headers
 * @param currData:   Object (mozIStorageRow) - current data stored in the database
 *
 * @return Promise
 */
function updateUser(connection, paramsArr, currData) {
  EnigmailLog.DEBUG("pEpMessageHist.jsm: updateUser\n");

  let deferred = PromiseUtils.defer();

  let lastDate = new Date(currData.getResultByName("last_date"));

  if (lastDate >= paramsArr.dateSent) {
    EnigmailLog.DEBUG("pEpMessageHist.jsm: updateUser: not a new latest message\n");

    EnigmailTimer.setTimeout(function _f() {
      deferred.resolve(false);
    }, 0);
    return deferred.promise;
  }

  EnigmailLog.DEBUG("pEpMessageHist.jsm: updateUser: updating latest message\n");

  connection.executeTransaction(function _trx() {
    connection.execute("update pep_senderlist set last_date = :dateSent where email = :email", {
      email: paramsArr.fromAddr,
      dateSent: paramsArr.dateSent.toJSON()
    }).then(
      function _ok() {
        deferred.resolve(true);
      }
    ).catch(function _err() {
      deferred.reject("update failed");
    });
  });

  return deferred.promise;
}
