/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */


var Enigmail = {
  usingPep: null,
  onLoad: function(event) {
    this.usingPep = EnigmailPEPAdapter.usingPep();
  },

  onUnload: function(event) {
    let usingPep = EnigmailPEPAdapter.usingPep();

    if (usingPep !== this.usingPep) {
      EnigmailPEPAdapter.handleJuniorModeChange();
    }

    if (usingPep) {
      EnigmailPEPAdapter.setOwnIdentities(0);
    }
  }
};

window.addEventListener("load", Enigmail.onLoad.bind(Enigmail), true);
window.addEventListener("unload", Enigmail.onUnload.bind(Enigmail), true);
