/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for interfacing to pEp (Enigmal-specific functions)
 */


const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

const COLOR_UNDEF = -471142;

Cu.import("resource://enigmail/pEp.jsm"); /*global EnigmailpEp: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Cu.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/mimeVerify.jsm"); /*global EnigmailVerify: false */
Cu.import("resource://enigmail/uris.jsm"); /*global EnigmailURIs: false */
Cu.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */
Cu.import("resource:///modules/jsmime.jsm"); /*global jsmime: false*/
Cu.import("resource://enigmail/singletons.jsm"); /*global EnigmailSingletons: false */


var EXPORTED_SYMBOLS = ["EnigmailPEPDecrypt"];

const LAST_MSG = EnigmailSingletons.lastDecryptedMessage;

var inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);


var EnigmailPEPDecrypt = {
  /**
   * create a new PEP decryption object (for PGP/MIME handling)
   *
   * @param contentType - String: the value of the RFC 822 Content-Type
   *
   * @return Object
   */
  getDecryptionService: function(contentType) {
    return new PEPDecryptor(contentType);
  },

  /**
   * Decrypt a message using pEp
   *
   * @param isPgpMime:   Boolean - true if PGP/MIME decryption, false for inline-PGP (or unknown)
   * @param msgData:     String - the message to be decrypted
   * @param adr:         Object -
   *          from: email, [to, cc, reply_to]: Array of emails
   * @param contentType: String - the content-type string (only required for PGP/MIME)
   *
   * @return null    - if decryption unsuccessful
   *         Object: - if decryption successful
   *          - longmsg  - String: the decrypted message
   *          - shortmsg - String; message subject (if any)
   *          - rating:  - Number: the pEp rating of how securely the message was tansmitted
   *          - fpr:     - Array of String: the list of fingerprints used for the message
   *          - persons: - Object:
   *                - from:       pEpPerson
   *                - to:         Array of pEpPerson
   *                - cc:         Array of pEpPerson
   *                - reply_to:   Array of pEpPerson
   */
  decryptMessageData: function(isPgpMime, msgData, adr, contentType) {
    let s = msgData.search(/^-----BEGIN PGP MESSAGE-----/m);
    let e = msgData.search(/^-----END PGP MESSAGE-----/m);
    let pgpData = s >= 0 && e > s ? msgData.substring(s, e + 27) : msgData;

    if (!adr) adr = {};

    if (!("from" in adr)) {
      adr.from = {
        email: "unknown@localhost"
      };
    }
    if (!("to" in adr)) adr.to = [];
    if (!("cc" in adr)) adr.cc = [];

    let from = EnigmailPEPAdapter.emailToPepPerson(adr.from);
    let to = [];
    for (let i of adr.to) {
      to.push(EnigmailPEPAdapter.emailToPepPerson(i));
    }

    let cc = [];
    for (let i of adr.cc) {
      cc.push(EnigmailPEPAdapter.emailToPepPerson(i));
    }

    let replyTo;
    if ("replyTo" in adr) {
      replyTo = [];
      for (let i of adr.replyTo) {
        replyTo.push(EnigmailPEPAdapter.emailToPepPerson(i));
      }
    }

    if (isPgpMime) {
      return decryptPgpMime(msgData, from, to, cc, replyTo);
    }
    else {
      return decryptInlinePgp(pgpData, from, to, cc, replyTo);
    }
  },

  getEmailsFromMessage: function(url) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: getEmailsFromMessage:\n");
    let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
    let addresses = {
      from: null,
      to: [],
      cc: []
    };

    let s = EnigmailStreams.newStringStreamListener(
      function analyzeData(data) {
        EnigmailLog.DEBUG("pEpDecrypt.jsm: getEmailsFromMessage: got " + data.length + " bytes\n");

        let i = data.search(/\n\r?\n/);
        if (i < 0) i = data.length;

        let hdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
        hdr.initialize(data.substr(0, i));

        if (hdr.hasHeader("from")) {
          addresses.from = hdr.getHeader("from")[0];
        }
        if (hdr.hasHeader("to")) {
          addresses.to = hdr.getHeader("to");
        }
        if (hdr.hasHeader("cc")) {
          addresses.cc = hdr.getHeader("cc");
        }
        if (hdr.hasHeader("reply-to")) {
          addresses.replyTo = hdr.getHeader("reply-to");
        }

        if (inspector && inspector.eventLoopNestLevel > 0) {
          // unblock the waiting lock
          inspector.exitNestedEventLoop();
        }
      }
    );

    try {
      var channel = EnigmailStreams.createChannel(url);
      channel.asyncOpen(s, null);

      // wait here for message parsing to terminate
      inspector.enterNestedEventLoop(0);
    }
    catch (e) {
      EnigmailLog.DEBUG("pEpDecrypt.jsm: getEmailsFromMessage: exception " + e + "\n");
    }

    return addresses;
  }
};

