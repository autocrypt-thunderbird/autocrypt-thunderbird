/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


/* global APP_SHUTDOWN: false */


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
  const {
    EnigmailOpenPGP
  } = Cu.import("resource://enigmail/openpgp.jsm", {});

  EnigmailAmPrefsService.startup(reason);
  EnigmailOpenPGP.startup(reason);
  EnigmailCore.startup(reason);
  EnigmailPgpmimeHander.startup(reason);
  EnigmailOverlays.startup(reason);
}


function shutdown(reason) {
  if (reason === APP_SHUTDOWN) return;

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

  EnigmailOverlays.startup(reason);
  EnigmailAmPrefsService.shutdown(reason);
  EnigmailCore.shutdown(reason);
  EnigmailPgpmimeHander.shutdown(reason);
}

//startup({}, APP_STARTUP);
