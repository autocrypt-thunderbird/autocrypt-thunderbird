/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global Components: false */

const Ci = Components.interfaces;

function onLoad() {
  let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.loadSheetUsingURIString("chrome://enigmail/skin/enigmail.css", 1);

  document.getElementById("photoImage").setAttribute("src", window.arguments[0].photoUri);
  document.getElementById("keyDesc").setAttribute("value", "0x" + window.arguments[0].keyId +
    " - " + window.arguments[0].userId);
}

function acceptDlg() {
  window.arguments[0].okPressed = true;
  return true;
}
