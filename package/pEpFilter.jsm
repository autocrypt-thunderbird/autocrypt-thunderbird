/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for interfacing to pEp (Enigmail-specific functions)
 */


const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("resource://gre/modules/Services.jsm"); /* global Services */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */

// pEp JSON Server executable name
const pepServerExecutable = "pep-json-server";
const DECRYPT_FILTER_NAME = "pEp-Decrypt-on-Sending";
const AUTOPROCESS_FILTER_NAME = "pEp-Process-Sync-Message";
const AUTOPROCESS_HEADER = "pep-auto-consume";

var EXPORTED_SYMBOLS = ["EnigmailPEPFilter"];



var EnigmailPEPFilter = {

  DECRYPT_FILTER_NAME: DECRYPT_FILTER_NAME,
  AUTOPROCESS_FILTER_NAME: AUTOPROCESS_FILTER_NAME,

  /**
   * Delete an existing standard pEp filter rule for storing unencrypted
   * sent messages (if trusted server is disabled)
   *
   * @param identity - Object: nsIMsgIdentity for relevant account
   */

  deleteDecryptedCopyFilter: function(identity) {
    let acct = EnigmailFuncs.getAccountForIdentity(identity);
    let filters = acct.incomingServer.getFilterList(null);

    let pepFilter = filters.getFilterNamed(DECRYPT_FILTER_NAME);
    if (pepFilter) {
      filters.removeFilter(pepFilter);
    }
  },

  /**
   * Check and/or create the pEp standard filter rule for saving sent messages
   * in decrypted form (if trusted server is enabled)
   *
   * @param identity - Object: nsIMsgIdentity for relevant account
   *
   * @return Object: Filter rule (nsIMsgFilter)
   */
  ensureDecryptedCopyFilter: function(identity) {
    let acct = EnigmailFuncs.getAccountForIdentity(identity);
    let filters = acct.incomingServer.getFilterList(null);

    let pepFilter = filters.getFilterNamed(DECRYPT_FILTER_NAME);
    if (pepFilter) {
      let searchTerm = pepFilter.searchTerms.queryElementAt(0, Ci.nsIMsgSearchTerm);
      let action = pepFilter.getActionAt(0);
      if (searchTerm && action &&
        pepFilter.searchTerms.length === 1 &&
        searchTerm.matchAll &&
        pepFilter.actionCount === 1 &&
        pepFilter.filterType === Ci.nsMsgFilterType.PostOutgoing &&
        action.type === Ci.nsMsgFilterAction.Custom &&
        action.customAction.id === EnigmailConstants.FILTER_MOVE_DECRYPT) {

        // set outbox
        action.strValue = identity.fccFolder;
        pepFilter.enabled = true;
      }
      else {
        filters.removeFilter(pepFilter);
        pepFilter = null;
      }
    }

    if (!pepFilter) {
      pepFilter = filters.createFilter(DECRYPT_FILTER_NAME);

      let searchTerm = pepFilter.createTerm();
      searchTerm.matchAll = true;

      let action = pepFilter.createAction();
      action.type = Ci.nsMsgFilterAction.Custom;
      action.customId = EnigmailConstants.FILTER_MOVE_DECRYPT;
      action.strValue = identity.fccFolder;

      pepFilter.appendTerm(searchTerm);
      pepFilter.appendAction(action);
      pepFilter.enabled = true;
      pepFilter.filterType = Ci.nsMsgFilterType.PostOutgoing;
      pepFilter.filterDesc = EnigmailLocale.getString("filter.tempPepFilterDesc");
      filters.insertFilterAt(0, pepFilter);
    }

    return pepFilter;
  }
};
