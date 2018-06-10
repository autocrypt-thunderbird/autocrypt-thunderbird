/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global EnigInitCommon: false, EnigmailLog: false, EnigGetFrame: false */
/* global Components: false */

const Ci = Components.interfaces;

// Initialize enigmailCommon
EnigInitCommon("enigmailGenericDisplay");

function enigLoadPage() {
  EnigmailLog.DEBUG("enigmailGenricDisplay: enigLoadPage\n");
  let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.loadSheetUsingURIString("chrome://enigmail/skin/enigmail.css", 1);

  var contentFrame = EnigGetFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var placeholderElement = contentFrame.document.getElementById('placeholder');
  placeholderElement.appendChild(window.arguments[0]);

}

// window.onload = enigLoadPage;
