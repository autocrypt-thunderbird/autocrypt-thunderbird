/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */

if (!Enigmail) var Enigmail = {};

var gPref = null;
var gUsingPep = null;

function onInit() {
  gUsingPep = EnigmailPEPAdapter.usingPep();
  Enigmail.edit.onInit();

  let ac = document.getElementById("enigmail_acPreferEncrypt");
  ac.checked = (Enigmail.edit.account.incomingServer.getIntValue("acPreferEncrypt") > 0);
}

function onAcceptEditor() {
  Enigmail.edit.onSave();
  saveChanges();
  return true;
}

function onPreInit(account, accountValues) {
  Enigmail.edit.identity = account.defaultIdentity;
  Enigmail.edit.account = account;
}

function onSave() {
  Enigmail.edit.onSave();
  saveChanges();
  return true;
}

function onLockPreference() {
  // do nothing
}

// Does the work of disabling an element given the array which contains xul id/prefstring pairs.
// Also saves the id/locked state in an array so that other areas of the code can avoid
// stomping on the disabled state indiscriminately.
function disableIfLocked(prefstrArray) {
  // do nothing
}

function enigmailOnAcceptEditor() {
  Enigmail.edit.onSave();

  return true; // allow to close dialog in all cases
}


function saveChanges() {
  let ac = document.getElementById("enigmail_acPreferEncrypt");
  Enigmail.edit.account.incomingServer.setIntValue("acPreferEncrypt", ac.checked ? 1 : 0);
}
