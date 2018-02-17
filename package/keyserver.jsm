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
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/httpProxy.jsm"); /*global EnigmailHttpProxy: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/tor.jsm"); /*global EnigmailTor: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/keyserverUris.jsm"); /*global EnigmailKeyserverURIs: false */
Cu.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("resource://enigmail/stdlib.jsm"); /*global EnigmailStdlib: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/webKey.jsm"); /*global EnigmailWks: false */
Cu.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

const ENIG_DEFAULT_HKP_PORT = "11371";
const ENIG_DEFAULT_HKPS_PORT = "443";
const ENIG_DEFAULT_LDAP_PORT = "389";

function matchesKeyserverAction(action, flag) {
  return (action & flag) === flag;
}

function getRequestAction(actionFlags, keys) {
  if (matchesKeyserverAction(actionFlags, EnigmailConstants.DOWNLOAD_KEY)) {
    return ["--recv-keys"].concat(keys);
  }
  if (matchesKeyserverAction(actionFlags, EnigmailConstants.SEARCH_KEY)) {
    return ["--search-keys"].concat(keys);
  }
  if (matchesKeyserverAction(actionFlags, EnigmailConstants.UPLOAD_KEY)) {
    return ["--send-keys"].concat(keys);
  }
  if (matchesKeyserverAction(actionFlags, EnigmailConstants.REFRESH_KEY)) {
    return ["--refresh-keys"];
  }
  return null;
}

function getInputData(actionFlags) {
  if (matchesKeyserverAction(actionFlags, EnigmailConstants.SEARCH_KEY)) {
    return "quit\n";
  }
  return null;
}

function buildProxyInfo(uri, proxyHost) {
  if (proxyHost !== null) {
    return ["--keyserver-options", "http-proxy=" + proxyHost];
  }
  return [];
}

function buildStandardArgs(action) {
  if (matchesKeyserverAction(action, EnigmailConstants.SEARCH_KEY)) {
    return EnigmailGpg.getStandardArgs(false).concat(["--command-fd", "0", "--fixed-list", "--with-colons"]);
  }
  return EnigmailGpg.getStandardArgs(true);
}

function flatten(arrOfArr) {
  return arrOfArr.reduce(function(a, b) {
    return a.concat(b);
  }, []);
}

function isDownload(action) {
  return matchesKeyserverAction(action, EnigmailConstants.REFRESH_KEY) || matchesKeyserverAction(action, EnigmailConstants.DOWNLOAD_KEY);
}

function gpgRequest(keyId, uri, action, usingTor) {
  const proxyHost = getProxyModule().getHttpProxy(uri.keyserverName);
  const args = flatten([
    buildStandardArgs(action), ["--keyserver", uri],
    buildProxyInfo(uri, proxyHost),
    getRequestAction(action, keyId)
  ]);

  return {
    command: EnigmailGpgAgent.agentPath,
    args: args,
    usingTor: usingTor,
    keyId: keyId,
    inputData: getInputData(action),
    envVars: [],
    isDownload: isDownload(action)
  };
}

function requestOverTorWithSocks(keyId, uri, torProperties, action) {
  const args = flatten([
    buildStandardArgs(action), ["--keyserver", uri],
    buildProxyInfo(uri, torProperties.args),
    getRequestAction(action, keyId)
  ]);

  return {
    command: EnigmailGpgAgent.agentPath,
    args: args,
    keyId: keyId,
    usingTor: true,
    envVars: [],
    isDownload: isDownload(action)
  };
}

function requestOverTorWithHelper(keyId, uri, torProperties, action) {
  const args = flatten([
    torProperties.args,
    buildStandardArgs(action), ["--keyserver", uri],
    getRequestAction(action, keyId)
  ]);

  return {
    command: torProperties.command,
    args: args,
    keyId: keyId,
    usingTor: true,
    envVars: torProperties.envVars,
    isDownload: isDownload(action)
  };
}

