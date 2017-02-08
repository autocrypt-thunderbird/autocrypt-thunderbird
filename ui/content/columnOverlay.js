/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

/* global Components: false, gDBView: false */

Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */


if (!Enigmail) var Enigmail = {};

Enigmail.columnHandler = {
  nsIEnigmail: Components.interfaces.nsIEnigmail,
  _usingPep: null,
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
      let rating = hdr.getUint32Property("enigmailPep");

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
      if ((statusFlags & this.nsIEnigmail.GOOD_SIGNATURE) &&
        (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY))
        newProp = "enigSignedEncrypted";
      else if (statusFlags & this.nsIEnigmail.GOOD_SIGNATURE)
        newProp = "enigSigned";
      else if (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY)
        newProp = "enigEncrypted";
    }

    if (newProp) {
      let atomService = Components.classes["@mozilla.org/atom-service;1"].
      getService(Components.interfaces.nsIAtomService);
      var atom = atomService.getAtom(newProp);
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
    if ((statusFlags & this.nsIEnigmail.GOOD_SIGNATURE) &&
      (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY))
      return 3;
    else if (statusFlags & this.nsIEnigmail.GOOD_SIGNATURE)
      return 2;
    else if (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY)
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
  }
};

window.addEventListener("load",
  function() {
    var ObserverService = Components.classes["@mozilla.org/observer-service;1"].
    getService(Components.interfaces.nsIObserverService);
    ObserverService.addObserver(Enigmail.columnHandler.createDbObserver, "MsgCreateDBView", false);
  },
  false
);
