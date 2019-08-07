/*global Components:false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailKeyServer"];

Components.utils.importGlobalProperties(["XMLHttpRequest"]);
const EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
const EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
const EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
const EnigmailOS = ChromeUtils.import("chrome://autocrypt/content/modules/os.jsm").EnigmailOS;
const EnigmailXhrUtils = ChromeUtils.import("chrome://autocrypt/content/modules/xhrUtils.jsm").EnigmailXhrUtils;

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";


function createError(errId) {
  let msg = "";
  switch (errId) {
    case EnigmailConstants.KEYSERVER_ERR_ABORTED:
      msg = EnigmailLocale.getString("keyserver.error.aborted");
      break;
    case EnigmailConstants.KEYSERVER_ERR_SERVER_ERROR:
      msg = EnigmailLocale.getString("keyserver.error.serverError");
      break;
    case EnigmailConstants.KEYSERVER_ERR_SERVER_UNAVAILABLE:
      msg = EnigmailLocale.getString("keyserver.error.unavailable");
      break;
    case EnigmailConstants.KEYSERVER_ERR_SECURITY_ERROR:
      msg = EnigmailLocale.getString("keyserver.error.securityError");
      break;
    case EnigmailConstants.KEYSERVER_ERR_CERTIFICATE_ERROR:
      msg = EnigmailLocale.getString("keyserver.error.certificateError");
      break;
    case EnigmailConstants.KEYSERVER_ERR_IMPORT_ERROR:
      msg = EnigmailLocale.getString("keyserver.error.importError");
      break;
    case EnigmailConstants.KEYSERVER_ERR_UNKNOWN:
      msg = EnigmailLocale.getString("keyserver.error.unknown");
      break;
  }

  return {
    result: errId,
    errorDetails: msg
  };
}

/**
 Object to handle Hagrid (keys.openpgp.org) requests
 */
const accessVksServer = {
  /**
   * return the URL and the HTTP access method for a given action
   */
  createRequestUrl: function(actionFlag, searchTerm) {
    let contentType = "text/plain;charset=UTF-8";

    let method = "GET";

    let url = "https://keys.openpgp.org";

    if (actionFlag === EnigmailConstants.UPLOAD_KEY) {
      url += "/vks/v1/upload";
      method = "POST";
      contentType = "application/json";
    } else if (actionFlag === EnigmailConstants.GET_CONFIRMATION_LINK) {
      url += "/vks/v1/request-verify";
      method = "POST";
      contentType = "application/json";
    } else if (actionFlag === EnigmailConstants.DOWNLOAD_KEY) {
      if (searchTerm) {
        let lookup = "/vks/v1/by-email/" + searchTerm;
        if (searchTerm.indexOf("0x") === 0) {
          searchTerm = searchTerm.substr(2);
          if (searchTerm.length == 16 && searchTerm.search(/^[A-F0-9]+$/) === 0) {
            lookup = "/vks/v1/by-keyid/" + searchTerm;
          } else if (searchTerm.length == 40 && searchTerm.search(/^[A-F0-9]+$/) === 0) {
            lookup = "/vks/v1/by-fingerprint/" + searchTerm;
          }
        }
        url += lookup;
      }
    } else if (actionFlag === EnigmailConstants.SEARCH_KEY) {
      url += "/pks/lookup?search=" + searchTerm + "&fingerprint=on&op=index&options=mr";
    }

    return {
      url: url,
      method: method,
      contentType: contentType
    };
  },

  /**
   * Upload, search or download keys from a keyserver
   * @param keyId:       String  - space-separated list of search terms or key IDs
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<Number (Status-ID)>
   */
  accessKeyServer: function(keyserver, keyId, listener) {
    EnigmailLog.DEBUG(`keyserver.jsm: accessVksServer.accessKeyServer()\n`);
    if (keyserver === null) {
      keyserver = "keys.openpgp.org";
    }

    return new Promise((resolve, reject) => {
      let xmlReq = null;
      if (listener && typeof(listener) === "object") {
        listener.onCancel = function() {
          EnigmailLog.DEBUG(`keyserver.jsm: accessVksServer.accessKeyServer - onCancel() called\n`);
          if (xmlReq) {
            xmlReq.abort();
          }
          reject(createError(EnigmailConstants.KEYSERVER_ERR_ABORTED));
        };
      }

      xmlReq = new XMLHttpRequest();

      xmlReq.onload = function _onLoad() {
        if (xmlReq.status >= 400 && xmlReq.status < 500) {
          // key not found
          resolve(null);
        } else if (xmlReq.status >= 500) {
          EnigmailLog.DEBUG("keyserver.jsm: accessVksServer.onload: " + xmlReq.responseText + "\n");
          reject(createError(EnigmailConstants.KEYSERVER_ERR_SERVER_ERROR));
        } else {
          resolve(xmlReq.responseText);
        }
        return;
      };

      xmlReq.onerror = function(e) {
        EnigmailLog.DEBUG("keyserver.jsm: accessVksServer.accessKeyServer: onerror: " + e + "\n");
        let err = EnigmailXhrUtils.createTCPErrorFromFailedXHR(e.target);
        switch (err.type) {
          case 'SecurityCertificate':
            reject(createError(EnigmailConstants.KEYSERVER_ERR_CERTIFICATE_ERROR));
            break;
          case 'SecurityProtocol':
            reject(createError(EnigmailConstants.KEYSERVER_ERR_SECURITY_ERROR));
            break;
          case 'Network':
            reject(createError(EnigmailConstants.KEYSERVER_ERR_SERVER_UNAVAILABLE));
            break;
        }
        reject(createError(EnigmailConstants.KEYSERVER_ERR_SERVER_UNAVAILABLE));
      };

      xmlReq.onloadend = function() {
        EnigmailLog.DEBUG("keyserver.jsm: accessVksServer.accessKeyServer: loadEnd\n");
      };

      let {
        url,
        method,
        contentType
      } = this.createRequestUrl(EnigmailConstants.DOWNLOAD_KEY, keyId);

      EnigmailLog.DEBUG(`keyserver.jsm: accessVksServer.accessKeyServer: requesting ${method} for ${url}\n`);
      xmlReq.open(method, url);
      xmlReq.setRequestHeader("Content-Type", contentType);
      xmlReq.send();
    });
  },

  download: async function(searchTerm) {
    EnigmailLog.DEBUG(`keyserver.jsm: accessVksServer.download(${searchTerm})\n`);

    let r = await this.accessKeyServer(null, searchTerm, null);
    return {
      result: 0,
      errorDetails: "",
      keyData: r
    };
  }
};

var EnigmailKeyServer = {
  download: function(searchTerm) {
    return accessVksServer.download(searchTerm);
  }
};
