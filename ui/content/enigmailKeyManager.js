/*global Components: false, EnigInitCommon: false, EnigmailDialog: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

// Uses: chrome://enigmail/content/enigmailCommon.js:
/* global EnigGetPref: false, EnigGetString: false, EnigFormatFpr: false, EnigGetTrustLabel: false */
/* global GetEnigmailSvc: false, EnigConfirm: false, EnigAlert: false, EnigShowPhoto: false, EnigFilePicker: false */
/* global enigGetService: false, EnigGetTempDir: false, EnigReadFileContents: false, EnigGetLocalFileApi: false, EnigAlertPref: false */
/* global EnigEditKeyTrust: false, EnigEditKeyExpiry: false, EnigSignKey: false, EnigRevokeKey: false, EnigCreateRevokeCert: false */
/* global EnigLongAlert: false, EnigChangeKeyPwd: false, EnigDownloadKeys: false, EnigSetPref: false, EnigGetTrustCode: false */
/* global ENIG_KEY_DISABLED: false, ENIG_KEY_NOT_VALID: false, IOSERVICE_CONTRACTID: false, ENIG_LOCAL_FILE_CONTRACTID: false */

// imported packages
/* global EnigmailLog: false, EnigmailEvents: false, EnigmailKeyRing: false, EnigmailWindows: false, EnigmailKeyEditor: false */
/* global EnigmailKey: false, EnigmailLocale: false, EnigmailPrefs: false, EnigmailConstants: false */

// Initialize enigmailCommon
EnigInitCommon("enigmailKeyManager");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */
Cu.import("resource://enigmail/clipboard.jsm"); /*global EnigmailClipboard: false */
Cu.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("resource://enigmail/stdlib.jsm"); /*global EnigmailStdlib: false */
Cu.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Cu.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Cu.import("resource://enigmail/keyserver.jsm"); /*global EnigmailKeyServer: false */


const INPUT = 0;
const RESULT = 1;

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

var gUserList;
var gKeyList;
var gEnigLastSelectedKeys = null;
var gKeySortList = null;
var gSearchInput = null;
var gShowAllKeysElement = null;
var gTreeChildren = null;
var gShowInvalidKeys = null;
var gShowUntrustedKeys = null;
var gShowOthersKeys = null;
var gPepKeyBlacklist = [];

function enigmailKeyManagerLoad() {
  EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailKeyManagerLoad\n");
  gUserList = document.getElementById("pgpKeyList");
  gSearchInput = document.getElementById("filterKey");
  gShowAllKeysElement = document.getElementById("showAllKeys");
  gTreeChildren = document.getElementById("pgpKeyListChildren");
  gShowInvalidKeys = document.getElementById("showInvalidKeys");
  gShowUntrustedKeys = document.getElementById("showUntrustedKeys");
  gShowOthersKeys = document.getElementById("showOthersKeys");

  window.addEventListener("reload-keycache", reloadKeys);

  if (EnigGetPref("keyManShowAllKeys")) {
    gShowAllKeysElement.setAttribute("checked", "true");
  }

  if (EnigmailPEPAdapter.usingPep()) {
    pEpLoadBlacklist();
  }
  else {
    let c = document.getElementById("pepBlacklistCol");
    c.parentNode.removeChild(c);
  }

  gUserList.addEventListener('click', onListClick, true);
  document.getElementById("bcEnableKey").setAttribute("label", EnigGetString("keyMan.disableKey"));
  document.getElementById("pleaseWait").showPopup(gSearchInput, -1, -1, "tooltip", "after_end", "");
  document.getElementById("statusText").value = EnigGetString("keyMan.loadingKeys");
  document.getElementById("progressBar").removeAttribute("collapsed");
  EnigmailEvents.dispatchEvent(loadkeyList, 100, null);

  gUserList.view = gKeyListView;
  gSearchInput.focus();
}

function displayFullList() {
  return (gShowAllKeysElement.getAttribute("checked") == "true");
}

function loadkeyList() {
  EnigmailLog.DEBUG("enigmailKeyManager.js: loadkeyList\n");

  sortTree();
  gKeyListView.applyFilter(0);
  document.getElementById("pleaseWait").hidePopup();
  document.getElementById("statusText").value = " ";
  document.getElementById("progressBar").setAttribute("collapsed", "true");
}

function clearKeyCache() {
  EnigmailKeyRing.clearCache();
  refreshKeys();
}

function refreshKeys() {
  EnigmailLog.DEBUG("enigmailKeyManager.js: refreshKeys\n");
  var keyList = getSelectedKeys();
  gEnigLastSelectedKeys = [];
  for (var i = 0; i < keyList.length; i++) {
    gEnigLastSelectedKeys[keyList[i]] = 1;
  }

  buildKeyList(true);
}

