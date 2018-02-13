/*global Components: false, EnigmailData: false, EnigmailLog: false, EnigmailPrefs: false, EnigmailLocale: false, EnigmailArmor: false, EnigmailExecution: false, EnigmailDialog: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailDecryption"];

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/prefs.jsm");
Cu.import("resource://enigmail/armor.jsm");
Cu.import("resource://enigmail/locale.jsm");
Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/execution.jsm");
Cu.import("resource://enigmail/dialog.jsm");
Cu.import("resource://enigmail/httpProxy.jsm"); /*global EnigmailHttpProxy: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/errorHandling.jsm"); /*global EnigmailErrorHandling: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Cu.import("resource://enigmail/passwords.jsm"); /*global EnigmailPassword: false */
Cu.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */

const STATUS_ERROR = EnigmailConstants.BAD_SIGNATURE | EnigmailConstants.DECRYPTION_FAILED;
const STATUS_DECRYPTION_OK = EnigmailConstants.DECRYPTION_OKAY;
const STATUS_GOODSIG = EnigmailConstants.GOOD_SIGNATURE;

const NS_WRONLY = 0x02;

function statusObjectFrom(signatureObj, exitCodeObj, statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj, encToDetailsObj) {
  return {
    signature: signatureObj,
    exitCode: exitCodeObj,
    statusFlags: statusFlagsObj,
    keyId: keyIdObj,
    userId: userIdObj,
    sigDetails: sigDetailsObj,
    message: errorMsgObj,
    blockSeparation: blockSeparationObj,
    encToDetails: encToDetailsObj
  };
}

function newStatusObject() {
  return statusObjectFrom({
    value: ""
  }, {}, {}, {}, {}, {}, {}, {}, {});
}

