/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/****
   Private sub-module to gnupg.js for handling key lists from GnuPG
 ****/

"use strict";

var EXPORTED_SYMBOLS = ["obtainKeyList", "createKeyObj", "getPhotoFileFromGnuPG"];

const EnigmailTime = Cu.import("chrome://enigmail/content/modules/time.jsm").EnigmailTime;
const EnigmailGpg = Cu.import("chrome://enigmail/content/modules/gpg.jsm").EnigmailGpg;
const EnigmailExecution = Cu.import("chrome://enigmail/content/modules/execution.jsm").EnigmailExecution;
const EnigmailLog = Cu.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailTrust = Cu.import("chrome://enigmail/content/modules/trust.jsm").EnigmailTrust;
const EnigmailData = Cu.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailLocale = Cu.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailOS = Cu.import("chrome://enigmail/content/modules/os.jsm").EnigmailOS;
const EnigmailFiles = Cu.import("chrome://enigmail/content/modules/files.jsm").EnigmailFiles;

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

const NS_RDONLY = 0x01;
const NS_WRONLY = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE = 0x20;
const STANDARD_FILE_PERMS = 0x180; // equals 0600

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID = "@mozilla.org/network/file-output-stream;1";


/**
 * Get key list from GnuPG.
 *
 * @param {Array of String} onlyKeys: only load data for specified key IDs
 *
 * @return {Promise<Array Object>}:
 * key objects as specifiedin EnigmailKeyObj.constructor
 */
async function obtainKeyList(onlyKeys = null) {
  EnigmailLog.DEBUG("gnupg-keylist.jsm: obtainKeyList()\n");

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

  EnigmailLog.DEBUG(`gnupg-keylist.jsm: obtainKeyList: #lines: ${pubKeyList.length}\n`);
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
  EnigmailLog.DEBUG("gnupg-keylist.jsm: appendKeyItems()\n");
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
  EnigmailLog.DEBUG(`gnupg-keylist.jsm: appendUnkownSecretKey: keyId: ${keyId}\n`);

  let keyListStr = [];

  for (let j = startIndex; j < aKeyList.length && (j === startIndex || aKeyList[j].substr(0, 4) !== "sec:"); j++) {
    keyListStr.push(aKeyList[j]);
  }

  // make the listing a "public" key
  keyListStr[0] = keyListStr[0].replace(/^sec:/, "pub:");

  appendKeyItems(keyListStr, keyList);
}


/**
 * Extract a photo ID from a key, store it as file and return the file object.

 * @param {String} keyId:       Key ID / fingerprint
 * @param {Number} photoNumber: number of the photo on the key, starting with 0
 * @param {Object} exitCodeObj: value holds exitCode (0 = success)
 * @param {Object} errorMsgObj: value holds errorMsg
 *
 * @return {nsIFile} object or null in case no data / error.
 */
function getPhotoFileFromGnuPG(keyId, photoNumber, exitCodeObj, errorMsgObj) {
  EnigmailLog.DEBUG(`gnupg-keylist.jsm: getPhotoFileFromGnuPG, keyId=${keyId} photoNumber=${photoNumber}\n`);

  const GPG_ADDITIONAL_OPTIONS = ["--no-secmem-warning", "--no-verbose", "--no-auto-check-trustdb",
    "--batch", "--no-tty", "--no-verbose", "--status-fd", "1", "--attribute-fd", "2",
    "--fixed-list-mode", "--list-keys", keyId
  ];
  const args = EnigmailGpg.getStandardArgs(false).concat(GPG_ADDITIONAL_OPTIONS);

  const photoDataObj = {};
  const outputTxt = EnigmailExecution.simpleExecCmd(EnigmailGpg.agentPath, args, exitCodeObj, photoDataObj);

  if (!outputTxt) {
    exitCodeObj.value = -1;
    return null;
  }

  if (EnigmailOS.isDosLike && EnigmailGpg.getGpgFeature("windows-photoid-bug")) {
    // workaround for error in gpg
    photoDataObj.value = photoDataObj.value.replace(/\r\n/g, "\n");
  }

  // [GNUPG:] ATTRIBUTE A053069284158FC1E6770BDB57C9EB602B0717E2 2985
  let foundPicture = -1;
  let skipData = 0;
  let imgSize = -1;
  const statusLines = outputTxt.split(/[\n\r+]/);

  for (let i = 0; i < statusLines.length; i++) {
    const matches = statusLines[i].match(/\[GNUPG:\] ATTRIBUTE ([A-F\d]+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)/);
    if (matches && matches[3] == "1") {
      // attribute is an image
      foundPicture++;
      if (foundPicture === photoNumber) {
        imgSize = Number(matches[2]);
        break;
      }
      else {
        skipData += Number(matches[2]);
      }
    }
  }

  if (foundPicture >= 0 && foundPicture === photoNumber) {
    if (photoDataObj.value.search(/^gpg: /) === 0) {
      // skip disturbing gpg output
      let i = photoDataObj.value.search(/\n/) + 1;
      skipData += i;
    }

    const pictureData = photoDataObj.value.substr(16 + skipData, imgSize);
    if (!pictureData.length) {
      return null;
    }

    try {
      const flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;
      const picFile = EnigmailFiles.getTempDirObj();

      picFile.append(keyId + ".jpg");
      picFile.createUnique(picFile.NORMAL_FILE_TYPE, STANDARD_FILE_PERMS);

      const fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
      fileStream.init(picFile, flags, STANDARD_FILE_PERMS, 0);
      if (fileStream.write(pictureData, pictureData.length) !== pictureData.length) {
        fileStream.close();
        throw Components.results.NS_ERROR_FAILURE;
      }

      fileStream.flush();
      fileStream.close();

      // delete picFile upon exit
      let extAppLauncher = Cc["@mozilla.org/mime;1"].getService(Ci.nsPIExternalAppLauncher);
      extAppLauncher.deleteTemporaryFileOnExit(picFile);
      return picFile;
    }
    catch (ex) {
      exitCodeObj.value = -1;
      return null;
    }
  }
  return null;
}
