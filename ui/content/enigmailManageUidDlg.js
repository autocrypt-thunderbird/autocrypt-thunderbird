/*
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** *
*/


Components.utils.import("resource://enigmail/funcs.jsm");
Components.utils.import("resource://enigmail/keyEditor.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/data.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */

function onLoad() {
  window.arguments[1].refresh = false;
  reloadUidList();
  var keyId = window.enigmailUid +" - 0x"+ window.arguments[0].keyId.substr(-8,8);
  document.getElementById("keyId").value = keyId;

  if (! window.arguments[0].ownKey) {
    document.getElementById("addUid").setAttribute("disabled", "true");
    document.getElementById("setPrimary").setAttribute("disabled", "true");
    document.getElementById("revokeUid").setAttribute("disabled", "true");
  }
}

function reloadUidList() {
  var uidList=document.getElementById("uidList");
  while (uidList.getRowCount()>0) {
    uidList.removeItemAt(0);
  }

  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc)
    return;

  var keyData = EnigmailKeyRing.getKeyDetails("0x"+window.arguments[0].keyId, false);
  var uidTxt = "";

  var keyList=keyData.split(/[\n\r]+/);
  var uidNum=0;
  for (var i=0; i < keyList.length; i++) {
    var uidStr = keyList[i].split(/:/);
    switch(uidStr[0]) {
    case "uid":
    case "uat":
      ++uidNum;
      if (uidStr[0]=="uid") {
        uidTxt=EnigmailData.convertGpgToUnicode(uidStr[9]).replace(/\\e3A/g, ":");
        if (!window.enigmailUid) {
          window.enigmailUid = uidTxt;
        }
      }
      else{
        if (uidStr[9].indexOf("1 ") === 0) {
          uidTxt=EnigmailLocale.getString("userAtt.photo");
        }
      }
      if (uidStr[1]=="r") {
        uidTxt += " - "+EnigmailLocale.getString("keyValid.revoked");
        uidStr[0]=uidStr[0].replace(/^./,"r");
      }
      item=uidList.appendItem(uidTxt, uidStr[0]+":"+String(uidNum));
      if (uidStr[1]=="r") {
        item.setAttribute("class", "enigmailUidInactive");
      }
      break;
    }
  }
  uidSelectCb();
}

function handleDblClick() {
  var uidList = document.getElementById("uidList");
  if (uidList.selectedCount > 0) {
    var selValue=uidList.selectedItem.value;
    var uidType = selValue.substr(0,3);
    if (uidType=="uat" || uidType=="rat") {
      EnigmailWindows.showPhoto(window, window.arguments[0].keyId, window.enigmailUid);
    }
  }
}

function uidSelectCb() {
  var uidList = document.getElementById("uidList");
  var selValue;

  if (uidList.selectedCount > 0) {
    selValue=uidList.selectedItem.value;
  }
  else {
    selValue = "uid:1";
  }
  if (window.arguments[0].ownKey) {
    var uidType = selValue.substr(0,3);
    if (uidType=="uat" || uidType=="rat" || uidType=="rid" || selValue.substr(4)=="1") {
      document.getElementById("setPrimary").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("setPrimary").removeAttribute("disabled");
    }
    if (selValue.substr(4)=="1") {
      document.getElementById("deleteUid").setAttribute("disabled", "true");
      document.getElementById("revokeUid").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("deleteUid").removeAttribute("disabled");
      if (uidType=="rid" || uidType=="rat") {
        document.getElementById("revokeUid").setAttribute("disabled", "true");
      }
      else {
        document.getElementById("revokeUid").removeAttribute("disabled");
      }
    }
  }
  else {
    if (selValue.substr(4)=="1") {
      document.getElementById("deleteUid").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("deleteUid").removeAttribute("disabled");
    }
  }
}

function addUid() {
  var inputObj = {
    keyId: "0x"+window.arguments[0].keyId,
    userId: window.enigmailUid
  };
  var resultObj = { refresh: false };
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
  if (uidList.selectedItem.value.substr(0,3)=="uid") {

    EnigmailKeyEditor.setPrimaryUid(window,
      "0x"+window.arguments[0].keyId,
      uidList.selectedItem.value.substr(4),
      function _cb(exitCode, errorMsg) {
        if (exitCode === 0) {
          EnigmailDialog.alert(window, EnigmailLocale.getString("changePrimUidOK"));
          window.arguments[1].refresh = true;
          reloadUidList();
        }
        else
          EnigmailDialog.alert(window, EnigmailLocale.getString("changePrimUidFailed")+"\n\n"+errorMsg);
      });
  }
}

function revokeUid() {
  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc)
    return;
  var uidList = document.getElementById("uidList");
  if (! EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("revokeUidQuestion", uidList.selectedItem.label))) return;
  if (uidList.selectedItem.value.substr(4)!="1") {
    EnigmailKeyEditor.revokeUid(window,
      "0x"+window.arguments[0].keyId,
      uidList.selectedItem.value.substr(4),
      function _cb (exitCode, errorMsg) {
        if (exitCode === 0) {
          EnigmailDialog.alert(window, EnigmailLocale.getString("revokeUidOK", uidList.selectedItem.label));
          window.arguments[1].refresh = true;
          reloadUidList();
        }
        else
          EnigmailDialog.alert(window, EnigmailLocale.getString("revokeUidFailed", uidList.selectedItem.label)+"\n\n"+errorMsgObj.value);
      });
    if (r !== 0) {
      return;
    }
  }
}

function deleteUid() {
  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc)
    return;
  var uidList = document.getElementById("uidList");
  if (! EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("deleteUidQuestion", uidList.selectedItem.label))) return;
  if (uidList.selectedItem.value.substr(4) != "1") {
    EnigmailKeyEditor.deleteUid(window,
      "0x"+window.arguments[0].keyId,
      uidList.selectedItem.value.substr(4),
      function _cb (exitCode, errorMsg) {
        if (exitCode === 0) {
          EnigmailDialog.alert(window, EnigmailLocale.getString("deleteUidOK", uidList.selectedItem.label));
          window.arguments[1].refresh = true;
          reloadUidList();
        }
        else
          EnigmailDialog.alert(window, EnigmailLocale.getString("deleteUidFailed", uidList.selectedItem.label)+"\n\n"+errorMsgObj.value);
      });
  }
}
