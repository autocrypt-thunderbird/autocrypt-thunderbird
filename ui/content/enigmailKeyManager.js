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
  DEBUG_LOG("enigmailKeyManager.js: enigmailKeyManagerLoad\n");
  gUserList = document.getElementById("pgpKeyList");
  gFilterBox = document.getElementById("filterKey");
  gClearButton = document.getElementById("clearFilter");
  gSearchInput = document.getElementById("filterKey");
  window.enigIpcRequest = null;

  document.getElementById("statusText").value = EnigGetString("keyMan.loadingKeys");
  document.getElementById("progressBar").removeAttribute("collapsed");
  window.setTimeout(loadkeyList, 100);
}


function loadkeyList() {
  DEBUG_LOG("enigmailKeyManager.js: loadkeyList\n");

  enigmailBuildList(false);
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
  var treeChildren = document.getElementById("pgpKeyListChildren");
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
  enigmailBuildList(true);
  enigApplyFilter();
}


function enigmailBuildList(refresh) {
  DEBUG_LOG("enigmailKeyManager.js: enigmailBuildList\n");
  var keyListObj = {};

  EnigLoadKeyList(refresh, keyListObj);

  gKeyList = keyListObj.keyList;
  gKeySortList = keyListObj.keySortList;

  gUserList.currentItem=null;

  var treeChildren=document.getElementById("pgpKeyListChildren");

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

  // select last selected key
  if (selectedItems.length>0) {
    gUserList.view.selection.select(selectedItems[0]);
    for (i=1; i<selectedItems.length; i++) {
      gUserList.view.selection.rangedSelect(selectedItems[i], selectedItems[i], true)
    }
  }
  gUserList.focus();
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
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.enableKey"))
    }
    else {
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.disableKey"))
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

function enigmailDblClick(event) {
  if (event) {
    if (event.button != 0) return;
  }
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
    secKey: gKeyList[ keyList[0]].secretAvailable
  };
  window.openDialog("chrome://enigmail/content/enigmailKeyDetailsDlg.xul",
        "", "dialog,modal,centerscreen", inputObj);
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
      if (!EnigConfirm(EnigGetString("deleteSecretKey", userId))) return;
      deleteSecret=true;
    }
    else {
      if (!EnigConfirm(EnigGetString("deletePubKey", userId))) return;
    }
  }
  else {
    // several keys selected
    for (var i=0; i<keyList.length; i++) {
      if (gKeyList[keyList[i]].secretAvailable) deleteSecret = true;
    }

    if (deleteSecret) {
      if (!EnigConfirm(EnigGetString("deleteMix"))) return;
    }
    else {
      if (!EnigConfirm(EnigGetString("deleteSelectedPubKey"))) return;
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
  enigmailSvc.extractKey(window, 0, "0x"+keyList.join(" 0x"), tmpFile.path, exitCodeObj, errorMsgObj);
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

  if (typeof(msgCompSvc.OpenComposeWindowWithCompFields) != "function") {
    // TB 1.5
    var msgCompParam = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
    msgCompParam.composeFields = msgCompFields;
    msgCompParam.identity = acctManager.defaultAccount.defaultIdentity;
    msgCompParam.type = Components.interfaces.nsIMsgCompType.New;
    msgCompParam.format = Components.interfaces.nsIMsgCompFormat.Default;
    msgCompParam.originalMsgURI = "";
    msgCompSvc.OpenComposeWindowWithParams("", msgCompParam);
  }
  else {
    // TB 1.0
    msgCompSvc.OpenComposeWindowWithCompFields ("",
            Components.interfaces.nsIMsgCompType.New,
            Components.interfaces.nsIMsgCompFormat.Default,
            msgCompFields,
            acctManager.defaultAccount.defaultIdentity);
  }
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
    EnigAlert(EnigGetString("revokeKeyFailed")+"\n\n"+EnigConvertGpgToUnicode(errorMsgObj.value).replace(/\\e3A/g, ":"));
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
                               [EnigGetString("gnupgFile"), "*.asc;*.gpg;*.pgp"]);
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

  window.openDialog("chrome://enigmail/content/enigmailManageUidDlg.xul",
        "", "dialog,modal,centerscreen,resizable=yes", inputObj);
  enigmailRefreshKeys();
}

function enigmailChangePwd() {
  var keyList = enigmailGetSelectedKeys();
  var inputObj = {
    keyId: keyList[0],
    userId: gKeyList[keyList[0]].userId
  };

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (! enigmailSvc.useGpgAgent()) {
    window.openDialog("chrome://enigmail/content/enigmailChangePasswd.xul",
        "", "dialog,modal,centerscreen", inputObj);
  }
  else {
    // gpg-agent will handle everything
    var errorMsgObj = new Object();
    var r = enigmailSvc.simpleChangePassphrase(window, keyList[0], errorMsgObj);

    if (r != 0) {
      EnigAlert(EnigGetString("changePassFailed")+"\n\n"+errorMsgObj.value);

    }
  }

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

  if (!EnigConfirm(EnigGetString("importFromClip"))) {
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
  var inputObj = {};
  if (accessType == nsIEnigmail.UPLOAD_KEY) {
    inputObj.upload = true;
  }

  var selKeyList = enigmailGetSelectedKeys();
  if (accessType != nsIEnigmail.REFRESH_KEY && selKeyList.length==0) {
    if (EnigConfirm(EnigGetString("refreshAllQuestion"))) {
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
