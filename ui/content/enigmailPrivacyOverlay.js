/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint strict: 0 */

Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */

var EnigmailPrefOverlay = {
  _windowResized: 0,

  juniorModeCallback: function(item) {
    EnigmailPrefs.setPref("juniorMode", Number(item.value));
  },

  initJuniorMode: function() {
    EnigmailLog.DEBUG("enigmailPrivacyOverlay.js: initJuniorMode()\n");
    let prefGroup = document.getElementById("enigmail_juniorModeGroup");

    EnigmailTimer.setTimeout(function _f() {
      let jm = EnigmailPrefs.getPref("juniorMode");
      document.getElementById("enigmail_juniorMode").value = jm;

      if (EnigmailPEPAdapter.isPepAvailable()) {
        EnigmailLog.DEBUG("enigmailPrivacyOverlay.js: initJuniorMode - pEp is available\n");
        prefGroup.removeAttribute("hidden");

        let prefWindow = document.getElementById("MailPreferences");
        if (this._windowResized === 0 && prefWindow.currentPane.id === "panePrivacy") {
          window.resizeBy(0, prefGroup.clientHeight);
        }
      }
      else {
        EnigmailLog.DEBUG("enigmailPrivacyOverlay.js: initJuniorMode - pEp NOT available\n");
        prefGroup.setAttribute("hidden", "true");
      }

    }, 100);
  },

  onWindowClose: function(event) {
    try {
      if (EnigmailPEPAdapter.isPepAvailable()) {
        EnigmailPEPAdapter.initialize();
      }
    }
    catch (ex) {}
  },

  onLoad: function() {
    window.addEventListener("unload", EnigmailPrefOverlay.onWindowClose, false);
    let prefPane = document.getElementById("panePrivacy");
    prefPane.addEventListener("paneload", EnigmailPrefOverlay.initJuniorMode);

    EnigmailPrefOverlay.initJuniorMode();
  },

  onUnload: function() {
    window.removeEventListener("load-enigmail", EnigmailPrefOverlay.onLoad, false);
    window.removeEventListener("unload-enigmail", EnigmailPrefOverlay.onUnload, false);
    window.removeEventListener("unload", EnigmailPrefOverlay.onWindowClose, false);

    let prefPane = document.getElementById("panePrivacy");
    prefPane.removeEventListener("paneload", EnigmailPrefOverlay.initJuniorMode);
  }
};

window.addEventListener("load-enigmail", EnigmailPrefOverlay.onLoad.bind(EnigmailPrefOverlay), false);
window.addEventListener("unload-enigmail", EnigmailPrefOverlay.onUnload.bind(EnigmailPrefOverlay), false);
