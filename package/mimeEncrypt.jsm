/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for creating PGP/MIME signed and/or encrypted messages
 *  implemented as XPCOM component
 */

var EXPORTED_SYMBOLS = ["AutocryptMimeEncrypt"];

const Cr = Components.results;

const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const AutocryptTb60Compat = ChromeUtils.import("chrome://autocrypt/content/modules/tb60compat.jsm").AutocryptTb60Compat;
const AutocryptFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").AutocryptFuncs;
const AutocryptDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").AutocryptDialog;
const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptEncryption = ChromeUtils.import("chrome://autocrypt/content/modules/encryption.jsm").AutocryptEncryption;
const AutocryptMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").AutocryptMime;
const AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;
const AutocryptConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").AutocryptConstants;
const AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
const AutocryptCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").AutocryptCryptoAPI;
const AutocryptAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").AutocryptAutocrypt;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").AutocryptSqliteDb;
const AutocryptKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").AutocryptKeyRing;

// our own contract IDs
const PGPMIME_ENCRYPT_CID = Components.ID("{96fe88f9-d2cd-466f-93e0-3a351df4c6d2}");
const PGPMIME_ENCRYPT_CONTRACTID = "@enigmail.net/compose/mimeencrypt;1";

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const maxBufferLen = 102400;

function PgpMimeEncrypt() {
  this.wrappedJSObject = this;

  // "securityInfo" variables
  this.composeCryptoState = null;
  this.originalSubject = null;
}

