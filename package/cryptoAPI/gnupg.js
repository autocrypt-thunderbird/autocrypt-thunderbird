/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["getGnuPGAPI"];


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const {
  Services
} = Cu.import("resource://gre/modules/Services.jsm");
const {
  EnigmailGpg
} = Cu.import("chrome://enigmail/content/modules/gpg.jsm");
const {
  EnigmailExecution
} = Cu.import("chrome://enigmail/content/modules/execution.jsm");
const {
  EnigmailFiles
} = Cu.import("chrome://enigmail/content/modules/files.jsm");
const {
  EnigmailConstants
} = Cu.import("chrome://enigmail/content/modules/constants.jsm");
const {
  EnigmailLog
} = Cu.import("chrome://enigmail/content/modules/log.jsm");
const {
  EnigmailTime
} =
Cu.import("chrome://enigmail/content/modules/time.jsm");
const {
  EnigmailData
} = Cu.import("chrome://enigmail/content/modules/data.jsm");
const {
  EnigmailLocale
} = Cu.import("chrome://enigmail/content/modules/locale.jsm");

// Load generic API
Services.scriptloader.loadSubScript("chrome://enigmail/content/modules/cryptoAPI/interface.js",
  null, "UTF-8"); /* global CryptoAPI */

/**
 * GnuPG implementation of CryptoAPI
 */


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

const UNKNOWN_SIGNATURE = "[User ID not found]";

class GnuPGCryptoAPI extends CryptoAPI {
  constructor() {
    super();
    this.api_name = "GnuPG";
  }

  async getKeySignatures(keyId, ignoreUnknownUid = false) {
    const args = EnigmailGpg.getStandardArgs(true).
    concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]).
    concat(keyId.split(" "));

    let res = await EnigmailExecution.execAsync(EnigmailGpg.agentPath, args, "");

    if (!(res.statusFlags & EnigmailConstants.BAD_SIGNATURE)) {
      // ignore exit code as recommended by GnuPG authors
      res.exitCode = 0;
    }

    if (res.exitCode !== 0) {
      if (res.errorMsg) {
        res.errorMsg += "\n" + EnigmailFiles.formatCmdLine(EnigmailGpg.agentPath, args);
        res.errorMsg += "\n" + res.errorMsg;
      }
      return "";
    }

    if (res.stdoutData.length > 0) {
      return extractSignatures(res.stdoutData, ignoreUnknownUid);
    }
    return null;
  }
}


function getGnuPGAPI() {
  return new GnuPGCryptoAPI();
}


/**
 * Return signatures for a given key list
 *
 * @param String gpgKeyList         Output from gpg such as produced by getKeySig()
 *                                  Only the first public key is processed!
 * @param Boolean ignoreUnknownUid  true if unknown signer's UIDs should be filtered out
 *
 * @return Array of Object:
 *     - uid
 *     - uidLabel
 *     - creationDate
 *     - sigList: [uid, creationDate, signerKeyId, sigType ]
 */

function extractSignatures(gpgKeyList, ignoreUnknownUid) {
  EnigmailLog.DEBUG("gnupg.js: extractSignatures: " + gpgKeyList + "\n");

  var listObj = {};

  let havePub = false;
  let currUid = "",
    keyId = "",
    fpr = "";

  const lineArr = gpgKeyList.split(/\n/);
  for (let i = 0; i < lineArr.length; i++) {
    // process lines such as:
    //  tru::1:1395895453:1442881280:3:1:5
    //  pub:f:4096:1:C1B875ED336XX959:2299509307:1546189300::f:::scaESCA:
    //  fpr:::::::::102A1C8CC524A966849C33D7C8B157EA336XX959:
    //  uid:f::::1388511201::67D5B96DC564598D4D4D9E0E89F5B83C9931A154::Joe Fox <joe@fox.com>:
    //  sig:::1:C8B157EA336XX959:2299509307::::Joe Fox <joe@fox.com>:13x:::::2:
    //  sub:e:2048:1:B214734F0F5C7041:1316219469:1199912694:::::e:
    //  sub:f:2048:1:70E7A471DABE08B0:1316221524:1546189300:::::s:
    const lineTokens = lineArr[i].split(/:/);
    switch (lineTokens[ENTRY_ID]) {
      case "pub":
        if (havePub) {
          return listObj;
        }
        havePub = true;
        keyId = lineTokens[KEY_ID];
        break;
      case "fpr":
        if (fpr === "") fpr = lineTokens[USERID_ID];
        break;
      case "uid":
      case "uat":
        currUid = lineTokens[UID_ID];
        listObj[currUid] = {
          userId: lineTokens[ENTRY_ID] == "uat" ? EnigmailLocale.getString("keyring.photo") : EnigmailData.convertGpgToUnicode(lineTokens[USERID_ID]),
          rawUserId: lineTokens[USERID_ID],
          keyId: keyId,
          fpr: fpr,
          created: EnigmailTime.getDateTime(lineTokens[CREATED_ID], true, false),
          sigList: []
        };
        break;
      case "sig":
        if (lineTokens[SIG_TYPE_ID].substr(0, 2).toLowerCase() !== "1f") {
          // ignrore revoked signature

          let sig = {
            userId: EnigmailData.convertGpgToUnicode(lineTokens[USERID_ID]),
            created: EnigmailTime.getDateTime(lineTokens[CREATED_ID], true, false),
            signerKeyId: lineTokens[KEY_ID],
            sigType: lineTokens[SIG_TYPE_ID],
            sigKnown: lineTokens[USERID_ID] != UNKNOWN_SIGNATURE
          };

          if (!ignoreUnknownUid || sig.userId != UNKNOWN_SIGNATURE) {
            listObj[currUid].sigList.push(sig);
          }
        }
        break;
    }
  }

  return listObj;
}
