/*global Components: false, EnigInitCommon: false, EnigmailDialog: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

// Uses: chrome://enigmail/content/enigmailCommon.js:
/* global EnigGetPref: false, EnigGetString: false, EnigFormatFpr: false, EnigGetTrustLabel: false, nsIEnigmail: false */
/* global GetEnigmailSvc: false, EnigConfirm: false, EnigAlert: false, EnigShowPhoto: false, EnigFilePicker: false */
/* global enigGetService: false, EnigGetTempDir: false, EnigReadFileContents: false, EnigGetLocalFileApi: false, EnigAlertPref: false */
/* global EnigEditKeyTrust: false, EnigEditKeyExpiry: false, EnigSignKey: false, EnigRevokeKey: false, EnigCreateRevokeCert: false */
/* global EnigLongAlert: false, EnigChangeKeyPwd: false, EnigDownloadKeys: false, EnigSetPref: false, EnigGetTrustCode: false */
/* global ENIG_KEY_DISABLED: false, ENIG_KEY_NOT_VALID: false, ENIG_IOSERVICE_CONTRACTID: false, ENIG_LOCAL_FILE_CONTRACTID: false */
/* global ENIG_CLIPBOARD_CONTRACTID: false, ENIG_TRANSFERABLE_CONTRACTID: false, ENIG_CLIPBOARD_HELPER_CONTRACTID: false */

// imported packages
/* global EnigmailLog: false, EnigmailEvents: false, EnigmailKeyRing: false, EnigmailWindows: false, EnigmailKeyEditor: false */
/* global EnigmailKey: false, EnigmailLocale: false, EnigmailPrefs: false */

// Initialize enigmailCommon
EnigInitCommon("enigmailKeyManager");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Components.utils.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */


const INPUT = 0;
const RESULT = 1;

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

var gUserList;
var gResult;
var gSendEncrypted = true;
var gKeyList;
var gEnigRemoveListener = false;
var gEnigLastSelectedKeys = null;
var gKeySortList = null;
var gEnigIpcRequest = null;
var gEnigCallbackFunc = null;
var gSearchInput = null;
var gShowAllKeysElement = null;
var gTreeChildren = null;
var gShowInvalidKeys = null;
var gShowUntrustedKeys = null;
var gShowOthersKeys = null;

function enigmailKeyManagerLoad() {
  EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailKeyManagerLoad\n");
  gUserList = document.getElementById("pgpKeyList");
  gSearchInput = document.getElementById("filterKey");
  gShowAllKeysElement = document.getElementById("showAllKeys");
  gTreeChildren = document.getElementById("pgpKeyListChildren");
  gShowInvalidKeys = document.getElementById("showInvalidKeys");
  gShowUntrustedKeys = document.getElementById("showUntrustedKeys");
  gShowOthersKeys = document.getElementById("showOthersKeys");

  if (EnigGetPref("keyManShowAllKeys")) {
    gShowAllKeysElement.setAttribute("checked", "true");
  }

  gUserList.addEventListener('click', enigmailOnClick, true);
  document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.disableKey"));

  gEnigIpcRequest = null;

  document.getElementById("pleaseWait").showPopup(gSearchInput, -1, -1, "tooltip", "after_end", "");
  document.getElementById("statusText").value = EnigGetString("keyMan.loadingKeys");
  document.getElementById("progressBar").removeAttribute("collapsed");
  EnigmailEvents.dispatchEvent(loadkeyList, 100, null);
  gSearchInput.focus();
}

function displayFullList() {
  return (gShowAllKeysElement.getAttribute("checked") == "true");
}

function loadkeyList() {
  EnigmailLog.DEBUG("enigmailKeyManager.js: loadkeyList\n");

  //enigmailBuildList(false);
  sortTree();
  showOrHideAllKeys();
  document.getElementById("pleaseWait").hidePopup();
  document.getElementById("statusText").value = " ";
  document.getElementById("progressBar").setAttribute("collapsed", "true");
}

function enigmailRefreshKeys() {
  EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailRefreshKeys\n");
  var keyList = enigmailGetSelectedKeys();
  gEnigLastSelectedKeys = [];
  for (var i = 0; i < keyList.length; i++) {
    gEnigLastSelectedKeys[keyList[i]] = 1;
  }

  enigmailClearTree();
  enigmailBuildList(true);
  enigApplyFilter();
}

function enigmailClearTree() {
  var treeChildren = gTreeChildren;
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
}

