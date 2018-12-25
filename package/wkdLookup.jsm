/*global Components: false, btoa: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Lookup keys by email addresses using WKD. A an email address is lookep up at most
 *  once a day. (see https://tools.ietf.org/html/draft-koch-openpgp-webkey-service)
 */

var EXPORTED_SYMBOLS = ["EnigmailWkdLookup"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

ChromeUtils.import("resource://gre/modules/Sqlite.jsm"); /* global Sqlite: false */
ChromeUtils.import("chrome://enigmail/content/modules/log.jsm"); /* global EnigmailLog: false*/
ChromeUtils.import("chrome://enigmail/content/modules/funcs.jsm"); /* global EnigmailFuncs: false*/
ChromeUtils.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm"); /*global EnigmailKeyRing: false */
ChromeUtils.import("chrome://enigmail/content/modules/zbase32.jsm"); /*global EnigmailZBase32: false */
ChromeUtils.import("chrome://enigmail/content/modules/openpgp.jsm"); /*global EnigmailOpenPGP: false */
ChromeUtils.import("chrome://enigmail/content/modules/key.jsm"); /*global EnigmailKey: false */
ChromeUtils.import("chrome://enigmail/content/modules/dns.jsm"); /*global EnigmailDns: false */
ChromeUtils.import("chrome://enigmail/content/modules/data.jsm"); /*global EnigmailData: false */
ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm"); /* global EnigmailSqliteDb: false*/

var EnigmailWkdLookup = {

  /**
   * Try to import keys using WKD. Found keys are automatically imported
   *
   * @param {Array of String} emailList: email addresses (in lowercase)
   *
   * @return {Promise<Boolean>}: true - new keys found
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
              return self.downloadKey(email);
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
   * @param {String} email: email address
   *
   * @return {Promise<Boolean>}: true if new WKD lookup required
   */
  determineLastAttempt: function(email) {
    EnigmailLog.DEBUG("wkdLookup.jsm: determineLastAttempt(" + email + ")\n");

    let conn;

    return EnigmailSqliteDb.openDatabase().then(function onConnection(connection) {
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
   * get the download URL for an email address for WKD or domain-specific locations
   *
   * @param {String} email: email address
   *
   * @return {Promise<String>}: URL (or null if not possible)
   */

  getDownloadUrlFromEmail: async function(email) {
    email = email.toLowerCase().trim();

    let url = await getSiteSpecificUrl(email);
    if (url) return url;

    let at = email.indexOf("@");

    let domain = email.substr(at + 1);
    let user = email.substr(0, at);

    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var data = converter.convertToByteArray(user, {});

    var ch = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
    ch.init(ch.SHA1);
    ch.update(data, data.length);
    let gotHash = ch.finish(false);
    let encodedHash = EnigmailZBase32.encode(gotHash);

    url = "https://" + domain + "/.well-known/openpgpkey/hu/" + encodedHash;
    return url;
  },

  /**
   * Download a key for an email address
   *
   * @param {String} email: email address
   *
   * @return {Promise<String>}: Key data (or null if not possible)
   */
  downloadKey: async function(email) {
    EnigmailLog.DEBUG("wkdLookup.jsm: downloadKey(" + email + ")\n");

    let url = await EnigmailWkdLookup.getDownloadUrlFromEmail(email);

    let hdrs = new Headers({
      'Authorization': 'Basic ' + btoa("no-user:")
    });
    hdrs.append('Content-Type', 'application/octet-stream');

    let myRequest = new Request(url, {
      method: 'GET',
      headers: hdrs,
      mode: 'cors',
      //redirect: 'error',
      redirect: 'follow',
      cache: 'default'
    });

    let response;
    try {
      EnigmailLog.DEBUG("wkdLookup.jsm: downloadKey: requesting " + url + "\n");
      response = await fetch(myRequest);
      if (!response.ok) {
        return null;
      }
    } catch (ex) {
      EnigmailLog.DEBUG("wkdLookup.jsm: downloadKey: error " + ex.toString() + "\n");
      return null;
    }

    try {
      let keyData = EnigmailData.arrayBufferToString(await response.arrayBuffer());
      EnigmailLog.DEBUG("wkdLookup.jsm: downloadKey: got data for " + email + "\n");
      return keyData;
    } catch (ex) {
      EnigmailLog.DEBUG("wkdLookup.jsm: downloadKey: error " + ex.toString() + "\n");
      return null;
    }
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

/**
 * Import downloaded keys
 *
 * @param {Array of String}: ASCII armored or binary string
 *
 * no return value
 */
function importDownloadedKeys(keysArr) {
  EnigmailLog.DEBUG("wkdLookup.jsm: importDownloadedKeys(" + keysArr.length + ")\n");

  let keyData = "";
  for (let k in keysArr) {
    if (keysArr[k].search(/^-----BEGIN PGP PUBLIC KEY BLOCK-----/) < 0) {
      try {
        keyData += EnigmailOpenPGP.enigmailFuncs.bytesToArmor(EnigmailOpenPGP.openpgp.enums.armor.public_key, keysArr[k]);
      } catch (ex) {
        EnigmailLog.DEBUG("wkdLookup.jsm: importDownloadedKeys: exeption=" + ex + "\n");
      }
    }
    else {
      keyData += keysArr[k];
    }
  }

  let keyList = EnigmailKey.getKeyListFromKeyBlock(keyData, {}, false);

  for (let k in keyList) {
    EnigmailLog.DEBUG("wkdLookup.jsm: importDownloadedKeys: fpr=" + keyList[k].fpr + "\n");
  }

  EnigmailKeyRing.importKey(null, false, keyData, "", {}, {});
}

/**
 * Get special URLs for specific sites that don't use WKD, but still provide
 * public keys of their users in
 *
 * @param {String}: emailAddr: email address in lowercase
 *
 * @return {Promise<String>}: URL or null of no URL relevant
 */
async function getSiteSpecificUrl(emailAddr) {
  let domain = emailAddr.replace(/^.+@/, "");
  let url = null;

  switch (domain) {
    case "posteo.af":
    case "posteo.at":
    case "posteo.be":
    case "posteo.biz":
    case "posteo.ch":
    case "posteo.cl":
    case "posteo.co":
    case "posteo.co.uk":
    case "posteo.com.br":
    case "posteo.cr":
    case "posteo.cz":
    case "posteo.de":
    case "posteo.dk":
    case "posteo.ee":
    case "posteo.es":
    case "posteo.eu":
    case "posteo.fi":
    case "posteo.gl":
    case "posteo.gr":
    case "posteo.hn":
    case "posteo.hr":
    case "posteo.hu":
    case "posteo.ie":
    case "posteo.in":
    case "posteo.is":
    case "posteo.jp":
    case "posteo.la":
    case "posteo.li":
    case "posteo.lt":
    case "posteo.lu":
    case "posteo.me":
    case "posteo.mx":
    case "posteo.my":
    case "posteo.net":
    case "posteo.nl":
    case "posteo.no":
    case "posteo.nz":
    case "posteo.org":
    case "posteo.pe":
    case "posteo.pl":
    case "posteo.pm":
    case "posteo.pt":
    case "posteo.ro":
    case "posteo.ru":
    case "posteo.se":
    case "posteo.sg":
    case "posteo.si":
    case "posteo.tn":
    case "posteo.uk":
    case "posteo.us":
      url = "https://api.posteo.de/v1/public-keys/" + escape(emailAddr) + "?type=open_pgp";
      break;
    case "protonmail.ch":
    case "protonmail.com":
    case "pm.me":
      url = "https://api.protonmail.ch/pks/lookup?op=get&options=mr&search=" + escape(emailAddr);
      break;
  }

  if (!url) {
    try {
      let mxHosts = await EnigmailDns.lookup("MX", domain);
      if (mxHosts & mxHosts.indexOf("mail.protonmail.ch") >= 0 ||
        mxHosts.indexOf("mailsec.protonmail.ch") >= 0) {
        url = "https://api.protonmail.ch/pks/lookup?op=get&options=mr&search=" + escape(emailAddr);
      }
    } catch (ex) {}
  }

  return url;
}
