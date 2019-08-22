/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptDecryption"];

const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptArmor = ChromeUtils.import("chrome://autocrypt/content/modules/armor.jsm").AutocryptArmor;
const AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
const AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;
const AutocryptDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").AutocryptDialog;
const AutocryptFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").AutocryptFiles;
const AutocryptKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").AutocryptKeyRing;
const AutocryptConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").AutocryptConstants;
const AutocryptFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").AutocryptFuncs;
const AutocryptCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").AutocryptCryptoAPI;

const STATUS_ERROR = AutocryptConstants.BAD_SIGNATURE | AutocryptConstants.DECRYPTION_FAILED;
const STATUS_DECRYPTION_OK = AutocryptConstants.DECRYPTION_OKAY;
const STATUS_GOODSIG = AutocryptConstants.GOOD_SIGNATURE;

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

var AutocryptDecryption = {
  isReady: function(win) {
    return (AutocryptCore.getService(win));
  },

  getFromAddr: function(win) {
    AutocryptLog.DEBUG(`decryption.jsm: getFromAddr() ${win.gFolderDisplay}\n`);
    if (!win.gFolderDisplay) {
      AutocryptLog.DEBUG(`decryption.jsm: getFromAddr(): error: gFolderDisplay unavailable\n`);
      return false;
    }
    if (!win.gFolderDisplay.selectedMessage) {
      AutocryptLog.DEBUG(`decryption.jsm: getFromAddr(): error: no selected message\n`);
      return false;
    }
    const from_addr = win.gFolderDisplay.selectedMessage.author;
    try {
      let from_addr_stripped = AutocryptFuncs.stripEmail(from_addr);
      if (from_addr_stripped.search(/[a-zA-Z0-9]@.*[\(\)]/) >= 0) {
        AutocryptLog.DEBUG(`decryption.jsm: getFromAddr(): error: bad address format\n`);
        return false;
      }
      AutocryptLog.DEBUG(`decryption.jsm: getFromAddr(): ok (${from_addr_stripped})\n`);
      return from_addr_stripped;
    } catch (ex) {
      AutocryptLog.DEBUG(`decryption.jsm: getFromAddr(): error: failed to parse address\n`);
      return false;
    }
  },

  /**
   *  Decrypts a PGP ciphertext and returns the the plaintext
   *
   *in  @parent a window object
   *in  @uiFlags see flag options in AutocryptConstants, UI_INTERACTIVE, UI_ALLOW_KEY_IMPORT
   *in  @cipherText a string containing a PGP Block
   *out @signatureObj
   *out @exitCodeObj contains the exit code
   *out @statusFlagsObj see status flags in nslAutocrypt.idl, GOOD_SIGNATURE, BAD_SIGNATURE
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
    const esvc = AutocryptCore.getAutocryptService();

    AutocryptLog.DEBUG("decryption.jsm: decryptMessage(" + cipherText.length + " bytes, " + uiFlags + ")\n");

    if (!cipherText)
      return "";

    var interactive = uiFlags & AutocryptConstants.UI_INTERACTIVE;
    var allowImport = uiFlags & AutocryptConstants.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & AutocryptConstants.UI_UNVERIFIED_ENC_OK;
    var oldSignature = signatureObj.value;

    AutocryptLog.DEBUG("decryption.jsm: decryptMessage: oldSignature=" + oldSignature + "\n");

    signatureObj.value = "";
    exitCodeObj.value = -1;
    statusFlagsObj.value = 0;
    keyIdObj.value = "";
    userIdObj.value = "";
    errorMsgObj.value = "";

    var beginIndexObj = {};
    var endIndexObj = {};
    var indentStrObj = {};
    var blockType = AutocryptArmor.locateArmoredBlock(cipherText, 0, "", beginIndexObj, endIndexObj, indentStrObj);
    if (!blockType || blockType == "SIGNATURE") {
      // return without displaying a message
      return "";
    }

    var publicKey = (blockType == "PUBLIC KEY BLOCK");
    if (publicKey) {
      errorMsgObj.value = AutocryptLocale.getString("keyInMessageBody");
      statusFlagsObj.value |= AutocryptConstants.DISPLAY_MESSAGE;
      statusFlagsObj.value |= AutocryptConstants.INLINE_KEY;

      return "";
    }

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
      AutocryptLog.DEBUG("decryption.jsm: decryptMessage: apply Outlook empty line workaround\n");
      pgpBlock = pgpBlock.replace(/\r?\n\r?\n/g, "\n");
    }

    var tail = cipherText.substr(endIndexObj.value + 1,
      cipherText.length - endIndexObj.value - 1);

    var newSignature = "";

    if (verifyOnly) {
      newSignature = AutocryptArmor.extractSignaturePart(pgpBlock, AutocryptConstants.SIGNATURE_ARMOR);
      if (oldSignature && (newSignature != oldSignature)) {
        AutocryptLog.ERROR("enigmail.js: Autocrypt.decryptMessage: Error - signature mismatch " + newSignature + "\n");
        errorMsgObj.value = AutocryptLocale.getString("sigMismatch");
        statusFlagsObj.value |= AutocryptConstants.DISPLAY_MESSAGE;

        return "";
      }
    }

    if (!AutocryptCore.getService(parent)) {
      AutocryptLog.ERROR("decryption.jsm: decryptMessage: not yet initialized\n");
      errorMsgObj.value = AutocryptLocale.getString("notInit");
      statusFlagsObj.value |= AutocryptConstants.DISPLAY_MESSAGE;
      return "";
    }

    const cApi = AutocryptCryptoAPI();
    let result = cApi.sync(async function() {
      let openPgpSecretKeys = await AutocryptKeyRing.getAllSecretKeys();
      return cApi.decrypt(pgpBlock, openPgpSecretKeys);
    });

    var plainText = AutocryptData.getUnicodeData(result.decryptedData);
    exitCodeObj.value = result.exitCode;
    statusFlagsObj.value = result.statusFlags;
    errorMsgObj.value = result.errorMsg;

    // do not return anything if gpg signales DECRYPTION_FAILED
    // (which could be possible in case of MDC errors)
    if ((uiFlags & AutocryptConstants.UI_IGNORE_MDC_ERROR) &&
      (result.statusFlags & AutocryptConstants.MISSING_MDC)) {
      AutocryptLog.DEBUG("decryption.jsm: decryptMessage: ignoring MDC error\n");
    }
    else if (result.statusFlags & AutocryptConstants.DECRYPTION_FAILED) {
      plainText = "";
    }

    userIdObj.value = result.userId;
    keyIdObj.value = result.keyId;
    sigDetailsObj.value = result.sigDetails;
    if (encToDetailsObj) {
      encToDetailsObj.value = result.encToDetails;
    }
    blockSeparationObj.value = result.blockSeparation;

    if (tail.search(/\S/) >= 0) {
      statusFlagsObj.value |= AutocryptConstants.PARTIALLY_PGP;
    }


    if (exitCodeObj.value === 0) {
      // Normal return

      var doubleDashSeparator = false;
      try {
        doubleDashSeparator = true;
      }
      catch (ex) {}

      if (doubleDashSeparator && (plainText.search(/(\r|\n)-- +(\r|\n)/) < 0)) {
        // Workaround for MsgCompose stripping trailing spaces from sig separator
        plainText = plainText.replace(/(\r|\n)--(\r|\n)/, "$1-- $2");
      }

      statusFlagsObj.value |= AutocryptConstants.DISPLAY_MESSAGE;

      if (verifyOnly && indentStrObj.value) {
        plainText = plainText.replace(/^/gm, indentStrObj.value);
      }

      return AutocryptDecryption.inlineInnerVerification(parent, uiFlags, plainText,
        statusObjectFrom(signatureObj, exitCodeObj, statusFlagsObj, keyIdObj, userIdObj,
          sigDetailsObj, errorMsgObj, blockSeparationObj, encToDetailsObj));
    }

    var pubKeyId = keyIdObj.value;

    if (statusFlagsObj.value & AutocryptConstants.BAD_SIGNATURE) {
      if (verifyOnly && indentStrObj.value) {
        // Probably replied message that could not be verified
        errorMsgObj.value = AutocryptLocale.getString("unverifiedReply") + "\n\n" + errorMsgObj.value;
        return "";
      }

      // Return bad signature (for checking later)
      signatureObj.value = newSignature;

    }
    else if (pubKeyId &&
      (statusFlagsObj.value & AutocryptConstants.UNVERIFIED_SIGNATURE)) {

      var innerKeyBlock;
      if (verifyOnly) {
        // Search for indented public key block in signed message
        var innerBlockType = AutocryptArmor.locateArmoredBlock(pgpBlock, 0, "- ", beginIndexObj, endIndexObj, indentStrObj);
        if (innerBlockType == "PUBLIC KEY BLOCK") {

          innerKeyBlock = pgpBlock.substr(beginIndexObj.value,
            endIndexObj.value - beginIndexObj.value + 1);

          innerKeyBlock = innerKeyBlock.replace(/- -----/g, "-----");

          statusFlagsObj.value |= AutocryptConstants.INLINE_KEY;
          AutocryptLog.DEBUG("decryption.jsm: decryptMessage: innerKeyBlock found\n");
        }
      }

      if (allowImport) {

        var importedKey = false;

        if (innerKeyBlock) {
          var importErrorMsgObj = {};
          var exitStatus = AutocryptKeyRing.importKey(parent, true, innerKeyBlock,
            pubKeyId, importErrorMsgObj);

          importedKey = (exitStatus === 0);

          if (exitStatus > 0) {
            AutocryptDialog.alert(parent, AutocryptLocale.getString("cantImport") + importErrorMsgObj.value);
          }
        }

        if (importedKey) {
          // Recursive call; note that AutocryptConstants.UI_ALLOW_KEY_IMPORT is unset
          // to break the recursion
          var uiFlagsDeep = interactive ? AutocryptConstants.UI_INTERACTIVE : 0;
          signatureObj.value = "";
          return AutocryptDecryption.decryptMessage(parent, uiFlagsDeep, pgpBlock,
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
    AutocryptLog.DEBUG("decryption.jsm: inlineInnerVerification()\n");

    if (text && text.indexOf("-----BEGIN PGP SIGNED MESSAGE-----") === 0) {
      var status = newStatusObject();
      var newText = AutocryptDecryption.decryptMessage(parent, uiFlags, text,
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
};
