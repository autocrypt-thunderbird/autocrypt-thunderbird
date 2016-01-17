/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

// modules:
/* global EnigmailLog: false, EnigmailCore: false, EnigmailDialog: false, EnigmailLocale: false, EnigmailKeyRing: false*/
/* global EnigmailKeyEditor: false, EnigmailTimer: false */

// enigmailCommon.js:
/* global EnigSetActive: false, createCell */

var gAlertPopUpIsOpen = false;

/**
 * The function for when the popup window for changing the key expiry is loaded.
 */
function onLoad() {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: onLoad()\n");

  reloadData();
}

/**
 * Display all the subkeys in XUL element "keyListChildren"
 */
function reloadData() {
  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("accessError"));
    window.close();
    return;
  }
  var exitCodeObj = {};
  var errorMsgObj = {};
  var gKeyId = window.arguments[0].keyId[0];
  var treeChildren = document.getElementById("keyListChildren");

  // clean lists
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }


  let keyObj = EnigmailKeyRing.getKeyById(gKeyId);
  if (keyObj) {
    addSubkeyWithSelectboxes(treeChildren, keyObj);
    for (let i = 0; i < keyObj.subKeys.length; i++) {
      addSubkeyWithSelectboxes(treeChildren, keyObj.subKeys[i], keyObj.subKeys.length + 1);
    }
  }
}

/**
 * Add each subkey to the GUI list. Use this function if there is a preceeding column with checkboxes.
 *
 * @param  treeChildren - XUL obj    GUI element, where the keys will be listed.
 * @param  subkey       - Object     subkey from KeyObject  Informations of the current key
 * @param  keyCount     - Integer    Count of all keys (primary + subkeys)
 *
 * The internal logic of this function works so, that the main key is always selected.
 * Also all valid (not expired, not revoked) subkeys are selected. If there is only
 * one subkey, it is also always pre-selected.
 *
 */
function addSubkeyWithSelectboxes(treeChildren, subkey, keyCount) {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: addSubkeyWithSelectboxes(" + subkey.keyId + ")\n");

  var preSelected;
  // Pre-Selection logic:
  if (subkey.keyTrust === "r") {
    // Revoked keys can not be changed.
    preSelected = -1;
  }
  else {
    if (subkey.type === "pub") {
      // The primary key is ALWAYS selected.
      preSelected = 1;
    }
    else if (keyCount === 2) {
      // If only 2 keys are here (primary + 1 subkey) then preSelect them anyway.
      preSelected = 1;
    }
    else if (subkey.keyTrust === "e") {
      // Expired keys are normally un-selected.
      preSelected = 0;
    }
    else {
      // A valid subkey is pre-selected.
      preSelected = 1;
    }
  }
  var selectCol = document.createElement("treecell");
  selectCol.setAttribute("id", "indicator");
  EnigSetActive(selectCol, preSelected);


  addSubkey(treeChildren, subkey, selectCol);
}

/**
 * Add each subkey to the GUI list.
 *
 * @param  treeChildren - XUL obj   GUI element, where the keys will be listed.
 * @param  subkey       - Object    subkey from KeyObject  Informations of the current key
 * @param  Optional     - Object    If set, it defines if the row is pre-selected
 *                                  (assumed, there is a preceeding select column)
 */
