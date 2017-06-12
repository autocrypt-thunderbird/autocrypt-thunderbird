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
Cu.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false */
Cu.import("resource://enigmail/streams.jsm"); /* global EnigmailStreams: false */
Cu.import("resource://enigmail/constants.jsm"); /* global EnigmailConstants: false */
Cu.import("resource://gre/modules/jsmime.jsm"); /*global jsmime: false*/


const getDialog = EnigmailLazy.loader("enigmail/dialog.jsm", "EnigmailDialog");

var gNewMailListenerInitiated = false;

/**
 * filter action for creating a decrypted version of the mail and
 * deleting the original mail at the same time
 */

const filterActionMoveDecrypt = {
  id: EnigmailConstants.FILTER_MOVE_DECRYPT,
  name: EnigmailLocale.getString("filter.decryptMove.label"),
  value: "movemessage",
  apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {

    EnigmailLog.DEBUG("filters.jsm: filterActionMoveDecrypt: Move to: " + aActionValue + "\n");

    var msgHdrs = [];

    for (var i = 0; i < aMsgHdrs.length; i++) {
      msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
    }

    EnigmailDecryptPermanently.dispatchMessages(msgHdrs, aActionValue, aListener, true);
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
  isAsync: true,
  needsBody: true
};

/**
 * filter action for creating a decrypted copy of the mail, leaving the original
 * message untouched
 */
const filterActionCopyDecrypt = {
  id: EnigmailConstants.FILTER_COPY_DECRYPT,
  name: EnigmailLocale.getString("filter.decryptCopy.label"),
  value: "copymessage",
  apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
    EnigmailLog.DEBUG("filters.jsm: filterActionCopyDecrypt: Copy to: " + aActionValue + "\n");

    var msgHdrs = [];

    for (var i = 0; i < aMsgHdrs.length; i++) {
      msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
    }

    EnigmailDecryptPermanently.dispatchMessages(msgHdrs, aActionValue, aListener, false);
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
  isAsync: true,
  needsBody: true
};


function initNewMailListener() {
  EnigmailLog.DEBUG("filters.jsm: initNewMailListener()\n");

  if (!gNewMailListenerInitiated) {
    let notificationService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
      .getService(Ci.nsIMsgFolderNotificationService);
    notificationService.addListener(newMailListener, notificationService.msgAdded);
  }
  gNewMailListenerInitiated = true;
}

function getIdentityForSender(senderEmail, msgServer) {
  let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);

  let identities = accountManager.getIdentitiesForServer(msgServer);

  for (let i = 0; i < identities.length; i++) {
    let id = identities.queryElementAt(i, Ci.nsIMsgIdentity);
    if (id.email.toLowerCase() === senderEmail.toLowerCase()) {
      return id;
    }
  }

  return null;
}

var consumerList = [];


function JsmimeEmitter(requireBody) {
  this.requireBody = requireBody;
  this.mimeTree = {
    partNum: "",
    headers: null,
    body: "",
    parent: null,
    subParts: []
  };
  this.stack = [];
  this.currPartNum = "";
}

JsmimeEmitter.prototype = {

  createPartObj: function(partNum, headers, parent) {
    return {
      partNum: partNum,
      headers: headers,
      body: "",
      parent: parent,
      subParts: []
    };
  },

  getMimeTree: function() {
    return this.mimeTree.subParts[0];
  },

  /** JSMime API **/
  startMessage: function() {
    this.currentPart = this.mimeTree;
  },
  endMessage: function() {},

  startPart: function(partNum, headers) {
    EnigmailLog.DEBUG("filters.jsm: JsmimeEmitter.startPart: partNum=" + partNum + "\n");
    //this.stack.push(partNum);
    let newPart = this.createPartObj(partNum, headers, this.currentPart);

    if (partNum.indexOf(this.currPartNum) === 0) {
      // found sub-part
      this.currentPart.subParts.push(newPart);
    }
    else {
      // found same or higher level
      this.currentPart.subParts.push(newPart);
    }
    this.currPartNum = partNum;
    this.currentPart = newPart;
  },

  endPart: function(partNum) {
    EnigmailLog.DEBUG("filters.jsm: JsmimeEmitter.startPart: partNum=" + partNum + "\n");
    this.currentPart = this.currentPart.parent;
  },

  deliverPartData: function(partNum, data) {
    EnigmailLog.DEBUG("filters.jsm: JsmimeEmitter.deliverPartData: partNum=" + partNum + "\n");
    if (this.requireBody) {
      this.currentPart.body += data;
    }
  }
};

