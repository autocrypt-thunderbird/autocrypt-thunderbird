/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global Components: false, EnigmailLog: false, EnigmailKeyServer: false, EnigmailDialog: false, sleep: false */

"use strict";

const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;
const EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
const EnigmailWkdLookup = ChromeUtils.import("chrome://autocrypt/content/modules/wkdLookup.jsm").EnigmailWkdLookup;

function getChoiceType() {
  let args = window.arguments[0];
  return args.choiceType;
}

function getRecipients() {
  let args = window.arguments[0];
  return args.recipients;
}

let views = {};
let downloaded_keys = [];

async function onLoad() {
  views.dialog = document.getElementById('dialogMissingKeys');
  views.buttonAccept = views.dialog.getButton("accept");
  views.buttonCancel = views.dialog.getButton("cancel");
  for (let name of ['recipientRows']) {
    let view = document.getElementById(name);
    if (!view) {
      EnigmailLog.DEBUG(`dialogMissingKeys.js: missing view ${name}\n`);
    }
    views[name] = view;
  }

  window.arguments[1].choice = 'cancel';

  if (!getRecipients()) {
    window.close();
    return;
  }
  refreshRecipients();
  await refreshRecipientStatus();
}

function refreshRecipients() {
  views.rowsMap = {};
  for (let recipient of getRecipients()) {
    let row = buildGridRow(recipient);
    views.rowsMap[recipient] = row;
    views.recipientRows.appendChild(row.row);
  }
}

async function refreshRecipientStatus() {
  let addresses = getRecipients();
  let autocrypt_status = await EnigmailAutocrypt.determineAutocryptRecommendations(addresses);
  for (let address of addresses) {
    let peer_status = autocrypt_status.peers[address];
    if (!peer_status) {
      EnigmailLog.ERROR(`dialogMissingKeys.js: missing recommendation - this is a bug!\n`);
    }
    let is_ok = peer_status && peer_status.isEncryptionAvailable();
    setRowStatus(address, is_ok);
  }
  updateAcceptButtonState(autocrypt_status.group_recommendation > EnigmailAutocrypt.AUTOCRYPT_RECOMMEND.DISABLE);
}

function updateAcceptButtonState(all_recipients_ok) {
  switch (getChoiceType()) {
    case 'send-unencrypted':
      views.buttonAccept.label = all_recipients_ok ? "Send encrypted" : "Send unencrypted";
      views.buttonCancel.label = "Cancel sending";
      views.buttonAccept.setAttribute("choice", all_recipients_ok ? "send-encrypted" : "send-unencrypted");
      break;
    case 'keep-disabled':
      views.buttonAccept.label = all_recipients_ok ? "Ok" : "Disable encryption";
      views.buttonCancel.setAttribute("collapsed", "true");
      views.buttonAccept.setAttribute("choice", all_recipients_ok ? "ok" : "disable");
      break;
    default:
      views.buttonAccept.label = "Ok";
      views.buttonCancel.setAttribute("hidden", "true");
      break;
  }
}

function setRowStatus(address, ok) {
  let row = views.rowsMap[address];
  if (ok) {
    row.labelStatus.setAttribute("value", "Ok");
    row.labelStatus.setAttribute("style", "");
    row.buttonLookup.setAttribute("disabled", "true");
    if (downloaded_keys.includes(address)) {
      row.buttonLookup.setAttribute("label", "Found");
    } else {
      row.buttonLookup.setAttribute("label", "Lookup");
    }
  } else if (downloaded_keys.includes(address)) {
    row.labelStatus.setAttribute("value", "Missing");
    row.labelStatus.setAttribute("style", "color: red;");
    row.buttonLookup.setAttribute("disabled", "true");
    row.buttonLookup.setAttribute("label", "Not found");
  } else {
    row.labelStatus.setAttribute("value", "Missing");
    row.labelStatus.setAttribute("style", "color: red;");
    row.buttonLookup.setAttribute("disabled", "false");
    row.buttonLookup.setAttribute("label", "Lookup");
  }
}

async function onClickLookup(address) {
  let row = views.rowsMap[address];
  row.buttonLookup.setAttribute("disabled", "true");
  row.buttonLookup.setAttribute("label", "Searching…");

  let delay = sleep(700);
  let result = await EnigmailWkdLookup.download(address, 1500);
  if (!result || result.result !== 0) {
    result = await EnigmailKeyServer.download(address);
  }
  await delay;

  if (result.result === 0) {
    EnigmailLog.DEBUG(`dialogMissingKeys.js: keyserver ok\n`);
    downloaded_keys.push(address);
    if (result.keyData) {
      if (!await EnigmailAutocrypt.injectAutocryptKey(address, result.keyData, true)) {
        EnigmailDialog.alert(window, `Error importing downloaded key for ${address}`);
      }
    }
  } else {
    EnigmailDialog.alert(window, result.errorDetails);
    row.buttonLookup.setAttribute("label", "Lookup");
    row.buttonLookup.setAttribute("disabled", "false");
  }
  await refreshRecipientStatus();
}

function buildGridRow(address) {
  let labelEmail = document.createXULElement("label");
  labelEmail.setAttribute("value", `• ${address}`);
  labelEmail.setAttribute("style", "font-family: monospace;");

  // let spacer = document.createXULElement("spacer");
  // spacer.setAttribute("flex", "1");
  let labelStatus = document.createXULElement("label");
  labelStatus.setAttribute("value", "Ok");
  let box = document.createXULElement("vbox");
  box.setAttribute("align", "right");
  box.appendChild(labelStatus);

  let buttonLookup = document.createXULElement("button");
  buttonLookup.setAttribute("label", "Lookup");
  buttonLookup.setAttribute("style", "min-width: 120px;");
  buttonLookup.addEventListener("command", function() { onClickLookup(address); });

  let row = document.createXULElement("row");
  row.setAttribute("style", "margin: 5px;");
  row.setAttribute("align", "center");
  row.appendChild(labelEmail);
  row.appendChild(box);
  row.appendChild(buttonLookup);
  row.setAttribute("identifier", address);
  return {
    row: row,
    labelEmail: labelEmail,
    labelStatus: labelStatus,
    buttonLookup: buttonLookup
  };
}

function dialogAccept() {
  window.arguments[1].choice = views.buttonAccept.getAttribute("choice");
  window.close();
}

document.addEventListener("dialogaccept", dialogAccept);
