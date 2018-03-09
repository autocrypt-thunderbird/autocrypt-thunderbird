/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Wrapper library for TB-stdlib to avoid naming conflicts
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailStdlib"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/stdlib/compose.jsm");
/* global composeInIframe: false, getEditorForIframe,
 quoteMsgHdr: false, citeString, htmlToPlainText: false, simpleWrap, plainTextToHtml: false, replyAllParams,
 determineComposeHtml: false, composeMessageTo, getSignatureContentsForAccount: false */
Cu.import("resource://enigmail/stdlib/misc.jsm");
/* global gIdentities: false, fillIdentities: false, getIdentities: false, getDefaultIdentity: false, getIdentityForEmail,
 range: false, MixIn: false, combine: false, entries, NS_FAILED: false, NS_SUCCEEDED, dateAsInMessageList: false, escapeHtml: false, sanitize: false, parseMimeLine,
 encodeUrlParameters: false, decodeUrlParameters, systemCharset, isOSX: false, isWindows: false, isAccel: false
 hasConfiguredAccounts: false */
Cu.import("resource://enigmail/stdlib/msgHdrUtils.jsm");
/* global msgHdrToMessageBody: false, msgHdrToNeckoURL: false, msgHdrGetTags: false, msgUriToMsgHdr,
 msgHdrGetUri: false, msgHdrFromNeckoUrl: false, msgHdrSetTags: false, msgHdrIsDraft: false, msgHdrIsSent: false, msgHdrIsArchive: false, msgHdrIsInbox: false,
 msgHdrIsRss: false, msgHdrIsNntp: false, msgHdrIsJunk: false, msgHdrsMarkAsRead: false, msgHdrsArchive: false, msgHdrsDelete,
 getMail3Pane: false, msgHdrGetHeaders: false, msgHdrsModifyRaw */

var EnigmailStdlib = {
  // compose.jsm
  'composeInIframe': composeInIframe,
  'getEditorForIframe': getEditorForIframe,
  'quoteMsgHdr': quoteMsgHdr,
  'citeString': citeString,
  'htmlToPlainText': htmlToPlainText,
  'simpleWrap': simpleWrap,
  'plainTextToHtml': plainTextToHtml,
  'replyAllParams': replyAllParams,
  'determineComposeHtml': determineComposeHtml,
  'composeMessageTo': composeMessageTo,
  'getSignatureContentsForAccount': getSignatureContentsForAccount,

  // misc.jsm
  'gIdentities': gIdentities,
  'fillIdentities': fillIdentities,
  'getIdentities': getIdentities,
  'getDefaultIdentity': getDefaultIdentity,
  'getIdentityForEmail': getIdentityForEmail,
  'hasConfiguredAccounts': hasConfiguredAccounts,
  'range': range,
  'MixIn': MixIn,
  'combine': combine,
  'entries': entries,
  'NS_FAILED': NS_FAILED,
  'NS_SUCCEEDED': NS_SUCCEEDED,
  'dateAsInMessageList': dateAsInMessageList,
  'escapeHtml': escapeHtml,
  'sanitize': sanitize,
  'parseMimeLine': parseMimeLine,
  'encodeUrlParameters': encodeUrlParameters,
  'decodeUrlParameters': decodeUrlParameters,
  'systemCharset': systemCharset,
  'isOSX': isOSX,
  'isWindows': isWindows,
  'isAccel': isAccel,

  // msgHdrUtils.jsm
  'msgHdrToMessageBody': msgHdrToMessageBody,
  'msgHdrToNeckoURL': msgHdrToNeckoURL,
  'msgHdrGetTags': msgHdrGetTags,
  'msgUriToMsgHdr': msgUriToMsgHdr,
  'msgHdrGetUri': msgHdrGetUri,
  'msgHdrFromNeckoUrl': msgHdrFromNeckoUrl,
  'msgHdrSetTags': msgHdrSetTags,
  'msgHdrIsDraft': msgHdrIsDraft,
  'msgHdrIsSent': msgHdrIsSent,
  'msgHdrIsArchive': msgHdrIsArchive,
  'msgHdrIsInbox': msgHdrIsInbox,
  'msgHdrIsRss': msgHdrIsRss,
  'msgHdrIsNntp': msgHdrIsNntp,
  'msgHdrIsJunk': msgHdrIsJunk,
  'msgHdrsMarkAsRead': msgHdrsMarkAsRead,
  'msgHdrsArchive': msgHdrsArchive,
  'msgHdrsDelete': msgHdrsDelete,
  'getMail3Pane': getMail3Pane,
  'msgHdrGetHeaders': msgHdrGetHeaders,
  'msgHdrsModifyRaw': msgHdrsModifyRaw
};
