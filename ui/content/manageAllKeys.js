/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://autocrypt/content/ui/enigmailCommon.js
/* global Components: false, EnigInitCommon: false */
/* global EnigInitCommon: false, GetEnigmailSvc: false, EnigGetString: false, EnigHelpWindow: false */
/* global EnigConfirm: false, EnigmailLog: false, EnigmailKey: false, EnigmailKeyRing: false, EnigmailDialog: false */
/* global EnigmailWindows: false, EnigmailFuncs: false, EnigFilePicker: false, EnigAlert: false */
/* global EnigmailFiles: false */

"use strict";

const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;
const EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
const EnigmailAutocryptSetup = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSetup.jsm").EnigmailAutocryptSetup;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;

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

  let address = autocrypt_info ? autocrypt_info.email : 'None';
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

  const identifier = views.keyList.view.getItemAtIndex(views.keyList.currentIndex).getAttribute("identifier");

  const secret_keys = await EnigmailKeyRing.getAllSecretKeysMap();
  const secret_key = secret_keys[identifier];
  const key_info = await getKeyInfo(secret_key);

  let address;
  if (!key_info.is_active) {
    const primary_uid = await secret_key.getPrimaryUser();
    address = primary_uid ? EnigmailFuncs.stripEmail(primary_uid.user.userId.userid) : "None";
  } else {
    address = key_info.address;
  }

  views.labelKeyStatus.value = key_info.is_active ? 'Active' : 'Archived';
  views.labelKeyFpr.value = key_info.fpr;
  views.labelKeyCreated.value = key_info.created_full;
  views.labelKeyAddress.value = address;

  views.buttonForget.setAttribute("disabled", key_info.is_active ? 'true' : 'false');
  views.buttonBackup.setAttribute("disabled", false);
}

async function onClickBackup() {
  EnigmailLog.DEBUG("manageAllKeys.js: onClickBackup\n");

  const identifier = views.keyList.view.getItemAtIndex(views.keyList.currentIndex).getAttribute("identifier");
  if (!identifier) {
    return;
  }

  const secret_keys = await EnigmailKeyRing.getAllSecretKeysMap();
  const secret_key = secret_keys[identifier];
  if (!secret_key) {
    return;
  }

  let outFile = EnigFilePicker('swag', "", true, "*.htm", 'AutocryptKeyBackup.htm', ['Autocrypt key backup', "*.htm"]);
  if (!outFile) return;

  var exitCodeObj = {};
  var errorMsgObj = {};

  let setup_message = await EnigmailAutocryptSetup.createBackupFile(secret_key);

  if (!EnigmailFiles.writeFileContents(outFile, setup_message.msg)) {
    EnigAlert("Failed!");
  } else {
    EnigAlert(`Ok: ${setup_message.passwd}`);
  }
}

async function onClickImport() {
  let outFile = EnigFilePicker(
    'Select file to import', "", false, "", '', [
      'Autocrypt key backup (.htm)', "*.htm",
      'OpenPGP Key (.asc)', "*.asc",
      'OpenPGP Secret Key (.sec)', "*.sec"
    ]);
  if (!outFile) return;

  let content = EnigmailFiles.readFile(outFile);
  let result;
  try {
    result = EnigmailAutocryptSetup.determineImportFormat(content);
  } catch (ex) {
    EnigmailLog.writeException(ex);
    EnigAlert("File format could not be recognized");
    return;
  }

  EnigmailLog.DEBUG(`onClickImport(): input type: ${result.format}\n`);
  switch (result.format) {
    case 'encrypted':
    case 'autocrypt-setup': {
      break;
    }
    case 'openpgp-secret': {
      const cApi = EnigmailCryptoAPI();
      try {
        let openpgp_secret_key = await cApi.parseOpenPgpKey(result.data);
        if (!openpgp_secret_key.isDecrypted()) {
          EnigmailLog.DEBUG(`onClickImport(): key is encrypted - asking for password\n`);
          let attempt = async password => {
            try {
              await openpgp_secret_key.decrypt(password);
              return true;
            } catch (ex) {
              EnigmailLog.DEBUG(`onClickImport(): decryption failure: ${ex}\n`);
              return false;
            }
          };
          let args = { attempt: attempt };

          window.openDialog("chrome://autocrypt/content/ui/dialogKeyPassword.xul", "",
            "chrome,dialog,modal,centerscreen", args);

          if (!openpgp_secret_key.isDecrypted()) {
            return;
          }
        }
        await EnigmailKeyRing.insertSecretKey(openpgp_secret_key);
      } catch (ex) {
        EnigmailLog.DEBUG(`onClickImport(): ${ex}\n`);
        EnigAlert("Error parsing key format!");
        return;
      }
      break;
    }
  }
}

async function onClickForget() {
  const keyList = document.getElementById("treeAllKeys");
  const identifier = keyList.view.getItemAtIndex(keyList.currentIndex).getAttribute("identifier");
  if (!identifier) {
    return;
  }

  let args = {
    confirm_string: identifier.substring(identifier.length -4).toLowerCase()
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

document.addEventListener("dialogextra1", onClickImport);
