/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module implements rate limiting of --auto-key-locate.
 */

var EXPORTED_SYMBOLS = ["EnigmailAutoKeyLocate"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Sqlite.jsm"); /* global Sqlite: false */
Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false*/
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false*/
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("resource://enigmail/gpg.jsm"); /* global EnigmailGpg: false*/

var EnigmailAutoKeyLocate = {
  /**
   * Determine for an email address when we last attempted to
   * obtain a key via wkd
   */
  checkUser: function(email) {
    EnigmailLog.DEBUG("autoKeyLocate.jsm: processAutoKeyLocateHeader: from=" + email + "\n");

    let conn;

    return Sqlite.openConnection({
      path: "enigmail.sqlite",
      sharedMemoryCache: false
    }).then(function onConnection(connection) {
      conn = connection;
      return checkDatabaseStructure(conn);
    }, function onError(error) {
      EnigmailLog.DEBUG("autoKeyLocate.jsm: processAutoKeyLocateHeader: could not open database\n");
    }).then(function _f() {
      return timeForRecheck(conn, email);
    }).then(function _done(val) {
      EnigmailLog.DEBUG("autoKeyLocate.jsm: OK - closing connection\n");
      conn.close();
      return Promise.resolve(val);
    }).catch(function _err(reason) {
      EnigmailLog.DEBUG("autoKeyLocate.jsm: error - closing connection: " + reason + "\n");
      conn.close();
      // in case something goes wrong we recheck anyway
      return Promise.resolve(true);
    });
  },

  /**
   * determine if WKD support is available in GnuPG
   */
  isAvailable: function() {
    return EnigmailGpg.getGpgFeature("supports-wkd");
  }
};


/**
 * Ensure that the database has the auto_key_locate_timestamps table.
 *
 * @param connection: Object - SQLite connection
 *
 * @return Promise
 */
function checkDatabaseStructure(connection) {
  EnigmailLog.DEBUG("autoKeyLocate.jsm: checkDatabaseStructure\n");

  return connection.tableExists("auto_key_locate_timestamps").then(
    function onSuccess(exists) {
      EnigmailLog.DEBUG("autoKeyLocate.jsm: checkDatabaseStructure - success\n");
      if (!exists) {
        return createAutoKeyLocateTable(connection);
      }
      else {
        return PromiseUtils.defer();
      }
    },
    function onError(error) {
      EnigmailLog.DEBUG("autoKeyLocate.jsm: checkDatabaseStructure - error\n");
      Promise.reject(error);
    });
}

/**
 * Create the "auto_key_locate_timestamps" table.
 *
 * @param connection: Object - SQLite connection
 *
 * @return Promise
 */
function createAutoKeyLocateTable(connection) {
  EnigmailLog.DEBUG("autoKeyLocate.jsm: createAutoKeyLocateTable\n");

  return connection.execute(
    "create table auto_key_locate_timestamps (" +
    "email text not null primary key, " + // email address of correspondent
    "last_seen integer);"); // timestamp of last mail received for the email/type combination
}

/**
 * Check if enough time has passed since we looked-up the key for "email".
 *
 * @param connection: Object - SQLite connection
 * @param email:      String - Email address to search (in lowercase)
 *
 * @return Promise
 */
function timeForRecheck(connection, email) {
  EnigmailLog.DEBUG("autoKeyLocate.jsm: timeForRecheck\n");

  let obj = {
    email: email,
    now: Date.now()
  };

  return connection.execute(
    "select count(*) from auto_key_locate_timestamps where email = :email and :now - last_seen < 60*60*24", obj
  ).then(function(val) {
    return connection.execute(
      "insert or replace into auto_key_locate_timestamps values (:email, :now)", obj
    ).then(function() {
      return Promise.resolve(val);
    });
  }).then(function(rows) {
    EnigmailLog.DEBUG("autoKeyLocate.jsm: timeForRecheck: " + rows.toString() + "\n");

    return rows.length === 1 && rows[0].getResultByIndex(0) === 0;
  }, function(error) {
    EnigmailLog.DEBUG("autoKeyLocate.jsm: timeForRecheck - error" + error + "\n");
    Promise.reject(error);
  });
}
