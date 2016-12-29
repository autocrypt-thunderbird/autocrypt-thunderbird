/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for interfacing to pEp (Enigmail-specific functions)
 */


const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/pEp.jsm"); /*global EnigmailpEp: false */
Cu.import("resource://enigmail/pEpListener.jsm"); /*global EnigmailpEpListener: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Cu.import("resource://enigmail/promise.jsm"); /*global Promise: false */
Cu.import("resource://enigmail/rng.jsm"); /*global EnigmailRNG: false */
Cu.import("resource://enigmail/lazy.jsm"); /*global EnigmailLazy: false */
Cu.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */
Cu.import("resource://enigmail/pEpMessageHist.jsm"); /*global EnigmailPEPMessageHist: false */


const getFiles = EnigmailLazy.loader("enigmail/files.jsm", "EnigmailFiles");


// pEp JSON Server executable name
const pepServerExecutable = "pep-json-server";

var gPepVersion = null;
var gSecurityToken = null;

var EXPORTED_SYMBOLS = ["EnigmailPEPAdapter"];


function pepCallback(data) {
  EnigmailLog.DEBUG("pEpAdapter.jsm: pepCallback: got data '" + data + "'\n");

}

function startListener() {
  EnigmailLog.DEBUG("pEpAdapter.jsm: startListener:\n");
  gSecurityToken = EnigmailRNG.generateRandomString(40);
  let portNum = EnigmailpEpListener.createListener(pepCallback, gSecurityToken);

  if (portNum < 0) {
    EnigmailLog.DEBUG("pEpAdapter.jsm: startListener: could not open socket\n");
  }

  EnigmailpEp.registerListener(portNum, gSecurityToken).then(function _ok(data) {
    EnigmailLog.DEBUG("pEpAdapter.jsm: startListener: registration with pEp OK\n");

  }).catch(function _fail(data) {
    EnigmailLog.DEBUG("pEpAdapter.jsm: startListener: registration with pEp failed\n");
  });
}