function reloadKeys() {
  buildKeyList(false);
}

function buildKeyList(refresh) {
  EnigmailLog.DEBUG("enigmailKeyManager.js: buildKeyList\n");

  var keyListObj = {};

  // if (refresh) {
  //   EnigmailKeyRing.clearCache();
  // }

  keyListObj = EnigmailKeyRing.getAllKeys(window, getSortColumn(), getSortDirection());

  if (!keyListObj.keySortList) return;

  if (gUserList.getAttribute("sortResource") === "pepBlacklistCol") {
    let sortDirection = (gUserList.getAttribute("sortDirection") === "ascending" ? 1 : -1);

    keyListObj.keySortList.sort(function(a, b) {
      let i1 = gPepKeyBlacklist.indexOf(a.fpr) >= 0 ? 1 : 0;
      let i2 = gPepKeyBlacklist.indexOf(b.fpr) >= 0 ? 1 : 0;

      return (i1 > i2) ? -sortDirection : sortDirection;
    });
  }

  gKeyList = keyListObj.keyList;
  gKeySortList = keyListObj.keySortList;

  gKeyListView.keysRefreshed();
  return;
}

function getSelectedKeys() {

  let selList = [];
  let rangeCount = gUserList.view.selection.getRangeCount();
  for (let i = 0; i < rangeCount; i++) {
    let start = {};
    let end = {};
    gUserList.view.selection.getRangeAt(i, start, end);
    for (let c = start.value; c <= end.value; c++) {
      try {
        //selList.push(gUserList.view.getItemAtIndex(c).getAttribute("keyNum"));
        selList.push(gKeyListView.getFilteredRow(c).keyNum);
      }
      catch (ex) {
        return [];
      }
    }
  }
  return selList;
}

function getSelectedKeyIds() {
  let keyList = getSelectedKeys();

  let a = [];
  for (let i in keyList) {
    a.push(gKeyList[keyList[i]].keyId);
  }

  return a;
}

function enigmailKeyMenu() {
  var keyList = getSelectedKeys();
  if (keyList.length == 1 && gKeyList[keyList[0]].secretAvailable) {
    document.getElementById("bcRevoke").removeAttribute("collapsed");
    document.getElementById("bcEditKey").removeAttribute("collapsed");
  }
  else {
    document.getElementById("bcRevoke").setAttribute("collapsed", "true");
    document.getElementById("bcEditKey").setAttribute("collapsed", "true");
    document.getElementById("bcUploadToWkd").setAttribute("disabled", "true");
  }

  if (keyList.length == 1 && gKeyList[keyList[0]].photoAvailable) {
    document.getElementById("bcViewPhoto").removeAttribute("collapsed");
  }
  else {
    document.getElementById("bcViewPhoto").setAttribute("collapsed", "true");
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

  if (keyList.length == 1 && gKeyList[keyList[0]].isOwnerTrustUseful()) {
    document.getElementById("bcSetTrust").removeAttribute("collapsed");
  }
  else {
    document.getElementById("bcSetTrust").setAttribute("collapsed", "true");
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


function onListClick(event) {

  if (event.detail > 2) return;

  if (event.type === "click") {
    // Mouse event
    let row = {};
    let col = {};
    let elt = {};
    gUserList.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);

    if (!col.value) // not clicked on a valid column (e.g. scrollbar)
      return;

    if ((event.detail === 1) && (col.value.id === "pepBlacklistCol")) {
      pEpHandleBlacklistClick(row.value);
    }
  }

  if (event.detail != 2) {
    return;
  }

  // do not propagate double clicks
  event.stopPropagation();

  var keyList = getSelectedKeys();
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
  var keyList = getSelectedKeys();
  if (keyList.length > 0) {
    if (EnigmailWindows.openKeyDetails(window, gKeyList[keyList[0]].keyId, false)) {
      refreshKeys();
    }
  }
}

function pEpLoadBlacklist() {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
  EnigmailPEPAdapter.pep.blacklistGetKeyList().then(
    function _ok(retObj) {
      if (retObj && typeof(retObj) === "object" && "result" in retObj) {
        gPepKeyBlacklist = retObj.result.outParams[0].map(
          function _upperCase(x) {
            return x.toUpperCase();
          });
      }

      if (inspector && inspector.eventLoopNestLevel > 0) {
        // unblock the waiting lock in finishCryptoEncapsulation
        inspector.exitNestedEventLoop();
      }
    }
  ).catch(function _err(retObj) {
    gPepKeyBlacklist = [];
    if (inspector && inspector.eventLoopNestLevel > 0) {
      // unblock the waiting lock in finishCryptoEncapsulation
      inspector.exitNestedEventLoop();
    }
  });

  inspector.enterNestedEventLoop(0);
}

function pEpHandleBlacklistClick(rowNum) {
  let action = 0;
  let msg = "";
  let button = "";
  let key;
  let keyList = getSelectedKeys();

  if (keyList.length == 1) {
    key = gKeyList[keyList[0]];
    if (gPepKeyBlacklist.indexOf(key.fpr) >= 0) {
      action = -1;
      msg = EnigmailLocale.getString("keyman.removeBlacklistKey.msg", [key.userId, key.fprFormatted]);
      button = EnigmailLocale.getString("keyman.removeBlacklistKey.button");
    }
    else {
      action = 1;
      msg = EnigmailLocale.getString("keyman.addBlacklistKey.msg", [key.userId, key.fprFormatted]);
      button = EnigmailLocale.getString("keyman.addBlacklistKey.button");
    }
  }
  else return;

  if (EnigmailDialog.confirmDlg(window, msg, button)) {
    let blacklistOp;

    if (action > 0) {
      blacklistOp = EnigmailPEPAdapter.pep.blacklistAddKey.bind(EnigmailPEPAdapter.pep);
    }
    else {
      blacklistOp = EnigmailPEPAdapter.pep.blacklistDeleteKey.bind(EnigmailPEPAdapter.pep);
    }

    blacklistOp(key.fpr).then(function _f(x) {
      EnigmailLog.DEBUG("enigmailKeyManager.js: pEpHandleBlacklistClick: success\n");
      pEpLoadBlacklist();
      gUserList.treeBoxObject.invalidateRow(rowNum);
    }).
    catch(function _err(x) {
      EnigmailLog.DEBUG("enigmailKeyManager.js: pEpHandleBlacklistClick: got Error: " + JSON.stringify(x) + "\n");
    });
  }
}


function enigmailDeleteKey() {
  var keyList = getSelectedKeys();
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
      refreshKeys();
    });
}


