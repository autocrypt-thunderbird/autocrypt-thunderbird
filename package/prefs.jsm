/*global Components: false, EnigmailLog: false */
/*jshint -W097 */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailPrefs"];

Components.utils.import("resource://enigmail/log.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

const ENIGMAIL_PREFS_ROOT = "extensions.enigmail.";

const p = {
  service: null,
  branch: null,
  root: null
};

function initPrefService() {
  try {
    p.service = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

    p.root = p.service.getBranch(null);
    p.branch = p.service.getBranch(ENIGMAIL_PREFS_ROOT);

    if (p.branch.getCharPref("logDirectory")) {
      EnigmailLog.setLogLevel(5);
    }
  }
  catch (ex) {
    EnigmailLog.ERROR("prefs.jsm: Error in instantiating PrefService\n");
    EnigmailLog.ERROR(ex.toString());
  }
}

const EnigmailPrefs = {
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
      EnigmailLog.ERROR("enigmailCommon.jsm: getPref: unknown prefName:" + prefName + " \n");
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
    EnigmailLog.DEBUG("enigmailCommon.jsm: setPref: " + prefName + ", " + value + "\n");

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
    EnigmailLog.DEBUG("enigmailCommon.js: savePrefs\n");
    try {
      p.service.savePrefFile(null);
    }
    catch (ex) {}
  }
};