function enigmailBuildList(refresh) {
  EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailBuildList\n");

  var keyListObj = {};

  if (refresh) {
    EnigmailKeyRing.clearCache();
  }

  keyListObj = EnigmailKeyRing.getAllKeys(window, getSortColumn(), getSortDirection());

  if (!keyListObj.keySortList) return;

  gKeyList = keyListObj.keyList;
  gKeySortList = keyListObj.keySortList;

  gUserList.currentItem = null;

  var treeChildren = gTreeChildren;

  var selectedItems = [];
  for (var i = 0; i < gKeySortList.length; i++) {
    var keyId = gKeySortList[i].keyId;
    let keyObj = gKeyList[gKeySortList[i].keyNum];
    if (gEnigLastSelectedKeys && typeof(gEnigLastSelectedKeys[keyId]) != "undefined")
      selectedItems.push(i);
    var treeItem = null;
    treeItem = enigUserSelCreateRow(keyObj, -1, gKeySortList[i].keyNum);
    treeItem.setAttribute("container", "true");
    var subChildren = document.createElement("treechildren");
    treeItem.appendChild(subChildren);
    var uidItem = document.createElement("treeitem");
    subChildren.appendChild(uidItem);
    var uidRow = document.createElement("treerow");
    var uidCell = document.createElement("treecell");
    uidCell.setAttribute("label", EnigGetString("keylist.noOtherUids"));
    uidRow.appendChild(uidCell);
    uidItem.appendChild(uidRow);
    uidItem.setAttribute("keytype", "none");
    uidItem.setAttribute("id", keyId);
    uidItem.setAttribute("keyNum", gKeySortList[i].keyNum);

    var uidChildren = document.createElement("treechildren");
    uidItem.appendChild(uidChildren);
    var uatItem = document.createElement("treeitem");
    uatItem.setAttribute("id", keyId);
    uatItem.setAttribute("keyNum", gKeySortList[i].keyNum);
    uatItem.setAttribute("keytype", "none");

    subChildren.appendChild(uatItem);
    var uatRow = document.createElement("treerow");
    var uatCell = document.createElement("treecell");
    uatCell.setAttribute("label", EnigGetString("keylist.noPhotos"));
    uatRow.appendChild(uatCell);
    uatItem.appendChild(uatRow);
    var uatChildren = document.createElement("treechildren");
    uatItem.appendChild(uatChildren);

    for (var subkey = 1; subkey < keyObj.userIds.length; subkey++) {
      var subItem = enigUserSelCreateRow(keyObj, subkey, gKeySortList[i].keyNum);
      if (keyObj.userIds[subkey].type == "uat") {
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
  if (selectedItems.length > 0) {
    gUserList.view.selection.select(selectedItems[0]);
    for (let i = 1; i < selectedItems.length; i++) {
      gUserList.view.selection.rangedSelect(selectedItems[i], selectedItems[i], true);
    }
  }
  // gUserList.focus();
}


// create a (sub) row for the user tree
function enigUserSelCreateRow(keyObj, subKeyNum, keyNum) {
  var expCol = document.createElement("treecell");
  var userCol = document.createElement("treecell");
  var keyCol = document.createElement("treecell");
  var typeCol = document.createElement("treecell");
  var validCol = document.createElement("treecell");
  var trustCol = document.createElement("treecell");
  var fprCol = document.createElement("treecell");
  var userRow = document.createElement("treerow");
  var treeItem = document.createElement("treeitem");
  var keyTrust;

  userCol.setAttribute("id", "name");
  if (subKeyNum < 0) {
    // primary key
    userCol.setAttribute("label", keyObj.userId);
    keyCol.setAttribute("label", keyObj.keyId.substr(-8, 8));
    if (keyObj.secretAvailable) {
      typeCol.setAttribute("label", EnigGetString("keyType.publicAndSec"));
    }
    else {
      typeCol.setAttribute("label", EnigGetString("keyType.public"));
    }
    keyTrust = keyObj.keyTrust;
    treeItem.setAttribute("keytype", "pub");
    fprCol.setAttribute("label", EnigFormatFpr(keyObj.fpr));
  }
  else {
    // secondary user id
    keyObj.userIds[subKeyNum].userId = keyObj.userIds[subKeyNum].userId;
    userCol.setAttribute("label", keyObj.userIds[subKeyNum].userId);
    treeItem.setAttribute("keytype", keyObj.userIds[subKeyNum].type);
    if (keyObj.userIds[subKeyNum].type == "uid")
      treeItem.setAttribute("uidNum", subKeyNum);
    if (keyObj.userIds[subKeyNum].type == "uat") {
      treeItem.setAttribute("uatNum", keyObj.userIds[subKeyNum].uatNum);
    }
    keyCol.setAttribute("label", "");
    typeCol.setAttribute("label", "");
    keyTrust = keyObj.userIds[subKeyNum].keyTrust;
  }
  var keyTrustLabel = EnigGetTrustLabel(keyTrust);

  var keyTrustStyle = "";
  switch (keyTrust) {
    case 'q':
      keyTrustStyle = "enigmail_keyValid_unknown";
      break;
    case 'i':
      keyTrustStyle = "enigmail_keyValid_invalid";
      break;
    case 'd':
      keyTrustStyle = "enigmail_keyValid_disabled";
      break;
    case 'r':
      keyTrustStyle = "enigmail_keyValid_revoked";
      break;
    case 'e':
      keyTrustStyle = "enigmail_keyValid_expired";
      break;
    case 'n':
      keyTrustStyle = "enigmail_keyTrust_untrusted";
      break;
    case 'm':
      keyTrustStyle = "enigmail_keyTrust_marginal";
      break;
    case 'f':
      keyTrustStyle = "enigmail_keyTrust_full";
      break;
    case 'u':
      keyTrustStyle = "enigmail_keyTrust_ultimate";
      break;
    case '-':
      keyTrustStyle = "enigmail_keyTrust_unknown";
      break;
    default:
      keyTrustStyle = "enigmail_keyTrust_unknown";
      break;
  }

  expCol.setAttribute("label", keyObj.expiry);
  expCol.setAttribute("id", "expiry");

  if (keyObj.keyUseFor.indexOf("D") >= 0) {
    keyTrustLabel = EnigGetString("keyValid.disabled");
    keyTrustStyle = "enigmail_keyValid_disabled";
  }

  validCol.setAttribute("label", keyTrustLabel);
  validCol.setAttribute("properties", keyTrustStyle);

  trustCol.setAttribute("label", EnigGetTrustLabel(keyObj.ownerTrust));

  keyCol.setAttribute("id", "keyid");
  typeCol.setAttribute("id", "keyType");
  validCol.setAttribute("id", "keyValid");
  trustCol.setAttribute("id", "ownerTrust");

  userRow.appendChild(userCol);
  userRow.appendChild(keyCol);
  userRow.appendChild(typeCol);
  userRow.appendChild(validCol);
  userRow.appendChild(trustCol);
  userRow.appendChild(expCol);
  userRow.appendChild(fprCol);
  var attr;
  if ((keyTrust.length > 0) &&
    (ENIG_KEY_NOT_VALID.indexOf(keyTrust.charAt(0)) >= 0) ||
    (keyObj.keyUseFor.indexOf("D") >= 0)) {
    for (let node = userRow.firstChild; node; node = node.nextSibling) {
      attr = node.getAttribute("properties");
      if (typeof(attr) == "string") {
        node.setAttribute("properties", attr + " enigKeyInactive");
      }
      else {
        node.setAttribute("properties", "enigKeyInactive");
      }
    }
  }
  if (keyObj.secretAvailable && subKeyNum < 0) {
    for (let node = userRow.firstChild; node; node = node.nextSibling) {
      attr = node.getAttribute("properties");
      if (typeof(attr) == "string") {
        node.setAttribute("properties", attr + " enigmailOwnKey");
      }
      else {
        node.setAttribute("properties", "enigmailOwnKey");
      }
    }
  }
  treeItem.setAttribute("id", keyObj.keyId);
  treeItem.setAttribute("keyNum", keyNum);
  treeItem.appendChild(userRow);
  return treeItem;
}


function enigmailGetSelectedKeys() {

  var selList = [];
  var rangeCount = gUserList.view.selection.getRangeCount();
  for (var i = 0; i < rangeCount; i++) {
    var start = {};
    var end = {};
    gUserList.view.selection.getRangeAt(i, start, end);
    for (var c = start.value; c <= end.value; c++) {
      try {
        selList.push(gUserList.view.getItemAtIndex(c).getAttribute("keyNum"));
      }
      catch (ex) {
        return [];
      }
    }
  }
  return selList;
}

function getSelectedKeyIds() {
  let keyList = enigmailGetSelectedKeys();

  let a = [];
  for (let i in keyList) {
    a.push(gKeyList[keyList[i]].keyId);
  }

  return a;
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
    if (gKeyList[keyList[0]].keyUseFor.indexOf("D") > 0 ||
      gKeyList[keyList[0]].keyTrust.indexOf(ENIG_KEY_DISABLED) >= 0) {
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.enableKey"));
    }
    else {
      document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.disableKey"));
    }
  }

  if (keyList.length == 1) {
    document.getElementById("bcSignKey").removeAttribute("disabled");
    document.getElementById("bcOneKey").removeAttribute("disabled");
    document.getElementById("bcDeleteKey").removeAttribute("disabled");
    document.getElementById("bcNoKey").removeAttribute("disabled");
  }
  else {
    if (keyList.length === 0) {
      document.getElementById("bcNoKey").setAttribute("disabled", "true");
      document.getElementById("bcEnableKey").setAttribute("disabled", "true");
    }
    else {
      document.getElementById("bcNoKey").removeAttribute("disabled");
    }
    document.getElementById("bcSignKey").setAttribute("disabled", "true");
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
  var keyType = "";
  var uatNum = "";
  if (keyList.length == 1) {
    var rangeCount = gUserList.view.selection.getRangeCount();
    var start = {};
    var end = {};
    gUserList.view.selection.getRangeAt(0, start, end);
    try {
      keyType = gUserList.view.getItemAtIndex(start.value).getAttribute("keytype");
      uatNum = gUserList.view.getItemAtIndex(start.value).getAttribute("uatNum");
    }
    catch (ex) {}
  }
  if (keyType == "uat") {
    enigShowSpecificPhoto(Number(uatNum));
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
  if (keyList.length > 0) {
    if (EnigmailWindows.openKeyDetails(window, gKeyList[keyList[0]].keyId, false)) {
      enigmailRefreshKeys();
    }
  }
}


function enigmailDeleteKey() {
  var keyList = enigmailGetSelectedKeys();
  var deleteSecret = false;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (keyList.length == 1) {
    // one key selected
    var userId = gKeyList[keyList[0]].userId;
    if (gKeyList[keyList[0]].secretAvailable) {
      if (!EnigConfirm(EnigGetString("deleteSecretKey", userId), EnigGetString("dlg.button.delete"))) return;
      deleteSecret = true;
    }
    else {
      if (!EnigConfirm(EnigGetString("deletePubKey", userId), EnigGetString("dlg.button.delete"))) return;
    }
  }
  else {
    // several keys selected
    for (var i = 0; i < keyList.length; i++) {
      if (gKeyList[keyList[i]].secretAvailable) deleteSecret = true;
    }

    if (deleteSecret) {
      if (!EnigConfirm(EnigGetString("deleteMix"), EnigGetString("dlg.button.delete"))) return;
    }
    else {
      if (!EnigConfirm(EnigGetString("deleteSelectedPubKey"), EnigGetString("dlg.button.delete"))) return;
    }
  }

  let fprArr = [];
  for (let j in keyList) {
    fprArr.push("0x" + gKeyList[keyList[j]].fpr);
  }

  EnigmailKeyEditor.deleteKey(window, fprArr.join(" "), deleteSecret,
    function(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigAlert(EnigGetString("deleteKeyFailed") + "\n\n" + errorMsg);
        return;
      }
      enigmailRefreshKeys();
    });
}


function enigmailEnableKey() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var keyList = enigmailGetSelectedKeys();
  var disableKey = (gKeyList[keyList[0]].keyUseFor.indexOf("D") < 0 &&
    gKeyList[keyList[0]].keyTrust.indexOf(ENIG_KEY_DISABLED) < 0);

  var keyIndex = 0;

  function processNextKey() {
    EnigmailKeyEditor.enableDisableKey(window, "0x" + gKeyList[keyList[keyIndex]].keyId, disableKey, function _enDisCb(exitCode, errorMsg) {
      if (exitCode === 0) {
        ++keyIndex;
        if (keyIndex < keyList.length) {
          processNextKey();
          return;
        }
        else {
          enigmailRefreshKeys();
        }
      }
      else {
        EnigAlert(EnigGetString("enableKeyFailed") + "\n\n" + errorMsg);
        if (keyIndex > 0) enigmailRefreshKeys();
      }
    });
  }

  processNextKey();
}

function enigShowPhoto() {

  var keyList = enigmailGetSelectedKeys();
  var keyType = "";
  var uatNum = "";
  if (keyList.length == 1) {
    var rangeCount = gUserList.view.selection.getRangeCount();
    var start = {};
    var end = {};
    gUserList.view.selection.getRangeAt(0, start, end);
    try {
      keyType = gUserList.view.getItemAtIndex(start.value).getAttribute("keytype");
      uatNum = gUserList.view.getItemAtIndex(start.value).getAttribute("uatNum");
    }
    catch (ex) {}

    if (keyType == "uat") {
      enigShowSpecificPhoto(uatNum);
      return;
    }
  }

  enigShowSpecificPhoto(null);
}

function enigShowSpecificPhoto(uatNumber) {
  var keyList = enigmailGetSelectedKeys();

  // TODO: fix displaing with uatNumber
  EnigShowPhoto(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId, uatNumber);
}

function enigmailAddPhoto() {
  var keyList = enigmailGetSelectedKeys();
  keyMgrAddPhoto(gKeyList[keyList[0]].userId, gKeyList[keyList[0]].keyId);

}

function keyMgrAddPhoto(userId, keyId) {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;
  var inFile;
  var validFile = false;
  while (!validFile) {
    inFile = EnigFilePicker(EnigGetString("keyMan.addphoto.filepicker.title"),
      "", false, "*.jpg",
      null, ["JPG", "*.jpg", "JPEG", "*.jpeg"]);
    if (!inFile) return;

    var jpgHeader = EnigReadFileContents(inFile, 10);

    validFile = (jpgHeader.charCodeAt(0) == 0xFF &&
      jpgHeader.charCodeAt(1) == 0xD8 &&
      jpgHeader.substr(6, 4) == "JFIF");

    if (!validFile) {
      EnigAlert(EnigGetString("keyMan.addphoto.noJpegFile"));
    }
  }

  if (inFile.fileSize > 25600) {
    // warn if file size > 25 kB
    if (!EnigConfirm(EnigGetString("keyMan.addphoto.warnLargeFile"), EnigGetString("dlg.button.continue"), EnigGetString("dlg.button.cancel")))
      return;
  }

  var ioServ = enigGetService(ENIG_IOSERVICE_CONTRACTID, "nsIIOService");
  var photoUri = ioServ.newFileURI(inFile).spec;
  var argsObj = {
    photoUri: photoUri,
    userId: userId,
    keyId: keyId,
    okPressed: false
  };

  window.openDialog("chrome://enigmail/content/enigmailImportPhoto.xul", inFile, "chrome,modal=1,resizable=1,dialog=1,centerscreen", argsObj);

  if (!argsObj.okPressed) return;

  EnigmailKeyEditor.addPhoto(window, "0x" + keyId, inFile,
    function(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigAlert(EnigGetString("keyMan.addphoto.failed") + "\n\n" + errorMsg);
        return;
      }
      enigmailRefreshKeys();
    });

}

function enigCreateKeyMsg() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var keyList = getSelectedKeyIds();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }

  var tmpDir = EnigGetTempDir();
  var tmpFile;
  try {
    tmpFile = Cc[ENIG_LOCAL_FILE_CONTRACTID].createInstance(EnigGetLocalFileApi());
    tmpFile.initWithPath(tmpDir);
    if (!(tmpFile.isDirectory() && tmpFile.isWritable())) {
      EnigAlert(EnigGetString("noTempDir"));
      return;
    }
  }
  catch (ex) {}
  tmpFile.append("key.asc");
  tmpFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0x180); // equals 0600



  // save file
  var exitCodeObj = {};
  var errorMsgObj = {};
  EnigmailKeyRing.extractKey(false, "0x" + keyList.join(" 0x"), tmpFile, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigAlert(errorMsgObj.value);
    return;
  }

  // create attachment
  var ioServ = Cc[ENIG_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
  var tmpFileURI = ioServ.newFileURI(tmpFile);
  var keyAttachment = Cc["@mozilla.org/messengercompose/attachment;1"].createInstance(Ci.nsIMsgAttachment);
  keyAttachment.url = tmpFileURI.spec;
  if (keyList.length == 1) {
    keyAttachment.name = "0x" + keyList[0].substr(-8, 8) + ".asc";
  }
  else {
    keyAttachment.name = "pgpkeys.asc";
  }
  keyAttachment.temporary = true;
  keyAttachment.contentType = "application/pgp-keys";

  // create Msg
  var msgCompFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
  msgCompFields.addAttachment(keyAttachment);

  var acctManager = Cc["@mozilla.org/messenger/account-manager;1"].createInstance(Ci.nsIMsgAccountManager);

  var msgCompSvc = Cc["@mozilla.org/messengercompose;1"].getService(Ci.nsIMsgComposeService);

  var msgCompParam = Cc["@mozilla.org/messengercompose/composeparams;1"].createInstance(Ci.nsIMsgComposeParams);
  msgCompParam.composeFields = msgCompFields;
  msgCompParam.identity = acctManager.defaultAccount.defaultIdentity;
  msgCompParam.type = Ci.nsIMsgCompType.New;
  msgCompParam.format = Ci.nsIMsgCompFormat.Default;
  msgCompParam.originalMsgURI = "";
  msgCompSvc.OpenComposeWindowWithParams("", msgCompParam);
}

