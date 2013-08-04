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
 * Copyright (C) 2013 Patrick Brunschwig. All Rights Reserved.
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");

// Import promise API
try {
  Components.utils.import("resource://gre/modules/commonjs/promise/core.js");     // Gecko 17 to 20
}
catch (ex) {
  try {
    Components.utils.import("resource://gre/modules/commonjs/sdk/core/promise.js"); // Gecko 21 to 24
  }
  catch(ex) {
    Components.utils.import("resource://gre/modules/Promise.jsm"); // Gecko >= 25
  }
}


const Cc = Components.classes;
const Ci = Components.interfaces;
const Ec = EnigmailCommon;

const EXEC_FILE_PERMS = 0x1C0 // 0700


const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";
const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1";
const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";


var EXPORTED_SYMBOLS = [ "InstallGnuPG" ];


function getTempDir() {
  let ds = Cc[DIR_SERV_CONTRACTID].getService();
  let dsprops = ds.QueryInterface(Ci.nsIProperties);
  let tmpFile = dsprops.get("TmpD", Ci.nsIFile);

  return tmpFile;
}

function toHexString(charCode)
{
  return ("0" + charCode.toString(16)).slice(-2);
}


function installer(progressListener) {
  this.progressListener = progressListener;
}

installer.prototype = {

  installMacOs: function() {
    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs\n");
    var proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

    var mountPath = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
    mountPath.initWithPath("/Volumes/"+this.mount);
    if (mountPath.exists()) {
      let p = mountPath.path +" ";
      let i = 1;
      mountPath.initWithPath(p+i);
      while (mountPath.exists() && i < 10) {
        ++i;
        mountPath.initWithPath(p+i);
      }
      if (mountPath.exists()) {
        throw "Error - cannot mount package";
      }
    }

    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs - mount Package\n");

    var cmd = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
    cmd.initWithPath("/usr/bin/open");

    var args = [ "-W", this.installerFile.path ];
    proc.init(cmd);
    proc.run(true, args, args.length);

    if (proc.exitValue) throw "Installer failed";

    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs - run installer\n");

    args = [ "-W", mountPath.path+"/"+this.command ];
    proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    proc.init(cmd);

    proc.run(true, args, args.length);
    if (proc.exitValue) throw "Installer failed";

    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs - unmount package\n");

    cmd.initWithPath("/sbin/umount");
    proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    proc.init(cmd);
    args = [ mountPath.path ];
    proc.run(true, args, args.length);
    if (proc.exitValue) throw "Installer failed";

    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs - remove package\n");
    this.installerFile.remove(false);


  },

  installWindows: function(deferred) {
    Ec.DEBUG_LOG("installGnuPG.jsm: installWindows\n");
    var proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

    var self = this;

    var obs = {
      QueryInterface: XPCOMUtils.generateQI([ Ci.nsIObserver, Ci.nsISupports ]),

      observe: function (proc, aTopic, aData) {
        Ec.DEBUG_LOG("installGnuPG.jsm: installWindows.observe: topic='"+aTopic+"' \n");

        if (aTopic == "process-finished") {
          Ec.DEBUG_LOG("installGnuPG.jsm: installWindows - remove package\n");
          self.installerFile.remove(false);

          var r = proc.exitValue;
          if (typeof(r) == "undefined") r = 0;

          if (r == 0) {
            deferred.resolve();
            if (self.progressListener)
              self.progressListener.onLoaded("Installation OK");
          }
          else {
            deferred.reject("Installer failed");
            if (self.progressListener)
              self.progressListener.onError("Installer failed with exit code "+ r);
          }
        }
        else if (aTopic == "process-failed") {
          deferred.reject("Installer could not be started");
          if (self.progressListener)
            self.progressListener.onError("Installer failed");
        }
      }
    };

    proc.init(this.installerFile);
    proc.runAsync([], 0, obs, false);
  },

  installUnix: function() {
  },

  checkHashSum: function() {
    Ec.DEBUG_LOG("installGnuPG.jsm: checkHashSum\n");
    var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                            .createInstance(Components.interfaces.nsIFileInputStream);
    // open for reading
    istream.init(this.installerFile, 0x01, 0444, 0);

    var ch = Components.classes["@mozilla.org/security/hash;1"]
                       .createInstance(Components.interfaces.nsICryptoHash);
    ch.init(ch.SHA1);
    const PR_UINT32_MAX = 0xffffffff;     // read entire file
    ch.updateFromStream(istream, PR_UINT32_MAX);
    var gotHash = ch.finish(false);

    // convert the binary hash data to a hex string.
    var i;
    var hashStr = [toHexString(gotHash.charCodeAt(i)) for (i in gotHash)].join("");

    if (this.hash != hashStr) {
      Ec.DEBUG_LOG("installGnuPG.jsm: checkHashSum - hash sums don't match: "+hashStr+"\n");
    }
    else
      Ec.DEBUG_LOG("installGnuPG.jsm: checkHashSum - hash sum OK\n");

    return this.hash == hashStr;
  },

  getDownloadUrl: function() {

    let deferred = Promise.defer();

    function reqListener () {
      if (typeof(this.responseXML) == "object") {
        Ec.DEBUG_LOG("installGnuPG.jsm: getDownloadUrl.reqListener: got: "+this.responseText+"\n");
        let doc = this.responseXML.firstChild;
        self.url = doc.getAttribute("url");
        self.hash = doc.getAttribute("hash");
        self.command = doc.getAttribute("command");
        self.mount = doc.getAttribute("mount");
        deferred.resolve();
      }
    }

    function onError(event) {
      deferred.reject("error");
      if (self.progressListener)
        self.progressListener.onError(event);
    }


    Ec.DEBUG_LOG("installGnuPG.jsm: getDownloadUrl: start request\n");

    var self = this;

    try {
      var xulRuntime = Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime);
      var platform = xulRuntime.XPCOMABI.toLowerCase()
      var os = Ec.getOS().toLowerCase();

      // create a  XMLHttpRequest object
      var oReq = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
      oReq.onload = reqListener;
      oReq.addEventListener("error", onError, false);

      oReq.open("get", "http://www.enigmail.net/download/get_gnupg_dl.php?os=" + os + "&platform=" +
                platform, true);
      oReq.send();
    }
    catch(ex) {
      deferred.reject(ex);
      if (self.progressListener)
        self.progressListener.onError(event);
    }

    return deferred.promise;
  },

  performDownload: function() {
    Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: "+ this.url+"\n");

    var self = this;
    let deferred = Promise.defer();

    function onProgress(event) {

      if (event.lengthComputable) {
        var percentComplete = event.loaded / event.total;
        Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: "+ percentComplete * 100+"% loaded\n");
      }
      else {
        Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: got "+ event.loaded+"bytes\n");
      }


      if (self.progressListener)
        self.progressListener.onProgress(event);
    }

    function onError(event) {
      deferred.reject("error");
      if (self.progressListener)
        self.progressListener.onError(event);
    }

    function onLoaded(event) {
      Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: downloaded "+ event.loaded+"bytes\n");

      var arraybuffer = this.response; // not responseText
      Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: bytes "+arraybuffer.byteLength +"\n");

      try {
        var flags = 0x02 | 0x08 | 0x20;
        var fileOutStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
        self.installerFile = getTempDir();

        switch (Ec.getOS()) {
        case "Darwin":
          self.installerFile.append("gpgtools.dmg");
          break;
        case "WINNT":
          self.installerFile.append("gpg4win.exe");
          break;
        default:
          self.installerFile.append("gpg-installer.bin");
        }

        self.installerFile.createUnique(self.installerFile.NORMAL_FILE_TYPE, EXEC_FILE_PERMS);

        Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: writing file to "+ self.installerFile.path +"\n");

        fileOutStream.init(self.installerFile, flags, EXEC_FILE_PERMS, 0);

        var binStr = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);

        binStr.setOutputStream(fileOutStream.QueryInterface(Ci.nsIOutputStream));

        var buf = new Uint8Array(arraybuffer);
        binStr.writeByteArray(buf, buf.length);
        binStr.flush();
        binStr.close();
        fileOutStream.close();

        if (!self.checkHashSum()) {
          var cont = true;
          if (self.progressListener) {
            cont = self.progressListener.onWarning("Hash sum don't match");
          }

          if (! cont) {
            deferred.reject("Aborted due to hash sum error");
            return;
          }

        }

        switch (Ec.getOS()) {
        case "Darwin":
          self.installMacOs();
          break;
        case "WINNT":
          self.installWindows(deferred);
          return;
        default:
          self.installUnix();
        }

        deferred.resolve();
        if (self.progressListener)
          self.progressListener.onLoaded(event);
      }
      catch(ex) {
        Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: failed "+ ex.toString() +"\n");
        deferred.reject(ex);

        if (self.progressListener)
          self.progressListener.onError(ex);
      }

    }

    try {
      // create a  XMLHttpRequest object
      var oReq = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

      oReq.addEventListener("load", onLoaded, false);
      oReq.addEventListener("error", onError, false);
      oReq.addEventListener("progress", onProgress, false);
      oReq.open("get", this.url, true);
      oReq.responseType = "arraybuffer";
      oReq.send();
    }
    catch(ex) {
      deferred.reject(ex);
      if (self.progressListener)
        self.progressListener.onError(ex);
    }

  }
}


var InstallGnuPG = {



  start: function(progressListener) {

    var i = new installer(progressListener);
    i.getDownloadUrl().
    then(function _dl() { i.performDownload() });
    return i;
  }
}
