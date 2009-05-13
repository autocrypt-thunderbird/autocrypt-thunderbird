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
var gShowAllKeysElement = null;
var gTreeChildren = null;

function enigmailKeyManagerLoad() {
  DEBUG_LOG("enigmailKeyManager.js: enigmailKeyManagerLoad\n");
  gUserList = document.getElementById("pgpKeyList");
  gFilterBox = document.getElementById("filterKey");
  gClearButton = document.getElementById("clearFilter");
  gSearchInput = document.getElementById("filterKey");
  gShowAllKeysElement = document.getElementById("showAllKeys");
  gTreeChildren = document.getElementById("pgpKeyListChildren");
  if (EnigGetPref("keyManShowAllKeys")) {
    gShowAllKeysElement.setAttribute("checked", "true");
  }

  gUserList.addEventListener('click', enigmailOnClick, true);
  document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.disableKey"))
  
  window.enigIpcRequest = null;

  document.getElementById("pleaseWait").showPopup(gSearchInput, -1, -1, "tooltip", "after_end", "");
  document.getElementById("statusText").value = EnigGetString("keyMan.loadingKeys");
  document.getElementById("progressBar").removeAttribute("collapsed");
  window.setTimeout(loadkeyList, 100);
  gSearchInput.focus();
}

function displayFullList() {
  return (gShowAllKeysElement.getAttribute("checked") == "true");
}

function loadkeyList() {
  DEBUG_LOG("enigmailKeyManager.js: loadkeyList\n");

  enigmailBuildList(false);
  showOrHideAllKeys();
  document.getElementById("pleaseWait").hidePopup();
  document.getElementById("statusText").value=" ";
  document.getElementById("progressBar").setAttribute("collapsed", "true");
}

function enigmailRefreshKeys() {
  DEBUG_LOG("enigmailKeyManager.js: enigmailRefreshKeys\n");
  var keyList = enigmailGetSelectedKeys();
  gEnigLastSelectedKeys = [];
  for (var i=0; i<keyList.length; i++) {
    gEnigLastSelectedKeys[keyList[i]] = 1;
  }
  var treeChildren = gTreeChildren;
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
  enigmailBuildList(true);
  enigApplyFilter();
}


