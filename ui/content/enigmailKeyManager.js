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

const KEY_EXPIRED="e";
const KEY_REVOKED="r";
const KEY_INVALID="i";
const KEY_DISABLED="d";
const KEY_NOT_VALID=KEY_EXPIRED+KEY_REVOKED+KEY_INVALID+KEY_DISABLED;


var gUserList;
var gResult;
var gSendEncrypted=true;
var gKeyList;
var gEnigRemoveListener = false;
var gEnigLastSelectedKeys = null;
var gKeySortList = null;
var gEnigIpcRequest = null;
var gEnigCallbackFunc = null;
var gClearButton = null;
var gFilterBox = null;
var gSearchTimer = null;
var gSearchInput = null;


function enigmailKeyManagerLoad() {
   DEBUG_LOG("enigmailKeyManager.js: Load\n");
   gUserList = document.getElementById("pgpKeyList");
   gFilterBox = document.getElementById("filterKey");
   gClearButton = document.getElementById("clearFilter");
   gSearchInput = document.getElementById("filterKey");
   window.enigIpcRequest = null;
   enigmailBuildList(false);
}


function enigmailRefreshKeys() {
  var keyList = enigmailGetSelectedKeys();
  gEnigLastSelectedKeys = [];
  for (var i=0; i<keyList.length; i++) {
    gEnigLastSelectedKeys[keyList[i]] = 1;
  }
  var treeChildren = document.getElementById("pgpKeyListChildren");
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
  enigmailBuildList(true);
  enigApplyFilter();
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

  if (typeof(userList) == "string") {
    return userList.split(/\n/);
  }
  else {
    return [];
  }
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
  
  var treeChildren=document.getElementById("pgpKeyListChildren");
  
  gKeyList = new Array();
  var gKeySortList = new Array();
  
  var keyObj = new Object();
  var i;
  
  for (i=0; i<aGpgUserList.length; i++) {
    var listRow=aGpgUserList[i].split(/:/);
    if (listRow.length>=0) {
      switch (listRow[0]) {
      case "pub":
        keyObj = new Object();
        keyObj.expiry=listRow[EXPIRY];
        keyObj.created=listRow[CREATED];
        keyObj.userId=EnigConvertGpgToUnicode(listRow[USER_ID].replace(/\\e3A/g, ":"));
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
        break;
      case "fpr":
        keyObj.fpr=listRow[USER_ID];
        break;
      case "uid":
        var subUserId = {
          userId: EnigConvertGpgToUnicode(listRow[USER_ID].replace(/\\e3A/g, ":")),
          keyTrust: listRow[KEY_TRUST],
          type: "uid"
        }
        keyObj.SubUserIds.push(subUserId);
        break;
      case "uat":
        if (listRow[USER_ID].indexOf("1 ")==0) {
          var userId=EnigGetString("userAtt.photo");
          keyObj.SubUserIds.push({userId: userId, keyTrust:"", type: "uat"});
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


// create a (sub) row for the user tree
function enigUserSelCreateRow (keyObj, subKeyNum) {
    var expCol=document.createElement("treecell");
    var userCol=document.createElement("treecell");
    var keyCol=document.createElement("treecell");
    var typeCol=document.createElement("treecell");
    var validCol=document.createElement("treecell");
    var trustCol=document.createElement("treecell");
    var fprCol=document.createElement("treecell");
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
      var keyTrust = keyObj.keyTrust;
      treeItem.setAttribute("keytype", "pub");
      fprCol.setAttribute("label",EnigFormatFpr(keyObj.fpr));
    }
    else {
      // secondary user id
      keyObj.SubUserIds[subKeyNum].userId = EnigConvertGpgToUnicode(keyObj.SubUserIds[subKeyNum].userId);
      userCol.setAttribute("label", keyObj.SubUserIds[subKeyNum].userId);
      treeItem.setAttribute("keytype", keyObj.SubUserIds[subKeyNum].type);
      keyCol.setAttribute("label", "");
      typeCol.setAttribute("label", "");
      keyTrust = keyObj.SubUserIds[subKeyNum].keyTrust;
    }
    var keyTrustLabel = EnigGetTrustLabel(keyTrust);

    expCol.setAttribute("label", keyObj.expiry);
    expCol.setAttribute("id", "expiry");

    if (keyObj.keyUseFor.indexOf("D")>=0) {
      keyTrustLabel=EnigGetString("keyValid.disabled");
    }
    validCol.setAttribute("label", keyTrustLabel);

    trustCol.setAttribute("label", EnigGetTrustLabel(keyObj.ownerTrust));
    
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
    userRow.appendChild(fprCol);

    if ((keyTrust.length>0) &&
        (KEY_NOT_VALID.indexOf(keyTrust.charAt(0))>=0) ||
        (keyObj.keyUseFor.indexOf("D")>=0)) {
      for (var node=userRow.firstChild; node; node=node.nextSibling) {
        node.setAttribute("properties", "enigKeyInactive");
      }
    }
    if (keyObj.secretAvailable && subKeyNum <0) {
      for (node=userRow.firstChild; node; node=node.nextSibling) {
        var attr=node.getAttribute("properties");
        if (typeof(attr)=="string") {
          node.setAttribute("properties", attr+" enigmailOwnKey");
        }
        else {
          node.setAttribute("properties", "enigmailOwnKey");
        }
      }
    }
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
      try {
        idList.push(gUserList.view.getItemAtIndex(c).id);
      }
      catch(ex) {
        return [];
      }
    }
  }
  return idList;
}

function enigmailKeyMenu() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length == 1 && gKeyList[keyList[0]].secretAvailable) {
    document.getElementById("bcRevoke").removeAttribute("disabled");
    document.getElementById("bcManageUid").removeAttribute("disabled");
  }
  else {
    document.getElementById("bcRevoke").setAttribute("disabled", "true");
    document.getElementById("bcManageUid").setAttribute("disabled", "true");
  }
  
  if (keyList.length == 1 && gKeyList[keyList[0]].photoAvailable) {
    document.getElementById("bcViewPhoto").removeAttribute("disabled");
  }
  else {
    document.getElementById("bcViewPhoto").setAttribute("disabled", "true");
  }

  if (keyList.length == 1) {
    document.getElementById("bcSignKey").removeAttribute("disabled");
    document.getElementById("bcViewSig").removeAttribute("disabled");
    document.getElementById("bcKeyDetails").removeAttribute("disabled");
    document.getElementById("bcDeleteKey").removeAttribute("disabled");
    document.getElementById("bcEnableKey").removeAttribute("disabled");
    if (gKeyList[keyList[0]].keyUseFor.indexOf("D")>0 || 
        gKeyList[keyList[0]].keyTrust.indexOf(KEY_DISABLED)>=0) {
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.enableKey"))
    } 
    else {
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.disableKey"))
    }
  }
  else {
    document.getElementById("bcSignKey").setAttribute("disabled", "true");
    document.getElementById("bcViewSig").setAttribute("disabled", "true");
    document.getElementById("bcKeyDetails").setAttribute("disabled", "true");
    document.getElementById("bcDeleteKey").setAttribute("disabled", "true");
    document.getElementById("bcEnableKey").setAttribute("disabled", "true");
  }
}

