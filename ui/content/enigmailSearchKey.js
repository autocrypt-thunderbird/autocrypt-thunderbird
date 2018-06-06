/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

/* global Components: false */

/* from EnigmailCommon.js: */
/* global EnigSetActive: false, ENIG_KEY_EXPIRED: false, ENIG_KEY_NOT_VALID: false */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const {
  EnigmailTimer
} = Cu.import("chrome://enigmail/content/modules/timer.jsm", {});
const {
  EnigmailKeyServer
} = Cu.import("chrome://enigmail/content/modules/keyserver.jsm", {});
const {
  EnigmailDialog
} = Cu.import("chrome://enigmail/content/modules/dialog.jsm", {});
const {
  EnigmailLog
} = Cu.import("chrome://enigmail/content/modules/log.jsm", {});
const {
  EnigmailLocale
} = Cu.import("chrome://enigmail/content/modules/locale.jsm", {});

const INPUT = 0;
const RESULT = 1;

var gDlList = [];
var gProgressMeter;
var gKeyServer = null;
var gAllKeysSelected = 0;

const DownloadListener = {
  onProgress: function(percentComplete) {
    gProgressMeter.value = percentComplete;
  },
  onCancel: null
};

function onLoad() {

  window.arguments[RESULT].importedKeys = 0;
  gKeyServer = window.arguments[INPUT].keyserver;
  let searchList = window.arguments[INPUT].searchList;
  gProgressMeter = document.getElementById("dialog.progress");

  gProgressMeter.mode = "undetermined";

  if (searchList.length == 1 &&
    searchList[0].search(/^0x[A-Fa-f0-9]{8,16}$/) === 0) {
    // shrink dialog and start download if just one key ID provided

    document.getElementById("keySelGroup").setAttribute("collapsed", "true");
    window.sizeToContent();

    EnigmailTimer.setTimeout(function _f() {
      startDownload(searchList, false);
    }, 10);
  }
  else {
    executeSearch(searchList);
  }

  return true;
}


function selectAllKeys() {
  EnigmailLog.DEBUG("enigmailSearchKey.js: selectAllkeys\n");
  var keySelList = document.getElementById("enigmailKeySel");
  var treeChildren = keySelList.getElementsByAttribute("id", "enigmailKeySelChildren")[0];

  // Toggle flag to select/deselect all when hotkey is pressed repeatedly
  gAllKeysSelected ^= 1;

  var item = treeChildren.firstChild;
  while (item) {
    var aRows = item.getElementsByAttribute("id", "indicator");
    if (aRows.length) {
      var elem = aRows[0];
      EnigSetActive(elem, gAllKeysSelected);
    }
    item = item.nextSibling;
  }
}


function onAccept() {
  EnigmailLog.DEBUG("enigmailSearchKey.js: onAccept\n");

  let keySelList = document.getElementById("enigmailKeySel");
  let treeChildren = keySelList.getElementsByAttribute("id", "enigmailKeySelChildren")[0];

  let dlKeyList = [];
  var item = treeChildren.firstChild;
  while (item) {
    var aRows = item.getElementsByAttribute("id", "indicator");
    if (aRows.length) {
      var elem = aRows[0];
      if (elem.getAttribute("active") == "1") {
        dlKeyList.push(item.getAttribute("id"));
      }
    }
    item = item.nextSibling;
  }

  return startDownload(dlKeyList);
}

function startDownload(downloadKeys, displayResult = true) {
  EnigmailLog.DEBUG("enigmailSearchKey.js: startDownload\n");
  if (downloadKeys.length > 0) {
    gProgressMeter.value = 0;
    gProgressMeter.mode = "determined";
    document.getElementById("progress.box").removeAttribute("hidden");
    document.getElementById("selall-button").setAttribute("hidden", "true");
    document.getElementById("dialog.accept").setAttribute("disabled", "true");

    EnigmailKeyServer.download(downloadKeys.join(" "), gKeyServer, DownloadListener).then(
      res => {
        DownloadListener.onCancel = null;
        if (res.result === 0 && res.gotKeys.length > 0) {
          window.arguments[RESULT].importedKeys = res.gotKeys;
          if (displayResult) {
            EnigmailDialog.keyImportDlg(window, res.gotKeys.length > 0 ? res.gotKeys : downloadKeys);
          }
          closeDialog();
        }
      }).catch(
      error => {
        DownloadListener.onCancel = null;
        statusError();
        closeDialog();
      }
    );

    // do not yet close the window, so that we can display some progress info
    return false;
  }

  return true;
}

function executeSearch(searchKeys) {
  EnigmailKeyServer.search(searchKeys.join(" "), gKeyServer, DownloadListener).then(
    res => {
      DownloadListener.onCancel = null;
      document.getElementById("progress.box").setAttribute("hidden", "true");
      document.getElementById("dialog.accept").removeAttribute("disabled");

      if (res.length === 0) {
        EnigmailDialog.info(window, getKeyNotFoundMsg());
      }
      else {
        populateList(res);
      }
    }).catch(
    error => {
      DownloadListener.onCancel = null;
      statusError();
    }
  );
}


function onCancel() {
  EnigmailLog.DEBUG("enigmailSearchKey.js: onCancel\n");

  if (DownloadListener.onCancel !== null) {
    DownloadListener.onCancel();
    DownloadListener.onCancel = null;
  }
  window.close();
}