function old_enigmail_Build_List_unused(refresh) {
  DEBUG_LOG("enigmailKeyManager.js: enigmailBuildList\n");
  var keyListObj = {};

  EnigLoadKeyList(refresh, keyListObj);

  gKeyList = keyListObj.keyList;
  gKeySortList = keyListObj.keySortList;

  gUserList.currentItem = null;

  var treeChildren = gTreeChildren;

  var selectedItems=[];
  for (var i=0; i < gKeySortList.length; i++) {
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

  if (selectedItems.length>0) {
    gUserList.view.selection.select(selectedItems[0]);
    for (i=1; i<selectedItems.length; i++) {
      gUserList.view.selection.rangedSelect(selectedItems[i], selectedItems[i], true)
    }
  }
}


function enigmailBuildList(refresh) {
  DEBUG_LOG("enigmailKeyManager.js: enigmailBuildList\n");

  var keyListObj = {};

  EnigLoadKeyList(refresh, keyListObj);

  gKeyList = keyListObj.keyList;
  gKeySortList = keyListObj.keySortList;

  gUserList.currentItem = null;

  var treeChildren = gTreeChildren;

  var selectedItems=[];
  for (var i=0; i < gKeySortList.length; i++) {
    var keyId = gKeySortList[i].keyId;
    if (gEnigLastSelectedKeys && typeof(gEnigLastSelectedKeys[keyId]) != "undefined")
      selectedItems.push(i);
    var treeItem=null;
    treeItem=enigUserSelCreateRow(gKeyList[keyId], -1)
    treeItem.setAttribute("container", "true");
    var subChildren = document.createElement("treechildren");
    treeItem.appendChild(subChildren);
    var uidItem = document.createElement("treeitem");
    subChildren.appendChild(uidItem);
    var uidRow=document.createElement("treerow");
    var uidCell=document.createElement("treecell");
    uidCell.setAttribute("label", EnigGetString("keylist.noOtherUids"));
    uidRow.appendChild(uidCell);
    uidItem.appendChild(uidRow);
    uidItem.setAttribute("keytype", "none");
    uidItem.setAttribute("id", keyId);

    var uidChildren = document.createElement("treechildren");
    uidItem.appendChild(uidChildren);
    var uatItem = document.createElement("treeitem");
    uatItem.setAttribute("id", keyId);
    uatItem.setAttribute("keytype", "none");

    subChildren.appendChild(uatItem);
    var uatRow=document.createElement("treerow");
    var uatCell=document.createElement("treecell");
    uatCell.setAttribute("label", EnigGetString("keylist.noPhotos"));
    uatRow.appendChild(uatCell);
    uatItem.appendChild(uatRow);
    var uatChildren = document.createElement("treechildren");
    uatItem.appendChild(uatChildren);

    for (var subkey=0; subkey<gKeyList[keyId].SubUserIds.length; subkey++) {
      var subItem=enigUserSelCreateRow(gKeyList[keyId], subkey);
      if (gKeyList[keyId].SubUserIds[subkey].type == "uat") {
        uatItem.setAttribute("container", "true");
        uatCell.setAttribute("label", EnigGetString("keylist.hasPhotos"));
        uatChildren.appendChild(subItem);
        uatItem.setAttribute("open", "true");
      }
      else {
        uidItem.setAttribute("container", "true");
        uidCell.setAttribute("label", EnigGetString("keylist.hasOtherUids"));
        uidChildren.appendChild(subItem);
        uidItem.setAttribute("open", "true");
      }
    }
    if (treeItem)
      treeChildren.appendChild(treeItem);

  }

  // select last selected key
  if (selectedItems.length>0) {
    gUserList.view.selection.select(selectedItems[0]);
    for (i=1; i<selectedItems.length; i++) {
      gUserList.view.selection.rangedSelect(selectedItems[i], selectedItems[i], true)
    }
  }
  // gUserList.focus();
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
      if (keyObj.SubUserIds[subKeyNum].type == "uat") {
        treeItem.setAttribute("uatNum", keyObj.SubUserIds[subKeyNum].uatNum);
      }
      keyCol.setAttribute("label", "");
      typeCol.setAttribute("label", "");
      keyTrust = keyObj.SubUserIds[subKeyNum].keyTrust;
    }
    var keyTrustLabel = EnigGetTrustLabel(keyTrust);

    var keyTrustStyle="";
    switch (keyTrust) {
    case 'q':
      keyTrustStyle="enigmail_keyValid_unknown";
      break;
    case 'i':
      keyTrustStyle="enigmail_keyValid_invalid";
      break;
    case 'd':
      keyTrustStyle="enigmail_keyValid_disabled";
      break;
    case 'r':
      keyTrustStyle="enigmail_keyValid_revoked";
      break;
    case 'e':
      keyTrustStyle="enigmail_keyValid_expired";
      break;
    case 'n':
      keyTrustStyle="enigmail_keyTrust_untrusted";
      break;
    case 'm':
      keyTrustStyle="enigmail_keyTrust_marginal";
      break;
    case 'f':
      keyTrustStyle="enigmail_keyTrust_full";
      break;
    case 'u':
      keyTrustStyle="enigmail_keyTrust_ultimate";
      break;
    case '-':
    default:
      keyTrustStyle="enigmail_keyTrust_unknown";
      break;
    }

    expCol.setAttribute("label", keyObj.expiry);
    expCol.setAttribute("id", "expiry");

    if (keyObj.keyUseFor.indexOf("D")>=0) {
      keyTrustLabel=EnigGetString("keyValid.disabled");
      keyTrustStyle="enigmail_keyValid_disabled";
    }

    validCol.setAttribute("label", keyTrustLabel);
    validCol.setAttribute("properties", keyTrustStyle);

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
        var attr=node.getAttribute("properties");
        if (typeof(attr)=="string") {
          node.setAttribute("properties", attr+" enigKeyInactive");
        }
        else {
          node.setAttribute("properties", "enigKeyInactive");
        }
      }
    }
    if (keyObj.secretAvailable && subKeyNum <0) {
      for (node=userRow.firstChild; node; node=node.nextSibling) {
        attr=node.getAttribute("properties");
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
    document.getElementById("bcEditKey").removeAttribute("disabled");
  }
  else {
    document.getElementById("bcRevoke").setAttribute("disabled", "true");
    document.getElementById("bcEditKey").setAttribute("disabled", "true");
  }

  if (keyList.length == 1 && gKeyList[keyList[0]].photoAvailable) {
    document.getElementById("bcViewPhoto").removeAttribute("disabled");
  }
  else {
    document.getElementById("bcViewPhoto").setAttribute("disabled", "true");
  }

  if (enigGetClipboard().length > 0) {
    document.getElementById("bcClipbrd").removeAttribute("disabled");
  }
  else {
    document.getElementById("bcClipbrd").setAttribute("disabled", "true");
  }

  if (keyList.length >= 1) {
    document.getElementById("bcEnableKey").removeAttribute("disabled");
    if (gKeyList[keyList[0]].keyUseFor.indexOf("D")>0 ||
        gKeyList[keyList[0]].keyTrust.indexOf(KEY_DISABLED)>=0) {
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.enableKey"));
    }
    else {
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.disableKey"));
    }
  }

  if (keyList.length == 1) {
    document.getElementById("bcSignKey").removeAttribute("disabled");
    document.getElementById("bcViewSig").removeAttribute("disabled");
    document.getElementById("bcOneKey").removeAttribute("disabled");
    document.getElementById("bcDeleteKey").removeAttribute("disabled");
    document.getElementById("bcNoKey").removeAttribute("disabled");
  }
  else {
    if (keyList.length == 0) {
      document.getElementById("bcNoKey").setAttribute("disabled", "true");
      document.getElementById("bcEnableKey").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("bcNoKey").removeAttribute("disabled");
    }
    document.getElementById("bcSignKey").setAttribute("disabled", "true");
    document.getElementById("bcViewSig").setAttribute("disabled", "true");
    document.getElementById("bcOneKey").setAttribute("disabled", "true");
    document.getElementById("bcDeleteKey").setAttribute("disabled", "true");
  }
}


