/*global Components:false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailKeyserverURIs"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */

const KEYSERVER_PREF = "keyserver";
const AUTO_KEYSERVER_SELECTION_PREF = "autoKeyServerSelection";

const supportedProtocols = {
  "hkps": "443",
  "hkp": "11371",
  "ldap": "389"
};

function buildUriFor(protocol, keyserver) {
  return {
    protocol: protocol,
    domain: keyserver,
    port: supportedProtocols[protocol]
  };
}

function addUriOptionsForPoolKeyservers(keyserver, uris) {
  if (keyserver === "hkps.pool.sks-keyservers.net") {
    uris.push(buildUriFor("hkps", keyserver));
  }
  if (keyserver === "pool.sks-keyservers.net") {
    uris.push(buildUriFor("hkps", "hkps.pool.sks-keyservers.net"));
    uris.push(buildUriFor("hkp", keyserver));
  }
}

function buildUriOptionsFor(keyserver) {
  const uris = [];
  const keyserverProtocolAndDomain = keyserver.split("://");
  const protocolIncluded = keyserverProtocolAndDomain.length === 2;
  const isPoolKeyserver = ["hkps.pool.sks-keyservers.net", "pool.sks-keyservers.net"].indexOf(keyserver) > -1;

  if (isPoolKeyserver) {
    addUriOptionsForPoolKeyservers(keyserver, uris);
  }
  else if (protocolIncluded) {
    uris.push(buildUriFor(keyserverProtocolAndDomain[0].toLowerCase(), keyserverProtocolAndDomain[1]));
  }
  else {
    uris.push(buildUriFor("hkps", keyserver));
    uris.push(buildUriFor("hkp", keyserver));
  }

  return uris;
}

function getUserDefinedKeyserverURIs() {
  const keyservers = EnigmailPrefs.getPref(KEYSERVER_PREF).split(/\s*[,;]\s*/g);
  return EnigmailPrefs.getPref(AUTO_KEYSERVER_SELECTION_PREF) ? [keyservers[0]] : keyservers;
}

function combineIntoURI(protocol, domain, port) {
  // HACK: Returns hkps.pool.sks-keyservers.net only because
  // GnuPG version 2.1.14 in Windows does not parse
  // hkps://hkps.pool.sks-keyservers.net:443 correctly
  if (domain === "hkps.pool.sks-keyservers.net" && EnigmailOS.isDosLike) {
    return domain;
  }
  else {
    return protocol + "://" + domain + ":" + port;
  }
}

function buildKeyserverUris() {
  const uris = getUserDefinedKeyserverURIs().filter(isValidProtocol).map(function(keyserver) {
    return buildUriOptionsFor(keyserver);
  }).reduce(function(a, b) {
    return a.concat(b);
  });

  return uris.map(function(uri) {
    return combineIntoURI(uri.protocol, uri.domain, uri.port);
  });
}

function isValidProtocol(uri) {
  return uri.match(/:\/\//) === null || /^(hkps|hkp|ldap):\/\//i.test(uri);
}

function validProtocolsExist() {
  const validKeyserverUris = getUserDefinedKeyserverURIs().filter(isValidProtocol);
  return validKeyserverUris.length > 0;
}

function validKeyserversExist() {
  return EnigmailPrefs.getPref(KEYSERVER_PREF).trim() !== "" && validProtocolsExist();
}

const EnigmailKeyserverURIs = {
  buildKeyserverUris: buildKeyserverUris,
  validKeyserversExist: validKeyserversExist
};
