/*global Components: false, EnigmailWindows: false, EnigmailLocale: false, EnigmailPrefs: false, EnigmailTime: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptHelper"];

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;

var AutocryptHelper = {
  processAutocryptForMessage: async function(uri) {
    EnigmailLog.DEBUG(`mimeDecrypt.jsm: processAutocryptForMessage()\n`);
    try {
      const result = await this.findAutoryptRelevantHeaders(uri);
      if (result) {
        EnigmailLog.DEBUG(`mimeDecrypt.jsm: found header\n`);
        const { author, dateInSeconds, autocrypt_headers } = result;
        await EnigmailAutocrypt.processAutocryptHeaders(author, autocrypt_headers, dateInSeconds);
      }
    } catch (ex) {
      EnigmailLog.DEBUG(`mimeDecrypt.jsm: processAutocryptForMessage(): ${ex}\n`);
    }
  },

  findAutoryptRelevantHeaders: function (uri) {
    return new Promise(function(resolve, reject) {
      let msgDbHdr = uri.QueryInterface(Ci.nsIMsgMessageUrl).messageHeader;
      let author = msgDbHdr.author;
      let dateInSeconds = msgDbHdr.dateInSeconds;
      EnigmailStdlib.msgHdrGetHeaders(msgDbHdr, function(hdrs) {
        if (hdrs.has('autocrypt')) {
          resolve({
            author: author,
            dateInSeconds: dateInSeconds,
            autocrypt_headers: hdrs.getAll('autocrypt')
          });
        } else {
          resolve({});
        }
      });
    });
  }
};
