/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://autocrypt/content/ui/enigmailCommon.js

"use strict";

/* global AutocryptLog: false */
/* global Components: false */



/* global EnigInitCommon: false, EnigGetWindowOptions: false, EnigGetFrame: false, EnigGetHttpUri: false, EnigOpenUrlExternally: false */

// Initialize enigmailCommon
EnigInitCommon("enigmailHelp");

function enigHelpLoad() {
  AutocryptLog.DEBUG("enigmailHelp.js: enigHelpLoad\n");

  var contentFrame = EnigGetFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var winOptions = EnigGetWindowOptions();
  var helpFile = winOptions.src;
  contentFrame.document.location.href = "chrome://autocrypt/locale/help/" + helpFile + ".html";
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
