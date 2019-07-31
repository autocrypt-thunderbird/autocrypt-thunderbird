/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://autocrypt/content/ui/enigmailCommon.js
/* global Components: false, EnigInitCommon: false */
/* global EnigInitCommon: false, GetEnigmailSvc: false, EnigGetString: false, EnigHelpWindow: false */
/* global EnigConfirm: false, EnigmailLog: false, EnigmailKey: false, EnigmailKeyRing: false, EnigmailDialog: false */
/* global EnigmailWindows: false */

"use strict";

const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailAutocryptSetup = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSetup.jsm").EnigmailAutocryptSetup;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

// Initialize enigmailCommon
EnigInitCommon("autocryptSettings");

const INPUT = 0;
const RESULT = 1;

function enigmailDlgOnLoad() {
  EnigmailLog.DEBUG("enigmailDlgOnLoad()\n");

  let menulistAutocryptEmail = document.getElementById("menulistAutocryptEmail");
  menulistAutocryptEmail.removeAllItems();

  EnigmailLog.DEBUG("enigmailDlgOnLoad(): loading identities\n");
  let identities = EnigmailStdlib.getIdentities();
  for (const { isDefault, identity } of identities) {
    EnigmailLog.DEBUG(`enigmailDlgOnLoad(): identity ${identity.email}\n`);
    menulistAutocryptEmail.appendItem(identity.email, String(identity.email));
  }
  menulistAutocryptEmail.selectedIndex = 0;
  onCommandMenulistAutocryptEmail();

  // ruleEmail.value = window.arguments[INPUT].toAddress.replace(/[{}]/g, "");
  // window.arguments[RESULT].cancelled = true;
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
  if (autocrypt_info) {
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
  const is_mutual_new = (menulistAutocryptMode.selectedItem.value == 'mutual');

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
  await sleep(800);
  labelAutocryptModeSaved.hidden = true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const item = menulistAutocryptEmail.selectedItem;
  const autocrypt_info = await getCurrentlySelectedAutocryptRow();

  let args = {
    email: item.value,
    current_key: autocrypt_info ? autocrypt_info.fpr_primary : null
  };
  var result = {
    success: false
  };

  window.openDialog("chrome://autocrypt/content/ui/autocryptSetup.xul", "",
    "chrome,dialog,modal,centerscreen", args, result);

  if (result.success) {
    EnigmailLog.DEBUG(`onClickRunSetup(): ok\n`);
  }
}