function enigmailEnableKey() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var keyList = getSelectedKeys();
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
          refreshKeys();
        }
      }
      else {
        EnigAlert(EnigGetString("enableKeyFailed") + "\n\n" + errorMsg);
        if (keyIndex > 0) refreshKeys();
      }
    });
  }

  processNextKey();
}

function enigShowPhoto() {

  var keyList = getSelectedKeys();
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
  var keyList = getSelectedKeys();

  EnigShowPhoto(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId, uatNumber);
}

function enigmailAddPhoto() {
  var keyList = getSelectedKeys();
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

  var ioServ = enigGetService(IOSERVICE_CONTRACTID, "nsIIOService");
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
      refreshKeys();
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
  var ioServ = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
  var tmpFileURI = ioServ.newFileURI(tmpFile);
  var keyAttachment = Cc["@mozilla.org/messengercompose/attachment;1"].createInstance(Ci.nsIMsgAttachment);
  keyAttachment.url = tmpFileURI.spec;
  if (keyList.length == 1) {
    keyAttachment.name = "0x" + keyList[0] + ".asc";
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

  var keyList = getSelectedKeys();
  if (keyList.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noKeySelected"));
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

  var keyList = getSelectedKeys();
  if (keyList.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noKeySelected"));
    return;
  }
  var userIdList = [];
  var keyIds = [];
  for (var i = 0; i < keyList.length; i++) {
    userIdList.push(gKeyList[keyList[i]].userId);
    keyIds.push(gKeyList[keyList[i]].keyId);
  }

  if (EnigEditKeyTrust(userIdList, keyIds)) {
    refreshKeys();
  }
}

function enigEditKeyExpiry() {

  var keyList = getSelectedKeys();
  if (keyList.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noKeySelected"));
    return;
  }
  var userIdList = [];
  var keyIds = [];
  for (var i = 0; i < keyList.length; i++) {
    userIdList.push(gKeyList[keyList[i]].userId);
    keyIds.push(gKeyList[keyList[i]].keyId);
  }

  if (EnigEditKeyExpiry(userIdList, keyIds)) {
    refreshKeys();
  }
}


function enigSignKey() {
  var keyList = getSelectedKeys();
  if (keyList.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noKeySelected"));
    return;
  }
  if (EnigSignKey(gKeyList[keyList[0]].userId, gKeyList[keyList[0]].keyId, null)) {
    refreshKeys();
  }
}

function enigmailRevokeKey() {
  var keyList = getSelectedKeys();
  EnigRevokeKey(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId, function _revokeKeyCb(success) {
    if (success) refreshKeys();
  });
}

function enigCreateRevokeCert() {
  var keyList = getSelectedKeys();

  EnigCreateRevokeCert(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId);
}


function enigmailExportKeys() {
  var keyList = getSelectedKeys();
  if (keyList.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noKeySelected"));
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
    var r = EnigmailDialog.msgBox(window, {
      msgtext: EnigGetString("exportSecretKey"),
      dialogTitle: EnigGetString("enigConfirm"),
      button1: EnigGetString("keyMan.button.exportPubKey"),
      button2: EnigGetString("keyMan.button.exportSecKey"),
      cancelButton: ":cancel",
      iconType: EnigmailConstants.ICONTYPE_QUESTION
    });
    switch (r) {
      case 0: // export pub key only
        break;
      case 1: // export secret key
        exportSecretKey = true;
        break;
      default: // cancel
        return;
    }
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;
  var defaultFileName;
  if (keyList.length == 1) {

    defaultFileName = gKeyList[keyList[0]].userId.replace(/[<>]/g, "");
    if (exportSecretKey) {
      defaultFileName = EnigGetString("specificPubSecKeyFilename", defaultFileName, gKeyList[keyList[0]].keyId) + ".asc";
    }
    else {
      defaultFileName = EnigGetString("specificPubKeyFilename", defaultFileName, gKeyList[keyList[0]].keyId) + ".asc";
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
    EnigmailDialog.info(window, EnigGetString("saveKeysOK"));
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
      refreshKeys();
    }
  }
  else {
    if (EnigmailKeyRing.getCacheEmpty()) {
      refreshKeys();
    }
  }
}


function enigmailManageUids() {
  var keyList = getSelectedKeys();
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
    refreshKeys();
  }
}

function enigmailChangePwd() {
  var keyList = getSelectedKeys();
  EnigChangeKeyPwd(gKeyList[keyList[0]].keyId, gKeyList[keyList[0]].userId);
}


function enigGetClipboard() {
  return EnigmailClipboard.getClipboardContent(window, Ci.nsIClipboard.kGlobalClipboard);
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
      refreshKeys();
    }
  }
}

