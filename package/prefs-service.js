/*global Components: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */

function EnigmailPrefService() {}

EnigmailPrefService.prototype = {
  name: "enigprefs",
  chromePackageName: "enigmail",
  classID: Components.ID("{847b3ab0-7ab1-11d4-8f02-006008948af5}"),
  classDescription: "Enigmail Account Manager Extension Service",
  contractID: "@mozilla.org/accountmanager/extension;1?name=enigprefs",
  _xpcom_categories: [{
    category: "mailnews-accountmanager-extensions",
    entry: "Enigmail account manager extension",
    service: false
  }],
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMsgAccountManagerExtension]),
  showPanel: function(server) {
    // show Enigmail panel for POP3, IMAP, NNTP and "movemail" (unix) account types
    switch (server.type) {
      case "nntp":
      case "imap":
      case "pop3":
      case "movemail":
        return true;
    }
    return false;
  }
};

var components = [EnigmailPrefService];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
