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

function MimeVerify(verifyEmbedded, msgUrl)
{
  this.verifyEmbedded = verifyEmbedded;
  this.msgUrl = msgUrl;
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
    this.hash = "";
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

    if (!this.verifyEmbedded) this.startVerification();
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
      let  i = this.startMsgStr.search(/^content-type:/im);
      if (i >= 0) {
        let s = data.substr(i).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        if (s.search(/multipart\/signed/i) > 0 &&
          s.search(/micalg\s*=\s*[\"\']?pgp-[\"\']?/i) > 0 &&
          s.search(/protocol\s*=\s*[\'\"]application\/pgp-signature[\"\']/i) > 0) {

          DEBUG_LOG("mimeVerify.jsm: onTextData: found PGP/MIME signed message\n");
          this.foundMsg = true;
          let hdr = EnigmailFuncs.getHeaderData(s);
          hdr["boundary"] = hdr["boundary"] || "";
          hdr["micalg"] = hdr["micalg"] || "";
          this.boundary = hdr["boundary"].replace(/[\'\"]/g, "");
          this.hash = hdr["micalg"].replace(/[\'\"]/g, "").toUpperCase().replace(/^PGP-/, "");
        }
      }
    }
    this.dataCount += data.length;

    if (this.verifyEmbedded && this.foundMsg) {
      // process data as signed message
      if (! this.proc) {
        this.startVerification();
      }
    }

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

      if (! this.hash) this.hash = "SHA1";

      this.writeToPipe("-----BEGIN PGP SIGNED MESSAGE-----\n");
      this.writeToPipe("Hash: " + this.hash + "\n\n");
    }

    if (this.writeMode == 1) {
      // "real data"
      let i = this.findNextMimePart();
      if (i >= 0) {
        data = this.keepData.substr(0, i);
        this.keepData = this.keepData.substr(i);
        this.writeMode = 2;
      }
      else {
        data = this.keepData.substr(0, this.keepData.length - this.boundary.length - 3);
        this.keepData = this.keepData.substr(-this.boundary.length - 3);
      }
      this.writeToPipe(data.replace(/^-/gm, "- -"));
    }

    if (this.writeMode == 2) {
      // signature data "header"
      let i = this.keepData.search(/^-----BEGIN PGP /m);
      if (i>=0) {
        this.keepData = this.keepData.substr(i);
        this.writeMode = 3;
      }
    }

    if (this.writeMode == 3) {
      // signature data
      let i = this.keepData.search(/^-----END PGP /m);
      if (i >= 0) this.writeMode = 4;
      this.writeToPipe(this.keepData.substr(0, i + 30));
      this.keepData = "";
    }

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

  startVerification: function() {
    DEBUG_LOG("mimeVerify.jsm: startVerification\n");
      var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      var win = windowManager.getMostRecentWindow(null);
      var statusFlagsObj = {};
      var errorMsgObj = {};
      this.proc = Ec.decryptMessageStart(win, true, true, this,
                      statusFlagsObj, errorMsgObj);
  },

  onStopRequest: function() {
    DEBUG_LOG("mimeVerify.jsm: onStopRequest\n");
    this.flushInput();
    if (this.pipe) {
      this.pipe.close();
    }
    else
      this.closePipe = true;
  },

  writeToPipe: function(str) {
    //DEBUG_LOG("mimeVerify.jsm: writeToPipe: "+str+"\n");

    if (this.pipe) {
      this.outQueue += str;
      if (this.outQueue.length > maxBufferLen)
        this.flushInput();
    }
    else
      this.outQueue += str;
  },

  flushInput: function() {
    DEBUG_LOG("mimeVerify.jsm: flushInput\n");
    if (! this.pipe) return;
    this.pipe.write(this.outQueue);
    this.outQueue = "";
  },

  // API for decryptMessage Listener
  stdin: function(pipe) {
    DEBUG_LOG("mimeVerify.jsm: stdin\n");
    if (this.outQueue.length > 0) {
      pipe.write(this.outQueue);
      this.outQueue = "";
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
    this.displayStatus();

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

  newVerfier: function (embedded, msgUrl) {
    let v = new MimeVerify(embedded, msgUrl);
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
