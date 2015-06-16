/*global Components: false, EnigmailLog: false, unescape: false */
/*jshint -W097 */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Ramalingam Saravanan <svn@xmlterm.org>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

"use strict";

const EXPORTED_SYMBOLS = [ "EnigmailData" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const SCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const HEX_TABLE = "0123456789abcdef";

function converter(charset) {
    let unicodeConv = Cc[SCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Ci.nsIScriptableUnicodeConverter);
    unicodeConv.charset = charset || "utf-8";
    return unicodeConv;
}

const EnigmailData = {
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
        return unescape(str.replace(/%/g, "=25").replace(/=/g,'%'));
    },

    convertToUnicode: function (text, charset) {
        if (!text || (charset && (charset.toLowerCase() == "iso-8859-1"))) {
            return text;
        }

        // Encode plaintext
        try {
            return converter(charset).ConvertToUnicode(text);
        } catch (ex) {
            return text;
        }
    },

    convertFromUnicode: function (text, charset) {
        if (!text) {
            return "";
        }

        try {
            return converter(charset).ConvertFromUnicode(text);
        } catch (ex) {
            return text;
        }
    },

    convertGpgToUnicode: function (text) {
        if(typeof(text) === "string") {
            text = text.replace(/\\x3a/ig, "\\e3A");
            var a=text.search(/\\x[0-9a-fA-F]{2}/);
            while(a>=0) {
                var ch = unescape('%'+text.substr(a+2,2));
                var r = new RegExp("\\"+text.substr(a,4));
                text=text.replace(r, ch);

                a=text.search(/\\x[0-9a-fA-F]{2}/);
            }

            text = EnigmailData.convertToUnicode(text, "utf-8").replace(/\\e3A/g, ":");
        }

        return text;
    },

    pack: function (value, bytes) {
        let str = '';
        let mask = 0xff;
        for (let j=0; j < bytes; j++) {
            str = String.fromCharCode( (value & mask) >> j*8 ) + str;
            mask <<= 8;
        }

        return str;
    },

    unpack: function (str) {
        let len = str.length;
        let value = 0;

        for (let j=0; j < len; j++) {
            value <<= 8;
            value  |= str.charCodeAt(j);
        }

        return value;
    },

    bytesToHex: function (str) {
        let len = str.length;

        let hex = '';
        for (let j=0; j < len; j++) {
            let charCode = str.charCodeAt(j);
            hex += HEX_TABLE.charAt((charCode & 0xf0) >> 4) +
                HEX_TABLE.charAt((charCode & 0x0f));
        }

        return hex;
    }
};
