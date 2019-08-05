/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://autocrypt/content/ui/enigmailCommon.js
/* global Components: false, EnigInitCommon: false */
/* global EnigInitCommon: false, EnigGetString: false */
/* global EnigmailLog: false, EnigmailKey: false, EnigmailKeyRing: false, EnigmailDialog: false */
/* global EnigmailWindows: false, EnigmailFuncs: false */

"use strict";

const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailAutocryptSetup = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSetup.jsm").EnigmailAutocryptSetup;
const AutocryptGpgImport = ChromeUtils.import("chrome://autocrypt/content/modules/gpgImport.jsm").AutocryptGpgImport;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

// Initialize enigmailCommon
EnigInitCommon("autocryptSettings");

const INPUT = 0;
const RESULT = 1;

let view = { };

async function enigmailDlgOnLoad() {
  EnigmailLog.DEBUG("enigmailDlgOnLoad()\n");

  view.radiogroupSetupChoice = document.getElementById("radiogroupSetupChoice");
  view.radioSetupKeep = document.getElementById("radioSetupKeep");
  view.radioSetupGenerate = document.getElementById("radioSetupGenerate");
  view.radioSetupExisting = document.getElementById("radioSetupExisting");
  view.boxKeep = document.getElementById("boxKeep");
  view.boxGenerate = document.getElementById("boxGenerate");
  view.boxExisting = document.getElementById("boxExisting");
  view.labelSetupCurrentKey = document.getElementById("labelSetupCurrentKey");
  view.menulistExistingKeys = document.getElementById("menulistExistingKeys");

  document.getElementById("labelSetupAddress").value = getSetupEmail();
  let current_key = getCurrentKey();
  if (current_key) {
    const formatted_fpr = EnigmailKey.formatFpr(current_key);
    view.labelSetupCurrentKey.value = formatted_fpr;
    view.radiogroupSetupChoice.selectedIndex = 0;
    view.radioSetupKeep.setAttribute("class", "setupRecommended");
    view.radioSetupKeep.setAttribute("disabled", "false");
    showOnly(view.boxKeep);
  } else {
    view.labelSetupCurrentKey.value = "None";
    view.radiogroupSetupChoice.selectedIndex = 1;
    view.radioSetupGenerate.setAttribute("class", "setupRecommended");
    view.radioSetupKeep.setAttribute("disabled", "true");
    showOnly(view.boxGenerate);
  }

  await refreshExistingKeys();
}

function getCurrentKey() {
  return window.arguments[0].current_key;
}

function getSetupEmail() {
  return window.arguments[0].email;
}

async function findRelevantSecretKeys() {
  let email = getSetupEmail();
  let current_key = getCurrentKey();

  let secret_keys = await EnigmailKeyRing.getAllSecretKeys();

  let uid_predicate = uid => EnigmailFuncs.stripEmail(uid).toLowerCase() == email;
  let email_filter = (key => key.getFingerprint().toUpperCase() != current_key && key.getUserIds().find(uid_predicate));
  return secret_keys.filter(email_filter);
}

async function refreshExistingKeys() {
  EnigmailLog.DEBUG(`refreshExistingKeys()\n`);

  view.menulistExistingKeys.removeAllItems();

  const secret_keys = await findRelevantSecretKeys();

  if (secret_keys.length) {
    EnigmailLog.DEBUG(`refreshExistingKeys(): ${secret_keys.length}\n`);
    for (let secret_key of secret_keys) {
      let fingerprint = secret_key.getFingerprint().toUpperCase();
      const formatted_fpr = EnigmailKey.formatFpr(fingerprint);
      view.menulistExistingKeys.appendItem(formatted_fpr, fingerprint);
    }
    view.radioSetupExisting.setAttribute("disabled", "false");
  } else {
    view.radioSetupExisting.setAttribute("disabled", "true");
  }

  /* TODO finish or remove
  let gpg_keys = await AutocryptGpgImport.obtainKeyList(getSetupEmail());
  if (gpg_keys) {
    for (let gpg_fpr in gpg_keys) {
      if (secret_keys.find(key => key.getFingerprint().toUpperCase() == gpg_fpr)) {
        EnigmailLog.DEBUG(`refreshExistingKeys(): skipping gpg key ${gpg_fpr}, no matching uid\n`);
        continue;
      }
      EnigmailLog.DEBUG(`refreshExistingKeys(): found gpg key ${gpg_fpr}\n`);
      view.menulistExistingKeys.appendItem(`${gpg_fpr} (from GnuPG)`, gpg_fpr);
    }
  }
  */

  // view.menulistExistingKeys.label = 'heyho'; // `(${secret_keys.length} keys available)`;
}

function disableAllChildren(el, disabled) {
  let children = el.childNodes;
  for (var i = 0; i < children.length; i++) {
    children[i].setAttribute("disabled", disabled ? "true" : "false");
  }
}

function showOnly(group) {
  disableAllChildren(view.boxKeep, true);
  disableAllChildren(view.boxGenerate, true);
  disableAllChildren(view.boxExisting, true);

  disableAllChildren(group, false);
}

async function onRadioChangeSetup() {
  EnigmailLog.DEBUG(`onRadioChangeSetup(): ${view.radiogroupSetupChoice.selectedItem.value}\n`);

  switch (view.radiogroupSetupChoice.selectedItem.value) {
    case 'keep': {
      showOnly(view.boxKeep);
      break;
    }
    case 'generate': {
      showOnly(view.boxGenerate);
      break;
    }
    case 'existing': {
      showOnly(view.boxExisting);
      break;
    }
  }
}

function dialogConfirm() {
  let choice = view.radiogroupSetupChoice.selectedItem.value;
  window.arguments[1].choice = choice;
  if (choice == 'existing') {
    window.arguments[1].fpr_primary = view.menulistExistingKeys.value;
  }
  window.close();
}

document.addEventListener("dialogaccept", dialogConfirm);
