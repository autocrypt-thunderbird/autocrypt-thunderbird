/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailOS"];

const Cc = Components.classes;
const Ci = Components.interfaces;

const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";

function getOS() {
  return Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime).OS;
}

const EnigmailOS = {
  isWin32: (getOS() == "WINNT"),

  getOS: getOS,

  isDosLike: function() {
    if (EnigmailOS.isDosLikeVal === undefined) {
      EnigmailOS.isDosLikeVal = (EnigmailOS.getOS() == "WINNT" || EnigmailOS.getOS() == "OS2");
    }
    return EnigmailOS.isDosLikeVal;
  },

  // get a Windows registry value (string)
  // @ keyPath: the path of the registry (e.g. Software\\GNU\\GnuPG)
  // @ keyName: the name of the key to get (e.g. InstallDir)
  // @ rootKey: HKLM, HKCU, etc. (according to constants in nsIWindowsRegKey)
  getWinRegistryString: function(keyPath, keyName, rootKey) {
    var registry = Cc["@mozilla.org/windows-registry-key;1"].createInstance(Ci.nsIWindowsRegKey);

    var retval = "";
    try {
      registry.open(rootKey, keyPath, registry.ACCESS_READ);
      retval = registry.readStringValue(keyName);
      registry.close();
    }
    catch (ex) {}

    return retval;
  }
};
