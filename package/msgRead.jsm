/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailMsgRead"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

/**
 * Message-reading related functions
 */

Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/app.jsm"); /*global EnigmailApp: false */
Cu.import("resource://enigmail/versioning.jsm"); /*global EnigmailVersioning: false */

const ExtraHeaders = ["autocrypt", "openpgp"];

var EnigmailMsgRead = {
  /**
   * Ensure that Thunderbird prepares certain headers during message reading
   */
  ensureExtraAddonHeaders: function() {
    let r = EnigmailPrefs.getPrefRoot();

    // is the Mozilla Platform number >= 59?
    let isPlatform59 = EnigmailVersioning.greaterThanOrEqual(EnigmailApp.getPlatformVersion(), "59.0a1");

    let prefName = (isPlatform59 ? "mailnews.headers.extraAddonHeaders" : "mailnews.headers.extraExpandedHeaders");

    let hdr = r.getCharPref(prefName);

    if (hdr !== "*") { // do nothing if extraAddonHeaders is "*" (all headers)
      for (let h of ExtraHeaders) {
        let sr = new RegExp("\\b" + h + "\\b", "i");
        if (hdr.search(h) < 0) {
          if (hdr.length > 0) hdr += " ";
          hdr += h;
        }
      }

      r.setCharPref(prefName, hdr);
    }

    if (isPlatform59) {
      this.cleanupOldPref();
    }
  },

  /**
   * Clean up extraExpandedHeaders after upgrading to TB 59.
   */
  cleanupOldPref: function() {
    let r = EnigmailPrefs.getPrefRoot();

    let hdr = r.getCharPref("mailnews.headers.extraExpandedHeaders");
    for (let h of ExtraHeaders) {
      let sr = new RegExp("\\b" + h + "\\b", "i");
      if (hdr.search(h) >= 0) {
        hdr = hdr.replace(sr, " ");
      }
    }

    r.setCharPref("mailnews.headers.extraExpandedHeaders", hdr.trim());
  },

  /**
   * Get a mail URL from a uriSpec
   *
   * @param uriSpec: String - URI of the desired message
   *
   * @return Object: nsIURL or nsIMsgMailNewsUrl object
   */
  getUrlFromUriSpec: function(uriSpec) {
    try {
      if (!uriSpec)
        return null;

      let messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
      let msgService = messenger.messageServiceFromURI(uriSpec);

      let urlObj = {};
      msgService.GetUrlForUri(uriSpec, urlObj, null);

      let url = urlObj.value;

      if (url.scheme == "file") {
        return url;
      }
      else {
        return url.QueryInterface(Ci.nsIMsgMailNewsUrl);
      }

    }
    catch (ex) {
      return null;
    }
  },

  /**
   * Determine if an attachment is possibly signed
   */
  checkSignedAttachment: function(attachmentObj, index, currentAttachments) {
    function escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    var attachmentList;
    if (index !== null) {
      attachmentList = attachmentObj;
    }
    else {
      attachmentList = currentAttachments;
      for (let i = 0; i < attachmentList.length; i++) {
        if (attachmentList[i].url == attachmentObj.url) {
          index = i;
          break;
        }
      }
      if (index === null) return false;
    }

    var signed = false;
    var findFile;

    var attName = this.getAttachmentName(attachmentList[index]).toLowerCase().replace(/\+/g, "\\+");

    // check if filename is a signature
    if ((this.getAttachmentName(attachmentList[index]).search(/\.(sig|asc)$/i) > 0) ||
      (attachmentList[index].contentType.match(/^application\/pgp-signature/i))) {
      findFile = new RegExp(escapeRegex(attName.replace(/\.(sig|asc)$/, "")));
    }
    else if (attName.search(/\.pgp$/i) > 0) {
      findFile = new RegExp(escapeRegex(attName.replace(/\.pgp$/, "")) + "(\\.pgp)?\\.(sig|asc)$");
    }
    else {
      findFile = new RegExp(escapeRegex(attName) + "\\.(sig|asc)$");
    }

    for (let i in attachmentList) {
      if ((i != index) &&
        (this.getAttachmentName(attachmentList[i]).toLowerCase().search(findFile) === 0))
        signed = true;
    }

    return signed;
  },

  /**
   * Get the name of an attachment from the attachment object
   */
  getAttachmentName: function(attachment) {
    if ("name" in attachment) {
      // Thunderbird
      return attachment.name;
    }
    else
    // SeaMonkey
      return attachment.displayName;
  },


  /**
   * Escape text such that it can be used as HTML text
   */
  escapeTextForHTML: function(text, hyperlink) {
    // Escape special characters
    if (text.indexOf("&") > -1)
      text = text.replace(/&/g, "&amp;");

    if (text.indexOf("<") > -1)
      text = text.replace(/</g, "&lt;");

    if (text.indexOf(">") > -1)
      text = text.replace(/>/g, "&gt;");

    if (text.indexOf("\"") > -1)
      text = text.replace(/"/g, "&quot;");

    if (!hyperlink)
      return text;

    // Hyperlink email addresses (we accept at most 1024 characters before and after the @)
    var addrs = text.match(/\b[A-Za-z0-9_+.-]{1,1024}@[A-Za-z0-9.-]{1,1024}\b/g);

    var newText, offset, loc;
    if (addrs && addrs.length) {
      newText = "";
      offset = 0;

      for (var j = 0; j < addrs.length; j++) {
        var addr = addrs[j];

        loc = text.indexOf(addr, offset);
        if (loc < offset)
          break;

        if (loc > offset)
          newText += text.substr(offset, loc - offset);

        // Strip any period off the end of address
        addr = addr.replace(/[.]$/, "");

        if (!addr.length)
          continue;

        newText += "<a href=\"mailto:" + addr + "\">" + addr + "</a>";

        offset = loc + addr.length;
      }

      newText += text.substr(offset, text.length - offset);

      text = newText;
    }

    // Hyperlink URLs (we don't accept URLS or more than 1024 characters length)
    var urls = text.match(/\b(http|https|ftp):\S{1,1024}\s/g);

    if (urls && urls.length) {
      newText = "";
      offset = 0;

      for (var k = 0; k < urls.length; k++) {
        var url = urls[k];

        loc = text.indexOf(url, offset);
        if (loc < offset)
          break;

        if (loc > offset)
          newText += text.substr(offset, loc - offset);

        // Strip delimiters off the end of URL
        url = url.replace(/\s$/, "");
        url = url.replace(/([),.']|&gt;|&quot;)$/, "");

        if (!url.length)
          continue;

        newText += "<a href=\"" + url + "\">" + url + "</a>";

        offset = loc + url.length;
      }

      newText += text.substr(offset, text.length - offset);

      text = newText;
    }

    return text;
  }
};