function enigmailCopyToClipbrd() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var keyList = getSelectedKeyIds();
  if (keyList.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noKeySelected"));
    return;
  }
  var exitCodeObj = {};
  var errorMsgObj = {};
  var keyData = EnigmailKeyRing.extractKey(0, "0x" + keyList.join(" 0x"), null, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value !== 0) {
    EnigAlert(EnigGetString("copyToClipbrdFailed") + "\n\n" + errorMsgObj.value);
    return;
  }
  if (EnigmailClipboard.setClipboardContent(keyData)) {
    EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailImportFromClipbrd: set clipboard data\n");
    EnigmailDialog.info(window, EnigGetString("copyToClipbrdOK"));
  }
  else {
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
    refreshKeys();
  }
}


function enigmailUploadKeys() {
  enigmailKeyServerAccess(EnigmailConstants.UPLOAD_KEY, enigmailUploadKeysCb);
}

function enigmailUploadKeysCb(exitCode, errorMsg, msgBox) {
  if (msgBox) {
    if (exitCode !== 0) {
      EnigAlert(EnigGetString("sendKeysFailed") + "\n" + errorMsg);
    }
  }
  else {
    return (EnigGetString(exitCode === 0 ? "sendKeysOk" : "sendKeysFailed"));
  }
  return "";
}

function enigmailUploadToWkd() {
  enigmailKeyServerAccess(EnigmailConstants.UPLOAD_WKD, enigmailUploadToWkdCb);
}

function enigmailUploadToWkdCb(exitCode, errorMsg, msgBox) {
  if (msgBox) {
    if (exitCode !== 0) {
      EnigAlert(EnigGetString("sendKeysFailed") + "\n" + errorMsg);
    }
  }
  else {
    return (EnigGetString(exitCode === 0 ? "sendKeysOk" : "sendKeysFailed"));
  }
  return "";
}

function enigmailReceiveKey() {
  enigmailKeyServerAccess(EnigmailConstants.DOWNLOAD_KEY, enigmailReceiveKeyCb);
}

function userAcceptsWarning(warningMessage) {
  if (!EnigGetPref("warnRefreshAll")) {
    return true;
  }

  let checkedObj = {};

  let confirm = EnigmailDialog.msgBox(window, {
      msgtext: warningMessage,
      checkboxLabel: EnigGetString("dlgNoPrompt"),
      button1: EnigGetString("dlg.button.continue"),
      cancelButton: ":cancel",
      iconType: EnigmailConstants.ICONTYPE_QUESTION,
      dialogTitle: EnigmailLocale.getString("enigConfirm")
    },
    checkedObj) === 0;

  if (checkedObj.value)
    EnigSetPref("warnRefreshAll", false);
  return confirm;
}

