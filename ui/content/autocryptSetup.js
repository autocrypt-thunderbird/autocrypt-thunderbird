/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://autocrypt/content/ui/enigmailCommon.js
/* global Components: false, EnigInitCommon: false */
/* global EnigInitCommon: false, EnigGetString: false */
/* global AutocryptLog: false, AutocryptKeyRing: false, AutocryptDialog: false */
/* global AutocryptWindows: false, AutocryptFuncs: false */

"use strict";

const AutocryptStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").AutocryptStdlib;
const AutocryptAutocryptSetup = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSetup.jsm").AutocryptAutocryptSetup;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").AutocryptSqliteDb;

// Initialize enigmailCommon
EnigInitCommon("autocryptSettings");

const INPUT = 0;
const RESULT = 1;

let view = { };

async function enigmailDlgOnLoad() {
  AutocryptLog.DEBUG("enigmailDlgOnLoad()\n");

  view.radiogroupSetupChoice = document.getElementById("radiogroupSetupChoice");
  view.radioSetupKeep = document.getElementById("radioSetupKeep");
  view.radioSetupChange = document.getElementById("radioSetupChange");
  view.radioSetupDisable = document.getElementById("radioSetupDisable");
  view.boxKeep = document.getElementById("boxKeep");
  view.boxChange = document.getElementById("boxChange");
  view.boxDisable = document.getElementById("boxDisable");
  view.labelSetupCurrentKey = document.getElementById("labelSetupCurrentKey");
  view.menulistChangeKey = document.getElementById("menulistChangeKey");

  document.getElementById("labelSetupAddress").value = getSetupEmail();
  let current_key = getCurrentKey();
  if (current_key) {
    const formatted_fpr = AutocryptFuncs.formatFpr(current_key);
    view.labelSetupCurrentKey.value = formatted_fpr;
    view.radiogroupSetupChoice.selectedIndex = 0;
    view.radioSetupKeep.setAttribute("class", "setupRecommended");
    view.radioSetupKeep.setAttribute("disabled", "false");
    showOnly(view.boxKeep);
  } else {
    view.labelSetupCurrentKey.value = "None";
    view.radiogroupSetupChoice.selectedIndex = 1;
    view.radioSetupChange.setAttribute("label", "Configure Autocrypt");
    view.radioSetupChange.setAttribute("class", "setupRecommended");
    view.radioSetupKeep.setAttribute("disabled", "true");
    showOnly(view.boxChange);
  }

  let should_preselect = !current_key;
  await refreshChangeKey(should_preselect);
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

  let secret_keys = await AutocryptKeyRing.getAllSecretKeys();

  let uid_predicate = uid => AutocryptFuncs.stripEmail(uid).toLowerCase() == email;
  let email_filter = (key => key.getFingerprint().toUpperCase() != current_key && key.getUserIds().find(uid_predicate));
  return secret_keys.filter(email_filter);
}

async function refreshChangeKey(preselect = false) {
  AutocryptLog.DEBUG(`refreshChangeKey()\n`);

  view.menulistChangeKey.removeAllItems();
  view.menulistChangeKey.appendItem("Generate new", "generate");

  const secret_keys = await findRelevantSecretKeys();

  if (secret_keys.length) {
    AutocryptLog.DEBUG(`refreshChangeKey(): ${secret_keys.length}\n`);
    for (let secret_key of secret_keys) {
      let fingerprint = secret_key.getFingerprint().toUpperCase();
      const formatted_fpr = AutocryptFuncs.formatFpr(fingerprint);
      view.menulistChangeKey.appendItem(formatted_fpr, fingerprint);
    }
  }

  if (preselect) {
    view.menulistChangeKey.selectedIndex = secret_keys.length ? 1 : 0;
  }

  // view.menulistChangeKey.label = 'heyho'; // `(${secret_keys.length} keys available)`;
}

function disableAllChildren(el, disabled) {
  let children = el.childNodes;
  for (var i = 0; i < children.length; i++) {
    children[i].setAttribute("disabled", disabled ? "true" : "false");
  }
}

function showOnly(group) {
  disableAllChildren(view.boxKeep, true);
  disableAllChildren(view.boxChange, true);
  disableAllChildren(view.boxDisable, true);

  disableAllChildren(group, false);
}

async function onRadioChangeSetup() {
  AutocryptLog.DEBUG(`onRadioChangeSetup(): ${view.radiogroupSetupChoice.selectedItem.value}\n`);

  switch (view.radiogroupSetupChoice.selectedItem.value) {
    case 'keep': {
      showOnly(view.boxKeep);
      break;
    }
    case 'change': {
      showOnly(view.boxChange);
      break;
    }
    case 'disable': {
      showOnly(view.boxDisable);
      break;
    }
  }
}

function dialogConfirm() {
  let choice = view.radiogroupSetupChoice.selectedItem.value;
  window.arguments[1].choice = choice;
  if (choice == 'change') {
    window.arguments[1].fpr_primary = view.menulistChangeKey.value;
  }
  window.close();
}

document.addEventListener("dialogaccept", dialogConfirm);
