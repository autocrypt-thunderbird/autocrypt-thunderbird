/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/**
 *  Module for creating PGP/MIME signed and/or encrypted messages
 *  implemented as XPCOM component
 */

'use strict';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Ec = EnigmailCommon;


const PGPMIME_JS_ENCRYPT_CONTRACTID = "@enigmail.net/enigmail/composesecure;1";
const PGPMIME_JS_ENCRYPT_CID = Components.ID("{1b040e64-e704-42b9-b05a-942e569afffc}");
const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const kMsgComposeSecureCID = "{dd753201-9a23-4e08-957f-b3616bf7e012}";

const maxBufferLen = 102400;
const MIME_SIGNED = 1;
const MIME_ENCRYPTED = 2;

var gDebugLogLevel = 0;

function PgpMimeEncrypt() {
}

PgpMimeEncrypt.prototype = {
  classDescription: "Enigmail JS Encryption Handler",
  classID: PGPMIME_JS_ENCRYPT_CID,
  contractID: PGPMIME_JS_ENCRYPT_CONTRACTID,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgComposeSecure, Ci.nsIStreamListener, Ci.nsIEnigScriptableMsgCompose]),

  // private variables

  inStream: Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),
  msgCompFields: null,
  smimeCompose: null,
  useSmime: false,
  outStringStream: null,
  inputMode: 0,
  dataLength: 0,
  headerData: "",
  encapsulate: null,
  cryptoBoundary: null,
  win: null,
  pipe: null,
  proc: null,
  statusStr: "",
  encryptedData: "",
  hashAlgorithm: null,
  pipeQueue: "",
  outQueue: "",
  closePipe: false,
  cryptoMode: 0,
  exitCode : -1,
  checkSMime: true,

  // nsIStreamListener interface
  onStartRequest: function(request) {
    DEBUG_LOG("mimeEncrypt.js: onStartRequest\n");
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    DEBUG_LOG("mimeEncrypt.js: onDataAvailable\n");
    this.inStream.init(stream);
    var data = this.inStream.read(count);
    //DEBUG_LOG("mimeEncrypt.js: >"+data+"<\n");

  },

  onStopRequest: function(request, win, status) {
    DEBUG_LOG("mimeEncrypt.js: onStopRequest\n");
  },

  disableSMimeCheck: function() {
    this.useSmime = false;
    this.checkSMime = false;
  },

  // nsIMsgComposeSecure interface
  requiresCryptoEncapsulation: function (msgIdentity, msgCompFields) {
    DEBUG_LOG("mimeEncrypt.js: requiresCryptoEncapsulation\n");
    try {

      if (this.checkSMime) {
        // Remember to use original CID, not CONTRACTID, to avoid infinite looping!
        this.smimeCompose = Components.classesByID[kMsgComposeSecureCID].createInstance(Ci.nsIMsgComposeSecure),
        this.useSmime = this.smimeCompose.requiresCryptoEncapsulation(msgIdentity, msgCompFields);
      }

      if (this.useSmime) return true;

      var securityInfo = msgCompFields.securityInfo;
      if (!securityInfo) return false;

      try {
        var enigSecurityInfo = securityInfo.QueryInterface(Ci.nsIEnigMsgCompFields);
        return (enigSecurityInfo.sendFlags & (Ci.nsIEnigmail.SEND_SIGNED | Ci.nsIEnigmail.SEND_ENCRYPTED)) != 0;
      }
      catch (ex) {
        return false;
      }
    }
    catch(ex) {
      Ec.writeException("mimeEncrypt.js", ex);
      throw(ex);
    }
  },

  beginCryptoEncapsulation: function (outStream, recipientList, msgCompFields, msgIdentity, sendReport, isDraft) {
    DEBUG_LOG("mimeEncrypt.js: beginCryptoEncapsulation\n");

    if (this.checkSMime && (! this.smimeCompose)) {
      DEBUG_LOG("mimeEncrypt.js: beginCryptoEncapsulation: ERROR MsgComposeSecure not instantiated\n");
      throw Cr.NS_ERROR_FAILURE;
    }

    if (this.useSmime)
      return this.smimeCompose.beginCryptoEncapsulation(outStream, recipientList,
                                                        msgCompFields, msgIdentity,
                                                        sendReport, isDraft);

    if (! outStream) throw Cr.NS_ERROR_NULL_POINTER;

    try {
      this.outStream = outStream;
      this.isDraft = isDraft;

      var securityInfo = msgCompFields.securityInfo;
      if (!securityInfo) throw Cr.NS_ERROR_FAILURE;

      this.enigSecurityInfo = securityInfo.QueryInterface(Ci.nsIEnigMsgCompFields); //might throw an error
      this.outStringStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);

      var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      this.win = windowManager.getMostRecentWindow(null);

      if (securityInfo.sendFlags & Ci.nsIEnigmail.SEND_PGP_MIME) {

        if (securityInfo.sendFlags & Ci.nsIEnigmail.SEND_ENCRYPTED) {
          // applies to encrypted and signed & encrypted
          this.cryptoMode = MIME_ENCRYPTED;
        }
        else if (securityInfo.sendFlags & Ci.nsIEnigmail.SEND_SIGNED) {
          this.cryptoMode = MIME_SIGNED;

          let hashAlgoObj = {};
          if (Ec.determineHashAlgorithm(this.win,
                    this.enigSecurityInfo.UIFlags,
                    this.enigSecurityInfo.senderEmailAddr,
                    hashAlgoObj) == 0) {
            this.hashAlgorithm = hashAlgoObj.value;
          }
          else
            throw Cr.NS_ERROR_FAILURE;
        }
      }
      else
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;

      var statusFlagsObj = {};
      var errorMsgObj = {};
      this.proc = Ec.encryptMessageStart(this.win,
                      this.enigSecurityInfo.UIFlags,
                      this.enigSecurityInfo.senderEmailAddr,
                      this.enigSecurityInfo.recipients,
                      this.enigSecurityInfo.bccRecipients,
                      this.hashAlgorithm,
                      this.enigSecurityInfo.sendFlags,
                      this,
                      statusFlagsObj,
                      errorMsgObj);
      if (! this.proc) throw Cr.NS_ERROR_FAILURE;

      this.cryptoBoundary = "----enig2"+this.createBoundary();
      this.startCryptoHeaders();

    }
    catch(ex) {
      Ec.writeException("mimeEncrypt.js", ex);
      throw(ex);
    }
  },

  startCryptoHeaders: function() {
    DEBUG_LOG("mimeEncrypt.js: startCryptoHeaders\n");

    if (this.cryptoMode == MIME_SIGNED) this.signedHeaders1(false);
    if (this.cryptoMode == MIME_ENCRYPTED) this.encryptedHeaders();
  },

  encryptedHeaders: function(isEightBit) {
    DEBUG_LOG("mimeEncrypt.js: encryptedHeaders\n");
    this.writeOut( "Content-Type: multipart/encrypted;\r\n" +
      " protocol=\"application/pgp-encrypted\";\r\n" +
      " boundary=\"" + this.cryptoBoundary + "\"\r\n" +
      "\r\n" +
      "This is an OpenPGP/MIME encrypted message (RFC 4880 and 3156)\r\n" +
      "--" + this.cryptoBoundary + "\r\n" +
      "Content-Type: application/pgp-encrypted\r\n" +
      "Content-Description: PGP/MIME version identification\r\n" +
      "\r\n" +
      "Version: 1\r\n" +
      "\r\n" +
      "--" + this.cryptoBoundary + "\r\n" +
      "Content-Type: application/octet-stream; name=\"encrypted.asc\"\r\n" +
      "Content-Description: OpenPGP encrypted message\r\n" +
      "Content-Disposition: inline; filename=\"encrypted.asc\"\r\n" +
      "\r\n");
  },

  signedHeaders1: function(isEightBit) {
    DEBUG_LOG("mimeEncrypt.js: signedHeaders1\n");
    this.writeOut("Content-Type: multipart/signed; micalg=pgp-" +
      this.hashAlgorithm.toLowerCase() +
      ";\r\n"+
      " protocol=\"application/pgp-signature\";\r\n"+
      " boundary=\"" + this.cryptoBoundary + "\"\r\n"+
      (isEightBit ? "Content-Transfer-Encoding: 8bit\r\n\r\n" : "\r\n") +
      "This is an OpenPGP/MIME signed message (RFC 4880 and 3156)\r\n"+
      "--" + this.cryptoBoundary + "\r\n");
  },


  signedHeaders2: function() {
    DEBUG_LOG("mimeEncrypt.js: signedHeaders2\n");

    this.writeOut("\r\n--" + this.cryptoBoundary +"\r\n"+
      "Content-Type: application/pgp-signature; name=\"signature.asc\"\r\n" +
      "Content-Description: OpenPGP digital signature\r\n" +
      "Content-Disposition: attachment; filename=\"signature.asc\"\r\n\r\n");
  },

  finishCryptoHeaders: function() {
    DEBUG_LOG("mimeEncrypt.js: finishCryptoHeaders\n");

    this.writeOut("\r\n--" + this.cryptoBoundary +"--\r\n");
  },

  finishCryptoEncapsulation: function (abort, sendReport) {
    DEBUG_LOG("mimeEncrypt.js: finishCryptoEncapsulation\n");

    if (this.checkSMime && (! this.smimeCompose))
      throw Cr.NS_ERROR_NOT_INITIALIZED;

    if (this.useSmime) return this.smimeCompose.finishCryptoEncapsulation(abort, sendReport);

    try {
      if (this.encapsulate) this.writeToPipe("--"+this.encapsulate+"--\r\n");

      if (! this.proc) return;
      this.flushInput();

      if (! this.pipe) {
        this.closePipe = true;
      }
      else
        this.pipe.close();

      this.proc.wait();

      DEBUG_LOG("mimeEncrypt.js: finishCryptoEncapsulation: exitCode = "+this.exitCode+"\n");
      if (this.exitCode != 0) throw Cr.NS_ERROR_FAILURE;

      if (this.cryptoMode == MIME_SIGNED) this.signedHeaders2();

      this.encryptedData = this.encryptedData.replace(/\r/g, "").replace(/\n/g, "\r\n"); // force CRLF
      this.writeOut(this.encryptedData);
      this.finishCryptoHeaders();
      this.flushOutput();
    }
    catch(ex) {
      Ec.writeException("mimeEncrypt.js", ex);
      throw(ex);
    }

  },

  mimeCryptoWriteBlock: function (buffer, length) {
    if (gDebugLogLevel > 4)
      DEBUG_LOG("mimeEncrypt.js: mimeCryptoWriteBlock: "+length+"\n");

    if (this.checkSMime && (! this.smimeCompose))
      throw Cr.NS_ERROR_NOT_INITIALIZED;

    if (this.useSmime) return this.smimeCompose.mimeCryptoWriteBlock(buffer, length);

    try {
      let line = buffer.substr(0,length);
      if (this.inputMode == 0) {
        this.headerData += line;

        if (line.replace(/[\r\n]/g, "").length == 0) {
          this.inputMode = 1;

          if (this.cryptoMode == MIME_ENCRYPTED) {
            let ct = this.getHeader("content-type", false);
            if ((ct.search(/text\/plain/i) == 0) || (ct.search(/text\/html/i) == 0)) {
              this.encapsulate = "enig2"+this.createBoundary();
              this.writeToPipe('Content-Type: multipart/mixed; boundary="'+
                this.encapsulate+'"\r\n\r\n');
              this.writeToPipe("--"+this.encapsulate+"\r\n");
            }
          }
          else if (this.cryptoMode == MIME_SIGNED) {
            let ct = this.getHeader("content-type", true);
            let hdr = EnigmailFuncs.getHeaderData(ct);
            hdr["boundary"] = hdr["boundary"] || "";
            hdr["boundary"] = hdr["boundary"].replace(/[\'\"]/g, "");
          }

          this.writeToPipe(this.headerData);
          if (this.cryptoMode == MIME_SIGNED) this.writeOut(this.headerData);
        }

      }
      else if (this.inputMode == 1) {
        if (this.cryptoMode == MIME_SIGNED) {
          // special treatments for various special cases with PGP/MIME signed messages
          if (line.substr(0, 5) == "From ") {
            DEBUG_LOG("mimeEncrypt.js: added >From\n");
            this.writeToPipe(">");
          }
        }

        this.writeToPipe(line);
        if (this.cryptoMode == MIME_SIGNED) this.writeOut(line);
      }
    }
    catch(ex) {
      Ec.writeException("mimeEncrypt.js", ex);
      throw(ex);
    }
  },

  writeOut: function(str) {
    if (gDebugLogLevel > 4)
      DEBUG_LOG("mimeEncrypt.js: writeOut: "+str.length+"\n");

    this.outQueue += str;

    if (this.outQueue.length > maxBufferLen)
      this.flushOutput();
  },

  flushOutput: function() {
    DEBUG_LOG("mimeEncrypt.js: flushOutput: "+this.outQueue.length+"\n");

    // check for output errors
    // TODO: remove check
    let i = this.outQueue.search(/[^\r]\n/);
    if (i != -1) {
      DEBUG_LOG("mimeEncrypt.js: flushOutput -- ERROR: found \\n without \\r at pos. "+i+"\n");
      DEBUG_LOG("mimeEncrypt.js: flushOutput: data= '"+this.outQueue.substr(i-10 < 0 ? 0 : i-10, 20)+"'\n");
    }
    this.outStringStream.setData(this.outQueue, this.outQueue.length);
    var writeCount = this.outStream.writeFrom(this.outStringStream, this.outQueue.length);
    if (writeCount < this.outQueue.length) {
      DEBUG_LOG("mimeEncrypt.js: flushOutput: wrote "+writeCount+" instead of "+length+" bytes\n");
    }
    this.outQueue = "";
  },

  writeToPipe: function(str) {
    if (gDebugLogLevel > 4)
      DEBUG_LOG("mimeEncrypt.js: writeToPipe: "+str.length+"\n");

    if (this.pipe) {
      this.pipeQueue += str;
      if (this.pipeQueue.length > maxBufferLen)
        this.flushInput();
    }
    else
      this.pipeQueue += str;
  },

  flushInput: function() {
    DEBUG_LOG("mimeEncrypt.js: flushInput\n");
    if (! this.pipe) return;
    this.pipe.write(this.pipeQueue);
    this.pipeQueue = "";
  },

  getHeader: function(hdrStr, fullHeader) {
    var foundIndex = 0;
    var res = "";
    var hdrLines = this.headerData.split(/[\r\n]+/);
    var i;
    for (i=0; i < hdrLines.length; i++) {
      if (hdrLines[i].length > 0) {
        if (fullHeader && res != "") {
          if (hdrLines[i].search(/^\s+/) == 0) {
            res += hdrLines[i].replace(/\s*[\r\n]*$/, "");
          }
          else
            return res;
        }
        else {
          let j = hdrLines[i].indexOf(":");
          if (j > 0) {
            let h = hdrLines[i].substr(0, j).replace(/\s*$/, "");
            let re = new RegExp("^"+hdrStr+"$", "i");
            if (h.search(re) == 0) {
              foundIndex = 1;
              res = hdrLines[i].substr(j+1).replace(/^\s*/, "");
              if (! fullHeader) return res;
            }
          }
        }
      }
    }

    return res;
  },

  createBoundary: function() {
    var b = "";
    for (let i=0; i<20; i++) {
      b += String.fromCharCode(65 + Math.floor(Math.random() * 24));
    }
    return b;
  },


  // API for decryptMessage Listener
  stdin: function(pipe) {
    DEBUG_LOG("mimeEncrypt.js: stdin\n");
    if (this.pipeQueue.length > 0) {
      pipe.write(this.pipeQueue);
      this.pipeQueue = "";
      if (this.closePipe) pipe.close();
    }
    this.pipe = pipe;
  },

  stdout: function(s) {
    DEBUG_LOG("mimeEncrypt.js: stdout:"+s.length+"\n");
    this.encryptedData += s;
    this.dataLength += s.length;
  },

  stderr: function(s) {
    DEBUG_LOG("mimeEncrypt.js: stderr\n");
    this.statusStr += s;
  },

  done: function(exitCode) {
    DEBUG_LOG("mimeEncrypt.js: done: "+exitCode+"\n");

    let retStatusObj = {};

    this.exitCode = Ec.encryptMessageEnd(this.statusStr,
          exitCode,
          this.enigSecurityInfo.UIFlags,
          this.enigSecurityInfo.sendFlags,
          this.dataLength,
          retStatusObj);

    if (this.exitCode != 0)
      Ec.alert(this.win, retStatusObj.errorMsg);
  }
};




////////////////////////////////////////////////////////////////////
// General-purpose functions, not exported


function DEBUG_LOG(str) {
  if (gDebugLogLevel) Ec.DEBUG_LOG(str);
}

function initModule() {
  try {
    var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    var nspr_log_modules = env.get("NSPR_LOG_MODULES");
    var matches = nspr_log_modules.match(/mimeEncrypt:(\d+)/);

    if (matches && (matches.length > 1)) {
      gDebugLogLevel = matches[1];
      DEBUG_LOG("mimeEncrypt.js: enabled debug logging\n");
    }
  }
  catch (ex) {
    dump("caught error "+ex);
  }
}

var NSGetFactory = XPCOMUtils.generateNSGetFactory([PgpMimeEncrypt]);

initModule();
dump("mimeEncrypt.js: module initialized\n");