var EnigmailPEPAdapter = {

  pep: EnigmailpEp,

  /**
   * Get the pEp JSON server version number.
   *
   * @return String:
   *     - null if the module is not initialized
   *     - a non-empty string if pEp is available
   *     - "" in case pEp is not available
   */
  getPepVersion: function() {
    return gPepVersion;
  },

  /**
   * Determine if pEp is available
   *
   * @return: Boolean: true - pEp is available / false - pEp is not usable
   */
  usingPep: function() {
    if (!this.getPepJuniorMode()) return false;

    if ((typeof(gPepVersion) === "string") && gPepVersion.length > 0) {
      return true;
    }

    return false;
  },

  /**
   * Determine if pEp should be used or Enigmail
   *
   * @return: Boolean: true - use pEp  / false - use Enigmail
   */
  getPepJuniorMode: function() {

    let mode = EnigmailPrefs.getPref("juniorMode");
    if (mode === 2) return true;
    if (mode === 0) return false;

    // automatic mode
    return (!this.isAccountCryptEnabled());

  },

  /**
   * Determine if any account is enabled for crypto (S/MIME or Enigmail)
   *
   * @return: Boolean: true if at least one account is enabled for S/MIME or Enigmail,
   *                   false otherwise
   */

  isAccountCryptEnabled: function() {
    // automatic mode: go through all identities
    let amService = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
    amService.LoadAccounts();
    let ids = amService.allIdentities;

    for (let i = 0; i < ids.length; i++) {
      let msgId = ids.queryElementAt(i, Ci.nsIMsgIdentity);

      if ((msgId.getUnicharAttribute("signing_cert_name") !== "") ||
        (msgId.getUnicharAttribute("encryption_cert_name") !== "") ||
        msgId.getBoolAttribute("enablePgp")) {
        return true;
      }
    }

    return false;
  },

  /**
   * Initialize the pEpAdapter (should be called during startup of application)
   *
   * no input and no retrun values
   */
  initialize: function() {
    EnigmailLog.DEBUG("pEpAdapter.jsm: initialize:\n");

    let pEpMode = EnigmailPrefs.getPref("juniorMode");
    // force using Enigmail (do not use pEp)
    if (pEpMode === 0) return;

    // automatic mode, with Crypto enabled (do not use pEp)
    if (this.isAccountCryptEnabled() && pEpMode !== 2) return;

    let execFile = getFiles().resolvePathWithEnv(pepServerExecutable);
    if (execFile) EnigmailpEp.setServerPath(execFile.path);

    try {
      EnigmailpEp.getPepVersion().then(function success(data) {
        EnigmailLog.DEBUG("pEpAdapter.jsm: initialize: success '" + JSON.stringify(data) + "'\n");
        if (Array.isArray(data)) {
          gPepVersion = String(data[0]);
          startListener();
        }
      }).
      catch(function failed(err) {
        EnigmailLog.DEBUG("pEpAdapter.jsm: initialize: error during pEp init:\n");
        EnigmailLog.DEBUG("   " + err.code + ": " + ("exception" in err && err.exception ? err.exception.toString() : err.message) + "\n");

        gPepVersion = "";
      });
    }
    catch (ex) {}
  },

  /**
   * Get a MIME tree as String from the pEp-internal message object
   *
   * @param resObj: Object  - result object from encryption
   *
   * @return String - a MIME string, or "" if no message extracted
   */
  stripMsgHeadersFromEncryption: function(resObj) {
    let mimeStr = "";
    if (Array.isArray(resObj) && typeof(resObj[0]) === "string") {
      mimeStr = resObj[0];
    }

    let startPos = mimeStr.search(/\r?\n\r?\n/);

    if (startPos < 0) return "";

    let headers = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    headers.initialize(mimeStr.substring(0, startPos));

    let n = headers.headerNames;
    let printHdr = "";

    while (n.hasMore()) {
      let hdr = n.getNext();
      if (hdr.search(/^(from|to|mime-version)$/i) < 0) {
        printHdr += hdr + ": " + EnigmailMime.formatHeaderData(headers.extractHeader(hdr, true)) + "\r\n";
      }
    }

    return printHdr + "\r\n" + mimeStr.substr(startPos);
  },

  /**
   * Get the encryption quality rating for a list of recipients
   *
   * @param sender:     - String           email adress of message sender
   * @param recipients: - Array of String  email adresses of message recipients
   *
   * @return Number: quality of encryption (-3 ... 9)
   */
  getOutgoingMessageRating: function(sender, recipients) {
    let resultObj = null;
    let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

    EnigmailPEPAdapter.pep.outgoingMessageColor(sender, recipients, "test").then(function _step2(res) {
      EnigmailLog.DEBUG("pEpAdapter.jsm: outgoingMessageColor: SUCCESS\n");
      if ((typeof(res) === "object") && ("result" in res)) {
        resultObj = res.result;
      }
      else
        EnigmailLog.DEBUG("pEpAdapter.jsm: outgoingMessageColor: typeof res=" + typeof(res) + "\n");


      if (inspector && inspector.eventLoopNestLevel > 0) {
        // unblock the waiting lock in finishCryptoEncapsulation
        inspector.exitNestedEventLoop();
      }

    }).catch(function _error(err) {
      EnigmailLog.DEBUG("pEpAdapter.jsm: outgoingMessageColor: ERROR\n");
      EnigmailLog.DEBUG(err.code + ": " + ("exception" in err ? err.exception.toString() : err.message) + "\n");

      if (inspector && inspector.eventLoopNestLevel > 0) {
        // unblock the waiting lock in finishCryptoEncapsulation
        inspector.exitNestedEventLoop();
      }
    });

    // wait here for PEP to terminate
    inspector.enterNestedEventLoop(0);

    if (resultObj && Array.isArray(resultObj) && "color" in resultObj[0]) {
      return resultObj[0].color;
    }
    return 3; // unencrypted
  },

  /**
   * Obtain a list of supported languages for trustwords
   *
   * @return Promise, delivering Array of Object:
   *            - short: 2-Letter ISO-Codes
   *            - long:  Language name in the language
   *            - desc:  Describing sentence in the language
   */
  getSupportedLanguages: function() {
    let deferred = Promise.defer();
    EnigmailpEp.getLanguageList().then(function _success(res) {
      if ((typeof(res) === "object") && ("result" in res)) {
        let inArr = res.result[0].split(/\n/);
        let outArr = inArr.reduce(function _f(p, langLine) {
          let y = langLine.split(/","/);
          if (langLine.length > 0) p.push({
            short: y[0].replace(/^"/, ""),
            long: y[1],
            desc: y[2].replace(/"$/, "")
          });
          return p;
        }, []);
        deferred.resolve(outArr);
      }
      else {
        deferred.resolve([]);
      }
    }).catch(function _err(err) {
      deferred.resolve([]);
    });

    return deferred.promise;
  },

  getIdentityForEmail: function(emailAddress) {
    return EnigmailpEp.getIdentity(emailAddress, "TOFU_" + emailAddress);
  },

  /**
   * Update the last sent date for PGP/MIME messages. We only do this such that
   * we don't unnecessarily process earlier inline-PGP messages
   */
  processPGPMIME: function(headerData) {
    EnigmailLog.DEBUG("pEpAdapter.jsm: processPGPMIME\n");
    if (!("from" in headerData) && ("date" in headerData)) return;

    EnigmailPEPMessageHist.isLatestMessage(headerData.from.headerValue, headerData.date.headerValue).
    then(function _result(latestMessage) {
      EnigmailLog.DEBUG("pEpAdapter.jsm: processPGPMIME: " + latestMessage + "\n");
    }).catch(function _fail() {
      EnigmailLog.DEBUG("pEpAdapter.jsm: processPGPMIME: error\n");
    });
  },

  /**
   * Update the last sent date for inline-PGP messages. We do this to make sure
   * that pEp can potentially derive information from the message (such as extracting an
   * attached key).
   */
  processInlinePGP: function(msgUri, headerData) {
    EnigmailLog.DEBUG("pEpAdapter.jsm: processInlinePGP: " + msgUri + "\n");

    if (!("from" in headerData) && ("date" in headerData)) return;

    let stream = EnigmailStreams.newStringStreamListener(
      function analyzeData(data) {
        EnigmailLog.DEBUG("pEpAdapter.jsm: processInlinePGP: got " + data.length + " bytes\n");

        if (data.indexOf("From -") === 0) {
          // remove 1st line from Mails stored in msgbox format
          data = data.replace(/^From .*\r?\n/, "");
        }

        EnigmailpEp.decryptMimeString(data).
        then(function _ignore() {}).
        catch(function _ignore() {});
      }
    );

    EnigmailPEPMessageHist.isLatestMessage(headerData.from.headerValue, headerData.date.headerValue).
    then(function _result(latestMessage) {
      EnigmailLog.DEBUG("pEpAdapter.jsm: processInlinePGP: " + latestMessage + "\n");
      try {
        if (latestMessage) {
          var channel = EnigmailStreams.createChannel(msgUri.spec);
          channel.asyncOpen(stream, null);
        }
      }
      catch (e) {
        EnigmailLog.DEBUG("pEpAdapter.jsm: processInlinePGP: exception " + e.toString() + "\n");
      }
    }).catch(function _fail() {
      EnigmailLog.DEBUG("pEpAdapter.jsm: processInlinePGP: error\n");
    });

  }
};
