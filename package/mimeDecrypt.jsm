/*global Components: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailMimeDecrypt"];

/**
 *  Module for handling PGP/MIME encrypted messages
 *  implemented as an XPCOM object
 */

Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/mimeVerify.jsm"); /*global EnigmailVerify: false */
Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Components.utils.import("resource://enigmail/decryption.jsm"); /*global EnigmailDecryption: false */
Components.utils.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const PGPMIME_JS_DECRYPTOR_CONTRACTID = "@mozilla.org/mime/pgp-mime-js-decrypt;1";
const PGPMIME_JS_DECRYPTOR_CID = Components.ID("{7514cbeb-2bfd-4b2c-829b-1a4691fa0ac8}");

const ENCODING_DEFAULT = 0;
const ENCODING_BASE64 = 1;
const ENCODING_QP = 2;

const maxBufferLen = 102400;

var gDebugLogLevel = 0;

var gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
var gNumProc = 0;

////////////////////////////////////////////////////////////////////
// handler for PGP/MIME encrypted messages
// data is processed from libmime -> nsPgpMimeProxy

function EnigmailMimeDecrypt() {

  EnigmailLog.DEBUG("mimeDecrypt.jsm: EnigmailMimeDecrypt()\n"); // always log this one
  this.mimeSvc = null;
  this.initOk = false;
  this.boundary = "";
  this.pipe = null;
  this.closePipe = false;
  this.statusStr = "";
  this.outQueue = "";
  this.dataLength = 0;
  this.mimePartCount = 0;
  this.headerMode = 0;
  this.xferEncoding = ENCODING_DEFAULT;
  this.matchedPgpDelimiter = 0;
  this.exitCode = null;
  this.msgWindow = null;
  this.msgUriSpec = null;
  this.returnStatus = null;
  this.proc = null;
  this.statusDisplayed = false;
  this.uri = null;
  this.backgroundJob = false;
  this.decryptedHeaders = {};
  this.mimePartNumber = "";
}

