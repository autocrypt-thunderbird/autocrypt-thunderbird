/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailApp"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/lazy.jsm"); /*global EnigmailLazy: false */
const getEnigmailLog = EnigmailLazy.loader("enigmail/log.jsm", "EnigmailLog");

const DIR_SERV_CONTRACTID = "@mozilla.org/file/directory_service;1";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";
const SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";

var EnigmailApp = {
  /**
   * Platform application name (e.g. Thunderbird)
   */
  getName: function() {
    return Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo).name;
  },

  /**
   * Platform (Gecko) version number (e.g. 42.0)
   * The platform version for SeaMonkey and for Thunderbird are identical
   * (unlike the application version numbers)
   */
  getPlatformVersion: function() {
    return Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo).platformVersion;
  },

  /**
   * Return the directory holding the current profile as nsIFile object
   */
  getProfileDirectory: function() {
    let ds = Cc[DIR_SERV_CONTRACTID].getService(Ci.nsIProperties);
    return ds.get("ProfD", Ci.nsIFile);
  },

  isSuite: function() {
    // return true if Seamonkey, false otherwise
    return Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo).ID == SEAMONKEY_ID;
  },

  /**
   * Get Enigmail version
   */
  getVersion: function() {
    getEnigmailLog().DEBUG("app.jsm: getVersion\n");
    getEnigmailLog().DEBUG("app.jsm: installed version: " + EnigmailApp.version + "\n");
    return EnigmailApp._version;
  },

  /**
   * Get Enigmail installation directory
   */
  getInstallLocation: function() {
    return EnigmailApp._installLocation;
  },

  setVersion: function(version) {
    EnigmailApp._version = version;
  },

  setInstallLocation: function(location) {
    EnigmailApp._installLocation = location;
  },

  initAddon: function(addon) {
    EnigmailApp.setVersion(addon.version);
    EnigmailApp.setInstallLocation(addon.installPath);
  }
};
