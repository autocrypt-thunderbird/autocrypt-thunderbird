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



/**
 * parse a keyserver specification and return host, protocol and port
 *
 * @param keyserver: String - name of keyserver with optional protocol and port.
 *                       E.g. keys.gnupg.net, hkps://keys.gnupg.net:443
 *
 * @return Object: {port, host, protocol} (all Strings)
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

  if (keyserver.search(/^(keys\.mailvelope\.com|api\.protonmail\.ch)$/) === 0) {
    protocol = "hkps";
    port = ENIG_DEFAULT_HKPS_PORT;
  }
  if (keyserver.search(/^(keybase\.io)$/) === 0) {
    protocol = "keybase";
    port = ENIG_DEFAULT_HKPS_PORT;
  }

  return {
    protocol: protocol,
    host: keyserver,
    port: port
  };
}


/**
 Object to handle HKP/HKPS requests via builtin XMLHttpRequest()
 */
const accessHkpInternal = {
  /**
   * Create the payload of hkp requests (upload only)
   *
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
    EnigmailLog.DEBUG(`keyserver.jsm: accessHkpInternal: accessKeyServer(${keyserver})\n`);

    return new Promise((resolve, reject) => {
      let xmlReq = null;
      if (listener && typeof(listener) === "object") {
        listener.onCancel = function() {
          EnigmailLog.DEBUG(`keyserver.jsm: accessHkpInternal: accessKeyServer - onCancel() called\n`);
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
            if (xmlReq.status === 404) {
              // key not found
              resolve(0);
            }
            else if (xmlReq.status >= 400) {
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
              let errorMsgObj = {},
                importedKeysObj = {};
              let r = EnigmailKeyRing.importKey(null, false, xmlReq.responseText, "", errorMsgObj, importedKeysObj);
              if (r === 0) {
                resolve(importedKeysObj.value);
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
    EnigmailLog.DEBUG(`keyserver.jsm: accessHkpInternal.download(${keyIDs})\n`);
    let keyIdArr = keyIDs.split(/ +/);
    let downloadedArr = [];
    let res = 0;

    for (let i = 0; i < keyIdArr.length; i++) {
      try {
        let r = await this.accessKeyServer(EnigmailConstants.DOWNLOAD_KEY, keyserver, keyIdArr[i], listener);
        if (Array.isArray(r)) {
          downloadedArr = downloadedArr.concat(r);
        }
      }
      catch (ex) {
        res = ex;
      }

      if (listener && "onProgress" in listener) {
        listener.onProgress((i + 1) / keyIdArr.length * 100);
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
    EnigmailLog.DEBUG(`keyserver.jsm: accessHkpInternal.upload(${keyIDs})\n`);

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
   * @return:   Promise<Object>
   *    - result: Number
   *    - pubKeys: Array of Object:
   *         PubKeys: Object with:
   *           - keyId: String
   *           - keyLen: String
   *           - keyType: String
   *           - created: String (YYYY-MM-DD)
   *           - status: String: one of ''=valid, r=revoked, e=expired
   *           - uid: Array of Strings with UIDs
   */
  search: async function(searchTerm, keyserver, listener = null) {
    EnigmailLog.DEBUG(`keyserver.jsm: accessHkpInternal.search(${searchTerm})\n`);
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
              return {
                result: 1,
                pubKeys: found
              };
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
    catch (ex) {
      return {
        result: ex,
        pubKeys: found
      };
    }

    return {
      result: 0,
      pubKeys: found
    };
  }
};

/**
 Object to handle KeyBase requests (search & download only)
 */
