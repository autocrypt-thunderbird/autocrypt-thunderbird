/*global Components XPCOMUtils */
/* jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var EXPORTED_SYMBOLS = ["EnigmailMsgCompFields"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Ci = Components.interfaces;


// components defined in this file
const ENIG_ENIGMSGCOMPFIELDS_CONTRACTID =
  "@mozdev.org/enigmail/composefields;1";
const ENIG_ENIGMSGCOMPFIELDS_CID =
  Components.ID("{847b3a30-7ab1-11d4-8f02-006008948af5}");

/**
 * This object extends nsIMsgSMIMECompFields and nsIMsgCompFields.
 * As this can't be done directly anymore, we abuse nsIMsgSearchValue
 * to store a JSON string in the "str" field.
 *
 * The Enigmail-specific values should not be accessed directly, but via
 * EnigmailMsgCompFields.getValue and EnigmailMsgCompFields.setValue
 *
 */
function MessageCompFields(smimeCompFields) {
  this._parent = smimeCompFields;

  // nsIMsgCompFields and nsIMsgSMIMECompFields values
  const members = ["from",
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
    "listReply",
    "requireEncryptMessage",
    "signMessage"
  ];

  this._parent = smimeCompFields;

  if (smimeCompFields) {
    for (let m in members) {
      this[m] = smimeCompFields[m];
    }
  }

  // nsIMsgSearchValue attributes
  this.str = "{}";
  this.date = null;
  this.status = null;
  this.size = null;
  this.msgKey = null;
  this.age = null;
  this.folder = null;
  this.label = null;
  this.junkStatus = null;
  this.junkPercent = null;

}

MessageCompFields.prototype = {

  classDescription: "Enigmail Msg Compose Fields",
  classID: ENIG_ENIGMSGCOMPFIELDS_CID,
  contractID: ENIG_ENIGMSGCOMPFIELDS_CONTRACTID,
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIMsgSearchValue, // we abuse nsIMsgSearchValue as we cannot create a custom QueryInterface anymore
    Ci.nsIMsgSMIMECompFields,
    Ci.nsIMsgCompFields,
    Ci.nsISupports
  ]),

  toString: function() {
    return "";
  }
};


var EnigmailMsgCompFields = {
  CompFields: MessageCompFields,

  createObject: function(smimeCompFields) {
    return new MessageCompFields(smimeCompFields);
  },

  setValue: function(enigCompFields, fieldName, value) {
    let cf = enigCompFields.QueryInterface(Ci.nsIMsgSearchValue);
    let o = {};
    try {
      o = JSON.parse(cf.str);
    }
    catch (ex) {}

    o[fieldName] = value;

    cf.str = JSON.stringify(o);
  },

  getEnigmailValues: function(enigCompFields) {
    let cf = '{}';
    try {
      cf = enigCompFields.QueryInterface(Ci.nsIMsgSearchValue);
    }
    catch (x) {}

    let o = {};
    try {
      o = JSON.parse(cf.str);
    }
    catch (ex) {
      return null;
    }

    return o;
  },

  getValue: function(enigCompFields, fieldName) {
    let o = this.getEnigmailValues(enigCompFields);

    if (!o) return null;
    return o[fieldName];
  },

  isEnigmailCompField: function(enigCompFields) {
    try {
      let cf = enigCompFields.QueryInterface(Ci.nsIMsgSearchValue);
      return true;
    }
    catch (ex) {
      return false;
    }
  }
};
