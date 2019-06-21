/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*eslint no-loop-func: 0*/

/**
 *  Module to determine the type of setup of the user, based on existing emails
 *  found in the inbox
 */

var EXPORTED_SYMBOLS = ["EnigmailAutocryptSetup"];

const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailLazy = ChromeUtils.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;
const sqlite = ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

const getOpenPGP = EnigmailLazy.loader("enigmail/openpgp.jsm", "EnigmailOpenPGP");
const openpgp = getOpenPGP().openpgp;

const nsIMsgAccountManager = Ci.nsIMsgAccountManager;

var EnigmailAutocryptSetup = {

  /**
   * Create a new autocrypt key for every configured account and configure the account
   * to use that key. The keys are not protected by a password.
   *
   * The creation is done in the background after waiting timeoutValue ms
   * @param {Number} timeoutValue: number of miliseconds to wait before starting
   *                               the process
   */
  createKeyForAllAccounts: function() {
    EnigmailLog.DEBUG("autocryptSetup.jsm: createKeyForAllAccounts()\n");

      let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(nsIMsgAccountManager);
      let accounts = msgAccountManager.accounts;
      let createdKeys = [];

      for (let i = 0; i < accounts.length; i++) {
        let account = accounts.queryElementAt(i, Ci.nsIMsgAccount);
        let id = account.defaultIdentity;

        if (id && id.email) {
          let keyId = this.createAutocryptKey(id.fullName, id.email);
          EnigmailLog.DEBUG(`autocryptSetup.jsm: createKeyForAllAccounts: created key\n`);
          id.setBoolAttribute("enablePgp", true);
          id.setIntAttribute("pgpKeyMode", 1);
          id.setBoolAttribute("pgpMimeMode", true);
          id.setBoolAttribute("pgpSignEncrypted", true);
        }
      }
  },

  /**
   * Create a new autocrypt-complinant key
   * The keys will not be protected by passwords.
   *
   * @param {String} userName:  Display name
   * @param {String} userEmail: Email address
   *
   * @return {Promise<Boolean>}: Success (true = successful)
   */
  createAutocryptKey: function(userName, userEmail) {
      EnigmailLog.DEBUG("autocryptSetup.jsm: createAutocryptKey()\n");

      var options = {
        userIds: [{ name:userName, email:userEmail }], // multiple user IDs
        curve: "ed25519",                                         // ECC curve name
      };
    
      openpgp.generateKey(options).then(function(key) {
        sqlite.storeSecretKey(
          key.privateKeyArmored, key.publicKeyArmored, userName, userEmail
        );
      });
  }
    
}