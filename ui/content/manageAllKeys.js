/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/ui/enigmailCommon.js
/* global Components: false, EnigInitCommon: false */
/* global EnigInitCommon: false, GetEnigmailSvc: false, EnigGetString: false, EnigHelpWindow: false */
/* global EnigConfirm: false, EnigmailLog: false, EnigmailKey: false, EnigmailKeyRing: false, EnigmailDialog: false */
/* global EnigmailWindows: false, EnigmailFuncs */

"use strict";

const sqlite = ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

// Initialize enigmailCommon
EnigInitCommon("manageAllKeys");

async function enigmailDlgOnLoad() {
  EnigmailLog.DEBUG("enigmailDlgOnLoad()\n");
  let secret_keys = await EnigmailKeyRing.getAllSecretKeys();
  await buildTreeView(secret_keys);
}

async function buildTreeView(secret_keys) {
  EnigmailLog.DEBUG("manageAllKeys.js: buildTreeView\n");

  let keyList = document.getElementById("treeAllKeys");
  let treeChildren = keyList.getElementsByAttribute("id", "treechildrenAllKeys")[0];

  for (let i = 0; i < secret_keys.length; i++) {
    const secret_key = secret_keys[i];
    let key_info = await getKeyInfo(secret_key);
    let treeItem = buildTreeRow(key_info);
    treeChildren.appendChild(treeItem);
  }
}

async function getKeyInfo(secret_key) {
  const primary_uid = await secret_key.getPrimaryUser();
  let address = primary_uid ? EnigmailFuncs.stripEmail(primary_uid.user.userId.userid) : "None";
  let creation = secret_key.getCreationTime();
  let fingerprint = secret_key.getFingerprint().toString().toUpperCase();
  return {
    'identifier': fingerprint,
    'fpr_short': fingerprint,
    'fpr': EnigmailKey.formatFpr(fingerprint),
    'created_date': creation.toLocaleDateString(),
    'created_full': creation.toLocaleString(),
    'address': address
  };
}

function buildTreeRow(key_info) {
  let keyFpCol = document.createXULElement("treecell");
  let createdCol = document.createXULElement("treecell");
  let addressCol = document.createXULElement("treecell");

  keyFpCol.setAttribute("id", "key");
  createdCol.setAttribute("id", "created");
  addressCol.setAttribute("id", "address");

  keyFpCol.setAttribute("label", key_info.fpr_short);
  createdCol.setAttribute("label", key_info.created_date);
  addressCol.setAttribute("label", key_info.address);

  let keyRow = document.createXULElement("treerow");
  keyRow.appendChild(keyFpCol);
  keyRow.appendChild(createdCol);
  keyRow.appendChild(addressCol);
  let treeItem = document.createXULElement("treeitem");
  treeItem.appendChild(keyRow);
  treeItem.setAttribute("identifier", key_info.identifier);
  return treeItem;
}

async function onKeySelect() {
  EnigmailLog.DEBUG("manageAllKeys.js: onKeySelect\n");

  const keyList = document.getElementById("treeAllKeys");
  const identifier = keyList.view.getItemAtIndex(keyList.currentIndex).getAttribute("identifier");

  const secret_keys = await EnigmailKeyRing.getAllSecretKeysMap();
  const secret_key = secret_keys[identifier];
  const key_info = await getKeyInfo(secret_key);

  const labelKeyStatus = document.getElementById("labelKeyStatus");
  const labelKeyFpr = document.getElementById("labelKeyFpr");
  const labelKeyCreated = document.getElementById("labelKeyCreated");
  const labelKeyAddress = document.getElementById("labelKeyAddress");

  labelKeyStatus.value = "Archived";
  labelKeyFpr.value = key_info.fpr;
  labelKeyCreated.value = key_info.created_full;
  labelKeyAddress.value = key_info.address;
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

