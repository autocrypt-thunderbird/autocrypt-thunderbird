/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


// TODO: remove when changing to bootstrapped addon
const APP_STARTUP = 1; // 	The application is starting up.
const APP_SHUTDOWN = 2; // 	The application is shutting down.
const ADDON_ENABLE = 3; // 	The add-on is being enabled.
const ADDON_DISABLE = 4; // 	The add-on is being disabled. (Also sent during uninstallation)
const ADDON_INSTALL = 5; // 	The add-on is being installed.
const ADDON_UNINSTALL = 6; // 	The add-on is being uninstalled.
const ADDON_UPGRADE = 7; // 	The add-on is being upgraded.
const ADDON_DOWNGRADE = 8; // 	The add-on is being downgraded.

function install() {}

function uninstall() {}

function startup(data, reason) {
  const Cu = Components.utils;
  const {
    EnigmailCore
  } = Cu.import("resource://enigmail/core.jsm", {});
  const {
    EnigmailAmPrefsService
  } = Cu.import("resource://enigmail/amPrefsService.jsm", {});
  const {
    EnigmailPgpmimeHander
  } = Cu.import("resource://enigmail/pgpmimeHandler.jsm", {});
  const {
    EnigmailOverlays
  } = Cu.import("resource://enigmail/overlays.jsm", {});

  EnigmailAmPrefsService.startup(reason);
  EnigmailCore.startup(reason);
  EnigmailPgpmimeHander.startup(reason);
  EnigmailOverlays.startup(reason);
}

function shutdown(reason) {
  if (reason === APP_SHUTDOWN) return;

  const Cu = Components.utils;
  Cu.import("resource://enigmail/amPrefsService.jsm"); /*global EnigmailAmPrefsService: false */
  Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
  Cu.import("resource://enigmail/pgpmimeHandler.jsm"); /*global EnigmailPgpmimeHander: false */

  EnigmailAmPrefsService.shutdown(reason);
  EnigmailCore.shutdown(reason);
  EnigmailPgpmimeHander.shutdown(reason);
}

startup({}, APP_STARTUP);
