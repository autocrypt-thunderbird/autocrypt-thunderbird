/*global Components: false, EnigmailLog: false, EnigmailDialog: false, EnigmailFuncs: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for creating PGP/MIME signed and/or encrypted messages
 *  implemented as XPCOM component
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Components.utils.import("resource://gre/modules/jsmime.jsm"); /*global jsmime: false*/
Components.utils.import("resource://enigmail/funcs.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/encryption.jsm"); /*global EnigmailEncryption: false */
Components.utils.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Components.utils.import("resource://enigmail/hash.jsm"); /*global EnigmailHash: false */
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const PGPMIME_JS_ENCRYPT_CONTRACTID = "@enigmail.net/enigmail/composesecure;1";
const PGPMIME_JS_ENCRYPT_CID = Components.ID("{1b040e64-e704-42b9-b05a-942e569afffc}");
const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const kMsgComposeSecureCID = "{dd753201-9a23-4e08-957f-b3616bf7e012}";

const maxBufferLen = 102400;
const MIME_SIGNED = 1;
const MIME_ENCRYPTED = 2;

var gDebugLogLevel = 0;

function PgpMimeEncrypt() {}

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
  encHeader: null,
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
  exitCode: -1,
  inspector: null,
  checkSMime: true,

  // nsIStreamListener interface
  onStartRequest: function(request) {
    LOCAL_DEBUG("mimeEncrypt.js: onStartRequest\n");
    this.encHeader = null;
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    LOCAL_DEBUG("mimeEncrypt.js: onDataAvailable\n");
    this.inStream.init(stream);
    var data = this.inStream.read(count);
    //LOCAL_DEBUG("mimeEncrypt.js: >"+data+"<\n");

  },

  onStopRequest: function(request, win, status) {
    LOCAL_DEBUG("mimeEncrypt.js: onStopRequest\n");
  },

  disableSMimeCheck: function() {
    this.useSmime = false;
    this.checkSMime = false;
  },

  // nsIMsgComposeSecure interface
  requiresCryptoEncapsulation: function(msgIdentity, msgCompFields) {
    LOCAL_DEBUG("mimeEncrypt.js: requiresCryptoEncapsulation\n");
    try {

      if (this.checkSMime) {
        // Remember to use original CID, not CONTRACTID, to avoid infinite looping!
        this.smimeCompose = Components.classesByID[kMsgComposeSecureCID].createInstance(Ci.nsIMsgComposeSecure);
        this.useSmime = this.smimeCompose.requiresCryptoEncapsulation(msgIdentity, msgCompFields);
      }

      if (this.useSmime) return true;

      var securityInfo = msgCompFields.securityInfo;
      if (!securityInfo) return false;

      try {
        var enigSecurityInfo = securityInfo.QueryInterface(Ci.nsIEnigMsgCompFields);
        return (enigSecurityInfo.sendFlags & (Ci.nsIEnigmail.SEND_SIGNED | Ci.nsIEnigmail.SEND_ENCRYPTED)) !== 0;
      }
      catch (ex) {
        return false;
      }
    }
    catch (ex) {
      EnigmailLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }
  },

  beginCryptoEncapsulation: function(outStream, recipientList, msgCompFields, msgIdentity, sendReport, isDraft) {
    LOCAL_DEBUG("mimeEncrypt.js: beginCryptoEncapsulation\n");

    if (this.checkSMime && (!this.smimeCompose)) {
      LOCAL_DEBUG("mimeEncrypt.js: beginCryptoEncapsulation: ERROR MsgComposeSecure not instantiated\n");
      throw Cr.NS_ERROR_FAILURE;
    }

    if (this.useSmime)
      return this.smimeCompose.beginCryptoEncapsulation(outStream, recipientList,
        msgCompFields, msgIdentity,
        sendReport, isDraft);

    if (!outStream) throw Cr.NS_ERROR_NULL_POINTER;

    try {
      this.inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

      this.outStream = outStream;
      this.isDraft = isDraft;

      this.msgCompFields = msgCompFields;
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
          if (EnigmailHash.determineAlgorithm(this.win,
              this.enigSecurityInfo.UIFlags,
              this.enigSecurityInfo.senderEmailAddr,
              hashAlgoObj) === 0) {
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
      this.proc = EnigmailEncryption.encryptMessageStart(this.win,
        this.enigSecurityInfo.UIFlags,
        this.enigSecurityInfo.senderEmailAddr,
        this.enigSecurityInfo.recipients,
        this.enigSecurityInfo.bccRecipients,
        this.hashAlgorithm,
        this.enigSecurityInfo.sendFlags,
        this,
        statusFlagsObj,
        errorMsgObj);
      if (!this.proc) throw Cr.NS_ERROR_FAILURE;

      this.cryptoBoundary = EnigmailMime.createBoundary();
      this.startCryptoHeaders();

    }
    catch (ex) {
      EnigmailLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }
  },

  startCryptoHeaders: function() {
    LOCAL_DEBUG("mimeEncrypt.js: startCryptoHeaders\n");

    if (this.cryptoMode == MIME_SIGNED) this.signedHeaders1(false);
    if (this.cryptoMode == MIME_ENCRYPTED) this.encryptedHeaders();

    this.writeSecureHeaders();
  },

  writeSecureHeaders: function() {
    this.encHeader = EnigmailMime.createBoundary();

    let allHdr = "";
    let visibleHdr = "";

    let addrParser = jsmime.headerparser.parseAddressingHeader;
    let noParser = function(s) {
      return s;
    };

    let h = {
      from: {
        field: "From",
        parser: addrParser
      },
      replyTo: {
        field: "Reply-To",
        parser: addrParser
      },
      to: {
        field: "To",
        parser: addrParser
      },
      cc: {
        field: "Cc",
        parser: addrParser
      },
      newsgroups: {
        field: "Newsgroups",
        parser: noParser
      },
      followupTo: {
        field: "Followup-To",
        parser: addrParser
      },
      messageId: {
        field: "Message-Id",
        parser: noParser
      }
    };

    // visible headers list
    let vH = {
      'from': 1,
      'to': 1,
      'subject': 1,
      'cc': 1
    };

    for (let i in h) {
      if (this.msgCompFields[i] && this.msgCompFields[i].length > 0) {
        allHdr += jsmime.headeremitter.emitStructuredHeader(h[i].field, h[i].parser(this.msgCompFields[i]), {});
      }

      if (i in vH && this.msgCompFields[i].length > 0) {
        visibleHdr += jsmime.headeremitter.emitStructuredHeader(h[i].field, h[i].parser(this.msgCompFields[i]), {});
      }
    }

    if (this.enigSecurityInfo.originalSubject && this.enigSecurityInfo.originalSubject.length > 0) {
      allHdr += jsmime.headeremitter.emitStructuredHeader("subject", this.enigSecurityInfo.originalSubject, {});
      visibleHdr += jsmime.headeremitter.emitStructuredHeader("subject", this.enigSecurityInfo.originalSubject, {});
    }

    // special handling for references and in-reply-to

    if (this.enigSecurityInfo.originalReferences && this.enigSecurityInfo.originalReferences.length > 0) {
      allHdr += jsmime.headeremitter.emitStructuredHeader("references", this.enigSecurityInfo.originalReferences, {});

      let bracket = this.enigSecurityInfo.originalReferences.lastIndexOf("<");
      if (bracket >= 0) {
        allHdr += jsmime.headeremitter.emitStructuredHeader("in-reply-to", this.enigSecurityInfo.originalReferences.substr(bracket), {});
      }
    }

    let w = 'Content-Type: multipart/mixed; boundary="' + this.encHeader + '"\r\n' + allHdr + '\r\n' +
      "--" + this.encHeader + "\r\n";

    if (this.cryptoMode == MIME_ENCRYPTED && this.enigSecurityInfo.sendFlags & Ci.nsIEnigmail.ENCRYPT_HEADERS) {
      w += 'Content-Type: text/rfc822-headers; charset="utf-8";\r\n' +
        ' protected-headers="v1"\r\n' +
        'Content-Disposition: inline\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        EnigmailData.encodeBase64(visibleHdr) +
        "\r\n--" + this.encHeader + "\r\n";
    }
    this.writeToPipe(w);

    if (this.cryptoMode == MIME_SIGNED) this.writeOut(w);
  },

  encryptedHeaders: function(isEightBit) {
    LOCAL_DEBUG("mimeEncrypt.js: encryptedHeaders\n");
    this.writeOut("Content-Type: multipart/encrypted;\r\n" +
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
    LOCAL_DEBUG("mimeEncrypt.js: signedHeaders1\n");
    this.writeOut("Content-Type: multipart/signed; micalg=pgp-" +
      this.hashAlgorithm.toLowerCase() +
      ";\r\n" +
      " protocol=\"application/pgp-signature\";\r\n" +
      " boundary=\"" + this.cryptoBoundary + "\"\r\n" +
      (isEightBit ? "Content-Transfer-Encoding: 8bit\r\n\r\n" : "\r\n") +
      "This is an OpenPGP/MIME signed message (RFC 4880 and 3156)\r\n" +
      "--" + this.cryptoBoundary + "\r\n");
  },


  signedHeaders2: function() {
    LOCAL_DEBUG("mimeEncrypt.js: signedHeaders2\n");

    this.writeOut("\r\n--" + this.cryptoBoundary + "\r\n" +
      "Content-Type: application/pgp-signature; name=\"signature.asc\"\r\n" +
      "Content-Description: OpenPGP digital signature\r\n" +
      "Content-Disposition: attachment; filename=\"signature.asc\"\r\n\r\n");
  },

  finishCryptoHeaders: function() {
    LOCAL_DEBUG("mimeEncrypt.js: finishCryptoHeaders\n");

    this.writeOut("\r\n--" + this.cryptoBoundary + "--\r\n");
  },

  finishCryptoEncapsulation: function(abort, sendReport) {
    LOCAL_DEBUG("mimeEncrypt.js: finishCryptoEncapsulation\n");

    if (this.checkSMime && (!this.smimeCompose))
      throw Cr.NS_ERROR_NOT_INITIALIZED;

    if (this.useSmime) {
      this.smimeCompose.finishCryptoEncapsulation(abort, sendReport);
      return;
    }

    try {
      if (this.encapsulate) this.writeToPipe("--" + this.encapsulate + "--\r\n");

      if (this.encHeader) {
        this.writeToPipe("\r\n--" + this.encHeader + "--\r\n");
        if (this.cryptoMode == MIME_SIGNED) this.writeOut("\r\n--" + this.encHeader + "--\r\n");
      }


      if (!this.proc) return;
      this.flushInput();

      if (!this.pipe) {
        this.closePipe = true;
      }
      else
        this.pipe.close();

      // wait here for this.proc to terminate
      this.inspector.enterNestedEventLoop(0);

      LOCAL_DEBUG("mimeEncrypt.js: finishCryptoEncapsulation: exitCode = " + this.exitCode + "\n");
      if (this.exitCode !== 0) throw Cr.NS_ERROR_FAILURE;

      if (this.cryptoMode == MIME_SIGNED) this.signedHeaders2();

      this.encryptedData = this.encryptedData.replace(/\r/g, "").replace(/\n/g, "\r\n"); // force CRLF
      this.writeOut(this.encryptedData);
      this.finishCryptoHeaders();
      this.flushOutput();
    }
    catch (ex) {
      EnigmailLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }

  },

  mimeCryptoWriteBlock: function(buffer, length) {
    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeEncrypt.js: mimeCryptoWriteBlock: " + length + "\n");

    if (this.checkSMime && (!this.smimeCompose))
      throw Cr.NS_ERROR_NOT_INITIALIZED;

    if (this.useSmime) return this.smimeCompose.mimeCryptoWriteBlock(buffer, length);

    try {
      let line = buffer.substr(0, length);
      if (this.inputMode === 0) {
        this.headerData += line;

        if (line.replace(/[\r\n]/g, "").length === 0) {
          this.inputMode = 1;

          if (this.cryptoMode == MIME_ENCRYPTED) {
            let ct = this.getHeader("content-type", false);
            if ((ct.search(/text\/plain/i) === 0) || (ct.search(/text\/html/i) === 0)) {
              this.encapsulate = EnigmailMime.createBoundary();
              this.writeToPipe('Content-Type: multipart/mixed; boundary="' +
                this.encapsulate + '"\r\n\r\n');
              this.writeToPipe("--" + this.encapsulate + "\r\n");
            }
          }
          else if (this.cryptoMode == MIME_SIGNED) {
            let ct = this.getHeader("content-type", true);
            let hdr = EnigmailFuncs.getHeaderData(ct);
            hdr.boundary = hdr.boundary || "";
            hdr.boundary = hdr.boundary.replace(/[\'\"]/g, "");
          }

          this.writeToPipe(this.headerData);
          if (this.cryptoMode == MIME_SIGNED) this.writeOut(this.headerData);
        }

      }
      else if (this.inputMode == 1) {
        if (this.cryptoMode == MIME_SIGNED) {
          // special treatments for various special cases with PGP/MIME signed messages
          if (line.substr(0, 5) == "From ") {
            LOCAL_DEBUG("mimeEncrypt.js: added >From\n");
            this.writeToPipe(">");
          }
        }

        this.writeToPipe(line);
        if (this.cryptoMode == MIME_SIGNED) this.writeOut(line);
      }
    }
    catch (ex) {
      EnigmailLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }
  },

  writeOut: function(str) {
    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeEncrypt.js: writeOut: " + str.length + "\n");

    this.outQueue += str;

    if (this.outQueue.length > maxBufferLen)
      this.flushOutput();
  },

  flushOutput: function() {
    LOCAL_DEBUG("mimeEncrypt.js: flushOutput: " + this.outQueue.length + "\n");

    // check for output errors
    // TODO: remove check
    let i = this.outQueue.search(/[^\r]\n/);
    if (i != -1) {
      LOCAL_DEBUG("mimeEncrypt.js: flushOutput -- ERROR: found \\n without \\r at pos. " + i + "\n");
      LOCAL_DEBUG("mimeEncrypt.js: flushOutput: data= '" + this.outQueue.substr(i - 10 < 0 ? 0 : i - 10, 20) + "'\n");
    }
    this.outStringStream.setData(this.outQueue, this.outQueue.length);
    var writeCount = this.outStream.writeFrom(this.outStringStream, this.outQueue.length);
    if (writeCount < this.outQueue.length) {
      LOCAL_DEBUG("mimeEncrypt.js: flushOutput: wrote " + writeCount + " instead of " + this.outQueue.length + " bytes\n");
    }
    this.outQueue = "";
  },

  writeToPipe: function(str) {
    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeEncrypt.js: writeToPipe: " + str.length + "\n");

    if (this.pipe) {
      this.pipeQueue += str;
      if (this.pipeQueue.length > maxBufferLen)
        this.flushInput();
    }
    else
      this.pipeQueue += str;
  },

  flushInput: function() {
    LOCAL_DEBUG("mimeEncrypt.js: flushInput\n");
    if (!this.pipe) return;
    this.pipe.write(this.pipeQueue);
    this.pipeQueue = "";
  },

  getHeader: function(hdrStr, fullHeader) {
    var foundIndex = 0;
    var res = "";
    var hdrLines = this.headerData.split(/[\r\n]+/);
    var i;
    for (i = 0; i < hdrLines.length; i++) {
      if (hdrLines[i].length > 0) {
        if (fullHeader && res !== "") {
          if (hdrLines[i].search(/^\s+/) === 0) {
            res += hdrLines[i].replace(/\s*[\r\n]*$/, "");
          }
          else
            return res;
        }
        else {
          let j = hdrLines[i].indexOf(":");
          if (j > 0) {
            let h = hdrLines[i].substr(0, j).replace(/\s*$/, "");
            let re = new RegExp("^" + hdrStr + "$", "i");
            if (h.search(re) === 0) {
              foundIndex = 1;
              res = hdrLines[i].substr(j + 1).replace(/^\s*/, "");
              if (!fullHeader) return res;
            }
          }
        }
      }
    }

    return res;
  },


  // API for decryptMessage Listener
  stdin: function(pipe) {
    LOCAL_DEBUG("mimeEncrypt.js: stdin\n");
    if (this.pipeQueue.length > 0) {
      pipe.write(this.pipeQueue);
      this.pipeQueue = "";
      if (this.closePipe) pipe.close();
    }
    this.pipe = pipe;
  },

  stdout: function(s) {
    LOCAL_DEBUG("mimeEncrypt.js: stdout:" + s.length + "\n");
    this.encryptedData += s;
    this.dataLength += s.length;
  },

  stderr: function(s) {
    LOCAL_DEBUG("mimeEncrypt.js: stderr\n");
    this.statusStr += s;
  },

  done: function(exitCode) {
    LOCAL_DEBUG("mimeEncrypt.js: done: " + exitCode + "\n");

    let retStatusObj = {};

    this.exitCode = EnigmailEncryption.encryptMessageEnd(this.enigSecurityInfo.senderEmailAddr,
      this.statusStr,
      exitCode,
      this.enigSecurityInfo.UIFlags,
      this.enigSecurityInfo.sendFlags,
      this.dataLength,
      retStatusObj);

    if (this.exitCode !== 0)
      EnigmailDialog.alert(this.win, retStatusObj.errorMsg);

    if (this.inspector && this.inspector.eventLoopNestLevel > 0) {
      // unblock the waiting lock in finishCryptoEncapsulation
      this.inspector.exitNestedEventLoop();
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
  var matches = nspr_log_modules.match(/mimeEncrypt:(\d+)/);

  if (matches && (matches.length > 1)) {
    gDebugLogLevel = matches[1];
    LOCAL_DEBUG("mimeEncrypt.js: enabled debug logging\n");
  }
}

var NSGetFactory = XPCOMUtils.generateNSGetFactory([PgpMimeEncrypt]);

initModule();
