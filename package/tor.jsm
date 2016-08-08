/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false*/
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/rng.jsm"); /*global EnigmailRNG: false */
Cu.import("resource://enigmail/versioning.jsm"); /*global EnigmailVersioning: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/socks5Proxy.jsm"); /*global EnigmailSocks5Proxy: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */

const EXPORTED_SYMBOLS = ["EnigmailTor"];

// Minimum for using socks5h:// prefix
const MINIMUM_CURL_SOCKS5H_VERSION = "7.21.7";

// Minimum for using socks5 proxies with curl
const MINIMUM_CURL_SOCKS5_PROXY_VERSION = "7.18.0";

// Stable and most used version according to gnupg.org
const MINIMUM_WINDOWS_GPG_VERSION = "2.0.30";

const TORSOCKS_VERSION_2 = "2.0.0";

const TOR_SERVICE_PORT_PREF = "torServicePort";
const TOR_BROWSER_BUNDLE_PORT_PREF = "torBrowserBundlePort";
const NEW_CURL_PROTOCOL = "socks5h://";
const OLD_CURL_PROTOCOL = "socks5-hostname://";

const TOR_USER_PREFERENCES = {
  DOWNLOAD: {
    requires: "downloadKeyRequireTor",
    uses: "downloadKeyWithTor",
    constant: Ci.nsIEnigmail.DOWNLOAD_KEY
  },
  SEARCH: {
    requires: "searchKeyRequireTor",
    uses: "searchKeyWithTor",
    constant: Ci.nsIEnigmail.SEARCH_KEY
  },
  UPLOAD: {
    requires: "uploadKeyRequireTor",
    uses: "uploadKeyWithTor",
    constant: Ci.nsIEnigmail.UPLOAD_KEY
  },
  REFRESH: {
    requires: "refreshAllKeysRequireTor",
    uses: "refreshAllKeysWithTor",
    constant: Ci.nsIEnigmail.REFRESH_KEY
  }
};

function getAction(actionFlags) {
  for (let key in TOR_USER_PREFERENCES) {
    if (TOR_USER_PREFERENCES[key].constant & actionFlags) {
      return TOR_USER_PREFERENCES[key];
    }
  }
  return null;
}

function isPreferred(actionFlags) {
  const action = getAction(actionFlags);
  return EnigmailPrefs.getPref(action.requires) || EnigmailPrefs.getPref(action.uses);
}

function isRequired(actionFlags) {
  return EnigmailPrefs.getPref(getAction(actionFlags).requires);
}

function combineIntoProxyhostURI(protocol, tor) {
  return protocol + createRandomCredential() + ":" + createRandomCredential() + "@" + tor.ip + ":" + tor.port;
}

function gpgProxyArgs(tor, versioning) {
  if (EnigmailOS.isDosLike || !versioning.versionFoundMeetsMinimumVersionRequired("curl", MINIMUM_CURL_SOCKS5H_VERSION)) {
    return combineIntoProxyhostURI(OLD_CURL_PROTOCOL, tor);
  }
  else {
    return combineIntoProxyhostURI(NEW_CURL_PROTOCOL, tor);
  }
}

function createHelperArgs(helper, addAuth) {
  let args = [];
  if (addAuth) {
    args = ["--user", createRandomCredential(), "--pass", createRandomCredential()];
  }
  args.push(EnigmailGpg.agentPath.path);
  return args;
}

function buildEnvVars() {
  return [
    "TORSOCKS_USERNAME=" + createRandomCredential(),
    "TORSOCKS_PASSWORD=" + createRandomCredential()
  ];
}

function createRandomCredential() {
  return EnigmailRNG.getUint32().toString();
}

function torOn(portPref) {
  if (EnigmailSocks5Proxy.checkTorExists(portPref)) {
    const port = EnigmailPrefs.getPref(portPref);

    EnigmailLog.CONSOLE("Tor found on IP: " + EnigmailSocks5Proxy.torIpAddr() + ", port: " + port + "\n\n");

    return {
      ip: EnigmailSocks5Proxy.torIpAddr(),
      port: port
    };
  }
  return null;
}

function meetsOSConstraints() {
  if (EnigmailOS.isDosLike) {
    return EnigmailVersioning.greaterThanOrEqual(EnigmailGpg.agentVersion, MINIMUM_WINDOWS_GPG_VERSION);
  }
  else {
    return EnigmailVersioning.versionFoundMeetsMinimumVersionRequired("curl", MINIMUM_CURL_SOCKS5_PROXY_VERSION);
  }
}

function useAuthOverArgs(helper, versioning) {
  if (helper === "torsocks2") {
    return versioning.versionFoundMeetsMinimumVersionRequired("torsocks2", TORSOCKS_VERSION_2);
  }
  return versioning.versionFoundMeetsMinimumVersionRequired("torsocks", TORSOCKS_VERSION_2);
}

function findTorExecutableHelper(versioning) {
  const helper = EnigmailFiles.resolvePathWithEnv("torsocks2") || EnigmailFiles.resolvePathWithEnv("torsocks");
  if (helper !== null) {
    const authOverArgs = useAuthOverArgs(helper, versioning);
    return {
      envVars: (authOverArgs ? [] : buildEnvVars()),
      command: helper,
      args: createHelperArgs(helper, authOverArgs)
    };
  }
  else {
    return null;
  }
}

function findTor() {
  const torOnBrowser = torOn(TOR_BROWSER_BUNDLE_PORT_PREF);
  if (torOnBrowser !== null) {
    return torOnBrowser;
  }
  return torOn(TOR_SERVICE_PORT_PREF);
}

const systemCaller = {
  findTor: findTor,
  findTorExecutableHelper: findTorExecutableHelper
};

function buildSocksProperties(tor, system) {
  return {
    command: "gpg",
    args: gpgProxyArgs(tor, EnigmailVersioning),
    envVars: []
  };
}

function torNotAvailableProperties() {
  return {
    isAvailable: false,
    useTorMode: false,
    socks: null,
    helper: null
  };
}

function torProperties(system) {
  const tor = system.findTor();

  if (!meetsOSConstraints()) {
    EnigmailLog.DEBUG("tor.jsm: this version of curl does not support socks5 proxies \n");
    return torNotAvailableProperties();
  }

  if (tor === null) {
    return torNotAvailableProperties();
  }

  const helper = system.findTorExecutableHelper(EnigmailVersioning);
  let socks = null;
  let useTorMode = false;

  if (EnigmailGpg.getGpgFeature("supports-dirmngr")) {
    useTorMode = EnigmailGpg.dirmngrConfiguredWithTor();
  }
  else {
    socks = buildSocksProperties(tor, system);
  }

  return {
    isAvailable: true,
    useTorMode: useTorMode,
    socks: socks,
    helper: helper
  };
}

const EnigmailTor = {
  torProperties: function() {
    return torProperties(systemCaller);
  },
  isPreferred: isPreferred,
  isRequired: isRequired
};
