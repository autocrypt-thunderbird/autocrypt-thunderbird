/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

/* global Components: false, gDBView: false */

ChromeUtils.import("chrome://enigmail/content/modules/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm"); /*global EnigmailConstants: false */

if (!Enigmail) var Enigmail = {};

Enigmail.columnHandler = {
  _usingPep: null,
  resetUsingPep: function() {
    this._usingPep = null;
  },
  isUsingPep: function() {
    if (this._usingPep === null) {
      this._usingPep = EnigmailPEPAdapter.usingPep();
    }

    return this._usingPep;
  },
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
    let newProp = null;

    if (this.isUsingPep()) {
      let rating = hdr.getUint32Property("enigmailPep") & 0xFF;

      switch (rating) {
        case 1:
          newProp = "enigmailPepMistrust";
          break;
        case 2:
          newProp = "enigmailPepReliable";
          break;
        case 3:
          newProp = "enigmailPepTrusted";
          break;
      }
    }
    else {
      let statusFlags = hdr.getUint32Property("enigmail");
      if ((statusFlags & EnigmailConstants.GOOD_SIGNATURE) &&
        (statusFlags & EnigmailConstants.DECRYPTION_OKAY))
        newProp = "enigSignedEncrypted";
      else if (statusFlags & EnigmailConstants.GOOD_SIGNATURE)
        newProp = "enigSigned";
      else if (statusFlags & EnigmailConstants.DECRYPTION_OKAY)
        newProp = "enigEncrypted";
    }

    if (newProp) {
      return newProp;
    }

    return null;
  },

  getRowProperties: function(row, props) {},
  getImageSrc: function(row, col) {},
  getSortLongForRow: function(hdr) {
    if (this.isUsingPep()) {
      return hdr.getUint32Property("enigmailPep");
    }

    var statusFlags = hdr.getUint32Property("enigmail");
    if ((statusFlags & EnigmailConstants.GOOD_SIGNATURE) &&
      (statusFlags & EnigmailConstants.DECRYPTION_OKAY))
      return 3;
    else if (statusFlags & EnigmailConstants.GOOD_SIGNATURE)
      return 2;
    else if (statusFlags & EnigmailConstants.DECRYPTION_OKAY)
      return 1;

    return 0;
  },

  createDbObserver: {
    // Components.interfaces.nsIObserver
    observe: function(aMsgFolder, aTopic, aData) {
      try {
        gDBView.addColumnHandler("enigmailStatusCol", Enigmail.columnHandler);
      }
      catch (ex) {}
    }
  },

  onLoadEnigmail: function() {
    let observerService = Components.classes["@mozilla.org/observer-service;1"].
    getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(Enigmail.columnHandler.createDbObserver, "MsgCreateDBView", false);

    let folderTree = document.getElementById("folderTree");
    folderTree.addEventListener("select", Enigmail.columnHandler.resetUsingPep.bind(Enigmail.columnHandler), false);
  },

  onUnloadEnigmail: function() {
    // triggered from enigmailMessengerOverlay.js
    let observerService = Components.classes["@mozilla.org/observer-service;1"].
    getService(Components.interfaces.nsIObserverService);
    observerService.removeObserver(Enigmail.columnHandler.createDbObserver, "MsgCreateDBView");

    let folderTree = document.getElementById("folderTree");
    folderTree.removeEventListener("select", Enigmail.columnHandler.resetUsingPep, false);
  }
};

window.addEventListener("load-enigmail", Enigmail.columnHandler.onLoadEnigmail, false);