const accessKeyBase = {
  /**
   * return the URL and the HTTP access method for a given action
   */
  createRequestUrl: function(actionFlag, searchTerm) {
    const method = "GET";

    let url = "https://keybase.io/_/api/1.0/user/";

    if (actionFlag === EnigmailConstants.UPLOAD_KEY) {
      // not supported
      throw Components.results.NS_ERROR_FAILURE;
    }
    else if (actionFlag === EnigmailConstants.DOWNLOAD_KEY) {
      if (searchTerm.indexOf("0x") === 0) {
        searchTerm = searchTerm.substr(0, 40);
      }
      url += "lookup.json?key_fingerprint=" + escape(searchTerm) + "&fields=public_keys";
    }
    else if (actionFlag === EnigmailConstants.SEARCH_KEY) {
      url += "autocomplete.json?q=" + escape(searchTerm);
    }

    return {
      url: url,
      method: "GET"
    };
  },

  /**
   * Upload, search or download keys from a keyserver
   * @param actionFlag:  Number  - Keyserver Action Flags: from EnigmailConstants
   * @param keyId:      String  - space-separated list of search terms or key IDs
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<Number (Status-ID)>
   */
  accessKeyServer: function(actionFlag, keyId, listener) {
    EnigmailLog.DEBUG(`keyserver.jsm: accessKeyBase: accessKeyServer()\n`);

    return new Promise((resolve, reject) => {
      let xmlReq = null;
      if (listener && typeof(listener) === "object") {
        listener.onCancel = function() {
          EnigmailLog.DEBUG(`keyserver.jsm: accessKeyBase: accessKeyServer - onCancel() called\n`);
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

      let errorCode = 0;

      xmlReq = new XMLHttpRequest();

      xmlReq.onload = function _onLoad() {
        EnigmailLog.DEBUG("keyserver.jsm: onload(): status=" + xmlReq.status + "\n");
        switch (actionFlag) {
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
              resolve([]);
            }
            else if (xmlReq.status >= 500) {
              EnigmailLog.DEBUG("keyserver.jsm: onload: " + xmlReq.responseText + "\n");
              reject(3);
            }
            else {
              try {
                let resp = JSON.parse(xmlReq.responseText);
                let imported = [];

                if (resp.status.code === 0) {
                  for (let hit in resp.them) {
                    EnigmailLog.DEBUG(JSON.stringify(resp.them[hit].public_keys.primary) + "\n");

                    if (resp.them[hit] !== null) {
                      let errorMsgObj = {},
                        importedKeysObj = {};
                      let r = EnigmailKeyRing.importKey(null, false, resp.them[hit].public_keys.primary.bundle, "", errorMsgObj, importedKeysObj);
                      if (r === 0) {
                        imported.push(importedKeysObj.value);
                      }
                    }
                  }
                }
                resolve(imported);
              }
              catch (ex) {
                reject(4);
              }
            }
            return;
        }
        resolve(-1);
      };

      xmlReq.onerror = function(e) {
        EnigmailLog.DEBUG("keyserver.jsm: accessKeyBase: onerror: " + e + "\n");
        reject(5);
      };

      xmlReq.onloadend = function() {
        EnigmailLog.DEBUG("keyserver.jsm: accessKeyBase: loadEnd\n");
      };

      let {
        url, method
      } = this.createRequestUrl(actionFlag, keyId);

      EnigmailLog.DEBUG(`keyserver.jsm: accessKeyBase: requesting ${url}\n`);
      xmlReq.open(method, url);
      xmlReq.send("");
    });
  },

  /**
   * Download keys from a keyserver
   * @param keyIDs:      String  - space-separated list of search terms or key IDs
   * @param keyserver:   (not used for keybase)
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
        let r = await this.accessKeyServer(EnigmailConstants.DOWNLOAD_KEY, keyIdArr[i], listener);
        if (r.length > 0) {
          downloadedArr = downloadedArr.concat(r);
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
   * Search for keys on a keyserver
   * @param searchTerm:  String  - search term
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<Object>
   *    - result: Number
   *    - pubKeys: Array of Object:
   *         PubKeys: Object with:
   *           - keyId: String
   *           - keyLen: String
   *           - keyType: String
   *           - created: String (YYYY-MM-DD)
   *           - status: String: one of ''=valid, r=revoked, e=expired
   *           - uid: Array of Strings with UIDs

   */
  search: async function(searchTerm, keyserver, listener = null) {
    let found = [];
    let key = {};

    try {
      let r = await this.accessKeyServer(EnigmailConstants.SEARCH_KEY, searchTerm, listener);

      let res = JSON.parse(r);
      let completions = res.completions;

      for (let hit in completions) {
        if (completions[hit] && completions[hit].components.key_fingerprint !== undefined) {
          let uid = completions[hit].components.username.val;
          if ("full_name" in completions[hit].components) {
            uid += " (" + completions[hit].components.full_name.val + ")";
          }
          let key = {
            keyId: completions[hit].components.key_fingerprint.val.toUpperCase(),
            keyLen: completions[hit].components.key_fingerprint.nbits.toString(),
            keyType: completions[hit].components.key_fingerprint.algo.toString(),
            created: 0, //date.toDateString(),
            uid: [uid],
            status: ""
          };
          found.push(key);
        }
      }
    }
    catch (ex) {
      return {
        result: ex,
        pubKeys: found
      };
    }

    return {
      result: 0,
      pubKeys: found
    };
  },

  upload: function() {
    throw Components.results.NS_ERROR_FAILURE;
  }
};

function getAccessType(keyserver) {
  if (keyserver === null) {
    keyserver = EnigmailKeyserverURIs.getDefaultKeyServer();
  }

  let srv = parseKeyserverUrl(keyserver);
  if (srv.protocol === "keybase") {
    return accessKeyBase;
  }
  else {
    return accessHkpInternal;
  }
}

var EnigmailKeyServer = {
  /**
   * Download keys from a keyserver
   * @param keyIDs:      String  - space-separated list of FPRs or key IDs
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<Object>
   *     Object: - result: Number           - result Code (0 = OK),
   *             - gotKeys: Array of String - imported key FPR
   */
  download: function(keyIDs, keyserver = null, listener) {
    let acc = getAccessType(keyserver);
    return acc.download(keyIDs, keyserver, listener);
  },

  /**
   * Upload keys to a keyserver
   * @param keyIDs:      String  - space-separated list of key IDs or FPR
   * @param keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @param listener:    optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<resultStatus>
   */

  upload: function(keyIDs, keyserver = null, listener) {
    let acc = getAccessType(keyserver);
    return acc.upload(keyIDs, keyserver, listener);
  },

  /**
   * Upload keys to a keyserver
   * @param searchString: String - search term
   * @param keyserver:    String  - keyserver URL (optionally incl. protocol)
   * @param listener:     optional Object implementing the KeySrvListener API (above)
   *
   * @return:   Promise<Object>
   *    - result: Number
   *    - pubKeys: Array of Object:
   *         PubKeys: Object with:
   *           - keyId: String
   *           - keyLen: String
   *           - keyType: String
   *           - created: String (YYYY-MM-DD)
   *           - status: String: one of ''=valid, r=revoked, e=expired
   *           - uid: Array of Strings with UIDs
   */
  search: function(searchString, keyserver = null, listener) {
    let acc = getAccessType(keyserver);
    return acc.search(searchString, keyserver, listener);
  }
};