function enigmailOnClick(event) {
  if (event.detail != 2) {
    return;
  }

  // do not propagate double clicks
  event.stopPropagation();

  var keyList = enigmailGetSelectedKeys();
  var keyType="";
  var uatNum="";
  if (keyList.length == 1) {
    var rangeCount = gUserList.view.selection.getRangeCount();
    var start = {};
    var end = {};
    gUserList.view.selection.getRangeAt(0,start,end);
    try {
      keyType = gUserList.view.getItemAtIndex(start.value).getAttribute("keytype");
      uatNum = gUserList.view.getItemAtIndex(start.value).getAttribute("uatNum");
    }
    catch(ex) {}
  }
  if (keyType=="uat") {
    enigShowPhoto(uatNum);
  }
  else {
   enigmailKeyDetails();
  }
}

function enigmailSelectAllKeys() {
  gUserList.view.selection.selectAll();
}

function enigmailKeyDetails() {
  var keyList = enigmailGetSelectedKeys();

  var inputObj = {
    keyId:  keyList[0],
    keyListArr: gKeyList,
    secKey: gKeyList[ keyList[0]].secretAvailable
  };
  var resultObj = { refresh: false };
  window.openDialog("chrome://enigmail/content/enigmailKeyDetailsDlg.xul",
        "", "dialog,modal,centerscreen", inputObj, resultObj);
  if (resultObj.refresh) {
    enigmailRefreshKeys();
  }
}