function enigmailDblClick(event) {
  if (event) {
    if (event.button != 0) return;
  }
  var keyList = enigmailGetSelectedKeys();
  var keyType="";
  if (keyList.length == 1) {
    var rangeCount = gUserList.view.selection.getRangeCount();
    var start = {};
    var end = {};
    gUserList.view.selection.getRangeAt(0,start,end);
    try {
      keyType = gUserList.view.getItemAtIndex(start.value).getAttribute("keytype");
    }
    catch(ex) {}
  }
  if (keyType=="uat") {
    enigShowPhoto();
  }
  else {
   enigmailKeyDetails();
  }
}

function enigmailKeyDetails() {
  var keyList = enigmailGetSelectedKeys();

  var inputObj = {
    keyId:  keyList[0],
    secKey: gKeyList[ keyList[0]].secretAvailable
  };
  window.openDialog("chrome://enigmail/content/enigmailKeyDetailsDlg.xul",
        "", "dialog,modal,centerscreen", inputObj);
}


function enigmailDeleteKey() {
  var keyList = enigmailGetSelectedKeys();

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var userId="0x"+keyList[0].substr(-8,8)+" - "+gKeyList[keyList[0]].userId;
  var deleteSecret=false;
  if(gKeyList[keyList[0]].secretAvailable) {
    if (!EnigConfirm(EnigGetString("deleteSecretKey", userId))) return;
    deleteSecret=true;
  }
  else {
    if (!EnigConfirm(EnigGetString("deletePubKey", userId))) return;
  }
  
  var errorMsgObj = {};
  var r=enigmailSvc.deleteKey(window, "0x"+keyList[0], deleteSecret, errorMsgObj);
  if (r != 0) {
    EnigAlert(EnigGetString("deleteKeyFailed")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigAlert(EnigGetString("deleteKeyOk"));
  }
  enigmailRefreshKeys();
}


function enigmailEnableKey() {
  var keyList = enigmailGetSelectedKeys();
  var disableKey = (gKeyList[keyList[0]].keyUseFor.indexOf("D")<0 && 
                     gKeyList[keyList[0]].keyTrust.indexOf(KEY_DISABLED)<0);

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var errorMsgObj = {};
  var r=enigmailSvc.enableDisableKey(window, "0x"+keyList[0], disableKey, errorMsgObj);
  if (r != 0) {
    EnigAlert(EnigGetString("enableKeyFailed")+"\n\n"+errorMsgObj.value);
  }
  enigmailRefreshKeys();
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
  EnigSignKey(gKeyList[keyList[0]].userId, keyList[0], null);
  enigmailRefreshKeys();
}

function enigmailRevokeKey() {
  var keyList = enigmailGetSelectedKeys();

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var userId="0x"+keyList[0].substr(-8,8)+" - "+gKeyList[keyList[0]].userId;
  if (!EnigConfirm(EnigGetString("revokeKeyAsk", userId))) return;

  var tmpDir=EnigGetTempDir();

  try {
    var revFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
    revFile.initWithPath(tmpDir);
    if (!(revFile.isDirectory() && revFile.isWritable())) {
      EnigAlert(EnigGetString("noTempDir"));
      return;
    }
  }
  catch (ex) {}
  revFile.append("revkey.asc");
  revFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
  
  var errorMsgObj = {};
  var r=enigmailSvc.genRevokeCert(window, "0x"+keyList[0], revFile.path, "0", "", errorMsgObj);
  if (r != 0) {
    revFile.remove(false);
    EnigAlert(EnigGetString("revokeKeyFailed")+"\n\n"+errorMsgObj.value);
    return;
  }
  r = enigmailSvc.importKeyFromFile(window, revFile.path, errorMsgObj);
  revFile.remove(false);
  if (r != 0) {
    EnigAlert(EnigGetString("revokeKeyFailed")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigAlert(EnigGetString("revokeKeyOk"));
  }
  enigmailRefreshKeys();
}

function enigCreateRevokeCert() {
  var keyList = enigmailGetSelectedKeys();
  
  EnigCreateRevokeCert(keyList[0], gKeyList[keyList[0]].userId);
}

function enigmailExportKeys() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }

  var exportFlags = 0;
  if (gKeyList[keyList[0]].secretAvailable) {
    if (EnigConfirm(EnigGetString("exportSecretKey"))) {
      exportFlags |= nsIEnigmail.EXTRACT_SECRET_KEY;
    }
  }


  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (keyList.length==1) {
  
    var defaultFileName = gKeyList[keyList[0]].userId.replace(/[\<\>]/g, "");
    if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
      defaultFileName = EnigGetString("specificPubSecKeyFilename", defaultFileName, keyList[0].substr(-8,8))+".asc";
    }
    else {
      defaultFileName = EnigGetString("specificPubKeyFilename", defaultFileName, keyList[0].substr(-8,8))+".asc";
    }
  }
  else {
    if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
      defaultFileName = EnigGetString("defaultPubSecKeyFilename")+".asc"
    }
    else {
      defaultFileName = EnigGetString("defaultPubKeyFilename")+".asc"
    }
  }

  var outFile = EnigFilePicker(EnigGetString("exportToFile"),
                               "", true, "*.asc",
                               defaultFileName,
                               [EnigGetString("asciiArmorFile"), "*.asc"]);
  if (! outFile) return;
  
  var keyListStr = "0x"+keyList.join(" 0x");
  var exitCodeObj = {};
  var errorMsgObj = {};
  enigmailSvc.extractKey(window, exportFlags, keyListStr, outFile.path, exitCodeObj, errorMsgObj);
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
                               "", false, "*.asc", "",
                               [EnigGetString("asciiArmorFile"), "*.asc",
                                EnigGetString("gnupgFile"), "*.gpg",
                                EnigGetString("pgpFile"), "*.pgp"]);
  if (! inFile) return;
  
  var errorMsgObj = {};
  var exitCode =enigmailSvc.importKeyFromFile(window, inFile.path, errorMsgObj);
  if (exitCode != 0) {
    EnigAlert(EnigGetString("importKeysFailed")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigLongAlert(EnigGetString("successKeyImport")+"\n\n"+errorMsgObj.value);
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

function enigmailManageUids() {
  var keyList = enigmailGetSelectedKeys();
  var inputObj = {
    keyId: keyList[0]
  };

  window.openDialog("chrome://enigmail/content/enigmailManageUidDlg.xul",
        "", "dialog,modal,centerscreen,resizable", inputObj);
  enigmailRefreshKeys();
}

function enigmailImportFromClipbrd() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (!EnigConfirm(EnigGetString("importFromClip"))) {
    return;
  }
  var clipBoard = Components.classes[ENIG_CLIPBOARD_CONTRACTID].getService(Components.interfaces.nsIClipboard);
  try {
    var transferable = Components.classes[ENIG_TRANSFERABLE_CONTRACTID].createInstance(Components.interfaces.nsITransferable);
    transferable.addDataFlavor("text/unicode");
    clipBoard.getData(transferable, clipBoard.kGlobalClipboard);
    var flavour = {};
    var data = {};
    var length = {};
    transferable.getAnyTransferData(flavour, data, length);
    var cBoardContent=data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    DEBUG_LOG("enigmailKeyManager.js: enigmailImportFromClipbrd: got data from clipboard");
  }
  catch(ex) {}

  var errorMsgObj = {};
  var r=enigmailSvc.importKey(window, 0, cBoardContent, "", errorMsgObj);
  EnigLongAlert(errorMsgObj.value);
  enigmailRefreshKeys();  
}

function enigmailCopyToClipbrd() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  var exitCodeObj={};
  var errorMsgObj={};
  var keyData = enigmailSvc.extractKey(window, 0, "0x"+keyList.join(" 0x"), null, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value != 0) {
    EnigAlert(EnigGetString("copyToClipbrdFailed")+"\n\n"+errorMsgObj.value);
    return;
  }
  var clipBoard = Components.classes[ENIG_CLIPBOARD_CONTRACTID].getService(Components.interfaces.nsIClipboard);
  try {
    clipBoardHlp = Components.classes[ENIG_CLIPBOARD_HELPER_CONTRACTID].getService(Components.interfaces.nsIClipboardHelper);
    clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kGlobalClipboard);
    if (clipBoard.supportsSelectionClipboard()) {
      clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kSelectionClipboard);
    }
    DEBUG_LOG("enigmailKeyManager.js: enigmailImportFromClipbrd: got data from clipboard");
    EnigAlert(EnigGetString("copyToClipbrdOK"));  
  }
  catch(ex) {
    EnigAlert(EnigGetString("copyToClipbrdFailed"));
  }

}

