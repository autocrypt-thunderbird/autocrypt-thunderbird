/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailDecrypt" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Ec = EnigmailCommon;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

var gDebugLog = false;

var gConv = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                        .getService(Ci.nsIScriptableUnicodeConverter);
gConv.charset = "utf-8";


function EnigmailVerify(verifyEmbedded, msgUrl)
{
  this.verifyEmbedded = verifyEmbedded;
  this.msgUrl = msgUrl;
}


// verify the signature of PGP/MIME signed messages
EnigmailVerify.prototype = {
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
    DEBUG_LOG("mimeDecrypt.jsm: v-startStreaming\n");

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
    DEBUG_LOG("mimeDecrypt.jsm: v-streamFromChannel\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
    this.window = window;
    this.onStartRequest();
    this.onTextData(data);
    this.onStopRequest();
  },

  onStartRequest: function() {
    DEBUG_LOG("mimeDecrypt.jsm: v-onStartRequest\n");
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
    DEBUG_LOG("mimeDecrypt.jsm: v-onDataAvailable: "+count+"\n");
    this.inStream.init(stream);
    var data = this.inStream.read(count);
    this.onTextData(data);
  },

  onTextData: function(data) {
    DEBUG_LOG("mimeDecrypt.jsm: v-onTextData\n");
    if (!this.foundMsg) {
      // check if mime part could be pgp/mime signed message
      if (this.dataCount > 10240) return;
      this.startMsgStr += data;
      let  i = this.startMsgStr.search(/^content-type:/im);
      if (i >= 0) {
        let s = data.substr(i).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        if (s.search(/multipart\/signed/i) > 0 &&
          s.search(/micalg\s*=\s*pgp-/i) > 0 &&
          s.search(/protocol\s*=\s*[\'\"]application\/pgp-signature[\"\']/i) > 0) {

          DEBUG_LOG("mimeDecrypt.jsm: v-onTextData: found PGP/MIME signed message\n");
          this.foundMsg = true;
          let hdr = getHeaderData(s);
          this.boundary = hdr["boundary"].replace(/[\'\"]/g, "");
          this.hash = hdr["micalg"].replace(/^pgp-/, "").toUpperCase();
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
      let i = this.keepData.search(RegExp("^--"+this.boundary+"$", "m"));
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
      let i = this.keepData.search(RegExp("^--"+this.boundary+"$", "m"));
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

  startVerification: function() {
    DEBUG_LOG("mimeDecrypt.jsm: v-startVerification\n");
      var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      var win = windowManager.getMostRecentWindow(null);
      var statusFlagsObj = {};
      var errorMsgObj = {};
      this.proc = Ec.decryptMessageStart(win, true, this,
                      statusFlagsObj, errorMsgObj);
  },

  onStopRequest: function() {
    DEBUG_LOG("mimeDecrypt.jsm: v-onStopRequest\n");
    this.flushInput();
    if (this.pipe) {
      this.pipe.close()
    }
    else
      this.closePipe = true;
  },

  writeToPipe: function(str) {
    //DEBUG_LOG("mimeDecrypt.jsm: v-writeToPipe: "+str+"\n");

    if (this.pipe) {
      this.outQueue += str;
      if (this.outQueue.length > 920)
        this.flushInput();
    }
    else
      this.outQueue += str;
  },

  flushInput: function() {
    DEBUG_LOG("mimeDecrypt.jsm: v-flushInput\n");
    if (! this.pipe) return;
    this.pipe.write(this.outQueue);
    this.outQueue = "";
  },

  // API for decryptMessage Listener
  stdin: function(pipe) {
    DEBUG_LOG("mimeDecrypt.jsm: v-stdin\n");
    if (this.outQueue.length > 0) {
      pipe.write(this.outQueue);
      this.outQueue = "";
      if (this.closePipe) pipe.close();
    }
    this.pipe = pipe;
  },

  stdout: function(s) {
    DEBUG_LOG("mimeDecrypt.jsm:v-stdout:"+s.length+"\n");
    this.dataLength += s.length;
  },

  stderr: function(s) {
    DEBUG_LOG("mimeDecrypt.jsm: v-stderr\n");
    this.statusStr += s;
  },

  done: function(exitCode) {
    DEBUG_LOG("mimeDecrypt.jsm: v-done: "+exitCode+"\n");
    this.exitCode = exitCode;
    //DEBUG_LOG("mimeDecrypt.jsm: "+this.statusStr+"\n");

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
    DEBUG_LOG("mimeDecrypt.jsm: v-setMsgWindow:\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
  },

  displayStatus: function() {
    DEBUG_LOG("mimeDecrypt.jsm: v-displayStatus\n");
    DEBUG_LOG("mimeDecrypt.jsm: v-displayStatus: "+this.msgWindow+"\n");
    if (this.exitCode == null || this.msgWindow == null || this.statusDisplayed)
      return;

    try {
      DEBUG_LOG("mimeDecrypt.jsm: v-displayStatus displaying result\n");
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
      Ec.writeException("mimeDecrypt.jsm", ex);
    }
  }
}


// handler for PGP/MIME encrypted messages
// data is processed from libmime -> nsPgpMimeProxy
var EnigmailDecrypt = {
  mimeDecryptor: {
    mimeSvc: null,
    inStream: Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),
    lineNum: 0,
    initOk: false,
    foundPgp: false,
    boundary: "",
    pipe: null,
    closePipe: false,
    statusStr: "",
    outqueue: "",
    dataLength: 0,
    mimePartCount: 0,
    matchedPgpDelimiter: 0,
    exitCode: null,
    msgWindow: null,
    msgUriSpec: null,
    returnStatus: null,
    verifier: null,
    proc: null,
    statusDisplayed: false,
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

    onStartRequest: function(request, channel) {
      if (!Ec.getService()) // Ensure Enigmail is initialized
        return;
      this.initOk = true;
      DEBUG_LOG("mimeDecrypt.jsm: d-onStartRequest\n");
      this.lineNum = 0;
      this.pipe = null;
      this.closePipe = false;
      this.exitCode = null;
      this.foundPgp = false;
      this.msgWindow = null;
      this.msgUriSpec = null;
      this.verifier = null;
      this.statusDisplayed = false;
      if (channel) {
        try {
          channel = channel.QueryInterface(Ci.nsIChannel);
          this.msgUriSpec = channel.URI.spec;
        }
        catch (ex) {
          DEBUG_LOG("mimeDecrypt.jsm: d-onStartRequest: failed to extract urispec from channel");
        }
      }
      this.returnStatus = null;
      this.dataLength = 0;
      this.mimePartCount = 0;
      this.matchedPgpDelimiter = 0;
      this.outQueue = "";
      this.statusStr = "";
      this.boundary = getBoundary(this.mimeSvc.contentType);
      var statusFlagsObj = {};
      var errorMsgObj = {};
      var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      var win = windowManager.getMostRecentWindow(null);
      this.verifier = EnigmailDecrypt.newVerfier(true);
      this.verifier.onStartRequest(true);
      this.proc = Ec.decryptMessageStart(win, false, this,
                      statusFlagsObj, errorMsgObj);
    },

    onDataAvailable: function(req, sup, stream, offset, count) {
      // get data from libmime
      if (! this.initOk) return;
      DEBUG_LOG("mimeDecrypt.jsm: d-onDataAvailable: "+count+"\n");
      this.inStream.init(stream);
      var data = this.inStream.read(count);
      if (count > 0) {
        // detect MIME part boundary
        //DEBUG_LOG("mimeDecrypt.jsm: d-onDataAvailable: >"+data+"<\n");
        if (data.indexOf(this.boundary) >= 0) {
          DEBUG_LOG("mimeDecrypt.jsm: d-onDataAvailable: found boundary\n");
          ++this.mimePartCount;
          return;
        }

        // found PGP/MIME "body"
        if (this.mimePartCount == 2) {
          if (!this.matchedPgpDelimiter) {
            if (data.indexOf("-----BEGIN PGP MESSAGE-----") == 0)
              this.matchedPgpDelimiter = 1;
          }

          if (this.matchedPgpDelimiter == 1) {
            this.writeToPipe(data);

            if (data.indexOf("-----END PGP MESSAGE-----") == 0) {
              this.writeToPipe("\n");
              this.matchedPgpDelimiter = 2;
            }
          }
        }
      }
    },

    // (delayed) writing to subprocess
    writeToPipe: function(str) {
      if (this.pipe) {
        this.outQueue += str;
        if (this.outQueue.length > 920)
          this.flushInput();
      }
      else
        this.outQueue += str;
    },

    flushInput: function() {
      DEBUG_LOG("mimeDecrypt.jsm: d-flushInput\n");
      if (! this.pipe) return;
      this.pipe.write(this.outQueue);
      this.outQueue = "";
    },

    onStopRequest: function(request, win, status) {
      if (! this.initOk) return;
      DEBUG_LOG("mimeDecrypt.jsm: d-onStopRequest\n");

/*
      if (win) {
        try {
          var msgWin = win.QueryInterface(Ci.nsIMsgWindow);
          DEBUG_LOG("mimeDecrypt.jsm: d-onStopRequest: win="+msgWin+"\n");
          EnigmailDecrypt.setMsgWindow(msgWin, this.msgUriSpec);
        }
        catch(ex) {
          Ec.writeException("mimeDecrypt.jsm", ex);
        }
      }
*/

      if (! this.proc) return;
      this.flushInput();

      var thread = Cc['@mozilla.org/thread-manager;1'].getService(Ci.nsIThreadManager).currentThread;
      if (! this.pipe) {
        this.closePipe = true;
      }
      else
        this.pipe.close();

      this.proc.wait();

      this.returnStatus = {};
      Ec.decryptMessageEnd(this.statusStr,
            this.exitCode,
            this.dataLength,
            false,
            false,
            Ci.nsIEnigmail.UI_PGP_MIME,
            this.returnStatus);

      this.displayStatus();

      DEBUG_LOG("mimeDecrypt.jsm: d-onStopRequest: process terminated\n");
      this.proc = null;
      return 0;
    },

    displayStatus: function() {
      DEBUG_LOG("mimeDecrypt.jsm: d-displayStatus\n");
      if (this.exitCode == null || this.msgWindow == null || this.statusDisplayed)
        return;

      try {
        DEBUG_LOG("mimeDecrypt.jsm: d-displayStatus displaying result\n");
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
        Ec.writeException("mimeDecrypt.jsm", ex);
      }
      DEBUG_LOG("mimeDecrypt.jsm: d-displayStatus done\n");
    },

    // API for decryptMessage Listener
    stdin: function(pipe) {
      DEBUG_LOG("mimeDecrypt.jsm: d-stdin\n");
      if (this.outQueue.length > 0) {
        pipe.write(this.outQueue);
        this.outQueue = "";
        if (this.closePipe) pipe.close();
      }
      this.pipe = pipe;
    },

    stdout: function(s) {
      // write data back to libmime
      //DEBUG_LOG("mimeDecrypt.jsm: d-stdout:"+s.length+"\n");
      this.dataLength += s.length;
      this.mimeSvc.onDataAvailable(null, null, gConv.convertToInputStream(s), 0, s.length);
      this.verifier.onTextData(s);
    },

    stderr: function(s) {
      DEBUG_LOG("mimeDecrypt.jsm: d-stderr\n");
      this.statusStr += s;
    },

    done: function(exitCode) {
      DEBUG_LOG("mimeDecrypt.jsm: d-done: "+exitCode+"\n");
      this.verifier.onStopRequest();
      this.exitCode = exitCode;
    }
  },

  setMsgWindow: function(msgWindow, msgUriSpec) {
    DEBUG_LOG("mimeDecrypt.jsm: d-setMsgWindow:\n");

    if (this.mimeDecryptor.msgWindow != null) {
      DEBUG_LOG("mimeDecrypt.jsm: d-setMsgWindow: status already displayed\n");
      return;
    }

    this.mimeDecryptor.msgWindow = msgWindow;
    this.mimeDecryptor.msgUriSpec = msgUriSpec;
    this.mimeDecryptor.displayStatus();
    if (this.mimeDecryptor.verifier)
      this.mimeDecryptor.verifier.setMsgWindow(msgWindow, msgUriSpec);
  },

  newVerfier: function (embedded, msgUrl) {
    let v = new EnigmailVerify(embedded, msgUrl);

    if (this.msgWindow || this.msgUriSpec) {
      v.setMsgWindow(this.msgWindow, this.msgUriSpec);
    }

    return v;
  }
}


////////////////////////////////////////////////////////////////////
// General-purpose functions, not exported

function getBoundary(contentType) {
  DEBUG_LOG("mimeDecrypt.jsm: getBoundary: "+contentType+"\n");

  contentType = contentType.replace(/[\r\n]/g, "");
  let boundary = "";
  let ct = contentType.split(/;/);
  for (let i=0; i < ct.length; i++) {
    if (ct[i].search(/[ \t]*boundary[ \t]*=/i) >= 0) {
      boundary = ct[i];
      break;
    }
  }
  boundary = boundary.replace(/\s*boundary\s*=/i, "").replace(/[\'\"]/g, "");
  DEBUG_LOG("mimeDecrypt.jsm: getBoundary: found '"+ boundary+"'\n");
  return boundary;
}


// extract the data fields following a header.
// e.g. ContentType: xyz; Aa=b; cc=d
// returns aa=b and cc=d in an array of arrays
function getHeaderData(data) {
  DEBUG_LOG("mimeDecrypt.jsm: getHeaderData: "+data.substr(0, 100)+"\n");
  var a = data.split(/\n/);
  var res = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].length == 0) break;
    let b = a[i].split(/;/);

    // extract "abc = xyz" tuples
    for (let j=0; j < b.length; j++) {
      let m = b[j].match(/^(\s*)([^=\s;]+)(\s*)(=)(\s*)(.*)(\s*)$/);
      if (m) {
        // m[2]: identifier / m[6]: data
        res[m[2].toLowerCase()] = m[6].replace(/\s*$/, "");
        DEBUG_LOG("mimeDecrypt.jsm: getHeaderData: "+m[2].toLowerCase()+" = "+res[m[2].toLowerCase()] +"\n");
      }
    }
    if (i == 0 && a[i].indexOf(";") < 0) break;
    if (i > 0 && a[i].search(/^\s/) < 0) break;
  }
  return res;
}


function DEBUG_LOG(str) {
  if (gDebugLog) Ec.DEBUG_LOG(str);
}

function registerDecryptor() {
  try {
    var svc = Cc["@mozilla.org/mime/pgp-mime-decrypt;1"].getService(Ci.nsIPgpMimeProxy);
    svc.decryptor = EnigmailDecrypt.mimeDecryptor;
    EnigmailDecrypt.mimeDecryptor.mimeSvc = svc;

    var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    var nspr_log_modules = env.get("NSPR_LOG_MODULES");
    var matches = nspr_log_modules.match(/mimeDecrypt:(\d+)/);

    if (matches && (matches.length > 1)) {
      if (matches[1] > 2) gDebugLog = true;
      dump("mimeDecrypt.jsm: enabled debug logging\n");
    }
  }
  catch (ex) {
    dump("caught error "+ex);
  }
}

registerDecryptor();
dump("mimeDecrypt.jsm: MimeDecryptor registration done");
