/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailMimeDecrypt"];

/**
 *  Module for handling PGP/MIME encrypted messages
 *  implemented as an XPCOM object
 */

/*global atob: false */

const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailVerify = ChromeUtils.import("chrome://enigmail/content/modules/mimeVerify.jsm").EnigmailVerify;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailDecryption = ChromeUtils.import("chrome://enigmail/content/modules/decryption.jsm").EnigmailDecryption;
var EnigmailMime = ChromeUtils.import("chrome://enigmail/content/modules/mime.jsm").EnigmailMime;
const EnigmailURIs = ChromeUtils.import("chrome://enigmail/content/modules/uris.jsm").EnigmailURIs;
const EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
const EnigmailSingletons = ChromeUtils.import("chrome://enigmail/content/modules/singletons.jsm").EnigmailSingletons;
const EnigmailHttpProxy = ChromeUtils.import("chrome://enigmail/content/modules/httpProxy.jsm").EnigmailHttpProxy;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://enigmail/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
const EnigmailAutocrypt = ChromeUtils.import("chrome://enigmail/content/modules/autocrypt.jsm").EnigmailAutocrypt;
const EnigmailTb60Compat = ChromeUtils.import("chrome://enigmail/content/modules/tb60compat.jsm").EnigmailTb60Compat;
const EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;
const createVerifyStatus = ChromeUtils.import("chrome://enigmail/content/modules/verifyStatus.jsm").createVerifyStatus;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const PGPMIME_JS_DECRYPTOR_CONTRACTID = "@mozilla.org/mime/pgp-mime-js-decrypt;1";
const PGPMIME_JS_DECRYPTOR_CID = Components.ID("{7514cbeb-2bfd-4b2c-829b-1a4691fa0ac8}");

const ENCODING_DEFAULT = 0;
const ENCODING_BASE64 = 1;
const ENCODING_QP = 2;

const LAST_MSG = EnigmailSingletons.lastDecryptedMessage;

var gDebugLogLevel = 5;

var gNumProc = 0;

var EnigmailMimeDecrypt = {
  /**
   * create a new instance of a PGP/MIME decryption handler
   */
  newPgpMimeHandler: function() {
    return new MimeDecryptHandler();
  },

  /**
   * Return a fake empty attachment with information that the message
   * was not decrypted
   *
   * @return {String}: MIME string (HTML text)
   */
  emptyAttachment: function() {
    EnigmailLog.DEBUG("mimeDecrypt.jsm: emptyAttachment()\n");

    let encPart = EnigmailLocale.getString("mimeDecrypt.encryptedPart.attachmentLabel");
    let concealed = EnigmailLocale.getString("mimeDecrypt.encryptedPart.concealedData");
    let retData =
      `Content-Type: message/rfc822; name="${encPart}.eml"
Content-Transfer-Encoding: 7bit
Content-Disposition: attachment; filename="${encPart}.eml"

Content-Type: text/html

<p><i>${concealed}</i></p>
`;
    return retData;
  },

  /**
   * Wrap the decrypted output into a message/rfc822 attachment
   *
   * @param {String} decryptingMimePartNum: requested MIME part number
   * @param {Object} uri: nsIURI object of the decrypted message
   *
   * @return {String}: prefix for message data
   */
  pretendAttachment: function(decryptingMimePartNum, uri) {
    if (decryptingMimePartNum === "1" || !uri) return "";

    let msg = "";
    let mimePartNumber = EnigmailMime.getMimePartNumber(uri.spec);

    if (mimePartNumber === decryptingMimePartNum + ".1") {
      msg = 'Content-Type: message/rfc822; name="attachment.eml"\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        'Content-Disposition: attachment; filename="attachment.eml"\r\n\r\n';

      try {
        let dbHdr = uri.QueryInterface(Ci.nsIMsgMessageUrl).messageHeader;
        if (dbHdr.subject) msg += `Subject: ${dbHdr.subject}\r\n`;
        if (dbHdr.author) msg += `From: ${dbHdr.author}\r\n`;
        if (dbHdr.recipients) msg += `To: ${dbHdr.recipients}\r\n`;
        if (dbHdr.ccList) msg += `Cc: ${dbHdr.ccList}\r\n`;
      } catch (x) {}
    }

    return msg;
  }
};

////////////////////////////////////////////////////////////////////
// handler for PGP/MIME encrypted messages
// data is processed from libmime -> nsPgpMimeProxy

