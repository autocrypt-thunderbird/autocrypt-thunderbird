/*global Components:false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailKeyServer"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.importGlobalProperties(["XMLHttpRequest"]);
Cu.import("chrome://enigmail/content/modules/subprocess.jsm"); /*global subprocess: false */
Cu.import("chrome://enigmail/content/modules/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("chrome://enigmail/content/modules/files.jsm"); /*global EnigmailFiles: false */
Cu.import("chrome://enigmail/content/modules/os.jsm"); /*global EnigmailOS: false */
Cu.import("chrome://enigmail/content/modules/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("chrome://enigmail/content/modules/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("chrome://enigmail/content/modules/httpProxy.jsm"); /*global EnigmailHttpProxy: false */
Cu.import("chrome://enigmail/content/modules/core.jsm"); /*global EnigmailCore: false */
Cu.import("chrome://enigmail/content/modules/log.jsm"); /*global EnigmailLog: false */
Cu.import("chrome://enigmail/content/modules/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("chrome://enigmail/content/modules/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("chrome://enigmail/content/modules/keyserverUris.jsm"); /*global EnigmailKeyserverURIs: false */
Cu.import("chrome://enigmail/content/modules/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("chrome://enigmail/content/modules/stdlib.jsm"); /*global EnigmailStdlib: false */
Cu.import("chrome://enigmail/content/modules/data.jsm"); /*global EnigmailData: false */
Cu.import("chrome://enigmail/content/modules/webKey.jsm"); /*global EnigmailWks: false */
Cu.import("chrome://enigmail/content/modules/constants.jsm"); /*global EnigmailConstants: false */

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

const ENIG_DEFAULT_HKP_PORT = "11371";
const ENIG_DEFAULT_HKPS_PORT = "443";
const ENIG_DEFAULT_LDAP_PORT = "389";

/**
 KeySrvListener API
 Object implementing:
  - onProgress: function(percentComplete) [only implemented for download()]
  - onCancel: function() - the body will be set by the callee
*/


function parseKeyserverUrl(keyserver) {
  if (keyserver.length > 1024) {
    // insane length of keyserver is forbidden
    throw Components.results.NS_ERROR_FAILURE;
  }

  keyserver = keyserver.toLowerCase().trim();
  let protocol = "";
  if (keyserver.search(/^[a-zA-Z0-9_.-]+:\/\//) === 0) {
    protocol = keyserver.replace(/^([a-zA-Z0-9_.-]+)(:\/\/.*)/, "$1");
    keyserver = keyserver.replace(/^[a-zA-Z0-9_.-]+:\/\//, "");
  }
  else {
    protocol = "hkp";
  }

  let port = "";
  switch (protocol) {
    case "hkp":
      port = ENIG_DEFAULT_HKP_PORT;
      break;
    case "hkps":
      port = ENIG_DEFAULT_HKPS_PORT;
      break;
    case "ldap":
      port = ENIG_DEFAULT_LDAP_PORT;
      break;
  }

  let m = keyserver.match(/^(.+)(:)(\d+)$/);
  if (m && m.length == 4) {
    keyserver = m[1];
    port = m[3];
  }

  if (keyserver.search(/^(keys.mailvelope.com|api.protonmail.ch)$/) === 0) {
    protocol = "hkps";
    port = ENIG_DEFAULT_HKPS_PORT;
  }

  return {
    protocol: protocol,
    host: keyserver,
    port: port
  };
}

const keyServerBuiltin = {
  /**
   * parse a keyserver specification and return host, protocol and port
   *
   * @param keyserver: String - name of keyserver with optional protocol and port.
   *                       E.g. keys.gnupg.net, hkps://keys.gnupg.net:443
   *
   * @return Object: {port, host, protocol} (all Strings)
   */

  buildHkpPayload: function(actionFlag, searchTerms) {
    let payLoad = null,
      keyData = "";

    switch (actionFlag) {
      case EnigmailConstants.UPLOAD_KEY:
        keyData = EnigmailKeyRing.extractKey(false, searchTerms, null, {}, {});
        if (keyData.length === 0) return null;

        payLoad = "keytext=" + encodeURIComponent(keyData);
        return payLoad;

      case EnigmailConstants.DOWNLOAD_KEY:
      case EnigmailConstants.SEARCH_KEY:
        return "";
    }

    // other actions are not yet implemented
    return null;
  },

  /**
   * return the URL and the HTTP access method for a given action
   */
  createRequestUrl: function(keyserver, actionFlag, searchTerm) {
    let keySrv = parseKeyserverUrl(keyserver);

    let method = "GET";
    let protocol;

    switch (keySrv.protocol) {
      case "hkp":
        protocol = "http";
        break;
      case "ldap":
        throw Components.results.NS_ERROR_FAILURE;
      default: // equals to hkps
        protocol = "https";
    }

    let url = protocol + "://" + keySrv.host + ":" + keySrv.port;

    if (actionFlag === EnigmailConstants.UPLOAD_KEY) {
      url += "/pks/add";
      method = "POST";
    }
    else if (actionFlag === EnigmailConstants.DOWNLOAD_KEY) {
      if (searchTerm.indexOf("0x") !== 0) {
        searchTerm = "0x" + searchTerm;
      }
      url += "/pks/lookup?search=" + searchTerm + "&op=get&options=mr";
    }
    else if (actionFlag === EnigmailConstants.SEARCH_KEY) {
      url += "/pks/lookup?search=" + escape(searchTerm) + "&fingerprint=on&op=index&options=mr";
    }

    return {
      url: url,
      method: method
    };
  },

  /**
   * Upload, search or download keys from a keyserver
   * @param actionFlag:  Number  - Keyserver Action Flags: from EnigmailConstants
   * @param keyId:      String  - space-separated list of search terms or key IDs
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<Number (Status-ID)>
   */
  accessKeyServer: function(actionFlag, keyserver, keyId, listener) {
    EnigmailLog.DEBUG(`keyserver.jsm: keyServerBuiltin: accessKeyServer(${keyserver})\n`);

    return new Promise((resolve, reject) => {
      let xmlReq = null;
      if (listener && typeof(listener) === "object") {
        listener.onCancel = function() {
          EnigmailLog.DEBUG(`keyserver.jsm: keyServerBuiltin: accessKeyServer - onCancel() called\n`);
          if (xmlReq) {
            xmlReq.abort();
          }
          reject(-1);
        };
      }
      if (actionFlag === EnigmailConstants.REFRESH_KEY) {
        // we don't (need to) distinguish between refresh and download for our internal protocol
        actionFlag = EnigmailConstants.DOWNLOAD_KEY;
      }

      let payLoad = this.buildHkpPayload(actionFlag, keyId);
      if (payLoad === null) {
        reject(10);
        return;
      }

      let errorCode = 0;

      xmlReq = new XMLHttpRequest();

      xmlReq.onload = function _onLoad() {
        EnigmailLog.DEBUG("keyserver.jsm: onload(): status=" + xmlReq.status + "\n");
        switch (actionFlag) {
          case EnigmailConstants.UPLOAD_KEY:
            EnigmailLog.DEBUG("keyserver.jsm: onload: " + xmlReq.responseText + "\n");
            if (xmlReq.status >= 400) {

              reject(1);
            }
            else {
              resolve(0);
            }
            return;

          case EnigmailConstants.SEARCH_KEY:
            if (xmlReq.status >= 400) {
              reject(3);
            }
            else {
              resolve(xmlReq.responseText);
            }
            return;

          case EnigmailConstants.DOWNLOAD_KEY:
            if (xmlReq.status >= 400 && xmlReq.status < 500) {
              // key not found
              resolve(1);
            }
            else if (xmlReq.status >= 500) {
              EnigmailLog.DEBUG("keyserver.jsm: onload: " + xmlReq.responseText + "\n");
              reject(3);
            }
            else {
              let errorMsgObj = {};
              let r = EnigmailKeyRing.importKey(null, false, xmlReq.responseText, "", errorMsgObj);

              if (r === 0) {
                resolve(0);
              }
              else {
                reject(4);
              }
            }
            return;
        }
        resolve(-1);
      };

      xmlReq.onerror = function(e) {
        EnigmailLog.DEBUG("keyserver.jsm: accessKeyServer: onerror: " + e + "\n");
        reject(5);
      };

      xmlReq.onloadend = function() {
        EnigmailLog.DEBUG("keyserver.jsm: accessKeyServer: loadEnd\n");
      };

      let {
        url, method
      } = this.createRequestUrl(keyserver, actionFlag, keyId);

      EnigmailLog.DEBUG(`keyserver.jsm: accessKeyServer: requesting ${url}\n`);
      xmlReq.open(method, url);
      xmlReq.send(payLoad);
    });
  },

  /**
   * Download keys from a keyserver
   * @param keyIDs:      String  - space-separated list of search terms or key IDs
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<...>
   */
  download: async function(keyIDs, keyserver, listener = null) {
    let keyIdArr = keyIDs.split(/ +/);
    let downloadedArr = [];
    let res = 0;

    for (let i = 0; i < keyIdArr.length; i++) {
      try {
        let r = await this.accessKeyServer(EnigmailConstants.DOWNLOAD_KEY, keyserver, keyIdArr[i], listener);
        if (r === 0) {
          downloadedArr.push(keyIdArr[i]);
        }
      }
      catch (ex) {
        res = ex;
      }

      if (listener && "onProgress" in listener) {
        listener.onProgress(i / keyIdArr.length);
      }
    }

    return {
      result: res,
      gotKeys: downloadedArr
    };
  },

  /**
   * Upload keys to a keyserver
   * @param keyIDs: String  - space-separated list of search terms or key IDs
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<...>
   */
  upload: async function(keyIDs, keyserver, listener = null) {

    try {
      return await this.accessKeyServer(EnigmailConstants.UPLOAD_KEY, keyserver, keyIDs, listener);
    }
    catch (ex) {
      return ex;
    }
  },

  /**
   * Search for keys on a keyserver
   * @param searchTerm:  String  - search term
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *

   * @return:   Promise<Array of PubKeys>
   *    PubKeys: Object with:
   *      - keyId: String
   *      - keyLen: String
   *      - keyType: String
   *      - created: String (YYYY-MM-DD)
   *      - status: String: one of ''=valid, r=revoked, e=expired
   *      - uid: Array of Strings with UIDs
   */
  search: async function(searchTerm, keyserver, listener = null) {
    let found = [];
    let key = null;

    try {
      let r = await this.accessKeyServer(EnigmailConstants.SEARCH_KEY, keyserver, searchTerm, listener);

      let lines = r.split(/\r?\n/);

      for (var i = 0; i < lines.length; i++) {
        let line = lines[i].split(/:/).map(unescape);
        if (line.length <= 1) continue;

        switch (line[0]) {
          case "info":
            if (line[1] !== "1") {
              // protocol version not supported
              return [];
            }
            break;
          case "pub":
            if (line.length >= 6) {
              if (key) {
                found.push(key);
                key = null;
              }
              let dat = new Date(line[4] * 1000);
              let month = String(dat.getMonth() + 101).substr(1);
              let day = String(dat.getDate() + 100).substr(1);
              key = {
                keyId: line[1],
                keyLen: line[3],
                keyType: line[2],
                created: dat.getFullYear() + "-" + month + "-" + day,
                uid: [],
                status: line[6]
              };
            }
            break;
          case "uid":
            key.uid.push(EnigmailData.convertToUnicode(line[1].trim(), "utf-8"));
        }
      }

      if (key) {
        found.push(key);
      }
    }
    catch (ex) {}

    return found;
  }
};


const EnigmailKeyServer = {
  /**
   * Download keys from a keyserver
   * @param keyIDs:      String  - space-separated list of search terms or key IDs
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<...>
   */
  download: function(keyIDs, keyserver = null, listener) {
    if (keyserver === null) {
      keyserver = EnigmailKeyserverURIs.getDefaultKeyServer();
    }
    return keyServerBuiltin.download(keyIDs, keyserver, listener);
  },

  /**
   * Upload keys to a keyserver
   * @param keyIDs:      String  - space-separated list of search terms or key IDs
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<resultStatus>
   */

  upload: function(keyIDs, keyserver = null, listener) {
    if (keyserver === null) {
      keyserver = EnigmailKeyserverURIs.getDefaultKeyServer();
    }
    return keyServerBuiltin.upload(keyIDs, keyserver, listener);
  },

  /**
   * Upload keys to a keyserver
   * @param searchString: String - search term
   * @param keyserver:    String  - keyserver URL (optionally incl. protocol)
   * @param listener:     optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<...>
   */

  search: function(searchString, keyserver = null, listener) {
    if (keyserver === null) {
      keyserver = EnigmailKeyserverURIs.getDefaultKeyServer();
    }
    return keyServerBuiltin.search(searchString, keyserver, listener);
  }
};
