/*global Components: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

function install() {}

function uninstall() {}

function startup(data, reason) {
  Components.utils.import("resource://enigmail/prefs-service.jsm"); /*global EnigmailAmPrefsService: false */
  EnigmailAmPrefsService.startup();
}

function shutdown(reason) {}

startup();
