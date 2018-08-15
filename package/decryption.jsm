/*global Components: false, EnigmailData: false, EnigmailLog: false, EnigmailPrefs: false, EnigmailLocale: false, EnigmailArmor: false, EnigmailExecution: false, EnigmailDialog: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailDecryption"];

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("chrome://enigmail/content/modules/core.jsm"); /*global EnigmailCore: false */
Cu.import("chrome://enigmail/content/modules/data.jsm");
Cu.import("chrome://enigmail/content/modules/log.jsm");
Cu.import("chrome://enigmail/content/modules/prefs.jsm");
Cu.import("chrome://enigmail/content/modules/armor.jsm");
Cu.import("chrome://enigmail/content/modules/locale.jsm");
Cu.import("chrome://enigmail/content/modules/data.jsm");
Cu.import("chrome://enigmail/content/modules/execution.jsm");
Cu.import("chrome://enigmail/content/modules/dialog.jsm");
Cu.import("chrome://enigmail/content/modules/httpProxy.jsm"); /*global EnigmailHttpProxy: false */
Cu.import("chrome://enigmail/content/modules/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("chrome://enigmail/content/modules/files.jsm"); /*global EnigmailFiles: false */
Cu.import("chrome://enigmail/content/modules/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("chrome://enigmail/content/modules/errorHandling.jsm"); /*global EnigmailErrorHandling: false */
Cu.import("chrome://enigmail/content/modules/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("chrome://enigmail/content/modules/key.jsm"); /*global EnigmailKey: false */
Cu.import("chrome://enigmail/content/modules/passwords.jsm"); /*global EnigmailPassword: false */
Cu.import("chrome://enigmail/content/modules/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("chrome://enigmail/content/modules/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("chrome://enigmail/content/modules/cryptoAPI/gnupg-decryption.jsm"); /* global GnuPGDecryption: false */

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
  isReady: function(win) {
    return (EnigmailCore.getService(win)) && (!EnigmailKeyRing.isGeneratingKey());
  },

  decryptMessageStart: function(win, verifyOnly, noOutput, listener,
    statusFlagsObj, errorMsgObj, mimeSignatureFile,
    maxOutputLength) {
    EnigmailLog.DEBUG("decryption.jsm: decryptMessageStart: verifyOnly=" + verifyOnly + "\n");

    let logFile = EnigmailErrorHandling.getTempLogFile();
    var keyserver = EnigmailPrefs.getPref("autoKeyRetrieve");
    var fromAddr = false;
    if (win && win.gFolderDisplay && win.gFolderDisplay.selectedMessage) {
      fromAddr = win.gFolderDisplay.selectedMessage.author;
      try {
        fromAddr = EnigmailFuncs.stripEmail(fromAddr);
        if (fromAddr.search(/[a-zA-Z0-9]@.*[\(\)]/) >= 0) {
          fromAddr = false;
        }
      }
      catch (ex) {
        fromAddr = false;
      }
    }
    var args = GnuPGDecryption.getDecryptionArgs({
      keyserver: keyserver,
      keyserverProxy: EnigmailHttpProxy.getHttpProxy(keyserver),
      fromAddr: fromAddr,
      noOutput: noOutput,
      mimeSignatureFile: mimeSignatureFile,
      maxOutputLength: maxOutputLength,
      logFile: logFile
    });

    if (!listener) {
      listener = {};
    }
    if ("done" in listener) {
      listener.outerDone = listener.done;
    }

    listener.done = function(exitCode) {
      EnigmailErrorHandling.appendLogFileToDebug(logFile);
      if (this.outerDone) {
        this.outerDone(exitCode);
      }
    };

    let proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath,
      args, !verifyOnly, win,
      listener, statusFlagsObj);

    if (statusFlagsObj.value & EnigmailConstants.MISSING_PASSPHRASE) {
      EnigmailLog.ERROR("decryption.jsm: decryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = EnigmailLocale.getString("noPassphrase");
      return null;
    }

    return proc;
  },


  /**
   *  Decrypts a PGP ciphertext and returns the the plaintext
   *
   *in  @parent a window object
   *in  @uiFlags see flag options in EnigmailConstants, UI_INTERACTIVE, UI_ALLOW_KEY_IMPORT
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

    if (!EnigmailCore.getService(parent)) {
      EnigmailLog.ERROR("decryption.jsm: decryptMessage: not yet initialized\n");
      errorMsgObj.value = EnigmailLocale.getString("notInit");
      statusFlagsObj.value |= EnigmailConstants.DISPLAY_MESSAGE;
      return "";
    }

    if (EnigmailKeyRing.isGeneratingKey()) {
      errorMsgObj.value = EnigmailLocale.getString("notComplete");
      statusFlagsObj.value |= EnigmailConstants.DISPLAY_MESSAGE;
      return "";
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
    var exitCode = GnuPGDecryption.decryptMessageEnd(EnigmailData.getUnicodeData(listener.stderrData), listener.exitCode,
      plainText.length, verifyOnly, noOutput,
      uiFlags, retStatusObj);
    exitCodeObj.value = exitCode;
    statusFlagsObj.value = retStatusObj.statusFlags;
    errorMsgObj.value = retStatusObj.errorMsg;

    // do not return anything if gpg signales DECRYPTION_FAILED
    // (which could be possible in case of MDC errors)
    if ((uiFlags & EnigmailConstants.UI_IGNORE_MDC_ERROR) &&
      (retStatusObj.statusFlags & EnigmailConstants.MISSING_MDC)) {
      EnigmailLog.DEBUG("enigmail.js: Enigmail.decryptMessage: ignoring MDC error\n");
    }
    else if (retStatusObj.statusFlags & EnigmailConstants.DECRYPTION_FAILED) {
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