function enigmailDeleteKey() {
  var keyList = enigmailGetSelectedKeys();
  var deleteSecret=false;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (keyList.length == 1) {
    // one key selected
    var userId="0x"+keyList[0].substr(-8,8)+" - "+gKeyList[keyList[0]].userId;
    if(gKeyList[keyList[0]].secretAvailable) {
      if (!EnigConfirm(EnigGetString("deleteSecretKey", userId), EnigGetString("dlg.button.delete"))) return;
      deleteSecret=true;
    }
    else {
      if (!EnigConfirm(EnigGetString("deletePubKey", userId), EnigGetString("dlg.button.delete"))) return;
    }
  }
  else {
    // several keys selected
    for (var i=0; i<keyList.length; i++) {
      if (gKeyList[keyList[i]].secretAvailable) deleteSecret = true;
    }

    if (deleteSecret) {
      if (!EnigConfirm(EnigGetString("deleteMix"), EnigGetString("dlg.button.delete"))) return;
    }
    else {
      if (!EnigConfirmSring(EnigGetString("deleteSelectedPubKey"), EnigGetString("dlg.button.delete"))) return;
    }
  }

  var errorMsgObj = {};
  var r=enigmailSvc.deleteKey(window, "0x"+keyList.join(" 0x"), deleteSecret, errorMsgObj);
  if (r != 0) {
    EnigAlert(EnigGetString("deleteKeyFailed")+"\n\n"+errorMsgObj.value);
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

  for (var i=0; i<keyList.length; i++) {
    var errorMsgObj = {};
    var r=enigmailSvc.enableDisableKey(window, "0x"+keyList[i], disableKey, errorMsgObj);
    if (r != 0) {
      EnigAlert(EnigGetString("enableKeyFailed")+"\n\n"+errorMsgObj.value);
      break;
    }
  }
  enigmailRefreshKeys();
}

function enigShowPhoto(uatNumber) {
  var keyList = enigmailGetSelectedKeys();

  EnigShowPhoto(keyList[0], gKeyList[keyList[0]].userId, uatNumber);
}

function enigCreateKeyMsg() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }

  var tmpDir=EnigGetTempDir();

  try {
    var tmpFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
    tmpFile.initWithPath(tmpDir);
    if (!(tmpFile.isDirectory() && tmpFile.isWritable())) {
      EnigAlert(EnigGetString("noTempDir"));
      return;
    }
  }
  catch (ex) {}
  tmpFile.append("key.asc");
  tmpFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);

  // save file
  var exitCodeObj= {};
  var errorMsgObj = {};
  enigmailSvc.extractKey(window, 0, "0x"+keyList.join(" 0x"), tmpFile, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value != 0) {
    EnigAlert(errorMsgObj.value);
    return;
  }

  // create attachment
  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
  var tmpFileURI = ioServ.newFileURI(tmpFile);
  var keyAttachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
  keyAttachment.url = tmpFileURI.spec;
  if (keyList.length == 1) {
    keyAttachment.name = "0x"+keyList[0].substr(-8,8)+".asc"
  }
  else {
    keyAttachment.name = "pgpkeys.asc";
  }
  keyAttachment.temporary = true;
  keyAttachment.contentType = "application/pgp-keys";

  // create Msg
  var msgCompFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
  msgCompFields.addAttachment(keyAttachment);

  var acctManager = Components.classes["@mozilla.org/messenger/account-manager;1"].createInstance(Components.interfaces.nsIMsgAccountManager);

  var msgCompSvc = Components.classes["@mozilla.org/messengercompose;1"].getService(Components.interfaces.nsIMsgComposeService);

  var msgCompParam = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
  msgCompParam.composeFields = msgCompFields;
  msgCompParam.identity = acctManager.defaultAccount.defaultIdentity;
  msgCompParam.type = Components.interfaces.nsIMsgCompType.New;
  msgCompParam.format = Components.interfaces.nsIMsgCompFormat.Default;
  msgCompParam.originalMsgURI = "";
  msgCompSvc.OpenComposeWindowWithParams("", msgCompParam);
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

  if (EnigEditKeyTrust(userIdList, keyList)) {
    enigmailRefreshKeys();
  }
}


