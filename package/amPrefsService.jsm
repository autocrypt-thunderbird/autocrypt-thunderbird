/*global Components: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

const {
  classes: Cc,
  interfaces: Ci,
  manager: Cm,
  results: Cr,
  utils: Cu,
  Constructor: CC
} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */

const CATEGORY = "mailnews-accountmanager-extensions";
const CATEGORY_ENTRY = "enigmail-account-manager-extension";
const PREF_SERVICE_NAME = "@mozilla.org/accountmanager/extension;1?name=enigprefs";

var EXPORTED_SYMBOLS = ["EnigmailAmPrefsService"];

var EnigmailAmPrefsService = {
  startup: function(reason) {
    try {
      var catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
      catMan.addCategoryEntry(CATEGORY,
        CATEGORY_ENTRY,
        PREF_SERVICE_NAME,
        false, true);
      this.factory = new Factory(EnigmailPrefService);
    }
    catch (ex) {}
  },

  shutdown: function(reason) {
    var catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    catMan.deleteCategoryEntry(CATEGORY, CATEGORY_ENTRY, false);

    if (this.factory) {
      this.factory.unregister();
    }
  }
};

function EnigmailPrefService() {}

EnigmailPrefService.prototype = {
  name: "enigprefs",
  chromePackageName: "enigmail",
  classID: Components.ID("{943b06a2-24d2-4d38-b0f0-a45f959e331a}"),
  classDescription: "Enigmail Account Manager Extension Service",
  contractID: PREF_SERVICE_NAME,
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMsgAccountManagerExtension]),

  showPanel: function(server) {
    // show Enigmail panel for POP3, IMAP, NNTP and "movemail" (unix) account types
    switch (server.type) {
      case "nntp":
      case "imap":
      case "pop3":
      case "movemail":
        return true;
    }
    return false;
  }
};

class Factory {
  constructor(component) {
    this.component = component;
    this.register();
    Object.freeze(this);
  }

  createInstance(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return new this.component();
  }

  register() {
    Cm.registerFactory(this.component.prototype.classID,
      this.component.prototype.classDescription,
      this.component.prototype.contractID,
      this);
  }

  unregister() {
    Cm.unregisterFactory(this.component.prototype.classID, this);
  }
}
