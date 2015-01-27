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
 * Copyright (C) 2014 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
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



/***
 * Enigmail Core:
 * this file serves to be included by other components in Enigmail;
 * it should not import anything from other Enigmail modules, except
 * pipeConsole!
 */

/*
 * Import into a JS component using
 * 'Components.utils.import("resource://enigmail/enigmailCore.jsm");'
 */

Components.utils.import("resource://enigmail/pipeConsole.jsm");


var EXPORTED_SYMBOLS = [ "EnigmailCore" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const SEAMONKEY_ID   = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";

const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";

const NS_IOSERVICE_CONTRACTID       = "@mozilla.org/network/io-service;1";
const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1";

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const ENIGMAIL_PREFS_ROOT = "extensions.enigmail.";

var gLogLevel = 3;

var gLogData = null;

var EnigmailCore = {

  _logDirectory: null,
  _logFileStream: null,
  enigStringBundle: null,
  prefService: null,
  prefBranch: null,
  prefRoot: null,
  version: "",

  init: function(enigmailVersion) {
    this.version = enigmailVersion;

    if(! this.prefBranch) this.initPrefService;
  },

  setLogLevel: function(newLogLevel) {
    gLogLevel = newLogLevel;
  },

  getLogLevel: function() {
    return gLogLevel;
  },

  setLogDirectory: function(newLogDirectory) {
    this._logDirectory = newLogDirectory + (this.isDosLike() ? "\\" : "/");

    this.createLogFiles();
  },

  createLogFiles: function() {
    if (this._logDirectory && (! this._logFileStream) && gLogLevel >= 5) {
      this._logFileStream = this.createFileStream(this._logDirectory+"enigdbug.txt");
    }
  },

  onShutdown: function() {
    if (this._logFileStream) this._logFileStream.close();
    this._logFileStream = null;
  },

  getOS: function () {
    var xulRuntime = Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime);
    return xulRuntime.OS;
  },

  isDosLike: function() {
    if (this.isDosLikeVal === undefined) {
      this.isDosLikeVal = (this.getOS() == "WINNT" || this.getOS() == "OS2");
    }
    return this.isDosLikeVal;
  },

  isSuite: function () {
    // return true if Seamonkey, false otherwise
    var xulAppinfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);
    return (xulAppinfo.ID == SEAMONKEY_ID);
  },

  WRITE_LOG: function (str)
  {
    function f00(val, digits) {
      return ("0000"+val.toString()).substr(-digits);
    }

    var d = new Date();
    var datStr=d.getFullYear()+"-"+f00(d.getMonth()+1, 2)+"-"+f00(d.getDate(),2)+" "+f00(d.getHours(),2)+":"+f00(d.getMinutes(),2)+":"+f00(d.getSeconds(),2)+"."+f00(d.getMilliseconds(),3)+" ";
    if (gLogLevel >= 4)
      dump(datStr+str);

    if (gLogData == null) {
      gLogData = "";
      this.WRITE_LOG("Mozilla Platform: "+ this.getAppName()+" "+ this.getAppVersion() + "\n");
    }
    // truncate first part of log data if it grow too much
    if (gLogData.length > 128000) {
      gLogData = gLogData.substr(-72000);
    }

    gLogData += datStr + str;

    if (this._logFileStream) {
      this._logFileStream.write(datStr, datStr.length);
      this._logFileStream.write(str, str.length);
    }
  },

  DEBUG_LOG: function (str)
  {
    this.WRITE_LOG("[DEBUG] "+str);
  },

  WARNING_LOG: function (str)
  {
    this.WRITE_LOG("[WARN] "+str);

    EnigmailConsole.write(str);
  },

  ERROR_LOG: function (str)
  {
    try {
      var consoleSvc = Cc["@mozilla.org/consoleservice;1"].
          getService(Ci.nsIConsoleService);

      var scriptError = Cc["@mozilla.org/scripterror;1"]
                                  .createInstance(Ci.nsIScriptError);
      scriptError.init(str, null, null, 0,
                       0, scriptError.errorFlag, "Enigmail");
      consoleSvc.logMessage(scriptError);

    }
    catch (ex) {}

    this.WRITE_LOG("[ERROR] "+str);
  },

  CONSOLE_LOG: function (str)
  {
    if (gLogLevel >= 3)
      this.WRITE_LOG("[CONSOLE] "+str);

    EnigmailConsole.write(str);
  },

  getLogFileStream: function() {
    return this._logFileStream;
  },

  getLogData: function() {

    let ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);

    let oscpu = "";
    let platform = "";

    try {
      let httpHandler = ioServ.getProtocolHandler("http");
      httpHandler = httpHandler.QueryInterface(Ci.nsIHttpProtocolHandler);
      oscpu = httpHandler.oscpu;
      platform = httpHandler.platform;
    }
    catch (ex) {
    }



    let data = "Enigmail version "+this.version+"\n" +
      "OS/CPU="+oscpu+"\n" +
      "Platform="+platform+"\n" +
      "Non-default preference values:\n";

    let p = this.prefBranch.getChildList("");

    for (let i in p) {
      if (this.prefBranch.prefHasUserValue(p[i])) {
        data += p[i] +": "+ this.getPref(p[i])+"\n";
      }
    }

    return data +"\n" + gLogData;

  },

  // retrieves a localized string from the enigmail.properties stringbundle
  getString: function (aStr, subPhrases)
  {

    if (!this.enigStringBundle) {
      try {
        var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"].getService();
        strBundleService = strBundleService.QueryInterface(Ci.nsIStringBundleService);
        this.enigStringBundle = strBundleService.createBundle("chrome://enigmail/locale/enigmail.properties");
      }
      catch (ex) {
        this.ERROR_LOG("enigmailCore.jsm: Error in instantiating stringBundleService\n");
      }
    }

    if (this.enigStringBundle) {
      try {
        if (subPhrases) {
          if (typeof(subPhrases) == "string") {
            return this.enigStringBundle.formatStringFromName(aStr, [ subPhrases ], 1);
          }
          else
            return this.enigStringBundle.formatStringFromName(aStr, subPhrases, subPhrases.length);
        }
        else {
          return this.enigStringBundle.GetStringFromName(aStr);
        }
      }
      catch (ex) {
        this.ERROR_LOG("enigmailCore.jsm: Error in querying stringBundleService for string '"+aStr+"'\n");
      }
    }
    return aStr;
  },

  createFileStream: function(filePath, permissions) {

    try {
      var localFile;
      if (typeof filePath == "string") {
        localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
        initPath(localFile, filePath);
      }
      else {
        localFile = filePath.QueryInterface(Ci.nsIFile);
      }

      if (localFile.exists()) {

        if (localFile.isDirectory() || !localFile.isWritable())
           throw Components.results.NS_ERROR_FAILURE;

        if (!permissions)
          permissions = localFile.permissions;
      }

      if (!permissions)
        permissions = DEFAULT_FILE_PERMS;

      var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

      var fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);

      fileStream.init(localFile, flags, permissions, 0);

      return fileStream;

    } catch (ex) {
      this.ERROR_LOG("enigmailCore.jsm: createFileStream: Failed to create "+filePath+"\n");
      return null;
    }
  },

  printCmdLine: function (command, args) {

    function getQuoted(str) {
      let i = str.indexOf(" ");
      if (i>=0) {
        return '"' + str +'"'
      }
      else
        return str;
    }

    var rStr = getQuoted(this.getFilePathDesc(command)) +" ";

    let i;
    rStr += [getQuoted(args[i]) for (i in args)].join(" ").replace(/\\\\/g, '\\');

    return rStr;
  },

  getFilePathDesc: function (nsFileObj) {
    if (this.getOS() == "WINNT")
      return nsFileObj.persistentDescriptor;
    else
      return nsFileObj.path;
  },

  initPrefService: function() {
    if (this.prefBranch) return;

    try {
      this.prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

      this.prefRoot        = this.prefService.getBranch(null);
      this.prefBranch      = this.prefService.getBranch(ENIGMAIL_PREFS_ROOT);

      if (this.prefBranch.getCharPref("logDirectory"))
        gLogLevel = 5;

    }
    catch (ex) {
      this.ERROR_LOG("enigmailCore.jsm: Error in instantiating PrefService\n");
      this.ERROR_LOG(ex.toString());
    }
  },

  getPrefRoot: function() {
    if (! this.prefRoot)
      this.initPrefService();

    return this.prefRoot;
  },

  getPref: function (prefName)
  {
    if (! this.prefBranch)
      this.initPrefService();

    var prefValue = null;
    try {
      var prefType = this.prefBranch.getPrefType(prefName);
      // Get pref value
      switch (prefType) {
      case this.prefBranch.PREF_BOOL:
         prefValue = this.prefBranch.getBoolPref(prefName);
         break;

      case this.prefBranch.PREF_INT:
         prefValue = this.prefBranch.getIntPref(prefName);
         break;

      case this.prefBranch.PREF_STRING:
         prefValue = this.prefBranch.getCharPref(prefName);
         break;

      default:
         prefValue = undefined;
         break;
     }

   } catch (ex) {
      // Failed to get pref value
      this.ERROR_LOG("enigmailCommon.jsm: getPref: unknown prefName:"+prefName+" \n");
   }

   return prefValue;
  },

  /**
   * Store a user preference.
   *
   * @param  String  prefName  An identifier.
   * @param  any     value     The value to be stored. Allowed types: Boolean OR Integer OR String.
   *
   * @return Boolean Was the value stored successfully?
   */
  setPref: function (prefName, value)
  {
     this.DEBUG_LOG("enigmailCommon.jsm: setPref: "+prefName+", "+value+"\n");

     if (! this.prefBranch) {
       this.initPrefService();
     }

     // Discover the type of the preference, as stored in the user preferences.
     // If the preference identifier doesn't exist yet, it returns 0. In that
     // case the type depends on the argument "value".
     var prefType;
     prefType = this.prefBranch.getPrefType(prefName);
     if (prefType === 0) {
       switch (typeof value) {
         case "boolean":
           prefType = this.prefBranch.PREF_BOOL;
           break;
         case "number":
           prefType = this.prefBranch.PREF_INT;
           break;
         case "string":
           prefType = this.prefBranch.PREF_STRING;
           break;
         default:
           prefType = 0;
           break;
       }
     }
     var retVal = false;

     // Save the preference only and if only the type is bool, int or string.
     switch (prefType) {
        case this.prefBranch.PREF_BOOL:
           this.prefBranch.setBoolPref(prefName, value);
           retVal = true;
           break;

        case this.prefBranch.PREF_INT:
           this.prefBranch.setIntPref(prefName, value);
           retVal = true;
           break;

        case this.prefBranch.PREF_STRING:
           this.prefBranch.setCharPref(prefName, value);
           retVal = true;
           break;

        default:
           break;
     }

     return retVal;
  },

  /**
   * Plattform application name (e.g. Thunderbird)
   */

  getAppName: function() {
    var xulAppinfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);

    return xulAppinfo.name;
  },

  /**
   * Plattform application version
   */
  getAppVersion: function() {
    var xulAppinfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);

    return xulAppinfo.version;
  },


  /**
   * Return the directory holding the current profile as nsIFile object
   */
  getProfileDirectory: function() {
    let ds = Cc[DIR_SERV_CONTRACTID].getService(Ci.nsIProperties);
    return ds.get("ProfD", Ci.nsIFile);
  }
}

function initPath(localFileObj, pathStr) {
  localFileObj.initWithPath(pathStr);

  if (! localFileObj.exists()) {
    localFileObj.persistentDescriptor = pathStr;
  }
}

