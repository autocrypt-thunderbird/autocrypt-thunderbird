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

const EnigmailMsgRead = {
  /**
   * Ensure that Thunderbird prepares certain headers during message reading
   */
  ensureExtraAddonHeaders: function() {
    let r = EnigmailPrefs.getPrefRoot();
    let hdr = r.getCharPref("mailnews.headers.extraAddonHeaders");

    const ExtraHeaders = ["autocrypt", "openpgp"];

    if (hdr !== "*") { // do nothing if extraAddonHeaders is "*" (all headers)
      for (let h of ExtraHeaders) {
        let sr = new RegExp("\\b" + h + "\\b", "i");
        if (hdr.search(h) < 0) {
          if (hdr.length > 0) hdr += " ";
          hdr += h;
        }
      }

      r.setCharPref("mailnews.headers.extraAddonHeaders", hdr);
    }
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
      findFile = new RegExp(attName.replace(/\.(sig|asc)$/, ""));
    }
    else
      findFile = new RegExp(attName + ".(sig|asc)$");

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
  }
};
