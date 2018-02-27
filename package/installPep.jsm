/*global Components: false, escape: false, unescape: false, Uint8Array: false */
/* eslint no-invalid-this: 0 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailInstallPep"];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.importGlobalProperties(["XMLHttpRequest"]);
Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/app.jsm"); /*global EnigmailApp: false */
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */


const EXEC_FILE_PERMS = 0x1C0; // 0700


const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
  "@mozilla.org/network/file-output-stream;1";
const DIR_SERV_CONTRACTID = "@mozilla.org/file/directory_service;1";
const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";

const PEP_QUERY_URL = "https://www.enigmail.net/service/getPepDownload.svc";

var gInstallInProgress = 0;

function toHexString(charCode) {
  return ("0" + charCode.toString(16)).slice(-2);
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
    }
    catch (ex) {
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
      let nssErr = Math.abs(nsINSSErrorsService.NSS_SEC_ERROR_BASE) -
        (status & 0xffff);
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
      let sslErr = Math.abs(nsINSSErrorsService.NSS_SSL_ERROR_BASE) -
        (status & 0xffff);
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

  return {
    name: errName,
    type: errType
  };
}

function Installer(progressListener) {
  this.progressListener = progressListener;
}

Installer.prototype = {

  cleanupOnOs: function() {
    EnigmailLog.DEBUG("installPep.jsm.cleanupOnOs():\n");

    try {
      let extAppLauncher = Cc["@mozilla.org/mime;1"].getService(Ci.nsPIExternalAppLauncher);
      extAppLauncher.deleteTemporaryFileOnExit(this.installerFile);
    }
    catch (ex) {}

    if (this.progressListener) {
      this.progressListener.onInstalled();
    }
  },

  checkHashSum: function() {
    EnigmailLog.DEBUG("installPep.jsm: checkHashSum\n");
    var istream = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream);
    // open for reading
    istream.init(this.installerFile, 0x01, 292, 0); // octal 0444 - octal literals are deprecated

    var ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    ch.init(ch.SHA256);
    const PR_UINT32_MAX = 0xffffffff; // read entire file
    ch.updateFromStream(istream, PR_UINT32_MAX);
    var gotHash = ch.finish(false);

    // convert the binary hash data to a hex string.
    var hashStr = "";

    for (let i in gotHash) {
      hashStr += toHexString(gotHash.charCodeAt(i));
    }

    if (this.hash != hashStr) {
      EnigmailLog.DEBUG("installPep.jsm: checkHashSum - hash sums don't match: " + hashStr + "\n");
    }
    else
      EnigmailLog.DEBUG("installPep.jsm: checkHashSum - hash sum OK\n");

    return this.hash == hashStr;
  },

  getUrlObj: function() {
    let o = {
      url: this.url,
      hash: this.hash,
      comamnd: this.command,
      mount: this.mount
    };

    return o;
  },

  getDownloadUrl: function(on) {

    let deferred = PromiseUtils.defer();

    function reqListener() {
      // "this" is set by the calling XMLHttpRequest

      if (!this.responseText) {
        onError({
          type: "Network"
        });
        return;
      }
      if (typeof(this.responseText) == "string") {
        EnigmailLog.DEBUG("installPep.jsm: getDownloadUrl.reqListener: got: " + this.responseText + "\n");

        try {
          let doc = JSON.parse(this.responseText);
          self.url = doc.url;
          self.hash = sanitizeHash(doc.hash);
          deferred.resolve();
        }
        catch (ex) {
          EnigmailLog.DEBUG("installPep.jsm: getDownloadUrl.reqListener: exception: " + ex.toString() + "\n");

          onError({
            type: "JSON"
          });
        }
      }
    }

    function onError(error) {
      deferred.reject("error");
      gInstallInProgress = 0;
      if (self.progressListener) {
        return self.progressListener.onError(error);
      }

      return false;
    }


    EnigmailLog.DEBUG("installPep.jsm: getDownloadUrl: start request\n");

    let queryUrl = PEP_QUERY_URL;

    // if ENIGMAIL_PEP_DOWNLOAD_URL env variable is set, use that instead of the
    // official URL (for testing)
    let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    if (env.get("ENIGMAIL_PEP_DOWNLOAD_URL")) {
      queryUrl = env.get("ENIGMAIL_PEP_DOWNLOAD_URL");
    }

    var self = this;

    try {
      var xulRuntime = Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime);
      var platform = xulRuntime.XPCOMABI.toLowerCase();
      var os = EnigmailOS.getOS().toLowerCase();

      // create a  XMLHttpRequest object
      var oReq = new XMLHttpRequest();
      oReq.onload = reqListener;
      oReq.addEventListener("error",
        function(e) {
          var error = createTCPErrorFromFailedXHR(oReq);
          onError(error);
        },
        false);
      queryUrl = queryUrl + "?vEnigmail=" + escape(EnigmailApp.getVersion()) + "&os=" + escape(os) +
        "&platform=" + escape(platform);

      EnigmailLog.DEBUG("installPep.jsm: getDownloadUrl: accessing '" + queryUrl + "'\n");

      oReq.open("get", queryUrl, true);
      oReq.send();
    }
    catch (ex) {
      deferred.reject(ex);
      EnigmailLog.writeException("installPep.jsm", ex);

      if (self.progressListener)
        self.progressListener.onError({
          type: "installPep.downloadFailed"
        });
    }

    return deferred.promise;
  },

  performDownload: function() {
    EnigmailLog.DEBUG("installPep.jsm: performDownload: " + this.url + "\n");

    var self = this;
    var deferred = PromiseUtils.defer();

    function onProgress(event) {

      if (event.lengthComputable) {
        var percentComplete = event.loaded / event.total;
        EnigmailLog.DEBUG("installPep.jsm: performDownload: " + percentComplete * 100 + "% loaded\n");
      }
      else {
        EnigmailLog.DEBUG("installPep.jsm: performDownload: got " + event.loaded + "bytes\n");
      }

    }

    function onError(error) {
      deferred.reject("error");
      if (self.progressListener)
        self.progressListener.onError(error);
    }

    function onLoaded(event) {
      EnigmailLog.DEBUG("installPep.jsm: performDownload: downloaded " + event.loaded + "bytes\n");

      try {
        // "this" is set by the calling XMLHttpRequest
        performInstall(this.response).then(function _f() {
          performCleanup();
          gInstallInProgress = 0;
        });
      }
      catch (ex) {
        EnigmailLog.writeException("installPep.jsm", ex);

        gInstallInProgress = 0;
        if (self.progressListener)
          self.progressListener.onError({
            type: "installPep.installFailed"
          });
      }
    }

    function performInstall(response) {
      var arraybuffer = response; // not responseText
      EnigmailLog.DEBUG("installPep.jsm: performInstall: bytes " + arraybuffer.byteLength + "\n");

      try {
        var flags = 0x02 | 0x08 | 0x20;
        var fileOutStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
        self.installerFile = EnigmailFiles.getTempDirObj().clone();
        self.performCleanup = self.cleanupOnOs;
        self.installerFile.append("pepmda.zip");

        self.installerFile.createUnique(self.installerFile.NORMAL_FILE_TYPE, EXEC_FILE_PERMS);

        EnigmailLog.DEBUG("installPep.jsm: performInstall: writing file to " + self.installerFile.path + "\n");

        fileOutStream.init(self.installerFile, flags, EXEC_FILE_PERMS, 0);

        var binStr = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);

        binStr.setOutputStream(fileOutStream.QueryInterface(Ci.nsIOutputStream));

        var buf = new Uint8Array(arraybuffer);
        binStr.writeByteArray(buf, buf.length);
        binStr.flush();
        binStr.close();
        fileOutStream.close();

        if (!self.checkHashSum()) {
          EnigmailLog.ERROR("installPep.jsm: performInstall: HASH sum mismatch!\n");
          deferred.reject("Aborted due to hash sum error");
          return null;
        }

        let tempDir = EnigmailApp.getProfileDirectory();
        tempDir.append("pep_tmp");
        tempDir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 509 /* = 0775 */ );

        let pepDir = EnigmailApp.getProfileDirectory();
        pepDir.append("pepmda");

        if (EnigmailFiles.extractZipFile(self.installerFile, tempDir)) {

          if (pepDir.exists()) {
            if (self.progressListener) {
              self.progressListener.stopPep();
            }
            pepDir.remove(true);
          }

          pepDir = tempDir.clone();
          pepDir.append("pepmda");
          pepDir.moveTo(EnigmailApp.getProfileDirectory(), "pepmda");
          tempDir.remove(true);
          deferred.resolve();
        }
        else {
          deferred.reject("Could not unzip " + self.installerFile.path + " to " + tempDir.path + "\n");
        }
      }
      catch (ex) {
        deferred.reject(ex);
        EnigmailLog.writeException("installPep.jsm", ex);

        if (self.progressListener)
          self.progressListener.onError({
            type: "installPep.installFailed"
          });
      }

      return deferred.promise;
    }

    function performCleanup() {
      EnigmailLog.DEBUG("installPep.jsm: performCleanup:\n");
      try {
        if (self.performCleanup) self.performCleanup();
      }
      catch (ex) {}

    }

    try {
      // "main" part of performDownload

      if (!this.url || this.url.length === 0) {
        onError({
          type: "downloadPep.noURL"
        });
        return;
      }

      var oReq = new XMLHttpRequest();

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
      oReq.send();
    }
    catch (ex) {
      deferred.reject(ex);
      EnigmailLog.writeException("installPep.jsm", ex);

      if (self.progressListener)
        self.progressListener.onError({
          type: "installPep.downloadFailed"
        });
    }

  }
};


