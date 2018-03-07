/*global Components: false, EnigmailCore: false, XPCOMUtils: false, EnigmailData: false, EnigmailLog: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailProtocolHandler"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://enigmail/core.jsm");
Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */
Cu.import("resource://enigmail/uris.jsm"); /*global EnigmailURIs: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */

const NS_SIMPLEURI_CONTRACTID = "@mozilla.org/network/simple-uri;1";
const NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID = "@mozilla.org/network/protocol;1?name=enigmail";
const NS_ENIGMAILPROTOCOLHANDLER_CID = Components.ID("{847b3a11-7ab1-11d4-8f02-006008948af5}");
const ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const WMEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const nsIProtocolHandler = Ci.nsIProtocolHandler;

var EC = EnigmailCore;

const gDummyPKCS7 =
  'Content-Type: multipart/mixed;\r\n boundary="------------060503030402050102040303\r\n\r\nThis is a multi-part message in MIME format.\r\n--------------060503030402050102040303\r\nContent-Type: application/x-pkcs7-mime\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303\r\nContent-Type: application/x-enigmail-dummy\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303--\r\n';


function EnigmailProtocolHandler() {}

EnigmailProtocolHandler.prototype = {
  classDescription: "Enigmail Protocol Handler",
  classID: NS_ENIGMAILPROTOCOLHANDLER_CID,
  contractID: NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID,
  scheme: "enigmail",
  defaultPort: -1,
  protocolFlags: nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT |
    nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
    nsIProtocolHandler.URI_NORELATIVE |
    nsIProtocolHandler.URI_NOAUTH |
    nsIProtocolHandler.URI_OPENING_EXECUTES_SCRIPT,

  QueryInterface: XPCOMUtils.generateQI([nsIProtocolHandler]),

  newURI: function(aSpec, originCharset, aBaseURI) {
    EnigmailLog.DEBUG("enigmail.js: EnigmailProtocolHandler.newURI: aSpec='" + aSpec + "'\n");

    // cut of any parameters potentially added to the URI; these cannot be handled
    if (aSpec.substr(0, 14) == "enigmail:dummy") aSpec = "enigmail:dummy";

    var uri = Cc[NS_SIMPLEURI_CONTRACTID].createInstance(Ci.nsIURI);
    try {
      // TB <= 58
      uri.spec = aSpec;
    }
    catch (x) {
      aSpec = aSpec.substr(9);
      let i = aSpec.indexOf("?");
      try {
        // TB < 60
        uri.scheme = "enigmail";
        if (i >= 0) {
          uri.query = aSpec.substr(i + 1);
          uri.pathQueryRef = aSpec.substr(0, i);
        }
        else {
          uri.pathQueryRef = aSpec;
        }
      }
      catch (ex) {
        uri = uri.mutate().setScheme("enigmail").finalize();
        if (i >= 0) {
          uri = uri.mutate().setQuery(aSpec.substr(i + 1)).finalize();
          uri = uri.mutate().setPathQueryRef(aSpec.substr(0, i)).finalize();
        }
        else {
          uri = uri.mutate().setPathQueryRef(aSpec).finalize();
        }
      }

    }

    return uri;
  },

  newChannel: function(aURI) {
    EnigmailLog.DEBUG("enigmail.js: EnigmailProtocolHandler.newChannel: URI='" + aURI.spec + "'\n");

    var messageId = EnigmailData.extractMessageId(aURI.spec);
    var mimeMessageId = EnigmailData.extractMimeMessageId(aURI.spec);
    var contentType, contentCharset, contentData;

    if (messageId) {
      // Handle enigmail:message/...

      if (!EC.getEnigmailService()) {
        throw Components.results.NS_ERROR_FAILURE;
      }

      if (EnigmailURIs.getMessageURI(messageId)) {
        var messageUriObj = EnigmailURIs.getMessageURI(messageId);

        contentType = messageUriObj.contentType;
        contentCharset = messageUriObj.contentCharset;
        contentData = messageUriObj.contentData;

        EnigmailLog.DEBUG("enigmail.js: EnigmailProtocolHandler.newChannel: messageURL=" + messageUriObj.originalUrl + ", content length=" + contentData.length + ", " + contentType + ", " +
          contentCharset + "\n");

        // do NOT delete the messageUriObj now from the list, this will be done once the message is unloaded (fix for bug 9730).

      }
      else if (mimeMessageId) {
        this.handleMimeMessage(mimeMessageId);
      }
      else {

        contentType = "text/plain";
        contentCharset = "";
        contentData = "Enigmail error: invalid URI " + aURI.spec;
      }

      let channel = EnigmailStreams.newStringChannel(aURI, contentType, "UTF-8", contentData);

      return channel;
    }

    if (aURI.spec.indexOf(aURI.scheme + "://photo/") === 0) {
      // handle photo ID
      contentType = "image/jpeg";
      contentCharset = "";
      let keyId = aURI.spec.substr(17);
      let exitCodeObj = {};
      let errorMsgObj = {};
      let f = EnigmailKeyRing.getPhotoFile(keyId, 0, exitCodeObj, errorMsgObj);
      if (exitCodeObj.value === 0) {
        let channel = EnigmailStreams.newFileChannel(aURI, f, "image/jpeg", true);
        return channel;
      }

      return null;
    }

    if (aURI.spec == aURI.scheme + ":dummy") {
      // Dummy PKCS7 content (to access mimeEncryptedClass)
      return EnigmailStreams.newStringChannel(aURI, "message/rfc822", "", gDummyPKCS7);
    }

    var winName, spec;
    if (aURI.spec == "about:" + aURI.scheme) {
      // About Enigmail
      //            winName = "about:"+enigmail;
      winName = "about:enigmail";
      spec = "chrome://enigmail/content/enigmailAbout.xul";

    }
    else if (aURI.spec == aURI.scheme + ":console") {
      // Display enigmail console messages
      winName = "enigmail:console";
      spec = "chrome://enigmail/content/enigmailConsole.xul";

    }
    else if (aURI.spec == aURI.scheme + ":keygen") {
      // Display enigmail key generation console
      winName = "enigmail:keygen";
      spec = "chrome://enigmail/content/enigmailKeygen.xul";

    }
    else {
      // Display Enigmail about page
      winName = "about:enigmail";
      spec = "chrome://enigmail/content/enigmailAbout.xul";
    }

    var windowManager = Cc[WMEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

    var winEnum = windowManager.getEnumerator(null);
    var recentWin = null;
    while (winEnum.hasMoreElements() && !recentWin) {
      var thisWin = winEnum.getNext();
      if (thisWin.location.href == spec) {
        recentWin = thisWin;
      }
    }

    if (recentWin) {
      recentWin.focus();
    }
    else {
      var appShellSvc = Cc[ASS_CONTRACTID].getService(Ci.nsIAppShellService);
      var domWin = appShellSvc.hiddenDOMWindow;

      domWin.open(spec, "_blank", "chrome,menubar,toolbar,resizable");
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  handleMimeMessage: function(messageId) {
    //        EnigmailLog.DEBUG("enigmail.js: EnigmailProtocolHandler.handleMimeMessage: messageURL="+messageUriObj.originalUrl+", content length="+contentData.length+", "+contentType+", "+contentCharset+"\n");
    EnigmailLog.DEBUG("enigmail.js: EnigmailProtocolHandler.handleMimeMessage: messageURL=, content length=, , \n");
  },

  allowPort: function(port, scheme) {
    // non-standard ports are not allowed
    return false;
  }
};
