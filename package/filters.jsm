/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailFilters"];

const EnigmailLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").EnigmailLazy;
const EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
const EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
const EnigmailPersistentCrypto = ChromeUtils.import("chrome://autocrypt/content/modules/persistentCrypto.jsm").EnigmailPersistentCrypto;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailStreams = ChromeUtils.import("chrome://autocrypt/content/modules/streams.jsm").EnigmailStreams;
const EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const NetUtil = ChromeUtils.import("resource://gre/modules/NetUtil.jsm").NetUtil;
const EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;

const getDialog = EnigmailLazy.loader("autocrypt/dialog.jsm", "EnigmailDialog");

var gNewMailListenerInitiated = false;

function isPGPEncrypted(data) {
  // We only check the first mime subpart for application/pgp-encrypted.
  // If it is text/plain or text/html we look into that for the
  // message marker.
  // If there are no subparts we just look in the body.
  //
  // This intentionally does not match more complex cases
  // with sub parts beeing encrypted etc. as auto processing
  // these kinds of mails will be error prone and better not
  // done through a filter

  var mimeTree = EnigmailMime.getMimeTree(data, true);
  if (!(mimeTree.subParts.length)) {
    // No subParts. Check for PGP Marker in Body
    return mimeTree.body.indexOf('-----BEGIN PGP MESSAGE-----') >= 0;
  }

  // Check the type of the first subpart.
  var firstPart = mimeTree.subParts[0];
  var ct = firstPart.fullContentType;
  if (typeof(ct) == "string") {
    ct = ct.replace(/[\r\n]/g, " ");
    // Proper PGP/MIME ?
    if (ct.search(/application\/pgp-encrypted/i) >= 0) {
      return true;
    }
    // Look into text/plain pgp messages and text/html messages.
    if (ct.search(/text\/plain/i) >= 0 ||
      ct.search(/text\/html/i) >= 0) {
      return firstPart.body.indexOf('-----BEGIN PGP MESSAGE-----') >= 0;
    }
  }
  return false;
}

/**
 * filter term for OpenPGP Encrypted mail
 */
const filterTermPGPEncrypted = {
  id: EnigmailConstants.FILTER_TERM_PGP_ENCRYPTED,
  name: EnigmailLocale.getString("filter.term.pgpencrypted.label"),
  needsBody: true,
  match: function(aMsgHdr, searchValue, searchOp) {
    var folder = aMsgHdr.folder;
    var stream = folder.getMsgInputStream(aMsgHdr, {});

    var messageSize = folder.hasMsgOffline(aMsgHdr.messageKey) ? aMsgHdr.offlineMessageSize : aMsgHdr.messageSize;
    var scriptInput = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance();
    var data;
    try {
      data = NetUtil.readInputStreamToString(stream, messageSize);
    }
    catch (ex) {
      EnigmailLog.DEBUG("filters.jsm: filterTermPGPEncrypted: failed to get data.\n");
      // If we don't know better to return false.
      stream.close();
      return false;
    }

    var isPGP = isPGPEncrypted(data);

    stream.close();

    return ((searchOp == Ci.nsMsgSearchOp.Is && isPGP) ||
      (searchOp == Ci.nsMsgSearchOp.Isnt && !isPGP));
  },

  getEnabled: function(scope, op) {
    return true;
  },

  getAvailable: function(scope, op) {
    return true;
  },

  getAvailableOperators: function(scope, length) {
    length.value = 2;
    return [Ci.nsMsgSearchOp.Is, Ci.nsMsgSearchOp.Isnt];
  }
};

/**
 * Add a custom filter action. If the filter already exists, do nothing
 * (for example, if addon is disabled and re-enabled)
 *
 * @param filterObj - nsIMsgFilterCustomAction
 */
function addFilterIfNotExists(filterObj) {
  let filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(Ci.nsIMsgFilterService);

  let foundFilter = null;
  try {
    foundFilter = filterService.getCustomAction(filterObj.id);
  }
  catch (ex) {}

  if (!foundFilter) {
    EnigmailLog.DEBUG("filters.jsm: addFilterIfNotExists: " + filterObj.id + "\n");
    filterService.addCustomAction(filterObj);
  }
}

function initNewMailListener() {
  EnigmailLog.DEBUG("filters.jsm: initNewMailListener()\n");

  if (!gNewMailListenerInitiated) {
    let notificationService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
      .getService(Ci.nsIMsgFolderNotificationService);
    notificationService.addListener(newMailListener, notificationService.msgAdded);
  }
  gNewMailListenerInitiated = true;
}

function shutdownNewMailListener() {
  EnigmailLog.DEBUG("filters.jsm: shutdownNewMailListener()\n");

  if (gNewMailListenerInitiated) {
    let notificationService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
      .getService(Ci.nsIMsgFolderNotificationService);
    notificationService.removeListener(newMailListener);
    gNewMailListenerInitiated = false;
  }
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
      if (typeof(data) === "string") {
        this.currentPart.body += data;
      }
      else {
        this.currentPart.body += EnigmailData.arrayBufferToString(data);
      }
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

var EnigmailFilters = {
  onStartup: function() {
    let filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(Ci.nsIMsgFilterService);
    filterService.addCustomTerm(filterTermPGPEncrypted);
    initNewMailListener();
  },

  onShutdown: function() {
    shutdownNewMailListener();
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