function addSubkey(treeChildren, subkey, selectCol = false) {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: addSubkey(" + subkey.keyId + ")\n");

  // Get expiry state of this subkey
  var expire;
  if (subkey.keyTrust === "r") {
    expire = EnigmailLocale.getString("keyValid.revoked");
  }
  else if (subkey.expiryTime.length === 0) {
    expire = EnigmailLocale.getString("keyExpiryNever");
  }
  else {
    expire = subkey.expiry;
  }

  var aRow = document.createElement("treerow");
  var treeItem = document.createElement("treeitem");
  var subkeyStr = EnigmailLocale.getString(subkey.type === "sub" ? "keyTypeSubkey" : "keyTypePrimary");
  if (selectCol !== false) {
    aRow.appendChild(selectCol);
  }
  aRow.appendChild(createCell(subkeyStr)); // subkey type
  aRow.appendChild(createCell("0x" + subkey.keyId.substr(-8, 8))); // key id
  aRow.appendChild(createCell(EnigmailLocale.getString("keyAlgorithm_" + subkey.algorithm))); // algorithm
  aRow.appendChild(createCell(subkey.keySize)); // size
  aRow.appendChild(createCell(subkey.created)); // created
  aRow.appendChild(createCell(expire)); // expiry

  var usagetext = "";
  var i;
  //  e = encrypt
  //  s = sign
  //  c = certify
  //  a = authentication
  //  Capital Letters are ignored, as these reflect summary properties of a key

  var singlecode = "";
  for (i = 0; i < subkey.keyUseFor.length; i++) {
    singlecode = subkey.keyUseFor.substr(i, 1);
    switch (singlecode) {
      case "e":
        if (usagetext.length > 0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + EnigmailLocale.getString("keyUsageEncrypt");
        break;
      case "s":
        if (usagetext.length > 0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + EnigmailLocale.getString("keyUsageSign");
        break;
      case "c":
        if (usagetext.length > 0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + EnigmailLocale.getString("keyUsageCertify");
        break;
      case "a":
        if (usagetext.length > 0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + EnigmailLocale.getString("keyUsageAuthentication");
        break;
    } // * case *
  } // * for *

  aRow.appendChild(createCell(usagetext)); // usage
  treeItem.appendChild(aRow);
  treeChildren.appendChild(treeItem);
}


function enigmailKeySelCallback(event) {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: enigmailKeySelCallback\n");

  var treeList = document.getElementById("subkeyList");
  var row = {};
  var col = {};
  var elt = {};
  treeList.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
  if (row.value == -1)
    return;


  var treeItem = treeList.contentView.getItemAtIndex(row.value);
  treeList.currentItem = treeItem;
  if (col.value.id != "selectionCol")
    return;

  var aRows = treeItem.getElementsByAttribute("id", "indicator");

  if (aRows.length) {
    var elem = aRows[0];
    if (elem.getAttribute("active") == "1") {
      EnigSetActive(elem, 0);
    }
    else if (elem.getAttribute("active") == "0") {
      EnigSetActive(elem, 1);
    }
  }
}


function processKey(subKeys) {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: processKey()\n");

  var noExpiry = document.getElementById("noExpiry").checked;
  var expiryTime = Number(document.getElementById("expireInput").value);
  var timeScale = document.getElementById("timeScale").value;

  EnigmailKeyEditor.setKeyExpiration(
    window,
    window.arguments[0].keyId[0],
    subKeys,
    expiryTime,
    timeScale,
    noExpiry,
    function(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigmailTimer.setTimeout(function() {
          EnigmailDialog.alert(window, EnigmailLocale.getString("setKeyExpirationDateFailed") + "\n\n" + errorMsg);
        }, 10);
      }
      else {
        window.arguments[1].refresh = true;
        window.close();
      }
    }
  );
}

/**
 * @return  Array  The indexes of the selected subkeys. 0 is the main key.
 */
function getSelectedSubkeys() {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: getSelectedSubkeys()\n");

  var keySelList = document.getElementById("subkeyList");
  var treeChildren = keySelList.getElementsByAttribute("id", "keyListChildren")[0];
  var item = treeChildren.firstChild;
  var selectedSubKeys = [];

  var subkeyNumber = 0;

  while (item) {
    var aRows = item.getElementsByAttribute("id", "indicator");
    if (aRows.length) {
      var elem = aRows[0];
      if (elem.getAttribute("active") == "1") {
        selectedSubKeys.push(subkeyNumber);
      }
    }
    subkeyNumber += 1;
    item = item.nextSibling;
  }

  return selectedSubKeys;
}


/**
 * After clicking on the "ok" button ...
 */
function onAccept() {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: onAccept()\n");
  if (checkExpirationDate()) {
    let subkeys = getSelectedSubkeys();
    if (subkeys.length > 0) {
      processKey(subkeys);
    }
    else {
      EnigmailTimer.setTimeout(function() {
        EnigmailDialog.alert(window, EnigmailLocale.getString("noKeySelected") + "\n");
      }, 10);
    }
  }
  return false; /* don't close the window now. Wait for calling window.close() explicitly. */
}

function checkExpirationDate() {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: checkExpirationDate()\n");

  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");

  var expiryTime = 0;
  if (!noExpiry.checked) {
    expiryTime = Number(expireInput.value) * Number(timeScale.value);
    if (expiryTime > 90 * 365) {
      /* alert("You cannot create a key that expires in more than 100 years."); */
      /* @TODO GPG throws an error already when using 95 years (multiplying 365 and 95) */
      if (gAlertPopUpIsOpen !== true) {
        gAlertPopUpIsOpen = true;
        EnigmailTimer.setTimeout(function() {
          EnigmailDialog.alert(window, EnigmailLocale.getString("expiryTooLongShorter") + "\n");
          gAlertPopUpIsOpen = false;
        }, 10);
      }
      return false;
    }
    else if (expiryTime <= 0) {
      /* alert("Your key must be valid for at least one day."); */
      if (gAlertPopUpIsOpen !== true) {
        gAlertPopUpIsOpen = true;
        EnigmailTimer.setTimeout(function() {
          EnigmailDialog.alert(window, EnigmailLocale.getString("expiryTooShort") + "\n");
          gAlertPopUpIsOpen = false;
        }, 10);
      }
      return false;
    }
  }
  return true;
}

function onNoExpiry() {
  EnigmailLog.DEBUG("enigmailEditKeyExpiryDlg.js: onNoExpiry()\n");

  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");

  expireInput.disabled = noExpiry.checked;
  timeScale.disabled = noExpiry.checked;
}