function createNewMail() {

  var keyList = enigmailGetSelectedKeys();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }

  var addresses = [];
  var rangeCount = gUserList.view.selection.getRangeCount();
  var start = {};
  var end = {};
  var keyType, keyNum, r, i;

  for (i = 0; i < rangeCount; i++) {
    gUserList.view.selection.getRangeAt(i, start, end);

    for (r = start.value; r <= end.value; r++) {
      try {
        keyType = gUserList.view.getItemAtIndex(r).getAttribute("keytype");
        keyNum = gUserList.view.getItemAtIndex(r).getAttribute("keyNum");

        if (keyType == "uid") {
          var uidNum = Number(gUserList.view.getItemAtIndex(r).getAttribute("uidNum"));
          addresses.push(gKeyList[keyNum].userIds[uidNum].userId);
        }
        else
          addresses.push(gKeyList[keyNum].userId);
      }
      catch (ex) {}
    }
  }

  // create Msg
  var msgCompFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
  msgCompFields.to = addresses.join(", ");

  var acctManager = Cc["@mozilla.org/messenger/account-manager;1"].createInstance(Ci.nsIMsgAccountManager);

  var msgCompSvc = Cc["@mozilla.org/messengercompose;1"].getService(Ci.nsIMsgComposeService);

  var msgCompParam = Cc["@mozilla.org/messengercompose/composeparams;1"].createInstance(Ci.nsIMsgComposeParams);
  msgCompParam.composeFields = msgCompFields;
  msgCompParam.identity = acctManager.defaultAccount.defaultIdentity;
  msgCompParam.type = Ci.nsIMsgCompType.New;
  msgCompParam.format = Ci.nsIMsgCompFormat.Default;
  msgCompParam.originalMsgURI = "";
  msgCompSvc.OpenComposeWindowWithParams("", msgCompParam);
}

