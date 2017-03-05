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
    fl.addEventListener("select", EnigmailListEditor.onSelect.bind(EnigmailListEditor));
    fl.addEventListener("click", EnigmailListEditor.onClick.bind(EnigmailListEditor), true);
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

window.addEventListener("load", EnigmailListEditor.onLoad.bind(EnigmailListEditor), false);
