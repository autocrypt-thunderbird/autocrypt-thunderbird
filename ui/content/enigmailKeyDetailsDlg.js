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
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org> are
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
  var exitCodeObj = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj = new Object();

  gUserId = null;

  var fingerprint = "";
  var subKeyLen="";
  var subAlgo="";
  var treeChildren = document.getElementById("keyListChildren");
  var uidList = document.getElementById("uidListChildren");

  // clean lists
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
  while (uidList.firstChild) {
    uidList.removeChild(uidList.firstChild);
  }

  var sigListStr = enigmailSvc.getKeySig("0x"+gKeyId, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value == 0) {
    var sigList = sigListStr.split(/[\n\r]+/);
    for (var i=0; i < sigList.length; i++) {
      var aLine=sigList[i].split(/:/);
      switch (aLine[0]) {
      case "pub":
        gUserId=EnigConvertGpgToUnicode(aLine[9]);
        var calcTrust=aLine[1];
        if (aLine[11].indexOf("D")>=0) calcTrust="d";
        calcTrust=getTrustLabel(calcTrust);
        var ownerTrust=getTrustLabel(aLine[8]);
        addSubkey(treeChildren, aLine);
      case "uid":
        if (! gUserId) {
          gUserId=EnigConvertGpgToUnicode(aLine[9]);
        }
        else {
          uidList.appendChild(createUidRow(aLine));
        }
        break;
      case "uat":
        if (aLine[9].search("1 ") == 0) {
          document.getElementById("showPhoto").removeAttribute("disabled");
        }
        break;
      case "sub":
        addSubkey(treeChildren, aLine);
        break;
      case "fpr":
        fingerprint = aLine[9];
        break;
      }
    }
  }

  setAttr("userId", gUserId);
  setAttr("keyId", "0x"+ gKeyId.substr(-8,8));
  setAttr("calcTrust", calcTrust);
  setAttr("ownerTrust", ownerTrust);
  if (fingerprint) {
    setAttr("fingerprint", EnigFormatFpr(fingerprint));
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

function addSubkey(treeChildren, aLine) {
  var aRow=document.createElement("treerow");
  var treeItem=document.createElement("treeitem");
  var subkey=EnigGetString(aLine[0]=="sub" ? "keyTypeSubkey" : "keyTypePrimary")
  aRow.appendChild(createCell(subkey)); // subkey type
  aRow.appendChild(createCell("0x"+aLine[4].substr(-8,8))); // key id
  aRow.appendChild(createCell(EnigGetString("keyAlgorithm_"+aLine[3]))); // algorithm
  aRow.appendChild(createCell(aLine[2])); // size
  aRow.appendChild(createCell(EnigGetDateTime(aLine[5], true, false))); // created
  var expire=(aLine[6].length==0 ? EnigGetString("keyExpiryNever") : EnigGetDateTime(aLine[6], true, false));
  if (aLine[1]=="r") {
    expire = EnigGetString("keyValid.revoked");
  }
  aRow.appendChild(createCell(expire)); // expiry
  treeItem.appendChild(aRow);
  treeChildren.appendChild(treeItem);
}

function createCell(label) {
  var cell = document.createElement("treecell");
  cell.setAttribute("label", label);
  return cell;
}

function getTrustLabel(trustCode) {
  var trustTxt=EnigGetTrustLabel(trustCode);
  if (trustTxt=="-" || trustTxt.length==0) {
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
  EnigShowPhoto(gKeyId, gUserId, 0)
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
  if (EnigRevokeKey(gKeyId, gUserId)) {
    enableRefresh();
    reloadData();
  }
}

function genRevocationCert() {
  EnigCreateRevokeCert(gKeyId, gUserId);
}
