/*global Components: false, btoa: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["AutocryptFuncs"];

/*
 * Common Autocrypt crypto-related GUI functionality
 *
 */





const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").AutocryptPrefs;
const AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
const AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;

var gTxtConverter = null;

var AutocryptFuncs = {
  /**
   * get a list of plain email addresses without name or surrounding <>
   * @param mailAddrs |string| - address-list encdoded in Unicode as specified in RFC 2822, 3.4
   *                             separated by , or ;
   *
   * @return |string|          - list of pure email addresses separated by ","
   */
  stripEmail: function(mailAddresses) {
    // AutocryptLog.DEBUG("funcs.jsm: stripEmail(): mailAddresses=" + mailAddresses + "\n");

    const SIMPLE = "[^<>,]+"; // RegExp for a simple email address (e.g. a@b.c)
    const COMPLEX = "[^<>,]*<[^<>, ]+>"; // RegExp for an address containing <...> (e.g. Name <a@b.c>)
    const MatchAddr = new RegExp("^(" + SIMPLE + "|" + COMPLEX + ")(," + SIMPLE + "|," + COMPLEX + ")*$");

    let mailAddrs = mailAddresses;

    let qStart, qEnd;
    while ((qStart = mailAddrs.indexOf('"')) >= 0) {
      qEnd = mailAddrs.indexOf('"', qStart + 1);
      if (qEnd < 0) {
        AutocryptLog.ERROR("funcs.jsm: stripEmail: Unmatched quote in mail address: '" + mailAddresses + "'\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

      mailAddrs = mailAddrs.substring(0, qStart) + mailAddrs.substring(qEnd + 1);
    }

    // replace any ";" by ","; remove leading/trailing ","
    mailAddrs = mailAddrs.replace(/[,;]+/g, ",").replace(/^,/, "").replace(/,$/, "");

    if (mailAddrs.length === 0) return "";

    // having two <..> <..> in one email, or things like <a@b.c,><d@e.f> is an error
    if (mailAddrs.search(MatchAddr) < 0) {
      AutocryptLog.ERROR("funcs.jsm: stripEmail: Invalid <..> brackets in mail address: '" + mailAddresses + "'\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    // We know that the "," and the < > are at the right places, thus we can split by ","
    let addrList = mailAddrs.split(/,/);

    for (let i in addrList) {
      // Extract pure e-mail address list (strip out anything before angle brackets and any whitespace)
      addrList[i] = addrList[i].replace(/^([^<>]*<)([^<>]+)(>)$/, "$2").replace(/\s/g, "");
    }

    // remove repeated, trailing and leading "," (again, as there may be empty addresses)
    mailAddrs = addrList.join(",").replace(/,,/g, ",").replace(/^,/, "").replace(/,$/, "");

    return mailAddrs;
  },

  /**
   * get an array of email object (email, name) from an address string
   * @param mailAddrs |string| - address-list as specified in RFC 2822, 3.4
   *                             separated by ","; encoded according to RFC 2047
   *
   * @return |array| of msgIAddressObject
   */
  parseEmails: function(mailAddrs, encoded = true) {

    try {
      let hdr = Cc["@mozilla.org/messenger/headerparser;1"].createInstance(Ci.nsIMsgHeaderParser);
      if (encoded) {
        return hdr.parseEncodedHeader(mailAddrs, "utf-8");
      }
      return hdr.parseDecodedHeader(mailAddrs);
    }
    catch (ex) {}

    return [];
  },

  /**
   * Format a key fingerprint
   * @fingerprint |string|  -  unformated OpenPGP fingerprint
   *
   * @return |string| - formatted string
   */
  formatFpr: function(fingerprint) {
    //AutocryptLog.DEBUG("key.jsm: AutocryptKey.formatFpr(" + fingerprint + ")\n");
    // format key fingerprint
    let r = "";
    const fpr = fingerprint.match(/(....)(....)(....)(....)(....)(....)(....)(....)(....)?(....)?/);
    if (fpr && fpr.length > 2) {
      fpr.shift();
      r = fpr.join(" ");
    }

    return r;
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

    var prefRoot = AutocryptPrefs.getPrefRoot();
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
      if (lines[i].search(/^[> \t]*>$/) === 0)
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
        preface += '<div class="moz-txt-sig">';
        isSignature = true;
      }
      lines[i] = preface + gTxtConverter.scanTXT(lines[i].substr(logLineStart.value), convFlags);

    }

    var r = '<pre wrap="">' + lines.join("\n") + (isSignature ? '</div>' : '') + '</pre>';
    //AutocryptLog.DEBUG("funcs.jsm: r='"+r+"'\n");
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
    AutocryptLog.DEBUG("funcs.jsm: getHeaderData: " + data.substr(0, 100) + "\n");
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
          AutocryptLog.DEBUG("funcs.jsm: getHeaderData: " + m[2].toLowerCase() + " = " + res[m[2].toLowerCase()] + "\n");
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
    if (AutocryptPrefs.getPref("protectedSubjectText").length > 0) {
      return AutocryptData.convertToUnicode(AutocryptPrefs.getPref("protectedSubjectText"), "utf-8");
    }
    else {
      return "...";
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
    let s = new RegExp("^[0-9]+(\\.[0-9]+)*$");
    if (mime1.search(s) < 0) throw "Invalid mime1";
    if (mime2.search(s) < 0) throw "Invalid mime2";

    let a1 = mime1.split(/\./);
    let a2 = mime2.split(/\./);

    for (let i = 0; i < Math.min(a1.length, a2.length); i++) {
      if (Number(a1[i]) < Number(a2[i])) return -1;
      if (Number(a1[i]) > Number(a2[i])) return 1;
    }

    if (a2.length > a1.length) return -2;
    if (a2.length < a1.length) return 2;
    return 0;
  },


  /**
   * Determine the total number of certificates in the X.509 certificates store
   *
   * @return {Number}: number of Certificates
   */
  getNumOfX509Certs: function() {

    let certDb = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);
    let certs = certDb.getCerts();

    let e = certs.getEnumerator();
    let nCerts = 0;

    while (e.hasMoreElements()) {
      nCerts++;
      e.getNext();
    }

    return nCerts;
  },

  /**
   * Get the nsIMsgAccount associated with a given nsIMsgIdentity
   */
  getAccountForIdentity: function(identity) {
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);

    for (let acct = 0; acct < accountManager.accounts.length; acct++) {
      let ac = accountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);

      for (let i = 0; i < ac.identities.length; i++) {
        let id = ac.identities.queryElementAt(i, Ci.nsIMsgIdentity);
        if (id.key === identity.key) {
          return ac;
        }
      }
    }
    return null;
  },

  /**
   * Strip extended email parts such as "+xyz" from "abc+xyz@gmail.com" for known domains
   * Currently supported domains: gmail.com, googlemail.com
   */
  getBaseEmail: function(emailAddr) {
    return emailAddr.replace(/\+.{1,999}@(gmail|googlemail).com$/i, "");
  },

  /**
   * Get a list of all own email addresses, taken from all identities
   * and all reply-to addresses
   */
  getOwnEmailAddresses: function() {
    let ownEmails = {};

    let am = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);

    // Determine all sorts of own email addresses
    for (let i = 0; i < am.allIdentities.length; i++) {
      let id = am.allIdentities.queryElementAt(i, Ci.nsIMsgIdentity);
      if (id.email && id.email.length > 0) ownEmails[this.getBaseEmail(id.email.toLowerCase())] = 1;
      if (id.replyTo && id.replyTo.length > 0) {
        try {
          let replyEmails = this.stripEmail(id.replyTo).toLowerCase().split(/,/);
          for (let j in replyEmails) {
            ownEmails[this.getBaseEmail(replyEmails[j])] = 1;
          }
        }
        catch (ex) {}
      }
    }

    return ownEmails;
  },

  /**
   * Determine the distinct non-self recipients
   */
  getDistinctNonSelfRecipients: function(...emailStrings) {
    let recipients = {}, ownEmails = this.getOwnEmailAddresses();

    let addressStrings = emailStrings
      .filter(x => x)
      .map(arg => this.stripEmail(arg).toLowerCase());
    let emails = addressStrings.join(',').split(/,+/);

    for (let i = 0; i < emails.length; i++) {
      let r = this.getBaseEmail(emails[i]);
      if (r.length > 0 && !(r in ownEmails)) {
        recipients[r] = 1;
      }
    }

    return Object.keys(recipients);
  },

  /**
   * Determine the distinct number of non-self recipients of a message.
   * Only To: and Cc: fields are considered.
   */
  getNumberOfRecipients: function(msgCompField) {
    return this.getDistinctNonSelfRecipients(msgCompField.to, msgCompField.cc).length;
  },

  /**
   * Synchronize a promise
   */
  syncPromise: function(promise) {
    let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

    let res = null;
    let p = promise.then(gotResult => {
      res = gotResult;
      inspector.exitNestedEventLoop();
    }).catch(gotResult => {
      res = gotResult;
      inspector.exitNestedEventLoop();
    });

    inspector.enterNestedEventLoop(0);

    return res;
  }
};