function processIncomingMail(url, requireBody, aMsgHdr) {
  EnigmailLog.DEBUG("filters.jsm: processIncomingMail()\n");

  let inputStream = EnigmailStreams.newStringStreamListener(msgData => {
    let opt = {
      strformat: "unicode",
      bodyformat: "decode"
    };

    try {
      let e = new JsmimeEmitter(requireBody);
      let p = new jsmime.MimeParser(e, opt);
      p.deliverData(msgData);


      for (let c of consumerList) {
        try {
          c.consumeMessage(e.getMimeTree(), msgData, aMsgHdr);
        }
        catch (ex) {
          EnigmailLog.DEBUG("filters.jsm: processIncomingMail: exception: " + ex.toString() + "\n");
        }
      }
    }
    catch (ex) {}
  });

  try {
    let channel = EnigmailStreams.createChannel(url);
    channel.asyncOpen(inputStream, null);
  }
  catch (e) {
    EnigmailLog.DEBUG("filters.jsm: processIncomingMail: open stream exception " + e.toString() + "\n");
  }
}

function getRequireMessageProcessing(aMsgHdr) {
  let isInbox = aMsgHdr.folder.getFlag(Ci.nsMsgFolderFlags.CheckNew) || aMsgHdr.folder.getFlag(Ci.nsMsgFolderFlags.Inbox);
  let requireBody = false;
  let inboxOnly = true;
  let selfSentOnly = false;
  let processReadMail = false;

  for (let c of consumerList) {
    if (!c.incomingMailOnly) {
      inboxOnly = false;
    }
    if (!c.unreadOnly) {
      processReadMail = true;
    }
    if (!c.headersOnly) {
      requireBody = true;
    }
    if (c.selfSentOnly) {
      selfSentOnly = true;
    }
  }

  if (!processReadMail && aMsgHdr.isRead) return null;
  if (inboxOnly && !isInbox) return null;
  if (selfSentOnly) {
    let sender = EnigmailFuncs.parseEmails(aMsgHdr.author, true);
    let id = null;
    if (sender && sender[0]) {
      id = getIdentityForSender(sender[0].email, aMsgHdr.folder.server);
    }

    if (!id) return null;
  }

  EnigmailLog.DEBUG("filters.jsm: getRequireMessageProcessing: author: " + aMsgHdr.author + "\n");

  let messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
  let msgSvc = messenger.messageServiceFromURI(aMsgHdr.folder.getUriForMsg(aMsgHdr));
  let u = {};
  msgSvc.GetUrlForUri(aMsgHdr.folder.getUriForMsg(aMsgHdr), u, null);

  let op = (u.value.spec.indexOf("?") > 0 ? "&" : "?");
  let url = u.value.spec + op + "header=enigmailFilter";

  return {
    url: url,
    requireBody: requireBody
  };
}

const newMailListener = {
  msgAdded: function(aMsgHdr) {
    EnigmailLog.DEBUG("filters.jsm: newMailListener.msgAdded() - got new mail in " + aMsgHdr.folder.prettiestName + "\n");

    if (consumerList.length === 0) return;

    let ret = getRequireMessageProcessing(aMsgHdr);
    if (ret) {
      processIncomingMail(ret.url, ret.requireBody, aMsgHdr);
    }
  }
};

/**
  messageStructure - Object:
    - partNum: String                       - MIME part number
    - headers: Object(nsIStructuredHeaders) - MIME part headers
    - body: String or typedarray            - the body part
    - parent: Object(messageStructure)      - link to the parent part
    - subParts: Array of Object(messageStructure) - array of the sub-parts
 */

const EnigmailFilters = {
  registerAll: function() {
    var filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(Ci.nsIMsgFilterService);
    filterService.addCustomAction(filterActionMoveDecrypt);
    filterService.addCustomAction(filterActionCopyDecrypt);
    initNewMailListener();
  },

  /**
   * add a new consumer to listen to new mails
   *
   * @param consumer - Object
   *   - headersOnly:      Boolean - needs full message body? [FUTURE]
   *   - incomingMailOnly: Boolean - only work on folder(s) that obtain new mail
   *                                  (Inbox and folders that listen to new mail)
   *   - unreadOnly:       Boolean - only process unread mails
   *   - selfSentOnly:     Boolean - only process mails with sender Email == Account Email
   *  - consumeMessage: function(messageStructure, rawMessageData, nsIMsgHdr)
   */
  addNewMailConsumer: function(consumer) {
    EnigmailLog.DEBUG("filters.jsm: addNewMailConsumer()\n");
    consumerList.push(consumer);
  },

  removeNewMailConsumer: function(consumer) {

  }
};
