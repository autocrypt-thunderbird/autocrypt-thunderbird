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
    proc: null,
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

    onStartRequest: function(request, channel) {
      if (!Ec.getService()) // Ensure Enigmail is initialized
        return;
      this.initOk = true;
      DEBUG_LOG("mimeDecrypt.jsm: onStartRequest\n");
      this.lineNum = 0;
      this.pipe = null;
      this.closePipe = false;
      this.exitCode = null;
      this.foundPgp = false;
      this.msgWindow = null;
      this.msgUriSpec = null;
      if (channel) {
        try {
          channel = channel.QueryInterface(Ci.nsIChannel);
          this.msgUriSpec = channel.URI.spec;
        }
        catch (ex) {
          DEBUG_LOG("mimeDecrypt.jsm: onStartRequest: failed to extract urispec from channel");
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
      this.proc = Ec.decryptMessageStart(win, false, this,
                      statusFlagsObj, errorMsgObj);
    },

    onDataAvailable: function(req, sup, stream, offset, count) {
      // get data from libmime
      if (! this.initOk) return;
      DEBUG_LOG("mimeDecrypt.jsm: onDataAvailable: "+count+"\n");
      this.inStream.init(stream);
      var data = this.inStream.read(count);
      if (count > 0) {
        // detect MIME part boundary
        //DEBUG_LOG("mimeDecrypt.jsm: onDataAvailable: >"+data+"<\n");
        if (data.indexOf(this.boundary) >= 0) {
          DEBUG_LOG("mimeDecrypt.jsm: onDataAvailable: found boundary\n");
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
        this.outqueue += str;
        if (this.outqueue.length > 920)
          this.flushInput();
      }
      else
        this.outqueue += str;
    },

    flushInput: function() {
      DEBUG_LOG("mimeDecrypt.jsm: flushInput\n");
      if (! this.pipe) return;
      this.pipe.write(this.outqueue);
      this.outqueue = "";
    },

    onStopRequest: function(request, win, status) {
      if (! this.initOk) return;
      DEBUG_LOG("mimeDecrypt.jsm: onStopRequest\n");

      if (win) {
        try {
          var msgWin = win.QueryInterface(Ci.nsIMsgWindow);
          DEBUG_LOG("mimeDecrypt.jsm: onStopRequest: win="+msgWin+"\n");
          EnigmailDecrypt.setMsgWindow(msgWin, this.msgUriSpec);
        }
        catch(ex) {
          Ec.writeException("mimeDecrypt.jsm", ex);
        }
      }

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

      DEBUG_LOG("mimeDecrypt.jsm: onStopRequest: process terminated\n");
      this.proc = null;
      return 0;
    },

    displayStatus: function() {
      DEBUG_LOG("mimeDecrypt.jsm: displayStatus\n");
      if (this.exitCode == null || this.msgWindow == null)
        return;

      try {
        DEBUG_LOG("mimeDecrypt.jsm: displayStatus displaying result\n");
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
      }
      catch(ex) {
        Ec.writeException("mimeDecrypt.jsm", ex);
      }
      DEBUG_LOG("mimeDecrypt.jsm: displayStatus done\n");
    },

    // API for decryptMessage Listener
    stdin: function(pipe) {
      DEBUG_LOG("mimeDecrypt.jsm: stdin\n");
      if (this.outqueue.length > 0) {
        pipe.write(this.outqueue);
        this.outqueue = "";
        if (this.closePipe) pipe.close();
      }
      this.pipe = pipe;
    },

    stdout: function(s) {
      // write data back to libmime
      //DEBUG_LOG("mimeDecrypt.jsm: stdout:"+s.length+"\n");
      this.dataLength += s.length;
      this.mimeSvc.onDataAvailable(null, null, gConv.convertToInputStream(s), 0, s.length);
    },

    stderr: function(s) {
    DEBUG_LOG("mimeDecrypt.jsm: stderr\n");
      this.statusStr += s;
    },

    done: function(exitCode) {
      DEBUG_LOG("mimeDecrypt.jsm: done: "+exitCode+"\n");
      this.exitCode = exitCode;
    }
  },

  setMsgWindow: function(msgWindow, msgUriSpec) {
    DEBUG_LOG("mimeDecrypt.jsm: setMsgWindow:\n");

    if (this.mimeDecryptor.msgWindow != null) {
      DEBUG_LOG("mimeDecrypt.jsm: setMsgWindow: status already displayed\n");
      return;
    }

    this.mimeDecryptor.msgWindow = msgWindow;
    this.mimeDecryptor.msgUriSpec = msgUriSpec;
    this.mimeDecryptor.displayStatus();
  }
}


function getBoundary(contentType) {
  DEBUG_LOG("mimeDecrypt.jsm: getBoundary: "+contentType+"\n");

  contentType = contentType.replace(/\r/g, "").replace(/\n/g, "");
  let boundary = "";
  let ct = contentType.split(/;/);
  for (let i=0; i < ct.length; i++) {
    if (ct[i].search(/[ \t]*boundary[ \t]*=/i) >= 0) {
      boundary = ct[i];
      break;
    }
  }
  boundary = boundary.replace(/[ \t]*boundary[ \t]*=/i, "").replace(/[\'\"]/g, "");
  DEBUG_LOG("mimeDecrypt.jsm: getBoundary: found '"+ boundary+"'\n");
  return boundary;
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
      Ec.DEBUG_LOG("mimeDecrypt.jsm: enabled debug logging\n");
    }
  }
  catch (ex) {
    dump("caught error "+ex);
  }
}

registerDecryptor();
dump("mimeDecrypt.jsm: MimeDecryptor registration done");
