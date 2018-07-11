/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for interfacing to pEp (Enigmail-specific functions)
 */


const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("chrome://enigmail/content/modules/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("chrome://enigmail/content/modules/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("chrome://enigmail/content/modules/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("resource://gre/modules/Services.jsm"); /* global Services */
Cu.import("chrome://enigmail/content/modules/timer.jsm"); /* global EnigmailTimer: false */
Cu.import("chrome://enigmail/content/modules/log.jsm"); /*global EnigmailLog: false */
Cu.import("chrome://enigmail/content/modules/lazy.jsm"); /*global EnigmailLazy: false */

const getPepAdapter = EnigmailLazy.loader("enigmail/pEpAdapter.jsm", "EnigmailPEPAdapter");


// pEp JSON Server executable name
const DECRYPT_FILTER_NAME = "pEp-Decrypt-on-Sending";
const AUTOPROCESS_FILTER_NAME = "pEp-Process-Sync-Message";
const AUTOPROCESS_HEADER = "pep-auto-consume";

const PEP_DECRYPT_FLAGS = {
  own_private_key: 1,
  consume: 2,
  ignore: 4
};

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
  },

  newMailConsumer: function(messageStruct, rawMessageData, msgHdr) {
    EnigmailLog.DEBUG("pEpFilter.jsm: newMailConsumer()\n");

    let processAttempts = 0;

    function delMsg(msgHdr) {
      let folderInfoObj = {};
      msgHdr.folder.getDBFolderInfoAndDB(folderInfoObj).DeleteMessage(msgHdr.messageKey, null, true);
    }

    function processMailWithPep() {
      EnigmailLog.DEBUG("pEpFilter.jsm: newMailConsumer: processMailWithPep(" + msgHdr.messageKey + ")\n");
      getPepAdapter().pep.decryptMimeString(rawMessageData).
      then(resultObj => {
        let e = msgHdr.propertyEnumerator;
        if (!e.hasMore()) {
          EnigmailLog.DEBUG("pEpFilter.jsm: newMailConsumer: message " + msgHdr.messageKey + " was deleted\n");
          return;
        }

        if (resultObj && "result" in resultObj) {
          let decryptFlag = resultObj.result.outParams[0];
          EnigmailLog.DEBUG("pEpFilter.jsm: newMailConsumer: flag for " + msgHdr.messageKey + ": " + decryptFlag + "\n");

          if (++processAttempts > 3) {
            // ignore messages after more than 3 attempts
            return;
          }

          switch (decryptFlag) {
            case PEP_DECRYPT_FLAGS.ignore:
              EnigmailLog.DEBUG("pEpFilter.jsm: newMailConsumer: next round\n");
              EnigmailTimer.setTimeout(function _f() {
                processMailWithPep();
              }, 600000); // 10 minutes
              break;
            case PEP_DECRYPT_FLAGS.consume:
              delMsg(msgHdr);
              break;
            default:
              return;
          }
        }
      }).
      catch(err => {

      });
    }

    if (getPepAdapter().usingPep()) {
      // ensure line ends are CRLF
      rawMessageData.replace(/\r?\n/g, "\n").replace(/\n/g, "\r\n");

      let c = messageStruct.headers.getRawHeader("pep-auto-consume");
      if (c && c.join("").toLowerCase() === "yes") {
        processMailWithPep();
      }
    }
  }
};