function enigmailSearchKey() {
  var inputObj = {
    searchList : null
  };
  var resultObj = new Object();
  
  window.openDialog("chrome://enigmail/content/enigmailSearchKey.xul",
        "", "dialog,modal,centerscreen", inputObj, resultObj);
        
  if (resultObj.importedKeys > 0) {
    enigmailRefreshKeys();
  }
}


function enigmailUploadKeys() {
  enigmailKeyServerAcess(nsIEnigmail.UPLOAD_KEY, enigmailUploadKeysCb);
}

function enigmailUploadKeysCb(exitCode, errorMsg, msgBox) {
  if (msgBox) {
    if (exitCode!=0) {
      EnigLongAlert(EnigGetString("sendKeysFailed")+"\n"+errorMsg);
    }
  }
  else {
    return (EnigGetString(exitCode==0 ? "sendKeysOK" : "sendKeysFailed"));
  }
  return "";
}

function enigmailReceiveKey() {
  enigmailKeyServerAcess(nsIEnigmail.DOWNLOAD_KEY, enigmailReceiveKeyCb);
}

function enigmailReceiveKeyCb(exitCode, errorMsg, msgBox) {
  if (msgBox) {
    if (exitCode==0) {
      EnigLongAlert(EnigGetString("receiveKeysOk") + "\n"+ errorMsg);
      enigmailRefreshKeys();
    }
    else {
      EnigLongAlert(EnigGetString("receiveKeysFailed")+"\n"+errorMsg);
    }
  }
  else {
    return (EnigGetString(exitCode==0 ? "receiveKeysOk" : "receiveKeysFailed"));
  }
  return "";
}

