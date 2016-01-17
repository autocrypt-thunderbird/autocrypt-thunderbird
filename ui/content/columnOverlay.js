/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

/* global Components: false, gDBView: false */

if (!Enigmail) var Enigmail = {};

Enigmail.columnHandler = {
  nsIEnigmail: Components.interfaces.nsIEnigmail,
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
    let statusFlags = hdr.getUint32Property("enigmail");
    let newProp = null;
    if ((statusFlags & this.nsIEnigmail.GOOD_SIGNATURE) &&
      (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY))
      newProp = "enigSignedEncrypted";
    else if (statusFlags & this.nsIEnigmail.GOOD_SIGNATURE)
      newProp = "enigSigned";
    else if (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY)
      newProp = "enigEncrypted";

    if (newProp) {
      let atomService = Components.classes["@mozilla.org/atom-service;1"].
      getService(Components.interfaces.nsIAtomService);
      var atom = atomService.getAtom(newProp);
      return newProp;
    }
  },
  getRowProperties: function(row, props) {},
  getImageSrc: function(row, col) {},
  getSortLongForRow: function(hdr) {
    var statusFlags = hdr.getUint32Property("enigmail");
    if ((statusFlags & this.nsIEnigmail.GOOD_SIGNATURE) &&
      (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY))
      return 3;
    else if (statusFlags & this.nsIEnigmail.GOOD_SIGNATURE)
      return 2;
    else if (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY)
      return 1;
    else
      return 0;

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