function enigEditKeyTrust() {

  var keyList = enigmailGetSelectedKeys();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  var userIdList = [];
  var keyIds = [];
  for (var i = 0; i < keyList.length; i++) {
    userIdList.push(gKeyList[keyList[i]].userId);
    keyIds.push(gKeyList[keyList[i]].keyId);
  }

  if (EnigEditKeyTrust(userIdList, keyIds)) {
    enigmailRefreshKeys();
  }
}

function enigEditKeyExpiry() {

  var keyList = enigmailGetSelectedKeys();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  var userIdList = [];
  var keyIds = [];
  for (var i = 0; i < keyList.length; i++) {
    userIdList.push(gKeyList[keyList[i]].userId);
    keyIds.push(gKeyList[keyList[i]].keyId);
  }

  if (EnigEditKeyExpiry(userIdList, keyIds)) {
    enigmailRefreshKeys();
  }
}


function enigSignKey() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  if (EnigSignKey(gKeyList[keyList[0]].userId, gKeyList[keyList[0]].keyId, null)) {
    enigmailRefreshKeys();
  }
}

function enigmailRevokeKey() {
  var keyList = enigmailGetSelectedKeys();
  EnigRevokeKey(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId, function _revokeKeyCb(success) {
    if (success) enigmailRefreshKeys();
  });
}

