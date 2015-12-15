/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailVerifyAttachment"];

const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/time.jsm"); /*global EnigmailTime: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/decryption.jsm"); /*global EnigmailDecryption: false */

const Ci = Components.interfaces;

const nsIEnigmail = Ci.nsIEnigmail;

const EnigmailVerifyAttachment = {
  attachment: function(parent, verifyFile, sigFile, statusFlagsObj, errorMsgObj) {
    EnigmailLog.DEBUG("verify.jsm: EnigmailVerifyAttachment.attachment:\n");

    const verifyFilePath = EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePathReadonly(verifyFile.QueryInterface(Ci.nsIFile)));
    const sigFilePath = EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePathReadonly(sigFile.QueryInterface(Ci.nsIFile)));

    const args = EnigmailGpg.getStandardArgs(true).
    concat(["--verify", sigFilePath, verifyFilePath]);

    const listener = EnigmailExecution.newSimpleListener();

    const proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath, args, false, parent, listener, statusFlagsObj);

    if (!proc) {
      return -1;
    }

    proc.wait();

    const retObj = {};
    EnigmailDecryption.decryptMessageEnd(listener.stderrData, listener.exitCode, 1, true, true, nsIEnigmail.UI_INTERACTIVE, retObj);

    if (listener.exitCode === 0) {
      const detailArr = retObj.sigDetails.split(/ /);
      const dateTime = EnigmailTime.getDateTime(detailArr[2], true, true);
      const msg1 = retObj.errorMsg.split(/\n/)[0];
      const msg2 = EnigmailLocale.getString("keyAndSigDate", ["0x" + retObj.keyId.substr(-8, 8), dateTime]);
      errorMsgObj.value = msg1 + "\n" + msg2;
    }
    else {
      errorMsgObj.value = retObj.errorMsg;
    }

    return listener.exitCode;
  },

  registerOn: function(target) {
    target.verifyAttachment = EnigmailVerifyAttachment.attachment;
  }
};
