/*global Components: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global dump: false */

dump("## bootstrap start\n");

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/prefs-service.jsm"); /*global EnigmailAmPrefsService: false */

function startup(data, reason) {
  EnigmailAmPrefsService.startup();
}


startup();

dump("## bootstrap end\n");
