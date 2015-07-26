/*global Components: false, EnigmailLog: false, EnigmailLocale: false, EnigmailData: false, EnigmailCore: false */
/*jshint -W097 */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/locale.jsm");
Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/core.jsm");

const EXPORTED_SYMBOLS = ["EnigmailErrorHandling"];

const nsIEnigmail = Ci.nsIEnigmail;

const gStatusFlags = {
  GOODSIG: nsIEnigmail.GOOD_SIGNATURE,
  BADSIG: nsIEnigmail.BAD_SIGNATURE,
  ERRSIG: nsIEnigmail.UNVERIFIED_SIGNATURE,
  EXPSIG: nsIEnigmail.EXPIRED_SIGNATURE,
  REVKEYSIG: nsIEnigmail.GOOD_SIGNATURE,
  EXPKEYSIG: nsIEnigmail.EXPIRED_KEY_SIGNATURE,
  KEYEXPIRED: nsIEnigmail.EXPIRED_KEY,
  KEYREVOKED: nsIEnigmail.REVOKED_KEY,
  NO_PUBKEY: nsIEnigmail.NO_PUBKEY,
  NO_SECKEY: nsIEnigmail.NO_SECKEY,
  IMPORTED: nsIEnigmail.IMPORTED_KEY,
  INV_RECP: nsIEnigmail.INVALID_RECIPIENT,
  MISSING_PASSPHRASE: nsIEnigmail.MISSING_PASSPHRASE,
  BAD_PASSPHRASE: nsIEnigmail.BAD_PASSPHRASE,
  BADARMOR: nsIEnigmail.BAD_ARMOR,
  NODATA: nsIEnigmail.NODATA,
  ERROR: nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.DECRYPTION_FAILED,
  DECRYPTION_FAILED: nsIEnigmail.DECRYPTION_FAILED,
  DECRYPTION_OKAY: nsIEnigmail.DECRYPTION_OKAY,
  TRUST_UNDEFINED: nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_NEVER: nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_MARGINAL: nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_FULLY: nsIEnigmail.TRUSTED_IDENTITY,
  TRUST_ULTIMATE: nsIEnigmail.TRUSTED_IDENTITY,
  CARDCTRL: nsIEnigmail.CARDCTRL,
  SC_OP_FAILURE: nsIEnigmail.SC_OP_FAILURE,
  UNKNOWN_ALGO: nsIEnigmail.UNKNOWN_ALGO,
  SIG_CREATED: nsIEnigmail.SIG_CREATED,
  END_ENCRYPTION: nsIEnigmail.END_ENCRYPTION,
  INV_SGNR: 0x100000000,
  IMPORT_OK: 0x200000000
};

function handleError(c) {
  // special treatment for some ERROR messages (currently only check_hijacking)
  var lineSplit = c.statusLine.split(/ +/);
  if (lineSplit.length > 0 &&
    lineSplit[1] === "check_hijacking") {
    // TODO: we might display some warning to the user
    c.retStatusObj.extendedStatus += "invalid_gpg_agent ";
    return true;
  }
  else {
    return false;
  }
}

function missingPassphrase(c) {
  c.statusFlags |= Ci.nsIEnigmail.MISSING_PASSPHRASE;
  c.statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
  c.flag = 0;
  EnigmailLog.DEBUG("enigmailCommon.jsm: parseErrorOutput: missing passphrase" + "\n");
  c.retStatusObj.statusMsg += "Missing Passphrase\n";
}

function invalidSignature(c) {
  var lineSplit = c.statusLine.split(/ +/);
  c.statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
  c.flag = 0;
  EnigmailLog.DEBUG("enigmailCommon.jsm: parseErrorOutput: detected invalid sender: " + lineSplit[2] + " / code: " + lineSplit[1] + "\n");
  c.retStatusObj.statusMsg += EnigmailLocale.getString("gnupg.invalidKey.desc", [lineSplit[2]]);
}

