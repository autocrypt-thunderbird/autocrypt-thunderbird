/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for creating PGP/MIME signed and/or encrypted messages
 *  implemented as XPCOM component
 */

var EXPORTED_SYMBOLS = ["EnigmailMimeEncrypt"];

const Cr = Components.results;

const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const EnigmailTb60Compat = ChromeUtils.import("chrome://autocrypt/content/modules/tb60compat.jsm").EnigmailTb60Compat;
const EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").EnigmailDialog;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailEncryption = ChromeUtils.import("chrome://autocrypt/content/modules/encryption.jsm").EnigmailEncryption;
const EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
const EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
const EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
const EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;

// our own contract IDs
const PGPMIME_ENCRYPT_CID = Components.ID("{96fe88f9-d2cd-466f-93e0-3a351df4c6d2}");
const PGPMIME_ENCRYPT_CONTRACTID = "@enigmail.net/compose/mimeencrypt;1";

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const maxBufferLen = 102400;

var gDebugLogLevel = 3;

function PgpMimeEncrypt() {
  this.wrappedJSObject = this;

  // "securityInfo" variables
  this.sendFlags = 0;
  this.fromAddr = "";
  this.toAddrs = "";
  this.bccAddrs = "";
  this.senderEmailAddr = "";
  this.recipients = "";
  this.bccRecipients = "";
  this.originalSubject = null;
  this.keyMap = {};

  if (EnigmailTb60Compat.isMessageUriInPgpMime()) {
    this.onDataAvailable = this.onDataAvailable68;
  } else {
    this.onDataAvailable = this.onDataAvailable60;
  }
}

