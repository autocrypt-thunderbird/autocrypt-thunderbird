/*global Components: false, EnigmailLog: false, EnigmailOS: false, EnigmailData: false */
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

var EXPORTED_SYMBOLS = ["EnigmailFiles"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/os.jsm");
Cu.import("resource://enigmail/data.jsm");

const NS_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
  "@mozilla.org/network/file-output-stream;1";
const NS_IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";
const NS_SCRIPTABLEINPUTSTREAM_CONTRACTID = "@mozilla.org/scriptableinputstream;1";
const DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";

const NS_RDONLY = 0x01;
const NS_WRONLY = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const lazyLog = (function() {
  let log = null;
  return function() {
    if (!log) {
      Components.utils.import("resource://enigmail/log.jsm");
      log = EnigmailLog;
    }
    return log;
  };
})();

const EnigmailFiles = {

  isAbsolutePath: function(filePath, isDosLike) {
    // Check if absolute path
    if (isDosLike) {
      return ((filePath.search(/^\w+:\\/) === 0) || (filePath.search(/^\\\\/) === 0) ||
        (filePath.search(/^\/\//) === 0));
    }
    else {
      return (filePath.search(/^\//) === 0);
    }
  },

  resolvePath: function(filePath, envPath, isDosLike) {
    lazyLog().DEBUG("files.jsm: resolvePath: filePath=" + filePath + "\n");

    if (EnigmailFiles.isAbsolutePath(filePath, isDosLike))
      return filePath;

    if (!envPath)
      return null;

    var fileNames = filePath.split(";");

    var pathDirs = envPath.split(isDosLike ? ";" : ":");

    for (var i = 0; i < fileNames.length; i++) {
      for (var j = 0; j < pathDirs.length; j++) {
        try {
          var pathDir = Cc[NS_FILE_CONTRACTID].createInstance(Ci.nsIFile);

          lazyLog().DEBUG("files.jsm: resolvePath: checking for " + pathDirs[j] + "/" + fileNames[i] + "\n");

          EnigmailFiles.initPath(pathDir, pathDirs[j]);

          try {
            if (pathDir.exists() && pathDir.isDirectory()) {
              pathDir.appendRelativePath(fileNames[i]);

              if (pathDir.exists() && !pathDir.isDirectory()) {
                return pathDir;
              }
            }
          }
          catch (ex) {}
        }
        catch (ex) {}
      }
    }
    return null;
  },

  createFileStream: function(filePath, permissions) {
    try {
      var localFile;
      if (typeof filePath == "string") {
        localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
        EnigmailFiles.initPath(localFile, filePath);
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

    }
    catch (ex) {
      lazyLog().ERROR("files.jsm: createFileStream: Failed to create " + filePath + "\n");
      return null;
    }
  },

  // path initialization function
  // uses persistentDescriptor in case that initWithPath fails
  // (seems to happen frequently with UTF-8 characters in path names)
  initPath: function(localFileObj, pathStr) {
    localFileObj.initWithPath(pathStr);

    if (!localFileObj.exists()) {
      localFileObj.persistentDescriptor = pathStr;
    }
  },

  // Read the contents of a file into a string
  readFile: function(filePath) {
    // @filePath: nsIFile
    if (filePath.exists()) {
      var ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
      if (!ioServ)
        throw Components.results.NS_ERROR_FAILURE;

      var fileURI = ioServ.newFileURI(filePath);
      var fileChannel = ioServ.newChannel(fileURI.asciiSpec, null, null);

      var rawInStream = fileChannel.open();

      var scriptableInStream = Cc[NS_SCRIPTABLEINPUTSTREAM_CONTRACTID].createInstance(Ci.nsIScriptableInputStream);
      scriptableInStream.init(rawInStream);
      var available = scriptableInStream.available();
      var fileContents = scriptableInStream.read(available);
      scriptableInStream.close();
      return fileContents;
    }
    return "";
  },

  formatCmdLine: function(command, args) {
    function getQuoted(str) {
      let i = str.indexOf(" ");
      if (i >= 0) {
        return '"' + str + '"';
      }
      else {
        return str;
      }
    }

    var cmdStr = getQuoted(EnigmailFiles.getFilePathDesc(command)) + " ";
    var argStr = args.map(getQuoted).join(" ").replace(/\\\\/g, '\\');
    return cmdStr + argStr;
  },

  getFilePathDesc: function(nsFileObj) {
    if (EnigmailOS.getOS() == "WINNT") {
      return nsFileObj.persistentDescriptor;
    }
    else {
      return nsFileObj.path;
    }
  },

  getFilePath: function(nsFileObj) {
    return EnigmailData.convertToUnicode(EnigmailFiles.getFilePathDesc(nsFileObj), "utf-8");
  },

  getEscapedFilename: function(fileNameStr) {
    if (EnigmailOS.isDosLike()) {
      // escape the backslashes and the " character (for Windows and OS/2)
      fileNameStr = fileNameStr.replace(/([\\\"])/g, "\\$1");
    }

    if (EnigmailOS.getOS() == "WINNT") {
      // replace leading "\\" with "//"
      fileNameStr = fileNameStr.replace(/^\\\\*/, "//");
    }
    return fileNameStr;
  },

  getTempDirObj: function() {
    const TEMPDIR_PROP = "TmpD";

    try {
      let dsprops = Cc[DIRSERVICE_CONTRACTID].getService().
      QueryInterface(Ci.nsIProperties);
      return dsprops.get(TEMPDIR_PROP, Ci.nsIFile);
    }
    catch (ex) {
      // let's guess ...
      let tmpDirObj = Cc[NS_FILE_CONTRACTID].createInstance(Ci.nsIFile);
      if (EnigmailOS.getOS() == "WINNT") {
        tmpDirObj.initWithPath("C:/TEMP");
      }
      else {
        tmpDirObj.initWithPath("/tmp");
      }
      return tmpDirObj;
    }
  },

  getTempDir: function() {
    return EnigmailFiles.getTempDirObj().path;
  },

  createTempDir: function(name) {
    var localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);

    localFile.initWithPath(EnigmailFiles.getTempDir());
    localFile.append(name);
    localFile.create(Ci.nsIFile.DIRECTORY_TYPE, 509 /* = 0775 */ );

    return localFile;
  },

  /**
   *  Write data to a file
   *  @filePath |string| or |nsIFile| object - the file to be created
   *  @data     |string|       - the data to write to the file
   *  @permissions  |number|   - file permissions according to Unix spec (0600 by default)
   *
   *  @return true if data was written successfully, false otherwise
   */
  writeFileContents: function(filePath, data, permissions) {
    try {
      var fileOutStream = EnigmailFiles.createFileStream(filePath, permissions);

      if (data.length) {
        if (fileOutStream.write(data, data.length) != data.length) {
          throw Components.results.NS_ERROR_FAILURE;
        }

        fileOutStream.flush();
      }
      fileOutStream.close();
    }
    catch (ex) {
      EnigmailLog.ERROR("files.jsm: writeFileContents: Failed to write to " + filePath + "\n");
      return false;
    }

    return true;
  },

  // return the useable path (for gpg) of a file object
  getFilePathReadonly: function(nsFileObj, creationMode) {
    if (creationMode === null) creationMode = NS_RDONLY;
    return nsFileObj.path;
  }
};
