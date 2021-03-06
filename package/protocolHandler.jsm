/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptProtocolHandler"];

const AutocryptTb60Compat = ChromeUtils.import("chrome://autocrypt/content/modules/tb60compat.jsm").AutocryptTb60Compat;
const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
const AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;
const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptStreams = ChromeUtils.import("chrome://autocrypt/content/modules/streams.jsm").AutocryptStreams;
const AutocryptURIs = ChromeUtils.import("chrome://autocrypt/content/modules/uris.jsm").AutocryptURIs;
const NetUtil = ChromeUtils.import("resource://gre/modules/NetUtil.jsm").NetUtil;

const NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID = "@mozilla.org/network/protocol;1?name=enigmail";
const NS_ENIGMAILPROTOCOLHANDLER_CID = Components.ID("{847b3a11-7ab1-11d4-8f02-006008948af5}");
const ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const WMEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const nsIProtocolHandler = Ci.nsIProtocolHandler;

var EC = AutocryptCore;

const gDummyPKCS7 =
  'Content-Type: multipart/mixed;\r\n boundary="------------060503030402050102040303\r\n\r\nThis is a multi-part message in MIME format.\r\n--------------060503030402050102040303\r\nContent-Type: application/x-pkcs7-mime\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303\r\nContent-Type: application/x-enigmail-dummy\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303--\r\n';


function AutocryptProtocolHandler() {}

AutocryptProtocolHandler.prototype = {
  classDescription: "Autocrypt Protocol Handler",
  classID: NS_ENIGMAILPROTOCOLHANDLER_CID,
  contractID: NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID,
  scheme: "enigmail",
  defaultPort: -1,
  protocolFlags: nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT |
    nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
    nsIProtocolHandler.URI_NORELATIVE |
    nsIProtocolHandler.URI_NOAUTH |
    nsIProtocolHandler.URI_OPENING_EXECUTES_SCRIPT,

  QueryInterface: AutocryptTb60Compat.generateQI([nsIProtocolHandler]),

  newURI: function(aSpec, originCharset, aBaseURI) {
    AutocryptLog.DEBUG("protocolHandler.jsm: AutocryptProtocolHandler.newURI: aSpec='" + aSpec + "'\n");

    // cut of any parameters potentially added to the URI; these cannot be handled
    if (aSpec.substr(0, 14) == "enigmail:dummy") aSpec = "enigmail:dummy";

    let uri;

    try {
      uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    } catch (x) {
      uri = NetUtil.newURI("data:text/plain,enigmail");
    }

    try {
      // TB <= 58
      uri.spec = aSpec;
    } catch (x) {
      aSpec = aSpec.substr(9);
      let i = aSpec.indexOf("?");
      try {
        // TB < 60
        uri.scheme = "enigmail";
        if (i >= 0) {
          uri.query = aSpec.substr(i + 1);
          uri.pathQueryRef = aSpec.substr(0, i);
        } else {
          uri.pathQueryRef = aSpec;
        }
      } catch (ex) {
        uri = uri.mutate().setScheme("enigmail").finalize();
        if (i >= 0) {
          uri = uri.mutate().setQuery(aSpec.substr(i + 1)).finalize();
          uri = uri.mutate().setPathQueryRef(aSpec.substr(0, i)).finalize();
        } else {
          uri = uri.mutate().setPathQueryRef(aSpec).finalize();
        }
      }

    }

    return uri;
  },

  newChannel: function(aURI, loadInfo) {
    AutocryptLog.DEBUG("protocolHandler.jsm: AutocryptProtocolHandler.newChannel: URI='" + aURI.spec + "'\n");

    var messageId = AutocryptData.extractMessageId(aURI.spec);
    var mimeMessageId = AutocryptData.extractMimeMessageId(aURI.spec);
    var contentType, contentCharset, contentData;

    if (messageId) {
      // Handle enigmail:message/...

      if (!EC.getAutocryptService()) {
        throw Components.results.NS_ERROR_FAILURE;
      }

      if (AutocryptURIs.getMessageURI(messageId)) {
        var messageUriObj = AutocryptURIs.getMessageURI(messageId);

        contentType = messageUriObj.contentType;
        contentCharset = messageUriObj.contentCharset;
        contentData = messageUriObj.contentData;

        AutocryptLog.DEBUG("protocolHandler.jsm: AutocryptProtocolHandler.newChannel: messageURL=" + messageUriObj.originalUrl + ", content length=" + contentData.length + ", " + contentType + ", " +
          contentCharset + "\n");

        // do NOT delete the messageUriObj now from the list, this will be done once the message is unloaded (fix for bug 9730).

      } else if (mimeMessageId) {
        this.handleMimeMessage(mimeMessageId);
      } else {

        contentType = "text/plain";
        contentCharset = "";
        contentData = "Autocrypt error: invalid URI " + aURI.spec;
      }

      let channel = AutocryptStreams.newStringChannel(aURI, contentType, "UTF-8", contentData, loadInfo);


      return channel;
    }

    if (aURI.spec == aURI.scheme + ":dummy") {
      // Dummy PKCS7 content (to access mimeEncryptedClass)
      return AutocryptStreams.newStringChannel(aURI, "message/rfc822", "", gDummyPKCS7, loadInfo);
    }

    var winName, spec;
    if (aURI.spec == "about:" + aURI.scheme) {
      // About Autocrypt
      //            winName = "about:"+enigmail;
      winName = "about:enigmail";
      spec = "chrome://autocrypt/content/ui/enigmailAbout.xul";

    } else if (aURI.spec == aURI.scheme + ":console") {
      // Display enigmail console messages
      winName = "enigmail:console";
      spec = "chrome://autocrypt/content/ui/enigmailConsole.xul";

    } else if (aURI.spec == aURI.scheme + ":keygen") {
      // Display enigmail key generation console
      winName = "enigmail:keygen";
      spec = "chrome://autocrypt/content/ui/enigmailKeygen.xul";

    } else {
      // Display Autocrypt about page
      winName = "about:enigmail";
      spec = "chrome://autocrypt/content/ui/enigmailAbout.xul";
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
    } else {
      var appShellSvc = Cc[ASS_CONTRACTID].getService(Ci.nsIAppShellService);
      var domWin = appShellSvc.hiddenDOMWindow;

      domWin.open(spec, "_blank", "chrome,menubar,toolbar,resizable");
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  handleMimeMessage: function(messageId) {
    //        AutocryptLog.DEBUG("protocolHandler.jsm: AutocryptProtocolHandler.handleMimeMessage: messageURL="+messageUriObj.originalUrl+", content length="+contentData.length+", "+contentType+", "+contentCharset+"\n");
    AutocryptLog.DEBUG("protocolHandler.jsm: AutocryptProtocolHandler.handleMimeMessage: messageURL=, content length=, , \n");
  },

  allowPort: function(port, scheme) {
    // non-standard ports are not allowed
    return false;
  }
};
