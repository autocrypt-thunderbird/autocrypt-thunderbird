/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailCommandLine"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */

const NS_ENIGCLINE_SERVICE_CID = Components.ID("{847b3ab1-7ab1-11d4-8f02-006008948af5}");
const NS_CLINE_SERVICE_CONTRACTID = "@mozilla.org/enigmail/cline-handler;1";

const nsICommandLineHandler = Ci.nsICommandLineHandler;
const nsIFactory = Ci.nsIFactory;
const nsISupports = Ci.nsISupports;

function Handler() {}

Handler.prototype = {
  classDescription: "Enigmail Key Management CommandLine Service",
  classID: NS_ENIGCLINE_SERVICE_CID,
  contractID: NS_CLINE_SERVICE_CONTRACTID,
  _xpcom_categories: [{
    category: "command-line-handler",
    entry: "m-cline-enigmail",
    service: false
  }],
  QueryInterface: XPCOMUtils.generateQI([nsICommandLineHandler, nsIFactory, nsISupports]),

  // nsICommandLineHandler
  handle: function(cmdLine) {
    if (cmdLine.handleFlag("pgpkeyman", false)) {
      cmdLine.preventDefault = true; // do not open main app window

      const wwatch = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
      wwatch.openWindow(null, "chrome://enigmail/content/enigmailKeyManager.xul", "_blank", "chrome,dialog=no,all", cmdLine);
    }
  },

  helpInfo: "  -pgpkeyman         Open the OpenPGP key management.\n",

  lockFactory: function(lock) {}
};

const EnigmailCommandLine = {
  Handler: Handler
};
