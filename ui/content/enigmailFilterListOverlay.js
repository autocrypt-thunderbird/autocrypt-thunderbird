/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global currentFilter: false */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false */
Cu.import("resource://enigmail/pEpAdapter.jsm"); /* global EnigmailPEPAdapter: false */

var EnigmailListEditor = {
  onLoad: function() {
    EnigmailLog.DEBUG("EnigmailFilterOverlay.js: onLoad()\n");
    this.onSelect();

    let fl = document.getElementById("filterList");
    fl.addEventListener("select", EnigmailListEditor.onSelect.bind(EnigmailListEditor), false);
    fl.addEventListener("click", EnigmailListEditor.onClick.bind(EnigmailListEditor), true);
  },

  onUnload: function() {
    window.removeEventListener("load-enigmail", EnigmailListEditor.onLoad, false);
    window.removeEventListener("unload-enigmail", EnigmailListEditor.onUnload, false);

    let fl = document.getElementById("filterList");
    fl.removeEventListener("select", EnigmailListEditor.onSelect, false);
    fl.removeEventListener("click", EnigmailListEditor.onClick, true);
  },

  onSelect: function() {
    EnigmailLog.DEBUG("EnigmailFilterOverlay.js: onSelect()\n");

    if (!EnigmailPEPAdapter.usingPep()) return;

    var l = document.getElementById("filterList");
    if (l.selectedItems.length !== 1) return;

    if (currentFilter().filterName === EnigmailPEPAdapter.filter.DECRYPT_FILTER_NAME) {
      // disable modification or deletion of the pEp-specific message decryption rule
      document.getElementById("editButton").setAttribute("disabled", "true");
      document.getElementById("deleteButton").setAttribute("disabled", "true");
    }
  },

  onClick: function(event) {
    if ("label" in event.target && event.target.label === EnigmailPEPAdapter.filter.DECRYPT_FILTER_NAME) {
      event.stopPropagation();
    }
  }
};

window.addEventListener("load-enigmail", EnigmailListEditor.onLoad.bind(EnigmailListEditor), false);
window.addEventListener("unload-enigmail", EnigmailListEditor.onUnload.bind(EnigmailListEditor), false);
