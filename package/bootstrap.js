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
    const AutocryptApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").AutocryptApp;
    const AutocryptOverlays = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptOverlays.jsm").AutocryptOverlays;
    const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
    const AutocryptPgpmimeHander = ChromeUtils.import("chrome://autocrypt/content/modules/pgpmimeHandler.jsm").AutocryptPgpmimeHander;
    const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

    loadListOfModules();

    Services.obs.addObserver(AutocryptOverlays.mailStartupDone, "mail-startup-done", false);
    AutocryptApp.initAddon(data);
    AutocryptCore.startup(reason);
    AutocryptPgpmimeHander.startup(reason);

    Services.console.logStringMessage("Autocrypt bootstrap completed");
  } catch (ex) {
    logException(ex);
  }
}

function shutdown(data, reason) {
  try {
    // if (reason === APP_SHUTDOWN) return;

    const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
    const AutocryptPgpmimeHander = ChromeUtils.import("chrome://autocrypt/content/modules/pgpmimeHandler.jsm").AutocryptPgpmimeHander;
    const AutocryptOverlays = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptOverlays.jsm").AutocryptOverlays;
    const AutocryptWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").AutocryptWindows;
    const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

    Services.obs.removeObserver(AutocryptOverlays.mailStartupDone, "mail-startup-done");

    shutdownModule(AutocryptWindows, reason);
    shutdownModule(AutocryptOverlays, reason);
    shutdownModule(AutocryptCore, reason);
    shutdownModule(AutocryptPgpmimeHander, reason);
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
 * Load list of all Autocrypt modules that can be potentially loaded
 */
function loadListOfModules() {
  let request = new XMLHttpRequest();
  request.open("GET", "chrome://autocrypt/content/modules/all-modules.txt", true); // async=true
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
 * Unload all Autocrypt modules that were potentially loaded
 */
function unloadModules() {
  for (let mod of gAllModules) {
    try {
      // cannot unload filtersWrapper as you can't unregister filters in TB
      if (mod.search(/filtersWrapper\.jsm$/) < 0) {
        Cu.unload("chrome://autocrypt" + mod);
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
