/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://autocrypt/content/ui/enigmailCommon.js
/* global Components: false, EnigInitCommon: false */
/* global EnigInitCommon: false, GetEnigmailSvc: false, EnigGetString: false, EnigHelpWindow: false */
/* global EnigConfirm: false, EnigmailLog: false, EnigmailKey: false, EnigmailKeyRing: false, EnigmailDialog: false */
/* global EnigmailWindows: false, EnigmailFuncs */

"use strict";

const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;
const EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;

// Initialize enigmailCommon
EnigInitCommon("manageAllKeys");

const views = { };

async function onLoad() {
  EnigmailLog.DEBUG("manageAllKeys.js: onLoad()\n");

  views.dialog = document.getElementById("manageAllKeys");
  views.labelKeyStatus = document.getElementById("labelKeyStatus");
  views.labelKeyFpr = document.getElementById("labelKeyFpr");
  views.labelKeyCreated = document.getElementById("labelKeyCreated");
  views.labelKeyAddress = document.getElementById("labelKeyAddress");

  views.buttonForget = document.getElementById("buttonForget");
  views.buttonBackup = document.getElementById("buttonBackup");

  views.keyList = document.getElementById("treeAllKeys");
  views.treeChildren = views.keyList.getElementsByAttribute("id", "treechildrenAllKeys")[0];

  views.dialog.getButton("extra1").label = "Import";
  views.buttonBackup.setAttribute("disabled", "true");
  views.buttonForget.setAttribute("disabled", "true");

  let secret_keys = await EnigmailKeyRing.getAllSecretKeys();
  await buildTreeView(secret_keys);
}

async function buildTreeView(secret_keys) {
  EnigmailLog.DEBUG("manageAllKeys.js: buildTreeView\n");

  clearTreeView();

  for (let i = 0; i < secret_keys.length; i++) {
    const secret_key = secret_keys[i];
    let key_info = await getKeyInfo(secret_key);
    let treeItem = buildTreeRow(key_info);
    views.treeChildren.appendChild(treeItem);
  }
}

function clearTreeView() {
  while (views.treeChildren.firstChild) {
    views.treeChildren.removeChild(views.treeChildren.firstChild);
  }
}

async function getKeyInfo(secret_key) {
  const fingerprint = secret_key.getFingerprint().toString().toUpperCase();

  const autocrypt_info = await EnigmailAutocrypt.getAutocryptSettingsForFingerprint(fingerprint);

  const primary_uid = await secret_key.getPrimaryUser();
  const address = primary_uid ? EnigmailFuncs.stripEmail(primary_uid.user.userId.userid) : "None";
  const creation = secret_key.getCreationTime();
  return {
    'identifier': fingerprint,
    'fpr_short': fingerprint,
    'fpr': EnigmailKey.formatFpr(fingerprint),
    'created_date': creation.toLocaleDateString(),
    'created_full': creation.toLocaleString(),
    'address': address,
    'is_active': Boolean(autocrypt_info)
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

  views.labelKeyStatus.value = key_info.is_active ? 'Active' : 'Archived';
  views.labelKeyFpr.value = key_info.fpr;
  views.labelKeyCreated.value = key_info.created_full;
  views.labelKeyAddress.value = key_info.address;

  views.buttonForget.setAttribute("disabled", key_info.is_active ? 'true' : 'false');
  views.buttonBackup.setAttribute("disabled", false);
}

async function onClickBackup() {
}

async function onClickForget() {
  const keyList = document.getElementById("treeAllKeys");
  const identifier = keyList.view.getItemAtIndex(keyList.currentIndex).getAttribute("identifier");
  if (!identifier) {
    return;
  }

  let args = {
    confirm_string: identifier.substring(identifier.length -4)
  };
  var result = {
    confirmed: false
  };

  window.openDialog("chrome://autocrypt/content/ui/dialogDeleteKey.xul", "",
    "chrome,dialog,modal,centerscreen", args, result);

  if (result.confirmed) {
    EnigmailLog.DEBUG(`onClickForget(): ok\n`);
  }
}