var EnigmailDecryption = {
  decryptMessageStart: function(win, verifyOnly, noOutput, listener,
    statusFlagsObj, errorMsgObj, mimeSignatureFile,
    maxOutputLength) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageStart: verifyOnly=" + verifyOnly + "\n");

    if (!EnigmailCore.getService(win)) {
      EnigmailLog.ERROR("enigmailCommon.jsm: decryptMessageStart: not yet initialized\n");
      errorMsgObj.value = EnigmailLocale.getString("notInit");
      return null;
    }

    if (EnigmailKeyRing.isGeneratingKey()) {
      errorMsgObj.value = EnigmailLocale.getString("notComplete");
      return null;
    }

    var args = EnigmailGpg.getStandardArgs(true);

    var keyserver = EnigmailPrefs.getPref("autoKeyRetrieve");
    if (keyserver && keyserver !== "") {
      keyserver = keyserver.trim();
      args.push("--keyserver-options");
      var keySrvArgs = "auto-key-retrieve";
      var srvProxy = EnigmailHttpProxy.getHttpProxy(keyserver);
      if (srvProxy) {
        keySrvArgs += ",http-proxy=" + srvProxy;
      }
      args.push(keySrvArgs);
      args.push("--keyserver");
      args.push(keyserver);
    }

    if (EnigmailGpg.getGpgFeature("supports-sender") &&
      win && win.gFolderDisplay && win.gFolderDisplay.selectedMessage) {
      var fromAddr = win.gFolderDisplay.selectedMessage.author;
      try {
        fromAddr = EnigmailFuncs.stripEmail(fromAddr);
      }
      catch (ex) {
        fromAddr = false;
      }
      if (fromAddr) {
        args.push("--sender");
        args.push(fromAddr.toLowerCase());
      }
    }

    if (noOutput) {
      args.push("--verify");

      if (mimeSignatureFile) {
        args.push(mimeSignatureFile);
        args.push("-");
      }

    }
    else {
      if (maxOutputLength) {
        args.push("--max-output");
        args.push(String(maxOutputLength));
      }

      args.push("--decrypt");
    }

    var proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath,
      args, !verifyOnly, win,
      listener, statusFlagsObj);

    if (statusFlagsObj.value & EnigmailConstants.MISSING_PASSPHRASE) {
      EnigmailLog.ERROR("enigmailCommon.jsm: decryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = EnigmailLocale.getString("noPassphrase");
      return null;
    }

    return proc;
  },


  decryptMessageEnd: function(stderrStr, exitCode, outputLen, verifyOnly, noOutput, uiFlags, retStatusObj) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: uiFlags=" + uiFlags + ", verifyOnly=" + verifyOnly + ", noOutput=" + noOutput + "\n");

    stderrStr = stderrStr.replace(/\r\n/g, "\n");
    EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: stderrStr=\n" + stderrStr + "\n");
    var interactive = uiFlags & EnigmailConstants.UI_INTERACTIVE;
    var pgpMime = uiFlags & EnigmailConstants.UI_PGP_MIME;
    var allowImport = uiFlags & EnigmailConstants.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & EnigmailConstants.UI_UNVERIFIED_ENC_OK;
    var j;

    retStatusObj.statusFlags = 0;
    retStatusObj.errorMsg = "";
    retStatusObj.blockSeparation = "";

    var errorMsg = EnigmailErrorHandling.parseErrorOutput(stderrStr, retStatusObj);
    if (retStatusObj.statusFlags & STATUS_ERROR) {
      retStatusObj.errorMsg = errorMsg;
    }
    else {
      retStatusObj.errorMsg = "";
    }

    if (pgpMime) {
      retStatusObj.statusFlags |= verifyOnly ? EnigmailConstants.PGP_MIME_SIGNED : EnigmailConstants.PGP_MIME_ENCRYPTED;
    }

    var statusMsg = retStatusObj.statusMsg;
    exitCode = EnigmailExecution.fixExitCode(exitCode, retStatusObj);
    if ((exitCode === 0) && !noOutput && !outputLen &&
      ((retStatusObj.statusFlags & (STATUS_DECRYPTION_OK | STATUS_GOODSIG)) === 0)) {
      exitCode = -1;
    }

    if (retStatusObj.statusFlags & EnigmailConstants.DISPLAY_MESSAGE && retStatusObj.extendedStatus.search(/\bdisp:/) >= 0) {
      EnigmailDialog.alert(null, statusMsg);
      return -1;
    }

    var errLines;
    if (statusMsg) {
      errLines = statusMsg.split(/\r?\n/);
    }
    else {
      // should not really happen ...
      errLines = stderrStr.split(/\r?\n/);
    }

    // possible STATUS Patterns (see GPG dod DETAILS.txt):
    // one of these should be set for a signature:
    var goodsigPat = /GOODSIG (\w{16}) (.*)$/i;
    var badsigPat = /BADSIG (\w{16}) (.*)$/i;
    var expsigPat = /EXPSIG (\w{16}) (.*)$/i;
    var expkeysigPat = /EXPKEYSIG (\w{16}) (.*)$/i;
    var revkeysigPat = /REVKEYSIG (\w{16}) (.*)$/i;
    var errsigPat = /ERRSIG (\w{16}) (.*)$/i;
    // additional infos for good signatures:
    var validSigPat = /VALIDSIG (\w+) (.*) (\d+) (.*)/i;
    // hint for a certain key id:
    var userIdHintPat = /USERID_HINT (\w{16}) (.*)$/i;
    // to find out for which recipients the email was encrypted:
    var encToPat = /ENC_TO (\w{16}) (.*)$/i;

    var matches;

    var signed = false;
    var goodOrExpOrRevSignature = false;
    var sigKeyId = ""; // key of sender
    var sigUserId = ""; // user ID of sender
    var sigDetails = "";
    var encToDetails = "";
    var encToArray = []; // collect ENC_TO lines here

    for (j = 0; j < errLines.length; j++) {
      EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: process: " + errLines[j] + "\n");

      // ENC_TO entry
      // - collect them for later processing to print details
      matches = errLines[j].match(encToPat);
      if (matches && (matches.length > 2)) {
        encToArray.push("0x" + matches[1]);
      }

      // USERID_HINT entry
      // - NOTE: NO END of loop
      // ERROR: wrong to set userId because ecom is NOT the sender:
      //matches = errLines[j].match(userIdHintPat);
      //if (matches && (matches.length > 2)) {
      //  sigKeyId = matches[1];
      //  sigUserId = matches[2];
      //}

      // check for one of the possible SIG entries:
      // GOODSIG entry
      matches = errLines[j].match(goodsigPat);
      if (matches && (matches.length > 2)) {
        if (signed) {
          EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
        }
        signed = true;
        goodOrExpOrRevSignature = true;
        sigKeyId = matches[1];
        sigUserId = matches[2];
      }
      else {
        // BADSIG entry => signature found but bad
        matches = errLines[j].match(badsigPat);
        if (matches && (matches.length > 2)) {
          if (signed) {
            EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
          }
          signed = true;
          goodOrExpOrRevSignature = false;
          sigKeyId = matches[1];
          sigUserId = matches[2];
        }
        else {
          // EXPSIG entry => expired signature found
          matches = errLines[j].match(expsigPat);
          if (matches && (matches.length > 2)) {
            if (signed) {
              EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
            }
            signed = true;
            goodOrExpOrRevSignature = true;
            sigKeyId = matches[1];
            sigUserId = matches[2];
          }
          else {
            // EXPKEYSIG entry => signature found but key expired
            matches = errLines[j].match(expkeysigPat);
            if (matches && (matches.length > 2)) {
              if (signed) {
                EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
              }
              signed = true;
              goodOrExpOrRevSignature = true;
              sigKeyId = matches[1];
              sigUserId = matches[2];
            }
            else {
              // REVKEYSIG entry => signature found but key revoked
              matches = errLines[j].match(revkeysigPat);
              if (matches && (matches.length > 2)) {
                if (signed) {
                  EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                }
                signed = true;
                goodOrExpOrRevSignature = true;
                sigKeyId = matches[1];
                sigUserId = matches[2];
              }
              else {
                // ERRSIG entry => signature found but key not usable or unavailable
                matches = errLines[j].match(errsigPat);
                if (matches && (matches.length > 2)) {
                  if (signed) {
                    EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                  }
                  signed = true;
                  goodOrExpOrRevSignature = false;
                  sigKeyId = matches[1];
                  // no user id with ecom istatus entry
                }
              }
            }
          }
        }
      }

    } // end loop of processing errLines

    if (goodOrExpOrRevSignature) {
      for (j = 0; j < errLines.length; j++) {
        matches = errLines[j].match(validSigPat);
        if (matches && (matches.length > 4)) {
          if (matches[4].length == 40)
          // in case of several subkeys refer to the main key ID.
          // Only works with PGP V4 keys (Fingerprint length ==40)
            sigKeyId = matches[4].substr(-16);
        }
        if (matches && (matches.length > 2)) {
          sigDetails = errLines[j].substr(9);
          break;
        }
      }
    }

    if (sigUserId && sigKeyId && EnigmailPrefs.getPref("displaySecondaryUid")) {
      let keyObj = EnigmailKeyRing.getKeyById(sigKeyId);
      if (keyObj) {
        if (keyObj.photoAvailable) {
          retStatusObj.statusFlags |= EnigmailConstants.PHOTO_AVAILABLE;
        }
        sigUserId = EnigmailKeyRing.getValidUids(sigKeyId).join("\n");
      }
    }
    else if (sigUserId) {
      sigUserId = EnigmailData.convertToUnicode(sigUserId, "UTF-8");
    }

    // add list of keys used for encryption if known (and their user IDs) if known
    // Parsed status messages are something like (here the German version):
    //    [GNUPG:] ENC_TO AAAAAAAAAAAAAAAA 1 0
    //    [GNUPG:] ENC_TO 5B820D2D4553884F 16 0
    //    [GNUPG:] ENC_TO 37904DF2E631552F 1 0
    //    [GNUPG:] ENC_TO BBBBBBBBBBBBBBBB 1 0
    //    gpg: verschlüsselt mit 3072-Bit RSA Schlüssel, ID BBBBBBBB, erzeugt 2009-11-28
    //          "Joe Doo <joe.doo@domain.de>"
    //    [GNUPG:] NO_SECKEY E71712DF47BBCC40
    //    gpg: verschlüsselt mit RSA Schlüssel, ID AAAAAAAA
    //    [GNUPG:] NO_SECKEY AAAAAAAAAAAAAAAA
    if (encToArray.length > 0) {
      // for each key also show an associated user ID if known:
      for (var encIdx = 0; encIdx < encToArray.length; ++encIdx) {
        var localKeyId = encToArray[encIdx];
        // except for ID 00000000, which signals hidden keys
        if (localKeyId != "0x0000000000000000") {
          let localKey = EnigmailKeyRing.getKeyById(localKeyId);
          if (localKey) {
            encToArray[encIdx] += " (" + localKey.userId + ")";
          }
        }
        else {
          encToArray[encIdx] = EnigmailLocale.getString("hiddenKey");
        }
      }
      encToDetails = "\n  " + encToArray.join(",\n  ") + "\n";
    }

    retStatusObj.userId = sigUserId;
    retStatusObj.keyId = sigKeyId;
    retStatusObj.sigDetails = sigDetails;
    retStatusObj.encToDetails = encToDetails;

    if (signed) {
      if (goodOrExpOrRevSignature) {
        retStatusObj.errorMsg = EnigmailLocale.getString("prefGood", [sigUserId]);
        /* + ", " + EnigmailLocale.getString("keyId") + " 0x" + sigKeyId.substring(8,16); */
      }
      else {
        if (sigUserId.length > 0) {
          retStatusObj.errorMsg = EnigmailLocale.getString("prefBad", [sigUserId]);
        }
        if (!exitCode)
          exitCode = 1;
      }
    }

    if (retStatusObj.statusFlags & EnigmailConstants.UNVERIFIED_SIGNATURE) {
      retStatusObj.keyId = EnigmailKey.extractPubkey(statusMsg);

      if (retStatusObj.statusFlags & EnigmailConstants.DECRYPTION_OKAY) {
        exitCode = 0;
      }
    }

    if (exitCode !== 0) {
      // Error processing
      EnigmailLog.DEBUG("enigmailCommon.jsm: decryptMessageEnd: command execution exit code: " + exitCode + "\n");
    }

    return exitCode;
  },

  /**
   *  Decrypts a PGP ciphertext and returns the the plaintext
   *
   *in  @parent a window object
   *in  @uiFlags see flag options in EnigmailConstants.idl, UI_INTERACTIVE, UI_ALLOW_KEY_IMPORT
   *in  @cipherText a string containing a PGP Block
   *out @signatureObj
   *out @exitCodeObj contains the exit code
   *out @statusFlagsObj see status flags in nslEnigmail.idl, GOOD_SIGNATURE, BAD_SIGNATURE
   *out @keyIdObj holds the key id
   *out @userIdObj holds the user id
   *out @sigDetailsObj
   *out @errorMsgObj  error string
   *out @blockSeparationObj
   *out @encToDetailsObj  returns in details, which keys the mesage was encrypted for (ENC_TO entries)
   *
   * @return string plaintext ("" if error)
   *
   */
  decryptMessage: function(parent, uiFlags, cipherText,
    signatureObj, exitCodeObj,
    statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj,
    blockSeparationObj, encToDetailsObj) {
    const esvc = EnigmailCore.getEnigmailService();

    EnigmailLog.DEBUG("enigmail.js: Enigmail.decryptMessage: " + cipherText.length + " bytes, " + uiFlags + "\n");

    if (!cipherText)
      return "";

    var interactive = uiFlags & EnigmailConstants.UI_INTERACTIVE;
    var allowImport = uiFlags & EnigmailConstants.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & EnigmailConstants.UI_UNVERIFIED_ENC_OK;
    var oldSignature = signatureObj.value;

    EnigmailLog.DEBUG("enigmail.js: Enigmail.decryptMessage: oldSignature=" + oldSignature + "\n");

    signatureObj.value = "";
    exitCodeObj.value = -1;
    statusFlagsObj.value = 0;
    keyIdObj.value = "";
    userIdObj.value = "";
    errorMsgObj.value = "";

    var beginIndexObj = {};
    var endIndexObj = {};
    var indentStrObj = {};
    var blockType = EnigmailArmor.locateArmoredBlock(cipherText, 0, "", beginIndexObj, endIndexObj, indentStrObj);
    if (!blockType || blockType == "SIGNATURE") {
      // return without displaying a message
      return "";
    }

    var publicKey = (blockType == "PUBLIC KEY BLOCK");

    var verifyOnly = (blockType == "SIGNED MESSAGE");

    var pgpBlock = cipherText.substr(beginIndexObj.value,
      endIndexObj.value - beginIndexObj.value + 1);

    if (indentStrObj.value) {
      var indentRegexp = new RegExp("^" + indentStrObj.value, "gm");
      pgpBlock = pgpBlock.replace(indentRegexp, "");
      if (indentStrObj.value.substr(-1) == " ") {
        var indentRegexpStr = "^" + indentStrObj.value.replace(/ $/m, "$");
        indentRegexp = new RegExp(indentRegexpStr, "gm");
        pgpBlock = pgpBlock.replace(indentRegexp, "");
      }
    }

    // HACK to better support messages from Outlook: if there are empty lines, drop them
    if (pgpBlock.search(/MESSAGE-----\r?\n\r?\nVersion/) >= 0) {
      EnigmailLog.DEBUG("enigmail.js: Enigmail.decryptMessage: apply Outlook empty line workaround\n");
      pgpBlock = pgpBlock.replace(/\r?\n\r?\n/g, "\n");
    }

    var head = cipherText.substr(0, beginIndexObj.value);
    var tail = cipherText.substr(endIndexObj.value + 1,
      cipherText.length - endIndexObj.value - 1);

    if (publicKey) {
      if (!allowImport) {
        errorMsgObj.value = EnigmailLocale.getString("keyInMessageBody");
        statusFlagsObj.value |= EnigmailConstants.DISPLAY_MESSAGE;
        statusFlagsObj.value |= EnigmailConstants.INLINE_KEY;

        return "";
      }

      // Import public key
      exitCodeObj.value = EnigmailKeyRing.importKey(parent, true, pgpBlock, "",
        errorMsgObj);
      if (exitCodeObj.value === 0) {
        statusFlagsObj.value |= EnigmailConstants.IMPORTED_KEY;
      }
      return "";
    }

    var newSignature = "";

    if (verifyOnly) {
      newSignature = EnigmailArmor.extractSignaturePart(pgpBlock, EnigmailConstants.SIGNATURE_ARMOR);
      if (oldSignature && (newSignature != oldSignature)) {
        EnigmailLog.ERROR("enigmail.js: Enigmail.decryptMessage: Error - signature mismatch " + newSignature + "\n");
        errorMsgObj.value = EnigmailLocale.getString("sigMismatch");
        statusFlagsObj.value |= EnigmailConstants.DISPLAY_MESSAGE;

        return "";
      }
    }

    var startErrorMsgObj = {};
    var noOutput = false;

    var listener = EnigmailExecution.newSimpleListener(
      function _stdin(pipe) {
        pipe.write(pgpBlock);
        pipe.close();
      });

    var maxOutput = pgpBlock.length * 100; // limit output to 100 times message size
    // to avoid DoS attack
    var proc = EnigmailDecryption.decryptMessageStart(parent, verifyOnly, noOutput, listener,
      statusFlagsObj, startErrorMsgObj,
      null, maxOutput);

    if (!proc) {
      errorMsgObj.value = startErrorMsgObj.value;
      statusFlagsObj.value |= EnigmailConstants.DISPLAY_MESSAGE;

      return "";
    }

    // Wait for child to close
    proc.wait();

    var plainText = EnigmailData.getUnicodeData(listener.stdoutData);

    var retStatusObj = {};
    var exitCode = EnigmailDecryption.decryptMessageEnd(EnigmailData.getUnicodeData(listener.stderrData), listener.exitCode,
      plainText.length, verifyOnly, noOutput,
      uiFlags, retStatusObj);
    exitCodeObj.value = exitCode;
    statusFlagsObj.value = retStatusObj.statusFlags;
    errorMsgObj.value = retStatusObj.errorMsg;

    // do not return anything if gpg signales DECRYPTION_FAILED
    // (which could be possible in case of MDC errors)
    if (retStatusObj.statusFlags & EnigmailConstants.DECRYPTION_FAILED) {
      plainText = "";
    }

    userIdObj.value = retStatusObj.userId;
    keyIdObj.value = retStatusObj.keyId;
    sigDetailsObj.value = retStatusObj.sigDetails;
    if (encToDetailsObj) {
      encToDetailsObj.value = retStatusObj.encToDetails;
    }
    blockSeparationObj.value = retStatusObj.blockSeparation;

    if ((head.search(/\S/) >= 0) ||
      (tail.search(/\S/) >= 0)) {
      statusFlagsObj.value |= EnigmailConstants.PARTIALLY_PGP;
    }


    if (exitCodeObj.value === 0) {
      // Normal return

      var doubleDashSeparator = false;
      try {
        doubleDashSeparator = EnigmailPrefs.getPrefBranch().getBoolPref("doubleDashSeparator");
      }
      catch (ex) {}

      if (doubleDashSeparator && (plainText.search(/(\r|\n)-- +(\r|\n)/) < 0)) {
        // Workaround for MsgCompose stripping trailing spaces from sig separator
        plainText = plainText.replace(/(\r|\n)--(\r|\n)/, "$1-- $2");
      }

      statusFlagsObj.value |= EnigmailConstants.DISPLAY_MESSAGE;

      if (verifyOnly && indentStrObj.value) {
        plainText = plainText.replace(/^/gm, indentStrObj.value);
      }

      return EnigmailDecryption.inlineInnerVerification(parent, uiFlags, plainText,
        statusObjectFrom(signatureObj, exitCodeObj, statusFlagsObj, keyIdObj, userIdObj,
          sigDetailsObj, errorMsgObj, blockSeparationObj, encToDetailsObj));
    }

    var pubKeyId = keyIdObj.value;

    if (statusFlagsObj.value & EnigmailConstants.BAD_SIGNATURE) {
      if (verifyOnly && indentStrObj.value) {
        // Probably replied message that could not be verified
        errorMsgObj.value = EnigmailLocale.getString("unverifiedReply") + "\n\n" + errorMsgObj.value;
        return "";
      }

      // Return bad signature (for checking later)
      signatureObj.value = newSignature;

    }
    else if (pubKeyId &&
      (statusFlagsObj.value & EnigmailConstants.UNVERIFIED_SIGNATURE)) {

      var innerKeyBlock;
      if (verifyOnly) {
        // Search for indented public key block in signed message
        var innerBlockType = EnigmailArmor.locateArmoredBlock(pgpBlock, 0, "- ", beginIndexObj, endIndexObj, indentStrObj);
        if (innerBlockType == "PUBLIC KEY BLOCK") {

          innerKeyBlock = pgpBlock.substr(beginIndexObj.value,
            endIndexObj.value - beginIndexObj.value + 1);

          innerKeyBlock = innerKeyBlock.replace(/- -----/g, "-----");

          statusFlagsObj.value |= EnigmailConstants.INLINE_KEY;
          EnigmailLog.DEBUG("enigmail.js: Enigmail.decryptMessage: innerKeyBlock found\n");
        }
      }

      if (allowImport) {

        var importedKey = false;

        if (innerKeyBlock) {
          var importErrorMsgObj = {};
          var exitStatus = EnigmailKeyRing.importKey(parent, true, innerKeyBlock,
            pubKeyId, importErrorMsgObj);

          importedKey = (exitStatus === 0);

          if (exitStatus > 0) {
            EnigmailDialog.alert(parent, EnigmailLocale.getString("cantImport") + importErrorMsgObj.value);
          }
        }

        if (importedKey) {
          // Recursive call; note that EnigmailConstants.UI_ALLOW_KEY_IMPORT is unset
          // to break the recursion
          var uiFlagsDeep = interactive ? EnigmailConstants.UI_INTERACTIVE : 0;
          signatureObj.value = "";
          return EnigmailDecryption.decryptMessage(parent, uiFlagsDeep, pgpBlock,
            signatureObj, exitCodeObj, statusFlagsObj,
            keyIdObj, userIdObj, sigDetailsObj, errorMsgObj);
        }

      }

      if (plainText && !unverifiedEncryptedOK) {
        // Append original PGP block to unverified message
        plainText = "-----BEGIN PGP UNVERIFIED MESSAGE-----\r\n" + plainText +
          "-----END PGP UNVERIFIED MESSAGE-----\r\n\r\n" + pgpBlock;
      }

    }

    return verifyOnly ? "" : plainText;
  },

  inlineInnerVerification: function(parent, uiFlags, text, statusObject) {
    EnigmailLog.DEBUG("enigmail.js: Enigmail.inlineInnerVerification\n");

    if (text && text.indexOf("-----BEGIN PGP SIGNED MESSAGE-----") === 0) {
      var status = newStatusObject();
      var newText = EnigmailDecryption.decryptMessage(parent, uiFlags, text,
        status.signature, status.exitCode, status.statusFlags, status.keyId, status.userId,
        status.sigDetails, status.message, status.blockSeparation, status.encToDetails);
      if (status.exitCode.value === 0) {
        text = newText;
        // merge status into status object:
        statusObject.statusFlags.value = statusObject.statusFlags.value | status.statusFlags.value;
        statusObject.keyId.value = status.keyId.value;
        statusObject.userId.value = status.userId.value;
        statusObject.sigDetails.value = status.sigDetails.value;
        statusObject.message.value = status.message.value;
        // we don't merge encToDetails
      }
    }

    return text;
  },

  decryptAttachment: function(parent, outFile, displayName, byteData,
    exitCodeObj, statusFlagsObj, errorMsgObj) {
    const esvc = EnigmailCore.getEnigmailService();

    EnigmailLog.DEBUG("enigmail.js: Enigmail.decryptAttachment: parent=" + parent + ", outFileName=" + outFile.path + "\n");

    let attachmentHead = byteData.substr(0, 200);
    if (attachmentHead.match(/-----BEGIN PGP \w{5,10} KEY BLOCK-----/)) {
      // attachment appears to be a PGP key file

      if (EnigmailDialog.confirmDlg(parent, EnigmailLocale.getString("attachmentPgpKey", [displayName]),
          EnigmailLocale.getString("keyMan.button.import"), EnigmailLocale.getString("dlg.button.view"))) {

        let preview = EnigmailKey.getKeyListFromKeyBlock(byteData, errorMsgObj);
        exitCodeObj.keyList = preview;
        let exitStatus = 0;

        if (errorMsgObj.value === "") {
          if (preview.length > 0) {
            if (preview.length == 1) {
              exitStatus = EnigmailDialog.confirmDlg(parent, EnigmailLocale.getString("doImportOne", [preview[0].name, preview[0].id]));
            }
            else {
              exitStatus = EnigmailDialog.confirmDlg(parent,
                EnigmailLocale.getString("doImportMultiple", [
                  preview.map(function(a) {
                    return "\t" + a.name + " (" + a.id + ")";
                  }).
                  join("\n")
                ]));
            }

            if (exitStatus) {
              exitCodeObj.value = EnigmailKeyRing.importKey(parent, false, byteData, "", errorMsgObj);
              statusFlagsObj.value = EnigmailConstants.IMPORTED_KEY;
            }
            else {
              exitCodeObj.value = 0;
              statusFlagsObj.value = EnigmailConstants.DISPLAY_MESSAGE;
            }
          }
        }
      }
      else {
        exitCodeObj.value = 0;
        statusFlagsObj.value = EnigmailConstants.DISPLAY_MESSAGE;
      }
      return true;
    }

    //var outFileName = EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePathReadonly(outFile.QueryInterface(Ci.nsIFile), NS_WRONLY));

    let args = EnigmailGpg.getStandardArgs(true);
    args.push("--yes");
    args = args.concat(EnigmailPassword.command());
    args.push("-d");


    statusFlagsObj.value = 0;

    let listener = EnigmailExecution.newSimpleListener(
      function _stdin(pipe) {
        pipe.write(byteData);
        pipe.close();
      });


    let proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath, args, false, parent,
      listener, statusFlagsObj);

    if (!proc) {
      return false;
    }

    // Wait for child STDOUT to close
    proc.wait();

    let statusMsgObj = {};
    let cmdLineObj = {};

    exitCodeObj.value = EnigmailExecution.execEnd(listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);

    if (listener.stdoutData.length > 0) {
      return EnigmailFiles.writeFileContents(outFile, listener.stdoutData);
    }

    return false;
  }
};
