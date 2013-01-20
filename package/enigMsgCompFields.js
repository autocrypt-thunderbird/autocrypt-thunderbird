/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org>
 * are Copyright (C) 2008 Patrick Brunschwig.
 * All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL") or the GNU
 * Lesser General Public License (the "LGPL"), in which case
 * the provisions of the GPL or the LGPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL or the LGPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL or the
 * LGPL respectively.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL, the
 * GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

'use strict';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Ci = Components.interfaces;


// components defined in this file
const ENIG_ENIGMSGCOMPFIELDS_CONTRACTID =
    "@mozdev.org/enigmail/composefields;1";
const ENIG_ENIGMSGCOMPFIELDS_CID =
    Components.ID("{847b3a30-7ab1-11d4-8f02-006008948af5}");

function EnigMsgCompFields()
{
}

EnigMsgCompFields.prototype = {

  classDescription: "Enigmail Msg Compose Fields",
  classID:  ENIG_ENIGMSGCOMPFIELDS_CID,
  contractID: ENIG_ENIGMSGCOMPFIELDS_CONTRACTID,
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIEnigMsgCompFields,
    Ci.nsEnigMsgCompFields,
    Ci.nsIMsgSMIMECompFields,
    Ci.nsIMsgCompFields,
    Ci.nsISupports]),

  _parent: null,

  UIFlags: 0,

  endFlags: 0,

  senderEmailAddr: "",

  recipients: "",

  msgSMIMECompFields: null,

  init: function (smimeCompFields) {
    var members = [ "from",
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
      "listReply" ];
    this._parent = smimeCompFields;

    var m;
    for (m in members) {
      this[m]= smimeCompFields[m];
    }
  }
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([EnigMsgCompFields]);