var EnigmailInstallPep = {

  /**
   * Start downloading and installing pEp
   *
   * @param progressListener: Object (optional)
   *     progressListener needs to implement the following methods:
   *       void    onError    ({type: errorType, name: errorName})
   *       void    onInstalled ()
   *
   * @return Installer object
   */

  startInstaller: function(progressListener) {
    EnigmailLog.DEBUG("installPep.jsm: startInstaller()\n");

    if (gInstallInProgress > 0) return null;

    gInstallInProgress = 1;

    let i = new Installer(progressListener);
    i.getDownloadUrl(i).
    then(function _gotUrl() {
      i.performDownload();
    }).catch(function _err() {
      gInstallInProgress = 0;
      i.cleanupOnOs();
    });
    return i;
  },

  isPepInstallerAvailable: function() {
    EnigmailLog.DEBUG("installPep.jsm: isPepInstallerAvailable()\n");

    let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
    let urlObj = null;

    let i = new Installer(null);

    i.getDownloadUrl(i).
    then(function _gotUrl() {
      urlObj = i.getUrlObj();
      inspector.exitNestedEventLoop();
    }).
    catch(function _err(data) {
      inspector.exitNestedEventLoop();
    });

    inspector.enterNestedEventLoop(0);

    return (urlObj ? urlObj.url !== null && urlObj.url !== "" : false);
  }
};
