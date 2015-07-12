/*global Components: false, dump: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for handling PGP/MIME encrypted and/or signed messages
 *  implemented as an XPCOM object
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/mimeDecrypt.jsm"); /*global EnigmailMimeDecrypt: false */
Components.utils.import("resource://enigmail/mimeVerify.jsm"); /*global EnigmailVerify: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

const PGPMIME_JS_DECRYPTOR_CONTRACTID = "@mozilla.org/mime/pgp-mime-js-decrypt;1";
const PGPMIME_JS_DECRYPTOR_CID = Components.ID("{7514cbeb-2bfd-4b2c-829b-1a4691fa0ac8}");

////////////////////////////////////////////////////////////////////
// handler for PGP/MIME encrypted and PGP/MIME signed messages
// data is processed from libmime -> nsPgpMimeProxy

const throwErrors = {
  onDataAvailable: function() {
    throw "error";
  },
  onStartRequest: function() {
    throw "error";
  },
  onStopRequest: function() {
    throw "error";
  }
};

function PgpMimeHandler() {

  EnigmailLog.DEBUG("mimeDecrypt.js: PgpMimeHandler()\n");   // always log this one

  }

PgpMimeHandler.prototype = {
  classDescription: "Enigmail JS Decryption Handler",
  classID:  PGPMIME_JS_DECRYPTOR_CID,
  contractID: PGPMIME_JS_DECRYPTOR_CONTRACTID,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  inStream: Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream),

  onStartRequest: function(request, uri) {
    if (!EnigmailCore.getService()) // Ensure Enigmail is initialized
      return;
    EnigmailLog.DEBUG("pgpmimeHandler.js: onStartRequest\n");   // always log this one
    
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    let ct = this.mimeSvc.contentType;
    
    if (ct.search(/^multipart\/encrypted/i) === 0) {
      // PGP/MIME encrypted message
      this.contentHandler = new EnigmailMimeDecrypt();
    }
    else if (ct.search(/^multipart\/signed/i) === 0) {
      // PGP/MIME signed message
      if (ct.search(/application\/pgp-signature/i) > 0) {
        this.contentHandler = EnigmailVerify.newVerifier();
      }
      else {
        this.handleSmime(uri);
      }
    }
    else {
      this.contentHandler = null;
    }
   
    if (this.contentHandler) {
      return this.contentHandler.onStartRequest(request, uri);
    }
  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    if (this.contentHandler) {
      return this.contentHandler.onDataAvailable(req, sup, stream, offset, count);
    }
  },

  onStopRequest: function(request, win, status) {
    if (this.contentHandler) {
      return this.contentHandler.onStopRequest(request, win, status);
    }
  },
  
  handleSmime: function(uri) {
    this.contentHandler = throwErrors;
    
    if (uri) {
      uri = uri.QueryInterface(Ci.nsIURI).clone();
    }
    let headerSink = EnigmailVerify.lastMsgWindow.msgHeaderSink.securityInfo.QueryInterface(Ci.nsIEnigMimeHeaderSink);
    headerSink.handleSMimeMessage(uri);
    
  }
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([PgpMimeHandler]);
dump("pgpmimeHandler.js: registration done\n");
