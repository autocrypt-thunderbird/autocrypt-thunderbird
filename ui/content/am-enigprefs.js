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
}

function onAcceptEditor() {
  Enigmail.edit.onSave();
}

function onPreInit(account, accountValues) {
  Enigmail.edit.identity = account.defaultIdentity;
  Enigmail.edit.account = account;
}

function onSave() {
  Enigmail.edit.onSave();
  /*
    let usingPep = EnigmailPEPAdapter.usingPep();

    if (usingPep !== gUsingPep) {
      EnigmailPEPAdapter.handleJuniorModeChange();
    }

    if (usingPep) {
      EnigmailPEPAdapter.setOwnIdentities(0);
    } */
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