function enigCreateRevokeCert() {
  var keyList = enigmailGetSelectedKeys();

  EnigCreateRevokeCert(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId);
}


function enigmailExportKeys() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }

  // check whether we want to export a private key anywhere in the key list
  var secretFound = false;
  for (var i = 0; i < keyList.length && !secretFound; ++i) {
    if (gKeyList[keyList[i]].secretAvailable) {
      secretFound = true;
    }
  }

  var exportSecretKey = false;
  if (secretFound) {
    // double check that also the pivate keys shall be exportet
    var r = EnigLongAlert(EnigGetString("exportSecretKey"), null,
      EnigGetString("keyMan.button.exportPubKey"),
      EnigGetString("keyMan.button.exportSecKey"),
      ":cancel");
    switch (r) {
      case 0: // export pub key only
        break;
      case 1: // export secret key
        exportSecretKey = true;
        break;
      case 2: // cancel
        return;
    }
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;
  var defaultFileName;
  if (keyList.length == 1) {

    defaultFileName = gKeyList[keyList[0]].userId.replace(/[<\>]/g, "");
    if (exportSecretKey) {
      defaultFileName = EnigGetString("specificPubSecKeyFilename", defaultFileName, gKeyList[keyList[0]].keyId.substr(-8, 8)) + ".asc";
    }
    else {
      defaultFileName = EnigGetString("specificPubKeyFilename", defaultFileName, gKeyList[keyList[0]].keyId.substr(-8, 8)) + ".asc";
    }
  }
  else {
    if (exportSecretKey) {
      defaultFileName = EnigGetString("defaultPubSecKeyFilename") + ".asc";
    }
    else {
      defaultFileName = EnigGetString("defaultPubKeyFilename") + ".asc";
    }
  }

  var FilePickerLabel = "";

  if (exportSecretKey) {
    FilePickerLabel = EnigGetString("exportKeypairToFile");
  }
  else {
    FilePickerLabel = EnigGetString("exportToFile");
  }
  var outFile = EnigFilePicker(FilePickerLabel,
    "", true, "*.asc",
    defaultFileName, [EnigGetString("asciiArmorFile"), "*.asc"]);
  if (!outFile) return;

  var keyListStr = "0x" + getSelectedKeyIds().join(" 0x");
  var exitCodeObj = {};
  var errorMsgObj = {};
  EnigmailKeyRing.extractKey(exportSecretKey, keyListStr, outFile, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigAlert(EnigGetString("saveKeysFailed") + "\n\n" + errorMsgObj.value);
  }
  else {
    EnigAlert(EnigGetString("saveKeysOK"));
  }
}

function enigmailImportKeysFromFile() {

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var inFile = EnigFilePicker(EnigGetString("importKeyFile"),
    "", false, "*.asc", "", [EnigGetString("gnupgFile"), "*.asc;*.gpg;*.pgp"]);
  if (!inFile) return;

  var errorMsgObj = {};
  // preview
  var preview = EnigmailKey.getKeyListFromKeyFile(inFile, errorMsgObj);

  if (errorMsgObj.value && errorMsgObj.value.length > 0) {
    EnigmailDialog.alert(window, errorMsgObj.value);
    return;
  }
  var exitStatus = -1;

  if (preview.length > 0) {
    if (preview.length == 1) {
      exitStatus = EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("doImportOne", [preview[0].name, preview[0].id]));
    }
    else {
      exitStatus = EnigmailDialog.confirmDlg(window,
        EnigmailLocale.getString("doImportMultiple", [
          preview.map(function(a) {
            return "\t" + a.name + " (" + a.id + ")";
          }).
          join("\n")
        ]));
    }

    if (exitStatus) {
      // import
      var keyListObj = {};
      var exitCode = EnigmailKeyRing.importKeyFromFile(inFile, errorMsgObj, keyListObj);
      if (exitCode !== 0) {
        EnigAlert(EnigGetString("importKeysFailed") + "\n\n" + errorMsgObj.value);
      }
      else {
        var keyList = preview.map(function(a) {
          return a.id;
        });
        EnigmailDialog.keyImportDlg(window, keyList);
      }
      enigmailRefreshKeys();
    }
  }
  else {
    if (EnigmailKeyRing.getCacheEmpty()) {
      enigmailRefreshKeys();
    }
  }
}


function enigmailManageUids() {
  var keyList = enigmailGetSelectedKeys();
  var inputObj = {
    keyId: gKeyList[keyList[0]].keyId,
    ownKey: gKeyList[keyList[0]].secretAvailable
  };
  var resultObj = {
    refresh: false
  };
  window.openDialog("chrome://enigmail/content/enigmailManageUidDlg.xul",
    "", "dialog,modal,centerscreen,resizable=yes", inputObj, resultObj);
  if (resultObj.refresh) {
    enigmailRefreshKeys();
  }
}

function enigmailChangePwd() {
  var keyList = enigmailGetSelectedKeys();
  EnigChangeKeyPwd(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId);
}


