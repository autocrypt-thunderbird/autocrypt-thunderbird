/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global dump: false */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptLog"];

const AutocryptConsole = ChromeUtils.import("chrome://autocrypt/content/modules/pipeConsole.jsm").AutocryptConsole;
const AutocryptFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").AutocryptFiles;
const AutocryptOS = ChromeUtils.import("chrome://autocrypt/content/modules/os.jsm").AutocryptOS;

const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const NS_IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";


var AutocryptLog = {
  level: 3,
  data: null,
  fileStream: null,

  setLogLevel: function(newLogLevel) {
    AutocryptLog.level = newLogLevel;
  },

  getLogLevel: function() {
    return AutocryptLog.level;
  },

  setLogFile: function(logFile) {
    if (!AutocryptLog.fileStream && AutocryptLog.level >= 5) {
      AutocryptLog.fileStream = AutocryptFiles.createFileStream(logFile);
    }
  },

  onShutdown: function() {
    if (AutocryptLog.fileStream) {
      AutocryptLog.fileStream.close();
    }
    AutocryptLog.fileStream = null;
  },

  getLogData: function(version, prefs) {
    let ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);

    let oscpu = "";
    let platform = "";

    try {
      let httpHandler = ioServ.getProtocolHandler("http");
      httpHandler = httpHandler.QueryInterface(Ci.nsIHttpProtocolHandler);
      oscpu = httpHandler.oscpu;
      platform = httpHandler.platform;
    }
    catch (ex) {}

    let data = "Autocrypt version " + version + "\n" +
      "OS/CPU=" + oscpu + "\n" +
      "Platform=" + platform + "\n" +
      "Non-default preference values:\n";

    let p = prefs.getPrefBranch().getChildList("");

    for (let i in p) {
      if (prefs.getPrefBranch().prefHasUserValue(p[i])) {
        data += p[i] + ": " + prefs.getPref(p[i]) + "\n";
      }
    }

    let otherPref = ["dom.workers.maxPerDomain"];
    let root = prefs.getPrefRoot();
    for (let op of otherPref) {
      try {
        data += op + ": " + root.getIntPref(op) + "\n";
      }
      catch (ex) {
        data += ex.toString() + "\n";
      }
    }
    return data + "\n" + AutocryptLog.data;
  },

  WRITE: function(str) {
    function withZeroes(val, digits) {
      return ("0000" + val.toString()).substr(-digits);
    }

    var d = new Date();
    var datStr = d.getFullYear() + "-" + withZeroes(d.getMonth() + 1, 2) + "-" + withZeroes(d.getDate(), 2) + " " + withZeroes(d.getHours(), 2) + ":" + withZeroes(d.getMinutes(), 2) + ":" +
      withZeroes(d.getSeconds(), 2) + "." + withZeroes(d.getMilliseconds(), 3) + " ";
    if (AutocryptLog.level >= 4)
      dump(datStr + str);

    if (AutocryptLog.data === null) {
      AutocryptLog.data = "";
      let appInfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);
      AutocryptLog.WRITE("Mozilla Platform: " + appInfo.name + " " + appInfo.version + "\n");
    }
    // truncate first part of log data if it grow too much
    if (AutocryptLog.data.length > 5120000) {
      AutocryptLog.data = AutocryptLog.data.substr(-400000);
    }

    AutocryptLog.data += datStr + str;

    if (AutocryptLog.fileStream) {
      AutocryptLog.fileStream.write(datStr, datStr.length);
      AutocryptLog.fileStream.write(str, str.length);
    }
  },

  DEBUG: function(str) {
    try {
      AutocryptLog.WRITE("[DEBUG] " + str);
    }
    catch (ex) {}
  },

  WARNING: function(str) {
    AutocryptLog.WRITE("[WARN] " + str);
    AutocryptConsole.write(str);
  },

  ERROR: function(str) {
    try {
      var consoleSvc = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
      var scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
      scriptError.init(str, null, null, 0, 0, scriptError.errorFlag, "Autocrypt");
      consoleSvc.logMessage(scriptError);
    }
    catch (ex) {}

    AutocryptLog.WRITE("[ERROR] " + str);
  },

  CONSOLE: function(str) {
    if (AutocryptLog.level >= 3) {
      AutocryptLog.WRITE("[CONSOLE] " + str);
    }

    AutocryptConsole.write(str);
  },

  /**
   *  Log an exception including the stack trace
   *
   *  referenceInfo: String - arbitraty text to write before the exception is logged
   *  ex:            exception object
   */
  writeException: function(referenceInfo, ex) {
    AutocryptLog.ERROR(referenceInfo + ": caught exception: " +
      ex.name + "\n" +
      "Message: '" + ex.message + "'\n" +
      "File:    " + ex.fileName + "\n" +
      "Line:    " + ex.lineNumber + "\n" +
      "Stack:   " + ex.stack + "\n");
  }
};
