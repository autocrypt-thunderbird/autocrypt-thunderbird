/*global Components: false, EnigmailDecryptPermanently: false, EnigmailCore: false, EnigmailLog: false, EnigmailLocale: false, EnigmailLazy: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailFilters"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/lazy.jsm");
Cu.import("resource://enigmail/locale.jsm");
Cu.import("resource://enigmail/core.jsm");
Cu.import("resource://enigmail/decryptPermanently.jsm");
Cu.import("resource://enigmail/log.jsm");

const getDialog = EnigmailLazy.loader("enigmail/dialog.jsm", "EnigmailDialog");


/********************************************************************************
 Filter actions for decrypting messages permanently
 ********************************************************************************/


const MOVE_DECRYPT = "enigmail@enigmail.net#filterActionMoveDecrypt";
const COPY_DECRYPT = "enigmail@enigmail.net#filterActionCopyDecrypt";


/**
 * filter action for creating a decrypted version of the mail and
 * deleting the original mail at the same time
 */

const filterActionMoveDecrypt = {
  id: MOVE_DECRYPT,
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
    getDialog().alert(null, EnigmailLocale.getString("filter.decryptMove.warnExperimental"));

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
  id: COPY_DECRYPT,
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
  MOVE_DECRYPT: MOVE_DECRYPT,
  COPY_DECRYPT: COPY_DECRYPT,

  registerAll: function() {
    var filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(Ci.nsIMsgFilterService);
    filterService.addCustomAction(filterActionMoveDecrypt);
    filterService.addCustomAction(filterActionCopyDecrypt);
  }
};
