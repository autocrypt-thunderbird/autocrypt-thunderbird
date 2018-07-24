/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailVerifyAttachment"];

const Cu = Components.utils;

Cu.import("chrome://enigmail/content/modules/log.jsm"); /*global EnigmailLog: false */
Cu.import("chrome://enigmail/content/modules/files.jsm"); /*global EnigmailFiles: false */
Cu.import("chrome://enigmail/content/modules/cryptoAPI.jsm"); /*global EnigmailCryptoAPI: false */

const Ci = Components.interfaces;

var EnigmailVerifyAttachment = {
  attachment: function(verifyFile, sigFile) {
    EnigmailLog.DEBUG("verify.jsm: EnigmailVerifyAttachment.attachment:\n");

    const verifyFilePath = EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePathReadonly(verifyFile.QueryInterface(Ci.nsIFile)));
    const sigFilePath = EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePathReadonly(sigFile.QueryInterface(Ci.nsIFile)));
    const cApi = EnigmailCryptoAPI();
    return cApi.verifyAttachment(verifyFilePath, sigFilePath);

  }
};
