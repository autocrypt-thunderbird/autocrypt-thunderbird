/*global Components: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-invalid-this: 0 */

"use strict";

const Cu = Components.utils;
const Ci = Components.interfaces;
const Cc = Components.classes;

Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/errorHandling.jsm"); /*global EnigmailErrorHandling: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/autoKeyLocate.jsm"); /*global EnigmailAutoKeyLocate: false */

function onLoad() {
  document.getElementById("dialog.status2").value = "Locating Keys...";
  let progressDlg = document.getElementById("dialog.progress");
  progressDlg.setAttribute("mode", "undetermined");

  let inArg = window.arguments[0].toAddr.toString();
  EnigmailLog.DEBUG("enigmailLocateKeys.js: to: " + inArg + "\n");

  if (inArg.trim() !== "") {
    let listener = EnigmailExecution.newSimpleListener(null, function(ret) {
      EnigmailLog.DEBUG(listener.stdoutData);
      EnigmailLog.DEBUG(listener.stderrData);
      let imported = listener.stdoutData.includes("IMPORT_OK");
      if (ret === 0 && imported) {
        EnigmailKeyRing.clearCache();
        window.arguments[1] = {
          repeatEvaluation: true,
          foundKeys: true
        };
      }
      progressDlg.setAttribute("value", 100);
      progressDlg.setAttribute("mode", "normal");
      window.close();
    });

    Promise.all(inArg.split(",").map(function(x) {
      return EnigmailAutoKeyLocate.checkUser(x.trim());
    })).then(function(checks) {
      let toCheck = [];
      let emails = inArg.split(",");

      EnigmailLog.DEBUG("enigmailLocateKeys.js: checks " + checks.toString() + "\n");

      for (let i = 0; i < checks.length; i++) {
        if (checks[i]) {
          EnigmailLog.DEBUG("enigmailLocateKeys.js: recheck " + emails[i] + "\n");
          toCheck.push(emails[i]);
        }
        else {
          EnigmailLog.DEBUG("enigmailLocateKeys.js: skip check " + emails[i] + "\n");
        }
      }

      if (emails.length > 0) {
        let proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath, [
          "--verbose",
          "--status-fd", "1",
          "--auto-key-locate", "wkd",
          "--locate-keys"
        ].concat(toCheck), false, window, listener, {
          value: null
        });
      }
    });
  }
  else {
    progressDlg.setAttribute("value", 100);
    progressDlg.setAttribute("mode", "normal");
    window.close();
  }
}

function onAccept() {}

function onUnload() {}
