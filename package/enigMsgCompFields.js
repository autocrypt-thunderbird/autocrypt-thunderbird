/*
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
 */

// components defined in this file
const ENIG_ENIGMSGCOMPFIELDS_CONTRACTID =
    "@mozdev.org/enigmail/composefields;1";
const ENIG_ENIGMSGCOMPFIELDS_CID =
    Components.ID("{847b3a30-7ab1-11d4-8f02-006008948af5}");


function EnigMsgCompFields()
{
}

EnigMsgCompFields.prototype = {

  _parent: null,
  
  UIFlags: 0,
  
  endFlags: 0,

  senderEmailAddr: "",
  
  recipients: "",
  
  hashAlgorithm: "",
  
  msgSMIMECompFields: null,

  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsIEnigMsgCompFields) &&
        !iid.equals(Components.interfaces.nsEnigMsgCompFields) &&
        !iid.equals(Components.interfaces.nsIMsgSMIMECompFields) &&
        !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  },

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
      "securityInfo" ];
    this._parent = smimeCompFields;
    
    for (mbr in members) { 
      // dump("enigMsgCompHlp: nsEnigMsgCompFields: init:"+mbr+"\n");
      eval("this."+members[mbr]+" = this._parent."+members[mbr]+";\n");
    }
   
    if (typeof(this._parent.splitRecipients) == "function") {
      // TB >= 3.0
      this.splitRecipients = this._parent.splitRecipients;
    }
    else {
      this.SplitRecipients = this._parent.SplitRecipients;
    }

    
  }
}

var EnigmailCompFldModule = {

  registerSelf: function (compMgr, fileSpec, location, type)
  {
    //dump("Registering nsEnigMsgCompFields.\n");

    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(ENIG_ENIGMSGCOMPFIELDS_CID,
                                    "Enigmail Msg Compose Fields",
                                    ENIG_ENIGMSGCOMPFIELDS_CONTRACTID,
                                    fileSpec,
                                    location,
                                    type);
    //dump("nsEnigMsgCompFields registered.\n");
  },
  
  unregisterSelf: function(compMgr, fileSpec, location)
  {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.unregisterFactoryLocation(ENIG_ENIGMSGCOMPFIELDS_CID, fileSpec);
  },
  
  getClassObject: function (compMgr, cid, iid) {
    if (cid.equals(ENIG_ENIGMSGCOMPFIELDS_CID))
      return EnigmailCompFldFactory;

    if (!iid.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    throw Components.results.NS_ERROR_NO_INTERFACE;    
  },

  canUnload: function(compMgr)
  {
    return true;
  }
}

// entrypoint
function NSGetModule(compMgr, fileSpec) {
  return EnigmailCompFldModule;
}

// factory for nsIEnigMsgCompFields
var EnigmailCompFldFactory = new Object();

EnigmailCompFldFactory.createInstance =
function (outer, iid) {
  if (outer != null)
    throw Components.results.NS_ERROR_NO_AGGREGATION;
  
  if (!iid.equals(Components.interfaces.nsIEnigMsgCompFields) &&
        !iid.equals(Components.interfaces.nsEnigMsgCompFields) &&
        !iid.equals(Components.interfaces.nsIMsgSMIMECompFields) &&
        !iid.equals(Components.interfaces.nsISupports))
    throw Components.results.NS_ERROR_INVALID_ARG;

  return new EnigMsgCompFields();
}

