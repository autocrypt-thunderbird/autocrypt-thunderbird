/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailCard"];



ChromeUtils.import("chrome://enigmail/content/modules/log.jsm"); /*global EnigmailLog: false */
ChromeUtils.import("chrome://enigmail/content/modules/execution.jsm"); /*global EnigmailExecution: false */
ChromeUtils.import("chrome://enigmail/content/modules/gpg.jsm"); /*global EnigmailGpg: false */

var EnigmailCard = {
  getCardStatus: function(exitCodeObj, errorMsgObj) {
    EnigmailLog.DEBUG("card.jsm: EnigmailCard.getCardStatus\n");
    const GPG_ADDITIONAL_OPTIONS=["--no-verbose", "--status-fd", "2", "--fixed-list-mode", "--with-colons", "--card-status"];
    const args = EnigmailGpg.getStandardArgs(false).concat(GPG_ADDITIONAL_OPTIONS);
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
