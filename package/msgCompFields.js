/*global Components XPCOMUtils */
/* jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Ci = Components.interfaces;


// components defined in this file
const ENIG_ENIGMSGCOMPFIELDS_CONTRACTID =
  "@mozdev.org/enigmail/composefields;1";
const ENIG_ENIGMSGCOMPFIELDS_CID =
  Components.ID("{847b3a30-7ab1-11d4-8f02-006008948af5}");

function EnigMsgCompFields() {}

EnigMsgCompFields.prototype = {

  classDescription: "Enigmail Msg Compose Fields",
  classID: ENIG_ENIGMSGCOMPFIELDS_CID,
  contractID: ENIG_ENIGMSGCOMPFIELDS_CONTRACTID,
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIEnigMsgCompFields,
    Ci.nsEnigMsgCompFields,
    Ci.nsIMsgSMIMECompFields,
    Ci.nsIMsgCompFields,
    Ci.nsISupports
  ]),

  _parent: null,

  UIFlags: 0,

  endFlags: 0,

  senderEmailAddr: "",

  recipients: "",

  msgSMIMECompFields: null,

  init: function(smimeCompFields) {
    var members = ["from",
      "replyTo",
      "to",
      "cc",
      "bcc",
      "fcc",
      "fcc2",
      "newsgroups",
      "newshost",
      "newspostUrl",
      "followupTo",
      "subject",
      "attachments",
      "organization",
      "references",
      "priority",
      "messageId",
      "characterSet",
      "defaultCharacterSet",
      "templateName",
      "draftId",
      "returnReceipt",
      "receiptHeaderType",
      "attachVCard",
      "forcePlainText",
      "useMultipartAlternative",
      "uuEncodeAttachments",
      "bodyIsAsciiOnly",
      "forceMsgEncoding",
      "otherRandomHeaders",
      "body",
      "temporaryFiles",
      "attachmentsArray",
      "addAttachment",
      "removeAttachment",
      "removeAttachments",
      "ConvertBodyToPlainText",
      "checkCharsetConversion",
      "needToCheckCharset",
      "securityInfo",
      "senderReply",
      "allReply",
      "splitRecipients",
      "listReply"
    ];
    this._parent = smimeCompFields;

    var m;
    for (m in members) {
      this[m] = smimeCompFields[m];
    }
  }
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([EnigMsgCompFields]);
