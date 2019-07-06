/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module that provides generic functions for the Enigmail SQLite database
 */

var EXPORTED_SYMBOLS = ["EnigmailSqliteDb"];



const Cr = Components.results;


const Sqlite = ChromeUtils.import("resource://gre/modules/Sqlite.jsm").Sqlite;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;


var EnigmailSqliteDb = {
  /**
   * Provide an sqlite conection object asynchronously, retrying if needed
   *
   * @return {Promise<Sqlite Connection>}: the Sqlite database object
   */

  openDatabase: function() {
    EnigmailLog.DEBUG("sqliteDb.jsm: openDatabase()\n");
    return new Promise((resolve, reject) => {
      openDatabaseConn(resolve, reject, 100, Date.now() + 10000);
    });
  },

  checkDatabaseStructure: async function() {
    EnigmailLog.DEBUG(`sqliteDb.jsm: checkDatabaseStructure()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      await checkAutocryptTable(conn);
      await checkWkdTable(conn);
      await createTables(conn);
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: checkDatabaseStructure - success\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: checkDatabaseStructure: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
    }
  },

  retrieveAutocryptRows: async function(emails) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveAutocryptRows()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      const result = [];

      const fields = [ "email", "key_data", "key_data_gossip", "last_seen_message", "last_seen_key", "last_seen_gossip", "is_mutual" ];
      const date_fields = [ "last_seen_message", "last_seen_key", "last_seen_gossip" ];
      // TODO actually select by email addresses, instead of all
      await conn.execute(
        "select " + fields.join(', ') + " from autocrypt_peers;",
        {},
        function _onRow(row) {
          try {
            const obj = {};
            for (const field of fields) {
              obj[field] = row.getResultByName(field);
            }
            for (const field of date_fields) {
              if (obj[field]) {
                obj[field] = new Date(obj[field]);
              }
            }
            result.push(obj);
          } catch (ex) {
            EnigmailLog.ERROR(`${ex}\n`);
          }
      });
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveAutocryptRows - success ${JSON.stringify(result)}\n`);
      return result;
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: retrieveAutocryptRows: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
      return [];
    }
  },

  retrievePublicKeyBlobs: async function(emails) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeys()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      const result = [];
      // TODO actually select by email addresses, instead of all
      await conn.execute( "select keydata from autocrypt_keydata;", {},
        function _onRow(row) {
          let data = row.getResultByName("keydata");
          result.push(data);
      });
      EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeys - success\n`);
      return result;
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: retrieveSecretKeys: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
      return [];
    }
  },

  retrieveSecretKeyBlob: async function(email) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeyBlob()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      const result = [];
      await conn.execute("select secret from secret_keydata where email = ?",
        [email],
        function _onRow(row) {
          result.push(row.getResultByName("secret"));
      });
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeyBlob - success\n`);
      return result;
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: retrieveSecretKeyBlob: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
      throw ex;
    }
  },

  retrieveAllSecretKeyBlobs: async function() {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeys()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      const result = [];
      await conn.execute("select secret from secret_keydata;", {},
        function _onRow(row) {
          result.push(row.getResultByName("secret"));
      });
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeys - success\n`);
      return result;
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: retrieveSecretKeys: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
      throw ex;
    }
  },

  autocryptInsertOrUpdateLastSeenMessage: async function(email, last_seen_message) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptInsertOrUpdateLastSeen()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      let data = {
          email: String(email),
          last_seen_message: last_seen_message.toISOString()
      };
      await conn.execute(
        "insert or ignore into autocrypt_peers (email, last_seen_message) values (:email, :last_seen_message);",
        data
      );
      await conn.execute(
        "update autocrypt_peers set last_seen_message = :last_seen_message where email = :email",
        data
      );
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptInsertOrUpdateLastSeenMessage - success\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: autocryptInsertOrUpdateLastSeenMessage: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
    }
  },

  autocryptUpdateKey: async function(email, last_seen_key, key_data, is_mutual) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateKey()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      let data = {
        email: String(email),
        last_seen_key: last_seen_key.toISOString(),
        key_data: btoa(key_data),
        is_mutual: is_mutual ? 1 : 0
      };
      // EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateKey(): data = ` + JSON.stringify(data) + "\n");
      await conn.execute(
        "update autocrypt_peers set last_seen_key = :last_seen_key, key_data = :key_data, is_mutual = :is_mutual where email = :email;",
        data
      );
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateKey - success\n`);
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: autocryptUpdateKey: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
    }
  },

  autocryptUpdateGossipKey: async function(email, last_seen_gossip, key_data_gossip) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateGossipKey()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      let data = {
        email: String(email),
        last_seen_gossip: last_seen_gossip.toISOString(),
        key_data_gossip: btoa(key_data_gossip)
      };
      // EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateGossipKey(): data = ` + JSON.stringify(data) + "\n");
      await conn.execute(
        "update autocrypt_peers set last_seen_gossip = :last_seen_gossip, key_data = :key_data_gossip where email = :email;",
        data
      );
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateGossipKey - success\n`);
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: autocryptUpdateGossipKey: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
    }
  },

  storeSecretKey: async function(secret, pub, username, email) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: storeSecretKey()\n`);
    let conn;
    try {
      conn = await this.openDatabase();
      // TODO use prepared statement!
      await conn.execute(
        "insert into secret_keydata values (" +
        "'" + secret + "'," +
        "'" + pub + "'," +
        "'" + username + "'," +
        "'" + email + "'" +
        ");"
      );
      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: storeSecretKey - success\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: storeSecretKey: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
    }
  },

  storePublicKey: async function(fpr_primary, data) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: storePublicKey()\n`);

    let conn;
    try {
      conn = await this.openDatabase();
      await conn.execute(
        "insert into public_keydata values (" +
        "'" + fpr_primary + "'," +
        "'" + data + "'" +
        ");"
      );

      conn.close();
      EnigmailLog.DEBUG(`sqliteDb.jsm: storeSecretKey - success\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: storeSecretKey: ERROR: ${ex}\n`);
      if (conn) {
        conn.close();
      }
    }
  }
};


/**
 * use a promise to open the Enigmail database.
 *
 * it's possible that there will be an NS_ERROR_STORAGE_BUSY
 * so we're willing to retry for a little while.
 *
 * @param {function} resolve: function to call when promise succeeds
 * @param {function} reject:  function to call when promise fails
 * @param {Number}   waitms:  Integer - number of milliseconds to wait before trying again in case of NS_ERROR_STORAGE_BUSY
 * @param {Number}   maxtime: Integer - unix epoch (in milliseconds) of the point at which we should give up.
 */
function openDatabaseConn(resolve, reject, waitms, maxtime) {
  EnigmailLog.DEBUG("sqliteDb.jsm: openDatabaseConn()\n");
  Sqlite.openConnection({
    path: "enigmail.sqlite",
    sharedMemoryCache: false
  }).
  then(connection => {
    resolve(connection);
  }).
  catch(error => {
    let now = Date.now();
    if (now > maxtime) {
      reject(error);
      return;
    }
    EnigmailTimer.setTimeout(function() {
      openDatabaseConn(resolve, reject, waitms, maxtime);
    }, waitms);
  });
}


/**
 * Ensure that the database structure matches the latest version
 * (table is available)
 *
 * @param connection: Object - SQLite connection
 *
 * @return {Promise<Boolean>}
 */
async function checkAutocryptTable(connection) {
  try {
    let exists = await connection.tableExists("autocrypt_peers");
    EnigmailLog.DEBUG("sqliteDB.jsm: checkAutocryptTable - success\n");
    if (!exists) {
      await createAutocryptTable(connection);
    }
  }
  catch (error) {
    EnigmailLog.DEBUG(`sqliteDB.jsm: checkAutocryptTable - error ${error}\n`);
    throw error;
  }

  return true;
}
/**
 * Create the "autocrypt_keydata" table and the corresponding index
 *
 * @param connection: Object - SQLite connection
 *
 * @return {Promise}
 */
async function createAutocryptTable(connection) {
  EnigmailLog.DEBUG("sqliteDB.jsm: createAutocryptTable()\n");

  await connection.execute("create table autocrypt_peers (" +
    "email text not null primary key, " +
    "key_data text, " +
    "key_data_gossip text, " +
    "last_seen_message text not null, " +
    "last_seen_key text, " +
    "last_seen_gossip text, " +
    "is_mutual integer default(0)" +
    ")"
  );

  EnigmailLog.DEBUG("sqliteDB.jsm: createAutocryptTable - index\n");
  return null;
}



/**
 * Ensure that the database has the wkd_lookup_timestamp table.
 *
 * @param connection: Object - SQLite connection
 *
 * @return Promise
 */
async function checkWkdTable(connection) {
  EnigmailLog.DEBUG("sqliteDB.jsm: checkWkdTable()\n");

  try {
    let exists = await connection.tableExists("wkd_lookup_timestamp");
    EnigmailLog.DEBUG("sqliteDB.jsm: checkWkdTable - success\n");
    if (!exists) {
      await createWkdTable(connection);
    }
  }
  catch (error) {
    EnigmailLog.DEBUG("sqliteDB.jsm: checkWkdTable - error\n");
    throw (error);
  }
}

/**
 * Create the "wkd_lookup_timestamp" table.
 *
 * @param connection: Object - SQLite connection
 *
 * @return Promise
 */
function createWkdTable(connection) {
  EnigmailLog.DEBUG("sqliteDB.jsm: createWkdTable()\n");

  return connection.execute(
    "create table wkd_lookup_timestamp (" +
    "email text not null primary key, " + // email address of correspondent
    "last_seen integer);"); // timestamp of last mail received for the email/type combination
}

/**
 * Create the "secret_keydata" table
 *
 * @param connection: Object - SQLite connection
 *
 * @return {Promise}
 */
async function createTables(connection) {
  EnigmailLog.DEBUG("sqliteDB.jsm: createSecretKeyTable()\n");

  await connection.execute("create table if not exists secret_keydata (" +
          "secret text not null, " +
          "pub text not null, " +
          "username text not null, " +
          "email text not null" +
    ");"
  );

  await connection.execute("create table if not exists public_keydata (" +
          "fpr_primary text not null, " +
          "data text not null" +
    ");"
  );

  await connection.execute("create table if not exists public_fingerprints (" +
          "fpr_primary text not null, " +
          "fpr text not null" +
    ");"
  );

  await connection.execute("create table if not exists public_keyids (" +
          "fpr_primary text not null, " +
          "key_id long not null" +
    ");"
  );

  return null;
}

