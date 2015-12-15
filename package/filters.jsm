/*global Components: false, EnigmailDecryptPermanently: false, EnigmailCore: false, EnigmailLog: false, EnigmailLocale: false, EnigmailDialog: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailFilters"];

Components.utils.import("resource://enigmail/core.jsm");
Components.utils.import("resource://enigmail/decryptPermanently.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

/********************************************************************************
 Filter actions for decrypting messages permanently
 ********************************************************************************/

/**
 * filter action for creating a decrypted version of the mail and
 * deleting the original mail at the same time
 */

const filterActionMoveDecrypt = {
  id: "enigmail@enigmail.net#filterActionMoveDecrypt",
  name: EnigmailLocale.getString("filter.decryptMove.label"),
  value: "movemessage",
  apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {

    EnigmailLog.DEBUG("enigmail.js: filterActionMoveDecrypt: Move to: " + aActionValue + "\n");

    var msgHdrs = [];

    for (var i = 0; i < aMsgHdrs.length; i++) {
      msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
    }

    EnigmailDecryptPermanently.dispatchMessages(msgHdrs, aActionValue, true, true);

    return;
  },

  isValidForType: function(type, scope) {
    return true;
  },

  validateActionValue: function(value, folder, type) {
    EnigmailDialog.alert(null, EnigmailLocale.getString("filter.decryptMove.warnExperimental"));

    if (value === "") {
      return EnigmailLocale.getString("filter.folderRequired");
    }

    return null;
  },

  allowDuplicates: false,
  isAsync: false,
  needsBody: true
};

/**
 * filter action for creating a decrypted copy of the mail, leaving the original
 * message untouched
 */
const filterActionCopyDecrypt = {
  id: "enigmail@enigmail.net#filterActionCopyDecrypt",
  name: EnigmailLocale.getString("filter.decryptCopy.label"),
  value: "copymessage",
  apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
    EnigmailLog.DEBUG("enigmail.js: filterActionCopyDecrypt: Copy to: " + aActionValue + "\n");

    var msgHdrs = [];

    for (var i = 0; i < aMsgHdrs.length; i++) {
      msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
    }

    EnigmailDecryptPermanently.dispatchMessages(msgHdrs, aActionValue, false, true);
    return;
  },

  isValidForType: function(type, scope) {
    return true;
  },

  validateActionValue: function(value, folder, type) {
    if (value === "") {
      return EnigmailLocale.getString("filter.folderRequired");
    }

    return null;
  },

  allowDuplicates: false,
  isAsync: false,
  needsBody: true
};

const EnigmailFilters = {
  registerAll: function() {
    var filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(Ci.nsIMsgFilterService);
    filterService.addCustomAction(filterActionMoveDecrypt);
    filterService.addCustomAction(filterActionCopyDecrypt);
  }
};
