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

  view.boxKeep = document.getElementById("boxKeep");
  view.boxGenerate = document.getElementById("boxGenerate");
  view.boxArchived = document.getElementById("boxArchived");

  view.labelSetupCurrentKey = document.getElementById("labelSetupCurrentKey");

  view.menulistExistingKeys = document.getElementById("menulistExistingKeys");

  document.getElementById("labelSetupAddress").value = getSetupEmail();
  if (window.arguments[0].current_key) {
    view.labelSetupCurrentKey.value = window.arguments[0].current_key;
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

function getSetupEmail() {
  return window.arguments[0].email;
}

async function refreshExistingKeys() {
  EnigmailLog.DEBUG(`refreshExistingKeys()\n`);

  view.menulistExistingKeys.removeAllItems();

  let email = getSetupEmail();

  let secret_keys = await EnigmailKeyRing.getAllSecretKeys();
  let email_filter = (key => key.getUserIds().find(uid =>
      EnigmailFuncs.stripEmail(uid).toLowerCase() == email));
  secret_keys = secret_keys.filter(email_filter);

  EnigmailLog.DEBUG(`refreshExistingKeys(): ${secret_keys.length}\n`);
  for (let secret_key of secret_keys) {
    let fingerprint = secret_key.getFingerprint().toUpperCase();
    view.menulistExistingKeys.appendItem(fingerprint, fingerprint);
  }

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
  disableAllChildren(view.boxArchived, true);

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
    case 'archived': {
      showOnly(view.boxArchived);
      break;
    }
  }
}