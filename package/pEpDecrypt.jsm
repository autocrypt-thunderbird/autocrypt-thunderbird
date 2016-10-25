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

Cu.import("resource://enigmail/pEp.jsm"); /*global EnigmailpEp: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Cu.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */


var EXPORTED_SYMBOLS = ["EnigmailPEPDecrypt"];

var inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
var gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);

var EnigmailPEPDecrypt = {
  getDecryptionService: function(contentType) {
    return new PEPDecryptor(contentType);
  }
};

function PEPDecryptor(contentType) {
  this.contentType = contentType;
  this.sourceData = "";
}


PEPDecryptor.prototype = {

  onStartRequest: function(request, uri) {
    EnigmailLog.DEBUG("pEpDecrypt.jsm: onStartRequest\n");
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    if (count > 0) {
      inStream.init(stream);
      this.sourceData += inStream.read(count);
    }
  },

  onStopRequest: function() {
    // make the string a complete MIME message
    this.sourceData = "Content-Type: " + this.contentType + "\r\n\r\n" + this.sourceData;
    let resultObj = null;
    let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

    let s = this.sourceData.search(/^-----BEGIN PGP MESSAGE-----/m);
    let e = this.sourceData.search(/^-----END PGP MESSAGE-----/m);
    let pgpData = this.sourceData.substring(s, e + 27);

    EnigmailpEp.decryptMessage(pgpData, "*").then(function _step2(res) {
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

    // resultObj:
    // 0: ??
    // 1: color
    // 2: key ID
    // 3: messageObj
    // 4: status

    let out = EnigmailLocale.getString("pEpDecrypt.cannotDecrypt");

    if (resultObj && resultObj[4].status === 0) {
      out = resultObj[3].longmsg;

      let i = out.search(/\n\r?\n/);
      if (i > 0) {
        let hdr = out.substr(0, i);
        if (hdr.search(/^content-type:\s+text\/(plain|html)/im) >= 0) {
          EnigmailLog.DEBUG("mimeDecrypt.jsm: done: adding multipart/mixed around '" + hdr + "'\n");

          let wrapper = EnigmailMime.createBoundary();
          out = 'Content-Type: multipart/mixed; boundary="' + wrapper + '"\r\n' +
            'Content-Disposition: inline\r\n\r\n' +
            '--' + wrapper + '\r\n' +
            out + '\r\n' +
            '--' + wrapper + '--\r\n';
        }
      }
    }

    gConv.setData(out, out.length);
    this.mimeSvc.onDataAvailable(null, null, gConv, 0, out.length);
    this.mimeSvc.onStopRequest(null, null, 0);
  }
};
