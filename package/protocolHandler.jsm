/*global Components: false, EnigmailCore: false, XPCOMUtils: false, EnigmailData: false, EnigmailLog: false */
/*jshint -W097 */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailProtocolHandler"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/core.jsm");
Components.utils.import("resource://enigmail/data.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */
Components.utils.import("resource://enigmail/uris.jsm"); /*global EnigmailURIs: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */

const NS_SIMPLEURI_CONTRACTID = "@mozilla.org/network/simple-uri;1";
const NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID = "@mozilla.org/network/protocol;1?name=enigmail";
const NS_ENIGMAILPROTOCOLHANDLER_CID = Components.ID("{847b3a11-7ab1-11d4-8f02-006008948af5}");
const ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const WMEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";

const Cc = Components.classes;
const Ci = Components.interfaces;

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
    uri.spec = aSpec;

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