function buildRequests(keyId, action, tor) {

  let torProperties = tor.getTorNotAvailableProperties();

  const uris = EnigmailKeyserverURIs.buildKeyserverUris();
  const requests = [];

  if (tor.isPreferred(action)) {
    // tor is preferred or required
    torProperties = tor.torProperties();

    if (tor.isRequired(action) && !torProperties.isAvailable) {
      EnigmailLog.CONSOLE("Unable to perform action with key " + keyId + " because Tor is required but not available.\n");
      return [];
    }

    uris.forEach(function(uri) {
      if (torProperties.helper !== null) {
        requests.push(requestOverTorWithHelper(keyId, uri, torProperties.helper, action));
      }
      if (torProperties.socks !== null) {
        requests.push(requestOverTorWithSocks(keyId, uri, torProperties.socks, action));
      }
    });
  }

  if (!tor.isRequired(action) || torProperties.useTorMode) {
    uris.forEach(function(uri) {
      requests.push(gpgRequest(keyId, uri, action, torProperties.useTorMode));
    });
  }

  return requests;
}

function stringContains(stringToCheck, substring) {
  return stringToCheck.indexOf(substring) > -1;
}

function convertRequestArgsToStrings(args) {
  return args.map(function(a) {
    return a.toString();
  });
}

function execute(request, listener, subproc) {
  EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(request.command, request.args) + "\n\n");

  const envVars = request.envVars.concat(EnigmailCore.getEnvList());

  let exitCode = null;
  let proc = null;
  try {
    proc = subproc.call({
      command: request.command,
      arguments: convertRequestArgsToStrings(request.args),
      environment: envVars,
      charset: null,
      stdin: request.inputData,
      done: function(result) {
        try {
          if (result.exitCode === 0 && request.isDownload) {
            if (typeof(request.keyId) === "string") {
              EnigmailKeyRing.updateKeys([request.keyId]);
            }
            else
              EnigmailKeyRing.updateKeys(request.keyId);
          }
          if (exitCode === null) {
            exitCode = result.exitCode;
          }
          listener.done(exitCode);
        }
        catch (ex) {
          EnigmailLog.ERROR("keyserver.jsm: execute: subprocess.call failed at finish with '" + ex.message + "'\n");
        }
      },
      stdout: function(data) {
        listener.stdout(data);
      },
      stderr: function(data) {
        if (data.search(/^\[GNUPG:\] ERROR/m) >= 0) {
          exitCode = 4;
        }
        listener.stderr(data);
      },
      mergeStderr: false
    });
  }
  catch (ex) {
    EnigmailLog.ERROR("keyserver.jsm: execute: subprocess.call failed with '" + ex.message + "'\n");
    throw ex;
  }

  if (proc === null) {
    EnigmailLog.ERROR("keyserver.jsm: execute: subprocess failed due to unknown reasons\n");
  }
  return proc;
}

function executeRefresh(request, subproc) {
  let stdout = "";
  let stderr = "";
  let successful = false;

  const listener = {
    done: function(exitCode) {
      successful = stringContains(stderr, "IMPORT_OK");
    },
    stderr: function(data) {
      stderr += data;
    },
    stdout: function(data) {
      stdout += data;
    }
  };
  execute(request, listener, subproc).wait();
  return successful;
}

function invalidArgumentsExist(actionFlags, keyserver, searchTerms, errorMsgObj) {
  if (!keyserver) {
    errorMsgObj.value = EnigmailLocale.getString("failNoServer");
    return true;
  }

  if (!searchTerms && !matchesKeyserverAction(actionFlags, EnigmailConstants.REFRESH_KEY)) {
    errorMsgObj.value = EnigmailLocale.getString("failNoID");
    return true;
  }

  return false;
}

function build(actionFlags, keyserver, searchTerms, errorMsgObj) {
  if (invalidArgumentsExist(actionFlags, keyserver, searchTerms, errorMsgObj)) {
    return null;
  }

  const searchTermsList = searchTerms.split(" ");
  return gpgRequest(searchTermsList, keyserver.trim(), actionFlags);
}

/**
 * search, download or upload key on, from or to a keyserver
 *
 * @actionFlags: Integer - flags (bitmap) to determine the required action
 *                         (see EnigmailConstants - Keyserver action flags for details)
 * @keyserver:   String  - keyserver URL (optionally incl. protocol)
 * @searchTerms: String  - space-separated list of search terms or key IDs
 * @listener:    Object  - execStart Listener Object. See execStart for details.
 * @errorMsgObj: Object  - object to hold error message in .value
 *
 * @return:      Subprocess object, or null in case process could not be started
 */