function enigSignKey() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  if (EnigSignKey(gKeyList[keyList[0]].userId, keyList[0], null)) {
    enigmailRefreshKeys();
  }
}

function enigmailRevokeKey() {
  var keyList = enigmailGetSelectedKeys();
  if (EnigRevokeKey(keyList[0], gKeyList[keyList[0]].userId)) {
    enigmailRefreshKeys();
  }
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
    if (EnigConfirm(EnigGetString("exportSecretKey"), EnigGetString("keyMan.button.exportSecKey"))) {
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
  enigmailSvc.extractKey(window, exportFlags, keyListStr, outFile, exitCodeObj, errorMsgObj);
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
                               [EnigGetString("gnupgFile"), "*.asc;*.gpg;*.pgp"]);
  if (! inFile) return;

  var errorMsgObj = {};
  var exitCode =enigmailSvc.importKeyFromFile(window, inFile.persistentDescriptor, errorMsgObj);
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

  EnigDownloadKeys(inputObj, resultObj);

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
  var resultObj = {};

  window.openDialog("chrome://enigmail/content/enigmailViewKeySigDlg.xul",
        "", "dialog,modal,centerscreen,resizable=yes", inputObj, resultObj);

  if (resultObj.refresh) {
    enigmailRefreshKeys();
  }

}

function enigmailManageUids() {
  var keyList = enigmailGetSelectedKeys();
  var inputObj = {
    keyId: keyList[0],
    ownKey: gKeyList[keyList[0]].secretAvailable
  };
  var resultObj = { refresh: false };
  window.openDialog("chrome://enigmail/content/enigmailManageUidDlg.xul",
        "", "dialog,modal,centerscreen,resizable=yes", inputObj, resultObj);
  if (resultObj.refresh) {
    enigmailRefreshKeys();
  }
}

function enigmailChangePwd() {
  var keyList = enigmailGetSelectedKeys();
  EnigChangeKeyPwd(keyList[0], gKeyList[keyList[0]].userId);
}


function enigGetClipboard() {
  DEBUG_LOG("enigmailKeyManager.js: enigGetClipboard:\n");
  var cBoardContent = "";
  var clipBoard = Components.classes[ENIG_CLIPBOARD_CONTRACTID].getService(Components.interfaces.nsIClipboard);
  try {
    var transferable = Components.classes[ENIG_TRANSFERABLE_CONTRACTID].createInstance(Components.interfaces.nsITransferable);
    transferable.addDataFlavor("text/unicode");
    clipBoard.getData(transferable, clipBoard.kGlobalClipboard);
    var flavour = {};
    var data = {};
    var length = {};
    transferable.getAnyTransferData(flavour, data, length);
    cBoardContent=data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    DEBUG_LOG("enigmailKeyManager.js: enigGetClipboard: got data\n");
  }
  catch(ex) {}
  return cBoardContent;
}

function enigmailImportFromClipbrd() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (!EnigConfirm(EnigGetString("importFromClip"), EnigGetString("keyMan.button.import"))) {
    return;
  }

  var cBoardContent = enigGetClipboard();
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

  EnigDownloadKeys(inputObj, resultObj);

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

function enigmailRefreshAllKeys() {

  EnigAlertPref(EnigGetString("refreshKey.warn"), "warnRefreshAll");
  enigmailKeyServerAcess(nsIEnigmail.REFRESH_KEY, enigmailReceiveKeyCb);
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
    gSearchTimer = setTimeout("onEnterInSearchBar();", 600);
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
  return gTreeChildren.firstChild;
}

