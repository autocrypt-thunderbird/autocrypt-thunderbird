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

function enigmailDlgOnAccept() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;

  var keyList = "";
  var ruleEmail = document.getElementById("ruleEmail");
  var matchingRule = document.getElementById("matchingRule").value;
  var matchBegin = false;
  var matchEnd = false;
  switch (Number(matchingRule)) {
    case 0:
      matchBegin = true;
      matchEnd = true;
      break;
    case 2:
      matchBegin = true;
      break;
    case 3:
      matchEnd = true;
      break;
  }

  // Remove trailing whitespace
  ruleEmail.value = ruleEmail.value.replace(/\s+$/, "").replace(/^\s+/, "");
  if (ruleEmail.value.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noEmptyRule"));
    return false;
  }
  if (ruleEmail.value.search(/[<>]/) >= 0) {
    EnigmailDialog.info(window, EnigGetString("invalidAddress"));
    return false;
  }
  if (ruleEmail.value.search(/[{}]/) >= 0) {
    EnigmailDialog.info(window, EnigGetString("noCurlyBrackets"));
    return false;
  }
  var encryptionList = document.getElementById("encryptionList");
  for (var i = 0; i < encryptionList.getRowCount(); i++) {
    var item = encryptionList.getItemAtIndex(i);
    var valueLabel = item.getAttribute("value");
    if (valueLabel.length > 0) {
      keyList += ", " + valueLabel;
    }
  }
  var email = "";
  var mailAddrs = ruleEmail.value.split(/[ ,]+/);
  for (let i = 0; i < mailAddrs.length; i++) {
    email += (matchBegin ? " {" : " ") + mailAddrs[i] + (matchEnd ? "}" : "");
  }
  window.arguments[RESULT].email = email.substr(1);
  window.arguments[RESULT].keyId = keyList.substr(2);
  window.arguments[RESULT].sign = document.getElementById("sign").value;
  window.arguments[RESULT].encrypt = document.getElementById("encrypt").value;
  window.arguments[RESULT].pgpMime = document.getElementById("pgpmime").value;
  window.arguments[RESULT].negate = 0; /*Number(document.getElementById("negateRule").value);*/

  var actionType = document.getElementById("actionType");
  switch (Number(actionType.selectedItem.value)) {
    case 1:
      window.arguments[RESULT].keyId = ".";
      break;

    case 2:
      if (keyList === "" && (window.arguments[RESULT].encrypt > 0)) {
        if (!EnigConfirm(EnigGetString("noEncryption", ruleEmail.value, ruleEmail.value))) {
          return false;
        }
        window.arguments[RESULT].encrypt = 0;
      }
      break;
  }

  window.arguments[RESULT].cancelled = false;
  if (window.arguments[INPUT].options.indexOf("nosave") < 0) {
    // TODO save
  }
  return true;
}

function enigmailDlgKeySelection() {
  EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: enigmailDlgKeySelection: \n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var resultObj = {};
  var inputObj = {};
  inputObj.dialogHeader = "";
  inputObj.forUser = document.getElementById("ruleEmail").value.replace(/[ ,]+/g, ", ");
  inputObj.toAddr = inputObj.forUser;
  inputObj.toKeys = "";
  var encryptionList = document.getElementById("encryptionList");
  encryptionList.clearSelection();
  for (var i = 0; i < encryptionList.getRowCount(); i++) {
    var item = encryptionList.getItemAtIndex(i);
    var valueLabel = item.getAttribute("value");
    if (valueLabel.length > 0) {
      inputObj.toKeys += valueLabel + ",";
    }
  }

  inputObj.options = "multisel,forUser,noplaintext";
  var button = document.getElementById("encryptionListButton");
  var label = button.getAttribute("label");
  inputObj.options += ",sendlabel=" + label;
  inputObj.options += ",";

  window.openDialog("chrome://autocrypt/content/ui/enigmailKeySelection.xul", "", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  try {
    if (resultObj.cancelled) return;
  } catch (ex) {
    // cancel pressed -> do nothing
    return;
  }
  enigSetKeys(resultObj.userList);
}

