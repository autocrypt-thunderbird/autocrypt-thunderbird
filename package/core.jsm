/*global Components: false, Enigmail: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailCore"];

const Cc = Components.classes;
const Ci = Components.interfaces;

const enigmailHolder = {
  svc: null
}; // Global Enigmail Service
let envList = null; // currently filled from enigmail.js

function lazy(importName, name) {
  let holder = null;
  return function(f) {
    if (!holder) {
      if (f) {
        holder = f();
      }
      else {
        const result = {};
        Components.utils.import("resource://enigmail/" + importName, result);
        holder = result[name];
      }
    }
    return holder;
  };
}

const EnigmailCore = {
  version: "",

  init: function(enigmailVersion) {
    this.version = enigmailVersion;
  },

  /**
   * get and or initialize the Enigmail service,
   * including the handling for upgrading old preferences to new versions
   *
   * @win:                - nsIWindow: parent window (optional)
   * @startingPreferences - Boolean: true - called while switching to new preferences
   *                        (to avoid re-check for preferences)
   */
  getService: function(win, startingPreferences) {
    // Lazy initialization of Enigmail JS component (for efficiency)

    if (enigmailHolder.svc) {
      return enigmailHolder.svc.initialized ? enigmailHolder.svc : null;
    }

    try {
      enigmailHolder.svc = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
      return enigmailHolder.svc.wrappedJSObject.getService(enigmailHolder, win, startingPreferences);
    }
    catch (ex) {
      return null;
    }

  },

  getEnigmailService: function() {
    return enigmailHolder.svc;
  },

  setEnigmailService: function(v) {
    enigmailHolder.svc = v;
  },

  ensuredEnigmailService: function(f) {
    if (!enigmailHolder.svc) {
      EnigmailCore.setEnigmailService(f());
    }
    return enigmailHolder.svc;
  },

  getKeyRing: lazy("keyRing.jsm", "EnigmailKeyRing"),

  /**
   * obtain a list of all environment variables
   *
   * @return: Array of Strings with the following structrue
   *          variable_name=variable_content
   */
  getEnvList: function() {
    return envList;
  },

  addToEnvList: function(str) {
    EnigmailCore.getEnvList().push(str);
  },

  initEnvList: function() {
    envList = [];
  }
};
