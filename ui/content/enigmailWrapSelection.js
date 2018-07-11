/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/ui/enigmailCommon.js

/* global Components: false, EnigmailLog: false */


"use strict";

const Ci = Components.interfaces;

function onLoad() {
  EnigmailLog.DEBUG("enigmailwrapSelection.js: onLoad\n");
  let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.loadSheetUsingURIString("chrome://enigmail/skin/enigmail.css", 1);

  window.arguments[0].cancelled = true;
  window.arguments[0].Select = "";
}

function onAccept() {
  EnigmailLog.DEBUG("enigmailwrapSelection.js: onAccept\n");
  let wrapSelect = document.getElementById("wrapSelectGroup");
  EnigmailLog.DEBUG("enigmailwrapSelection.js: onAccept, selected value='" + wrapSelect.value + "'\n");
  if (wrapSelect.value !== "") {
    window.arguments[0].Select = wrapSelect.value;
    window.arguments[0].cancelled = false;
    EnigmailLog.DEBUG("enigmailwrapSelection.js: onAccept, setting return value, disable cancel\n");
  }
  else {
    EnigmailLog.DEBUG("enigmailwrapSelection.js: onAccept, enable cancel\n");
    window.arguments[0].cancelled = true;
  }
}

function onCancel() {
  EnigmailLog.DEBUG("enigmailwrapSelection.js: onCancel, enable cancel\n");
  window.arguments[0].cancelled = true;
}