function onResetFilter() {
  gFilterBox.value="";
  showOrHideAllKeys();
  /*
  if (! displayFullList()) {
    showOrHideAllKeys();
  }
  else {
    var node=getFirstNode();
    while (node) {
      node.hidden=false;
      node = node.nextSibling;
    }
  } */
  gClearButton.setAttribute("disabled", true);
}

function enigmailToggleShowAll() {
  // gShowAllKeysElement.checked = (! gShowAllKeysElement.checked);
  EnigSetPref("keyManShowAllKeys", displayFullList());

  if (!gSearchInput.value || gSearchInput.value.length==0) {
    showOrHideAllKeys();
  }
}


function showOrHideAllKeys() {
  var hideNode = ! displayFullList();
  var initHint = document.getElementById("emptyTree");
  document.getElementById("nothingFound").hidePopup();
  if (hideNode) {
    initHint.showPopup(gTreeChildren, -1, -1, "tooltip", "after_end", "");
  }
  else {
    initHint.hidePopup();
  }
  var node=getFirstNode();
  while (node) {
    node.hidden= hideNode;
    node = node.nextSibling;
  }
}

function enigApplyFilter() {
  var searchTxt=gSearchInput.value;
  var nothingFoundElem = document.getElementById("nothingFound");
  nothingFoundElem.hidePopup();

  if (!searchTxt || searchTxt.length==0) {
    showOrHideAllKeys();
    return;
  }
  else {
    document.getElementById("emptyTree").hidePopup();
  }

  searchTxt = searchTxt.toLowerCase();
  var foundResult = false;
  var node=getFirstNode();
  while (node) {
    var uid = gKeyList[node.id].userId;
    var hideNode = true;
    if ((uid.toLowerCase().indexOf(searchTxt) >= 0) ||
        (node.id.toLowerCase().indexOf(searchTxt) >= 0)) {
      hideNode = false;
      foundResult = true;
    }
    for (var subUid=0; subUid < gKeyList[node.id].SubUserIds.length; subUid++) {
      uid = gKeyList[node.id].SubUserIds[subUid].userId;
      if (uid.toLowerCase().indexOf(searchTxt) >= 0) {
        hideNode = false;
        foundResult = true;
      }
    }
    node.hidden=hideNode;
    node = node.nextSibling;
  }

  if (! foundResult) {
    nothingFoundElem.showPopup(gTreeChildren, -1, -1, "tooltip", "after_end", "");
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
  var inputObj = {};
  if (accessType == nsIEnigmail.UPLOAD_KEY) {
    inputObj.upload = true;
  }

  var selKeyList = enigmailGetSelectedKeys();
  if (accessType != nsIEnigmail.REFRESH_KEY && selKeyList.length==0) {
    if (EnigConfirm(EnigGetString("refreshAllQuestion"), EnigGetString("keyMan.button.refreshAll"))) {
      accessType = nsIEnigmail.REFRESH_KEY;
      EnigAlertPref(EnigGetString("refreshKey.warn"), "warnRefreshAll");
    }
    else {
      return;
    }
  }

  if (accessType != nsIEnigmail.REFRESH_KEY) {
    var keyList=[];
    for (var i=0; i < selKeyList.length; i++) {
      keyList.push("0x"+selKeyList[i].substr(-8,8)+" - "+ gKeyList[selKeyList[i]].userId);
    }
    inputObj.keyId = keyList.join(", ");
  }
  else {
    inputObj.keyId = "";
  }

  window.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
        "", "dialog,modal,centerscreen", inputObj, resultObj);
  if (! resultObj.value) {
    return;
  }

  var keyDlObj = {
    accessType: accessType,
    keyServer: resultObj.value,
    keyList: "0x"+selKeyList.join(" 0x"),
    cbFunc: callbackFunc
  };

  window.openDialog("chrome://enigmail/content/enigRetrieveProgress.xul",
        "", "dialog,modal,centerscreen", keyDlObj, resultObj);

  if (accessType != nsIEnigmail.UPLOAD_KEY && resultObj.result) {
    enigmailRefreshKeys();
  }
}
