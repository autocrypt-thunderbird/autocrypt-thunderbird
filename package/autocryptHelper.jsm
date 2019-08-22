/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptHelper"];

const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").AutocryptAutocrypt;
const AutocryptStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").AutocryptStdlib;
const AutocryptTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").AutocryptTimer;

var AutocryptHelper = {
  processAutocryptForMessage: async function(uri) {
    AutocryptLog.DEBUG(`mimeDecrypt.jsm: processAutocryptForMessage()\n`);
    try {
      const result = await this.findAutoryptRelevantHeaders(uri);
      if (result) {
        AutocryptLog.DEBUG(`mimeDecrypt.jsm: found header\n`);
        const { author, dateInSeconds, autocrypt_headers } = result;
        await AutocryptAutocrypt.processAutocryptHeaders(author, autocrypt_headers, dateInSeconds);
      }
    } catch (ex) {
      AutocryptLog.DEBUG(`mimeDecrypt.jsm: processAutocryptForMessage(): ${ex}\n`);
    }
  },

  findAutoryptRelevantHeaders: async function (uri) {
    AutocryptLog.DEBUG(`mimeDecrypt.jsm: findAutoryptRelevantHeaders()\n`);
    let msgDbHdr = uri.QueryInterface(Ci.nsIMsgMessageUrl).messageHeader;
    let author = msgDbHdr.author;
    let dateInSeconds = msgDbHdr.dateInSeconds;
    return await new Promise(function(resolve, reject) {
      let finished = false;
      try {
        AutocryptTimer.setTimeout(function() {
          if (!finished) {
            AutocryptLog.DEBUG(`mimeDecrypt.jsm: findAutoryptRelevantHeaders(): timeout\n`);
            reject(new Error("couldn't receive headers"));
          }
        }, 100);
        AutocryptStdlib.msgHdrGetHeaders(msgDbHdr, function(hdrs) {
          try {
            if (hdrs.has('autocrypt')) {
              AutocryptLog.DEBUG(`mimeDecrypt.jsm: findAutoryptRelevantHeaders(): found autocrypt header\n`);
              resolve({
                author: author,
                dateInSeconds: dateInSeconds,
                autocrypt_headers: hdrs.getAll('autocrypt')
              });
            }
            AutocryptLog.DEBUG(`mimeDecrypt.jsm: findAutoryptRelevantHeaders(): no header\n`);
            finished = true;
            resolve({});
          } catch (ex) {
            AutocryptLog.DEBUG(`mimeDecrypt.jsm: findAutoryptRelevantHeaders(): error (inner) ${ex}\n`);
            finished = true;
            reject(ex);
          }
        });
      } catch (ex) {
        finished = true;
        AutocryptLog.DEBUG(`mimeDecrypt.jsm: findAutoryptRelevantHeaders(): error (outer) ${ex}\n`);
        reject(ex);
      }
    });
  }
};
