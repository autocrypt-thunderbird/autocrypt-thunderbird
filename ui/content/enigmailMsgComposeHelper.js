/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

/**
 * helper functions for message composition
 */

var EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
var EnigmailFuncs = ChromeUtils.import("chrome://enigmail/content/modules/funcs.jsm").EnigmailFuncs;
var EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
var EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
// const EnigmailAutocrypt = ChromeUtils.import("chrome://enigmail/content/modules/autocrypt.jsm").EnigmailAutocrypt;

if (!Enigmail) var Enigmail = {};

Enigmail.hlp = {

  /* try to find valid key to passed email addresses (or keys)
   * @return: list of all found key (with leading "0x") or null
   *          details in details parameter
   */
  validKeysForAllRecipients: function(emails) {
    EnigmailLog.DEBUG("=====> validKeysForAllRecipients()\n");
    EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): emails='" + emails.join(',') + "'\n");

    // let EnigmailAutocrypt.determineAutocryptRecommendations(emails);

    EnigmailLog.DEBUG("=====> validKeysForAllRecipients()\n");
    return true;
  }
};
