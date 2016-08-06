/*global Components: false, escape: false, unescape: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailAttachment"];

const Cu = Components.utils;

Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/passwords.jsm"); /*global EnigmailPassword: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */

const EnigmailAttachment = {
  getFileName: function(parent, byteData) {
    EnigmailLog.DEBUG("attachment.jsm: getFileName\n");

    const args = EnigmailGpg.getStandardArgs(true).
    concat(EnigmailPassword.command()).
    concat(["--decrypt"]);

    const listener = EnigmailExecution.newSimpleListener(
      function _stdin(pipe) {
        EnigmailLog.DEBUG("attachment.jsm: getFileName: _stdin\n");
        pipe.write(byteData);
        pipe.write("\n");
        pipe.close();
      });

    listener.stdout = function(data) {};

    const proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath, args, false, parent, listener, {});

    if (!proc) {
      return null;
    }

    proc.wait();

    const matches = listener.stderrData.match(/^(\[GNUPG:\] PLAINTEXT [0-9]+ [0-9]+ )(.*)$/m);
    if (matches && (matches.length > 2)) {
      var filename = matches[2];
      if (filename.indexOf(" ") > 0) {
        filename = filename.replace(/ .*$/, "");
      }
      return EnigmailData.convertToUnicode(unescape(filename), "utf-8");
    }
    else {
      return null;
    }
  }
};
