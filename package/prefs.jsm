/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptPrefs"];





const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").AutocryptFiles;
const {
  Services
} = ChromeUtils.import("resource://gre/modules/Services.jsm");

const AUTOCRYPT_PREFS_ROOT = "extensions.autocrypt.";

const p = {
  service: null,
  branch: null,
  root: null,
  defaultBranch: null
};

function initPrefService() {
  try {
    p.service = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

    p.root = p.service.getBranch(null);
    p.branch = p.service.getBranch(AUTOCRYPT_PREFS_ROOT);
    p.defaultBranch = p.service.getDefaultBranch(null);

    try {
      if (p.branch.getCharPref("logDirectory")) {
        AutocryptLog.setLogLevel(5);
      }
    }
    catch (ex) {} // don't log anythign if accessing logDirectory fails
  }
  catch (ex) {
    AutocryptLog.ERROR("prefs.jsm: Error in instantiating PrefService\n");
    AutocryptLog.ERROR(ex.toString());
  }
}


var gPrefs = {};

var AutocryptPrefs = {
  startup: function(reason) {
    try {
      initPrefService();
    }
    catch (ex) {
      AutocryptLog.ERROR("prefs.jsm: Error while loading default prefs: " + ex.message + "\n");
    }
  },

  getPrefRoot: function() {
    if (!p.branch) {
      initPrefService();
    }

    return p.root;
  },

  getPrefBranch: function() {
    if (!p.branch) {
      initPrefService();
    }

    return p.branch;
  },

  getPref: function(prefName) {
    if (!p.branch) {
      initPrefService();
    }

    var prefValue = null;
    try {
      var prefType = p.branch.getPrefType(prefName);
      // Get pref value
      switch (prefType) {
        case p.branch.PREF_BOOL:
          prefValue = p.branch.getBoolPref(prefName);
          break;
        case p.branch.PREF_INT:
          prefValue = p.branch.getIntPref(prefName);
          break;
        case p.branch.PREF_STRING:
          prefValue = p.branch.getCharPref(prefName);
          break;
        default:
          prefValue = undefined;
          break;
      }
    }
    catch (ex) {
      // Failed to get pref value
      AutocryptLog.ERROR("prefs.jsm: getPref: unknown prefName:" + prefName + " \n");
    }

    return prefValue;
  },

  /**
   * Store a user preference.
   *
   * @param  String  prefName  An identifier.
   * @param  any     value     The value to be stored. Allowed types: Boolean OR Integer OR String.
   *
   * @return Boolean Was the value stored successfully?
   */
  setPref: function(prefName, value) {
    AutocryptLog.DEBUG("prefs.jsm: setPref: " + prefName + ", " + value + "\n");

    if (!p.branch) {
      initPrefService();
    }

    // Discover the type of the preference, as stored in the user preferences.
    // If the preference identifier doesn't exist yet, it returns 0. In that
    // case the type depends on the argument "value".
    var prefType;
    prefType = p.branch.getPrefType(prefName);
    if (prefType === 0) {
      switch (typeof value) {
        case "boolean":
          prefType = p.branch.PREF_BOOL;
          break;
        case "number":
          prefType = p.branch.PREF_INT;
          break;
        case "string":
          prefType = p.branch.PREF_STRING;
          break;
        default:
          prefType = 0;
          break;
      }
    }
    var retVal = false;

    // Save the preference only and if only the type is bool, int or string.
    switch (prefType) {
      case p.branch.PREF_BOOL:
        p.branch.setBoolPref(prefName, value);
        retVal = true;
        break;

      case p.branch.PREF_INT:
        p.branch.setIntPref(prefName, value);
        retVal = true;
        break;

      case p.branch.PREF_STRING:
        p.branch.setCharPref(prefName, value);
        retVal = true;
        break;

      default:
        break;
    }

    return retVal;
  },

  /**
   * Save the Mozilla preferences file (prefs.js)
   *
   * no return value
   */
  savePrefs: function() {
    AutocryptLog.DEBUG("prefs.jsm: savePrefs\n");
    try {
      p.service.savePrefFile(null);
    }
    catch (ex) {}
  },

  /**
   * Compiles all Autocrypt preferences into an object
   */
  getAllPrefs: function() {
    AutocryptLog.DEBUG("prefs.js: getAllPrefs\n");

    var retObj = {
      value: 0
    };
    var branch = this.getPrefBranch();
    var allPrefs = branch.getChildList("", retObj);
    var prefObj = {};
    var nsIPB = Components.interfaces.nsIPrefBranch;

    for (var q in allPrefs) {
      var name = allPrefs[q];

      /* configuredVersion is build-depend */
      if (name == "configuredVersion") {
        continue;
      }

      switch (branch.getPrefType(name)) {
        case nsIPB.PREF_STRING:
          prefObj[name] = branch.getCharPref(name);
          break;
        case nsIPB.PREF_INT:
          prefObj[name] = branch.getIntPref(name);
          break;
        case nsIPB.PREF_BOOL:
          prefObj[name] = branch.getBoolPref(name);
          break;
        default:
          AutocryptLog.ERROR("Pref '" + name + "' has unknown type\n");
      }
    }

    return prefObj;
  },

  /**
   * register a listener to listen to a change in the Autocrypt preferences.
   *
   * @param prefName: String        - name of Autocrypt preference
   * @param observerFunc: Function - callback function to be triggered
   *
   * @return Object: observer object (to be used to deregister the observer)
   */
  registerPrefObserver: function(prefName, observerFunc) {
    AutocryptLog.DEBUG("prefs.jsm: registerPrefObserver(" + prefName + ")\n");
    let branch = this.getPrefRoot();

    let observer = {
      observe: function(aSubject, aTopic, aData) {
        try {
          if (String(aData) == AUTOCRYPT_PREFS_ROOT + this.prefName) {
            AutocryptLog.DEBUG("prefs.jsm: preference observed: " + aData + "\n");
            observerFunc();
          }
        }
        catch (ex) {}
      },

      prefName: prefName,

      QueryInterface: function(iid) {
        if (iid.equals(Ci.nsIObserver) ||
          iid.equals(Ci.nsISupportsWeakReference) ||
          iid.equals(Ci.nsISupports))
          return this;

        throw Components.results.NS_NOINTERFACE;
      }
    };
    branch.addObserver(AUTOCRYPT_PREFS_ROOT, observer, false);
    return observer;
  },

  /**
   * de-register an observer created by registerPrefObserver().
   *
   * @param observer: Object - observer object returned by registerPrefObserver
   */
  unregisterPrefObserver(observer) {
    AutocryptLog.DEBUG("prefs.jsm: unregisterPrefObserver(" + observer.prefName + ")\n");

    let branch = this.getPrefRoot();

    branch.removeObserver(AUTOCRYPT_PREFS_ROOT, observer);
  }
};
