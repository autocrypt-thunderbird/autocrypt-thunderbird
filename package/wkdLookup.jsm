/*global Components: false, btoa: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Lookup keys by email addresses using WKD. A an email address is lookep up at most
 *  once a day. (see https://tools.ietf.org/html/draft-koch-openpgp-webkey-service)
 */

var EXPORTED_SYMBOLS = ["AutocryptWkdLookup"];

const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptZBase32 = ChromeUtils.import("chrome://autocrypt/content/modules/zbase32.jsm").AutocryptZBase32;
const AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;
const AutocryptTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").AutocryptTimer;

var AutocryptWkdLookup = {
  getDownloadUrlFromEmail: async function(email, advancedMethod) {
    email = email.toLowerCase().trim();

    let at = email.indexOf("@");

    let domain = email.substr(at + 1);
    let user = email.substr(0, at);

    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var data = converter.convertToByteArray(user, {});

    var ch = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
    ch.init(ch.SHA1);
    ch.update(data, data.length);
    let gotHash = ch.finish(false);
    let encodedHash = AutocryptZBase32.encode(gotHash);

    let url;
    if (advancedMethod) {
      url = "https://openpgpkey." + domain + "/.well-known/openpgpkey/" + domain + "/hu/" + encodedHash + "?l=" + escape(user);
    } else {
      url = "https://" + domain + "/.well-known/openpgpkey/hu/" + encodedHash + "?l=" + escape(user);
    }

    return url;
  },

  download: async function(email, timeoutMs = 500) {
    AutocryptLog.DEBUG("wkdLookup.jsm: download(" + email + ")\n");

    try {
      let keyData = await Promise.race([
        Promise.all([this.doWkdKeyDownload(email, true), this.doWkdKeyDownload(email, false)]),
        new Promise((_, reject) => AutocryptTimer.setTimeout(() => reject(new Error('Timeout')), timeoutMs))
      ]);

      if (keyData && keyData.length) {
        keyData = keyData.filter(x => x);
      }
      if (keyData && keyData.length) {
        return {
          result: 0,
          keyData: keyData[0]
        };
      }

      // for compatibility with keyserver.jsm
      return {
        result: 0,
        keyData: null
      };
    } catch (ex) {
      return {
        result: 1,
        keyData: null,
        errorDetails: `WKD lookup error: ${ex}`
      };
    }

  },

  doWkdKeyDownload: async function(email, advancedMethod) {
    AutocryptLog.DEBUG(`wkdLookup.jsm: doWkdKeyDownload(${email}, ${advancedMethod})\n`);

    let url = await AutocryptWkdLookup.getDownloadUrlFromEmail(email, advancedMethod);

    let hdrs = new Headers({
      'Authorization': 'Basic ' + btoa("no-user:")
    });
    hdrs.append('Content-Type', 'application/octet-stream');

    let myRequest = new Request(url, {
      method: 'GET',
      headers: hdrs,
      mode: 'cors',
      //redirect: 'error',
      redirect: 'follow',
      cache: 'default'
    });

    let response;
    try {
      AutocryptLog.DEBUG("wkdLookup.jsm: doWkdKeyDownload: requesting " + url + "\n");
      response = await fetch(myRequest);
      if (!response.ok) {
        return null;
      }
    } catch (ex) {
      AutocryptLog.DEBUG("wkdLookup.jsm: doWkdKeyDownload: error " + ex.toString() + "\n");
      return null;
    }

    try {
      let keyData = AutocryptData.arrayBufferToString(Cu.cloneInto(await response.arrayBuffer(), this));
      AutocryptLog.DEBUG("wkdLookup.jsm: doWkdKeyDownload: got data for " + email + "\n");
      return keyData;
    } catch (ex) {
      AutocryptLog.DEBUG("wkdLookup.jsm: doWkdKeyDownload: error " + ex.toString() + "\n");
      return null;
    }
  }
};