function closeDialog() {
  // TODO: is this still required?
  // if (window.arguments[RESULT].importedKeys > 0) {
  //   EnigmailKeyRing.clearCache();
  // }

  document.getElementById("enigmailSearchKeyDlg").cancelDialog();
  window.close();
}



// GUI related stuff

function populateList(keyList) {
  EnigmailLog.DEBUG("enigmailSearchKey.js: populateList\n");

  var sortUsers = function(a, b) {
    if (a.uid[0] < b.uid[0]) {
      return -1;
    }
    else {
      return 1;
    }
  };

  var sortKeyIds = function(c, d) {
    if (c.keyId < d.keyId) {
      return -1;
    }
    else {
      return 1;
    }
  };

  keyList.sort(sortKeyIds);

  // remove duplicates based on keyId
  let z = 0;
  while (z < keyList.length - 1) {
    if (keyList[z].keyId === keyList[z + 1].keyId) {
      keyList.splice(z, 1);
    }
    else {
      z = z + 1;
    }
  }

  keyList.sort(sortUsers);

  let treeList = document.getElementById("enigmailKeySel");
  let treeChildren = treeList.getElementsByAttribute("id", "enigmailKeySelChildren")[0];
  let treeItem;

  for (let i = 0; i < keyList.length; i++) {
    treeItem = createListRow(keyList[i].keyId, false, keyList[i].uid[0], keyList[i].created, keyList[i].status);
    if (keyList[i].uid.length > 1) {
      treeItem.setAttribute("container", "true");
      let subChildren = document.createElement("treechildren");
      for (let j = 1; j < keyList[i].uid.length; j++) {
        let subItem = createListRow(keyList[i].keyId, true, keyList[i].uid[j], "", keyList[i].status);
        subChildren.appendChild(subItem);
      }
      treeItem.appendChild(subChildren);
    }
    treeChildren.appendChild(treeItem);
  }

  if (keyList.length == 1) {
    // activate found item if just one key found
    EnigSetActive(treeItem.firstChild.firstChild, 1);
  }
}

function createListRow(keyId, subKey, userId, dateField, trustStatus) {
  EnigmailLog.DEBUG("enigmailSearchKey.js: createListRow\n");
  let selectCol = document.createElement("treecell");
  selectCol.setAttribute("id", "indicator");
  let expCol = document.createElement("treecell");
  let userCol = document.createElement("treecell");
  userCol.setAttribute("id", "name");
  if (trustStatus.indexOf(ENIG_KEY_EXPIRED) >= 0) {
    expCol.setAttribute("label", EnigmailLocale.getString("selKeyExpired", dateField));
  }
  else {
    expCol.setAttribute("label", dateField);
  }

  expCol.setAttribute("id", "expiry");
  userCol.setAttribute("label", userId);
  let keyCol = document.createElement("treecell");
  keyCol.setAttribute("id", "keyid");
  if (subKey) {
    EnigSetActive(selectCol, -1);
    keyCol.setAttribute("label", "");
  }
  else {
    EnigSetActive(selectCol, 0);
    keyCol.setAttribute("label", keyId);
  }


  let userRow = document.createElement("treerow");
  userRow.appendChild(selectCol);
  userRow.appendChild(userCol);
  userRow.appendChild(expCol);
  userRow.appendChild(keyCol);
  let treeItem = document.createElement("treeitem");
  treeItem.setAttribute("id", "0x" + keyId);

  if (trustStatus.length > 0 && ENIG_KEY_NOT_VALID.indexOf(trustStatus.charAt(0)) >= 0) {
    // key invalid, mark it in grey
    for (var node = userRow.firstChild; node; node = node.nextSibling) {
      var attr = node.getAttribute("properties");
      if (typeof(attr) == "string") {
        node.setAttribute("properties", attr + " enigKeyInactive");
      }
      else {
        node.setAttribute("properties", "enigKeyInactive");
      }
    }
  }

  treeItem.appendChild(userRow);
  return treeItem;
}

function keySelectCallback(event) {
  EnigmailLog.DEBUG("enigmailSearchKey.js: keySelectCallback\n");

  let Tree = document.getElementById("enigmailKeySel");
  let row = {};
  let col = {};
  let elt = {};
  Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
  if (row.value == -1) return;

  let treeItem = Tree.contentView.getItemAtIndex(row.value);
  Tree.currentItem = treeItem;
  if (col.value.id != "selectionCol")
    return;

  var aRows = treeItem.getElementsByAttribute("id", "indicator");

  if (aRows.length > 0) {
    var elem = aRows[0];
    if (elem.getAttribute("active") == "1") {
      EnigSetActive(elem, 0);
    }
    else if (elem.getAttribute("active") == "0") {
      EnigSetActive(elem, 1);
    }
  }
}

function getKeyNotFoundMsg() {
  if (window.arguments[INPUT].searchList.length == 1 &&
    window.arguments[INPUT].searchList[0].search(/^0x[A-Fa-f0-9]{8,16}$/) === 0) {
    return EnigmailLocale.getString("keyDownload.keyUnavailable", window.arguments[INPUT].searchList[0]);
  }

  return EnigmailLocale.getString("noKeyFound");
}

function statusError() {
  EnigmailLog.DEBUG("enigmailSearchKey.js: statusError\n");
  EnigmailDialog.alert(window, EnigmailLocale.getString("noKeyserverConn", gKeyServer));
  closeDialog();
}