//
// ----- key filtering functionality  -----
//

function onSearchInput(returnKeyHit)
{
  if (gSearchTimer) {
    clearTimeout(gSearchTimer);
    gSearchTimer = null;
  }

  // only select the text when the return key was hit
  if (returnKeyHit) {
    gSearchInput.select();
    onEnterInSearchBar();
  }
  else {
    gSearchTimer = setTimeout("onEnterInSearchBar();", 800);
  }
}

function onSearchKeyPress(event)
{
  // 13 == return
  if (event && event.keyCode == 13) {
    event.stopPropagation(); // make sure the dialog is not closed...
    onSearchInput(true);
  }
}

function onEnterInSearchBar() {
   if (gSearchInput.value == "")
   {
     onResetFilter();
     return;
   }
   gClearButton.setAttribute("disabled", false);
   enigApplyFilter();
}

function getFirstNode() {
  return document.getElementById("pgpKeyListChildren").firstChild;
}

function onResetFilter() {
  gFilterBox.value="";
  var node=getFirstNode();
  while (node) {
    node.hidden=false;
    node = node.nextSibling;
  }
  gClearButton.setAttribute("disabled", true);
}

function enigApplyFilter() {
  var searchTxt=gSearchInput.value;
  if (!searchTxt || searchTxt.length==0) return;
  searchTxt = searchTxt.toLowerCase();
  var node=getFirstNode();
  while (node) {
    var uid = gKeyList[node.id].userId;
    var hideNode = true;
    if ((uid.toLowerCase().indexOf(searchTxt) >= 0) ||
        (node.id.toLowerCase().indexOf(searchTxt) >= 0)) {
      hideNode = false;
    }
    for (var subUid=0; subUid < gKeyList[node.id].SubUserIds.length; subUid++) {
      uid = gKeyList[node.id].SubUserIds[subUid].userId;
      if (uid.toLowerCase().indexOf(searchTxt) >= 0) {
        hideNode = false;
      }
    }
    node.hidden=hideNode;
    node = node.nextSibling;
  }
}