function userAcceptsRefreshWarning() {
  if (EnigmailPrefs.getPref("keyRefreshOn") === true) {
    return userAcceptsWarning(EnigGetString("refreshKeyServiceOn.warn"));
  }
  return userAcceptsWarning(EnigGetString("refreshKey.warn"));
}

function enigmailRefreshAllKeys() {
  if (userAcceptsRefreshWarning() === true) {
    enigmailKeyServerAccess(EnigmailConstants.REFRESH_KEY, enigmailReceiveKeyCb);
  }
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
    refreshKeys();
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
  EnigmailDialog.info(window, arrayOfMsgText.join("\n"));
}

function enigmailReceiveKeyCb(exitCode, errorMsg, msgBox) {
  EnigmailLog.DEBUG("enigmailKeyManager.js: enigmailReceiveKeyCb\n");
  if (msgBox) {
    if (exitCode === 0) {
      refreshKeys();
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
  var keyList = getSelectedKeys();
  if (keyList.length === 0) {
    EnigmailDialog.info(window, EnigGetString("noKeySelected"));
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
          EnigmailLog.DEBUG("enigmailImportKeysFromUrl: _cbFunc()\n");
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

          var channel = EnigmailStreams.createChannelFromURI(msgUri);
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
        refreshKeys();
      })
      .catch(function(reason) {
        EnigmailDialog.alert(window, EnigGetString("generalError", [reason.value]));
      });
  }
}

function initiateAcKeyTransfer() {
  EnigmailWindows.inititateAcSetupMessage();
}


//
// ----- key filtering functionality  -----
//


function onSearchInput() {
  gKeyListView.applyFilter(0);
}