function enigGetClipboard() {
  EnigmailLog.DEBUG("enigmailKeyManager.js: enigGetClipboard:\n");
  var cBoardContent = "";
  var clipBoard = Cc[ENIG_CLIPBOARD_CONTRACTID].getService(Ci.nsIClipboard);
  try {
    var transferable = Cc[ENIG_TRANSFERABLE_CONTRACTID].createInstance(Ci.nsITransferable);
    transferable.addDataFlavor("text/unicode");
    clipBoard.getData(transferable, clipBoard.kGlobalClipboard);
    var flavour = {};
    var data = {};
    var length = {};
    transferable.getAnyTransferData(flavour, data, length);
    cBoardContent = data.value.QueryInterface(Ci.nsISupportsString).data;
    EnigmailLog.DEBUG("enigmailKeyManager.js: enigGetClipboard: got data\n");
  }
  catch (ex) {}
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
  var preview = EnigmailKey.getKeyListFromKeyBlock(cBoardContent, errorMsgObj);
  var exitStatus = -1;

  if (preview.length > 0) {
    if (preview.length == 1) {
      exitStatus = EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("doImportOne", [preview[0].name, preview[0].id]));
    }
    else {
      exitStatus = EnigmailDialog.confirmDlg(window,
        EnigmailLocale.getString("doImportMultiple", [
          preview.map(function(a) {
            return "\t" + a.name + " (" + a.id + ")";
          }).
          join("\n")
        ]));
    }

    if (exitStatus) {
      // import
      var r = EnigmailKeyRing.importKey(window, false, cBoardContent, "", errorMsgObj);
      var keyList = preview.map(function(a) {
        return a.id;
      });
      EnigmailDialog.keyImportDlg(window, keyList);
      //EnigLongAlert(errorMsgObj.value);
      enigmailRefreshKeys();
    }
  }
}

function enigmailCopyToClipbrd() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var keyList = getSelectedKeyIds();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  var exitCodeObj = {};
  var errorMsgObj = {};
  var keyData = EnigmailKeyRing.extractKey(0, "0x" + keyList.join(" 0x"), null, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigAlert(EnigGetString("copyToClipbrdFailed") + "\n\n" + errorMsgObj.value);
    return;
  }
  var clipBoard = Cc[ENIG_CLIPBOARD_CONTRACTID].getService(Ci.nsIClipboard);
  try {
    let clipBoardHlp = Cc[ENIG_CLIPBOARD_HELPER_CONTRACTID].getService(Ci.nsIClipboardHelper);
    clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kGlobalClipboard);
    if (clipBoard.supportsSelectionClipboard()) {
      clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kSelectionClipboard);
    }
    EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailImportFromClipbrd: got data from clipboard");
    EnigAlert(EnigGetString("copyToClipbrdOK"));
  }
  catch (ex) {
    EnigAlert(EnigGetString("copyToClipbrdFailed"));
  }

}

function enigmailSearchKey() {
  var inputObj = {
    searchList: null
  };
  var resultObj = {};

  EnigDownloadKeys(inputObj, resultObj);

  if (resultObj.importedKeys > 0) {
    enigmailRefreshKeys();
  }
}


function enigmailUploadKeys() {
  enigmailKeyServerAccess(nsIEnigmail.UPLOAD_KEY, enigmailUploadKeysCb);
}

function enigmailUploadKeysCb(exitCode, errorMsg, msgBox) {
  if (msgBox) {
    if (exitCode !== 0) {
      EnigLongAlert(EnigGetString("sendKeysFailed") + "\n" + errorMsg);
    }
  }
  else {
    return (EnigGetString(exitCode === 0 ? "sendKeysOk" : "sendKeysFailed"));
  }
  return "";
}

function enigmailReceiveKey() {
  enigmailKeyServerAccess(nsIEnigmail.DOWNLOAD_KEY, enigmailReceiveKeyCb);
}

function enigmailRefreshAllKeys() {
  var checkedObj = {};
  var doIt = false;
  if (!EnigGetPref("warnRefreshAll")) {
    doIt = true;
  }
  else if (EnigLongAlert(EnigGetString("refreshKey.warn"), EnigGetString("dlgNoPrompt"),
      EnigGetString("dlg.button.continue"), ":cancel", null, checkedObj) === 0) {
    if (checkedObj.value) {
      EnigSetPref("warnRefreshAll", false);
    }
    doIt = true;
  }

  if (doIt) enigmailKeyServerAccess(nsIEnigmail.REFRESH_KEY, enigmailReceiveKeyCb);
}

// Iterate through contact emails and download them
function enigmailDowloadContactKeysEngine() {
  let abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);

  let allAddressBooks = abManager.directories;
  let emails = [];

  while (allAddressBooks.hasMoreElements()) {
    let addressBook = allAddressBooks.getNext().QueryInterface(Ci.nsIAbDirectory);

    if (addressBook instanceof Ci.nsIAbDirectory) { // or nsIAbItem or nsIAbCollection
      // ask for confirmation for each address book:
      var doIt = EnigmailDialog.confirmDlg(window,
        EnigGetString("downloadContactsKeys.importFrom", addressBook.dirName),
        EnigGetString("dlgYes"),
        EnigGetString("dlg.button.skip"));
      if (!doIt) {
        continue; // SKIP this address book
      }

      let allChildCards = addressBook.childCards;

      while (allChildCards.hasMoreElements()) {

        let card = allChildCards.getNext().QueryInterface(Ci.nsIAbCard);

        try {
          let email = card.getPropertyAsAString("PrimaryEmail");
          if (email && email.indexOf("@") >= 0) {
            emails.push(email);
          }
        }
        catch (e) {}

        try {
          let email = card.getPropertyAsAString("SecondEmail");
          if (email && email.indexOf("@") >= 0) {
            emails.push(email);
          }
        }
        catch (e) {}

      }
    }
  }

  // list of emails might be emoty here, in which case we do nothing
  if (emails.length <= 0) {
    return;
  }

  // sort the e-mail array
  emails.sort();

  //remove duplicates
  var i = 0;
  while (i < emails.length - 1) {
    if (emails[i] == emails[i + 1]) {
      emails.splice(i, 1);
    }
    else {
      i = i + 1;
    }
  }

  var inputObj = {
    searchList: emails,
    autoKeyServer: EnigmailPrefs.getPref("autoKeyServerSelection") ? EnigmailPrefs.getPref("keyserver").split(/[ ,;]/g)[0] : null
  };
  var resultObj = {};

  EnigmailWindows.downloadKeys(window, inputObj, resultObj);

  if (resultObj.importedKeys > 0) {
    enigmailRefreshKeys();
  }
}