/**
 *  decryption handler for PGP/MIME messages (nsIStreamListener)
 */
function PEPDecryptor(contentType) {
  this.contentType = contentType;
  this.sourceData = "";
  this.uri = null;
  this.backgroundJob = false;
  this.decryptedData = "";
  this.decryptedHeaders = {};
  this.mimePartNumber = "";
  this.requestingSubpart = false;
  this.ignoreMessage = false;
}


PEPDecryptor.prototype = {

  onStartRequest: function(request, uri) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: onStartRequest\n");
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    this.msgWindow = EnigmailVerify.lastMsgWindow;
    if (uri) {
      this.uri = uri.QueryInterface(Ci.nsIURI).clone();
      EnigmailLog.DEBUG("pEpDecrypt.jsm: onStartRequest: uri='" + this.uri.spec + "'\n");

      this.backgroundJob = (this.uri.spec.search(/[&?]header=(filter|print|quotebody|enigmailConvert)/) >= 0);
      this.requestingSubpart = (this.uri.spec.search(/[&?]part=/) >= 0);
      this.ignoreMessage = (this.uri.spec.search(/[&?]header=enigmailFilter/) >= 0);
    }

    if (!this.isReloadingLastMessage()) {
      LAST_MSG.lastMessageData = "";
      LAST_MSG.lastMessageURI = null;
    }

    if ("mimePart" in this.mimeSvc) {
      this.mimePartNumber = this.mimeSvc.mimePart;
    }
    else {
      this.mimePartNumber = "";
    }
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    if (count > 0) {
      inStream.init(stream);
      this.sourceData += inStream.read(count);
    }
  },

  onStopRequest: function() {
    // make the string a complete MIME message

    if (this.ignoreMessage) {
      this.mimeSvc.onStopRequest(null, null, 0);
      return;
    }

    if (this.isReloadingLastMessage()) {
      EnigmailLog.DEBUG("pEpDecrypt.jsm: onStopRequest: returning same data as before\n");

      this.decryptedData = LAST_MSG.lastMessageData;
      this.returnData();

      if (!this.backgroundJob) {
        // only display the decrption/verification status if not background-Job
        this.decryptedHeaders = LAST_MSG.lastPepStatus.decryptedHeaders;
        this.mimePartNumber = LAST_MSG.lastPepStatus.mimePartNumber;

        this.displayStatus(LAST_MSG.lastPepStatus.rating, LAST_MSG.lastPepStatus.fpr, LAST_MSG.lastPepStatus.dec.persons);
      }

      return;
    }

    let wrapper = EnigmailMime.createBoundary();
    this.decryptedData = 'Content-Type: multipart/mixed; boundary="' + wrapper + '"\r\n' +
      'Content-Disposition: inline\r\n\r\n' +
      '--' + wrapper + '\r\n' +
      "Content-Type: text/plain\r\n\r\n" + EnigmailLocale.getString("pEpDecrypt.cannotDecrypt") + '\r\n' +
      '--' + wrapper + '--\r\n';

    this.sourceData = "Content-Type: " + this.contentType + "\r\n\r\n" + this.sourceData;

    let addresses;
    if (this.uri && (!this.backgroundJob) && (!this.requestingSubpart)) {
      addresses = EnigmailPEPDecrypt.getEmailsFromMessage(this.uri.spec);
    }

    let dec = EnigmailPEPDecrypt.decryptMessageData(true, this.sourceData, addresses, this.contentType);

    let rating = COLOR_UNDEF;
    let fpr = [];

    if (dec) {
      this.decryptedData = dec.longmsg;
      if (dec.shortmsg && dec.shortmsg.length > 0) {
        this.decryptedHeaders.subject = dec.shortmsg;
      }
      rating = dec.rating;
      fpr = dec.fpr;

      this.extractEncryptedHeaders();

      // HACK: remove filename from 1st HTML part to make TB display message without attachment
      this.decryptedData = this.decryptedData.replace(/^Content-Disposition: inline; filename="msg.txt"/m, "Content-Disposition: inline");
      this.decryptedData = this.decryptedData.replace(/^Content-Disposition: inline; filename="msg.html"/m, "Content-Disposition: inline");

      let i = this.decryptedData.search(/\n\r?\n/);
      if (i > 0) {
        let hdr = this.decryptedData.substr(0, i);
        if (hdr.search(/^content-type:\s+text\/(plain|html)/im) >= 0) {
          EnigmailLog.DEBUG("pEpDecrypt.jsm: done: adding multipart/mixed around '" + hdr + "'\n");

          this.decryptedData = 'Content-Type: multipart/mixed; boundary="' + wrapper + '"\r\n' +
            'Content-Disposition: inline\r\n\r\n' +
            '--' + wrapper + '\r\n' +
            this.decryptedData + '\r\n' +
            '--' + wrapper + '--\r\n';
        }
      }

      if (!this.backgroundJob) {
        // only display the decrption/verification status if not background-Job
        this.displayStatus(rating, fpr, dec.persons);
        LAST_MSG.lastPepStatus = {
          rating: rating,
          fpr: fpr,
          dec: dec,
          decryptedHeaders: this.decryptedHeaders,
          mimePartNumber: this.mimePartNumber
        };
      }
    }

    LAST_MSG.lastMessageURI = EnigmailURIs.msgIdentificationFromUrl(this.uri);
    LAST_MSG.lastMessageData = this.decryptedData;
    this.returnData();
  },

  returnData: function() {
    if ("outputDecryptedData" in this.mimeSvc) {
      this.mimeSvc.outputDecryptedData(this.decryptedData, this.decryptedData.length);
    }
    else {
      let gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
      gConv.setData(this.decryptedData, this.decryptedData.length);
      this.mimeSvc.onDataAvailable(null, null, gConv, 0, this.decryptedData.length);
      this.mimeSvc.onStopRequest(null, null, 0);
    }
  },

  displayStatus: function(rating, fpr, persons) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: displayStatus\n");

    if (this.msgWindow === null || this.backgroundJob || this.requestingSubpart)
      return;

    let uriSpec = (this.uri ? this.uri.spec : null);

    try {
      EnigmailLog.DEBUG("pEpDecrypt.jsm: displayStatus for uri " + uriSpec + "\n");
      let headerSink = EnigmailSingletons.messageReader;

      if (headerSink && this.uri) {

        let r = {
          fpr: fpr.join(","),
          persons: persons,
          rating: rating
        };
        headerSink.processDecryptionResult(this.uri, "modifyMessageHeaders", JSON.stringify(this.decryptedHeaders), this.mimePartNumber);
        headerSink.processDecryptionResult(this.uri, "displayPepStatus", JSON.stringify(r), this.mimePartNumber);
      }
    }
    catch (ex) {
      EnigmailLog.writeException("pEpDecrypt.jsm", ex);
    }
    EnigmailLog.DEBUG("pEpDecrypt.jsm: displayStatus done\n");
  },

  /**
   * Determine if we are reloading the same message as the previous one
   *
   * @return Boolean
   */
  isReloadingLastMessage: function() {
    if (!this.uri) return false;
    if (!LAST_MSG.lastMessageURI) return false;

    let currMsg = EnigmailURIs.msgIdentificationFromUrl(this.uri);

    if (LAST_MSG.lastMessageURI.folder === currMsg.folder && LAST_MSG.lastMessageURI.msgNum === currMsg.msgNum) {
      return true;
    }

    return false;
  },

  /**
   * extract protected headers from the message and modify decrypted data to not
   * contain them anymore
   */
  extractEncryptedHeaders: function() {
    let r = EnigmailMime.extractProtectedHeaders(this.decryptedData);
    if (!r) return;

    this.decryptedHeaders = r.newHeaders;
    if (r.startPos >= 0 && r.endPos > r.startPos) {
      this.decryptedData = this.decryptedData.substr(0, r.startPos) + this.decryptedData.substr(r.endPos);
    }
  }
};


