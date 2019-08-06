/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailVerify"];

/**
 *  Module for handling PGP/MIME signed messages
 *  implemented as JS module
 */

const EnigmailTb60Compat = ChromeUtils.import("chrome://autocrypt/content/modules/tb60compat.jsm").EnigmailTb60Compat;
const EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").EnigmailFiles;
const EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
const EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
const EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailDecryption = ChromeUtils.import("chrome://autocrypt/content/modules/decryption.jsm").EnigmailDecryption;
const EnigmailSingletons = ChromeUtils.import("chrome://autocrypt/content/modules/singletons.jsm").EnigmailSingletons;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
const AutocryptHelper = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptHelper.jsm").AutocryptHelper;
const MessageCryptoStatus = ChromeUtils.import("chrome://autocrypt/content/modules/verifyStatus.jsm").MessageCryptoStatus;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const PGPMIME_PROTO = "application/pgp-signature";

const maxBufferLen = 102400;

var gDebugLog = false;

// MimeVerify Constructor
function MimeVerify(protocol) {
  if (!protocol) {
    protocol = PGPMIME_PROTO;
  }

  this.protocol = protocol;
  this.verifyEmbedded = false;
  this.partiallySigned = false;
  this.inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);

  if (EnigmailTb60Compat.isMessageUriInPgpMime()) {
    this.onDataAvailable = this.onDataAvailable68;
  } else {
    this.onDataAvailable = this.onDataAvailable60;
  }
}


var EnigmailVerify = {
  lastMsgWindow: null,
  lastMsgUri: null,
  folderDisplay: null,
  manualMsgUri: null,

  currentCtHandler: EnigmailConstants.MIME_HANDLER_UNDEF,

  setMsgWindow: function(msgWindow, folderDisplay, msgUriSpec) {
    LOCAL_DEBUG("mimeVerify.jsm: setMsgWindow: " + msgUriSpec + "\n");

    this.lastMsgWindow = msgWindow;
    this.lastMsgUri = msgUriSpec;
    this.folderDisplay = folderDisplay;
  },

  newVerifier: function(protocol) {
    EnigmailLog.DEBUG("mimeVerify.jsm: newVerifier: " + (protocol || "null") + "\n");

    let v = new MimeVerify(protocol);
    return v;
  },

  /***
   * register a PGP/MIME verify object the same way PGP/MIME encrypted mail is handled
   */
  registerContentTypeHandler: function() {
    EnigmailLog.DEBUG("mimeVerify.jsm: registerContentTypeHandler\n");
    let reg = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

    let pgpMimeClass = Components.classes["@mozilla.org/mimecth;1?type=multipart/encrypted"];

    reg.registerFactory(
      pgpMimeClass,
      "Enigmail PGP/MIME verification",
      "@mozilla.org/mimecth;1?type=multipart/signed",
      null);
    this.currentCtHandler = EnigmailConstants.MIME_HANDLER_PGPMIME;
  },

  unregisterContentTypeHandler: function() {
    EnigmailLog.DEBUG("mimeVerify.jsm: unregisterContentTypeHandler\n");
    let reg = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

    let sMimeClass = Components.classes["@mozilla.org/nsCMSDecoder;1"];
    reg.registerFactory(sMimeClass, "S/MIME verification", "@mozilla.org/mimecth;1?type=multipart/signed", null);
    this.currentCtHandler = EnigmailConstants.MIME_HANDLER_SMIME;
  }

};