function enigmailDownloadContactKeys() {

  var doIt = EnigmailDialog.confirmPref(window,
    EnigGetString("downloadContactsKeys.warn"),
    "warnDownloadContactKeys",
    EnigGetString("dlg.button.continue"),
    EnigGetString("dlg.button.cancel"));

  if (doIt) enigmailDowloadContactKeysEngine();
}

function displayResult(arrayOfMsgText) {
  EnigLongAlert(arrayOfMsgText.join("\n"));
}

function enigmailReceiveKeyCb(exitCode, errorMsg, msgBox) {
  EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailReceiveKeyCb\n");
  if (msgBox) {
    if (exitCode === 0) {
      enigmailRefreshKeys();
      EnigmailEvents.dispatchEvent(displayResult, 100, [EnigGetString("receiveKeysOk"), errorMsg]);
    }
    else {
      EnigmailEvents.dispatchEvent(displayResult, 100, [EnigGetString("receiveKeysFailed"), errorMsg]);
    }
  }
  else {
    return (EnigGetString(exitCode === 0 ? "receiveKeysOk" : "receiveKeysFailed"));
  }
  return "";
}


function addToPRRule() {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length === 0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var inputObj = {
    keyId: gKeyList[keyList[0]].keyId,
    userId: gKeyList[keyList[0]].userId
  };
  window.openDialog("chrome://enigmail/content/enigmailSelectRule.xul",
    "", "dialog,modal,centerscreen", inputObj);

}

function enigmailImportKeysFromUrl() {
  var value = {
    "value": ""
  };
  if (EnigmailDialog.promptValue(window, EnigGetString("importFromUrl"), value)) {
    var p = new Promise(
      function(resolve, reject) {
        var cbFunc = function _cb(data) {
          EnigmailLog.DEBUG("enigmailImportKeysFromUrl: _cbFunc()");
          var errorMsgObj = {};

          // preview
          var preview = EnigmailKey.getKeyListFromKeyBlock(data, errorMsgObj);
          var exitStatus = -1;

          if (preview.length > 0) {
            if (preview.length == 1) {
              exitStatus = EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("doImportOne", [preview[0].name, preview[0].id]));
            }
            else {
              exitStatus = EnigmailDialog.confirmDlg(window,
                EnigmailLocale.getString("doImportMultiple", [
                  preview.map(function(a) {
                    return "\t" + a.name + " (" + a.id + ")";
                  }).
                  join("\n")
                ]));
            }

            if (exitStatus) {
              EnigmailKeyRing.importKey(window, false, data, "", errorMsgObj);
              errorMsgObj.preview = preview;
              resolve(errorMsgObj);
            }
          }
        };

        try {
          var bufferListener = EnigmailStreams.newStringStreamListener(cbFunc);
          var ioServ = Cc[IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
          var msgUri = ioServ.newURI(value.value, null, null);

          var channel = ioServ.newChannelFromURI(msgUri);
          channel.asyncOpen(bufferListener, msgUri);
        }
        catch (ex) {
          var err = {
            value: ex
          };
          reject(err);
        }
      }
    );

    p.then(function(errorMsgObj) {
        var keyList = errorMsgObj.preview.map(function(a) {
          return a.id;
        });
        EnigmailDialog.keyImportDlg(window, keyList);
        enigmailRefreshKeys();
      })
      .catch(function(reason) {
        EnigLongAlert("Error: " + reason.value);
      });
  }
}

//
// ----- key filtering functionality  -----
//


function onSearchInput() {
  if (gSearchInput.value === "") {
    onResetFilter();
    return;
  }
  enigApplyFilter();
}

function getFirstNode() {
  return gTreeChildren.firstChild;
}

function onResetFilter() {
  gSearchInput.value = "";
  showOrHideAllKeys();
}

function enigmailToggleShowAll() {
  // gShowAllKeysElement.checked = (! gShowAllKeysElement.checked);
  EnigSetPref("keyManShowAllKeys", displayFullList());

  if (!gSearchInput.value || gSearchInput.value.length === 0) {
    showOrHideAllKeys();
  }
}


function showOrHideAllKeys() {
  var hideNode = !displayFullList();
  var initHint = document.getElementById("emptyTree");
  var showInvalidKeys = gShowInvalidKeys.getAttribute("checked") == "true";
  var showUntrustedKeys = gShowUntrustedKeys.getAttribute("checked") == "true";
  var showOthersKeys = gShowOthersKeys.getAttribute("checked") == "true";

  document.getElementById("nothingFound").hidePopup();
  if (hideNode) {
    initHint.showPopup(gTreeChildren, -1, -1, "tooltip", "after_end", "");
  }
  else {
    initHint.hidePopup();
  }
  var node = getFirstNode();
  while (node) {
    node.hidden = hideNode;
    if (!determineHiddenKeys(gKeyList[node.getAttribute("keyNum")], showInvalidKeys, showUntrustedKeys, showOthersKeys)) {
      node.hidden = true;
    }

    node = node.nextSibling;
  }
}

function determineHiddenKeys(keyObj, showInvalidKeys, showUntrustedKeys, showOthersKeys) {
  var show = true;

  const INVALID_KEYS = "ierdD";
  const UNTRUSTED_KEYS = "n-";

  if ((!showInvalidKeys) && INVALID_KEYS.indexOf(EnigGetTrustCode(keyObj)) >= 0) show = false;
  if ((!showUntrustedKeys) && UNTRUSTED_KEYS.indexOf(keyObj.ownerTrust) >= 0) show = false;
  if ((!showOthersKeys) && (!keyObj.secretAvailable)) show = false;

  return show;
}