EnigmailMimeDecrypt.prototype = {
  inStream: Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),

  onStartRequest: function(request, uri) {
    if (!EnigmailCore.getService()) // Ensure Enigmail is initialized
      return;
    EnigmailLog.DEBUG("mimeDecrypt.jsm: onStartRequest\n"); // always log this one

    ++gNumProc;
    if (gNumProc > 2) {
      EnigmailLog.DEBUG("mimeDecrypt.jsm: number of parallel requests above threshold - ignoring requst\n");
      return;
    }

    this.initOk = true;
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    if ("mimePart" in this.mimeSvc) {
      this.mimePartNumber = this.mimeSvc.mimePart;
    }
    else {
      this.mimePartNumber = "";
    }
    this.pipe = null;
    this.closePipe = false;
    this.exitCode = null;
    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    this.statusDisplayed = false;
    this.returnStatus = null;
    this.dataLength = 0;
    this.decryptedData = "";
    this.mimePartCount = 0;
    this.matchedPgpDelimiter = 0;
    this.outQueue = "";
    this.statusStr = "";
    this.headerMode = 0;
    this.decryptedHeaders = {};
    this.xferEncoding = ENCODING_DEFAULT;
    this.boundary = EnigmailMime.getBoundary(this.mimeSvc.contentType);
    if (uri) {
      this.uri = uri.QueryInterface(Ci.nsIURI).clone();
      EnigmailLog.DEBUG("mimeDecrypt.jsm: onStartRequest: uri='" + this.uri.spec + "'\n");
    }
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    // get data from libmime
    if (!this.initOk) return;
    this.inStream.init(stream);

    if (count > 0) {
      var data = this.inStream.read(count);
      // detect MIME part boundary
      if (data.indexOf(this.boundary) >= 0) {
        LOCAL_DEBUG("mimeDecrypt.jsm: onDataAvailable: found boundary\n");
        ++this.mimePartCount;
        this.headerMode = 1;
        return;
      }

      // found PGP/MIME "body"
      if (this.mimePartCount == 2) {

        if (this.headerMode == 1) {
          // we are in PGP/MIME main part headers
          if (data.search(/\r|\n/) === 0) {
            // end of Mime-part headers reached
            this.headerMode = 2;
            return;
          }
          else {
            if (data.search(/^content-transfer-encoding:\s*/i) >= 0) {
              // extract content-transfer-encoding
              data = data.replace(/^content-transfer-encoding:\s*/i, "");
              data = data.replace(/;.*/, "").toLowerCase().trim();
              if (data.search(/base64/i) >= 0) {
                this.xferEncoding = ENCODING_BASE64;
              }
              else if (data.search(/quoted-printable/i) >= 0) {
                this.xferEncoding = ENCODING_QP;
              }

            }
          }
        }
        else {
          // PGP/MIME main part body
          if (this.xferEncoding == ENCODING_QP) {
            this.cacheData(EnigmailData.decodeQuotedPrintable(data));
          }
          else {
            this.cacheData(data);
          }
        }

      }
    }
  },

  // cache encrypted data for writing to subprocess
  cacheData: function(str) {
    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeDecrypt.jsm: cacheData: " + str.length + "\n");

    this.outQueue += str;
  },

  flushInput: function() {
    LOCAL_DEBUG("mimeDecrypt.jsm: flushInput: " + this.outQueue.length + " bytes\n");
    if (!this.pipe) {
      LOCAL_DEBUG("mimeDecrypt.jsm: flushInput: no pipe\n");
      return;
    }

    this.pipe.write(this.outQueue);
    this.outQueue = "";
  },

  onStopRequest: function(request, win, status) {
    LOCAL_DEBUG("mimeDecrypt.jsm: onStopRequest\n");
    --gNumProc;
    if (!this.initOk) return;

    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    let url = {};

    this.backgroundJob = false;

    if (this.uri) {
      // return if not decrypting currently displayed message (except if
      // printing, replying, etc)

      this.backgroundJob = (this.uri.spec.search(/[\&\?]header=(print|quotebody|enigmailConvert)/) >= 0);

      try {
        var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);

        if (!EnigmailPrefs.getPref("autoDecrypt")) {
          // "decrypt manually" mode
          let manUrl = {};

          if (EnigmailVerify.getManualUri()) {
            let msgSvc = messenger.messageServiceFromURI(EnigmailVerify.getManualUri());

            msgSvc.GetUrlForUri(EnigmailVerify.getManualUri(), manUrl, null);
          }
          else {
            manUrl.value = {
              spec: "enigmail://invalid/message"
            };
          }

          // print a message if not message explicitly decrypted
          let currUrlSpec = this.uri.spec.replace(/(\?.*)(number=[0-9]*)(&.*)?$/, "?$2");
          let manUrlSpec = manUrl.value.spec.replace(/(\?.*)(number=[0-9]*)(&.*)?$/, "?$2");


          if ((!this.backgroundJob) && currUrlSpec.indexOf(manUrlSpec) !== 0) {
            this.handleManualDecrypt();
            return;
          }
        }

        if (this.msgUriSpec) {
          let msgSvc = messenger.messageServiceFromURI(this.msgUriSpec);

          msgSvc.GetUrlForUri(this.msgUriSpec, url, null);
        }

        if (this.uri.spec.search(/[&\?]header=[^&]+/) > 0 &&
          this.uri.spec.search(/[&\?]examineEncryptedParts=true/) < 0) {

          if (this.uri.spec.search(/[&\?]header=filter(&.*)?$/) > 0) {
            EnigmailLog.DEBUG("mimeDecrypt.jsm: onStopRequest: detected incoming message processing\n");
            return;
          }
        }

        if (this.uri.spec.search(/[&\?]header=[^&]+/) < 0 &&
          this.uri.spec.search(/[&\?]part=[\.0-9]+/) < 0 &&
          this.uri.spec.search(/[&\?]examineEncryptedParts=true/) < 0) {

          if (this.uri && url && url.value) {

            if (url.value.spec != this.uri.spec)
              return;
          }
        }
      }
      catch (ex) {
        EnigmailLog.writeException("mimeDecrypt.js", ex);
        EnigmailLog.DEBUG("mimeDecrypt.jsm: error while processing " + this.msgUriSpec + "\n");
      }
    }


    if (this.xferEncoding == ENCODING_BASE64) {
      this.outQueue = EnigmailData.decodeBase64(this.outQueue) + "\n";
    }

    var statusFlagsObj = {};
    var errorMsgObj = {};
    var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
    win = windowManager.getMostRecentWindow(null);

    var maxOutput = this.outQueue.length * 100; // limit output to 100 times message size
    // to avoid DoS attack
    this.proc = EnigmailDecryption.decryptMessageStart(win, false, false, this,
      statusFlagsObj, errorMsgObj, null, maxOutput);

    if (!this.proc) return;
    this.flushInput();

    if (!this.pipe) {
      this.closePipe = true;
    }
    else
      this.pipe.close();

    this.proc.wait();

    this.returnStatus = {};
    EnigmailDecryption.decryptMessageEnd(this.statusStr,
      this.exitCode,
      this.dataLength,
      false,
      false,
      Ci.nsIEnigmail.UI_PGP_MIME,
      this.returnStatus);

    this.displayStatus();

    EnigmailLog.DEBUG("mimeDecrypt.jsm: onStopRequest: process terminated\n"); // always log this one
    this.proc = null;
  },

  displayStatus: function() {
    EnigmailLog.DEBUG("mimeDecrypt.jsm: displayStatus\n");

    if (this.exitCode === null || this.msgWindow === null || this.statusDisplayed)
      return;

    let uriSpec = (this.uri ? this.uri.spec : null);

    try {
      EnigmailLog.DEBUG("mimeDecrypt.jsm: displayStatus for uri " + uriSpec + "\n");
      let headerSink = this.msgWindow.msgHeaderSink.securityInfo.QueryInterface(Ci.nsIEnigMimeHeaderSink);

      if (headerSink && this.uri && !this.backgroundJob) {

        headerSink.modifyMessageHeaders(this.uri, JSON.stringify(this.decryptedHeaders), this.mimePartNumber);

        headerSink.updateSecurityStatus(
          this.msgUriSpec,
          this.exitCode,
          this.returnStatus.statusFlags,
          this.returnStatus.keyId,
          this.returnStatus.userId,
          this.returnStatus.sigDetails,
          this.returnStatus.errorMsg,
          this.returnStatus.blockSeparation,
          this.uri,
          this.returnStatus.encToDetails,
          this.mimePartNumber);
      }
      this.statusDisplayed = true;
    }
    catch (ex) {
      EnigmailLog.writeException("mimeDecrypt.jsm", ex);
    }
    LOCAL_DEBUG("mimeDecrypt.jsm: displayStatus done\n");
  },

  // API for decryptMessage Listener
  stdin: function(pipe) {
    LOCAL_DEBUG("mimeDecrypt.jsm: stdin\n");
    if (this.outQueue.length > 0) {
      pipe.write(this.outQueue);
      this.outQueue = "";
      if (this.closePipe) pipe.close();
    }
    this.pipe = pipe;
  },

  stdout: function(s) {
    // write data back to libmime
    //LOCAL_DEBUG("mimeDecrypt.jsm: stdout:"+s.length+"\n");
    this.dataLength += s.length;
    this.decryptedData += s;
  },

  stderr: function(s) {
    LOCAL_DEBUG("mimeDecrypt.jsm: stderr\n");
    this.statusStr += s;
  },

  done: function(exitCode) {
    LOCAL_DEBUG("mimeDecrypt.jsm: done: " + exitCode + "\n");

    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeDecrypt.jsm: done: decrypted data='" + this.decryptedData + "'\n");

    // ensure newline at the end of the stream
    if (!this.decryptedData.endsWith("\n")) {
      this.decryptedData += "\r\n";
    }

    var verifyData = this.decryptedData;

    try {
      this.extractEncryptedHeaders();
    }
    catch (ex) {}

    var i = this.decryptedData.search(/\n\r?\n/);
    if (i > 0) {
      var hdr = this.decryptedData.substr(0, i).split(/\r?\n/);
      var j;
      for (j in hdr) {
        if (hdr[j].search(/^\s*content-type:\s+text\/(plain|html)/i) >= 0) {
          LOCAL_DEBUG("mimeDecrypt.jsm: done: adding multipart/mixed around " + hdr[j] + "\n");

          let wrapper = EnigmailMime.createBoundary();
          this.decryptedData = 'Content-Type: multipart/mixed; boundary="' + wrapper + '"\r\n\r\n' +
            '--' + wrapper + '\r\n' +
            this.decryptedData + //'\r\n' +
            '--' + wrapper + '--\r\n';
          break;
        }
      }
    }

    this.returnData(this.decryptedData);

    this.decryptedData = "";
    this.exitCode = exitCode;
  },

  // return data to libMime
  returnData: function(data) {

    gConv.setData(data, data.length);
    try {
      this.mimeSvc.onStartRequest(null, null);
      this.mimeSvc.onDataAvailable(null, null, gConv, 0, data.length);
      this.mimeSvc.onStopRequest(null, null, 0);
    }
    catch (ex) {
      // EnigmailLog.ERROR("mimeDecrypt.jsm: returnData(): mimeSvc.onDataAvailable failed:\n" + ex.toString());
    }
  },

  handleManualDecrypt: function() {

    try {
      let headerSink = this.msgWindow.msgHeaderSink.securityInfo.QueryInterface(Ci.nsIEnigMimeHeaderSink);

      if (headerSink && this.uri && !this.backgroundJob) {
        headerSink.updateSecurityStatus(
          this.msgUriSpec,
          EnigmailConstants.POSSIBLE_PGPMIME,
          0,
          "",
          "",
          "",
          EnigmailLocale.getString("possiblyPgpMime"),
          "",
          this.uri,
          null,
          "");
      }
    }
    catch (ex) {}

    return 0;
  },


  extractEncryptedHeaders: function() {

    let r = EnigmailMime.extractProtectedHeaders(this.decryptedData);
    if (!r) return;

    this.decryptedHeaders = r.newHeaders;
    if (r.startPos >= 0 && r.endPos > r.startPos) {
      this.decryptedData = this.decryptedData.substr(0, r.startPos) + this.decryptedData.substr(r.endPos);
    }

  }
};


////////////////////////////////////////////////////////////////////
// General-purpose functions, not exported

function LOCAL_DEBUG(str) {
  if (gDebugLogLevel) EnigmailLog.DEBUG(str);
}

function initModule() {
  var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
  var nspr_log_modules = env.get("NSPR_LOG_MODULES");
  var matches = nspr_log_modules.match(/mimeDecrypt:(\d+)/);

  if (matches && (matches.length > 1)) {
    gDebugLogLevel = matches[1];
  }
}
