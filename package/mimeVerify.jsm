/*global Components: false, dump: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailVerify"];

/**
 *  Module for handling PGP/MIME signed messages
 *  implemented as JS module
 */

// TODO: Missing features
//   - don't attempt to validate forwarded messages unless message is being viewed

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Components.utils.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Components.utils.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */
Components.utils.import("resource://enigmail/decryption.jsm"); /*global EnigmailDecryption: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const maxBufferLen = 102400;

var gDebugLog = false;
var gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);

// MimeVerify Constructor
function MimeVerify() {
  this.verifyEmbedded = false;
  this.partiallySigned = false;
  this.inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
}


const EnigmailVerify = {
  lastMsgWindow: null,
  lastMsgUri: null,
  manualMsgUri: null,

  currentCtHandler: EnigmailConstants.MIME_HANDLER_UNDEF,

  setMsgWindow: function(msgWindow, msgUriSpec) {
    LOCAL_DEBUG("mimeVerify.jsm: setMsgWindow: " + msgUriSpec + "\n");

    this.lastMsgWindow = msgWindow;
    this.lastMsgUri = msgUriSpec;
  },

  newVerifier: function() {
    let v = new MimeVerify();
    return v;
  },

  setManualUri: function(msgUriSpec) {
    LOCAL_DEBUG("mimeVerify.jsm: setManualUri: " + msgUriSpec + "\n");
    this.manualMsgUri = msgUriSpec;
  },

  getManualUri: function() {
    return this.manualMsgUri;
  },

  /***
   * register a PGP/MIME verify object the same way PGP/MIME encrypted mail is handled
   */
  registerContentTypeHandler: function() {
    let reg = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

    let pgpMimeClass = Components.classes["@mozilla.org/mimecth;1?type=multipart/encrypted"];

    reg.registerFactory(
      pgpMimeClass,
      "Enigmail PGP/MIME verification",
      "@mozilla.org/mimecth;1?type=multipart/signed",
      null);
    this.currentCtHandler = EnigmailConstants.MIME_HANDLER_PGPMIME;
  },

  unregisterContentTypeHandler: function() {
    let reg = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

    let sMimeClass = Components.classes["@mozilla.org/nsCMSDecoder;1"];
    reg.registerFactory(sMimeClass, "S/MIME verification", "@mozilla.org/mimecth;1?type=multipart/signed", null);
    this.currentCtHandler = EnigmailConstants.MIME_HANDLER_SMIME;
  }

};


