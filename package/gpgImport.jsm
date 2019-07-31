/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["AutocryptGpgImport"];

const EnigmailExecution = ChromeUtils.import("chrome://autocrypt/content/modules/execution.jsm").EnigmailExecution;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const ENTRY_ID = 0;
const KEY_TRUST_ID = 1;
const KEY_SIZE_ID = 2;
const KEY_ALGO_ID = 3;
const KEY_ID = 4;
const CREATED_ID = 5;
const EXPIRY_ID = 6;
const UID_ID = 7;
const OWNERTRUST_ID = 8;
const USERID_ID = 9;
const SIG_TYPE_ID = 10;
const KEY_USE_FOR_ID = 11;

var AutocryptGpgImport = {
  obtainKeyList: async function(email) {
    EnigmailLog.DEBUG("gnupg-keylist.jsm: obtainKeyList()\n");

    let args = ["--charset", "utf-8", "--display-charset", "utf-8", "--no-auto-check-trustdb", "--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"];
    if (email) {
      args = args.concat(email);
    }

    let res = await EnigmailExecution.execAsync('/usr/bin/gpg', args, "");
    let listing = res.stdoutData.split(/\n/);

    const result = {};

    let keyObj;
    for (let i = 0; i < listing.length; i++) {
      const lineTokens = listing[i].split(/:/);
      if (lineTokens.length === 0) continue;

      switch (lineTokens[ENTRY_ID]) {
        case "sec":
          keyObj = {
            fpr: "",
            userIds: []
          };
          break;
        case "fpr":
          // only take first fpr line, this is the fingerprint of the primary key and what we want
          if (keyObj.fpr === "") {
            keyObj.fpr = lineTokens[USERID_ID].toUpperCase();
            result[keyObj.fpr] = keyObj;
          }
          break;
        case "uid":
          if (lineTokens[USERID_ID].length === 0) {
            lineTokens[USERID_ID] = "-";
          }
          if (typeof(keyObj.userId) !== "string") {
            keyObj.userId = EnigmailData.convertGpgToUnicode(lineTokens[USERID_ID]);
          }
          keyObj.userIds.push({
            userId: EnigmailData.convertGpgToUnicode(lineTokens[USERID_ID])
          });
      }
    }

    return result;
  }
};