//
// ----- keyserver related functionality ----
//
function enigmailKeyServerAcess(accessType, callbackFunc) {

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var resultObj = {};
  
  if (accessType == nsIEnigmail.UPLOAD_KEY) {
    var inputObj = {
       upload: true
    };
  }
  else {
    inputObj = {};
  }
    
  var selKeyList = enigmailGetSelectedKeys();
  if (selKeyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  
  var keyList=[];
  for (var i=0; i < selKeyList.length; i++) {
    keyList.push("0x"+selKeyList[i].substr(-8,8)+" - "+ gKeyList[selKeyList[i]].userId); 
  }
  inputObj.keyId = keyList.join(", ");
  
  window.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
        "", "dialog,modal,centerscreen", inputObj, resultObj);
  if (! resultObj.value) {
    return;
  }
  
  var progressBar=Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
  var requestObserver = new EnigRequestObserver(enigSendKeyTerminate, {'progressBar': progressBar, 'callType': 1});

  var progressListener = {
      onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus)
      {
        if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
          if (progressBar.processCanceledByUser)
            enigSendKeyCancel(progressBar);
        }
      },

      onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
      {},

      onLocationChange: function(aWebProgress, aRequest, aLocation)
      {},

      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage)
      {},

      onSecurityChange: function(aWebProgress, aRequest, state)
      {},

      QueryInterface : function(iid)
      {
        if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
            iid.equals(Components.interfaces.nsISupportsWeakReference) ||
            iid.equals(Components.interfaces.nsISupports))
          return this;

        throw Components.results.NS_NOINTERFACE;
      }
  };
  progressBar.registerListener(progressListener);
     
  var errorMsgObj={};
  gEnigIpcRequest = enigmailSvc.receiveKey(accessType, resultObj.value, "0x"+selKeyList.join(" 0x"), requestObserver, errorMsgObj);
  if (gEnigIpcRequest == null) {
    callbackFunc(-1, errorMsgObj.value, true);
    return;
  }
  gEnigCallbackFunc = callbackFunc;
  if (accessType == nsIEnigmail.UPLOAD_KEY) {
    document.getElementById("statusText").value=EnigGetString("uploadingKey");
  }
  else {
    document.getElementById("statusText").value=EnigGetString("downloadingKey");
  }
  document.getElementById("progressBar").removeAttribute("collapsed");
  document.getElementById("cancelBox").removeAttribute("collapsed");
}


