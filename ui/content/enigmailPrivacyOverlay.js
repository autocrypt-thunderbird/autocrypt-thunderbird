/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint strict: 0 */

Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */

var EnigmailPrefOverlay = {
  juniorModeCallback: function(item) {
    EnigmailPrefs.setPref("juniorMode", Number(item.value));
  },

  initJuniorMode: function(event) {
    let jm = EnigmailPrefs.getPref("juniorMode");
    document.getElementById("enigmail_juniorMode").value = jm;
    /* global dump: false */
    dump("*** OK ***\n");
  },

  init: function() {
    window.addEventListener("load", EnigmailPrefOverlay.initJuniorMode, false);
    let prefPane = document.getElementById("panePrivacy");
    prefPane.addEventListener("paneload", EnigmailPrefOverlay.initJuniorMode);
  }
};

EnigmailPrefOverlay.init();
