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
const EnigmailTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").EnigmailTimer;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;

const DATABASE_FILENAME = 'autocrypt.sqlite';

var EnigmailSqliteDb = {
  getDbConnection: async function() {
    EnigmailLog.DEBUG("sqliteDb.jsm: getDbConnection()\n");
    if (!this.cachedConnection) {
      this.cachedConnection = await new Promise((resolve, reject) => {
        openDatabaseConn(resolve, reject, 100, Date.now() + 10000);
      });
    }
    return this.cachedConnection;
  },

  checkDatabaseStructure: async function() {
    EnigmailLog.DEBUG(`sqliteDb.jsm: checkDatabaseStructure()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      await checkAutocryptTable(conn);
      await checkWkdTable(conn);
      await createTables(conn);
      await fixupTables(conn);
      EnigmailLog.DEBUG(`sqliteDb.jsm: checkDatabaseStructure - success\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: checkDatabaseStructure: ERROR: ${ex}\n`);
    }
  },

  retrieveAutocryptRows: async function(emails) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveAutocryptRows() for ${emails.length} addresses\n`);
    const placeholders = Array(emails.length).fill('?');
    const where = "email IN (" + placeholders.join(',') + ")";

    return await this.retrieveAutocryptRowsInternal(where, emails);
  },

  retrieveAutocryptRowsByFingerprint: async function(fpr) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveAutocryptRowsByFingerprint(${fpr})\n`);
    const where = "fpr_primary = :fpr_primary";
    const args = {
      fpr_primary: fpr
    };

    return await this.retrieveAutocryptRowsInternal(where, args);
  },

  retrieveAutocryptRowsInternal: async function(where, args) {
    let conn;
    try {
      conn = await this.getDbConnection();
      const result = [];

      const fields = [ "email", "fpr_primary", "fpr_primary_gossip", "last_seen_message", "last_seen_key", "last_seen_gossip", "is_mutual" ];
      const date_fields = [ "last_seen_message", "last_seen_key", "last_seen_gossip" ];
      const special_fields = {
        "is_secret": "EXISTS(SELECT * FROM secret_keydata s WHERE autocrypt_peers.fpr_primary = s.fpr_primary) AS is_secret"
      };

      const query = "select " + fields.join(', ') + ", " + date_fields.join(', ') + ", " + Object.values(special_fields).join(', ') + " from autocrypt_peers where " + where + ";";

      await conn.execute(query, args,
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
            for (const field of Object.keys(special_fields)) {
              obj[field] = row.getResultByName(field);
            }
            result.push(obj);
          } catch (ex) {
            EnigmailLog.ERROR(`${ex}\n`);
          }
      });
      EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveAutocryptRows - returning ${result.length} keys\n`);
      return result;
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: retrieveAutocryptRows: ERROR: ${ex}\n`);
      return [];
    }
  },


  retrieveAllPublicKeys: async function() {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveAllPublicKeys()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      const result = [];
      await conn.execute( "select fpr_primary, key_data from public_keydata;", {},
        function _onRow(row) {
          let fpr_primary = row.getResultByName("fpr_primary");
          let key_data = Uint8Array.from(row.getResultByName("key_data"));
          result.push({ fpr_primary: fpr_primary, key_data: key_data });
      });
      EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveAllPublicKeys: ${result.length} rows\n`);
      return result;
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: retrieveAllPublicKeys: ERROR: ${ex}\n`);
      return [];
    }
  },

  retrieveAllSecretKeys: async function() {
    EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeys()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      const result = [];
      await conn.execute("select fpr_primary, key_data_secret from secret_keydata;", {},
        function _onRow(row) {
          let fpr_primary = row.getResultByName("fpr_primary");
          let key_data_secret = Uint8Array.from(row.getResultByName("key_data_secret"));
          result.push({ fpr_primary: fpr_primary, key_data_secret: key_data_secret });
      });
      EnigmailLog.DEBUG(`sqliteDb.jsm: retrieveSecretKeys - success\n`);
      return result;
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: retrieveSecretKeys: ERROR: ${ex}\n`);
      throw ex;
    }
  },

  findPrimaryFprByKeyId: async function(key_id) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: findPrimaryFprByKeyId(${key_id})\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      let result = null;
      await conn.execute( "select fpr_primary from public_keyids where key_id = :key_id;", {
        key_id: key_id.toUpperCase()
      },
        function _onRow(row) {
          result = row.getResultByName("fpr_primary");
      });
      EnigmailLog.DEBUG(`sqliteDb.jsm: findPrimaryFprByKeyId: ${result}\n`);
      return result;
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: findPrimaryFprByKeyId: ERROR: ${ex}\n`);
      return [];
    }
  },

  autocryptInsertOrUpdateLastSeenMessage: async function(email, last_seen_message) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptInsertOrUpdateLastSeen()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
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
      EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptInsertOrUpdateLastSeenMessage - success\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: autocryptInsertOrUpdateLastSeenMessage: ERROR: ${ex}\n`);
    }
  },

  autocryptUpdateKey: async function(email, last_seen_key, fpr_primary, is_mutual) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateKey()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      let data = {
        email: String(email),
        last_seen_key: last_seen_key.toISOString(),
        fpr_primary: fpr_primary,
        is_mutual: is_mutual ? 1 : 0
      };
      // EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateKey(): data = ` + JSON.stringify(data) + "\n");
      await conn.execute(
        "update autocrypt_peers set last_seen_key = :last_seen_key, fpr_primary = :fpr_primary, is_mutual = :is_mutual WHERE email = :email" +
         " AND NOT EXISTS(SELECT * FROM secret_keydata s WHERE autocrypt_peers.fpr_primary = s.fpr_primary)",
        data
      );
      EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateKey - success\n`);
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: autocryptUpdateKey: ERROR: ${ex}\n`);
    }
  },

  autocryptUpdateGossipKey: async function(email, last_seen_gossip, fpr_primary_gossip) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateGossipKey()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      let data = {
        email: String(email),
        last_seen_gossip: last_seen_gossip.toISOString(),
        fpr_primary_gossip: fpr_primary_gossip
      };
      // EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateGossipKey(): data = ` + JSON.stringify(data) + "\n");
      await conn.execute(
        "update autocrypt_peers set last_seen_gossip = :last_seen_gossip, fpr_primary = :fpr_primary_gossip where email = :email;",
        data
      );
      EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateGossipKey - success\n`);
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: autocryptUpdateGossipKey: ERROR: ${ex}\n`);
    }
  },

  autocryptUpdateSecretKey: async function(email, fpr_primary, is_mutual) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateSecretKey()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      let data = {
        email: String(email),
        fpr_primary: fpr_primary,
        is_mutual: is_mutual ? 1 : 0
      };
      // EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateKey(): data = ` + JSON.stringify(data) + "\n");
      await conn.execute(
        "update autocrypt_peers set last_seen_key = :last_seen_key, fpr_primary = :fpr_primary, is_mutual = :is_mutual WHERE email = :email" +
         " AND EXISTS(SELECT * FROM secret_keydata s WHERE autocrypt_peers.fpr_primary = s.fpr_primary)",
        data
      );
      EnigmailLog.DEBUG(`sqliteDb.jsm: autocryptUpdateSecretKey - success\n`);
    } catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: autocryptUpdateSecretKey: ERROR: ${ex}\n`);
    }
  },

  storeSecretKey: async function(fpr_primary, key_data_secret, email) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: storeSecretKey()\n`);
    let conn;
    try {
      conn = await this.getDbConnection();
      await conn.execute(
        "replace into secret_keydata values (:fpr_primary, :key_data_secret, :email);",
        { fpr_primary: fpr_primary, key_data_secret: key_data_secret, email: email }
      );
      EnigmailLog.DEBUG(`sqliteDb.jsm: storeSecretKey: ok\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: storeSecretKey: ERROR: ${ex}\n`);
    }
  },

  replacePublicKey: async function(fpr_primary, key_data, key_fprs, key_ids) {
    EnigmailLog.DEBUG(`sqliteDb.jsm: replacePublicKey(): ${fpr_primary}\n`);

    let conn;
    try {
      conn = await this.getDbConnection();
      await conn.execute(
        "replace into public_keydata (fpr_primary, key_data) values (:fpr_primary, :key_data);",
        { fpr_primary: fpr_primary, key_data: key_data }
      );

      let rows_key_fprs = key_fprs.map(fpr => { return { fpr_primary: fpr_primary, fpr: fpr }; });
      await conn.execute(
        "replace into public_fingerprints (fpr_primary, fpr) values (:fpr_primary, :fpr);",
        rows_key_fprs
      );

      let rows_key_ids = key_ids.map(key_id => { return { fpr_primary: fpr_primary, key_id: key_id }; });
      await conn.execute(
        "replace into public_keyids (fpr_primary, key_id) values (:fpr_primary, :key_id);",
        rows_key_ids
      );

      EnigmailLog.DEBUG(`sqliteDb.jsm: replacePublicKey - success\n`);
    }
    catch (ex) {
      EnigmailLog.ERROR(`sqliteDb.jsm: replacePublicKey: ERROR: ${ex}\n`);
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
    path: DATABASE_FILENAME
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
    "fpr_primary integer, " +
    "fpr_primary_gossip integer, " +
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

async function createTables(connection) {
  EnigmailLog.DEBUG("sqliteDB.jsm: createTables()\n");

  await connection.execute("create table if not exists secret_keydata (" +
          "fpr_primary text not null primary key, " +
          "key_data_secret text not null, " +
          "email text not null" +
    ");"
  );

  await connection.execute("create table if not exists public_keydata (" +
          "fpr_primary text not null primary key, " +
          "key_data text not null" +
    ");"
  );

  await connection.execute("create table if not exists public_fingerprints (" +
          "fpr_primary text not null, " +
          "fpr text not null, " +
          "primary key (fpr_primary, fpr) " +
          "foreign key (fpr_primary) references public_keydata (fpr_primary) on delete cascade" +
    ");"
  );

  await connection.execute("create table if not exists public_keyids (" +
          "fpr_primary text not null, " +
          "key_id text not null, " +
          "primary key (fpr_primary, key_id) " +
          "foreign key (fpr_primary) references public_keydata (fpr_primary) on delete cascade" +
    ");"
  );
}

async function fixupTables(connection) {
  EnigmailLog.DEBUG("sqliteDB.jsm: fixupTables()\n");

  await connection.execute("insert or ignore into autocrypt_peers " +
    "(email, fpr_primary, last_seen_message) " +
    "select email, fpr_primary, :last_seen_message " +
    "from secret_keydata;", {
      last_seen_message: new Date().toISOString()
    });
}