PgpMimeEncrypt.prototype = {
  classDescription: "Enigmail JS Encryption Handler",
  classID: PGPMIME_ENCRYPT_CID,
  get contractID() {
    return PGPMIME_ENCRYPT_CONTRACTID;
  },
  QueryInterface: EnigmailTb60Compat.generateQI([
    "nsIMsgComposeSecure",
    "nsIStreamListener",
    "nsIMsgSMIMECompFields" // TB < 64
  ]),

  signMessage: false,
  requireEncryptMessage: false,

  // private variables

  inStream: Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),
  msgCompFields: null,
  outStringStream: null,

  // 0: processing headers
  // 1: processing body
  // 2: skipping header
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

  // nsIStreamListener interface
  onStartRequest: function(request) {
    EnigmailLog.DEBUG("mimeEncrypt.js: onStartRequest\n");
    this.encHeader = null;
  },

  /**
   * onDataAvailable for TB <= 66
   */
  onDataAvailable60: function(req, ctxt, stream, offset, count) {
    LOCAL_DEBUG("mimeEncrypt.js: onDataAvailable\n");
    this.inStream.init(stream);
    var data = this.inStream.read(count);
    //LOCAL_DEBUG("mimeEncrypt.js: >"+data+"<\n");

  },

  /**
   * onDataAvailable for TB >= 67
   */
  onDataAvailable68: function(req, stream, offset, count) {
    LOCAL_DEBUG("mimeEncrypt.js: onDataAvailable\n");
    this.inStream.init(stream);
    var data = this.inStream.read(count);
    //LOCAL_DEBUG("mimeEncrypt.js: >"+data+"<\n");

  },

  onStopRequest: function(request, status) {
    EnigmailLog.DEBUG("mimeEncrypt.js: onStopRequest\n");
  },

  // nsIMsgComposeSecure interface
  requiresCryptoEncapsulation: function(msgIdentity, msgCompFields) {
    let result = this.composeCryptoState && this.composeCryptoState.isEncryptEnabled();
    // (EnigmailConstants.SEND_SIGNED |
    // EnigmailConstants.SEND_ENCRYPTED |
    // EnigmailConstants.SEND_VERBATIM)) !== 0;
    EnigmailLog.DEBUG(`mimeEncrypt.js: requiresCryptoEncapsulation: ${result}\n`);
    return result;
  },

  beginCryptoEncapsulation: function(outStream, recipientList, msgCompFields, msgIdentity, sendReport, isDraft) {
    EnigmailLog.DEBUG("mimeEncrypt.js: beginCryptoEncapsulation\n");

    if (!outStream) throw Cr.NS_ERROR_NULL_POINTER;

    try {

      this.outStream = outStream;
      this.isDraft = isDraft;

      this.msgCompFields = msgCompFields;
      this.outStringStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);

      var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      this.win = windowManager.getMostRecentWindow(null);

      if (this.composeCryptoState.isEnableSendVerbatim) {
        this.recipientList = recipientList;
        this.msgIdentity = msgIdentity;
        this.msgCompFields = msgCompFields;
        this.inputMode = 2;
        return null;
      }

      if (this.composeCryptoState.isEncryptEnabled() &&
        this.composeCryptoState.isEnablePgpInline) {
          throw Cr.NS_ERROR_NOT_IMPLEMENTED;
      }

      this.cryptoBoundary = EnigmailMime.createBoundary();
      this.startCryptoHeaders();

    }
    catch (ex) {
      EnigmailLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }

    return null;
  },

  startCryptoHeaders: function() {
    EnigmailLog.DEBUG("mimeEncrypt.js: startCryptoHeaders\n");

    this.encryptedHeaders();
    this.writeSecureHeaders();
  },

  writeSecureHeaders: function() {
    this.encHeader = EnigmailMime.createBoundary();

    let allHdr = "";

    let addrParser = jsmime.headerparser.parseAddressingHeader;
    let newsParser = function(s) {
      return jsmime.headerparser.parseStructuredHeader("Newsgroups", s);
    };
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
        parser: newsParser
      },
      followupTo: {
        field: "Followup-To",
        parser: addrParser
      },
      messageId: {
        field: "Message-Id",
        parser: noParser
      },
      subject: {
        field: "Subject",
        parser: noParser
      }
    };

    for (let i in h) {
      if (this.msgCompFields[i] && this.msgCompFields[i].length > 0) {
        allHdr += jsmime.headeremitter.emitStructuredHeader(h[i].field, h[i].parser(this.msgCompFields[i]), {});
      }
    }

    // special handling for references and in-reply-to

    if (this.originalReferences && this.originalReferences.length > 0) {
      allHdr += jsmime.headeremitter.emitStructuredHeader("references", this.originalReferences, {});

      let bracket = this.originalReferences.lastIndexOf("<");
      if (bracket >= 0) {
        allHdr += jsmime.headeremitter.emitStructuredHeader("in-reply-to", this.originalReferences.substr(bracket), {});
      }
    }

    let w = 'Content-Type: multipart/mixed; boundary="' + this.encHeader + '";\r\n' +
      ' protected-headers="v1"\r\n' +
      allHdr +
      this.getAutocryptGossip() + '\r\n' +
      "--" + this.encHeader + "\r\n";

    this.writeToPipe(w);
  },

  getAutocryptGossip: function() {
    // TODO
    return '';
    /*
    let gossip = "";
    if (this.msgCompFields.hasHeader("autocrypt") &&
      this.keyMap &&
      EnigmailFuncs.getNumberOfRecipients(this.msgCompFields) > 1) {
      for (let email in this.keyMap) {
        let keyObj = EnigmailKeyRing.getKeyById(this.keyMap[email]);
        if (keyObj) {
          let k = keyObj.getMinimalPubKey(email);
          if (k.exitCode === 0) {
            let keyData = " " + k.keyData.replace(/(.{72})/g, "$1\r\n ").replace(/\r\n $/, "");
            gossip += 'Autocrypt-Gossip: addr=' + email + '; keydata=\r\n' + keyData + "\r\n";
          }
        }
      }
    }

    return gossip;
    */
  },

  encryptedHeaders: function(isEightBit) {
    EnigmailLog.DEBUG("mimeEncrypt.js: encryptedHeaders\n");
    let subj = "";

    if (this.composeCryptoState.isEnableProtectedHeaders) {
      subj = jsmime.headeremitter.emitStructuredHeader("subject", EnigmailFuncs.getProtectedSubjectText(), {});
    }

    this.writeOut(subj +
      "Content-Type: multipart/encrypted;\r\n" +
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
    EnigmailLog.DEBUG("mimeEncrypt.js: finishCryptoHeaders\n");

    this.writeOut("\r\n--" + this.cryptoBoundary + "--\r\n");
  },

  finishCryptoEncapsulation: function(abort, sendReport) {
    EnigmailLog.DEBUG("mimeEncrypt.js: finishCryptoEncapsulation\n");

    if (this.composeCryptoState.isEnableSendVerbatim) {
      this.flushOutput();
      return;
    }

    try {
      if (this.encapsulate) this.writeToPipe("--" + this.encapsulate + "--\r\n");

      if (this.encHeader) {
        this.writeToPipe("\r\n--" + this.encHeader + "--\r\n");
      }

      let plaintext = this.pipeQueue;
      this.pipeQueue = "";

      const cApi = EnigmailCryptoAPI();
      this.encryptedData = cApi.sync(this.signAndEncrypt(this.fromAddr, this.toAddrs, plaintext));
      if (this.encryptedData == "" || !this.encryptedData) throw Cr.NS_ERROR_FAILURE;

      LOCAL_DEBUG("mimeEncrypt.js: finishCryptoEncapsulation " + this.encryptedData + "\n");

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

  signAndEncrypt: async function(fromAddr, toAddrs, plaintext) {
    let openPgpSecretKey = await this.selectPrivKey(fromAddr);
    let openPgpPubKeys = await this.selectPubKeys(toAddrs);
    return await EnigmailEncryption.encryptMessage(plaintext, openPgpSecretKey, openPgpPubKeys);
  },

  selectPrivKey: async function(fromAddr) {
    return (await EnigmailKeyRing.getAllSecretKeys())[0];
  },

  selectPubKeys: async function(toAddrList, bccAddrList) {
    EnigmailLog.DEBUG("=====> keySelection()\n");
    EnigmailLog.DEBUG("mimeEncrypt.js: Enigmail.msg.keySelection()\n");

    // NOTE: If we only have bcc addresses, we currently do NOT process rules and select keys at all
    //       This is GOOD because sending keys for bcc addresses makes bcc addresses visible
    //       (thus compromising the concept of bcc)
    //       THUS, we disable encryption even though all bcc receivers might want to have it encrypted.
    if (toAddrList.length === 0) {
      EnigmailLog.DEBUG("mimeEncrypt.js: Enigmail.msg.keySelection(): skip key selection because we neither have \"to\" nor \"cc\" addresses\n");

      // TODO deal with bcc only
      return [];
    }

    let openpgp_keys_map = await EnigmailKeyRing.getAllPublicKeysMap();
    let recommendations = await EnigmailAutocrypt.determineAutocryptRecommendations(toAddrList);
    // EnigmailLog.DEBUG(`mimeEncrypt.js: Enigmail.msg.keySelection(): ${JSON.stringify(recommendations)} \n`);

    let selected_openpgp_keys = recommendations.peers
      .map(peer => openpgp_keys_map[peer.fpr_primary])
      .filter(x => x);

    EnigmailLog.DEBUG(`mimeEncrypt.js: Enigmail.msg.keySelection(): returning ${selected_openpgp_keys.length} keys\n`);
    return selected_openpgp_keys;
  },

  mimeCryptoWriteBlock: function(buffer, length) {
    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeEncrypt.js: mimeCryptoWriteBlock: " + length + "\n");

    try {
      let line = buffer.substr(0, length);
      if (this.inputMode === 0) {
        if (this.composeCryptoState.isEnableSendVerbatim) {
          line = EnigmailData.decodeQuotedPrintable(line.replace("=\r\n", ""));
        }

        if (!this.composeCryptoState.isEnableSendVerbatim ||
          line.match(/^(From|To|Subject|Message-ID|Date|User-Agent|MIME-Version):/i) === null) {
          this.headerData += line;
        }

        if (line.replace(/[\r\n]/g, "").length === 0) {
          this.inputMode = 1;

          if (!this.encHeader) {
            let ct = this.getHeader("content-type", false);
            if ((ct.search(/text\/plain/i) === 0) || (ct.search(/text\/html/i) === 0)) {
              this.encapsulate = EnigmailMime.createBoundary();
              this.writeToPipe('Content-Type: multipart/mixed; boundary="' +
                this.encapsulate + '"\r\n\r\n');
              this.writeToPipe("--" + this.encapsulate + "\r\n");
            }
          }

          this.writeToPipe(this.headerData);
          if (this.composeCryptoState.isEnableSendVerbatim) {
            this.writeOut(this.headerData);
          }
        }

      }
      else if (this.inputMode == 1) {
        this.writeToPipe(line);
        if (this.composeCryptoState.isEnableSendVerbatim) {
          this.writeOut(EnigmailData.decodeQuotedPrintable(line.replace("=\r\n", "")));
        }
      }
      else if (this.inputMode == 2) {
        if (line.replace(/[\r\n]/g, "").length === 0) {
          this.inputMode = 0;
        }
      }
    }
    catch (ex) {
      EnigmailLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }

    return null;
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

    this.pipeQueue += str;
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

var EnigmailMimeEncrypt = {
  Handler: PgpMimeEncrypt,

  startup: function(reason) {
    initModule();
  },
  shutdown: function(reason) {},

  createMimeEncrypt: function(sMimeSecurityInfo) {
    return new PgpMimeEncrypt();
  },

  isEnigmailCompField: function(obj) {
    return obj instanceof PgpMimeEncrypt;
  }
};
