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
Cu.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */


var EXPORTED_SYMBOLS = ["EnigmailPEPDecrypt"];

var inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
var gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);

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
   * @param msgData: String - the message to be decrypted
   *
   * @return null    - if decryption unsuccessful
   *         Object: - if decryption successful
   *          - longmsg  - String: the decrypted message
   *          - shortmsg - String; message subject (if any)
   *          - color:   - Number: the pEp rating of how securely the message was tansmitted
   *          - fpr:     - Array of String: the list of fingerprints used for the message
   */
  decryptMessageData: function(msgData, adr) {
    let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
    let resultObj = null;

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

    EnigmailpEp.decryptMessage(pgpData, from, to, cc).then(function _step2(res) {
      EnigmailLog.DEBUG("pEpDecrypt.jsm: decryptMessage: SUCCESS\n");
      if ((typeof(res) === "object") && ("result" in res)) {
        resultObj = res.result;
      }
      else
        EnigmailLog.DEBUG("pEpDecrypt.jsm: decryptMessage: typeof res=" + typeof(res) + "\n");


      if (inspector && inspector.eventLoopNestLevel > 0) {
        // unblock the waiting lock in finishCryptoEncapsulation
        inspector.exitNestedEventLoop();
      }

    }).catch(function _error(err) {
      EnigmailLog.DEBUG("pEpDecrypt.jsm: processPepEncryption: ERROR\n");
      EnigmailLog.DEBUG(err.code + ": " + ("exception" in err ? err.exception.toString() : err.message) + "\n");

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
        shortmsg: resultObj[3].shortmsg,
        color: resultObj[1].color,
        fpr: resultObj[2]
      };
    }
    else return null;
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
}


PEPDecryptor.prototype = {

  onStartRequest: function(request, uri) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: onStartRequest\n");
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    this.msgWindow = EnigmailVerify.lastMsgWindow;
    if (uri) {
      this.uri = uri.QueryInterface(Ci.nsIURI).clone();
      EnigmailLog.DEBUG("pEpDecrypt.jsm: onStartRequest: uri='" + this.uri.spec + "'\n");

      this.backgroundJob = (this.uri.spec.search(/[\&\?]header=(print|quotebody|enigmailConvert)/) >= 0);
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

    this.decryptedData = "Content-Type: text/plain\r\n\r\n" + EnigmailLocale.getString("pEpDecrypt.cannotDecrypt");

    this.sourceData = "Content-Type: " + this.contentType + "\r\n\r\n" + this.sourceData;

    let addresses;
    if (this.uri) {
      addresses = EnigmailPEPDecrypt.getEmailsFromMessage(this.uri.spec);
    }

    let dec = EnigmailPEPDecrypt.decryptMessageData(this.sourceData, addresses);

    let color = COLOR_UNDEF;
    let fpr = [];

    if (dec) {
      this.decryptedData = dec.longmsg;
      color = dec.color;
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

          let wrapper = EnigmailMime.createBoundary();
          this.decryptedData = 'Content-Type: multipart/mixed; boundary="' + wrapper + '"\r\n' +
            'Content-Disposition: inline\r\n\r\n' +
            '--' + wrapper + '\r\n' +
            this.decryptedData + '\r\n' +
            '--' + wrapper + '--\r\n';
        }
      }

      if (!this.backgroundJob) {
        // only display the decrption/verification status if not background-Job
        this.displayStatus(color, fpr);
      }
    }

    gConv.setData(this.decryptedData, this.decryptedData.length);
    this.mimeSvc.onDataAvailable(null, null, gConv, 0, this.decryptedData.length);
    this.mimeSvc.onStopRequest(null, null, 0);
  },

  displayStatus: function(color, fpr) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: displayStatus\n");

    if (this.msgWindow === null || this.backgroundJob)
      return;

    let uriSpec = (this.uri ? this.uri.spec : null);

    try {
      EnigmailLog.DEBUG("pEpDecrypt.jsm: displayStatus for uri " + uriSpec + "\n");
      let headerSink = this.msgWindow.msgHeaderSink.securityInfo.QueryInterface(Ci.nsIEnigMimeHeaderSink);

      if (headerSink && this.uri) {

        headerSink.modifyMessageHeaders(this.uri, JSON.stringify(this.decryptedHeaders), this.mimePartNumber);
        headerSink.updateSecurityStatus(
          "",
          0,
          color,
          "enigmail:pEp",
          fpr.join(","),
          "",
          "",
          "",
          this.uri,
          "",
          "");
      }
    }
    catch (ex) {
      EnigmailLog.writeException("pEpDecrypt.jsm", ex);
    }
    EnigmailLog.DEBUG("pEpDecrypt.jsm: displayStatus done\n");
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