function MimeDecryptHandler() {

  EnigmailLog.DEBUG("mimeDecrypt.jsm: MimeDecryptHandler()\n"); // always log this one
  this.mimeSvc = null;
  this.initOk = false;
  this.boundary = "";
  this.pipe = null;
  this.closePipe = false;
  this.statusStr = "";
  this.outQueue = "";
  this.dataLength = 0;
  this.bytesWritten = 0;
  this.mimePartCount = 0;
  this.headerMode = 0;
  this.xferEncoding = ENCODING_DEFAULT;
  this.matchedPgpDelimiter = 0;
  this.msgWindow = null;
  this.msgUriSpec = null;
  this.proc = null;
  this.statusDisplayed = false;
  this.uri = null;
  this.backgroundJob = false;
  this.decryptedHeaders = {};
  this.mimePartNumber = "";
  this.dataIsBase64 = null;
  this.base64Cache = "";

  if (EnigmailTb60Compat.isMessageUriInPgpMime()) {
    this.onDataAvailable = this.onDataAvailable68;
  } else {
    this.onDataAvailable = this.onDataAvailable60;
  }
}

MimeDecryptHandler.prototype = {
  inStream: Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),

  onStartRequest: function(request, uri) {
    if (!EnigmailCore.getService()) // Ensure Enigmail is initialized
      return;
    EnigmailLog.DEBUG("mimeDecrypt.jsm: onStartRequest\n"); // always log this one

    ++gNumProc;
    if (gNumProc > EnigmailPrefs.getPref("maxNumProcesses")) {
      EnigmailLog.DEBUG("mimeDecrypt.jsm: number of parallel requests above threshold - ignoring requst\n");
      return;
    }

    this.initOk = true;
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    if ("mimePart" in this.mimeSvc) {
      this.mimePartNumber = this.mimeSvc.mimePart;
    } else {
      this.mimePartNumber = "";
    }

    if ("messageURI" in this.mimeSvc) {
      this.uri = this.mimeSvc.messageURI;
      if (this.uri) {
        EnigmailLog.DEBUG("mimeDecrypt.jsm: onStartRequest: uri='" + this.uri.spec + "'\n");
      }
      else {
        EnigmailLog.DEBUG("mimeDecrypt.jsm: onStartRequest: uri=null\n");
      }
    } else {
      if (uri) {
        this.uri = uri.QueryInterface(Ci.nsIURI);
        EnigmailLog.DEBUG("mimeDecrypt.jsm: onStartRequest: uri='" + this.uri.spec + "'\n");
      }
    }
    this.pipe = null;
    this.closePipe = false;
    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    this.statusDisplayed = false;
    this.dataLength = 0;
    this.mimePartCount = 0;
    this.bytesWritten = 0;
    this.matchedPgpDelimiter = 0;
    this.dataIsBase64 = null;
    this.base64Cache = "";
    this.outQueue = "";
    this.statusStr = "";
    this.headerMode = 0;
    this.decryptedHeaders = {};
    this.xferEncoding = ENCODING_DEFAULT;
    this.boundary = EnigmailMime.getBoundary(this.mimeSvc.contentType);

    if (!this.isReloadingLastMessage()) {
      EnigmailSingletons.clearLastDecryptedMessage();
    }
  },

  processData: function(data) {
    // detect MIME part boundary
    if (data.indexOf(this.boundary) >= 0) {
      LOCAL_DEBUG("mimeDecrypt.jsm: processData: found boundary\n");
      ++this.mimePartCount;
      this.headerMode = 1;
      return;
    }

    // found PGP/MIME "body"
    if (this.mimePartCount == 2) {

      if (this.headerMode == 1) {
        // we are in PGP/MIME main part headers
        if (data.search(/\r|\n/) === 0) {
          // end of Mime-part headers reached
          this.headerMode = 2;
          return;
        } else {
          if (data.search(/^content-transfer-encoding:\s*/i) >= 0) {
            // extract content-transfer-encoding
            data = data.replace(/^content-transfer-encoding:\s*/i, "");
            data = data.replace(/;.*/, "").toLowerCase().trim();
            if (data.search(/base64/i) >= 0) {
              this.xferEncoding = ENCODING_BASE64;
            } else if (data.search(/quoted-printable/i) >= 0) {
              this.xferEncoding = ENCODING_QP;
            }

          }
        }
      } else {
        // PGP/MIME main part body
        if (this.xferEncoding == ENCODING_QP) {
          this.cacheData(EnigmailData.decodeQuotedPrintable(data));
        } else {
          this.cacheData(data);
        }
      }
    }
  },

  /**
   * onDataAvailable for TB <= 66
   */
  onDataAvailable60: function(req, dummy, stream, offset, count) {

    // get data from libmime
    if (!this.initOk) return;
    this.inStream.init(stream);

    if (count > 0) {
      var data = this.inStream.read(count);

      if (this.mimePartCount == 0 && this.dataIsBase64 === null) {
        // try to determine if this could be a base64 encoded message part
        this.dataIsBase64 = this.isBase64Encoding(data);
      }

      if (!this.dataIsBase64) {
        if (data.search(/[\r\n][^\r\n]+[\r\n]/) >= 0) {
          // process multi-line data line by line
          let lines = data.replace(/\r\n/g, "\n").split(/\n/);

          for (let i = 0; i < lines.length; i++) {
            this.processData(lines[i] + "\r\n");
          }
        } else
          this.processData(data);
      } else {
        this.base64Cache += data;
      }
    }
  },

  /**
   * onDataAvailable for TB >= 68
   */
  onDataAvailable68: function(req, stream, offset, count) {

    // get data from libmime
    if (!this.initOk) return;
    this.inStream.init(stream);

    if (count > 0) {
      var data = this.inStream.read(count);

      if (this.mimePartCount == 0 && this.dataIsBase64 === null) {
        // try to determine if this could be a base64 encoded message part
        this.dataIsBase64 = this.isBase64Encoding(data);
      }

      if (!this.dataIsBase64) {
        if (data.search(/[\r\n][^\r\n]+[\r\n]/) >= 0) {
          // process multi-line data line by line
          let lines = data.replace(/\r\n/g, "\n").split(/\n/);

          for (let i = 0; i < lines.length; i++) {
            this.processData(lines[i] + "\r\n");
          }
        } else
          this.processData(data);
      } else {
        this.base64Cache += data;
      }
    }
  },

  /**
   * Try to determine if data is base64 endoded
   */
  isBase64Encoding: function(str) {
    let ret = false;

    str = str.replace(/[\r\n]/, "");
    if (str.search(/^[A-Za-z0-9+/=]+$/) === 0) {
      let excess = str.length % 4;
      str = str.substring(0, str.length - excess);

      try {
        let s = atob(str);
        // if the conversion succeds, we have a base64 encoded message
        ret = true;
      } catch (ex) {
        // not a base64 encoded
      }
    }

    return ret;
  },

  // cache encrypted data for writing to subprocess
  cacheData: function(str) {
    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeDecrypt.jsm: cacheData: " + str.length + "\n");

    this.outQueue += str;
  },

  processBase64Message: function() {
    LOCAL_DEBUG("mimeDecrypt.jsm: processBase64Message\n");

    try {
      this.base64Cache = EnigmailData.decodeBase64(this.base64Cache);
    } catch (ex) {
      // if decoding failed, try non-encoded version
    }

    let lines = this.base64Cache.replace(/\r\n/g, "\n").split(/\n/);

    for (let i = 0; i < lines.length; i++) {
      this.processData(lines[i] + "\r\n");
    }
  },

  /**
   * Determine if we are reloading the same message as the previous one
   *
   * @return Boolean
   */
  isReloadingLastMessage: function() {
    if (!this.uri) return false;
    if (!LAST_MSG.lastMessageURI) return false;
    if (this.isUrlEnigmailConvert()) return false;

    let currMsg = EnigmailURIs.msgIdentificationFromUrl(this.uri);

    if (LAST_MSG.lastMessageURI.folder === currMsg.folder && LAST_MSG.lastMessageURI.msgNum === currMsg.msgNum) {
      return true;
    }

    return false;
  },

  isUrlEnigmailConvert: function() {
    if (!this.uri) return false;

    return (this.uri.spec.search(/[&?]header=enigmailConvert/) >= 0);
  },

  onStopRequest: function(request, status, dummy) {
    LOCAL_DEBUG("mimeDecrypt.jsm: onStopRequest\n");
    --gNumProc;
    if (!this.initOk) return;

    if (this.dataIsBase64) {
      this.processBase64Message();
    }

    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    let currMsg = EnigmailURIs.msgIdentificationFromUrl(this.uri);

    this.backgroundJob = (this.uri && this.uri.spec.search(/[&?]header=(print|quotebody|enigmailConvert)/) >= 0);

    // return if not decrypting currently displayed message (except if
    // printing, replying, etc)
    if (!this.checkShouldDecryptUri(this.uri, this.msgUriSpec)) {
      return;
    }

    let spec = this.uri ? this.uri.spec : null;
    EnigmailLog.DEBUG(`mimeDecrypt.jsm: checking MIME structure for ${this.mimePartNumber} / ${spec}\n`);

    if (!EnigmailMime.isRegularMimeStructure(this.mimePartNumber, spec, false)) {
      if (!this.isUrlEnigmailConvert()) {
        this.returnDataToLibMime(EnigmailMimeDecrypt.emptyAttachment());
      } else {
        throw "mimeDecrypt.jsm: Cannot decrypt messages with mixed (encrypted/non-encrypted) content";
      }
      return;
    }

    if (this.isReloadingLastMessage()) {
      this.decryptedHeaders = LAST_MSG.lastStatus.decryptedHeaders;
      this.mimePartNumber = LAST_MSG.lastStatus.mimePartNumber;
      this.displayStatus(LAST_MSG.lastStatus.verify_status);
      this.returnDataToLibMime(LAST_MSG.lastStatus.decryptedPlaintext);
      return;
    }

    if (this.xferEncoding == ENCODING_BASE64) {
      this.outQueue = EnigmailData.decodeBase64(this.outQueue) + "\n";
    }

    let win = this.msgWindow;

    if (!EnigmailDecryption.isReady(win)) return;

    // discover the pane
    var pane = Cc["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator)
        .getMostRecentWindow("mail:3pane");
    let sender_address = EnigmailDecryption.getFromAddr(pane);

    EnigmailLog.DEBUG(`mimeDecrypt.jsm: starting decryption\n`);

    let pgpBlock = this.outQueue;
    const cApi = EnigmailCryptoAPI();
    let [decryptedPlaintext, verify_status] = cApi.sync((async function() {
      let openpgp_secret_keys = await EnigmailKeyRing.getAllSecretKeys();
      let openpgp_public_key = await EnigmailKeyRing.getPublicKeyByEmail(sender_address);

      let return_status = await cApi.decrypt(pgpBlock, openpgp_secret_keys, openpgp_public_key);
      let verify_status = await createVerifyStatus(return_status.sig_ok, return_status.sig_key_id, sender_address, openpgp_public_key);

      return [return_status.plaintext, verify_status];
    })());

    LOCAL_DEBUG("mimeDecrypt.jsm: decryption ok\n");

    // ensure newline at the end of the stream
    if (!decryptedPlaintext.endsWith("\n")) {
      decryptedPlaintext += "\r\n";
    }

    if (gDebugLogLevel > 4)
      LOCAL_DEBUG("mimeDecrypt.jsm: done'\n");

    // this is async, but we don't have to wait
    this.extractAutocryptGossip(decryptedPlaintext);

    {
      let replacedPlaintext = this.extractEncryptedHeaders(decryptedPlaintext);
      if (replacedPlaintext) decryptedPlaintext = replacedPlaintext;
    }

    {
      let replacedPlaintext = this.maybeAddWrapperToDecryptedResult(decryptedPlaintext);
      if (replacedPlaintext) decryptedPlaintext = replacedPlaintext;
    }

    // HACK: remove filename from 1st HTML and plaintext parts to make TB display message without attachment
    decryptedPlaintext = decryptedPlaintext.replace(/^Content-Disposition: inline; filename="msg.txt"/m, "Content-Disposition: inline");
    decryptedPlaintext = decryptedPlaintext.replace(/^Content-Disposition: inline; filename="msg.html"/m, "Content-Disposition: inline");

    this.displayStatus(verify_status);

    let prefix = EnigmailMimeDecrypt.pretendAttachment(this.mimePartNumber, this.uri);
    this.returnDataToLibMime(prefix + decryptedPlaintext);

    // don't remember the last message if it contains an embedded PGP/MIME message
    // to avoid ending up in a loop
    if (this.mimePartNumber === "1" &&
      decryptedPlaintext.search(/^Content-Type:[\t ]+multipart\/encrypted/mi) < 0) {
      LAST_MSG.lastMessageURI = currMsg;
      LAST_MSG.lastStatus.verify_status = verify_status;
      LAST_MSG.lastStatus.decryptedPlaintext = decryptedPlaintext;
      LAST_MSG.lastStatus.decryptedHeaders = this.decryptedHeaders;
      LAST_MSG.lastStatus.mimePartNumber = this.mimePartNumber;
    } else {
      LAST_MSG.lastMessageURI = null;
    }

    EnigmailLog.DEBUG("mimeDecrypt.jsm: onStopRequest: process terminated\n"); // always log this one
    this.proc = null;
  },

  displayStatus: function(verify_status) {
    EnigmailLog.DEBUG("mimeDecrypt.jsm: displayStatus\n");

    if (this.msgWindow === null || this.statusDisplayed)
      return;

    let uriSpec = (this.uri ? this.uri.spec : null);

    try {
      EnigmailLog.DEBUG("mimeDecrypt.jsm: displayStatus for uri " + uriSpec + "\n");
      let headerSink = EnigmailSingletons.messageReader;

      if (headerSink && this.uri && !this.backgroundJob) {
        headerSink.processDecryptionResult(this.uri, "modifyMessageHeaders", JSON.stringify(this.decryptedHeaders), this.mimePartNumber);

        headerSink.updateSecurityStatus(
          verify_status,
          this.uri,
          this.mimePartNumber);
      } else {
        this.updateHeadersInMsgDb();
      }
      this.statusDisplayed = true;
    } catch (ex) {
      EnigmailLog.writeException("mimeDecrypt.jsm", ex);
    }
    LOCAL_DEBUG("mimeDecrypt.jsm: displayStatus done\n");
  },

  checkShouldDecryptUri: function(uri, msgUriSpec) {
    if (!uri) {
      return true;
    }

    try {
      var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);

      let url = {};
      if (msgUriSpec) {
        let msgSvc = messenger.messageServiceFromURI(msgUriSpec);

        msgSvc.GetUrlForUri(msgUriSpec, url, null);
      }

      if (uri.spec.search(/[&?]header=[^&]+/) > 0 &&
        uri.spec.search(/[&?]examineEncryptedParts=true/) < 0) {

        if (uri.spec.search(/[&?]header=(filter|enigmailFilter)(&.*)?$/) > 0) {
          EnigmailLog.DEBUG("mimeDecrypt.jsm: onStopRequest: detected incoming message processing\n");
          return false;
        }
      }

      if (uri.spec.search(/[&?]header=[^&]+/) < 0 &&
        uri.spec.search(/[&?]part=[.0-9]+/) < 0 &&
        uri.spec.search(/[&?]examineEncryptedParts=true/) < 0) {

        if (uri && url && url.value) {

          if ("path" in url) {
            // TB < 57
            if (url.value.host !== uri.host ||
              url.value.path !== uri.path)
              return false;
          } else {
            // TB >= 57
            if (url.value.host !== uri.host ||
              url.value.pathQueryRef !== uri.pathQueryRef)
              return false;
          }
        }
      }
    } catch (ex) {
      EnigmailLog.writeException("mimeDecrypt.js", ex);
      EnigmailLog.DEBUG("mimeDecrypt.jsm: error while processing " + msgUriSpec + "\n");
    }

    return true;
  },

  maybeAddWrapperToDecryptedResult: function(decryptedPlaintext) {
    let i = decryptedPlaintext.search(/\n\r?\n/);
    if (!i) {
      return null;
    }

    var hdr = decryptedPlaintext.substr(0, i).split(/\r?\n/);
    for (let j = 0; j < hdr.length; j++) {
      if (hdr[j].search(/^\s*content-type:\s+text\/(plain|html)/i) >= 0) {
        continue;
      }

      LOCAL_DEBUG("mimeDecrypt.jsm: done: adding multipart/mixed around " + hdr[j] + "\n");
      if (!this.isUrlEnigmailConvert()) {
        let wrapper = EnigmailMime.createBoundary();

        return 'Content-Type: multipart/mixed; boundary="' + wrapper + '"\r\n' +
          'Content-Disposition: inline\r\n\r\n' +
          '--' + wrapper + '\r\n' +
          decryptedPlaintext + '\r\n' +
          '--' + wrapper + '--\r\n';
      }
    }
    return null;
  },

  extractContentType: function(data) {
    let i = data.search(/\n\r?\n/);
    if (i <= 0) return null;

    let headers = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    headers.initialize(data.substr(0, i));
    return headers.extractHeader("content-type", false);
  },

  // return data to libMime
  returnDataToLibMime: function(data) {
    EnigmailLog.DEBUG("mimeDecrypt.jsm: returnDataToLibMime: " + data.length + " bytes\n");

    let proto = null;
    let ct = this.extractContentType(data);
    if (ct && ct.search(/multipart\/signed/i) >= 0) {
      proto = EnigmailMime.getProtocol(ct);
    }

    try {
      if (proto && proto.search(/application\/(pgp|pkcs7|x-pkcs7)-signature/i) >= 0) {
        EnigmailLog.DEBUG("mimeDecrypt.jsm: returnDataToLibMime: using direct verification\n");
        this.mimeSvc.contentType = ct;
        if ("mimePart" in this.mimeSvc) {
          this.mimeSvc.mimePart = this.mimeSvc.mimePart + ".1";
        }
        let veri = EnigmailVerify.newVerifier(proto);
        veri.onStartRequest(this.mimeSvc, this.uri);
        veri.onTextData(data);
        veri.onStopRequest(null, 0);
      } else {
        if ("outputDecryptedData" in this.mimeSvc) {
          // TB >= 57
          this.mimeSvc.outputDecryptedData(data, data.length);
        } else {
          let gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
          gConv.setData(data, data.length);
          this.mimeSvc.onStartRequest(null, null);
          this.mimeSvc.onDataAvailable(null, null, gConv, 0, data.length);
          this.mimeSvc.onStopRequest(null, null, 0);
        }
      }
    } catch (ex) {
      EnigmailLog.ERROR("mimeDecrypt.jsm: returnDataToLibMime(): mimeSvc.onDataAvailable failed:\n" + ex.toString());
    }
  },

  updateHeadersInMsgDb: function() {
    if (this.mimePartNumber !== "1") return;
    if (!this.uri) return;

    if (this.decryptedHeaders && ("subject" in this.decryptedHeaders)) {
      try {
        let msgDbHdr = this.uri.QueryInterface(Ci.nsIMsgMessageUrl).messageHeader;
        msgDbHdr.subject = EnigmailData.convertFromUnicode(this.decryptedHeaders.subject, "utf-8");
      } catch (x) {}
    }
  },

  extractEncryptedHeaders: function(decryptedPlaintext) {
    try {
      let r = EnigmailMime.extractProtectedHeaders(decryptedPlaintext);
      if (!r) return null;

      this.decryptedHeaders = r.newHeaders;
      if (r.startPos >= 0 && r.endPos > r.startPos) {
        return decryptedPlaintext.substr(0, r.startPos) + decryptedPlaintext.substr(r.endPos);
      }
    } catch (ex) {
      EnigmailLog.DEBUG(`mimeDecrypt.jsm: extractEncryptedHeaders: Error: ${ex}\n`);
    }
    return null;
  },

  extractAutocryptGossip: async function(decryptedPlaintext) {
    try {
      let m = decryptedPlaintext.search(/^--/m);

      let hdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
      hdr.initialize(decryptedPlaintext.substr(0, m));

      let gossip = hdr.getHeader("autocrypt-gossip") || [];
      EnigmailLog.DEBUG(`mimeDecrypt.jsm: extractAutocryptGossip: found ${gossip.length} headers\n`);

      let msgDate = null;
      try {
        msgDate = this.uri.QueryInterface(Ci.nsIMsgMessageUrl).messageHeader.dateInSeconds;
      } catch (x) {}

      await EnigmailAutocrypt.processAutocryptGossipHeaders(gossip, msgDate);
    } catch (ex) {
      EnigmailLog.DEBUG(`mimeDecrypt.jsm: extractAutocryptGossip: Error: ${ex}\n`);
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
  var matches = nspr_log_modules.match(/mimeDecrypt:(\d+)/);

  if (matches && (matches.length > 1)) {
    gDebugLogLevel = matches[1];
  }
}

// Note: cache should not be re-used by repeated calls to JSON.stringify.
function stringify(o) {
  const cache = [];
  return JSON.stringify(o, function(key, value) {
      if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
              // Duplicate reference found, discard key
              return undefined;
          }
          // Store value in our collection
          cache.push(value);
      }
      return value;
  });
}
