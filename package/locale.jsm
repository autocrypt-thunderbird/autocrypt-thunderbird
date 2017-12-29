/*global Components: false, EnigmailLog: false, EnigmailOS: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailLocale"];

Components.utils.import("resource://enigmail/log.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

var enigStringBundle = null;

var EnigmailLocale = {
  get: function() {
    try {
      return Cc["@mozilla.org/intl/nslocaleservice;1"].getService(Ci.nsILocaleService).getApplicationLocale();
    }
    catch (ex) {
      return {
        getCategory: function(whatever) {
          // always return the application locale
          return Cc["@mozilla.org/intl/localeservice;1"].getService(Ci.mozILocaleService).getAppLocaleAsBCP47();
        }
      };
    }
  },

  /**
   * Retrieve a localized string from the enigmail.properties stringbundle
   *
   * @param aStr:       String                     - properties key
   * @param subPhrases: String or Array of Strings - [Optional] additional input to be embedded
   *                                                  in the resulting localized text
   *
   * @return String: the localized string
   */
  getString: function(aStr, subPhrases) {
    if (!enigStringBundle) {
      try {
        var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"].getService();
        strBundleService = strBundleService.QueryInterface(Ci.nsIStringBundleService);
        enigStringBundle = strBundleService.createBundle("chrome://enigmail/locale/enigmail.properties");
      }
      catch (ex) {
        EnigmailLog.ERROR("locale.jsm: Error in instantiating stringBundleService\n");
      }
    }

    if (enigStringBundle) {
      try {
        if (subPhrases) {
          if (typeof(subPhrases) == "string") {
            return enigStringBundle.formatStringFromName(aStr, [subPhrases], 1);
          }
          else {
            return enigStringBundle.formatStringFromName(aStr, subPhrases, subPhrases.length);
          }
        }
        else {
          return enigStringBundle.GetStringFromName(aStr);
        }
      }
      catch (ex) {
        EnigmailLog.ERROR("locale.jsm: Error in querying stringBundleService for string '" + aStr + "'\n");
      }
    }
    return aStr;
  },

  /**
   * Get the locale for the User Interface
   *
   * @return String  Locale (xx-YY)
   */
  getUILocale: function() {
    let ps = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
    let uaPref = ps.getBranch("general.useragent.");

    try {
      return uaPref.getComplexValue("locale", Ci.nsISupportsString).data;
    }
    catch (e) {}
    return uaPref.getCharPref("locale");
  }
};