function access(actionFlags, keyserver, searchTerms, listener, errorMsgObj) {

  if (keyserver.search(/^(hkps:\/\/)?keys.mailvelope.com$/i) === 0) {
    if (matchesKeyserverAction(actionFlags, EnigmailConstants.UPLOAD_KEY) ||
      matchesKeyserverAction(actionFlags, EnigmailConstants.DOWNLOAD_KEY)) {
      // special API for mailvelope.com
      return accessHkp(actionFlags, keyserver, searchTerms, listener, errorMsgObj);
    }
  }

  const request = build(actionFlags, keyserver, searchTerms, errorMsgObj, EnigmailHttpProxy);
  if (request === null) return null;
  return execute(request, listener, subprocess);
}

function buildHkpPayload(actionFlags, searchTerms) {
  let payLoad = null;

  if (matchesKeyserverAction(actionFlags, EnigmailConstants.UPLOAD_KEY)) {
    let keyData = EnigmailKeyRing.extractKey(false, searchTerms, null, {}, {});
    if (keyData.length === 0) return null;

    payLoad = "keytext=" + encodeURIComponent(keyData);
    return payLoad;
  }
  else if (matchesKeyserverAction(actionFlags, EnigmailConstants.DOWNLOAD_KEY)) {
    return "";
  }

  // other actions are not yet implemented
  return null;

}

/**
 * Access a HKP server directly (without gpg involved)
 * Same API as access()
 * currently only key uploading is supported
 */
function accessHkp(actionFlags, keyserver, searchTerms, listener, errorMsgObj) {
  EnigmailLog.DEBUG("keyserver.jsm: accessHkp()\n");

  const ERROR_MSG = "[GNUPG:] ERROR X";
  let keySrv = parseKeyserverUrl(keyserver);
  let protocol = "https"; // protocol is always hkps (which equals to https in TB)

  let payLoad = buildHkpPayload(actionFlags, searchTerms);
  if (payLoad === null) return null;

  let errorCode = 0;
  let method = "GET";

  let xmlReq = new XMLHttpRequest();

  xmlReq.onload = function _onLoad() {
    EnigmailLog.DEBUG("keyserver.jsm: onload(): status=" + xmlReq.status + "\n");
    if (xmlReq.status >= 400) {
      EnigmailLog.DEBUG("keyserver.jsm: onload: " + xmlReq.responseText + "\n");
      listener.stderr(ERROR_MSG);
      errorCode = 1;
    }
    else if (matchesKeyserverAction(actionFlags, EnigmailConstants.DOWNLOAD_KEY)) {
      let r = importHkpKey(xmlReq.responseText, listener);
      if (r !== 0) {
        listener.done(r);
      }
      else if (searchTerms.length > 0) {
        accessHkp(actionFlags, keyserver, searchTerms, listener, errorMsgObj);
        return;
      }

      return;
    }

    listener.done(errorCode);
  };

  xmlReq.onerror = function(e) {
    EnigmailLog.DEBUG("keyserver.jsm: onerror: " + e + "\n");
    listener.stderr(ERROR_MSG);
    listener.done(1);
  };

  xmlReq.onloadend = function() {
    EnigmailLog.DEBUG("keyserver.jsm: loadEnd:\n");
  };

  let url = protocol + "://" + keySrv.host + ":" + keySrv.port;
  if (matchesKeyserverAction(actionFlags, EnigmailConstants.UPLOAD_KEY)) {
    url += "/pks/add";
    method = "POST";
  }
  else if (matchesKeyserverAction(actionFlags, EnigmailConstants.DOWNLOAD_KEY)) {
    let keys = searchTerms.split(/ +/);
    if (searchTerms.length > 0) {
      let keyId = keys[0];
      if (keyId.indexOf("0x") !== 0) {
        keyId = "0x" + keyId;
      }
      url += "/pks/lookup?search=" + keyId + "&op=get&options=mr";
      keys.shift(); // remove 1st key
      searchTerms = keys.join(" ");
    }
    else {
      listener.done(0);
      return null;
    }
  }

  xmlReq.open(method, url);
  xmlReq.send(payLoad);

  // return the same API as subprocess
  return {
    wait: function() {
      throw Components.results.NS_ERROR_FAILURE;
    },
    kill: function() {
      xmlReq.abort();
    }
  };
}

function importHkpKey(keyData, listener) {
  EnigmailLog.DEBUG("keyserver.jsm: importHkpKey()\n");

  let errorMsgObj = {};
  return EnigmailKeyRing.importKey(null, false, keyData, "", errorMsgObj);
}

/**
 * Refresh will refresh a key over Tor if Tor is available and over hkps if hkps is configured
 * and available.
 *
 * @param    String  keyId   - ID of the key to be refreshed
 */
