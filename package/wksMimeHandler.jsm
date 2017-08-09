/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailWksMimeHandler"];

/**
 *  Module for handling response messages from OpenPGP Web Key Service
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/mimeVerify.jsm"); /*global EnigmailVerify: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/decryption.jsm"); /*global EnigmailDecryption: false */

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

var gDebugLog = false;


const EnigmailWksMimeHandler = {

  /***
   * register a PGP/MIME verify object the same way PGP/MIME encrypted mail is handled
   */
  registerContentTypeHandler: function() {
    EnigmailLog.DEBUG("wksMimeHandler.jsm: registerContentTypeHandler()\n");
    let reg = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

    let pgpMimeClass = Components.classes["@mozilla.org/mimecth;1?type=multipart/encrypted"];

    reg.registerFactory(
      pgpMimeClass,
      "Enigmail WKD Response Handler",
      "@mozilla.org/mimecth;1?type=application/vnd.gnupg.wks",
      null);
  },

  newHandler: function() {
    EnigmailLog.DEBUG("wksMimeHandler.jsm: newHandler()\n");

    let v = new PgpWkdHandler();
    return v;
  }

};

// MimeVerify Constructor
function PgpWkdHandler(protocol) {
  this.inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
}


// PgpWkdHandler implementation
PgpWkdHandler.prototype = {

  data: "",
  mimePartNumber: "",
  uri: null,
  backgroundJob: false,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  onStartRequest: function(request, uri) {
    EnigmailLog.DEBUG("wksMimeHandler.jsm: onStartRequest\n"); // always log this one

    this.uri = uri ? uri.QueryInterface(Ci.nsIURI).clone() : null;
    this.mimeSvc = request.QueryInterface(Ci.nsIPgpMimeProxy);
    if ("mimePart" in this.mimeSvc) {
      this.mimePartNumber = this.mimeSvc.mimePart;
    }
    else {
      this.mimePartNumber = "";
    }
    this.data = "";
    this.msgWindow = EnigmailVerify.lastMsgWindow;
    this.backgroundJob = false;

    if (this.uri) {
      this.backgroundJob = (this.uri.spec.search(/[&?]header=(print|quotebody|enigmailConvert)/) >= 0);
    }

  },

  onDataAvailable: function(req, sup, stream, offset, count) {
    LOCAL_DEBUG("wksMimeHandler.jsm: onDataAvailable: " + count + "\n");
    if (count > 0) {
      this.inStream.init(stream);
      let data = this.inStream.read(count);
      this.data += data;
    }
  },

  onStopRequest: function() {
    EnigmailLog.DEBUG("wksMimeHandler.jsm: onStopRequest\n");

    if (this.data.search(/-----BEGIN PGP MESSAGE-----/i) >= 0) {
      this.decryptChallengeData();
    }

    let jsonStr = this.requestToJsonString(this.data);
    let msg = "";

    if (this.data.search(/^\s*type:\s+confirmation-request/mi) >= 0) {
      msg = EnigmailLocale.getString("wkdMessage.body.req");
    }
    else {
      msg = EnigmailLocale.getString("wkdMessage.body.process");
    }

    this.returnData(msg);
    this.displayStatus(jsonStr);
  },

  decryptChallengeData: function() {
    EnigmailLog.DEBUG("wksMimeHandler.jsm: decryptChallengeData()\n");
    let windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
    let win = windowManager.getMostRecentWindow(null);
    let statusFlagsObj = {};

    let res = EnigmailDecryption.decryptMessage(win,
      0,
      this.data, {}, {}, statusFlagsObj, {}, {}, {}, {}, {}, {});

    if (statusFlagsObj.value & Ci.nsIEnigmail.DECRYPTION_OKAY) {
      this.data = res;
    }
    EnigmailLog.DEBUG("wksMimeHandler.jsm: decryptChallengeData: decryption result: " + res + "\n");
  },

  // convert request data into JSON-string and parse it
  requestToJsonString: function() {
    // convert
    let lines = this.data.split(/\r?\n/);
    let s = '{';
    for (let l of lines) {
      let m = l.match(/^([^\s:]+)(:\s*)([^\s].+)$/);
      if (m && m.length >= 4) {
        s += '"' + m[1].trim().toLowerCase() + '": "' + m[3].trim() + '",';
      }
    }

    let o = {};
    s = s.substr(0, s.length - 1) + "}";

    return s;
  },

  // return data to libMime
  returnData: function(message) {
    EnigmailLog.DEBUG("wksMimeHandler.jsm: returnData():\n");

    let msg = 'Content-Type: text/plain; charset="utf-8"\r\n' +
      'Content-Transfer-Encoding: 8bit\r\n\r\n' +
      message + '\r\n';

    if ("readDecryptedData" in this.mimeSvc) {
      this.mimeSvc.readDecryptedData(msg, msg.length);
    }
    else {
      let gConv = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
      gConv.setData(msg, msg.length);
      try {
        this.mimeSvc.onStartRequest(null, null);
        this.mimeSvc.onDataAvailable(null, null, gConv, 0, msg.length);
        this.mimeSvc.onStopRequest(null, null, 0);
      }
      catch (ex) {
        EnigmailLog.ERROR("wksMimeHandler.jsm: returnData(): mimeSvc.onDataAvailable failed:\n" + ex.toString());
      }
    }
  },

  displayStatus: function(jsonStr) {
    EnigmailLog.DEBUG("wksMimeHandler.jsm: displayStatus\n");
    if (this.msgWindow === null || this.backgroundJob)
      return;

    try {
      LOCAL_DEBUG("wksMimeHandler.jsm: displayStatus displaying result\n");
      let headerSink = this.msgWindow.msgHeaderSink.securityInfo.QueryInterface(Ci.nsIEnigMimeHeaderSink);

      if (headerSink) {
        headerSink.processDecryptionResult(this.uri, "wksConfirmRequest", jsonStr, this.mimePartNumber);
      }

    }
    catch (ex) {
      EnigmailLog.writeException("wksMimeHandler.jsm", ex);
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
  var matches = nspr_log_modules.match(/wksMimeHandler:(\d+)/);

  if (matches && (matches.length > 1)) {
    if (matches[1] > 2) gDebugLog = true;
  }
}

initModule();
