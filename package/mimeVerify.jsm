/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/**
 *  Module for handling PGP/MIME signed messages
 *  implemented as JS module
 */


// TODO: Missing features
//   - don't attempt to validate forwarded messages unless message is being viewed

'use strict';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailVerify" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Ec = EnigmailCommon;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const maxBufferLen = 102400;

var gDebugLog = false;

function MimeVerify(verifyEmbedded, msgUrl, partiallySigned)
{
  this.verifyEmbedded = verifyEmbedded;
  this.msgUrl = msgUrl;
  this.partiallySigned = partiallySigned;
}


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

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  startStreaming: function(window, msgWindow, msgUriSpec) {
    DEBUG_LOG("mimeVerify.jsm: startStreaming\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
    this.window = window;
    var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
    var msgSvc = messenger.messageServiceFromURI(this.msgUriSpec);

    this.inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),

    msgSvc.streamMessage(this.msgUriSpec,
                    this,
                    this.msgWindow,
                    null,
                    false,
                    null,
                    false);
  },

  verifyData: function(window, msgWindow, msgUriSpec, data) {
    DEBUG_LOG("mimeVerify.jsm: streamFromChannel\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
    this.window = window;
    this.onStartRequest();
    this.onTextData(data);
    this.onStopRequest();
  },

  onStartRequest: function() {
    DEBUG_LOG("mimeVerify.jsm: onStartRequest\n");
    this.dataCount = 0;
    this.foundMsg = false;
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
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    DEBUG_LOG("mimeVerify.jsm: onDataAvailable: "+count+"\n");
    this.inStream.init(stream);
    var data = this.inStream.read(count);
    this.onTextData(data);
  },

  onTextData: function(data) {
    DEBUG_LOG("mimeVerify.jsm: onTextData\n");
    if (!this.foundMsg) {
      // check if mime part could be pgp/mime signed message
      if (this.dataCount > 10240) return;
      this.startMsgStr += data;

      var msgs = this.startMsgStr.split(/\n/);
      for(let i = 0; i < msgs.length; i++) {
        if(msgs[i].search(/^content-type:/i) >= 0) {
          // Join the rest of the content type lines together.
          // See RFC 2425, section 5.8.1
          let contentTypeLine = msgs[i];
          i++;
          while (i < msgs.length) {
            // Does the line start with a space or a tab, followed by something else?
            if(msgs[i].search(/^[ \t]+?/) == 0) {
              contentTypeLine += msgs[i];
              i++;
            }
            else {
              break;
            }
          }

          // Eat up CRLF's.
          contentTypeLine = contentTypeLine.replace(/[\r\n]/g, "");
          DEBUG_LOG("mimeVerify.jsm: onTextData: " + contentTypeLine + "\n");

          if (contentTypeLine.search(/multipart\/signed/i) > 0 &&
              contentTypeLine.search(/micalg\s*=\s*[\"\']?pgp-[\"\']?/i) > 0 &&
              contentTypeLine.search(/protocol\s*=\s*[\'\"]application\/pgp-signature[\"\']/i) > 0) {

            DEBUG_LOG("mimeVerify.jsm: onTextData: found PGP/MIME signed message\n");
            this.foundMsg = true;
            let hdr = EnigmailFuncs.getHeaderData(contentTypeLine);
            hdr["boundary"] = hdr["boundary"] || "";
            hdr["micalg"] = hdr["micalg"] || "";
            this.boundary = hdr["boundary"].replace(/[\'\"]/g, "");
          }

          // Break after finding the first Content-Type
          break;
        }
      }
    }
    this.dataCount += data.length;

    this.keepData += data;
    if (this.writeMode == 0) {
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
        if (this.keepData[i-2] == '\r' && this.keepData[i-1] == '\n') {
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
      if (this.keepData.indexOf("--"+this.boundary+"--") >= 0) {
        // ensure that we keep everything until we got the "end" boundary
        this.writeMode = 3;
      }

    }

    if (this.writeMode == 3) {
      // signature data
      let xferEnc = this.getContentTransferEncoding();
      if (xferEnc.search(/base64/i) >= 0) {
        let bound = this.getBodyPart();
        let b64 = this.keepData.substring(bound.start, bound.end).replace(/[\s\r\n]*/g, "");
        this.keepData = atob(b64)+"\n";
      }
      else if (xferEnc.search(/quoted-printable/i) >= 0) {
        let bound = this.getBodyPart();
        let qp = this.keepData.substring(bound.start, bound.end);
        this.keepData = EnigmailCommon.decodeQuotedPrintable(qp)+"\n";
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
    let end = this.keepData.indexOf("--"+this.boundary+"--") - 1;

    return {start: start, end: end};
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

    let i = this.keepData.indexOf("--"+this.boundary);
    if (i == 0) startOk = true;
    if (i > 0) {
      if (this.keepData[i-1] == '\r' || this.keepData[i-1] == '\n') startOk = true;
    }

    if (i + this.boundary.length + 2 < this.keepData) {
      if (this.keepData[i + this.boundary.length + 2] == '\r' ||
        this.keepData[i + this.boundary.length + 2] == '\n') endOk = true;
    }
    else
      endOk = true;

    if (i >= 0 && startOk && endOk) {
      return i;
    }
    return -1;
  },

  onStopRequest: function() {
    DEBUG_LOG("mimeVerify.jsm: onStopRequest\n");

    // don't try to verify if no message found
    if (this.verifyEmbedded && (!this.foundMsg)) return;


    var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
    var win = windowManager.getMostRecentWindow(null);

    // create temp file holding signature data
    this.sigFile = Ec.getTempDirObj();
    this.sigFile.append("data.sig");
    this.sigFile.createUnique(this.sigFile.NORMAL_FILE_TYPE, 0x180);
    EnigmailFuncs.writeFileContents(this.sigFile, this.sigData, 0x180);

    var statusFlagsObj = {};
    var errorMsgObj = {};

    this.proc = Ec.decryptMessageStart(win, true, true, this,
                statusFlagsObj, errorMsgObj,
                Ec.getEscapedFilename(Ec.getFilePath(this.sigFile)));

    if (this.pipe) {
      DEBUG_LOG("Closing pipe\n");
      this.pipe.close();
    }
    else
      this.closePipe = true;
  },

  appendQueue: function(str) {
    //DEBUG_LOG("mimeVerify.jsm: appendQueue: "+str+"\n");

    this.outQueue += str;
  },

  // API for decryptMessage Listener
  stdin: function(pipe) {
    DEBUG_LOG("mimeVerify.jsm: stdin\n");
    if (this.outQueue.length > 0) {
      DEBUG_LOG("mimeVerify.jsm:  writing " + this.outQueue.length + " bytes\n");

      // ensure all lines end with CRLF as specified in RFC 3156, section 5
      this.outQueue = this.outQueue.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");

      pipe.write(this.outQueue);
      if (this.closePipe) pipe.close();
    }
    this.pipe = pipe;
  },

  stdout: function(s) {
    DEBUG_LOG("mimeVerify.jsm: stdout:"+s.length+"\n");
    this.dataLength += s.length;
  },

  stderr: function(s) {
    DEBUG_LOG("mimeVerify.jsm: stderr\n");
    this.statusStr += s;
  },

  done: function(exitCode) {
    DEBUG_LOG("mimeVerify.jsm: done: "+exitCode+"\n");
    this.exitCode = exitCode;
    //DEBUG_LOG("mimeVerify.jsm: "+this.statusStr+"\n");

    this.returnStatus = {};
    Ec.decryptMessageEnd(this.statusStr,
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
    DEBUG_LOG("mimeVerify.jsm: setMsgWindow: "+msgUriSpec+"\n");

    if (! this.msgWindow) {
      this.msgWindow = msgWindow;
      this.msgUriSpec = msgUriSpec;
    }
  },

  displayStatus: function() {
    DEBUG_LOG("mimeVerify.jsm: displayStatus\n");
    if (this.exitCode == null || this.msgWindow == null || this.statusDisplayed)
      return;

    try {
      DEBUG_LOG("mimeVerify.jsm: displayStatus displaying result\n");
      let headerSink = this.msgWindow.msgHeaderSink.securityInfo.QueryInterface(Ci.nsIEnigMimeHeaderSink);

      if (headerSink) {
        headerSink.updateSecurityStatus(this.msgUriSpec,
            this.exitCode,
            this.returnStatus.statusFlags,
            this.returnStatus.keyId,
            this.returnStatus.userId,
            this.returnStatus.sigDetails,
            this.returnStatus.errorMsg,
            this.returnStatus.blockSeparation,
            null);
      }
      this.statusDisplayed = true;
    }
    catch(ex) {
      Ec.writeException("mimeVerify.jsm", ex);
    }
  }
};

var EnigmailVerify = {
  lastMsgWindow: null,
  lastMsgUri: null,

  setMsgWindow: function(msgWindow, msgUriSpec) {
    DEBUG_LOG("mimeVerify.jsm: setMsgWindow: "+msgUriSpec+"\n");

    this.lastMsgWindow = msgWindow;
    this.lastMsgUri = msgUriSpec;
  },

  newVerifier: function (embedded, msgUrl, partiallySigned) {
    let v = new MimeVerify(embedded, msgUrl, partiallySigned);
    return v;
  }
};


////////////////////////////////////////////////////////////////////
// General-purpose functions, not exported

function DEBUG_LOG(str) {
  if (gDebugLog) Ec.DEBUG_LOG(str);
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
    dump("caught error "+ex);
  }
}

initModule();
dump("mimeVerify.jsm: module initialized\n");
