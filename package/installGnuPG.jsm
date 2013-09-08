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


 /* Usage:
  InstallGnuPG.start(progressListener).

  progressListener needs to implement the following methods:
  void    onError    (errorMessage)
  boolean onWarning  (message)
  void    onProgress (event)
  void    onLoaded   (event)
  void    onDownloaded ()
  void    onStart    (requestObj)

  requestObj:
    abort():  cancel download

  onWarning can return true if the warning should be ignored, false otherwise

*/

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");

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

const queryUrl = "https://www.enigmail.net/download/get_gnupg_dl.php";

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

function sanitizeFileName(str) {
  // remove shell escape, #, ! and / from string
  return str.replace(/[`\/\#\!]/g, "");
}

function sanitizeHash(str) {
  return str.replace(/[^a-hA-H0-9]/g, "");
}

// Adapted from the patch for mozTCPSocket error reporting (bug 861196).

function createTCPErrorFromFailedXHR(xhr) {
  let status = xhr.channel.QueryInterface(Ci.nsIRequest).status;

  let errType;
  let errName;

  if ((status & 0xff0000) === 0x5a0000) { // Security module
    const nsINSSErrorsService = Ci.nsINSSErrorsService;
    let nssErrorsService = Cc['@mozilla.org/nss_errors_service;1'].getService(nsINSSErrorsService);
    let errorClass;
    // getErrorClass will throw a generic NS_ERROR_FAILURE if the error code is
    // somehow not in the set of covered errors.
    try {
      errorClass = nssErrorsService.getErrorClass(status);
    } catch (ex) {
      errorClass = 'SecurityProtocol';
    }
    if (errorClass == nsINSSErrorsService.ERROR_CLASS_BAD_CERT) {
      errType = 'SecurityCertificate';
    }
    else {
      errType = 'SecurityProtocol';
    }

    // NSS_SEC errors (happen below the base value because of negative vals)
    if ((status & 0xffff) < Math.abs(nsINSSErrorsService.NSS_SEC_ERROR_BASE)) {
      // The bases are actually negative, so in our positive numeric space, we
      // need to subtract the base off our value.
      let nssErr = Math.abs(nsINSSErrorsService.NSS_SEC_ERROR_BASE)
                       - (status & 0xffff);
      switch (nssErr) {
        case 11: // SEC_ERROR_EXPIRED_CERTIFICATE, sec(11)
          errName = 'SecurityExpiredCertificateError';
          break;
        case 12: // SEC_ERROR_REVOKED_CERTIFICATE, sec(12)
          errName = 'SecurityRevokedCertificateError';
          break;

        // per bsmith, we will be unable to tell these errors apart very soon,
        // so it makes sense to just folder them all together already.
        case 13: // SEC_ERROR_UNKNOWN_ISSUER, sec(13)
        case 20: // SEC_ERROR_UNTRUSTED_ISSUER, sec(20)
        case 21: // SEC_ERROR_UNTRUSTED_CERT, sec(21)
        case 36: // SEC_ERROR_CA_CERT_INVALID, sec(36)
          errName = 'SecurityUntrustedCertificateIssuerError';
          break;
        case 90: // SEC_ERROR_INADEQUATE_KEY_USAGE, sec(90)
          errName = 'SecurityInadequateKeyUsageError';
          break;
        case 176: // SEC_ERROR_CERT_SIGNATURE_ALGORITHM_DISABLED, sec(176)
          errName = 'SecurityCertificateSignatureAlgorithmDisabledError';
          break;
        default:
          errName = 'SecurityError';
          break;
      }
    }
    else {
      let sslErr = Math.abs(nsINSSErrorsService.NSS_SSL_ERROR_BASE)
                       - (status & 0xffff);
      switch (sslErr) {
        case 3: // SSL_ERROR_NO_CERTIFICATE, ssl(3)
          errName = 'SecurityNoCertificateError';
          break;
        case 4: // SSL_ERROR_BAD_CERTIFICATE, ssl(4)
          errName = 'SecurityBadCertificateError';
          break;
        case 8: // SSL_ERROR_UNSUPPORTED_CERTIFICATE_TYPE, ssl(8)
          errName = 'SecurityUnsupportedCertificateTypeError';
          break;
        case 9: // SSL_ERROR_UNSUPPORTED_VERSION, ssl(9)
          errName = 'SecurityUnsupportedTLSVersionError';
          break;
        case 12: // SSL_ERROR_BAD_CERT_DOMAIN, ssl(12)
          errName = 'SecurityCertificateDomainMismatchError';
          break;
        default:
          errName = 'SecurityError';
          break;
      }
    }
  }
  else {
    errType = 'Network';
    switch (status) {
      // connect to host:port failed
      case 0x804B000C: // NS_ERROR_CONNECTION_REFUSED, network(13)
        errName = 'ConnectionRefusedError';
        break;
      // network timeout error
      case 0x804B000E: // NS_ERROR_NET_TIMEOUT, network(14)
        errName = 'NetworkTimeoutError';
        break;
      // hostname lookup failed
      case 0x804B001E: // NS_ERROR_UNKNOWN_HOST, network(30)
        errName = 'DomainNotFoundError';
        break;
      case 0x804B0047: // NS_ERROR_NET_INTERRUPT, network(71)
        errName = 'NetworkInterruptError';
        break;
      default:
        errName = 'NetworkError';
        break;
    }
  }

  return {name: errName, type: errType};
}

function installer(progressListener) {
  this.progressListener = progressListener;
}

installer.prototype = {

  installMacOs: function(deferred) {
    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs\n");

    var exitCode = -1;
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

    this.mountPath = mountPath;
    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs - mount Package\n");

    var cmd = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
    cmd.initWithPath("/usr/bin/open");

    var args = [ "-W", this.installerFile.path ];

    var proc = {
      command:     cmd,
      arguments:   args,
      charset: null,
      done: function(result) {
        exitCode = result.exitCode;
      }
    };

    try {
      subprocess.call(proc).wait();
      if (exitCode) throw "Installer failed with exit code "+exitCode;
    } catch (ex) {
      Ec.ERROR_LOG("installGnuPG.jsm: installMacOs: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    Ec.DEBUG_LOG("installGnuPG.jsm: installMacOs - run installer\n");

    args = [ "-W", this.mountPath.path+"/"+this.command ];

    proc = {
      command:     cmd,
      arguments:   args,
      charset: null,
      done: function(result) {
        if (result.exitCode != 0) {
          deferred.reject("Installer failed with exit code "+result.exitCode);
        }
        else
          deferred.resolve();
      }
    };

    try {
      subprocess.call(proc);
    } catch (ex) {
      Ec.ERROR_LOG("installGnuPG.jsm: installMacOs: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }
  },

  cleanupMacOs: function () {
    Ec.DEBUG_LOG("installGnuPG.jsm.cleanupMacOs: unmount package\n");

    var cmd = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
    cmd.initWithPath("/usr/sbin/diskutil");
    var args = [ "eject", this.mountPath.path ];
    var proc = {
      command:     cmd,
      arguments:   args,
      charset: null,
      done: function(result) {
        if (exitCode) Ec.ERROR_LOG("Installer failed with exit code "+result.exitCode);
      }
    };

    try {
      subprocess.call(proc).wait();
    } catch (ex) {
      Ec.ERROR_LOG("installGnuPG.jsm.cleanupMacOs: subprocess.call failed with '"+ex.toString()+"'\n");
    }

    Ec.DEBUG_LOG("installGnuPG.jsm: cleanupMacOs - remove package\n");
    this.installerFile.remove(false);
  },

  installWindows: function(deferred) {
    Ec.DEBUG_LOG("installGnuPG.jsm: installWindows\n");

    var proc = {
      command:     this.installerFile,
      arguments:   [],
      charset: null,
      done: function(result) {
        if (!result.exitCode)
          deferred.resolve();
      }
    };

    try {
      subprocess.call(proc);
    } catch (ex) {
      // Installation can fail on Windows 7 / 8 if UAC is required, trying
      // alternative method second

      Ec.DEBUG_LOG("installGnuPG.jsm: installWindows: subprocess.call failed with '"+ex.toString()+"'\n");

      var obs = {
        QueryInterface: XPCOMUtils.generateQI([ Ci.nsIObserver, Ci.nsISupports ]),

        observe: function (proc, aTopic, aData) {
          Ec.DEBUG_LOG("installGnuPG.jsm: installWindows.observe: topic='"+aTopic+"' \n");

          if (aTopic == "process-finished") {
            Ec.DEBUG_LOG("installGnuPG.jsm: installWindows finished\n");
            deferred.resolve();
          }
          else if (aTopic == "process-failed") {
            deferred.reject("Installer could not be started");
          }
        }
      };

      var p = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
      p.init(this.installerFile);
      p.runwAsync([], 0, obs, false);
    }

  },

  cleanupWindows: function() {
    Ec.DEBUG_LOG("installGnuPG.jsm: cleanupWindows - remove package\n");
    this.installerFile.remove(false);
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
        self.url = unescape(doc.getAttribute("url"));
        self.hash = sanitizeHash(doc.getAttribute("hash"));
        self.command = sanitizeFileName(doc.getAttribute("command"));
        self.mount = sanitizeFileName(doc.getAttribute("mount"));
        deferred.resolve();
      }
    }

    function onError(error) {
      deferred.reject("error");
      if (self.progressListener) {
        return self.progressListener.onError(error);
      }

      return false;
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
      oReq.addEventListener("error",
                       function(e) {
                         var error = createTCPErrorFromFailedXHR(oReq);
                         onError(error);
                       },
                       false);

      oReq.open("get", queryUrl + "?vEnigmail="+escape(Ec.getVersion())+ "&os=" + escape(os) + "&platform=" +
                escape(platform), true);
      oReq.send();
    }
    catch(ex) {
      deferred.reject(ex);
      Ec.writeException("installGnuPG.jsm", ex);

      if (self.progressListener)
        self.progressListener.onError("installGnuPG.downloadFailed");
    }

    return deferred.promise;
  },

  performDownload: function() {
    Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: "+ this.url+"\n");

    var self = this;
    var deferred = Promise.defer();

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

    function onError(error) {
      deferred.reject("error");
      if (self.progressListener)
        self.progressListener.onError(error);
    }

    function onLoaded(event) {
      Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: downloaded "+ event.loaded+"bytes\n");

      if (self.progressListener)
        self.progressListener.onDownloaded();

      try {
        performInstall(this.response).then(function _f() { performCleanup(); });
      }
      catch (ex) {
        Ec.writeException("installGnuPG.jsm", ex);

        if (self.progressListener)
          self.progressListener.onError("installGnuPG.installFailed");
      }
    }

    function performInstall(response) {
      var arraybuffer = response; // not responseText
      Ec.DEBUG_LOG("installGnuPG.jsm: performDownload: bytes "+arraybuffer.byteLength +"\n");

      try {
        var flags = 0x02 | 0x08 | 0x20;
        var fileOutStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
        self.installerFile = getTempDir();

        switch (Ec.getOS()) {
        case "Darwin":
          self.installerFile.append("gpgtools.dmg");
          self.performCleanup = self.cleanupMacOs;
          break;
        case "WINNT":
          self.installerFile.append("gpg4win.exe");
          self.performCleanup = self.cleanupWindows;
          break;
        default:
          self.installerFile.append("gpg-installer.bin");
          self.performCleanup = null;
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
            cont = self.progressListener.onWarning("hashSumMismatch");
          }

          if (! cont) {
            deferred.reject("Aborted due to hash sum error");
            return;
          }

        }

        switch (Ec.getOS()) {
        case "Darwin":
          self.installMacOs(deferred);
          break;
        case "WINNT":
          self.installWindows(deferred);
          break;
        default:
          self.installUnix(deferred);
        }

      }
      catch(ex) {
        deferred.reject(ex);
        Ec.writeException("installGnuPG.jsm", ex);

        if (self.progressListener)
          self.progressListener.onError("installGnuPG.installFailed");
      }

      return deferred.promise;
    }

    function performCleanup() {
      Ec.DEBUG_LOG("installGnuPG.jsm: performCleanup:\n");
      if (self.performCleanup) self.performCleanup();

      if (self.progressListener) {
        Ec.DEBUG_LOG("installGnuPG.jsm: performCleanup - onLoaded()\n");
        self.progressListener.onLoaded();
      }
    }

    try {
      // create a  XMLHttpRequest object
      var oReq = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

      oReq.addEventListener("load", onLoaded, false);
      oReq.addEventListener("error",
                       function(e) {
                         var error = createTCPErrorFromFailedXHR(oReq);
                         onError(error);
                       },
                       false);

      oReq.addEventListener("progress", onProgress, false);
      oReq.open("get", this.url, true);
      oReq.responseType = "arraybuffer";
      if (self.progressListener)
        self.progressListener.onStart({
          abort: function() {
            oReq.abort();
          }
        });
      oReq.send();
    }
    catch(ex) {
      deferred.reject(ex);
      Ec.writeException("installGnuPG.jsm", ex);

      if (self.progressListener)
        self.progressListener.onError("installGnuPG.downloadFailed");
    }

  }
}


var InstallGnuPG = {

  // check if there is a downloadable item for the given platform
  // returns true if item available
  checkAvailability: function() {
    switch (Ec.getOS()) {
    case "Darwin":
    case "WINNT":
      return true;
    }

    return false;
  },

  startInstaller: function(progressListener) {

    var i = new installer(progressListener);
    i.getDownloadUrl().
      then(function _dl() { i.performDownload() });
    return i;
  }
}
