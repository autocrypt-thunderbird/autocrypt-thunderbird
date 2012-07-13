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
    exitCode: null,
    msgWindow: null,
    msgUriSpec: null,
    returnStatus: null,
    proc: null,
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

    onStartRequest: function() {
      if (!Ec.getService()) // Ensure Enigmail is initialized
        return;
      this.initOk = true;
      Ec.DEBUG_LOG("mimeDecrypt.jsm: onStartRequest\n");
      this.lineNum = 0;
      this.pipe = null;
      this.closePipe = false;
      this.exitCode = null;
      this.foundPgp = false;
      this.msgWindow = null;
      this.msgUriSpec = null;
      this.returnStatus = null;
      this.dataLength = 0;
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
      Ec.DEBUG_LOG("mimeDecrypt.jsm: onDataAvailable\n");
      this.inStream.init(stream);
      var data = this.inStream.read(count);
      if (count > 0) {
        if (! this.pipe) {
          this.outqueue += data;
        }
        else
          this.pipe.write(data);
      }
    },

    onStopRequest: function() {
      if (! this.initOk) return;
      Ec.DEBUG_LOG("mimeDecrypt.jsm: onStopRequest\n");

      if (! this.proc) return;

      var thread = Cc['@mozilla.org/thread-manager;1'].getService(Ci.nsIThreadManager).currentThread;
      if (! this.pipe) {
        this.closePipe = true;
      }
      else
        this.pipe.close();

      this.proc.wait();

      this.returnStatus = {}
      Ec.decryptMessageEnd(this.statusStr,
            this.exitCode,
            this.dataLength,
            false,
            false,
            Ci.nsIEnigmail.UI_PGP_MIME,
            this.returnStatus);

      this.displayStatus();

      Ec.DEBUG_LOG("mimeDecrypt.jsm: onStopRequest: process terminated\n");
      this.proc = null;
    },

    displayStatus: function() {
      Ec.DEBUG_LOG("mimeDecrypt.jsm: displayStatus\n");
      if (this.exitCode == null || this.msgWindow == null)
        return;

      try {
        Ec.DEBUG_LOG("mimeDecrypt.jsm: displayStatus displaying result\n");
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
      Ec.DEBUG_LOG("mimeDecrypt.jsm: displayStatus done\n");
    },

    // API for decryptMessage Listener
    stdin: function(pipe) {
      Ec.DEBUG_LOG("mimeDecrypt.jsm: stdin\n");
      if (this.outqueue.length > 0) {
        pipe.write(this.outqueue);
        this.outqueue = "";
        if (this.closePipe) pipe.close();
      }
      this.pipe = pipe;
    },

    stdout: function(s) {
      // write data back to libmime
      Ec.DEBUG_LOG("mimeDecrypt.jsm: stdout:"+s.length+"\n");
      this.dataLength += s.length;
      this.mimeSvc.onDataAvailable(null, null, gConv.convertToInputStream(s), 0, s.length);
    },

    stderr: function(s) {
    Ec.DEBUG_LOG("mimeDecrypt.jsm: stderr\n");
      this.statusStr += s;
    },

    done: function(exitCode) {
      Ec.DEBUG_LOG("mimeDecrypt.jsm: done: "+exitCode+"\n");
      this.exitCode = exitCode;
    }
  },

  setMsgWindow: function(msgWindow, msgUriSpec) {
    Ec.DEBUG_LOG("mimeDecrypt.jsm: setMsgWindow:\n");

    if (this.mimeDecryptor.msgWindow != null) {
      Ec.DEBUG_LOG("mimeDecrypt.jsm: setMsgWindow: status already displayed\n");
      return;
    }

    this.mimeDecryptor.msgWindow = msgWindow;
    this.mimeDecryptor.msgUriSpec = msgUriSpec;
    this.mimeDecryptor.displayStatus();
  }
}


function getBoundary(contentType) {
  Ec.DEBUG_LOG("mimeDecrypt.jsm:getBoundary: "+contentType+"\n");

  contentType = contentType.replace(/\r/g, "").replace(/\n/g, "");
  let boundary = "";
  let ct = contentType.split(/;/);
  for (let i=0; i < ct.length; i++) {
    if (ct[i].search(/[ \t]*boundary[ \t]*=/i) >= 0) {
      boundary = ct[i];
      break;
    }
  }
  boundary = boundary.replace(/[ \t]*boundary[ \t]*=/i, "");
  Ec.DEBUG_LOG("mimeDecrypt.jsm:getBoundary: found "+ boundary+"\n");
  return boundary;
}


function registerDecryptor() {
  try {
    var svc = Cc["@mozilla.org/mime/pgp-mime-decrypt;1"].getService(Ci.nsIPgpMimeProxy);
    svc.decryptor = EnigmailDecrypt.mimeDecryptor;
    EnigmailDecrypt.mimeDecryptor.mimeSvc = svc;
  }
  catch (ex) {
    dump("caught error "+ex);
  }
}

registerDecryptor();
dump("mimeDecrypt.jsm: MimeDecryptor registration done");