function decryptPgpMime(msgData, from, to, cc, replyTo) {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  let resultObj;
  let msgStr = "";

  let mapAddr = function _map(x) {
    return x.address;
  };

  if (to) {
    msgStr += to.map(mapAddr).join(", ") + ", ";
  }
  if (cc) {
    msgStr += cc.map(mapAddr).join(", ") + ", ";
  }
  if (replyTo) {
    msgStr += replyTo.map(mapAddr).join(", ") + ", ";
  }

  msgStr = msgStr.replace(/, [, ]+/g, ", ").replace(/, $/, "");
  if (msgStr.length > 0) {
    msgStr = "To: " + msgStr + "\r\n";
  }

  msgStr = "From:" + from.address + "\r\n" + msgStr + msgData;

  EnigmailpEp.decryptMimeString(msgStr).then(function _step2(res) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: decryptMessage: SUCCESS\n");
    if ((typeof(res) === "object") && ("result" in res)) {
      resultObj = res.result.outParams;
    }
    else
      EnigmailLog.DEBUG("pEpDecrypt.jsm: decryptMessage: typeof res=" + typeof(res) + "\n");


    if (inspector && inspector.eventLoopNestLevel > 0) {
      // unblock the waiting lock in finishCryptoEncapsulation
      inspector.exitNestedEventLoop();
    }

  }).catch(function _error(err) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: processPepEncryption: ERROR\n");
    try {
      EnigmailLog.DEBUG(err.code + ": " + ("exception" in err ? err.exception.toString() : err.message) + "\n");
    }
    catch (x) {
      EnigmailLog.DEBUG(JSON.stringify(err) + "\n");
    }

    if (inspector && inspector.eventLoopNestLevel > 0) {
      // unblock the waiting lock in finishCryptoEncapsulation
      inspector.exitNestedEventLoop();
    }
  });

  // wait here for PEP to terminate
  inspector.enterNestedEventLoop(0);

  if (resultObj && (typeof(resultObj[3]) === "string")) {

    let msgSubject = "";
    let i = resultObj[3].search(/\r?\n\r?\n/);
    if (i > 0) {
      let hdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
      hdr.initialize(resultObj[3].substr(0, i));
      if (hdr.hasHeader("subject")) {
        msgSubject = jsmime.headerparser.decodeRFC2047Words(hdr.extractHeader("subject", true)) || "";
      }
    }

    return {
      longmsg: resultObj[3],
      shortmsg: msgSubject,
      persons: {
        from: from,
        to: to,
        cc: cc,
        reply_to: replyTo
      },
      rating: resultObj[1].rating,
      fpr: resultObj[2]
    };
  }
  else return null;
}


