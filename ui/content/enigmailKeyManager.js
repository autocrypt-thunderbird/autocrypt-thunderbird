/*
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
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net>
 * are Copyright (C) 2004 Patrick Brunschwig.
 * All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailKeyManager");

const INPUT = 0;
const RESULT = 1;

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_TRUST=1;
const KEY_ID = 4;
const CREATED = 5;
const EXPIRY = 6;
const OWNERTRUST = 8;
const USER_ID = 9;
const KEY_USE_FOR = 11;

var gUserList;
var gResult;
var gSendEncrypted=true;
var gKeyList;
var gEnigRemoveListener = false;
var gEnigLastSelectedKeys = null;
var gKeySortList = null;

function enigmailKeyManagerLoad() {
   DEBUG_LOG("enigmailKeyManager.js: Load\n");
   gUserList = document.getElementById("pgpKeyList");
   window.enigIpcRequest = null;
   enigmailBuildList(false);
}


function enigmailRefreshKeys() {
  var keyList = enigmailGetSelectedKeys();
  gEnigLastSelectedKeys = [];
  for (var i=0; i<keyList.length; i++) {
    gEnigLastSelectedKeys[keyList[i]] = 1;
  }
  var userTreeList = document.getElementById("pgpKeyList");
  var treeChildren = userTreeList.getElementsByAttribute("id", "pgpKeyListChildren")[0]
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
  enigmailBuildList(true);
}


function enigLoadKeyList(secretOnly, refresh) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigLoadKeyList\n");

  try {
    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj = new Object();
    
    var enigmailSvc = GetEnigmailSvc();
    if (! enigmailSvc) 
      return null;
    var userList = enigmailSvc.getUserIdList(secretOnly,
                                             refresh,
                                             exitCodeObj,
                                             statusFlagsObj,
                                             errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(errorMsgObj.value);
      return null;
    }
  } catch (ex) {
    ERROR_LOG("ERROR in enigmailUserSelection: enigLoadKeyList\n");
  }

  return userList.split(/\n/);
}


function enigmailBuildList(refresh) {
  DEBUG_LOG("enigmailUserSelection.js: enigmailBuildList\n");
  
  var sortUsers = function (a, b) {
  
   if (a.userId.toLowerCase()<b.userId.toLowerCase()) { return -1;} else {return 1; }
  
  }
  
  var aGpgUserList = enigLoadKeyList(false, refresh);
  if (!aGpgUserList) return;
  
  var aGpgSecretsList = enigLoadKeyList(true, refresh);
  if (!aGpgSecretsList && !refresh) {
    if (EnigConfirm(EnigGetString("noSecretKeys"))) {
      EnigKeygen();
      enigmailRefreshKeys(true);
    }
  }

  gUserList.currentItem=null;
  
  var treeChildren=gUserList.getElementsByAttribute("id", "pgpKeyListChildren")[0];
  
  gKeyList = new Array();
  var gKeySortList = new Array();
  
  var keyObj = new Object();
  var i;
  
  for (i=0; i<aGpgUserList.length; i++) {
    var listRow=aGpgUserList[i].split(/:/);
    if (listRow.length>=0) {
      if (listRow[0] == "pub") {
        keyObj = new Object();
        keyObj.expiry=listRow[EXPIRY];
        keyObj.created=listRow[CREATED];
        keyObj.userId=listRow[USER_ID].replace(/\\e3A/g, ":");
        keyObj.keyId=listRow[KEY_ID];
        keyObj.keyTrust=listRow[KEY_TRUST];
        keyObj.keyUseFor=listRow[KEY_USE_FOR];
        keyObj.ownerTrust=listRow[OWNERTRUST];
        keyObj.SubUserIds=new Array();
        keyObj.fpr="";
        keyObj.photoAvailable=false;
        keyObj.secretAvailable=false;
        gKeyList[listRow[KEY_ID]] = keyObj;
        gKeySortList.push({userId: keyObj.userId, keyId: keyObj.keyId});
      }
      else if (listRow[0] == "fpr") {
        keyObj.fpr=listRow[USER_ID];
      } 
      else if (listRow[0] == "uid") {
        var subUserId = {
          userId: listRow[USER_ID].replace(/\\e3A/g, ":"),
          keyTrust: listRow[KEY_TRUST]
        }
        keyObj.SubUserIds.push(subUserId);
      }
      else if (listRow[0] == "uat") {
        if (listRow[USER_ID].indexOf("1 ")==0) {
          var userId=EnigGetString("userAtt.photo");
          keyObj.SubUserIds.push({userId: userId, keyTrust:""});
          keyObj.photoAvailable=true;
        }
      }
    }
  }
  
  // search and mark keys that have secret keys
  for (i=0; i<aGpgSecretsList.length; i++) {
     listRow=aGpgSecretsList[i].split(/:/);
     if (listRow.length>=0) {
       if (listRow[0] == "sec") {
         if (typeof(gKeyList[listRow[KEY_ID]]) == "object") {
           gKeyList[listRow[KEY_ID]].secretAvailable=true;
         }
       }
     }
  }
 
  gKeySortList.sort(sortUsers);
 
  var selectedItems=[];
  for (i=0; i < gKeySortList.length; i++) {
    var keyId = gKeySortList[i].keyId;
    if (gEnigLastSelectedKeys && typeof(gEnigLastSelectedKeys[keyId]) != "undefined")
      selectedItems.push(i);
    var treeItem=null;
    treeItem=enigUserSelCreateRow(gKeyList[keyId], -1)
    if (gKeyList[keyId].SubUserIds.length) {
      treeItem.setAttribute("container", "true");
      var subChildren=document.createElement("treechildren");
      for (var subkey=0; subkey<gKeyList[keyId].SubUserIds.length; subkey++) {
        var subItem=enigUserSelCreateRow(gKeyList[keyId], subkey);
        subChildren.appendChild(subItem);
      }
      treeItem.appendChild(subChildren);
    }
  
    if (treeItem)
      treeChildren.appendChild(treeItem);
  }
  gUserList.appendChild(treeChildren);
  
  // select last selected key
  if (selectedItems.length>0) {
    gUserList.view.selection.select(selectedItems[0]);
    for (i=1; i<selectedItems.length; i++) {
      gUserList.view.selection.rangedSelect(selectedItems[i], selectedItems[i], true)
    }
  }
  else {
    gUserList.view.selection.select(0);
  }
}

function enigGetTrustLabel(trustCode) {
  var keyTrust;
  switch (trustCode) {
  case 'q':
    keyTrust=EnigGetString("keyValid.unknown");
    break;
  case 'i':
    keyTrust=EnigGetString("keyValid.invalid");
    break;
  case 'd':
    keyTrust=EnigGetString("keyValid.disabled");
    break;
  case 'r':
    keyTrust=EnigGetString("keyValid.revoked");
    break;
  case 'e':
    keyTrust=EnigGetString("keyValid.expired");
    break;
  case 'n':
    keyTrust=EnigGetString("keyTrust.untrusted");
    break;
  case 'm':
    keyTrust=EnigGetString("keyTrust.marginal");
    break;
  case 'f':
    keyTrust=EnigGetString("keyTrust.full");
    break;
  case 'u':
    keyTrust=EnigGetString("keyTrust.ultimate");
    break;
  default:
    keyTrust="";
  }
  return keyTrust;
}

// create a (sub) row for the user tree
function enigUserSelCreateRow (keyObj, subKeyNum) {
    var expCol=document.createElement("treecell");
    var userCol=document.createElement("treecell");
    var keyCol=document.createElement("treecell");
    var typeCol=document.createElement("treecell");
    var validCol=document.createElement("treecell");
    var trustCol=document.createElement("treecell");
    var userRow=document.createElement("treerow");
    var treeItem=document.createElement("treeitem");

    userCol.setAttribute("id", "name");
    if (subKeyNum <0) {
      // primary key
      userCol.setAttribute("label", keyObj.userId);
      keyCol.setAttribute("label", keyObj.keyId.substr(-8,8));
      if (keyObj.secretAvailable) {
        typeCol.setAttribute("label", EnigGetString("keyType.publicAndSec"));
      }
      else {
        typeCol.setAttribute("label", EnigGetString("keyType.public"));
      }
      var keyTrust = enigGetTrustLabel(keyObj.keyTrust);
    }
    else {
      // secondary user id
      userCol.setAttribute("label", keyObj.SubUserIds[subKeyNum].userId);
      keyCol.setAttribute("label", "");
      typeCol.setAttribute("label", "");
      keyTrust = enigGetTrustLabel(keyObj.SubUserIds[subKeyNum].keyTrust);
    }

    expCol.setAttribute("label", keyObj.expiry);
    expCol.setAttribute("id", "expiry");

    if (keyObj.keyUseFor.indexOf("D")>=0) {
      keyTrust=EnigGetString("keyValid.disabled");
    }
    validCol.setAttribute("label", keyTrust);

    trustCol.setAttribute("label", enigGetTrustLabel(keyObj.ownerTrust));
    
    keyCol.setAttribute("id", "keyid");
    typeCol.setAttribute("id", "keyType");
    validCol.setAttribute("id", "keyValid");
    trustCol.setAttribute("id", "ownerTrust")

    userRow.appendChild(userCol);
    userRow.appendChild(keyCol);
    userRow.appendChild(typeCol);
    userRow.appendChild(validCol);
    userRow.appendChild(trustCol);
    userRow.appendChild(expCol);
    treeItem.setAttribute("id", keyObj.keyId);
    treeItem.appendChild(userRow);
    return treeItem;
}


function enigmailGetSelectedKeys() {
  
  var idList = new Array();
  var rangeCount = gUserList.view.selection.getRangeCount();
  for(var i=0; i<rangeCount; i++)
  {
    var start = {};
    var end = {};
    gUserList.view.selection.getRangeAt(i,start,end);
    for(var c=start.value; c<=end.value; c++)
    {
       idList.push(gUserList.view.getItemAtIndex(c).id);
    }
  }
  return idList;
}

function enigmailKeyMenu() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length == 1 && gKeyList[keyList[0]].secretAvailable) {
    document.getElementById("addUid").removeAttribute("disabled");
    document.getElementById("revokationCertificate").removeAttribute("disabled");
    document.getElementById("setPrimaryUid").removeAttribute("disabled");
  }
  else {
    document.getElementById("addUid").setAttribute("disabled", "true");
    document.getElementById("revokationCertificate").setAttribute("disabled", "true");
    document.getElementById("setPrimaryUid").setAttribute("disabled", "true");
  }
  
  if (keyList.length == 1 && gKeyList[keyList[0]].photoAvailable) {
    document.getElementById("viewPhoto").removeAttribute("disabled");
  }
  else {
    document.getElementById("viewPhoto").setAttribute("disabled", "true");
  }
}


function enigmailCtxMenu() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length == 1 && gKeyList[keyList[0]].secretAvailable) {
    document.getElementById("ctxAddUid").removeAttribute("disabled");
    document.getElementById("ctxSetPrimaryUid").removeAttribute("disabled");
    document.getElementById("ctxRevokationCert").removeAttribute("disabled");
  }
  else {
    document.getElementById("ctxAddUid").setAttribute("disabled", "true");
    document.getElementById("ctxSetPrimaryUid").setAttribute("disabled", "true");
    document.getElementById("ctxRevokationCert").setAttribute("disabled", "true");
  }

  if (keyList.length == 1 && gKeyList[keyList[0]].photoAvailable) {
    document.getElementById("ctxViewPhoto").removeAttribute("disabled");
  }
  else {
    document.getElementById("ctxViewPhoto").setAttribute("disabled", "true");
  }
}


function enigShowPhoto() {
  var keyList = enigmailGetSelectedKeys();

  EnigShowPhoto(keyList[0], gKeyList[keyList[0]].userId);
}


function enigEditKeyTrust() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  var userIdList = [];
  for (var i=0; i < keyList.length; i++) {
    userIdList.push(gKeyList[keyList[i]].userId);
  }

  EnigEditKeyTrust(userIdList, keyList);
  enigmailRefreshKeys();
}


function enigSignKey() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  var userIdList = [];
  for (var i=0; i < keyList.length; i++) {
    userIdList.push(gKeyList[keyList[i]].userId);
  }
  EnigSignKey(userIdList, keyList, null);
  enigmailRefreshKeys();
}

function enigCreateRevokeCert() {
  var keyList = enigmailGetSelectedKeys();
  var defaultFileName = gKeyList[keyList[0]].userId.replace(/[\<\>]/g, "");
  defaultFileName += " (0x"+keyList[0].substr(-8,8)+") rev.asc"
  var outFile = EnigFilePicker(EnigGetString("saveRevokeCertAs"),
                               "", true, "asc",
                               defaultFileName, 
                               ["*.asc", EnigGetString("asciiArmorFile")]);
  if (! outFile) return;
  
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;
  
  var errorMsgObj = {};
  var r=enigmailSvc.genRevokeCert(window, "0x"+keyList[0], outFile.path, "1", "", errorMsgObj);
  if (r != 0) {
    EnigAlert(EnigGetString("revokeCertFailed")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigAlert(EnigGetString("revokeCertOK"));
  }
}

function enigmailAddUid () {
  var keyList = enigmailGetSelectedKeys();
  var inputObj = {
    keyId: "0x"+keyList[0],
    userId: gKeyList[keyList[0]].userId
  };
  
  window.openDialog("chrome://enigmail/content/enigmailAddUidDlg.xul",
        "", "dialog,modal,centerscreen", inputObj);
        
  enigmailRefreshKeys();
        
}

function enigmailExportKeys() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (keyList.length==1) {
    var defaultFileName = gKeyList[keyList[0]].userId.replace(/[\<\>]/g, "");
    defaultFileName += " (0x"+keyList[0].substr(-8,8)+") pub.asc"
  }
  else {
    defaultFileName = EnigGetString("defaultPubKeyFilename")+".asc"
  }

  var outFile = EnigFilePicker(EnigGetString("exportToFile"),
                               "", true, "asc",
                               defaultFileName, ["*.asc", EnigGetString("asciiArmorFile")]);
  if (! outFile) return;
  
  var keyListStr = "0x"+keyList.join(" 0x");
  var exitCodeObj = {};
  var errorMsgObj = {};
  enigmailSvc.extractKey(window, 0, keyListStr, outFile.path, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value != 0) {
    EnigAlert(EnigGetString("saveKeysFailed")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigAlert(EnigGetString("saveKeysOK"));
  }
}

function enigmailImportKeysFromFile() {

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var inFile = EnigFilePicker(EnigGetString("importFile"),
                               "", false, "asc",
                               "", ["*.asc", EnigGetString("asciiArmorFile")]);
  if (! inFile) return;
  
  var errorMsgObj = {};
  var exitCode =enigmailSvc.importKeyFromFile(window, inFile.path, errorMsgObj);
  if (exitCode != 0) {
    EnigAlert(EnigGetString("importKeysFailed")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigAlert(EnigGetString("successKeyImport")+"\n\n"+errorMsgObj.value);
  }
  enigmailRefreshKeys();
}


function enigmailSearchKeys () {

  var inputObj = {
    searchList : ""
  };
  var resultObj = new Object();
  
  window.openDialog("chrome://enigmail/content/enigmailSearchKey.xul",
        "", "dialog,modal,centerscreen", inputObj, resultObj);
        
  if (resultObj.importedKeys > 0) {
    enigmailRefreshKeys();
  }
        
}

function enigmailListSig() {
  var keyList = enigmailGetSelectedKeys();
  var inputObj = {
    keyId: keyList[0],
    keyListArr: gKeyList
  };
  
  window.openDialog("chrome://enigmail/content/enigmailViewKeySigDlg.xul",
        "", "dialog,modal,centerscreen,resizable=yes", inputObj);
        
}

function enigmailSetPrimaryUid() {
  var keyList = enigmailGetSelectedKeys();
  var inputObj = {
    keyId: keyList[0],
    uidList: [ gKeyList[keyList[0]].userId ]
  };

  for (var i=0; i < gKeyList[keyList[0]].SubUserIds.length; i++) {
    if (gKeyList[keyList[0]].SubUserIds[i].keyTrust != "r") {
      inputObj.uidList.push(gKeyList[keyList[0]].SubUserIds[i].userId);
    }
    else {
      inputObj.uidList.push("");
    }
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  
  window.openDialog("chrome://enigmail/content/enigmailSetPrimUidDlg.xul",
        "", "dialog,modal,centerscreen", inputObj);
  enigmailRefreshKeys();
}