PgpMimeEncrypt.prototype = {
  classDescription: "Autocrypt PGP/MIME Encryption Handler",
  classID: PGPMIME_ENCRYPT_CID,
  get contractID() {
    return PGPMIME_ENCRYPT_CONTRACTID;
  },
  QueryInterface: AutocryptTb60Compat.generateQI([
    "nsIMsgComposeSecure",
    "nsIStreamListener",
    "nsIMsgSMIMECompFields" // TB < 64
  ]),

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
  encryptedData: "",
  hashAlgorithm: null,
  pipeQueue: "",
  outQueue: "",

  // nsIStreamListener interface
  onStartRequest: function(request) {
    AutocryptLog.DEBUG("mimeEncrypt.js: onStartRequest\n");
    this.encHeader = null;
  },

  onDataAvailable: function(req, stream, offset, count) {
    LOCAL_DEBUG("mimeEncrypt.js: onDataAvailable\n");
    this.inStream.init(stream);
    this.inStream.read(count);
  },

  onStopRequest: function(request, status) {
    AutocryptLog.DEBUG("mimeEncrypt.js: onStopRequest\n");
  },

  // nsIMsgComposeSecure interface
  requiresCryptoEncapsulation: function(msgIdentity, msgCompFields) {
    let result = this.composeCryptoState && this.composeCryptoState.isEncryptEnabled();
    if (this.composeCryptoState.isEncryptError()) {
      AutocryptLog.DEBUG(`mimeEncrypt.js: requiresCryptoEncapsulation: error - can't encrypt!\n`);
      throw Cr.NS_ERROR_FAILURE;
    }
    AutocryptLog.DEBUG(`mimeEncrypt.js: requiresCryptoEncapsulation: ${result}\n`);
    return result;
  },

  beginCryptoEncapsulation: function(outStream, recipientList, msgCompFields, msgIdentity, sendReport, isDraft) {
    AutocryptLog.DEBUG("mimeEncrypt.js: beginCryptoEncapsulation\n");

    if (!outStream) {
      throw Cr.NS_ERROR_NULL_POINTER;
    }

    try {

      this.outStream = outStream;
      this.isDraft = isDraft;

      this.msgCompFields = msgCompFields;
      this.outStringStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);

      if (this.composeCryptoState.isEncryptEnabled() &&
        this.composeCryptoState.isEnablePgpInline) {
          throw Cr.NS_ERROR_NOT_IMPLEMENTED;
      }

      this.cryptoBoundary = AutocryptMime.createBoundary();
      this.startCryptoHeaders();

    }
    catch (ex) {
      AutocryptLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }

    return null;
  },

  startCryptoHeaders: function() {
    AutocryptLog.DEBUG("mimeEncrypt.js: startCryptoHeaders\n");

    this.encryptedHeaders();
    this.writeSecureHeaders();
  },

  writeSecureHeaders: function() {
    this.encHeader = AutocryptMime.createBoundary();

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
    const recipients = Object.keys(this.composeCryptoState.currentAutocryptRecommendation.peers);
    if (recipients < 2) {
      AutocryptLog.DEBUG("mimeEncrypt.js: getAutocryptGossip(): only one recipient, skipping gossip\n");
      return '';
    }

    const cApi = AutocryptCryptoAPI();
    return cApi.sync((async function() {
      let result = '';
      for (let email of recipients) {
        AutocryptLog.DEBUG(`mimeEncrypt.js: getAutocryptGossip(): adding gossip for ${email}\n`);
        let gossip_header = await AutocryptAutocrypt.getAutocryptHeaderContentFor(email, false);
        if (gossip_header) {
          result += `Autocrypt-Gossip: ${gossip_header}\r\n`;
        }
      }
      return result;
    })());
  },

  encryptedHeaders: function(isEightBit) {
    AutocryptLog.DEBUG("mimeEncrypt.js: encryptedHeaders\n");
    let subj = "";

    if (this.composeCryptoState.isEnableProtectedHeaders) {
      subj = jsmime.headeremitter.emitStructuredHeader("subject", AutocryptFuncs.getProtectedSubjectText(), {});
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
    AutocryptLog.DEBUG("mimeEncrypt.js: finishCryptoHeaders\n");

    this.writeOut("\r\n--" + this.cryptoBoundary + "--\r\n");
  },

  finishCryptoEncapsulation: function(abort, sendReport) {
    AutocryptLog.DEBUG("mimeEncrypt.js: finishCryptoEncapsulation\n");

    try {
      if (this.encapsulate) this.writeToPipe("--" + this.encapsulate + "--\r\n");

      if (this.encHeader) {
        this.writeToPipe("\r\n--" + this.encHeader + "--\r\n");
      }

      let plaintext = this.pipeQueue;
      this.pipeQueue = "";

      const cApi = AutocryptCryptoAPI();
      this.encryptedData = cApi.sync(this.signAndEncrypt(plaintext));
      if (!this.encryptedData || this.encryptedData == "") {
        AutocryptLog.ERROR("mimeEncrypt.js: finishCryptoEncapsulation(): failed to encrypt!\n");
        throw Cr.NS_ERROR_FAILURE;
      }

      this.encryptedData = this.encryptedData.replace(/\r/g, "").replace(/\n/g, "\r\n"); // force CRLF
      this.writeOut(this.encryptedData);
      this.finishCryptoHeaders();
      this.flushOutput();
    }
    catch (ex) {
      AutocryptLog.writeException("mimeEncrypt.js", ex);
      throw ex;
    }
  },

  signAndEncrypt: async function(plaintext) {
    const openPgpSecretKey = await this.selectPrivKey();
    const openPgpPubKeys = await this.selectPubKeys();
    return await AutocryptEncryption.encryptMessage(plaintext, openPgpSecretKey, openPgpPubKeys);
  },

  selectPrivKey: async function() {
    if (!this.composeCryptoState.senderAutocryptSettings) {
      AutocryptLog.ERROR("mimeEncrypt.js: selectPrivKey(): missing sender autocrypt settings\n");
      throw Cr.NS_ERROR_FAILURE;
    }
    if (!this.composeCryptoState.senderAutocryptSettings.fpr_primary) {
      AutocryptLog.ERROR("mimeEncrypt.js: selectPrivKey(): bad autocrypt sender settings\n");
      throw Cr.NS_ERROR_FAILURE;
    }
    const sender_fpr_primary = this.composeCryptoState.senderAutocryptSettings.fpr_primary;
    AutocryptLog.DEBUG(`mimeEncrypt.js: selectPrivKey(): sender fpr: ${sender_fpr_primary}\n`);

    const openpgp_secret_key = await AutocryptKeyRing.getSecretKeyByFingerprint(sender_fpr_primary);
    if (!openpgp_secret_key) {
      AutocryptLog.ERROR(`mimeEncrypt.js: selectPrivKey(): no secret key!\n`);
      throw Cr.NS_ERROR_FAILURE;
    }
    return openpgp_secret_key;
  },

  selectPubKeys: async function() {
    AutocryptLog.DEBUG("mimeEncrypt.js: selectPubKeys()\n");

    if (!this.composeCryptoState.currentAutocryptRecommendation) {
      AutocryptLog.ERROR(`mimeEncrypt.js: selectPubKeys(): missing recipient autocrypt recommendations\n`);
      throw Cr.NS_ERROR_FAILURE;
    }

    const openpgp_keys_map = await AutocryptKeyRing.getAllPublicKeysMap();
    const recommendations = this.composeCryptoState.currentAutocryptRecommendation;

    const selected_openpgp_keys = [];
    for (let email in recommendations.peers) {
      let r = recommendations.peers[email];
      if (!r.fpr_primary || !(r.fpr_primary in openpgp_keys_map)) {
        AutocryptLog.ERROR(`mimeEncrypt.js: selectPubKeys(): missing public key from recommendation\n`);
        throw Cr.NS_ERROR_FAILURE;
      }
      let key = openpgp_keys_map[r.fpr_primary];
      selected_openpgp_keys.push(key);
    }

    if (!selected_openpgp_keys.length) {
      AutocryptLog.ERROR(`mimeEncrypt.js: selectPubKeys(): no recipients!\n`);
      throw Cr.NS_ERROR_FAILURE;
    }

    AutocryptLog.DEBUG(`mimeEncrypt.js: selectPubKeys(): returning ${selected_openpgp_keys.length} keys\n`);
    return selected_openpgp_keys;
  },

  mimeCryptoWriteBlock: function(buffer, length) {
    try {
      let line = buffer.substr(0, length);
      if (this.inputMode === 0) {
        this.headerData += line;

        if (line.replace(/[\r\n]/g, "").length === 0) {
          this.inputMode = 1;

          if (!this.encHeader) {
            let ct = this.getHeader("content-type", false);
            if ((ct.search(/text\/plain/i) === 0) || (ct.search(/text\/html/i) === 0)) {
              this.encapsulate = AutocryptMime.createBoundary();
              this.writeToPipe('Content-Type: multipart/mixed; boundary="' +
                this.encapsulate + '"\r\n\r\n');
              this.writeToPipe("--" + this.encapsulate + "\r\n");
            }
          }

          this.writeToPipe(this.headerData);
        }

      } else if (this.inputMode == 1) {
        this.writeToPipe(line);
      } else if (this.inputMode == 2) {
        if (line.replace(/[\r\n]/g, "").length === 0) {
          this.inputMode = 0;
        }
      }
    } catch (ex) {
      AutocryptLog.writeException("mimeEncrypt.js", ex);
      throw (ex);
    }

    return null;
  },

  writeOut: function(str) {
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
  AutocryptLog.DEBUG(str);
}

var AutocryptMimeEncrypt = {
  Handler: PgpMimeEncrypt,

  startup: function(reason) {},
  shutdown: function(reason) {},

  createMimeEncrypt: function(sMimeSecurityInfo) {
    return new PgpMimeEncrypt();
  },

  isAutocryptCompField: function(obj) {
    return obj instanceof PgpMimeEncrypt;
  }
};
