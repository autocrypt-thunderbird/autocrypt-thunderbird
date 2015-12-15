/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailWrapSelection");


function onLoad() {
  EnigmailLog.DEBUG("enigmailWrapSelection.js: onLoad\n");
  window.arguments[0].cancelled = true;
  window.arguments[0].Select = "";
}

function onAccept() {
  EnigmailLog.DEBUG("enigmailWrapSelection.js: onAccept\n");
  WrapSelect = document.getElementById("WrapSelectGroup");
  EnigmailLog.DEBUG("enigmailWrapSelection.js: onAccept, selected value='" + WrapSelect.value + "'\n");
  if (WrapSelect.value !== "") {
    window.arguments[0].Select = WrapSelect.value;
    window.arguments[0].cancelled = false;
    EnigmailLog.DEBUG("enigmailWrapSelection.js: onAccept, setting return value, disable cancel\n");
  }
  else {
    EnigmailLog.DEBUG("enigmailWrapSelection.js: onAccept, enable cancel\n");
    window.arguments[0].cancelled = true;
  }
}

function onCancel() {
  EnigmailLog.DEBUG("enigmailWrapSelection.js: onCancel, enable cancel\n");
  window.arguments[0].cancelled = true;
}
