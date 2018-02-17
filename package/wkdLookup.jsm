/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Lookup keys by email addresses using WKD. A an email address is lookep up at most
 *  once a day. (see https://tools.ietf.org/html/draft-koch-openpgp-webkey-service)
 */

var EXPORTED_SYMBOLS = ["EnigmailWkdLookup"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.importGlobalProperties(["XMLHttpRequest"]);
Cu.import("resource://gre/modules/Sqlite.jsm"); /* global Sqlite: false */
Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false*/
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false*/
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/zbase32.jsm"); /*global EnigmailZBase32: false */
Cu.import("resource://enigmail/openpgp.jsm"); /*global EnigmailOpenPGP: false */
Cu.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */

var EnigmailWkdLookup = {

  /**
   * Try to import keys using WKD. Found keys are automatically imported
   *
   * @param emailList: Array - of email addresses (in lowercase)
   *
   * @return Promise()  (Boolean): true - new keys found
   */
  findKeys: function(emails) {
    return new Promise((resolve, reject) => {
      EnigmailLog.DEBUG("wkdLookup.jsm: findKeys(" + emails.join(",") + ")\n");

      if (emails.length === 0) {
        resolve(false);
        return;
      }

      let self = this;

      // do a little sanity test such that we don't do the lookup for nothing too often
      for (let e of emails) {
        if (e.search(/.@.+\...+$/) < 0) {
          resolve(false);
          return;
        }
      }

      Promise.all(emails.map(
          function(mailAddr) {
            return self.determineLastAttempt(mailAddr.trim().toLowerCase());
          }))
        .then(function(checks) {
          let toCheck = [];

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

            Promise.all(toCheck.map((email) => {
              return self.downloadWkdKey(email);
            })).then((dataArr) => {

              let gotKeys = [];
              for (let i = 0; i < dataArr.length; i++) {
                if (dataArr[i] !== null) {
                  gotKeys.push(dataArr[i]);
                }
              }

              if (gotKeys.length > 0) {
                importDownloadedKeys(gotKeys);
                resolve(true);
              }
              else
                resolve(false);

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
   * get the WKD URL for an email address
   *
   * @param email: String - email address
   *
   * @return String: URL (or null if not possible)
   */

  getWkdUrlFromEmail: function(email) {
    email = email.toLowerCase().trim();
    let at = email.indexOf("@");

    let domain = email.substr(at + 1);
    let user = email.substr(0, at);

    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
    createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var data = converter.convertToByteArray(user, {});

    var ch = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
    ch.init(ch.SHA1);
    ch.update(data, data.length);
    let gotHash = ch.finish(false);
    let encodedHash = EnigmailZBase32.encode(gotHash);

    let url = "https://" + domain + "/.well-known/openpgpkey/hu/" + encodedHash;
    return url;
  },

  downloadWkdKey: function(email) {
    EnigmailLog.DEBUG("wkdLookup.jsm: downloadWkdKey(" + email + ")\n");

    return new Promise((resolve, reject) => {
      let oReq = new XMLHttpRequest();

      oReq.addEventListener("load", function _f() {
        EnigmailLog.DEBUG("wkdLookup.jsm: downloadWkdKey: data for " + email + "\n");
        try {
          let keyData = EnigmailData.arrayBufferToString(oReq.response);
          resolve(keyData);
        }
        catch (ex) {
          EnigmailLog.DEBUG("wkdLookup.jsm: downloadWkdKey: error " + ex.toString() + "\n");
          resolve(null);
        }
      });

      oReq.addEventListener("error", (e) => {
          EnigmailLog.DEBUG("wkdLookup.jsm: downloadWkdKey: error for " + email + "\n");
          EnigmailLog.DEBUG("   got error: " + e + "\n");
          resolve(null);
        },
        false);

      oReq.overrideMimeType("application/octet-stream");
      oReq.responseType = "arraybuffer";
      oReq.open("GET", EnigmailWkdLookup.getWkdUrlFromEmail(email));

      oReq.send();
    });
  }
};


/**
 * Ensure that the database has the wkd_lookup_timestamp table.
 *
 * @param connection: Object - SQLite connection
 *
 * @return Promise
 */
function checkDatabaseStructure(connection) {
  EnigmailLog.DEBUG("wkdLookup.jsm: checkDatabaseStructure\n");

  return connection.tableExists("wkd_lookup_timestamp").then(
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
 * Create the "wkd_lookup_timestamp" table.
 *
 * @param connection: Object - SQLite connection
 *
 * @return Promise
 */
function createAutoKeyLocateTable(connection) {
  EnigmailLog.DEBUG("wkdLookup.jsm: createAutoKeyLocateTable\n");

  return connection.execute(
    "create table wkd_lookup_timestamp (" +
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
    "select count(*) from wkd_lookup_timestamp where email = :email and :now - last_seen < 60*60*24", obj
  ).then(function(val) {
    return connection.execute(
      "insert or replace into wkd_lookup_timestamp values (:email, :now)", obj
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


function importDownloadedKeys(keysArr) {
  EnigmailLog.DEBUG("wkdLookup.jsm: importDownloadedKeys(" + keysArr.length + ")\n");

  let keyData = "";
  for (let k in keysArr) {
    try {
      keyData += EnigmailOpenPGP.enigmailFuncs.bytesToArmor(EnigmailOpenPGP.enums.armor.public_key, keysArr[k]);
    }
    catch (ex) {}
  }

  let keyList = EnigmailKey.getKeyListFromKeyBlock(keyData, {}, false);

  for (let k in keyList) {
    EnigmailLog.DEBUG("wkdLookup.jsm: importDownloadedKeys: fpr=" + keyList[k].fpr + "\n");
  }

  EnigmailKeyRing.importKey(null, false, keyData, "", {}, {});
}