function decryptInlinePgp(pgpData, from, to, cc, replyTo) {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
  let resultObj;

  EnigmailpEp.decryptMessage(pgpData, from, to, cc, replyTo).then(function _step2(res) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: decryptMessage: SUCCESS\n");
    if ((typeof(res) === "object") && ("result" in res)) {
      resultObj = res.result.outParams;
    }
    else
      EnigmailLog.DEBUG("pEpDecrypt.jsm: decryptMessage: typeof res=" + typeof(res) + "\n");

    if (inspector && inspector.eventLoopNestLevel > 0) {
      // unblock the waiting lock in finishCryptoEncapsulation
      inspector.exitNestedEventLoop();
    }

  }).catch(function _error(err) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: processPepEncryption: ERROR\n");
    try {
      EnigmailLog.DEBUG(err.code + ": " + ("exception" in err ? err.exception.toString() : err.message) + "\n");
    }
    catch (x) {
      EnigmailLog.DEBUG(JSON.stringify(err) + "\n");
    }

    if (inspector && inspector.eventLoopNestLevel > 0) {
      // unblock the waiting lock in finishCryptoEncapsulation
      inspector.exitNestedEventLoop();
    }
  });

  // wait here for PEP to terminate
  inspector.enterNestedEventLoop(0);

  if (resultObj && (typeof(resultObj[3]) === "object")) {
    return {
      longmsg: resultObj[3].longmsg,
      shortmsg: "", // resultObj[3].shortmsg,
      persons: {
        from: resultObj[3].from,
        to: resultObj[3].to,
        cc: resultObj[3].cc,
        reply_to: resultObj[3].reply_to
      },
      rating: resultObj[1].rating,
      fpr: resultObj[2]
    };
  }
  else return null;
}
