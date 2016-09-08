/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailOS"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";

Cu.import("resource://enigmail/lazy.jsm"); /* global EnigmailLazy: false */
const getExecution = EnigmailLazy.loader("enigmail/execution.jsm", "EnigmailExecution");

let operatingSystem = null;
function getOS() {
  if (operatingSystem === null) {
    operatingSystem = Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime).OS;
  }
  return operatingSystem;
}

function isDosLike() {
  return getOS() === "WINNT" || getOS() === "OS2";
}

function isMac() {
  return getOS() === "Darwin";
}

function isWin32() {
  return getOS() === "WINNT";
}

const EnigmailOS = {
  /*
   * getOS uses the Mozilla nsIXULRuntime Component to retrieve the OS Target
   *
   * @return   String    - OS Identifier
   */
  getOS: getOS,

  /**
   * isDosLike identifies whether the host computer is MS-DOS based
   *
   * @return    Boolean   - True if local host is MS-DOS based. False otherwise.
   */
  isDosLike: isDosLike(),

  /**
   * isWin32 identifies whether the running system is 32 bit Windows machine
   *
   * @return    Boolean   - True if local host is a 32 bit Windows machine. False otherwise.
   */
  isWin32: isWin32(),

  /**
   * isMac identifies whether the running system is a Mac
   *
   * @return    Boolean   - True if local host is a derivative of Darwin. False otherwise.
   */
  isMac: isMac(),

  // get a Windows registry value (string)
  // @ keyPath: the path of the registry (e.g. Software\\GNU\\GnuPG)
  // @ keyName: the name of the key to get (e.g. InstallDir)
  // @ rootKey: HKLM, HKCU, etc. (according to constants in nsIWindowsRegKey)
  getWinRegistryString: function(keyPath, keyName, rootKey) {
    const registry = Cc["@mozilla.org/windows-registry-key;1"].createInstance(Ci.nsIWindowsRegKey);

    let retval = "";
    try {
      registry.open(rootKey, keyPath, registry.ACCESS_READ);
      retval = registry.readStringValue(keyName);
      registry.close();
    }
    catch (ex) {}

    return retval;
  }
};
