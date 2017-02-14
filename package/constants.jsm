/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailConstants"];

const EnigmailConstants = {
  POSSIBLE_PGPMIME: -2081,

  // possible values for
  // - encryptByRule, signByRules, pgpmimeByRules
  // - encryptForced, signForced, pgpmimeForced (except CONFLICT)
  // NOTE:
  // - values 0/1/2 are used with this fixed semantics in the persistent rules
  // - see also enigmailEncryptionDlg.xul
  ENIG_NEVER: 0,
  ENIG_UNDEF: 1,
  ENIG_ALWAYS: 2,
  ENIG_FORCE_SMIME: 3,
  ENIG_AUTO_ALWAYS: 22,
  ENIG_CONFLICT: 99,

  ENIG_FINAL_UNDEF: -1,
  ENIG_FINAL_NO: 0,
  ENIG_FINAL_YES: 1,
  ENIG_FINAL_FORCENO: 10,
  ENIG_FINAL_FORCEYES: 11,
  ENIG_FINAL_SMIME: 97, // use S/MIME (automatically chosen)
  ENIG_FINAL_FORCESMIME: 98, // use S/MIME (forced by user)
  ENIG_FINAL_CONFLICT: 99,

  MIME_HANDLER_UNDEF: 0,
  MIME_HANDLER_SMIME: 1,
  MIME_HANDLER_PGPMIME: 2,

  ICONTYPE_INFO: 1,
  ICONTYPE_QUESTION: 2,
  ICONTYPE_ALERT: 3,
  ICONTYPE_ERROR: 4,

  FILTER_MOVE_DECRYPT: "enigmail@enigmail.net#filterActionMoveDecrypt",
  FILTER_COPY_DECRYPT: "enigmail@enigmail.net#filterActionCopyDecrypt",


  nsIEnigmail: Components.interfaces.nsIEnigmail

};
