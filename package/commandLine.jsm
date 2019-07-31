/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailCommandLine"];





const EnigmailTb60Compat = ChromeUtils.import("chrome://autocrypt/content/modules/tb60compat.jsm").EnigmailTb60Compat;


const NS_ENIGCLINE_SERVICE_CID = Components.ID("{847b3ab1-7ab1-11d4-8f02-006008948af5}");
const NS_CLINE_SERVICE_CONTRACTID = "@mozilla.org/autocrypt/cline-handler;1";

function Handler() {}

Handler.prototype = {
  classDescription: "Enigmail Key Management CommandLine Service",
  classID: NS_ENIGCLINE_SERVICE_CID,
  contractID: NS_CLINE_SERVICE_CONTRACTID,
  QueryInterface: EnigmailTb60Compat.generateQI(["nsICommandLineHandler", "nsIFactory"]),

  // nsICommandLineHandler
  handle: function(cmdLine) {
    if (cmdLine.handleFlag("pgpkeyman", false)) {
      cmdLine.preventDefault = true; // do not open main app window

      const wwatch = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
      wwatch.openWindow(null, "chrome://autocrypt/content/ui/enigmailKeyManager.xul", "_blank", "chrome,dialog=no,all", cmdLine);
    }
  },

  helpInfo: "  -pgpkeyman         Open the OpenPGP key management.\n",

  lockFactory: function(lock) {}
};

var EnigmailCommandLine = {
  Handler: Handler,
  categoryRegistry: {
    category: "command-line-handler",
    entry: "m-cline-enigmail",
    serviceName: NS_CLINE_SERVICE_CONTRACTID
  }
};
