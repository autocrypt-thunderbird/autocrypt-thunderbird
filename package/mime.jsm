/*global Components: false, escape: false, btoa: false*/
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailMime"];

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
    for (let i = 0; i < 33; i++) {
      r = Math.floor(Math.random() * 58);
      b += String.fromCharCode((r < 10 ? 48 : (r < 34 ? 55 : 63)) + r);
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
    for (let i = 0; i < ct.length; i++) {
      if (ct[i].search(/[ \t]*boundary[ \t]*=/i) >= 0) {
        boundary = ct[i];
        break;
      }
    }
    boundary = boundary.replace(/\s*boundary\s*=/i, "").replace(/[\'\"]/g, "");
    return boundary;
  },

  /***
   * determine the "protocol" part of a mail content type.
   *
   * @contentTypeStr: the string containing all parts of a content-type.
   *               (e.g. multipart/signed; protocol="xyz") --> returns "xyz"
   *
   * @return: String containing the protocol parameter; or null
   */

  getProtocol: function(contentTypeStr) {
    contentTypeStr = contentTypeStr.replace(/[\r\n]/g, "");
    let proto = "";
    let ct = contentTypeStr.split(/;/);
    for (let i = 0; i < ct.length; i++) {
      if (ct[i].search(/[ \t]*protocol[ \t]*=/i) >= 0) {
        proto = ct[i];
        break;
      }
    }
    proto = proto.replace(/\s*protocol\s*=/i, "").replace(/[\'\"]/g, "");
    return proto;
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
    for (let i = 0; i < ct.length; i++) {
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
  encodeHeaderValue: function(aStr) {
    let ret = "";

    if (aStr.search(/[^\x01-\x7F]/) >= 0) {
      let s = EnigmailData.convertFromUnicode(aStr, "utf-8");
      ret = "=?UTF-8?B?" + btoa(s) + "?=";
    }
    else {
      ret = aStr;
    }

    return ret;
  },

  /**
   * format MIME header with maximum length of 72 characters.
   */
  formatHeaderData: function(hdrValue) {
    let header;
    if (Array.isArray(hdrValue)) {
      header = hdrValue.join("").split(" ");
    }
    else {
      header = hdrValue.split(" ");
    }

    let line = "";
    let lines = [];

    for (let i = 0; i < header.length; i++) {
      if (line.length + header[i].length >= 72) {
        lines.push(line + "\r\n");
        line = " " + header[i];
      }
      else {
        line += " " + header[i];
      }
    }

    lines.push(line);

    return lines.join("").trim();
  },

  /**
   * Correctly encode and format a set of email addresses for RFC 2047
   */
  formatEmailAddress: function(addressData) {
    const adrArr = addressData.split(/, */);

    for (let i in adrArr) {
      try {
        const m = adrArr[i].match(/(.*[\w\s]+?)<([\w\-][\w\-\.]+@[\w\-][\w\-\.]+[a-zA-Z]{1,4})>/);
        if (m && m.length == 3) {
          adrArr[i] = this.encodeHeaderValue(m[1]) + " <" + m[2] + ">";
        }
      }
      catch (ex) {}
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

    // find first MIME delimiter. Anything before that delimiter is the top MIME structure
    let m = contentData.search(/^--/m);

    if (m < 5) {
      return null;
    }

    let protectedHdr = ["subject", "date", "from",
      "to", "cc", "reply-to", "references",
      "newsgroups", "followup-to", "message-id"
    ];
    let newHeaders = {};

    // read headers of first MIME part and extract the boundary parameter
    let outerHdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    outerHdr.initialize(contentData.substr(0, m));

    let ct = outerHdr.extractHeader("content-type", false) || "";
    if (ct === "") return null;

    let bound = EnigmailMime.getBoundary(ct);
    if (bound === "") return null;

    // search for "outer" MIME delimiter(s)
    let r = new RegExp("^--" + bound, "mg");

    let startPos = -1;
    let endPos = -1;

    // 1st match: start of 1st MIME-subpart
    let match = r.exec(contentData);
    if (match && match.index) {
      startPos = match.index;
    }

    // 2nd  match: end of 1st MIME-subpart
    match = r.exec(contentData);
    if (match && match.index) {
      endPos = match.index;
    }

    if (startPos < 0 || endPos < 0) return null;

    let headers = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    headers.initialize(contentData.substring(0, startPos));

    for (let i in protectedHdr) {
      if (headers.hasHeader(protectedHdr[i])) {
        newHeaders[protectedHdr[i]] = jsmime.headerparser.decodeRFC2047Words(headers.extractHeader(protectedHdr[i], true)) || undefined;
      }
    }

    // contentBody holds the complete 1st MIME part
    let contentBody = contentData.substring(startPos + bound.length + 3, endPos);
    let i = contentBody.search(/^[A-Za-z]/m); // skip empty lines
    if (i > 0) {
      contentBody = contentBody.substr(i);
    }

    headers.initialize(contentBody);

    let innerCt = headers.extractHeader("content-type", false) || "";

    if (innerCt.search(/^text\/rfc822-headers/i) === 0) {

      let charset = EnigmailMime.getCharset(innerCt);
      let ctt = headers.extractHeader("content-transfer-encoding", false) || "";

      // determine where the headers end and the MIME-subpart body starts
      let bodyStartPos = contentBody.search(/\r?\n\s*\r?\n/) + 1;

      if (bodyStartPos < 10) return null;

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

      // get the headers of the MIME-subpart body --> that's the ones we need
      let bodyHdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
      bodyHdr.initialize(ctBodyData);

      for (let i in protectedHdr) {
        if (bodyHdr.hasHeader(protectedHdr[i])) {
          newHeaders[protectedHdr[i]] = jsmime.headerparser.decodeRFC2047Words(bodyHdr.extractHeader(protectedHdr[i], true)) || undefined;
        }
      }
    }
    else {
      startPos = -1;
      endPos = -1;
    }

    return {
      newHeaders: newHeaders,
      startPos: startPos,
      endPos: endPos,
      securityLevel: 0
    };
  }
};
