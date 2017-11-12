/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

function install() {}

function uninstall() {}

function startup(data, reason) {
  const Cu = Components.utils;
  Cu.import("resource://enigmail/amPrefsService.jsm"); /*global EnigmailAmPrefsService: false */
  EnigmailAmPrefsService.startup(reason);
}

function shutdown(reason) {
  const Cu = Components.utils;
  Cu.import("resource://enigmail/amPrefsService.jsm"); /*global EnigmailAmPrefsService: false */
  EnigmailAmPrefsService.shutdown(reason);
}

startup();