function refresh(keyId) {
  EnigmailLog.DEBUG("keyserver.jsm: Trying to refresh key: " + keyId + " at time: " + new Date().toUTCString() + "\n");
  const refreshAction = EnigmailConstants.DOWNLOAD_KEY;
  const requests = buildRequests(keyId, refreshAction, EnigmailTor, EnigmailHttpProxy);

  for (let i = 0; i < requests.length; i++) {
    const successStatus = executeRefresh(requests[i], subprocess);
    if (successStatus || i === requests.length - 1) {
      logRefreshAction(successStatus, requests[i].usingTor, keyId);
      return;
    }
  }
}

function logRefreshAction(successStatus, usingTor, keyId) {
  if (successStatus) {
    EnigmailLog.CONSOLE("Refreshed key " + keyId + " over Tor: " + usingTor + ". Refreshed successfully: " + successStatus + "\n\n");
  }
  else {
    EnigmailLog.CONSOLE("Failed to refresh key " + keyId + "\n\n");
  }
}

let currentProxyModule = null;

function getProxyModule() {
  if (currentProxyModule === null) {
    currentProxyModule = EnigmailHttpProxy;
  }
  return currentProxyModule;
}


/**
 * Upload/refresh keys to/from keyservers.
 *
 * @param win          - |object| holding the parent window for the dialog.
 * @param keys         - |array| with key objects for the keys to upload/refresh
 * @param access       - |EnigmailConstants| UPLOAD_WKS, UPLOAD_KEY or REFRESH_KEY
 * @param hideProgess  - |boolean| do not display progress dialogs
 * @param callbackFunc - |function| called when the key server operation finishes
 *                            params: exitCode, errorMsg, displayErrorMsg
 * @param resultObj    - |object| with member importedKeys (|number| containing the number of imported keys)
 *
 * no return value
 */
function keyServerUpDownload(win, keys, access, hideProgess, callbackFunc, resultObj) {
  let keyList = keys.map(function(x) {
    return "0x" + x.keyId.toString();
  }).join(" ");

  EnigmailLog.DEBUG("keyserver.jsm: keyServerUpDownload: keyId=" + keyList + "\n");

  const ioService = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
  if (ioService && ioService.offline) {
    EnigmailDialog.alert(win, EnigmailLocale.getString("needOnline"));
    return;
  }

  let keyDlObj = {
    accessType: access,
    keyServer: resultObj.value,
    keyList: keyList,
    fprList: [],
    senderIdentities: [],
    cbFunc: callbackFunc
  };

  if (access === EnigmailConstants.UPLOAD_WKD) {
    for (let key of keys) {
      // UPLOAD_WKD needs a nsIMsgIdentity
      try {
        for (let uid of key.userIds) {
          let email = EnigmailFuncs.stripEmail(uid.userId);
          let maybeIdent = EnigmailStdlib.getIdentityForEmail(email);

          if (maybeIdent && maybeIdent.identity) {
            keyDlObj.senderIdentities.push(maybeIdent.identity);
            keyDlObj.fprList.push(key.fpr);
          }
        }

        if (keyDlObj.senderIdentities.length === 0) {
          let uids = key.userIds.map(function(x) {
            return " - " + x.userId;
          }).join("\n");

          if (!hideProgess) {
            EnigmailDialog.alert(win, EnigmailLocale.getString("noWksIdentity", [uids]));
          }
          return;
        }
      }
      catch (ex) {
        EnigmailLog.DEBUG(ex + "\n");
        return;
      }
    }
  }
  else {
    let autoKeyServer = EnigmailPrefs.getPref("autoKeyServerSelection") ? EnigmailPrefs.getPref("keyserver").split(/[ ,;]/g)[0] : null;
    if (autoKeyServer) {
      keyDlObj.keyServer = autoKeyServer;
    }
    else {
      let inputObj = {};
      let resultObj = {};
      switch (access) {
        case EnigmailConstants.REFRESH_KEY:
          inputObj.upload = false;
          inputObj.keyId = "";
          break;
        case EnigmailConstants.DOWNLOAD_KEY:
          inputObj.upload = false;
          inputObj.keyId = keyList;
          break;
        default:
          inputObj.upload = true;
          inputObj.keyId = "";
      }

      win.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
        "", "dialog,modal,centerscreen", inputObj, resultObj);
      keyDlObj.keyServer = resultObj.value;
    }

    if (!keyDlObj.keyServer) {
      return;
    }
  }

  if (!hideProgess) {
    win.openDialog("chrome://enigmail/content/enigRetrieveProgress.xul",
      "", "dialog,modal,centerscreen", keyDlObj, resultObj);
  }
  else {
    resultObj.fprList = [];
    let observer = {
      isCanceled: false,
      onProgress: function() {},
      onFinished: function(resultStatus, errorMsg, displayError) {
        resultObj.result = (resultStatus === 0);
        callbackFunc(resultStatus, errorMsg, displayError);
      },
      onUpload: function(fpr) {
        resultObj.fprList.push(fpr);
      }
    };

    performWkdUpload(keyDlObj, null, observer);
  }
}


