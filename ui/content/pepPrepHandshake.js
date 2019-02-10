/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";





var EnigmailPEPAdapter = ChromeUtils.import("chrome://enigmail/content/modules/pEpAdapter.jsm").EnigmailPEPAdapter;
var EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailWindows = ChromeUtils.import("chrome://enigmail/content/modules/windows.jsm").EnigmailWindows;
var EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;

/*
Arguments:
- addresses (array of email addresses)
- direction: 0 - incoming / 1 - outgoing
- myself: email-address of my identity
- parentWindow: nsIWindow of parent window of the handshake dialog
- onComplete: function to call upon closing the handshake dialog
*/

var isCancelled = false;

function onLoad() {
  let argsObj = window.arguments[0];
  EnigmailPEPAdapter.getRatingsForEmails(argsObj.addresses).then(
    function _ok(identities) {
      if (isCancelled) return;

      EnigmailTimer.setTimeout(function _f() {
        EnigmailWindows.pepHandshake(argsObj.parentWindow, argsObj.direction, argsObj.myself, identities);
        argsObj.onComplete();
      }, 5);
      window.close();
    }
  ).catch(function _err(data) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("msgCompose.internalError"));
    window.close();
  });
}

function onCancel() {
  isCancelled = true;
}
