/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global Components: false */

Components.utils.import("resource://enigmail/funcs.jsm"); /* global EnigmailFuncs: false */
Components.utils.import("resource://enigmail/keyEditor.jsm"); /* global EnigmailKeyEditor: false */
Components.utils.import("resource://enigmail/locale.jsm"); /* global EnigmailLocale: false */
Components.utils.import("resource://enigmail/data.jsm"); /* global EnigmailData: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /* global EnigmailDialog: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */

var gUserId;
var gEnigmailUid;

function onLoad() {
  window.arguments[1].refresh = false;
  reloadUidList();
  var keyId = gUserId + " - 0x" + window.arguments[0].keyId.substr(-8, 8);
  document.getElementById("keyId").value = keyId;

  if (!window.arguments[0].ownKey) {
    document.getElementById("addUid").setAttribute("disabled", "true");
    document.getElementById("setPrimary").setAttribute("disabled", "true");
    document.getElementById("revokeUid").setAttribute("disabled", "true");
  }
}

function appendUid(uidList, uidObj, uidNum) {
  let uidTxt;
  let uidType = uidObj.type;
  if (uidType === "uat") {
    if (uidObj.userId.indexOf("1 ") === 0) {
      uidTxt = EnigmailLocale.getString("userAtt.photo");
    }
    else return;
  }
  else {
    uidTxt = uidObj.userId;
    if (!gEnigmailUid) {
      gEnigmailUid = uidTxt;
    }
  }

  if (uidObj.keyTrust === "r") {
    uidTxt += " - " + EnigmailLocale.getString("keyValid.revoked");
    uidType = uidType.replace(/^./, "r");
  }
  let item = uidList.appendItem(uidTxt, uidType + ":" + String(uidNum));
  if (uidObj.keyTrust == "r") {
    item.setAttribute("class", "enigmailUidInactive");
  }
}

function reloadUidList() {
  var uidList = document.getElementById("uidList");
  while (uidList.getRowCount() > 0) {
    uidList.removeItemAt(0);
  }

  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc)
    return;

  var keyObj = EnigmailKeyRing.getKeyById(window.arguments[0].keyId);
  if (keyObj) {
    gUserId = keyObj.userId;

    for (var i = 0; i < keyObj.userIds.length; i++) {
      appendUid(uidList, keyObj.userIds[i], i + 1);
    }
  }

  uidSelectCb();
}

function handleDblClick() {
  var uidList = document.getElementById("uidList");
  if (uidList.selectedCount > 0) {
    var selValue = uidList.selectedItem.value;
    var uidType = selValue.substr(0, 3);
    if (uidType == "uat" || uidType == "rat") {
      EnigmailWindows.showPhoto(window, window.arguments[0].keyId, gEnigmailUid);
    }
  }
}

function uidSelectCb() {
  var uidList = document.getElementById("uidList");
  var selValue;

  if (uidList.selectedCount > 0) {
    selValue = uidList.selectedItem.value;
  }
  else {
    selValue = "uid:1";
  }
  if (window.arguments[0].ownKey) {
    var uidType = selValue.substr(0, 3);
    if (uidType == "uat" || uidType == "rat" || uidType == "rid" || selValue.substr(4) == "1") {
      document.getElementById("setPrimary").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("setPrimary").removeAttribute("disabled");
    }
    if (selValue.substr(4) == "1") {
      document.getElementById("deleteUid").setAttribute("disabled", "true");
      document.getElementById("revokeUid").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("deleteUid").removeAttribute("disabled");
      if (uidType == "rid" || uidType == "rat") {
        document.getElementById("revokeUid").setAttribute("disabled", "true");
      }
      else {
        document.getElementById("revokeUid").removeAttribute("disabled");
      }
    }
  }
  else {
    if (selValue.substr(4) == "1") {
      document.getElementById("deleteUid").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("deleteUid").removeAttribute("disabled");
    }
  }
}

function addUid() {
  var inputObj = {
    keyId: "0x" + window.arguments[0].keyId,
    userId: gEnigmailUid
  };
  var resultObj = {
    refresh: false
  };
  window.openDialog("chrome://enigmail/content/enigmailAddUidDlg.xul",
    "", "dialog,modal,centerscreen", inputObj, resultObj);
  window.arguments[1].refresh = resultObj.refresh;
  reloadUidList();
}

function setPrimaryUid() {
  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc)
    return;

  var errorMsgObj = {};
  var uidList = document.getElementById("uidList");
  if (uidList.selectedItem.value.substr(0, 3) == "uid") {

    EnigmailKeyEditor.setPrimaryUid(window,
      "0x" + window.arguments[0].keyId,
      uidList.selectedItem.value.substr(4),
      function _cb(exitCode, errorMsg) {
        if (exitCode === 0) {
          EnigmailDialog.alert(window, EnigmailLocale.getString("changePrimUidOK"));
          window.arguments[1].refresh = true;
          reloadUidList();
        }
        else
          EnigmailDialog.alert(window, EnigmailLocale.getString("changePrimUidFailed") + "\n\n" + errorMsg);
      });
  }
}

function revokeUid() {
  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc)
    return;
  var uidList = document.getElementById("uidList");
  if (!EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("revokeUidQuestion", uidList.selectedItem.label))) return;
  if (uidList.selectedItem.value.substr(4) != "1") {
    EnigmailKeyEditor.revokeUid(window,
      "0x" + window.arguments[0].keyId,
      uidList.selectedItem.value.substr(4),
      function _cb(exitCode, errorMsg) {
        if (exitCode === 0) {
          EnigmailDialog.alert(window, EnigmailLocale.getString("revokeUidOK", uidList.selectedItem.label));
          window.arguments[1].refresh = true;
          reloadUidList();
        }
        else
          EnigmailDialog.alert(window, EnigmailLocale.getString("revokeUidFailed", uidList.selectedItem.label) + "\n\n" + errorMsg);
      });
  }
}

function deleteUid() {
  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc)
    return;
  var uidList = document.getElementById("uidList");
  if (!EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("deleteUidQuestion", uidList.selectedItem.label))) return;
  if (uidList.selectedItem.value.substr(4) != "1") {
    EnigmailKeyEditor.deleteUid(window,
      "0x" + window.arguments[0].keyId,
      uidList.selectedItem.value.substr(4),
      function _cb(exitCode, errorMsg) {
        if (exitCode === 0) {
          EnigmailDialog.alert(window, EnigmailLocale.getString("deleteUidOK", uidList.selectedItem.label));
          window.arguments[1].refresh = true;
          reloadUidList();
        }
        else
          EnigmailDialog.alert(window, EnigmailLocale.getString("deleteUidFailed", uidList.selectedItem.label) + "\n\n" + errorMsg);
      });
  }
}
