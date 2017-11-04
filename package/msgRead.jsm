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
  ensureExtraExpandedHeaders: function() {
    let r = EnigmailPrefs.getPrefRoot();
    let hdr = r.getCharPref("mailnews.headers.extraExpandedHeaders");

    const ExtraHeaders = ["autocrypt"];

    for (let h of ExtraHeaders) {
      let sr = new RegExp("\\b" + h + "\\b", "i");
      if (hdr.search(h) < 0) {
        if (hdr.length > 0) hdr += " ";
        hdr += h;
        r.setCharPref("mailnews.headers.extraExpandedHeaders", hdr);
      }
    }
  }
};