function importOk(c) {
  var lineSplit = c.statusLine.split(/ +/);
  if (lineSplit.length > 1) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: parseErrorOutput: key imported: " + lineSplit[2] + "\n");
  }
  else {
    EnigmailLog.DEBUG("enigmailCommon.jsm: parseErrorOutput: key without FPR imported\n");
  }

  let importFlag = Number(lineSplit[1]);
  if (importFlag & (1 | 2 | 8)) {
    EnigmailCore.getKeyRing().invalidateUserIdList();
  }
}

function unverifiedSignature(c) {
  var lineSplit = c.statusLine.split(/ +/);
  if (lineSplit.length > 7 && lineSplit[7] == "4") {
    c.flag = Ci.nsIEnigmail.UNKNOWN_ALGO;
  }
}

function noData(c) {
  // Recognize only "NODATA 1"
  if (c.statusLine.search(/NODATA 1\b/) < 0) {
    c.flag = 0;
  }
}

function decryptionFailed(c) {
  c.inDecryptionFailed = true;
}

function cardControl(c) {
  var lineSplit = c.statusLine.split(/ +/);
  if (lineSplit[1] == "3") {
    c.detectedCard = lineSplit[2];
  }
  else {
    c.errCode = Number(lineSplit[1]);
    if (c.errCode == 1) c.requestedCard = lineSplit[2];
  }
}

function setupFailureLookup() {
  var result = {};
  result[Ci.nsIEnigmail.DECRYPTION_FAILED] = decryptionFailed;
  result[Ci.nsIEnigmail.NODATA] = noData;
  result[Ci.nsIEnigmail.CARDCTRL] = cardControl;
  result[Ci.nsIEnigmail.UNVERIFIED_SIGNATURE] = unverifiedSignature;
  result[Ci.nsIEnigmail.MISSING_PASSPHRASE] = missingPassphrase;
  result[gStatusFlags.INV_SGNR] = invalidSignature;
  result[gStatusFlags.IMPORT_OK] = importOk;
  return result;
}

function ignore() {}

const failureLookup = setupFailureLookup();

function handleFailure(c, errorFlag) {
  c.flag = gStatusFlags[errorFlag]; // yields known flag or undefined

  (failureLookup[c.flag] || ignore)(c);

  // if known flag, story it in our status
  if (c.flag) {
    c.statusFlags |= c.flag;
  }
}

function newContext(errOutput, retStatusObj) {
  retStatusObj.statusMsg = "";
  retStatusObj.extendedStatus = "";
  retStatusObj.blockSeparation = "";

  return {
    errOutput: errOutput,
    retStatusObj: retStatusObj,
    errArray: [],
    statusArray: [],
    errCode: 0,
    detectedCard: null,
    requestedCard: null,
    errorMsg: "",
    statusPat: /^\[GNUPG:\] /,
    statusFlags: 0,
    plaintextCount: 0,
    withinCryptoMsg: false,
    cryptoStartPat: /^BEGIN_DECRYPTION/,
    cryptoEndPat: /^END_DECRYPTION/,
    plaintextPat: /^PLAINTEXT /,
    plaintextLengthPat: /^PLAINTEXT_LENGTH /
  };
}

function splitErrorOutput(errOutput) {
  var errLines = errOutput.split(/\r?\n/);

  // Discard last null string, if any
  if ((errLines.length > 1) && !errLines[errLines.length - 1]) {
    errLines.pop();
  }

  return errLines;
}

function parseErrorLine(errLine, c) {
  if (errLine.search(c.statusPat) === 0) {
    // status line
    c.statusLine = errLine.replace(c.statusPat, "");
    c.statusArray.push(c.statusLine);

    // extract first word as flag
    var matches = c.statusLine.match(/^((\w+)\b)/);

    if (matches && (matches.length > 1)) {
      var isError = (matches[1] == "ERROR");
      (isError ? handleError : handleFailure)(c, matches[1]);
    }
  }
  else {
    // non-status line (details of previous status command)
    c.errArray.push(errLine);
    // save details of DECRYPTION_FAILED message ass error message
    if (c.inDecryptionFailed) {
      c.errorMsg += errLine;
    }
  }
}

