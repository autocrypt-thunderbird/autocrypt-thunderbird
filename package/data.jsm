/*global Components: false, AutocryptLog: false, unescape: false, atob: false, btoa: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["AutocryptData"];




const SCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const HEX_TABLE = "0123456789abcdef";

function converter(charset) {
  let unicodeConv = Cc[SCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Ci.nsIScriptableUnicodeConverter);
  unicodeConv.charset = charset || "utf-8";
  return unicodeConv;
}

var AutocryptData = {
  getUnicodeData: function(data) {
    // convert output from subprocess to Unicode
    var tmpStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
    tmpStream.setData(data, data.length);
    var inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    inStream.init(tmpStream);
    return inStream.read(tmpStream.available());
  },

  extractMessageId: function(uri) {
    var messageId = "";

    var matches = uri.match(/^enigmail:message\/(.+)/);

    if (matches && (matches.length > 1)) {
      messageId = matches[1];
    }

    return messageId;
  },

  extractMimeMessageId: function(uri) {
    var messageId = "";

    var matches = uri.match(/^enigmail:mime-message\/(.+)/);

    if (matches && (matches.length > 1)) {
      messageId = matches[1];
    }

    return messageId;
  },

  decodeQuotedPrintable: function(str) {
    return unescape(str.replace(/%/g, "=25").replace(new RegExp('=', 'g'), '%'));
  },

  decodeBase64: function(str) {
    return atob(str.replace(/[\s\r\n]*/g, ""));
  },

  /***
   * Encode a string in base64, with a max. line length of 72 characters
   */
  encodeBase64: function(str) {
    return btoa(str).replace(/(.{72})/g, "$1\r\n");
  },

  convertToUnicode: function(text, charset) {
    if (!text || (charset && (charset.toLowerCase() == "iso-8859-1"))) {
      return text;
    }

    // Encode plaintext
    try {
      return converter(charset).ConvertToUnicode(text);
    }
    catch (ex) {
      return text;
    }
  },

  convertFromUnicode: function(text, charset) {
    if (!text) {
      return "";
    }

    try {
      return converter(charset).ConvertFromUnicode(text);
    }
    catch (ex) {
      return text;
    }
  },

  pack: function(value, bytes) {
    let str = '';
    let mask = 0xff;
    for (let j = 0; j < bytes; j++) {
      str = String.fromCharCode((value & mask) >> j * 8) + str;
      mask <<= 8;
    }

    return str;
  },

  unpack: function(str) {
    let len = str.length;
    let value = 0;

    for (let j = 0; j < len; j++) {
      value <<= 8;
      value |= str.charCodeAt(j);
    }

    return value;
  },

  bytesToHex: function(str) {
    let len = str.length;

    let hex = '';
    for (let j = 0; j < len; j++) {
      let charCode = str.charCodeAt(j);
      hex += HEX_TABLE.charAt((charCode & 0xf0) >> 4) +
        HEX_TABLE.charAt((charCode & 0x0f));
    }

    return hex;
  },

  /**
   * Convert an ArrayBuffer (or Uint8Array) object into a string
   */
  arrayBufferToString: function(buffer) {
    const MAXLEN = 102400;

    let uArr = new Uint8Array(buffer);
    let ret = "";
    let len = buffer.byteLength;

    for (let j = 0; j < Math.floor(len / MAXLEN) + 1; j++) {
      ret += String.fromCharCode.apply(null, uArr.subarray(j * MAXLEN, ((j + 1) * MAXLEN)));
    }

    return ret;
  }
};
