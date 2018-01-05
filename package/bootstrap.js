/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


/* global APP_SHUTDOWN: false */
const Cu = Components.utils;


function install() {}

function uninstall() {}

function startup(data, reason) {
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


function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) return;

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
    EnigmailWindows
  } = Cu.import("resource://enigmail/windows.jsm", {});

  EnigmailWindows.shutdown(reason);
  EnigmailOverlays.shutdown(reason);
  EnigmailAmPrefsService.shutdown(reason);
  EnigmailCore.shutdown(reason);
  EnigmailPgpmimeHander.shutdown(reason);

  unloadModules();
}

/**
 * Unload all Enigmail modules that were potentially loaded
 */
function unloadModules() {
  //const Cu = Components.utils;

  const {
    EnigmailStreams
  } = Cu.import("resource://enigmail/streams.jsm", {});
  let channel = EnigmailStreams.createChannel("resource://enigmail/all-modules.txt");

  let buffer = EnigmailStreams.newStringStreamListener(data => {
    let modules = data.split(/[\r\n]/);
    for (let mod of modules) {
      mod = mod.replace(/^modules/, "");
      try {
        Cu.unload("resource://enigmail" + mod);
      }
      catch (ex) {}
    }
  });
  channel.asyncOpen(buffer, null);
}
