/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Lookup keys by email addresses using WKD. A an email address is lookep up at most
 *  once a day.
 */

var EXPORTED_SYMBOLS = ["EnigmailWkdLookup"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Sqlite.jsm"); /* global Sqlite: false */
Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false*/
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false*/
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("resource://enigmail/gpg.jsm"); /* global EnigmailGpg: false*/
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */


var EnigmailWkdLookup = {

  /**
   * Try to import keys using WKD. Found keys are automatically imported
   *
   * @param emailList: String - comma-separated list of email addresses
   *
   * @return Promise()  (Boolean): true - new keys found
   */
  findKeys: function(emailList) {
    return new Promise((resolve, reject) => {
      EnigmailLog.DEBUG("wkdLookup.jsm: findKeys(" + emailList + ")\n");

      if (!this.isAvailable()) resolve(false);
      if (emailList.trim() == "") resolve(false);

      let self = this;

      let listener = EnigmailExecution.newSimpleListener(null, function(ret) {
        EnigmailLog.DEBUG(listener.stdoutData);
        EnigmailLog.DEBUG(listener.stderrData);
        let imported = listener.stdoutData.includes("IMPORT_OK");
        if (ret === 0 && imported) {
          EnigmailKeyRing.clearCache();
          resolve(true);
        }
        else
          resolve(false);

      });

      Promise.all(emailList.split(",").map(
          function(mailAddr) {
            return self.determineLastAttempt(mailAddr.trim().toLowerCase());
          }))
        .then(function(checks) {
          let toCheck = [];
          let emails = emailList.split(",");

          EnigmailLog.DEBUG("wkdLookup.jsm: findKeys: checks " + checks.length + "\n");

          for (let i = 0; i < checks.length; i++) {
            if (checks[i]) {
              EnigmailLog.DEBUG("wkdLookup.jsm: findKeys: recheck " + emails[i] + "\n");
              toCheck.push(emails[i]);
            }
            else {
              EnigmailLog.DEBUG("wkdLookup.jsm: findKeys: skip check " + emails[i] + "\n");
            }
          }

          if (toCheck.length > 0) {
            let proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath, [
              "--status-fd", "1",
              "--no-auto-check-trustdb",
              "--auto-key-locate", "wkd",
              "--locate-keys"
            ].concat(toCheck), false, null, listener, {
              value: null
            });
          }
          else {
            resolve(false);
          }

        })
        .catch(() => {
          resolve(false);
        });
    });
  },

  /**
   * Determine for an email address when we last attempted to
   * obtain a key via wkd
   *
   * @param email: String - email address
   *
   * @return Promise: true if new WKD lookup required
   */
  determineLastAttempt: function(email) {
    EnigmailLog.DEBUG("wkdLookup.jsm: determineLastAttempt(" + email + ")\n");

    let conn;

    return Sqlite.openConnection({
      path: "enigmail.sqlite",
      sharedMemoryCache: false
    }).then(function onConnection(connection) {
      conn = connection;
      return checkDatabaseStructure(conn);
    }, function onError(error) {
      EnigmailLog.DEBUG("wkdLookup.jsm: determineLastAttempt: could not open database\n");
    }).then(function _f() {
      return timeForRecheck(conn, email);
    }).then(function _done(val) {
      EnigmailLog.DEBUG("wkdLookup.jsm: OK - closing connection\n");
      conn.close();
      return Promise.resolve(val);
    }).catch(function _err(reason) {
      EnigmailLog.DEBUG("wkdLookup.jsm: error - closing connection: " + reason + "\n");
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
  EnigmailLog.DEBUG("wkdLookup.jsm: checkDatabaseStructure\n");

  return connection.tableExists("auto_key_locate_timestamps").then(
    function onSuccess(exists) {
      EnigmailLog.DEBUG("wkdLookup.jsm: checkDatabaseStructure - success\n");
      if (!exists) {
        return createAutoKeyLocateTable(connection);
      }
      else {
        return PromiseUtils.defer();
      }
    },
    function onError(error) {
      EnigmailLog.DEBUG("wkdLookup.jsm: checkDatabaseStructure - error\n");
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
  EnigmailLog.DEBUG("wkdLookup.jsm: createAutoKeyLocateTable\n");

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
 * @return Promise (true if new lookup required)
 */
function timeForRecheck(connection, email) {
  EnigmailLog.DEBUG("wkdLookup.jsm: timeForRecheck\n");

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
    EnigmailLog.DEBUG("wkdLookup.jsm: timeForRecheck: " + rows.length + "\n");

    return rows.length === 1 && rows[0].getResultByIndex(0) === 0;
  }, function(error) {
    EnigmailLog.DEBUG("wkdLookup.jsm: timeForRecheck - error" + error + "\n");
    Promise.reject(error);
  });
}