function enigmailToggleShowAll() {
  EnigSetPref("keyManShowAllKeys", displayFullList());

  if (!gSearchInput.value || gSearchInput.value.length === 0) {
    gKeyListView.applyFilter(0);
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

//
// ----- keyserver related functionality ----
//
function enigmailKeyServerAccess(accessType, callbackFunc) {

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var resultObj = {};
  var selKeyList = getSelectedKeys();
  if (accessType != EnigmailConstants.REFRESH_KEY && selKeyList.length === 0) {
    if (EnigConfirm(EnigGetString("refreshAllQuestion"), EnigGetString("keyMan.button.refreshAll"))) {
      accessType = EnigmailConstants.REFRESH_KEY;
      EnigAlertPref(EnigGetString("refreshKey.warn"), "warnRefreshAll");
    }
    else {
      return;
    }
  }

  var keyList = [];
  for (var i = 0; i < selKeyList.length; i++) {
    keyList.push(gKeyList[selKeyList[i]]);
  }

  EnigmailKeyServer.keyServerUpDownload(window, keyList, accessType, false, callbackFunc, resultObj);

  if (accessType != EnigmailConstants.UPLOAD_KEY && resultObj.result) {
    refreshKeys();
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
  let col = document.getElementById(columnName);
  if (col) {
    col.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    gUserList.setAttribute("sortResource", columnName);
  }
  else {
    gUserList.setAttribute("sortResource", "enigUserNameCol");
  }
  buildKeyList(false);
}


function getSortColumn() {
  switch (gUserList.getAttribute("sortResource")) {
    case "enigUserNameCol":
      return "userid";
    case "keyCol":
      return "keyid";
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

/***************************** TreeView for user list ***********************************/
/**
 * gKeyListView implements the nsITreeView interface for the displayed list.
 *
 * For speed reasons, we use two lists:
 * - keyViewList:   contains the full list of pointers to all  keys and rows that are
 *                  potentially displayed ordered according to the sort column
 * - keyFilterList: contains the indexes to keyViewList of the keys that are displayed
 *                  according to the current filter criteria.
 */
var gKeyListView = {
  keyViewList: [],
  keyFilterList: [],

  //// nsITreeView implementation

  rowCount: 0,
  selection: null,

  canDrop: function(index, orientation, dataTransfer) {
    return false;
  },

  cycleCell: function(row, col) {},
  cycleHeader: function(col) {},
  drop: function(row, orientation, dataTransfer) {},

  getCellProperties: function(row, col) {
    let r = this.getFilteredRow(row);
    if (!r) return "";

    let keyObj = gKeyList[r.keyNum];

    let keyTrustStyle = "";

    switch (r.rowType) {
      case "key":
      case "uid":
      case "uat":
        switch (keyObj.keyTrust) {
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

        if (keyObj.keyUseFor.indexOf("D") >= 0) {
          keyTrustStyle = "enigmail_keyValid_disabled";
        }

        if ((keyObj.keyTrust.length > 0) &&
          (ENIG_KEY_NOT_VALID.indexOf(keyObj.keyTrust.charAt(0)) >= 0) ||
          (keyObj.keyUseFor.indexOf("D") >= 0)) {
          keyTrustStyle += " enigKeyInactive";
        }

        if (r.rowType === "key" && keyObj.secretAvailable) {
          keyTrustStyle += " enigmailOwnKey";
        }
        break;
    }

    return keyTrustStyle;
  },

  getCellText: function(row, col) {

    let r = this.getFilteredRow(row);
    if (!r) return "";
    let keyObj = gKeyList[r.keyNum];

    switch (r.rowType) {
      case "key":
        switch (col.id) {
          case "enigUserNameCol":
            return keyObj.userId;
          case "keyCol":
            return keyObj.keyId;
          case "typeCol":
            if (keyObj.secretAvailable) {
              return EnigmailLocale.getString("keyType.publicAndSec");
            }
            return EnigmailLocale.getString("keyType.public");
          case "validityCol":
            if (keyObj.keyUseFor.indexOf("D") >= 0) {
              return EnigmailLocale.getString("keyValid.disabled");
            }
            return EnigGetTrustLabel(keyObj.keyTrust);
          case "trustCol":
            return EnigGetTrustLabel(keyObj.ownerTrust);
          case "expCol":
            return keyObj.expiry;
          case "fprCol":
            return keyObj.fprFormatted;
        }
        break;
      case "uid":
        switch (col.id) {
          case "enigUserNameCol":
            return keyObj.userIds[r.uidNum].userId;
          case "validityCol":
            if (keyObj.keyUseFor.indexOf("D") >= 0) {
              return EnigmailLocale.getString("keyValid.disabled");
            }
            return EnigGetTrustLabel(keyObj.userIds[r.uidNum].keyTrust);
          case "trustCol":
            return EnigGetTrustLabel(keyObj.ownerTrust);
        }
        break;
      case "uidHdr":
        if (col.id === "enigUserNameCol") {
          return EnigmailLocale.getString("keylist.hasOtherUids");
        }
        break;
      case "noUidHdr":
        if (col.id === "enigUserNameCol") {
          return EnigmailLocale.getString("keylist.noOtherUids");
        }
        break;
      case "uat":
        if (col.id === "enigUserNameCol") {
          return EnigmailLocale.getString("userAtt.photo");
        }
        break;
      case "uatHdr":
        if (col.id === "enigUserNameCol") {
          return EnigmailLocale.getString("keylist.hasPhotos");
        }
        break;
      case "noUatHdr":
        if (col.id === "enigUserNameCol") {
          return EnigmailLocale.getString("keylist.noPhotos");
        }
        break;
    }

    return "";
  },
  getCellValue: function(row, col) {
    return "";
  },
  getColumnProperties: function(col) {
    return "";
  },

  getImageSrc: function(row, col) {
    let r = this.getFilteredRow(row);
    if (!r) return null;
    let keyObj = gKeyList[r.keyNum];

    if (r.rowType === "key" && col.id === "pepBlacklistCol") {
      if (gPepKeyBlacklist.indexOf(keyObj.fpr) >= 0) {
        return "chrome://enigmail/content/check1.png";
      }
      else {
        return "chrome://enigmail/content/check0.png";
      }
    }

    return null;
  },

  /**
   * indentation level for rows
   */
  getLevel: function(row) {
    let r = this.getFilteredRow(row);
    if (!r) return 0;

    switch (r.rowType) {
      case "key":
        return 0;
      case "uidHdr":
      case "noUidHdr":
      case "uatHdr":
      case "noUatHdr":
        return 1;
      case "uid":
      case "uat":
        return 2;
    }

    return 0;
  },

  getParentIndex: function(idx) {
    return -1;
  },
  getProgressMode: function(row, col) {},

  getRowProperties: function(row) {
    return "";
  },
  hasNextSibling(rowIndex, afterIndex) {
    return false;
  },
  isContainer: function(row) {
    let r = this.getFilteredRow(row);
    if (!r) return false;
    switch (r.rowType) {
      case "key":
        return true;
    }

    return false;
  },
  isContainerEmpty: function(row) {
    let r = this.getFilteredRow(row);
    if (!r) return true;
    switch (r.rowType) {
      case "key":
        return false;
      case "uidHdr":
        return r.isOpen;
    }
    return true;
  },
  isContainerOpen: function(row) {
    return this.getFilteredRow(row).isOpen;
  },
  isEditable: function(row, col) {
    return false;
  },
  isSelectable: function(row, col) {
    return true;
  },
  isSeparator: function(index) {
    return false;
  },
  isSorted: function() {
    return false;
  },
  performAction: function(action) {},
  performActionOnCell: function(action, row, col) {},
  performActionOnRow: function(action, row) {},
  selectionChanged: function() {},
  // void setCellText(in long row, in nsITreeColumn col, in AString value);
  // void setCellValue(in long row, in nsITreeColumn col, in AString value);
  setTree: function(treebox) {
    this.treebox = treebox;
  },

  toggleOpenState: function(row) {
    let r = this.getFilteredRow(row);
    if (!r) return;
    let realRow = this.keyFilterList[row];
    switch (r.rowType) {
      case "key":
        if (r.isOpen) {
          let i = 0;
          while (this.getFilteredRow(row + 1 + i) && this.getFilteredRow(row + 1 + i).keyNum === r.keyNum) {
            ++i;
          }

          this.keyViewList.splice(realRow + 1, i);
          r.isOpen = false;
          this.applyFilter(row);
        }
        else {
          let numUid = this.appendUids("uid", r.keyNum, realRow, this.keyViewList[row]);

          if (numUid > 0) {
            this.appendHdr(realRow, "uidHdr", true);
          }
          else {
            this.appendHdr(realRow, "noUidHdr", false);
          }

          let numPhoto = this.appendUids("uat", r.keyNum, realRow + numUid + 1, this.keyViewList[row]);

          if (numPhoto > 0) {
            this.appendHdr(realRow + numUid + 1, "uatHdr", true);
          }
          else {
            this.appendHdr(realRow + numUid + 1, "noUatHdr", false);
          }

          r.isOpen = true;
          this.applyFilter(row);
        }
        break;
    }
  },

  /**
   * add UIDs for a given key to key view
   *
   * @param uidType: String - one of uid (user ID), uat (photo)
   * @param keyNum:  Number - index of key in gKeyList
   * @param realRow: Number - index of row in keyViewList (i.e. without filter)
   *
   * @return Number: number of UIDs added
   */
  appendUids: function(uidType, keyNum, realRow, parentRow) {
    let keyObj = gKeyList[keyNum];
    let uidAdded = 0;

    for (let i = 1; i < keyObj.userIds.length; i++) {
      if (keyObj.userIds[i].type === uidType) {
        ++uidAdded;
        this.keyViewList.splice(realRow + uidAdded, 0, {
          rowType: uidType,
          keyNum: keyNum,
          parent: parentRow,
          uidNum: i
        });
      }
    }

    return uidAdded;
  },

  /**
   * add header row (e.g. "also known as") to tree view
   *
   * @param realRow:     Number - index of row in keyViewList (i.e. without filter)
   * @param headerType:  String - one of uid (user ID), uat (photo)
   * @param hasChildren: Boolean - whether or not there are rows underneath the header
   */
  appendHdr: function(realRow, headerType, hasChildren) {
    let r = this.keyViewList[realRow];
    this.keyViewList.splice(realRow + 1, 0, {
      rowType: headerType,
      isOpen: hasChildren,
      keyNum: r.keyNum,
      parent: this.keyViewList[realRow]
    });
  },


  /**
   * Reload key list entirely
   */
  keysRefreshed: function() {
    this.keyViewList = [];
    this.keyFilterList = [];
    for (let i = 0; i < gKeySortList.length; i++) {
      this.keyViewList.push({
        row: i,
        rowType: "key",
        fpr: gKeySortList[i].fpr,
        keyNum: gKeySortList[i].keyNum,
        isOpen: false
      });
    }

    this.applyFilter(0);
    let oldRowCount = this.rowCount;
    this.rowCount = this.keyViewList.length;
    this.treebox.rowCountChanged(0, this.rowCount - oldRowCount);
  },

  /**
   * If no search term is entered, decide which keys to display
   *
   * @return array of keyNums (= display some keys) or null (= display ALL keys)
   */
  showOrHideAllKeys: function() {
    var hideNode = !displayFullList();
    var initHint = document.getElementById("emptyTree");
    var showInvalidKeys = gShowInvalidKeys.getAttribute("checked") == "true";
    var showUntrustedKeys = gShowUntrustedKeys.getAttribute("checked") == "true";
    var showOthersKeys = gShowOthersKeys.getAttribute("checked") == "true";

    document.getElementById("nothingFound").hidePopup();
    if (hideNode) {
      initHint.showPopup(gTreeChildren, -1, -1, "tooltip", "after_end", "");
      return [];
    }
    else {
      initHint.hidePopup();
    }

    if (showInvalidKeys && showUntrustedKeys && showOthersKeys) {
      return null;
    }

    let keyShowList = [];
    for (let i = 0; i < gKeyList.length; i++) {
      if (determineHiddenKeys(gKeyList[i], showInvalidKeys, showUntrustedKeys, showOthersKeys)) {
        keyShowList.push(i);
      }
    }

    return keyShowList;
  },

  /**
   * Search for keys that match filter criteria
   *
   * @return array of keyNums (= display some keys) or null (= display ALL keys)
   */
  getFilteredKeys: function() {
    let searchTxt = gSearchInput.value;
    let nothingFoundElem = document.getElementById("nothingFound");
    nothingFoundElem.hidePopup();

    if (!searchTxt || searchTxt.length === 0) {
      return this.showOrHideAllKeys();
    }

    if (!gKeyList) return [];
    let showInvalidKeys = gShowInvalidKeys.getAttribute("checked") == "true";
    let showUntrustedKeys = gShowUntrustedKeys.getAttribute("checked") == "true";
    let showOthersKeys = gShowOthersKeys.getAttribute("checked") == "true";

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

    let foundResult = false;
    let keyShowList = [];

    for (let i = 0; i < gKeyList.length; i++) {
      let keyObj = gKeyList[i];
      let uid = keyObj.userId;
      let showKey = false;

      // does a user ID (partially) match?
      for (let idx = 0; idx < keyObj.userIds.length; idx++) {
        uid = keyObj.userIds[idx].userId;
        if (uid.toLowerCase().indexOf(searchTxt) >= 0) {
          showKey = true;
        }
      }

      // does the full fingerprint (without spaces) match?
      // - no partial match check because this is special for the collapsed spaces inside the fingerprint
      if (showKey === false && fpr && keyObj.fpr.toLowerCase() == fpr) {
        showKey = true;
      }
      // does the fingerprint (partially) match?
      if (showKey === false && keyObj.fpr.toLowerCase().indexOf(searchTxt) >= 0) {
        showKey = true;
      }
      // does a sub key of (partially) match?
      if (showKey === false) {
        for (let subKeyIdx = 0; subKeyIdx < keyObj.subKeys.length; subKeyIdx++) {
          let subkey = keyObj.subKeys[subKeyIdx].keyId;
          if (subkey.toLowerCase().indexOf(searchTxt) >= 0) {
            showKey = true;
          }
        }
      }
      // take option to show invalid/untrusted... keys into account
      let hideKey = true;
      if (showKey && determineHiddenKeys(keyObj, showInvalidKeys, showUntrustedKeys, showOthersKeys)) {
        keyShowList.push(i);
        foundResult = true;
      }
    }

    if (!foundResult) {
      nothingFoundElem.showPopup(gTreeChildren, -1, -1, "tooltip", "after_end", "");
    }

    return keyShowList;
  },

  /**
   * Trigger re-displaying the list of keys and apply a filter
   *
   * @param selectedRow: Number - the row that is currently selected or
   *                     clicked on
   */
  applyFilter: function(selectedRow) {
    let keyDisplayList = this.getFilteredKeys();

    this.keyFilterList = [];
    if (keyDisplayList === null) {
      for (let i = 0; i < this.keyViewList.length; i++) {
        this.keyFilterList.push(i);
      }

      this.adjustRowCount(this.keyViewList.length, selectedRow);
    }
    else {
      for (let i = 0; i < this.keyViewList.length; i++) {
        if (keyDisplayList.indexOf(this.keyViewList[i].keyNum) >= 0) {
          this.keyFilterList.push(i);
        }
      }

      this.adjustRowCount(this.keyFilterList.length, selectedRow);
    }
  },

  /**
   * Re-calculate the row count and instruct the view to update
   */

  adjustRowCount: function(newRowCount, selectedRow) {
    if (this.rowCount === newRowCount) {
      this.treebox.invalidate();
      return;
    }

    let delta = newRowCount - this.rowCount;
    this.rowCount = newRowCount;
    this.treebox.rowCountChanged(selectedRow, delta);
  },

  /**
   * Determine the row object from the a filtered row number
   *
   * @param row: Number - row number of displayed (=filtered) list
   *
   * @return Object: keyViewList entry of corresponding row
   */

  getFilteredRow: function(row) {
    let r = this.keyFilterList[row];
    if (r !== undefined) {
      return this.keyViewList[r];
    }
    return null;
  },

  treebox: null
};
