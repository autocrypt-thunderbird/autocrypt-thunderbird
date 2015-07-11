/*global Components: false, escape: false, btoa: false*/
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

const EXPORTED_SYMBOLS = [ "EnigmailMime" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/jsmime.jsm"); /*global jsmime: false*/
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */

const EnigmailMime = {
    /***
     * create a string of random characters suitable to use for a boundary in a
     * MIME message following RFC 2045
     *
     * @return: string of 33 random characters and digits
     */
    createBoundary: function() {
        let b = "";
        let r = 0;
        for (let i=0; i<33; i++) {
            r = Math.floor(Math.random() * 58);
            b += String.fromCharCode((r < 10 ? 48 : (r < 34 ? 55 :  63)) + r);
        }
        return b;
    },

    /***
     * determine the "boundary" part of a mail content type.
     *
     * @contentTypeStr: the string containing all parts of a content-type.
     *               (e.g. multipart/mixed; boundary="xyz") --> returns "xyz"
     *
     * @return: String containing the boundary parameter; or null
     */

    getBoundary: function(contentTypeStr) {
      contentTypeStr = contentTypeStr.replace(/[\r\n]/g, "");
      let boundary = "";
      let ct = contentTypeStr.split(/;/);
      for (let i=0; i < ct.length; i++) {
        if (ct[i].search(/[ \t]*boundary[ \t]*=/i) >= 0) {
          boundary = ct[i];
          break;
        }
      }
      boundary = boundary.replace(/\s*boundary\s*=/i, "").replace(/[\'\"]/g, "");
      return boundary;
    },

    /***
     * determine the "charset" part of a mail content type.
     *
     * @contentTypeStr: the string containing all parts of a content-type.
     *               (e.g. multipart/mixed; charset="utf-8") --> returns "utf-8"
     *
     * @return: String containing the charset parameter; or null
     */

    getCharset: function(contentTypeStr) {
      contentTypeStr = contentTypeStr.replace(/[\r\n]/g, "");
      let boundary = "";
      let ct = contentTypeStr.split(/;/);
      for (let i=0; i < ct.length; i++) {
        if (ct[i].search(/[ \t]*charset[ \t]*=/i) >= 0) {
          boundary = ct[i];
          break;
        }
      }
      boundary = boundary.replace(/\s*charset\s*=/i, "").replace(/[\'\"]/g, "");
      return boundary;
    },

    /**
     * Convert a MIME header value into a UTF-8 encoded representation following RFC 2047
     */
    encodeHeaderValue: function (aStr) {
        let ret = "";

        if (aStr.search(/[^\x01-\x7F]/) >= 0) {
            let s = EnigmailData.convertFromUnicode(aStr, "utf-8");
            ret = "=?UTF-8?B?" + btoa(s) + "?=";
        } else {
            ret = aStr;
        }

        return ret;
    },

    /**
     * format MIME header with maximum length of 72 characters. 
     */
    formatHeaderData: function (hdrValue) {
      let header;
      if (Array.isArray(hdrValue)) {
        header = hdrValue.join("").split(" ");
      } else {
        header = hdrValue.split(" ");
      }

      let line = "";
      let lines = [];

      for (let i = 0; i < header.length; i++) {
        if(line.length + header[i].length >= 72) {
          lines.push(line+"\r\n");
          line = " "+header[i];
        } else {
          line +=  " " + header[i];
        }
      }

      lines.push(line);

      return lines.join("").trim();
    },

    /**
     * Correctly encode and format a set of email addresses for RFC 2047
     */
    formatEmailAddress: function (addressData) {
        const adrArr = addressData.split(/, */);

        for (let i in adrArr) {
            try {
                const m = adrArr[i].match(/(.*[\w\s]+?)<([\w\-][\w\-\.]+@[\w\-][\w\-\.]+[a-zA-Z]{1,4})>/);
                if (m && m.length == 3) {
                    adrArr[i] = this.encodeHeaderValue(m[1])+" <" + m[2] + ">";
                }
            } catch(ex) {}
        }

        return adrArr.join(", ");
    },

    /***
     * determine if the message data contains a first mime part with content-type = "text/rfc822-headers"
     * if so, extract the corresponding field(s)
     */

    extractProtectedHeaders: function(contentData) {

      // quick return
      if (contentData.search(/text\/rfc822-headers/i) < 0) {
        return null;
      }

      let m = contentData.search(/^--/m);

      if (m < 5) {
        return null;
      }

      let outerHdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
      outerHdr.initialize(contentData.substr(0, m));

      let ct = outerHdr.extractHeader("content-type", false) || "";
      let bound = EnigmailMime.getBoundary(ct);

      let r = new RegExp("^--" + bound, "ym");

      let startPos = -1;
      let endPos = -1;

      let match = r.exec(contentData);
      if (match && match.index) {
        startPos = match.index;
      }

      match = r.exec(contentData);
      if (match && match.index) {
        endPos = match.index;
      }

      if (startPos < 0 || endPos < 0) return;

      let contentBody = contentData.substring(startPos + bound.length + 3, endPos);
      let i = contentBody.search(/^[A-Za-z]/m); // skip empty lines
      if (i > 0) {
        contentBody = contentBody.substr(i);
      }
      let headers = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
      headers.initialize(contentBody);

      let innerCt = headers.extractHeader("content-type", false) || "";

      if (innerCt.search(/^text\/rfc822-headers/i) !== 0) {
        return null;
      }

      let charset = EnigmailMime.getCharset(innerCt);
      let ctt = headers.extractHeader("content-transfer-encoding", false) || "";

      let bodyStartPos = contentBody.search(/\r?\n\s*\r?\n/) + 1;

      if (bodyStartPos < 10) return;

      bodyStartPos += contentBody.substr(bodyStartPos).search(/^[A-Za-z]/m);

      let ctBodyData = contentBody.substr(bodyStartPos);

      if (ctt.search(/^base64/i) === 0) {
        ctBodyData = EnigmailData.decodeBase64(ctBodyData) + "\n";
      }
      else if (ctt.search(/^quoted-printable/i) === 0) {
        ctBodyData = EnigmailData.decodeQuotedPrintable(ctBodyData) + "\n";
      }
      
      if (charset) {
        ctBodyData = EnigmailData.convertToUnicode(ctBodyData, charset);
      }

      let bodyHdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
      bodyHdr.initialize(ctBodyData);

      let h = [ "subject", "date", "from", "to", "cc", "reply-to", "references",
          "newsgroups", "followup-to", "message-id" ];

      let newHeaders = {};
      for (let i in h) {
        if (bodyHdr.hasHeader(h[i])) {
          newHeaders[h[i]] = jsmime.headerparser.decodeRFC2047Words(bodyHdr.extractHeader(h[i], true)) || undefined;
        }
      }
      
      return { newHeaders: newHeaders, startPos: startPos, endPos: endPos };
    }
};
