/*global Components: false, escape: false */
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
 * Copyright (C) 2011 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Marius Stübs <marius.stuebs@riseup.net>
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

const EXPORTED_SYMBOLS = ["EnigmailFuncs"];

var gTxtConverter = null;

const EnigmailFuncs = {
  /**
   * get a list of plain email addresses without name or surrounding <>
   * @mailAddrs |string| - address-list as specified in RFC 2822, 3.4
   *                       separated by ","
   *
   * @return |string|    - list of pure email addresses separated by ","
   */
  stripEmail: function(mailAddrs) {

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

    // Extract pure e-mail address list (stripping out angle brackets)
    mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g, "$1$2");

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
  }

};