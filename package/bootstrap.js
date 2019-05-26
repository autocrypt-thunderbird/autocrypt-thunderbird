/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";


/* global APP_SHUTDOWN: false */




Components.utils.importGlobalProperties(["XMLHttpRequest"]);

var gAllModules = [];

function install() {}

function uninstall() {}

function startup(data, reason) {
  try {
    const EnigmailApp = ChromeUtils.import("chrome://enigmail/content/modules/app.jsm").EnigmailApp;
    const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
    const EnigmailAmPrefsService = ChromeUtils.import("chrome://enigmail/content/modules/amPrefsService.jsm").EnigmailAmPrefsService;
    const EnigmailPgpmimeHander = ChromeUtils.import("chrome://enigmail/content/modules/pgpmimeHandler.jsm").EnigmailPgpmimeHander;
    const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

    loadListOfModules();

    EnigmailApp.initAddon(data);
    EnigmailAmPrefsService.startup(reason);
    EnigmailCore.startup(reason);
    EnigmailPgpmimeHander.startup(reason);

    Services.console.logStringMessage("Enigmail bootstrap completed");
  } catch (ex) {
    logException(ex);
  }
}

function shutdown(data, reason) {
  try {
    const subprocess = ChromeUtils.import("chrome://enigmail/content/modules/subprocess.jsm").subprocess;
    subprocess.onShutdown();

    if (reason === APP_SHUTDOWN) return;

    const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
    const EnigmailAmPrefsService = ChromeUtils.import("chrome://enigmail/content/modules/amPrefsService.jsm").EnigmailAmPrefsService;
    const EnigmailPgpmimeHander = ChromeUtils.import("chrome://enigmail/content/modules/pgpmimeHandler.jsm").EnigmailPgpmimeHander;
    const EnigmailOverlays = ChromeUtils.import("chrome://enigmail/content/modules/enigmailOverlays.jsm").EnigmailOverlays;
    const EnigmailWindows = ChromeUtils.import("chrome://enigmail/content/modules/windows.jsm").EnigmailWindows;
    const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

    shutdownModule(EnigmailWindows, reason);
    shutdownModule(EnigmailOverlays, reason);
    shutdownModule(EnigmailAmPrefsService, reason);
    shutdownModule(EnigmailCore, reason);
    shutdownModule(EnigmailPgpmimeHander, reason);
    unloadModules();

    // HACK WARNING: The Addon Manager does not properly clear all addon related caches on update;
    //               in order to fully update images and locales, their caches need clearing here
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);

  } catch (ex) {
    logException(ex);
  }
}

/**
 * Perform shutdown of a module
 */
function shutdownModule(module, reason) {
  try {
    module.shutdown(reason);
  } catch (ex) {}
}

/**
 * Load list of all Enigmail modules that can be potentially loaded
 */
function loadListOfModules() {
  let request = new XMLHttpRequest();
  request.open("GET", "chrome://enigmail/content/modules/all-modules.txt", true); // async=true
  request.responseType = "text";
  request.onerror = function(event) {};
  request.onload = function(event) {
    if (request.response) {
      gAllModules = [];
      let modules = request.response.split(/[\r\n]/);
      for (let mod of modules) {
        mod = mod.replace(/^chrome/, "");
        gAllModules.push(mod);
      }
    } else
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
      if (mod.search(/filtersWrapper\.jsm$/) < 0) {
        Cu.unload("chrome://enigmail" + mod);
      }
    } catch (ex) {
      logException(ex);
    }
  }
}

function logException(exc) {
  try {
    const {
      Services
    } = ChromeUtils.import("resource://gre/modules/Services.jsm");
    Services.console.logStringMessage(exc.toString() + "\n" + exc.stack);
  } catch (x) {}
}