/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/**
 *  Module for handling PGP/MIME encrypted messages
 *  implemented as an XPCOM object
 */

'use strict';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/mimeVerify.jsm");


const Cc = Components.classes;
const Ci = Components.interfaces;
const Ec = EnigmailCommon;

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

function PgpMimeDecrypt() {
}

PgpMimeDecrypt.prototype = {
  classDescription: "Enigmail JS Decryption Handler",
  classID:  PGPMIME_JS_DECRYPTOR_CID,
  contractID: PGPMIME_JS_DECRYPTOR_CONTRACTID,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  mimeSvc: null,
  inStream: Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),
  initOk: false,
  boundary: "",
  pipe: null,
  closePipe: false,
  statusStr: "",
  outqueue: "",
  dataLength: 0,
  mimePartCount: 0,
  headerMode: 0,
  xferEncoding: ENCODING_DEFAULT,
  matchedPgpDelimiter: 0,
  exitCode: null,
  msgWindow: null,
  msgUriSpec: null,
  returnStatus: null,
  verifier: null,
  proc: null,
  statusDisplayed: false,
  uri: null,

  onStartRequest: function(request, uri) {
    if (!Ec.getService()) // Ensure Enigmail is initialized
      return;
    DEBUG_LOG("mimeDecrypt.js: onStartRequest\n");

    ++gNumProc;
    if (gNumProc > 2) {
      DEBUG_LOG("mimeDecrypt.js: number of parallel requests above threshold - ignoring requst\n");
      return;
    }

    this.initOk = true;
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    this.pipe = null;
    this.closePipe = false;
    this.exitCode = null;
    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;
    this.verifier = null;
    this.statusDisplayed = false;
    this.returnStatus = null;
    this.dataLength = 0;
    this.decryptedData = "";
    this.mimePartCount = 0;
    this.matchedPgpDelimiter = 0;
    this.outQueue = "";
    this.statusStr = "";
    this.headerMode = 0;
    this.xferEncoding = ENCODING_DEFAULT;
    this.boundary = getBoundary(this.mimeSvc.contentType);
    this.verifier = EnigmailVerify.newVerifier(true, undefined, false);
    this.verifier.setMsgWindow(this.msgWindow, this.msgUriSpec);
    if (uri != null)
      this.uri = uri.QueryInterface(Ci.nsIURI).clone();
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    // get data from libmime
    if (! this.initOk) return;
    this.inStream.init(stream);

    if (count > 0) {
      var data = this.inStream.read(count);
      // detect MIME part boundary
      if (data.indexOf(this.boundary) >= 0) {
        DEBUG_LOG("mimeDecrypt.js: onDataAvailable: found boundary\n");
        ++this.mimePartCount;
        this.headerMode = 1;
        return;
      }


      // found PGP/MIME "body"
      if (this.mimePartCount == 2) {

        if (this.headerMode == 1) {
          // we are in PGP/MIME main part headers
          if (data.search(/\r|\n/) == 0) {
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
            this.cacheData(EnigmailCommon.decodeQuotedPrintable(data));
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
      DEBUG_LOG("mimeDecrypt.js: cacheData: "+str.length+"\n");

    this.outQueue += str;
  },

  flushInput: function() {
    DEBUG_LOG("mimeDecrypt.js: flushInput: "+this.outQueue.length+" bytes\n");
    if (! this.pipe) {
      DEBUG_LOG("mimeDecrypt.js: flushInput: no pipe\n");
      return;
    }

    this.pipe.write(this.outQueue);
    this.outQueue = "";
  },

  onStopRequest: function(request, win, status) {
    DEBUG_LOG("mimeDecrypt.js: onStopRequest\n");
    --gNumProc;
    if (! this.initOk) return;

    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    if (this.uri) {
      // return if not decrypting currently displayed message (except if
      // printing, replying, etc)
      try {
        if (this.uri.spec.search(/[\&\?]header=[a-zA-Z0-9]*$/) < 0 &&
            this.uri.spec.search(/[\&\?]part=[\.0-9]+/) < 0 &&
            this.uri.spec.search(/[\&\?]examineEncryptedParts=true/) < 0) {

          if (this.uri.spec.search(/[\&\?]header=filter\&.*$/) > 0)
            return;

          if (this.msgUriSpec) {
            var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
            var msgSvc = messenger.messageServiceFromURI(this.msgUriSpec);

            var url= {};
            msgSvc.GetUrlForUri(this.msgUriSpec, url, null)
            if (url.value.spec != this.uri.spec)
              return;
          }
        }
      }
      catch(ex) {
        Ec.writeException("mimeDecrypt.js", ex);
      }
    }


    if (this.xferEncoding == ENCODING_BASE64) {
      this.outQueue = atob(this.outQueue.replace(/[\s\r\n]*/g, ""))+ "\n";
    }

    var statusFlagsObj = {};
    var errorMsgObj = {};
    var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
    var win = windowManager.getMostRecentWindow(null);
    this.verifier.onStartRequest(true);

    var maxOutput = this.outQueue.length * 100; // limit output to 100 times message size
                                                // to avoid DoS attack
    this.proc = Ec.decryptMessageStart(win, false, false, this,
                    statusFlagsObj, errorMsgObj, null, maxOutput);

    if (! this.proc) return;
    this.flushInput();

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

    DEBUG_LOG("mimeDecrypt.js: onStopRequest: process terminated\n");
    this.proc = null;
  },

  displayStatus: function() {
    DEBUG_LOG("mimeDecrypt.js: displayStatus\n");

    if (this.exitCode == null || this.msgWindow == null || this.statusDisplayed)
      return;

    try {
      DEBUG_LOG("mimeDecrypt.js: displayStatus displaying result\n");
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
            this.uri);
      }
      this.statusDisplayed = true;
    }
    catch(ex) {
      Ec.writeException("mimeDecrypt.js", ex);
    }
    DEBUG_LOG("mimeDecrypt.js: displayStatus done\n");
  },

  // API for decryptMessage Listener
  stdin: function(pipe) {
    DEBUG_LOG("mimeDecrypt.js: stdin\n");
    if (this.outQueue.length > 0) {
      pipe.write(this.outQueue);
      this.outQueue = "";
      if (this.closePipe) pipe.close();
    }
    this.pipe = pipe;
  },

  stdout: function(s) {
    // write data back to libmime
    //DEBUG_LOG("mimeDecrypt.js: stdout:"+s.length+"\n");
    this.dataLength += s.length;
    this.decryptedData += s;
  },

  stderr: function(s) {
    DEBUG_LOG("mimeDecrypt.js: stderr\n");
    this.statusStr += s;
  },

  done: function(exitCode) {
    DEBUG_LOG("mimeDecrypt.js: done: "+exitCode+"\n");

    if (gDebugLogLevel > 4)
      DEBUG_LOG("mimeDecrypt.js: done: decrypted data='"+this.decryptedData+"'\n");

    // ensure newline at the end of the stream
    if (! this.decryptedData.endsWith("\n")) {
      this.decryptedData +="\r\n";
    }

    var verifyData = this.decryptedData;

    var i = this.decryptedData.search(/\n\r?\n/);
    if (i > 0) {
      var hdr = this.decryptedData.substr(0, i).split(/\r?\n/);
      var j;
      for (j in hdr) {
        if (hdr[j].search(/^\s*content-type:\s+text\/(plain|html)/i) >= 0) {
          DEBUG_LOG("mimeDecrypt.js: done: adding multipart/mixed around "+ hdr[j]+"\n");

          this.decryptedData = 'Content-Type: multipart/mixed; boundary="enigmailWrapper"\r\n\r\n'+
            '--enigmailWrapper\r\n' +
            this.decryptedData +
            '--enigmailWrapper--\r\n';
          break;
        }
      }
    }

    gConv.setData(this.decryptedData, this.decryptedData.length);
    try {
      this.mimeSvc.onDataAvailable(null, null, gConv, 0, this.decryptedData.length);
    }
    catch(ex) {
      Ec.ERROR_LOG("mimeDecrypt.js: mimeSvc.onDataAvailable failed:\n"+ex.toString());
    }

    this.verifier.onTextData(verifyData);
    this.verifier.onStopRequest();
    this.decryptedData = "";
    this.exitCode = exitCode;
  }
};


////////////////////////////////////////////////////////////////////
// General-purpose functions, not exported

function getBoundary(contentType) {
  DEBUG_LOG("mimeDecrypt.js: getBoundary: "+contentType+"\n");

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
  DEBUG_LOG("mimeDecrypt.js: getBoundary: found '"+ boundary+"'\n");
  return boundary;
}


function DEBUG_LOG(str) {
  if (gDebugLogLevel) Ec.DEBUG_LOG(str);
}

function initModule() {
  try {
    var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    var nspr_log_modules = env.get("NSPR_LOG_MODULES");
    var matches = nspr_log_modules.match(/mimeDecrypt:(\d+)/);

    if (matches && (matches.length > 1)) {
      gDebugLogLevel = matches[1];
      dump("mimeDecrypt.js: enabled debug logging\n");
    }
  }
  catch (ex) {
    dump("caught error "+ex);
  }
}

var NSGetFactory = XPCOMUtils.generateNSGetFactory([PgpMimeDecrypt]);
initModule();
dump("mimeDecrypt.js: MimeDecrypt - registration done\n");