// MimeVerify implementation
// verify the signature of PGP/MIME signed messages
MimeVerify.prototype = {
  dataCount: 0,
  foundMsg: false,
  startMsgStr: "",
  msgWindow: null,
  msgUriSpec: null,
  statusDisplayed: false,
  window: null,
  inStream: null,
  sigData: "",
  mimePartNumber: "",

  QueryInterface: EnigmailTb60Compat.generateQI([Ci.nsIStreamListener]),

  startStreaming: function(window, msgWindow, msgUriSpec) {
    LOCAL_DEBUG("mimeVerify.jsm: startStreaming\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
    this.window = window;
    var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
    var msgSvc = messenger.messageServiceFromURI(this.msgUriSpec);

    msgSvc.streamMessage(this.msgUriSpec,
      this,
      this.msgWindow,
      null,
      false,
      null,
      false);
  },

  verifyData: function(window, msgWindow, msgUriSpec, data) {
    LOCAL_DEBUG("mimeVerify.jsm: streamFromChannel\n");

    this.msgWindow = msgWindow;
    this.msgUriSpec = msgUriSpec;
    this.window = window;
    this.onStartRequest();
    this.onTextData(data);
    this.onStopRequest();
  },

  parseContentType: function() {
    let contentTypeLine = this.mimeSvc.contentType;

    // Eat up CRLF's.
    contentTypeLine = contentTypeLine.replace(/[\r\n]/g, "");
    EnigmailLog.DEBUG("mimeVerify.jsm: parseContentType: " + contentTypeLine + "\n");

    let protoRx = RegExp("protocol\\s*=\\s*[\\'\\\"]" + this.protocol + "[\\\"\\']", "i");

    if (contentTypeLine.search(/multipart\/signed/i) >= 0 &&
      contentTypeLine.search(protoRx) > 0) {

      EnigmailLog.DEBUG("mimeVerify.jsm: parseContentType: found MIME signed message\n");
      this.foundMsg = true;
      let hdr = EnigmailFuncs.getHeaderData(contentTypeLine);
      hdr.boundary = hdr.boundary || "";
      hdr.micalg = hdr.micalg || "";
      this.boundary = hdr.boundary.replace(/['"]/g, "");
    }
  },

  onStartRequest: function(request, uri) {
    EnigmailLog.DEBUG("mimeVerify.jsm: onStartRequest\n"); // always log this one

    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    if ("mimePart" in this.mimeSvc) {
      this.mimePartNumber = this.mimeSvc.mimePart;
    } else {
      this.mimePartNumber = "";
    }

    if ("messageURI" in this.mimeSvc) {
      this.uri = this.mimeSvc.messageURI;
    } else {
      if (uri) {
        this.uri = uri.QueryInterface(Ci.nsIURI);
      }
    }

    this.dataCount = 0;
    this.foundMsg = false;
    this.backgroundJob = false;
    this.startMsgStr = "";
    this.boundary = "";
    this.proc = null;
    this.closePipe = false;
    this.pipe = null;
    this.readMode = 0;
    this.keepData = "";
    this.last80Chars = "";
    this.signedData = "";
    this.statusStr = "";
    this.statusDisplayed = false;
    this.parseContentType();
  },

  /**
   * onDataAvailable for TB <= 66
   */
  onDataAvailable60: function(req, ctxt, stream, offset, count) {
    LOCAL_DEBUG("mimeVerify.jsm: onDataAvailable60: " + count + "\n");
    if (count > 0) {
      this.inStream.init(stream);
      var data = this.inStream.read(count);
      this.onTextData(data);
    }
  },

  /**
   * onDataAvailable for TB >= 67
   */
  onDataAvailable68: function(req, stream, offset, count) {
    LOCAL_DEBUG("mimeVerify.jsm: onDataAvailable68: " + count + "\n");
    if (count > 0) {
      this.inStream.init(stream);
      var data = this.inStream.read(count);
      this.onTextData(data);
    }
  },

  onTextData: function(data) {
    LOCAL_DEBUG("mimeVerify.jsm: onTextData\n");

    this.dataCount += data.length;

    this.keepData += data;
    if (this.readMode === 0) {
      // header data
      let i = this.findNextMimePart();
      if (i >= 0) {
        i += 2 + this.boundary.length;
        if (this.keepData[i] == "\n") {
          ++i;
        } else if (this.keepData[i] == "\r") {
          ++i;
          if (this.keepData[i] == "\n") ++i;
        }

        this.keepData = this.keepData.substr(i);
        data = this.keepData;
        this.readMode = 1;
      } else {
        this.keepData = data.substr(-this.boundary.length - 3);
      }
    }

    if (this.readMode === 1) {
      // "real data"
      if (data.indexOf("-") >= 0) { // only check current line for speed reasons
        let i = this.findNextMimePart();
        if (i >= 0) {
          // end of "read data found"
          if (this.keepData[i - 2] == '\r' && this.keepData[i - 1] == '\n') {
            --i;
          }

          this.signedData = this.keepData.substr(0, i - 1);
          this.keepData = this.keepData.substr(i);
          this.readMode = 2;
        }
      } else
        return;
    }

    if (this.readMode === 2) {
      let i = this.keepData.indexOf("--" + this.boundary + "--");
      if (i >= 0) {
        // ensure that we keep everything until we got the "end" boundary
        if (this.keepData[i - 2] == '\r' && this.keepData[i - 1] == '\n') {
          --i;
        }
        this.keepData = this.keepData.substr(0, i - 1);
        this.readMode = 3;
      }
    }

    if (this.readMode === 3) {
      // signature data
      if (this.protocol === PGPMIME_PROTO) {
        let xferEnc = this.getContentTransferEncoding();
        if (xferEnc.search(/base64/i) >= 0) {
          let bound = this.getBodyPart();
          this.keepData = EnigmailData.decodeBase64(this.keepData.substring(bound.start, bound.end)) + "\n";
        } else if (xferEnc.search(/quoted-printable/i) >= 0) {
          let bound = this.getBodyPart();
          let qp = this.keepData.substring(bound.start, bound.end);
          this.keepData = EnigmailData.decodeQuotedPrintable(qp) + "\n";
        }

        // extract signature data
        let s = Math.max(this.keepData.search(/^-----BEGIN PGP /m), 0);
        let e = Math.max(this.keepData.search(/^-----END PGP /m), this.keepData.length - 30);
        this.sigData = this.keepData.substring(s, e + 30);
      } else {
        this.sigData = "";
      }

      this.keepData = "";
      this.readMode = 4; // ignore any further data
    }

  },

  getBodyPart: function() {
    let start = this.keepData.search(/(\n\n|\r\n\r\n)/);
    if (start < 0) {
      start = 0;
    }
    let end = this.keepData.indexOf("--" + this.boundary + "--") - 1;
    if (end < 0) {
      end = this.keepData.length;
    }

    return {
      start: start,
      end: end
    };
  },

  // determine content-transfer encoding of mime part, assuming that whole
  // message is in this.keepData
  getContentTransferEncoding: function() {
    let enc = "7bit";
    let m = this.keepData.match(/^(content-transfer-encoding:)(.*)$/mi);
    if (m && m.length > 2) {
      enc = m[2].trim().toLowerCase();
    }

    return enc;
  },


  findNextMimePart: function() {
    let startOk = false;
    let endOk = false;

    let i = this.keepData.indexOf("--" + this.boundary);
    if (i === 0) startOk = true;
    if (i > 0) {
      if (this.keepData[i - 1] == '\r' || this.keepData[i - 1] == '\n') startOk = true;
    }

    if (!startOk) return -1;

    if (i + this.boundary.length + 2 < this.keepData.length) {
      if (this.keepData[i + this.boundary.length + 2] == '\r' ||
        this.keepData[i + this.boundary.length + 2] == '\n' ||
        this.keepData.substr(i + this.boundary.length + 2, 2) == '--') endOk = true;
    }
    // else
    // endOk = true;

    if (i >= 0 && startOk && endOk) {
      return i;
    }
    return -1;
  },

  onStopRequest: function() {
    EnigmailLog.DEBUG("mimeVerify.jsm: onStopRequest\n");

    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.msgUriSpec = EnigmailVerify.lastMsgUri;

    let url = {};

    this.backgroundJob = false;


    // don't try to verify if no message found
    // if (this.verifyEmbedded && (!this.foundMsg)) return; // TODO - check

    if (this.readMode < 4) {
      // we got incomplete data; simply return what we got
      this.returnDataToLibMime(this.signedData.length > 0 ? this.signedData : this.keepData);

      return;
    }

    let protected_headers = EnigmailMime.extractProtectedHeaders(this.signedData);

    if (protected_headers && protected_headers.protectedHeaders && protected_headers.protectedHeaders.startPos >= 0 && protected_headers.protectedHeaders.endPos > protected_headers.protectedHeaders.startPos) {
      let r = this.signedData.substr(0, protected_headers.protectedHeaders.startPos) + this.signedData.substr(protected_headers.protectedHeaders.endPos);
      this.returnDataToLibMime(r);
    } else {
      this.returnDataToLibMime(this.signedData);
    }

    // return if not verifying first mime part
    if (this.mimePartNumber.length > 0 && this.mimePartNumber.search(/^1(\.1)?$/) < 0) return;

    if (this.uri) {
      // return if not decrypting currently displayed message (except if
      // printing, replying, etc)

      this.backgroundJob = (this.uri.spec.search(/[&?]header=(print|quotebody|enigmailConvert)/) >= 0);

      try {
        var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);

        if (this.msgUriSpec) {
          let msgSvc = messenger.messageServiceFromURI(this.msgUriSpec);

          msgSvc.GetUrlForUri(this.msgUriSpec, url, null);
        }

        if (this.uri.spec.search(/[&?]header=[a-zA-Z0-9]*$/) < 0 &&
          this.uri.spec.search(/[&?]part=[.0-9]+/) < 0 &&
          this.uri.spec.search(/[&?]examineEncryptedParts=true/) < 0) {

          if (this.uri.spec.search(/[&?]header=filter&.*$/) > 0)
            return;

          if (this.uri && url && url.value) {

            if ("path" in url) {
              // TB < 57
              if (url.value.host !== this.uri.host ||
                url.value.path !== this.uri.path)
                return;
            } else {
              // TB >= 57
              if (url.value.host !== this.uri.host ||
                url.value.pathQueryRef !== this.uri.pathQueryRef)
                return;
            }
          }
        }
      } catch (ex) {
        EnigmailLog.writeException("mimeVerify.jsm", ex);
        EnigmailLog.DEBUG("mimeVerify.jsm: error while processing " + this.msgUriSpec + "\n");
      }
    }

    if (this.protocol === PGPMIME_PROTO) {
      var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      var win = windowManager.getMostRecentWindow(null);
      if (!EnigmailDecryption.isReady(win)) return;

      this.displayLoadingProgress();
      EnigmailLog.DEBUG(`mimeDecrypt.jsm: starting decryption\n`);

      // discover the pane
      var pane = Cc["@mozilla.org/appshell/window-mediator;1"]
          .getService(Components.interfaces.nsIWindowMediator)
          .getMostRecentWindow("mail:3pane");
      let sender_address = EnigmailDecryption.getFromAddr(pane);

      // if (this.partiallySigned)
        // this.returnStatus.statusFlags |= EnigmailConstants.PARTIALLY_PGP;

      let uri = this.uri;
      let pgpBlock = this.signedData;
      let sigData = this.sigData;
      const cApi = EnigmailCryptoAPI();
      let verify_status = cApi.sync((async function() {
        await AutocryptHelper.processAutocryptForMessage(uri);

        let openpgp_public_key = await EnigmailKeyRing.getPublicKeyByEmail(sender_address);

        try {
          let return_status = await cApi.verify(pgpBlock, sigData, openpgp_public_key);
          EnigmailLog.DEBUG(`mimeVerify.jsm: return status: ${JSON.stringify(return_status)}\n`);

          let verify_status;
          if (return_status.sig_ok) {
            verify_status = MessageCryptoStatus.createVerifyOkStatus(sender_address, return_status.sig_key_id, openpgp_public_key);
          } else {
            verify_status = MessageCryptoStatus.createVerifyErrorStatus(sender_address, return_status.sig_key_id);
          }

          return verify_status;
        } catch (e) {
          EnigmailLog.DEBUG(`mimeVerify.jsm: verify error: ${e}\n`);
          let verify_status = MessageCryptoStatus.createVerifyErrorStatus(sender_address);
          return verify_status;
        }
      })());

      this.displayStatus(verify_status, protected_headers);
    }
  },

  // return data to libMime
  returnDataToLibMime: function(data) {
    EnigmailLog.DEBUG("mimeVerify.jsm: returnDataToLibMime: " + data.length + " bytes\n");

    let m = data.match(/^(content-type: +)([\w/]+)/im);
    if (m && m.length >= 3) {
      let contentType = m[2];
      if (contentType.search(/^text/i) === 0) {
        // add multipart/mixed boundary to work around TB bug (empty forwarded message)
        let bound = EnigmailMime.createBoundary();
        data = 'Content-Type: multipart/mixed; boundary="' + bound + '"\n' +
          'Content-Disposition: inline\n\n--' +
          bound + '\n' +
          data +
          '\n--' + bound + '--\n';
      }
    }

    if ("outputDecryptedData" in this.mimeSvc) {
      // TB >= 57
      this.mimeSvc.outputDecryptedData(data, data.length);
    } else {
      let gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
      gConv.setData(data, data.length);
      try {
        this.mimeSvc.onStartRequest(null, null);
        this.mimeSvc.onDataAvailable(null, null, gConv, 0, data.length);
        this.mimeSvc.onStopRequest(null, null, 0);
      } catch (ex) {
        EnigmailLog.ERROR("mimeVerify.jsm: returnDataToLibMime(): mimeSvc.onDataAvailable failed:\n" + ex.toString());
      }
    }
  },

  setMsgWindow: function(msgWindow, msgUriSpec) {
    EnigmailLog.DEBUG("mimeVerify.jsm: setMsgWindow: " + msgUriSpec + "\n");

    if (!this.msgWindow) {
      this.msgWindow = msgWindow;
      this.msgUriSpec = msgUriSpec;
    }
  },

  displayLoadingProgress: function() {
      EnigmailLog.DEBUG("mimeDecrypt.jsm: displayLoadingProgress()\n");
      let headerSink = EnigmailSingletons.messageReader;
      if (headerSink && this.uri && !this.backgroundJob) {
        headerSink.showLoading();
      }
  },

  displayStatus: function(verify_status, protected_headers) {
    EnigmailLog.DEBUG("mimeVerify.jsm: displayStatus\n");
    if (this.msgWindow === null || this.statusDisplayed || this.backgroundJob)
      return;

    try {
      LOCAL_DEBUG("mimeVerify.jsm: displayStatus displaying result\n");
      let headerSink = EnigmailSingletons.messageReader;

      if (protected_headers && protected_headers.protectedHeaders) {
        headerSink.processDecryptionResult(this.uri, "modifyMessageHeaders", JSON.stringify(protected_headers.protectedHeaders.newHeaders), this.mimePartNumber);
      }

      if (headerSink) {
        headerSink.updateSecurityStatus(
          verify_status,
          this.uri,
          this.mimePartNumber);
      }
      this.statusDisplayed = true;
    } catch (ex) {
      EnigmailLog.writeException("mimeVerify.jsm", ex);
    }
  }
};


////////////////////////////////////////////////////////////////////
// General-purpose functions, not exported

function LOCAL_DEBUG(str) {
  if (gDebugLog) EnigmailLog.DEBUG(str);
}

function initModule() {
  var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
  var nspr_log_modules = env.get("NSPR_LOG_MODULES");
  var matches = nspr_log_modules.match(/mimeVerify:(\d+)/);

  if (matches && (matches.length > 1)) {
    if (matches[1] > 2) gDebugLog = true;
  }
}

initModule();