// MimeVerify implementation
// verify the signature of PGP/MIME signed messages
MimeVerify.prototype = {
  dataCount: 0,
  foundMsg: false,
  startMsgStr: "",
  msgWindow: null,
  msgUriSpec: null,
  statusDisplayed: false,
  exitCode: null,
  window: null,
  inStream: null,
  sigFile: null,
  sigData: "",
  mimePartNumber: "",

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  startStreaming: function(window, msgWindow, msgUriSpec) {
    LOCAL_DEBUG("mimeVerify.jsm: startStreaming\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
    this.window = window;
    var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
    var msgSvc = messenger.messageServiceFromURI(this.msgUriSpec);

    msgSvc.streamMessage(this.msgUriSpec,
      this,
      this.msgWindow,
      null,
      false,
      null,
      false);
  },

  verifyData: function(window, msgWindow, msgUriSpec, data) {
    LOCAL_DEBUG("mimeVerify.jsm: streamFromChannel\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
    this.window = window;
    this.onStartRequest();
    this.onTextData(data);
    this.onStopRequest();
  },

  parseContentType: function() {
    let contentTypeLine = this.mimeSvc.contentType;

    // Eat up CRLF's.
    contentTypeLine = contentTypeLine.replace(/[\r\n]/g, "");
    LOCAL_DEBUG("mimeVerify.jsm: parseContentType: " + contentTypeLine + "\n");

    if (contentTypeLine.search(/multipart\/signed/i) >= 0 &&
      contentTypeLine.search(/micalg\s*=\s*[\"\']?pgp-[\"\']?/i) > 0 &&
      contentTypeLine.search(/protocol\s*=\s*[\'\"]application\/pgp-signature[\"\']/i) > 0) {

      LOCAL_DEBUG("mimeVerify.jsm: parseContentType: found PGP/MIME signed message\n");
      this.foundMsg = true;
      let hdr = EnigmailFuncs.getHeaderData(contentTypeLine);
      hdr.boundary = hdr.boundary || "";
      hdr.micalg = hdr.micalg || "";
      this.boundary = hdr.boundary.replace(/[\'\"]/g, "");
    }

  },

  onStartRequest: function(request, uri) {
    EnigmailLog.DEBUG("mimeVerify.jsm: onStartRequest\n"); // always log this one

    this.uri = uri ? uri.QueryInterface(Ci.nsIURI).clone() : null;
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    if ("mimePart" in this.mimeSvc) {
      this.mimePartNumber = this.mimeSvc;
    }
    else {
      this.mimePartNumber = "";
    }

    this.dataCount = 0;
    this.foundMsg = false;
    this.backgroundJob = false;
    this.startMsgStr = "";
    this.boundary = "";
    this.proc = null;
    this.closePipe = false;
    this.pipe = null;
    this.writeMode = 0;
    this.keepData = "";
    this.outQueue = "";
    this.statusStr = "";
    this.returnStatus = null;
    this.statusDisplayed = false;
    this.protectedHeaders = null;
    this.parseContentType();
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    LOCAL_DEBUG("mimeVerify.jsm: onDataAvailable: " + count + "\n");
    if (count > 0) {
      this.inStream.init(stream);
      var data = this.inStream.read(count);
      this.onTextData(data);
    }
  },

  onTextData: function(data) {
    LOCAL_DEBUG("mimeVerify.jsm: onTextData\n");

    this.dataCount += data.length;

    this.keepData += data;
    if (this.writeMode === 0) {
      // header data
      let i = this.findNextMimePart();
      if (i >= 0) {
        i += 2 + this.boundary.length;
        if (this.keepData[i] == "\n") {
          ++i;
        }
        else if (this.keepData[i] == "\r") {
          ++i;
          if (this.keepData[i] == "\n") ++i;
        }

        this.keepData = this.keepData.substr(i);
        data = this.keepData;
        this.writeMode = 1;
      }
      else {
        this.keepData = data.substr(-this.boundary.length - 3);
      }
    }

    if (this.writeMode == 1) {
      // "real data"
      let i = this.findNextMimePart();
      if (i >= 0) {
        if (this.keepData[i - 2] == '\r' && this.keepData[i - 1] == '\n') {
          --i;
        }
        data = this.keepData.substr(0, i - 1);

        this.keepData = this.keepData.substr(i);
        this.writeMode = 2;
      }
      else {
        data = this.keepData.substr(0, this.keepData.length - this.boundary.length - 3);
        this.keepData = this.keepData.substr(-this.boundary.length - 3);
      }
      this.appendQueue(data);
    }

    if (this.writeMode == 2) {
      let i = this.keepData.indexOf("--" + this.boundary + "--");
      if (i >= 0) {
        // ensure that we keep everything until we got the "end" boundary
        if (this.keepData[i - 2] == '\r' && this.keepData[i - 1] == '\n') {
          --i;
        }
        this.keepData = this.keepData.substr(0, i - 1);
        this.writeMode = 3;
      }
    }

    if (this.writeMode == 3) {
      // signature data
      let xferEnc = this.getContentTransferEncoding();
      if (xferEnc.search(/base64/i) >= 0) {
        let bound = this.getBodyPart();
        this.keepData = EnigmailData.decodeBase64(this.keepData.substring(bound.start, bound.end)) + "\n";
      }
      else if (xferEnc.search(/quoted-printable/i) >= 0) {
        let bound = this.getBodyPart();
        let qp = this.keepData.substring(bound.start, bound.end);
        this.keepData = EnigmailData.decodeQuotedPrintable(qp) + "\n";
      }


      // extract signature data
      let s = Math.max(this.keepData.search(/^-----BEGIN PGP /m), 0);
      let e = Math.max(this.keepData.search(/^-----END PGP /m), this.keepData.length - 30);
      this.sigData = this.keepData.substring(s, e + 30);
      this.keepData = "";
      this.writeMode = 4; // ignore any further data
    }

  },

  getBodyPart: function() {
    let start = this.keepData.search(/(\n\n|\r\n\r\n)/);
    if (start < 0) {
      start = 0;
    }
    let end = this.keepData.indexOf("--" + this.boundary + "--") - 1;

    return {
      start: start,
      end: end
    };
  },

  // determine content-transfer encoding of mime part, assuming that whole
  // message is in this.keepData
  getContentTransferEncoding: function() {
    let enc = "7bit";
    let m = this.keepData.match(/^(content-transfer-encoding:)(.*)$/mi);
    if (m && m.length > 2) {
      enc = m[2].trim().toLowerCase();
    }

    return enc;
  },


  findNextMimePart: function() {
    let startOk = false;
    let endOk = false;

    let i = this.keepData.indexOf("--" + this.boundary);
    if (i === 0) startOk = true;
    if (i > 0) {
      if (this.keepData[i - 1] == '\r' || this.keepData[i - 1] == '\n') startOk = true;
    }

    if (!startOk) return -1;

    if (i + this.boundary.length + 2 < this.keepData.length) {
      if (this.keepData[i + this.boundary.length + 2] == '\r' ||
        this.keepData[i + this.boundary.length + 2] == '\n' ||
        this.keepData.substr(i + this.boundary.length + 2, 2) == '--') endOk = true;
    }
    // else
    // endOk = true;

    if (i >= 0 && startOk && endOk) {
      return i;
    }
    return -1;
  },

  onStopRequest: function() {
    LOCAL_DEBUG("mimeVerify.jsm: onStopRequest\n");

    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    let url = {};

    this.backgroundJob = false;

    // don't try to verify if no message found
    // if (this.verifyEmbedded && (!this.foundMsg)) return; // TODO - check

    this.protectedHeaders = EnigmailMime.extractProtectedHeaders(this.outQueue);

    if (this.protectedHeaders && this.protectedHeaders.startPos >= 0 && this.protectedHeaders > this.protectedHeaders.startPos) {
      let r = this.outQueue.substr(0, this.protectedHeaders.startPos) + this.outQueue.substr(this.protectedHeaders.endPos);
      this.returnData(r);
    }
    else {
      this.returnData(this.outQueue);
    }

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


          if ((!this.backgroundJob) && currUrlSpec != manUrlSpec) {
            return; // this.handleManualDecrypt();
          }
        }

        if (this.msgUriSpec) {
          let msgSvc = messenger.messageServiceFromURI(this.msgUriSpec);

          msgSvc.GetUrlForUri(this.msgUriSpec, url, null);
        }

        if (this.uri.spec.search(/[\&\?]header=[a-zA-Z0-9]*$/) < 0 &&
          this.uri.spec.search(/[\&\?]part=[\.0-9]+/) < 0 &&
          this.uri.spec.search(/[\&\?]examineEncryptedParts=true/) < 0) {

          if (this.uri.spec.search(/[\&\?]header=filter\&.*$/) > 0)
            return;

          if (this.uri && url && url.value) {

            if (url.value.spec != this.uri.spec)
              return;
          }
        }
      }
      catch (ex) {
        EnigmailLog.writeException("mimeDecrypt.js", ex);
        EnigmailLog.DEBUG("mimeDecrypt.js: error while processing " + this.msgUriSpec + "\n");
      }
    }

    var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
    var win = windowManager.getMostRecentWindow(null);

    // create temp file holding signature data
    this.sigFile = EnigmailFiles.getTempDirObj();
    this.sigFile.append("data.sig");
    this.sigFile.createUnique(this.sigFile.NORMAL_FILE_TYPE, 0x180);
    EnigmailFiles.writeFileContents(this.sigFile, this.sigData, 0x180);

    var statusFlagsObj = {};
    var errorMsgObj = {};

    this.proc = EnigmailDecryption.decryptMessageStart(win, true, true, this,
      statusFlagsObj, errorMsgObj,
      EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePath(this.sigFile)));

    if (this.pipe) {
      EnigmailLog.DEBUG("Closing pipe\n"); // always log this one
      this.pipe.close();
    }
    else
      this.closePipe = true;
  },

  // return data to libMime
  returnData: function(data) {

    let m = data.match(/^(content-type: +)([\w\/]+)/im);
    if (m && m.length >= 3) {
      let contentType = m[2];
      if (contentType.search(/^text/i) === 0) {
        // add multipart/mixed boundary to work around TB bug (empty forwarded message)
        let bound = EnigmailMime.createBoundary();
        data = 'Content-Type: multipart/mixed; boundary="' + bound + '"\n\n--' +
          bound + '\n' +
          data +
          '\n--' + bound + '--\n';
      }
    }

    gConv.setData(data, data.length);
    try {
      this.mimeSvc.onStartRequest(null, null);
      this.mimeSvc.onDataAvailable(null, null, gConv, 0, data.length);
      this.mimeSvc.onStopRequest(null, null, 0);
    }
    catch (ex) {
      EnigmailLog.ERROR("mimeDecrypt.js: returnData(): mimeSvc.onDataAvailable failed:\n" + ex.toString());
    }
  },

  appendQueue: function(str) {
    //LOCAL_DEBUG("mimeVerify.jsm: appendQueue: "+str+"\n");

    this.outQueue += str;
  },

  // API for decryptMessage Listener
  stdin: function(pipe) {
    LOCAL_DEBUG("mimeVerify.jsm: stdin\n");
    if (this.outQueue.length > 0) {
      LOCAL_DEBUG("mimeVerify.jsm:  writing " + this.outQueue.length + " bytes\n");

      // ensure all lines end with CRLF as specified in RFC 3156, section 5
      this.outQueue = this.outQueue.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");

      pipe.write(this.outQueue);
      if (this.closePipe) pipe.close();
    }
    this.pipe = pipe;
  },

  stdout: function(s) {
    LOCAL_DEBUG("mimeVerify.jsm: stdout:" + s.length + "\n");
    this.dataLength += s.length;
  },

  stderr: function(s) {
    LOCAL_DEBUG("mimeVerify.jsm: stderr\n");
    this.statusStr += s;
  },

  done: function(exitCode) {
    LOCAL_DEBUG("mimeVerify.jsm: done: " + exitCode + "\n");
    this.exitCode = exitCode;
    //LOCAL_DEBUG("mimeVerify.jsm: "+this.statusStr+"\n");

    this.returnStatus = {};
    EnigmailDecryption.decryptMessageEnd(this.statusStr,
      this.exitCode,
      this.dataLength,
      true, // verifyOnly
      true,
      Ci.nsIEnigmail.UI_PGP_MIME,
      this.returnStatus);

    if (this.partiallySigned)
      this.returnStatus.statusFlags |= Ci.nsIEnigmail.PARTIALLY_PGP;

    this.displayStatus();

    if (this.sigFile) this.sigFile.remove(false);
  },

  setMsgWindow: function(msgWindow, msgUriSpec) {
    EnigmailLog.DEBUG("mimeVerify.jsm: setMsgWindow: " + msgUriSpec + "\n");

    if (!this.msgWindow) {
      this.msgWindow = msgWindow;
      this.msgUriSpec = msgUriSpec;
    }
  },

  displayStatus: function() {
    EnigmailLog.DEBUG("mimeVerify.jsm: displayStatus\n");
    if (this.exitCode === null || this.msgWindow === null || this.statusDisplayed || this.backgroundJob)
      return;

    try {
      LOCAL_DEBUG("mimeVerify.jsm: displayStatus displaying result\n");
      let headerSink = this.msgWindow.msgHeaderSink.securityInfo.QueryInterface(Ci.nsIEnigMimeHeaderSink);

      if (this.protectedHeaders) {
        headerSink.modifyMessageHeaders(this.uri, JSON.stringify(this.protectedHeaders.newHeaders));
      }

      if (headerSink) {
        headerSink.updateSecurityStatus(this.lastMsgUri,
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
      EnigmailLog.writeException("mimeVerify.jsm", ex);
    }
  }
};


////////////////////////////////////////////////////////////////////
// General-purpose functions, not exported

function LOCAL_DEBUG(str) {
  if (gDebugLog) EnigmailLog.DEBUG(str);
}

function initModule() {
  try {
    var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    var nspr_log_modules = env.get("NSPR_LOG_MODULES");
    var matches = nspr_log_modules.match(/mimeVerify:(\d+)/);

    if (matches && (matches.length > 1)) {
      if (matches[1] > 2) gDebugLog = true;
      dump("mimeVerify.jsm: enabled debug logging\n");
    }
  }
  catch (ex) {
    dump("caught error " + ex);
  }
}

initModule();
dump("mimeVerify.jsm: module initialized\n");