function enigSendKeyTerminate (terminateArg, ipcRequest) {
  DEBUG_LOG("enigmailKeyManager.js: enigSendKeyTerminate\n");

  if (terminateArg && terminateArg.progressBar) {
    terminateArg.progressBar.onStateChange(null, null, Components.interfaces.nsIWebProgressListener.STATE_STOP, 0);
  }

  if (gEnigIpcRequest) {
    var cbFunc = gEnigCallbackFunc;
    var keyRetrProcess = gEnigIpcRequest.pipeTransport;
    var exitCode;
    var statusText = document.getElementById("statusText");
    document.getElementById("progressBar").setAttribute("collapsed", "true");
    document.getElementById("cancelBox").setAttribute("collapsed", "true");
    
    var enigmailSvc = GetEnigmailSvc();
    if (keyRetrProcess && !keyRetrProcess.isAttached()) {
      keyRetrProcess.terminate();
      exitCode = keyRetrProcess.exitCode();
      DEBUG_LOG("enigmailKeyManager.js: enigSendKeyTerminate: exitCode = "+exitCode+"\n");
      if (enigmailSvc) {
        exitCode = enigmailSvc.fixExitCode(exitCode, 0);
      }
    }
  
    statusText.value=cbFunc(exitCode, "", false);
    
    var errorMsg="";
    try {
      var gpgConsole = gEnigIpcRequest.stderrConsole.QueryInterface(Components.interfaces.nsIPipeConsole);

      if (gpgConsole && gpgConsole.hasNewData()) {
        errorMsg = gpgConsole.getData();
        if (enigmailSvc) {
          var statusFlagsObj=new Object();
          var statusMsgObj=new Object();
          errorMsg=enigmailSvc.parseErrorOutput(errorMsg, statusFlagsObj, statusMsgObj);
        }
      }
    } catch (ex) {}
    
    DEBUG_LOG("enigmailKeyManager.js: enigSendKeyTerminate: errorMsg="+errorMsg);
    if (errorMsg.search(/ec=\d+/i)>=0) {
      exitCode=-1;
    }
    statusText.value=cbFunc(exitCode, "", false);
    cbFunc(exitCode, errorMsg, true);

    window.setTimeout(enigHideStatus, 5000);
    gEnigIpcRequest.close(true);
  }
}

function enigSendKeyCancel() {
  document.getElementById("cancelButton").setAttribute("collapsed", "true");
  var keyRetrProcess = gEnigIpcRequest.pipeTransport;

  if (keyRetrProcess && !keyRetrProcess.isAttached()) {
    keyRetrProcess.terminate();
  }
  gEnigIpcRequest.close(true);
  document.getElementById("statusText").value=EnigGetString("keyserverAccessAborted");
  document.getElementById("progressBar").setAttribute("collapsed", "true");
  window.setTimeout(enigHideStatus, 5000);
  gEnigIpcRequest=null;
  gEnigCallbackFunc=null;
}

function enigHideStatus() {
  document.getElementById("statusText").value="";
  document.getElementById("progressBar").setAttribute("collapsed", "true");
  document.getElementById("cancelBox").setAttribute("collapsed", "true");
}