/**
 * Do the WKD upload and interact with a progress receiver
 *
 * @param keyList:     Object:
 *                       - fprList (String - fingerprint)
 *                       - senderIdentities (nsIMsgIdentity)
 * @param win:         nsIWindow - parent window
 * @param observer:    Object:
 *                       - onProgress: function(percentComplete [0 .. 100])
 *                             called after processing of every key (indpendent of status)
 *                       - onUpload: function(fpr)
 *                              called after successful uploading of a key
 *                       - onFinished: function(completionStatus, errorMessage, displayError)
 *                       - isCanceled: Boolean - used to determine if process is canceled
 */
function performWkdUpload(keyList, win, observer) {
  try {
    let uploads = [];

    let numKeys = keyList.senderIdentities.length;

    // For each key fpr/sender identity pair, check whenever WKS is supported
    // Result is an array of booleans
    for (let i = 0; i < numKeys; i++) {
      let keyFpr = keyList.fprList[i];
      let senderIdent = keyList.senderIdentities[i];

      let was_uploaded = new Promise(function(resolve, reject) {
        EnigmailLog.DEBUG("keyserver.jsm: performWkdLoad: ident=" + senderIdent.email + ", key=" + keyFpr + "\n");
        EnigmailWks.isWksSupportedAsync(senderIdent.email, win, function(is_supported) {
          if (observer.isCanceled) {
            EnigmailLog.DEBUG("keyserver.jsm: performWkdLoad: canceled by user\n");
            reject("canceled");
          }

          EnigmailLog.DEBUG("keyserver.jsm: performWkdLoad: ident=" + senderIdent.email + ", supported=" + is_supported + "\n");
          resolve(is_supported);
        });
      }).then(function(is_supported) {
        let senderIdent = keyList.senderIdentities[i];
        if (is_supported) {
          let keyFpr = keyList.fprList[i];

          return new Promise(function(resolve, reject) {
            EnigmailWks.submitKey(senderIdent, {
              'fpr': keyFpr
            }, win, function(success) {
              observer.onProgress((i + 1) / numKeys * 100);
              if (success) {
                observer.onUpload(keyFpr);
                resolve(senderIdent);
              }
              else {
                reject();
              }
            });
          });
        }
        else {
          observer.onProgress((i + 1) / numKeys * 100);
          return Promise.resolve(null);
        }
      });

      uploads.push(was_uploaded);
    }

    Promise.all(uploads).catch(function(reason) {
      let errorMsg = EnigmailLocale.getString("keyserverProgress.wksUploadFailed");
      observer.onFinished(-1, errorMsg, true);
    }).then(function(senders) {
      let uploaded_uids = [];
      if (senders) {
        senders.forEach(function(val) {
          if (val !== null) {
            uploaded_uids.push(val.email);
          }
        });
      }
      observer.onProgress(100);
      observer.onFinished(0);
    });
  }
  catch (ex) {
    EnigmailLog.DEBUG(ex);
  }
}

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

  keyserver = keyserver.toLowerCase();
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

  var m = keyserver.match(/^(.+)(:)(\d+)$/);
  if (m && m.length == 4) {
    keyserver = m[1];
    port = m[3];
  }

  if (keyserver === "keys.mailvelope.com") {
    protocol = "hkps";
    port = ENIG_DEFAULT_HKPS_PORT;
  }

  return {
    protocol: protocol,
    host: keyserver,
    port: port
  };
}

var EnigmailKeyServer = {
  access: access,
  refresh: refresh,
  keyServerUpDownload: keyServerUpDownload,
  parseKeyserverUrl: parseKeyserverUrl,
  performWkdUpload: performWkdUpload
};