function enigApplyFilter() {
  var searchTxt = gSearchInput.value;
  var nothingFoundElem = document.getElementById("nothingFound");
  nothingFoundElem.hidePopup();
  var showInvalidKeys = gShowInvalidKeys.getAttribute("checked") == "true";
  var showUntrustedKeys = gShowUntrustedKeys.getAttribute("checked") == "true";
  var showOthersKeys = gShowOthersKeys.getAttribute("checked") == "true";

  if (!searchTxt || searchTxt.length === 0) {
    showOrHideAllKeys();
    return;
  }
  document.getElementById("emptyTree").hidePopup();

  // skip leading 0x in case we search for a key:
  if (searchTxt.length > 2 && searchTxt.substr(0, 2).toLowerCase() == "0x") {
    searchTxt = searchTxt.substr(2);
  }

  searchTxt = searchTxt.toLowerCase();
  searchTxt = searchTxt.replace(/^(\s*)(.*)/, "$2").replace(/\s+$/, ""); // trim spaces

  // check if we search for a full fingerprint (with optional spaces every 4 letters)
  var fpr = null;
  if (searchTxt.length == 49) { // possible fingerprint with spaces?
    if (searchTxt.search(/^[0-9a-f ]*$/) >= 0 && searchTxt[4] == ' ' && searchTxt[9] == ' ' && searchTxt[14] == ' ' &&
      searchTxt[19] == ' ' && searchTxt[24] == ' ' && searchTxt[29] == ' ' &&
      searchTxt[34] == ' ' && searchTxt[39] == ' ' && searchTxt[44] == ' ') {
      fpr = searchTxt.replace(/ /g, "");
    }
  }
  else if (searchTxt.length == 40) { // possible fingerprint without spaces
    if (searchTxt.search(/^[0-9a-f ]*$/) >= 0) {
      fpr = searchTxt;
    }
  }

  var foundResult = false;
  var node = getFirstNode();
  while (node) {
    let keyObj = gKeyList[node.getAttribute("keyNum")];
    var uid = keyObj.userId;
    var showNode = false;

    // does a user ID (partially) match?
    for (let idx = 0; idx < keyObj.userIds.length; idx++) {
      uid = keyObj.userIds[idx].userId;
      if (uid.toLowerCase().indexOf(searchTxt) >= 0) {
        showNode = true;
      }
    }

    // does the full fingerprint (without spaces) match?
    // - no partial match check because this is special for the collapsed spaces inside the fingerprint
    if (showNode === false && fpr && keyObj.fpr.toLowerCase() == fpr) {
      showNode = true;
    }
    // does the fingerprint (partially) match?
    if (showNode === false && keyObj.fpr.toLowerCase().indexOf(searchTxt) >= 0) {
      showNode = true;
    }
    // does a sub key of (partially) match?
    if (showNode === false) {
      for (let subKeyIdx = 0; subKeyIdx < keyObj.subKeys.length; subKeyIdx++) {
        let subkey = keyObj.subKeys[subKeyIdx].keyId;
        if (subkey.toLowerCase().indexOf(searchTxt) >= 0) {
          showNode = true;
        }
      }
    }
    // take option to show invalid/untrusted... keys into account
    var hideNode = true;
    if (showNode && determineHiddenKeys(keyObj, showInvalidKeys, showUntrustedKeys, showOthersKeys)) {
      hideNode = false;
      foundResult = true;
    }
    node.hidden = hideNode;
    node = node.nextSibling;
  }

  if (!foundResult) {
    nothingFoundElem.showPopup(gTreeChildren, -1, -1, "tooltip", "after_end", "");
  }
}

//
// ----- keyserver related functionality ----
//
function enigmailKeyServerAccess(accessType, callbackFunc) {

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var resultObj = {};
  var inputObj = {};
  if (accessType == nsIEnigmail.UPLOAD_KEY) {
    inputObj.upload = true;
  }

  var selKeyList = enigmailGetSelectedKeys();
  if (accessType != nsIEnigmail.REFRESH_KEY && selKeyList.length === 0) {
    if (EnigConfirm(EnigGetString("refreshAllQuestion"), EnigGetString("keyMan.button.refreshAll"))) {
      accessType = nsIEnigmail.REFRESH_KEY;
      EnigAlertPref(EnigGetString("refreshKey.warn"), "warnRefreshAll");
    }
    else {
      return;
    }
  }

  var keyList = [];
  var keyIds = [];
  for (var i = 0; i < selKeyList.length; i++) {
    //keyList.push("0x" + gKeyList[selKeyList[i]].keyId.substr(-8, 8) + " - " + gKeyList[selKeyList[i]].userId);
    keyIds.push(gKeyList[selKeyList[i]].keyId);
  }
  if (accessType != nsIEnigmail.REFRESH_KEY) {
    inputObj.keyId = keyIds.join(", ");
  }
  else {
    inputObj.keyId = "";
  }

  let autoKeyServer = EnigmailPrefs.getPref("autoKeyServerSelection") ? EnigmailPrefs.getPref("keyserver").split(/[ ,;]/g)[0] : null;
  if (autoKeyServer) {
    resultObj.value = autoKeyServer;
  }
  else {
    window.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
      "", "dialog,modal,centerscreen", inputObj, resultObj);
  }

  if (!resultObj.value) {
    return;
  }

  var keyDlObj = {
    accessType: accessType,
    keyServer: resultObj.value,
    keyList: "0x" + keyIds.join(" 0x"),
    cbFunc: callbackFunc
  };

  window.openDialog("chrome://enigmail/content/enigRetrieveProgress.xul",
    "", "dialog,modal,centerscreen", keyDlObj, resultObj);

  if (accessType != nsIEnigmail.UPLOAD_KEY && resultObj.result) {
    enigmailRefreshKeys();
  }
}

function getSortDirection() {
  return gUserList.getAttribute("sortDirection") == "ascending" ? 1 : -1;
}

function sortTree(column) {

  var columnName;
  var order = getSortDirection();

  //if the column is passed and it's already sorted by that column, reverse sort
  if (column) {
    columnName = column.id;
    if (gUserList.getAttribute("sortResource") == columnName) {
      order *= -1;
    }
    else {
      document.getElementById(gUserList.getAttribute("sortResource")).removeAttribute("sortDirection");
      order = 1;
    }
  }
  else {
    columnName = gUserList.getAttribute("sortResource");
  }
  gUserList.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
  gUserList.setAttribute("sortResource", columnName);
  document.getElementById(columnName).setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
  enigmailClearTree();
  enigmailBuildList(false);
  enigApplyFilter();
}


function getSortColumn() {
  switch (gUserList.getAttribute("sortResource")) {
    case "enigUserNameCol":
      return "userid";
    case "keyCol":
      return "keyidshort";
    case "typeCol":
      return "keytype";
    case "validityCol":
      return "validity";
    case "trustCol":
      return "trust"; // ownerTrust
    case "expCol":
      return "expiry";
    case "fprCol":
      return "fpr";
    default:
      return "?";
  }
}
