/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

/* global Components: false, gDBView: false */

var EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
var COLUMN_STATUS = ChromeUtils.import("chrome://autocrypt/content/modules/verifyStatus.jsm").COLUMN_STATUS;

if (!Enigmail) var Enigmail = {};

Enigmail.columnHandler = {
  getCellText: function(row, col) {
    return null;
  },
  getSortStringForRow: function(hdr) {
    return "";
  },
  isString: function() {
    return false;
  },
  getCellProperties: function(row, col, props) {
    let key = gDBView.getKeyAt(row);
    let hdr = gDBView.db.GetMsgHdrForKey(key);

    const statusInt = hdr.getUint32Property("autocrypt-status");
    switch(statusInt) {
      case COLUMN_STATUS.E2E: return "statusColEncrypted";
    }
    return null;
  },

  getRowProperties: function(row, props) {},
  getImageSrc: function(row, col) {},
  getSortLongForRow: function(hdr) {
    const statusInt = hdr.getUint32Property("autocrypt-status");
    switch(statusInt) {
      case COLUMN_STATUS.E2E: return 1;
    }
    return 0;
  },

  createDbObserver: {
    // Components.interfaces.nsIObserver
    observe: function() {
      EnigmailLog.DEBUG("columnOverlay.js: registering column handler\n");
      try {
        gDBView.addColumnHandler("autocryptStatusCol", Enigmail.columnHandler);
      } catch (ex) {
        // nvm, this might happen under some circumstances
      }
    }
  },

  onLoadEnigmail: function() {
    let observerService = Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(Enigmail.columnHandler.createDbObserver, "MsgCreateDBView", false);
    if (gDBView) {
      gDBView.addColumnHandler("autocryptStatusCol", Enigmail.columnHandler);
    }
  },

  onUnloadEnigmail: function() {
    // triggered from enigmailMessengerOverlay.js
    let observerService = Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService);
    observerService.removeObserver(Enigmail.columnHandler.createDbObserver, "MsgCreateDBView");
    window.removeEventListener("load-autocrypt", Enigmail.columnHandler.onLoadEnigmail, false);
  }
};

window.addEventListener("load-autocrypt", Enigmail.columnHandler.onLoadEnigmail, false);