function detectForgedInsets(c) {
  // detect forged message insets
  for (var j = 0; j < c.statusArray.length; j++) {
    if (c.statusArray[j].search(c.cryptoStartPat) === 0) {
      c.withinCryptoMsg = true;
    }
    else if (c.withinCryptoMsg && c.statusArray[j].search(c.cryptoEndPat) === 0) {
      c.withinCryptoMsg = false;
    }
    else if (c.statusArray[j].search(c.plaintextPat) === 0) {
      ++c.plaintextCount;
      if ((c.statusArray.length > j + 1) && (c.statusArray[j + 1].search(c.plaintextLengthPat) === 0)) {
        var matches = c.statusArray[j + 1].match(/(\w+) (\d+)/);
        if (matches.length >= 3) {
          c.retStatusObj.blockSeparation += (c.withinCryptoMsg ? "1" : "0") + ":" + matches[2] + " ";
        }
      }
      else {
        // strange: we got PLAINTEXT XX, but not PLAINTEXT_LENGTH XX
        c.retStatusObj.blockSeparation += (c.withinCryptoMsg ? "1" : "0") + ":0 ";
      }
    }
  }
  if (c.plaintextCount > 1) {
    c.statusFlags |= (Ci.nsIEnigmail.PARTIALLY_PGP | Ci.nsIEnigmail.DECRYPTION_FAILED | Ci.nsIEnigmail.BAD_SIGNATURE);
  }
}

function buildErrorMessageForCardCtrl(c, errCode, detectedCard) {
  var errorMsg = "";
  switch (errCode) {
    case 1:
      if (detectedCard) {
        errorMsg = EnigmailLocale.getString("sc.wrongCardAvailable", [c.detectedCard, c.requestedCard]);
      }
      else {
        errorMsg = EnigmailLocale.getString("sc.insertCard", [c.requestedCard]);
      }
      break;
    case 2:
      errorMsg = EnigmailLocale.getString("sc.removeCard");
      break;
    case 4:
      errorMsg = EnigmailLocale.getString("sc.noCardAvailable");
      break;
    case 5:
      errorMsg = EnigmailLocale.getString("sc.noReaderAvailable");
      break;
  }
  return errorMsg;
}

function parseErrorOutputWith(c) {
  EnigmailLog.DEBUG("enigmailCommon.jsm: parseErrorOutput: status message: \n" + c.errOutput + "\n");

  c.errLines = splitErrorOutput(c.errOutput);

  // parse all error lines
  c.inDecryptionFailed = false; // to save details of encryption failed messages
  for (var j = 0; j < c.errLines.length; j++) {
    var errLine = c.errLines[j];
    parseErrorLine(errLine, c);
  }

  detectForgedInsets(c);

  c.retStatusObj.blockSeparation = c.retStatusObj.blockSeparation.replace(/ $/, "");
  c.retStatusObj.statusFlags = c.statusFlags;
  if (c.retStatusObj.statusMsg.length === 0) c.retStatusObj.statusMsg = c.statusArray.join("\n");
  if (c.errorMsg.length === 0) {
    c.errorMsg = c.errArray.map(EnigmailData.convertGpgToUnicode, EnigmailData).join("\n");
  }

  if ((c.statusFlags & Ci.nsIEnigmail.CARDCTRL) && c.errCode > 0) {
    c.errorMsg = buildErrorMessageForCardCtrl(c, c.errCode, c.detectedCard);
    c.statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
  }

  EnigmailLog.DEBUG("enigmailCommon.jsm: parseErrorOutput: statusFlags = " + EnigmailData.bytesToHex(EnigmailData.pack(c.statusFlags, 4)) + "\n");

  EnigmailLog.DEBUG("enigmailCommon.jsm: parseErrorOutput(): return with c.errorMsg = " + c.errorMsg + "\n");
  return c.errorMsg;
}

var EnigmailErrorHandling = {
  parseErrorOutput: function(errOutput, retStatusObj) {
    var context = newContext(errOutput, retStatusObj);
    return parseErrorOutputWith(context);
  }
};
