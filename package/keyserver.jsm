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
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/tor.jsm"); /*global EnigmailTor: false */
Cu.import("resource://enigmail/keyserverUris.jsm"); /*global EnigmailKeyserverURIs: false */

const nsIEnigmail = Ci.nsIEnigmail;

function matchesKeyserverAction(action, flag) {
  return (action & flag) === flag;
}

function getRequestAction(actionFlags, keys) {
  if (matchesKeyserverAction(actionFlags, nsIEnigmail.DOWNLOAD_KEY)) { return ["--recv-keys"].concat(keys); }
  if (matchesKeyserverAction(actionFlags, nsIEnigmail.SEARCH_KEY)) { return ["--search-keys"].concat(keys); }
  if (matchesKeyserverAction(actionFlags, nsIEnigmail.UPLOAD_KEY)) { return ["--send-keys"].concat(keys); }
  if (matchesKeyserverAction(actionFlags, nsIEnigmail.REFRESH_KEY))  { return ["--refresh-keys"]; }
  return null;
}

function getInputData(actionFlags) {
  if (matchesKeyserverAction(actionFlags, Ci.nsIEnigmail.SEARCH_KEY)) {return "quit\n";}
  return null;
}

function buildProxyInfo(uri, proxyHost) {
  if (proxyHost !== null) {
    return ["--keyserver-options", "http-proxy=" + proxyHost];
  }
  return [];
}

function buildStandardArgs(action) {
  if (matchesKeyserverAction(action, Ci.nsIEnigmail.SEARCH_KEY)) {
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
    return matchesKeyserverAction(action, Ci.nsIEnigmail.REFRESH_KEY) || matchesKeyserverAction(action, Ci.nsIEnigmail.DOWNLOAD_KEY);
}

function gpgRequest(keyId, uri, action, usingTor) {
  const proxyHost = getProxyModule().getHttpProxy(uri.keyserverName);
  const args = flatten([
    buildStandardArgs(action),
    ["--keyserver", uri],
    buildProxyInfo(uri, proxyHost),
    getRequestAction(action, keyId)
  ]);

  return {
    command: EnigmailGpgAgent.agentPath,
    args: args,
    usingTor: usingTor,
    inputData: getInputData(action),
    envVars: [],
    isDownload: isDownload(action)
  };
}

function requestOverTorWithSocks(keyId, uri, torProperties, action) {
  const args = flatten([
    buildStandardArgs(action),
    ["--keyserver", uri],
    buildProxyInfo(uri, torProperties.args),
    getRequestAction(action, keyId)
  ]);

  return {
    command: EnigmailGpgAgent.agentPath,
    args: args,
    usingTor: true,
    envVars: [],
    isDownload: isDownload(action)
  };
}

function requestOverTorWithHelper(keyId, uri, torProperties, action) {
  const args = flatten([
    torProperties.args,
    buildStandardArgs(action),
    ["--keyserver", uri],
    getRequestAction(action, keyId)
  ]);

  return {
    command: torProperties.command,
    args: args,
    usingTor: true,
    envVars: torProperties.envVars,
    isDownload: isDownload(action)
  };
}

function buildRequests(keyId, action, tor) {
  const torProperties = tor.torProperties();

  const uris = EnigmailKeyserverURIs.buildKeyserverUris();
  const requests = [];

  if (tor.isRequired(action) && !torProperties.isAvailable) {
    EnigmailLog.CONSOLE("Unable to perform action with key " + keyId + " because Tor is required but not available.\n");
    return [];
  }

  if (tor.isPreferred(action)) {
    uris.forEach(function(uri) {
      if(torProperties.helper !== null) {
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
            EnigmailKeyRing.clearCache();
          }
          if (exitCode === null) {
            exitCode = result.exitCode;
          }
          listener.done(exitCode);
        }
        catch (ex) {
          EnigmailLog.ERROR("keyserver.jsm: execute: subprocess.call failed at finish with '" + ex.toString() + "'\n");
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
  } catch (ex) {
    EnigmailLog.ERROR("keyserver.jsm: execute: subprocess.call failed with '" + ex.toString() + "'\n");
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

  if (!searchTerms && !matchesKeyserverAction(actionFlags, Ci.nsIEnigmail.REFRESH_KEY)) {
    errorMsgObj.value = EnigmailLocale.getString("failNoID");
    return true;
  }

  return false;
}
function build(actionFlags, keyserver, searchTerms, errorMsgObj) {
  if(invalidArgumentsExist(actionFlags, keyserver, searchTerms, errorMsgObj)) {
    return null;
  }

  const searchTermsList = searchTerms.split(" ");
  return gpgRequest(searchTermsList, keyserver.trim(), actionFlags);
}

/**
 * search, download or upload key on, from or to a keyserver
 *
 * @actionFlags: Integer - flags (bitmap) to determine the required action
 *                         (see nsIEnigmail - Keyserver action flags for details)
 * @keyserver:   String  - keyserver URL (optionally incl. protocol)
 * @searchTerms: String  - space-separated list of search terms or key IDs
 * @listener:    Object  - execStart Listener Object. See execStart for details.
 * @errorMsgObj: Object  - object to hold error message in .value
 *
 * @return:      Subprocess object, or null in case process could not be started
 */
function access(actionFlags, keyserver, searchTerms, listener, errorMsgObj) {
  const request = build(actionFlags, keyserver, searchTerms, errorMsgObj, EnigmailHttpProxy);
  if (request === null) return null;
  return execute(request, listener, subprocess);
}

/**
 * Refresh will refresh a key over Tor if Tor is available and over hkps if hkps is configured
 * and available.
 *
 * @param    String  keyId   - ID of the key to be refreshed
 */
function refresh(keyId) {
  EnigmailLog.WRITE("[KEYSERVER]: Trying to refresh key: " + keyId + " at time: " + new Date().toUTCString()+ "\n");
  const refreshAction = Ci.nsIEnigmail.DOWNLOAD_KEY;
  const requests = buildRequests(keyId, refreshAction, EnigmailTor, EnigmailHttpProxy);

  for (let i=0; i<requests.length; i++) {
    const successStatus = executeRefresh(requests[i], subprocess);
    if (successStatus || i === requests.length-1) {
      logRefreshAction(successStatus, requests[i].usingTor, keyId);
      return;
    }
  }
}

function logRefreshAction(successStatus, usingTor, keyId) {
  if (successStatus) {
    EnigmailLog.CONSOLE("Refreshed key " + keyId + " over Tor: " + usingTor + ". Refreshed successfully: " + successStatus + "\n\n");
  } else {
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

const EnigmailKeyServer= {
  access: access,
  refresh: refresh
};
