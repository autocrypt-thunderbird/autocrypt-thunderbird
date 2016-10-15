/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for interfacing to pEp (Enigmal-specific functions)
 */


const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/pEp.jsm"); /*global EnigmailpEp: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/log.jsm");  /*global EnigmailLog: false */


var gPepVersion = null;

var EXPORTED_SYMBOLS = ["EnigmailPEPAdapter"];

var EnigmailPEPAdapter = {
  /**
   * Get the pEp JSON server version number.
   *
   * @return String:
   *     - null if the module is not initialized
   *     - a non-empty string if pEp is available
   *     - "" in case pEp is not available
   */
  getPepVersion: function() {
    return gPepVersion;
  },

  /**
   * Determine if pEp should be used or "regular" Enigmail functionality
   *
   * @return: Boolean: true - use pEp  / false - use Enigmail
   */
  usingPep: function() {
    if ((typeof(gPepVersion) === "string") && gPepVersion.length > 0) {
      return EnigmailPrefs.getPref("usePEP");
    }

    return false;
  },

  initialize: function() {
    EnigmailpEp.getPepVersion().then(function success(data) {
      if (Array.isArray(data)) {
        gPepVersion = data[0];
      }
    }).
    catch(function failed(data) {
      gPepVersion = "";
    });
  }

};
