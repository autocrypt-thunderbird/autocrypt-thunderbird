/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

/*global Components: false */

Components.utils.import("chrome://enigmail/content/modules/log.jsm"); /* global EnigmailLog: false */


window.addEventListener("load-enigmail", function _enigmail_msgPrintLoad() {
    EnigmailLog.DEBUG("enigmailMsgPrintOverlay.js: enigMsgPrintLoad\n");

    // functionality to be added ...
  },
  false);

window.addEventListener("unload", function _enigmail_msgPrintUnload() {
    EnigmailLog.DEBUG("enigmailMsgPrintOverlay.js: enigMsgPrintUnload\n");

    // functionality to be added ...
  },
  false);
