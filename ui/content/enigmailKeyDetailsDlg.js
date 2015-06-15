dump("loading: enigmailKeyDetailsDlg.js\n");
/*global Components */
/* ***** BEGIN LICENSE BLOCK *****
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
 * Copyright (C) 2007 Patrick Brunschwig. All Rights Reserved.
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
 * ***** END LICENSE BLOCK ***** */


EnigInitCommon("enigmailKeyDetailsDlg");

var gKeyId = null;
var gUserId = null;
var gKeyList = null;

function onLoad() {
  window.arguments[1].refresh = false;

  gKeyId = window.arguments[0].keyId;
  gKeyList = window.arguments[0].keyListArr;

  reloadData();

  if (window.arguments[0].secKey) {
    setAttr("keyType", EnigGetString("keyTypePair"));
    document.getElementById("ownKeyCommands").removeAttribute("hidden");
  }
  else {
    setAttr("keyType", EnigGetString("keyTypePublic"));
  }
}

function reloadData() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    window.close();
    return;
  }
  var exitCodeObj = {};
  var statusFlagsObj = {};
  var errorMsgObj = {};

  gUserId = null;

  var fingerprint = "";
  var subKeyLen="";
  var subAlgo="";
  var treeChildren = document.getElementById("keyListChildren");
  var uidList = document.getElementById("uidListChildren");

  // clean lists
  EnigCleanGuiList(treeChildren);
  EnigCleanGuiList(uidList);

  var sigListStr = KeyRing.getKeySig("0x"+gKeyId, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value === 0) {
    var keyDetails = EnigGetKeyDetails(sigListStr);

    if (keyDetails.showPhoto === true) {
      document.getElementById("showPhoto").removeAttribute("disabled");
    }

    for (let i=0; i < keyDetails.uidList.length; i++) {
      uidList.appendChild(createUidRow(keyDetails.uidList[i]));
    }
    for (let i=0; i < keyDetails.subkeyList.length; i++) {
      EnigAddSubkey(treeChildren, keyDetails.subkeyList[i]);
    }

    gUserId = keyDetails.gUserId;
    setAttr("userId", gUserId);
    setAttr("keyId", "0x"+ gKeyId.substr(-8,8));
    setAttr("calcTrust", getTrustLabel(keyDetails.calcTrust));
    setAttr("ownerTrust", getTrustLabel(keyDetails.ownerTrust));
    if (keyDetails.fingerprint) {
      setAttr("fingerprint", EnigFormatFpr(keyDetails.fingerprint));
    }
  }
}


function createUidRow(aLine) {
  var treeItem = document.createElement("treeitem");
  var treeRow = document.createElement("treerow");
  var uidCol = createCell(EnigConvertGpgToUnicode(aLine[9]));
  var validCol = createCell(getTrustLabel(aLine[1]));
  if ("dre".search(aLine[1]) >= 0) {
    uidCol.setAttribute("properties", "enigKeyInactive");
    validCol.setAttribute("properties", "enigKeyInactive");
  }
  treeRow.appendChild(uidCol);
  treeRow.appendChild(validCol);
  treeItem.appendChild(treeRow);
  return treeItem;
}

function createCell(label) {
  var cell = document.createElement("treecell");
  cell.setAttribute("label", label);
  return cell;
}

function getTrustLabel(trustCode) {
  var trustTxt=EnigGetTrustLabel(trustCode);
  if (trustTxt=="-" || trustTxt.length===0) {
    trustTxt=EnigGetString("keyValid.unknown");
  }
  return trustTxt;
}

function setAttr(attribute, value) {
  var elem = document.getElementById(attribute);
  if (elem) {
    elem.value = value;
  }
}

function enableRefresh() {
  window.arguments[1].refresh = true;
}

// ------------------ onCommand Functions  -----------------

function showPhoto() {
  EnigShowPhoto(gKeyId, gUserId, 0);
}

function viewSignatures() {
  var inputObj = {
    keyId: gKeyId,
    keyListArr: gKeyList
  };
  var resultObj = {refresh: false};

  window.openDialog("chrome://enigmail/content/enigmailViewKeySigDlg.xul",
        "", "dialog,modal,centerscreen,resizable=yes", inputObj, resultObj);

  if (resultObj.refresh) {
    enableRefresh();
    reloadData();
  }

}

function keyDetailsAddPhoto() {
  keyMgrAddPhoto(gUserId, gKeyId);
}

function signKey() {
  if (EnigSignKey(gUserId, gKeyId, null)) {
    enableRefresh();
    reloadData();
  }
}


function changeExpirationDate() {
  if (EnigEditKeyExpiry([gUserId], [gKeyId])) {
    enableRefresh();
    reloadData();
  }
}


function setOwnerTrust() {

  if (EnigEditKeyTrust([gUserId], [gKeyId])) {
    enableRefresh();
    reloadData();
  }
}

function manageUids() {
  var inputObj = {
    keyId: gKeyId,
    ownKey: window.arguments[0].secKey
  };

  var resultObj = {refresh: false};
  window.openDialog("chrome://enigmail/content/enigmailManageUidDlg.xul",
        "", "dialog,modal,centerscreen,resizable=yes", inputObj, resultObj);
  if (resultObj.refresh) {
    enableRefresh();
    reloadData();
  }
}

function changePassword() {
  EnigChangeKeyPwd(gKeyId, gUserId);
}

function revokeKey() {
  EnigRevokeKey(gKeyId, gUserId, function _revokeKeyCb(success) {
    if (success) {
      enableRefresh();
      reloadData();
    }
  });
}

function genRevocationCert() {
  EnigCreateRevokeCert(gKeyId, gUserId);
}
