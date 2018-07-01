/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/****
   Priavte sub-module to gnupg.js for handling key lists from GnuPG
****/

"use strict";

var EXPORTED_SYMBOLS = ["obtainKeyList", "createKeyObj"];

const EnigmailTime = Cu.import("chrome://enigmail/content/modules/time.jsm").EnigmailTime;
const EnigmailGpg = Cu.import("chrome://enigmail/content/modules/gpg.jsm").EnigmailGpg;
const EnigmailExecution = Cu.import("chrome://enigmail/content/modules/execution.jsm").EnigmailExecution;
const EnigmailLog = Cu.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailTrust = Cu.import("chrome://enigmail/content/modules/trust.jsm").EnigmailTrust;
const EnigmailData = Cu.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailLocale = Cu.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;

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

const ALGO_SYMBOL = {
  1: "RSA",
  2: "RSA",
  3: "RSA",
  16: "ELG",
  17: "DSA",
  18: "ECDH",
  19: "ECDSA",
  20: "ELG",
  22: "EDDSA"
};


/**
 * Get key list from GnuPG.
 *
 * @param {Array of String} onlyKeys: only load data for specified key IDs
 *
 * @return {Promise<Array Object>}:
 * key objects as specifiedin EnigmailKeyObj.constructor
 */
async function obtainKeyList(onlyKeys = null) {
  EnigmailLog.DEBUG("gnupg.js: obtainKeyList()\n");

  let secKeyList = [],
    pubKeyList = [];
  let commonArgs = EnigmailGpg.getStandardArgs(true);
  commonArgs = commonArgs.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons"]);

  let args = commonArgs.concat(["--list-keys"]);
  if (onlyKeys) {
    args = args.concat(onlyKeys);
  }

  let res = await EnigmailExecution.execAsync(EnigmailGpg.agentPath, args, "");
  pubKeyList = res.stdoutData.split(/\n/);

  let keyList = {
    keys: [],
    index: []
  };

  EnigmailLog.DEBUG(`gnupg.js: obtainKeyList: #lines: ${pubKeyList.length}\n`);
  if (pubKeyList.length > 0) {
    appendKeyItems(pubKeyList, keyList);

    args = commonArgs.concat(["--list-secret-keys"]);
    if (onlyKeys) {
      args = args.concat(onlyKeys);
    }

    res = await EnigmailExecution.execAsync(EnigmailGpg.agentPath, args, "");
    secKeyList = res.stdoutData.split(/\n/);
    appendKeyItems(secKeyList, keyList);
  }

  return keyList;
}


/**
 * Append key objects to a given key cache
 *
 * @param keyListString: array of |string| formatted output from GnuPG for key listing
 * @param keyList:    |object| holding the resulting key list
 *                         obj.keyList:     Array holding key objects
 *                         obj.keySortList: Array holding values to make sorting easier
 *
 * no return value
 */
