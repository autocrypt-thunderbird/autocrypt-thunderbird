/*global Components: false, escape: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailFuncs"];

/*
 * Common Enigmail crypto-related GUI functionality
 *
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */

var gTxtConverter = null;

const EnigmailFuncsRegexTwoAddr = new RegExp("<[^>,]*>[^,<]*<[^>,]*>");
const EnigmailFuncsRegexExtractPureEmail = new RegExp("(^|,)[^,]*<([^>]+)>[^,]*", "g");

const EnigmailFuncs = {
  /**
   * get a list of plain email addresses without name or surrounding <>
   * @mailAddrs |string| - address-list as specified in RFC 2822, 3.4
   *                       separated by ","
   *
   * @return |string|    - list of pure email addresses separated by ","
   */
  stripEmail: function(mailAddrs) {
    //EnigmailLog.DEBUG("funcs.jsm: stripEmail(): mailAddrs=" + mailAddrs + "\n");

    var qStart, qEnd;
    while ((qStart = mailAddrs.indexOf('"')) != -1) {
      qEnd = mailAddrs.indexOf('"', qStart + 1);
      if (qEnd == -1) {
        EnigmailLog.ERROR("funcs.jsm: stripEmail: Unmatched quote in mail address: " + mailAddrs + "\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

      mailAddrs = mailAddrs.substring(0, qStart) + mailAddrs.substring(qEnd + 1);
    }

    // Eliminate all whitespace, just to be safe
    mailAddrs = mailAddrs.replace(/\s+/g, "");

    // having two <..> <..> in one email is an error
    if (mailAddrs.match(EnigmailFuncsRegexTwoAddr)) {
      EnigmailLog.ERROR("funcs.jsm: stripEmail: Two <..> entries in mail address: " + mailAddrs + "\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    // Extract pure e-mail address list (stripping out angle brackets)
    mailAddrs = mailAddrs.replace(EnigmailFuncsRegexExtractPureEmail, "$1$2");

    // remove empty email addresses (including removing all ';')
    mailAddrs = mailAddrs.replace(/[,;]+/g, ",").replace(/^,/, "").replace(/,$/, "");

    return mailAddrs;
  },

  /**
   * Hide all menu entries and other XUL elements that are considered for
   * advanced users. The XUL items must contain 'advanced="true"' or
   * 'advanced="reverse"'.
   *
   * @obj:       |object| - XUL tree element
   * @attribute: |string| - attribute to set or remove (i.e. "hidden" or "collapsed")
   * @dummy:     |object| - anything
   *
   * no return value
   */


  collapseAdvanced: function(obj, attribute, dummy) {
    EnigmailLog.DEBUG("funcs.jsm: collapseAdvanced:\n");

    var advancedUser = EnigmailPrefs.getPref("advancedUser");

    obj = obj.firstChild;
    while (obj) {
      if (obj.getAttribute("advanced") == "true") {
        if (advancedUser) {
          obj.removeAttribute(attribute);
        }
        else {
          obj.setAttribute(attribute, "true");
        }
      }
      else if (obj.getAttribute("advanced") == "reverse") {
        if (advancedUser) {
          obj.setAttribute(attribute, "true");
        }
        else {
          obj.removeAttribute(attribute);
        }
      }

      obj = obj.nextSibling;
    }
  },

  /**
   * determine default values for signing and encryption.
   * Translates "old-style" defaults (pre-Enigmail v1.0) to "current" defaults
   *
   * @identiy - nsIMsgIdentity object
   *
   * no return values
   */
  getSignMsg: function(identity) {
    EnigmailLog.DEBUG("funcs.jsm: getSignMsg: identity.key=" + identity.key + "\n");
    var sign = null;

    EnigmailPrefs.getPref("configuredVersion"); // dummy call to getPref to ensure initialization

    var prefRoot = EnigmailPrefs.getPrefRoot();

    if (prefRoot.getPrefType("mail.identity." + identity.key + ".pgpSignPlain") === 0) {
      if (prefRoot.getPrefType("mail.identity." + identity.key + ".pgpSignMsg") === 0) {
        sign = identity.getBoolAttribute("pgpAlwaysSign");
        identity.setBoolAttribute("pgpSignEncrypted", sign);
        identity.setBoolAttribute("pgpSignPlain", sign);
      }
      else {
        sign = identity.getIntAttribute("pgpSignMsg");
        identity.setBoolAttribute("pgpSignEncrypted", sign == 1);
        identity.setBoolAttribute("pgpSignPlain", sign > 0);
      }
      prefRoot.deleteBranch("mail.identity." + identity.key + ".pgpSignMsg");
      prefRoot.deleteBranch("mail.identity." + identity.key + ".pgpAlwaysSign");
    }
  },


  /**
   * this function tries to mimic the Thunderbird plaintext viewer
   *
   * @plainTxt - |string| containing the plain text data
   *
   * @ return HTML markup to display mssage
   */

  formatPlaintextMsg: function(plainTxt) {
    if (!gTxtConverter)
      gTxtConverter = Cc["@mozilla.org/txttohtmlconv;1"].createInstance(Ci.mozITXTToHTMLConv);

    var prefRoot = EnigmailPrefs.getPrefRoot();
    var fontStyle = "";

    // set the style stuff according to perferences

    switch (prefRoot.getIntPref("mail.quoted_style")) {
      case 1:
        fontStyle = "font-weight: bold; ";
        break;
      case 2:
        fontStyle = "font-style: italic; ";
        break;
      case 3:
        fontStyle = "font-weight: bold; font-style: italic; ";
        break;
    }

    switch (prefRoot.getIntPref("mail.quoted_size")) {
      case 1:
        fontStyle += "font-size: large; ";
        break;
      case 2:
        fontStyle += "font-size: small; ";
        break;
    }

    fontStyle += "color: " + prefRoot.getCharPref("mail.citation_color") + ";";

    var convFlags = Ci.mozITXTToHTMLConv.kURLs;
    if (prefRoot.getBoolPref("mail.display_glyph"))
      convFlags |= Ci.mozITXTToHTMLConv.kGlyphSubstitution;
    if (prefRoot.getBoolPref("mail.display_struct"))
      convFlags |= Ci.mozITXTToHTMLConv.kStructPhrase;

    // start processing the message

    plainTxt = plainTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = plainTxt.split(/\n/);
    var oldCiteLevel = 0;
    var citeLevel = 0;
    var preface = "";
    var logLineStart = {
      value: 0
    };
    var isSignature = false;

    for (var i = 0; i < lines.length; i++) {
      preface = "";
      oldCiteLevel = citeLevel;
      if (lines[i].search(/^[\> \t]*\>$/) === 0)
        lines[i] += " ";

      citeLevel = gTxtConverter.citeLevelTXT(lines[i], logLineStart);

      if (citeLevel > oldCiteLevel) {

        preface = '</pre>';
        for (let j = 0; j < citeLevel - oldCiteLevel; j++) {
          preface += '<blockquote type="cite" style="' + fontStyle + '">';
        }
        preface += '<pre wrap="">\n';
      }
      else if (citeLevel < oldCiteLevel) {
        preface = '</pre>';
        for (let j = 0; j < oldCiteLevel - citeLevel; j++)
          preface += "</blockquote>";

        preface += '<pre wrap="">\n';
      }

      if (logLineStart.value > 0) {
        preface += '<span class="moz-txt-citetags">' +
          gTxtConverter.scanTXT(lines[i].substr(0, logLineStart.value), convFlags) +
          '</span>';
      }
      else if (lines[i] == "-- ") {
        preface += '<div class=\"moz-txt-sig\">';
        isSignature = true;
      }
      lines[i] = preface + gTxtConverter.scanTXT(lines[i].substr(logLineStart.value), convFlags);

    }

    var r = '<pre wrap="">' + lines.join("\n") + (isSignature ? '</div>' : '') + '</pre>';
    //EnigmailLog.DEBUG("funcs.jsm: r='"+r+"'\n");
    return r;
  },


  /**
   * extract the data fields following a header.
   * e.g. ContentType: xyz; Aa=b; cc=d
   * @data: |string| containing a single header
   *
   * @return |array| of |arrays| containing pairs of aa/b and cc/d
   */
  getHeaderData: function(data) {
    EnigmailLog.DEBUG("funcs.jsm: getHeaderData: " + data.substr(0, 100) + "\n");
    var a = data.split(/\n/);
    var res = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i].length === 0) break;
      let b = a[i].split(/;/);

      // extract "abc = xyz" tuples
      for (let j = 0; j < b.length; j++) {
        let m = b[j].match(/^(\s*)([^=\s;]+)(\s*)(=)(\s*)(.*)(\s*)$/);
        if (m) {
          // m[2]: identifier / m[6]: data
          res[m[2].toLowerCase()] = m[6].replace(/\s*$/, "");
          EnigmailLog.DEBUG("funcs.jsm: getHeaderData: " + m[2].toLowerCase() + " = " + res[m[2].toLowerCase()] + "\n");
        }
      }
      if (i === 0 && a[i].indexOf(";") < 0) break;
      if (i > 0 && a[i].search(/^\s/) < 0) break;
    }
    return res;
  },

  /***
   * Get the text for the encrypted subject (either configured by user or default)
   */
  getProtectedSubjectText: function() {
    if (EnigmailPrefs.getPref("protectedSubjectText").length > 0) {
      return EnigmailPrefs.getPref("protectedSubjectText");
    }
    else {
      return EnigmailLocale.getString("msgCompose.encryptedSubjectStub");
    }
  },

  cloneObj: function(orig) {
    let newObj;

    if (typeof orig !== "object" || orig === null || orig === undefined) {
      return orig;
    }

    if ("clone" in orig && typeof orig.clone === "function") {
      return orig.clone();
    }

    if (Array.isArray(orig) && orig.length > 0) {
      newObj = [];
      for (let i in orig) {
        if (typeof orig[i] === "object") {
          newObj.push(this.cloneObj(orig[i]));
        }
        else {
          newObj.push(orig[i]);
        }
      }
    }
    else {
      newObj = {};
      for (let i in orig) {
        if (typeof orig[i] === "object") {
          newObj[i] = this.cloneObj(orig[i]);
        }
        else
          newObj[i] = orig[i];
      }
    }

    return newObj;
  },

  /**
   * Compare two MIME part numbers to determine which of the two is earlier in the tree
   * MIME part numbers have the structure "x.y.z...", e.g 1, 1.2, 2.3.1.4.5.1.2
   *
   * @param  mime1, mime2 - String the two mime part numbers to compare.
   *
   * @return Number (one of -2, -1, 0, 1 , 2)
   *        - Negative number if mime1 is before mime2
   *        - Positive number if mime1 is after mime2
   *        - 0 if mime1 and mime2 are equal
   *        - if mime1 is a parent of mime2 the return value is -2
   *        - if mime2 is a parent of mime1 the return value is 2
   *
   *      Throws an error if mime1 or mime2 do not comply to the required format
   */
  compareMimePartLevel: function(mime1, mime2) {
    let s = new RegExp("^[0-9]+(\.[0-9]+)*$");
    if (mime1.search(s) < 0) throw "Invalid mime1";
    if (mime2.search(s) < 0) throw "Invalid mime2";

    let a1 = mime1.split(/./);
    let a2 = mime2.split(/./);

    for (let i = 0; i < Math.min(a1.length, a2.length); i++) {
      if (Number(mime1[i]) < Number(mime2[i])) return -1;
      if (Number(mime1[i]) > Number(mime2[i])) return 1;
    }
    if (a2.length > a1.length) return -2;
    if (a2.length < a1.length) return 2;
    return 0;
  }

};
