/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailCard"];

const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */

const EnigmailCard = {
  getCardStatus: function(exitCodeObj, errorMsgObj) {
    EnigmailLog.DEBUG("card.jsm: EnigmailCard.getCardStatus\n");
    const args = EnigmailGpg.getStandardArgs(false).
    concat(["--status-fd", "2", "--fixed-list-mode", "--with-colons", "--card-status"]);
    const statusMsgObj = {};
    const statusFlagsObj = {};

    const outputTxt = EnigmailExecution.execCmd(EnigmailGpg.agentPath, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    if ((exitCodeObj.value === 0) && !outputTxt) {
      exitCodeObj.value = -1;
      return "";
    }

    return outputTxt;
  }
};