function appendKeyItems(keyListString, keyList) {
  EnigmailLog.DEBUG("gnupg.js: appendKeyItems(): " + keyListString[0] + "\n");
  let keyObj = {};
  let uatNum = 0; // counter for photos (counts per key)

  const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();

  for (let i = 0; i < keyListString.length; i++) {
    let listRow = keyListString[i].split(/:/);
    if (listRow.length === 0) continue;

    switch (listRow[ENTRY_ID]) {
      case "pub":
        keyObj = createKeyObj(listRow);
        uatNum = 0;
        keyList.keys.push(keyObj);
        keyList.index[keyObj.keyId] = keyObj;
        break;
      case "sec":
        keyObj = keyList.index[listRow[KEY_ID]];
        if (keyObj) {
          keyObj.secretAvailable = true;
          // create a dummy object that is not added to the list since we already have the key
          keyObj = createKeyObj(listRow);
        }
        else {
          appendUnkownSecretKey(listRow[KEY_ID], keyListString, i, keyList);
          keyObj = keyList.index[listRow[KEY_ID]];
          keyObj.secretAvailable = true;
        }
        break;
      case "fpr":
        // only take first fpr line, this is the fingerprint of the primary key and what we want
        if (keyObj.fpr === "") {
          keyObj.fpr = listRow[USERID_ID];
        }
        break;
      case "uid":
        if (listRow[USERID_ID].length === 0) {
          listRow[USERID_ID] = "-";
        }
        if (typeof(keyObj.userId) !== "string") {
          keyObj.userId = EnigmailData.convertGpgToUnicode(listRow[USERID_ID]);
          if (TRUSTLEVELS_SORTED.indexOf(listRow[KEY_TRUST_ID]) < TRUSTLEVELS_SORTED.indexOf(keyObj.keyTrust)) {
            // reduce key trust if primary UID is less trusted than public key
            keyObj.keyTrust = listRow[KEY_TRUST_ID];
          }
        }

        EnigmailLog.DEBUG(`gnupg.js: appendKeyItems: new user ID ${listRow[USERID_ID]}\n`);
        keyObj.userIds.push({
          userId: EnigmailData.convertGpgToUnicode(listRow[USERID_ID]),
          keyTrust: listRow[KEY_TRUST_ID],
          uidFpr: listRow[UID_ID],
          type: "uid"
        });

        break;
      case "sub":
        keyObj.subKeys.push({
          keyId: listRow[KEY_ID],
          expiry: EnigmailTime.getDateTime(listRow[EXPIRY_ID], true, false),
          expiryTime: Number(listRow[EXPIRY_ID]),
          keyTrust: listRow[KEY_TRUST_ID],
          keyUseFor: listRow[KEY_USE_FOR_ID],
          keySize: listRow[KEY_SIZE_ID],
          algoSym: ALGO_SYMBOL[listRow[KEY_ALGO_ID]],
          created: EnigmailTime.getDateTime(listRow[CREATED_ID], true, false),
          type: "sub"
        });
        break;
      case "uat":
        if (listRow[USERID_ID].indexOf("1 ") === 0) {
          const userId = EnigmailLocale.getString("userAtt.photo");
          keyObj.userIds.push({
            userId: userId,
            keyTrust: listRow[KEY_TRUST_ID],
            uidFpr: listRow[UID_ID],
            type: "uat",
            uatNum: uatNum
          });
          keyObj.photoAvailable = true;
          ++uatNum;
        }
        break;
    }
  }
}

function createKeyObj(lineArr) {
  let keyObj = {};
  if (lineArr[ENTRY_ID] === "pub" || lineArr[ENTRY_ID] === "sec") {
    keyObj.keyId = lineArr[KEY_ID];
    keyObj.expiryTime = Number(lineArr[EXPIRY_ID]);
    keyObj.created = EnigmailTime.getDateTime(lineArr[CREATED_ID], true, false);
    keyObj.keyTrust = lineArr[KEY_TRUST_ID];
    keyObj.keyUseFor = lineArr[KEY_USE_FOR_ID];
    keyObj.ownerTrust = lineArr[OWNERTRUST_ID];
    keyObj.algoSym = ALGO_SYMBOL[lineArr[KEY_ALGO_ID]];
    keyObj.keySize = lineArr[KEY_SIZE_ID];
    keyObj.userIds = [];
    keyObj.subKeys = [];
    keyObj.fpr = "";
    keyObj.userId = null;
    keyObj.photoAvailable = false;
  }
  keyObj.type = lineArr[ENTRY_ID];

  return keyObj;
}


/**
 * Handle secret keys for which gpg 2.0 does not create a public key record
 */
function appendUnkownSecretKey(keyId, aKeyList, startIndex, keyList) {
  EnigmailLog.DEBUG("gnupg.js: appendUnkownSecretKey: keyId: " + keyId + "\n");

  let keyListStr = [];

  for (let j = startIndex; j < aKeyList.length && (j === startIndex || aKeyList[j].substr(0, 4) !== "sec:"); j++) {
    keyListStr.push(aKeyList[j]);
  }

  // make the listing a "public" key
  keyListStr[0] = keyListStr[0].replace(/^sec:/, "pub:");

  appendKeyItems(keyListStr, keyList);
}
