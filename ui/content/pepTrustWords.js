/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */

const INPUT = 0;

function onLoad() {
  let argsObj = window.arguments[INPUT];

  document.getElementById("emailAddress").setAttribute("value", argsObj.emailAddress);
  document.getElementById("wordList").setAttribute("value", argsObj.trustWords);

}

function onAccept() {
  return true;
}

function onCancel() {}
