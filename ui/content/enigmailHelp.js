/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/ui/enigmailCommon.js

"use strict";

/* global EnigmailLog: false */
/* global Components: false */

const Ci = Components.interfaces;

/* global EnigInitCommon: false, EnigGetWindowOptions: false, EnigGetFrame: false, EnigGetHttpUri: false, EnigOpenUrlExternally: false */

// Initialize enigmailCommon
EnigInitCommon("enigmailHelp");

function enigHelpLoad() {
  EnigmailLog.DEBUG("enigmailHelp.js: enigHelpLoad\n");
  let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.loadSheetUsingURIString("chrome://enigmail/skin/enigmail.css", 1);

  var contentFrame = EnigGetFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var winOptions = EnigGetWindowOptions();
  var helpFile = winOptions.src;
  contentFrame.document.location.href = "chrome://enigmail/locale/help/" + helpFile + ".html";
}

function contentAreaClick(event) {
  let uri = EnigGetHttpUri(event);
  if (uri) {
    EnigOpenUrlExternally(uri);
    event.preventDefault();

    return false;
  }

  return true;
}
