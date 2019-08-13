/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://autocrypt/content/ui/enigmailCommon.js
/* global Components: false, EnigInitCommon: false */
/* global EnigInitCommon: false, GetEnigmailSvc: false, EnigGetString: false, EnigHelpWindow: false */
/* global EnigConfirm: false, EnigmailLog: false, EnigmailKey: false, EnigmailKeyRing: false, EnigmailDialog: false */
/* global EnigmailWindows: false, sleep: false */

"use strict";

const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailAutocryptSetup = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSetup.jsm").EnigmailAutocryptSetup;
const EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
const AutocryptSecret = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSecret.jsm").AutocryptSecret;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

// Initialize enigmailCommon
EnigInitCommon("autocryptSettings");

const INPUT = 0;
const RESULT = 1;
let blinkTimeout = null;

function enigmailDlgOnLoad() {
  EnigmailLog.DEBUG("enigmailDlgOnLoad()\n");

  let email = window.arguments && window.arguments[0] && window.arguments[0].email;

  let menulistAutocryptEmail = document.getElementById("menulistAutocryptEmail");
  menulistAutocryptEmail.removeAllItems();

  EnigmailLog.DEBUG("enigmailDlgOnLoad(): loading identities\n");
  let identities = EnigmailStdlib.getIdentities();
  let selectedItem = null;
  for (const { isDefault, identity } of identities) {
    EnigmailLog.DEBUG(`enigmailDlgOnLoad(): identity ${identity.email}\n`);
    let item = menulistAutocryptEmail.appendItem(identity.email, String(identity.email));
    if (identity.email == email) {
      selectedItem = item;
    }
  }
  if (selectedItem) {
    menulistAutocryptEmail.selectedItem = selectedItem;
  } else {
    menulistAutocryptEmail.selectedIndex = 0;
  }
  onCommandMenulistAutocryptEmail();
}

async function getCurrentlySelectedAutocryptRow() {
  const menulistAutocryptEmail = document.getElementById("menulistAutocryptEmail");
  const item = menulistAutocryptEmail.selectedItem;
  EnigmailLog.DEBUG(`selectIdentityByIndex(): selected item: ${item.value}\n`);
  const autocrypt_rows = await sqlite.retrieveAutocryptRows([item.value]);
  if (autocrypt_rows && autocrypt_rows.length) {
    return autocrypt_rows[0];
  }
  return null;
}

async function onCommandMenulistAutocryptEmail() {
  EnigmailLog.DEBUG(`selectIdentityByIndex()\n`);

  const menulistAutocryptEmail = document.getElementById("menulistAutocryptEmail");
  const menulistAutocryptMode = document.getElementById("menulistAutocryptMode");
  const textboxConfiguredKey = document.getElementById("textboxConfiguredKey");
  const textboxConfiguredStatus = document.getElementById("textboxConfiguredStatus");
  const labelAutocryptModeSaved = document.getElementById("labelAutocryptModeSaved");
  const buttonSendSetupMessage = document.getElementById("buttonSendSetupMessage");
  labelAutocryptModeSaved.hidden = true;

  const autocrypt_info = await getCurrentlySelectedAutocryptRow();
  if (autocrypt_info && autocrypt_info.fpr_primary) {
    const formatted_fpr = EnigmailKey.formatFpr(autocrypt_info.fpr_primary);
    EnigmailLog.DEBUG(`selectIdentityByIndex(): ${JSON.stringify(autocrypt_info)}\n`);

    textboxConfiguredStatus.value = "Configured";
    textboxConfiguredKey.value = formatted_fpr;
    menulistAutocryptMode.disabled = false;
    menulistAutocryptMode.selectedIndex = autocrypt_info.is_mutual ? 0 : 1;
    buttonSendSetupMessage.disabled = false;
  } else {
    EnigmailLog.DEBUG(`selectIdentityByIndex(): no key selected\n`);

    textboxConfiguredStatus.value = "Not configured";
    textboxConfiguredKey.value = "None";
    menulistAutocryptMode.disabled = true;
    menulistAutocryptMode.selectedIndex = 0;
    buttonSendSetupMessage.disabled = true;
  }
}

async function onCommandMenulistAutocryptMode() {
  const menulistAutocryptMode = document.getElementById("menulistAutocryptMode");
  const is_mutual_new = (menulistAutocryptMode.selectedItem.value === 'mutual');

  const autocrypt_info = await getCurrentlySelectedAutocryptRow();
  const is_value_unchanged = autocrypt_info.is_mutual == is_mutual_new;
  if (is_value_unchanged) {
    return;
  }

  await sqlite.autocryptUpdateSecretKey(autocrypt_info.email,
    autocrypt_info.fpr_primary, is_mutual_new);

  blinkAutocrpyModeSaved();
}

async function blinkAutocrpyModeSaved() {
  const labelAutocryptModeSaved = document.getElementById("labelAutocryptModeSaved");
  labelAutocryptModeSaved.hidden = false;
  if (blinkTimeout) {
    clearTimeout(blinkTimeout);
    blinkTimeout = null;
  }
  blinkTimeout = setTimeout(function() {
    labelAutocryptModeSaved.hidden = true;
    blinkTimeout = null;
  }, 800);
}

async function onClickSendSetupMessage() {
  const autocrypt_info = await getCurrentlySelectedAutocryptRow();
  await EnigmailAutocryptSetup.sendSetupMessage(autocrypt_info.email);
}

async function onClickManageAllKeys() {
  EnigmailWindows.openManageAllKeys(window);
}

async function onClickRunSetup() {
  const menulistAutocryptEmail = document.getElementById("menulistAutocryptEmail");
  const email = menulistAutocryptEmail.selectedItem ?
    menulistAutocryptEmail.selectedItem.value : null;
  if (!email) {
    return;
  }
  const autocrypt_info = await getCurrentlySelectedAutocryptRow();

  let args = {
    email: email,
    current_key: autocrypt_info ? autocrypt_info.fpr_primary : null
  };
  var result = {
    success: false
  };

  window.openDialog("chrome://autocrypt/content/ui/autocryptSetup.xul", "",
    "chrome,dialog,modal,centerscreen", args, result);

  EnigmailLog.DEBUG(`selectIdentityByIndex(): result: ${result.choice}\n`);

  switch (result.choice) {
    case 'change':
      if (result.fpr_primary == 'generate') {
        EnigmailLog.DEBUG(`selectIdentityByIndex(): generate\n`);
        const textboxConfiguredKey = document.getElementById("textboxConfiguredKey");
        textboxConfiguredKey.value = "Generating…";

        setTimeout(async function() {
          await AutocryptSecret.generateKeyForEmail(email);
          await onCommandMenulistAutocryptEmail();
        }, 50);
      } else {
        EnigmailLog.DEBUG(`selectIdentityByIndex(): existing (${result.fpr_primary})\n`);
        if (result.fpr_primary && (!autocrypt_info || result.fpr_primary != autocrypt_info.fpr_primary)) {
          await AutocryptSecret.changeSecretKeyForEmail(email, result.fpr_primary);
          await onCommandMenulistAutocryptEmail();
        }
      }
      break;
    case 'disable':
      EnigmailLog.DEBUG(`selectIdentityByIndex(): disable\n`);
      await AutocryptSecret.changeSecretKeyForEmail(email, null);
      await onCommandMenulistAutocryptEmail();
      break;
  }
}

