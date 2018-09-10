/*global Cu: false, ChromeUtils: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  TB 60-68 compatibility Module
 */

var EXPORTED_SYMBOLS = ["EnigmailTb60Compat"];

var gCompFields;

var EnigmailTb60Compat = {
  generateQI: function(aCid) {
    if ("generateQI" in ChromeUtils) {
      return ChromeUtils.generateQI(aCid);
    }
    else {
      let XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
      return XPCOMUtils.generateQI(aCid);
    }
  },

  getSecurityField: function() {
    if (!gCompFields) {
      gCompFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
    }
    return ("securityInfo" in gCompFields ? "securityInfo" : "composeSecure");
  }
};
