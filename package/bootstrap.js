/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


/* global APP_SHUTDOWN: false */
const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.importGlobalProperties(["XMLHttpRequest"]);

var gAllModules = [];

function install() {}

function uninstall() {}

function startup(data, reason) {
  try {
    const {
      EnigmailCore
    } = Cu.import("resource://enigmail/core.jsm", {});
    const {
      EnigmailAmPrefsService
    } = Cu.import("resource://enigmail/amPrefsService.jsm", {});
    const {
      EnigmailPgpmimeHander
    } = Cu.import("resource://enigmail/pgpmimeHandler.jsm", {});

    loadListOfModules();

    EnigmailAmPrefsService.startup(reason);
    EnigmailCore.startup(reason);
    EnigmailPgpmimeHander.startup(reason);
  }
  catch (ex) {} // if we fail, we should at least not break other addons
}

function shutdown(data, reason) {
  try {
    const {
      subprocess
    } = Cu.import("resource://enigmail/subprocess.jsm", {});
    subprocess.onShutdown();

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

    const {
      Services
    } = Components.utils.import("resource://gre/modules/Services.jsm", {});

    shutdownModule(EnigmailWindows, reason);
    shutdownModule(EnigmailOverlays, reason);
    shutdownModule(EnigmailAmPrefsService, reason);
    shutdownModule(EnigmailCore, reason);
    shutdownModule(EnigmailPgpmimeHander, reason);
    unloadModules();

    // HACK WARNING: The Addon Manager does not properly clear all addon related caches on update;
    //               in order to fully update images and locales, their caches need clearing here
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);
  }
  catch (ex) {} // never fail
}

/**
 * Perform shutdown of a module
 */
function shutdownModule(module, reason) {
  try {
    module.shutdown(reason);
  }
  catch (ex) {}
}

/**
 * Load list of all Enigmail modules that can be potentially loaded
 */
function loadListOfModules() {
  let request = new XMLHttpRequest();
  request.open("GET", "resource://enigmail/all-modules.txt", true); // async=true
  request.responseType = "text";
  request.onerror = function(event) {};
  request.onload = function(event) {
    if (request.response) {
      gAllModules = [];
      let modules = request.response.split(/[\r\n]/);
      for (let mod of modules) {
        mod = mod.replace(/^modules/, "");
        gAllModules.push(mod);
      }
    }
    else
      request.onerror(event);
  };
  request.send();
}


/**
 * Unload all Enigmail modules that were potentially loaded
 */
function unloadModules() {
  for (let mod of gAllModules) {
    try {
      // cannot unload filtersWrapper as you can't unregister filters in TB
      if (mod !== "filtersWrapper.jsm") {
        Cu.unload("resource://enigmail" + mod);
      }
    }
    catch (ex) {}
  }
}
