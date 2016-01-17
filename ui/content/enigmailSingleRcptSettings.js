/*global EnigInitCommon */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js
/* global EnigInitCommon: false, GetEnigmailSvc: false, EnigAlert: false, EnigGetString: false */
/* global EnigConfirm: false, EnigmailLog: false, EnigmailKeyRing: false */

"use strict";

// Initialize enigmailCommon
EnigInitCommon("enigmailSingleRcptSettings");

const INPUT = 0;
const RESULT = 1;

function enigmailDlgOnLoad() {
  var matchBegin = false;
  var matchEnd = false;

  var ruleEmail = document.getElementById("ruleEmail");
  if (window.arguments[INPUT].toAddress.indexOf("{") === 0) {
    matchBegin = true;
  }
  if (window.arguments[INPUT].toAddress.search(/}$/) >= 0) {
    matchEnd = true;
  }

  var matchingRule = document.getElementById("matchingRule");
  if (matchBegin && matchEnd) {
    matchingRule.selectedIndex = 0;
  }
  else if (matchBegin) {
    matchingRule.selectedIndex = 2;
  }
  else if (matchEnd) {
    matchingRule.selectedIndex = 3;
  }
  else {
    matchingRule.selectedIndex = 1;
  }

  /*
    var negateRule=document.getElementById("negateRule");
    if (typeof(window.arguments[INPUT].negate)=="number") {
      negateRule.selectedIndex = (window.arguments[INPUT].negate ? 1 : 0);
    }
  */
  ruleEmail.value = window.arguments[INPUT].toAddress.replace(/[{}]/g, "");
  window.arguments[RESULT].cancelled = true;

  var action = "";
  if (typeof(window.arguments[INPUT].keyId) == "object") {
    switch (window.arguments[INPUT].keyId.join("")) {
      case ".":
        enigSetKeys("");
        action = "actionStop";
        break;
      case "":
        enigSetKeys("");
        action = "actionCont";
        break;
      default:
        enigSetKeys(window.arguments[INPUT].keyId);
        action = "actionUseKey";
    }
  }
  else {
    enigSetKeys("");
    action = "actionCont";
  }
  if (window.arguments[INPUT].command == "add") {
    action = "actionUseKey";
  }

  var actionType = document.getElementById("actionType");
  actionType.selectedItem = document.getElementById("actionType." + action);
  enigEnableKeySel(action == "actionUseKey");

  if (typeof(window.arguments[INPUT].sign) == "number") {
    document.getElementById("sign").selectedIndex = window.arguments[INPUT].sign;
  }
  else {
    document.getElementById("sign").selectedIndex = 1;
  }
  if (typeof(window.arguments[INPUT].encrypt) == "number") {
    document.getElementById("encrypt").selectedIndex = window.arguments[INPUT].encrypt;
  }
  else {
    document.getElementById("encrypt").selectedIndex = 1;
  }
  if (typeof(window.arguments[INPUT].pgpmime) == "number") {
    document.getElementById("pgpmime").selectedIndex = window.arguments[INPUT].pgpmime;
  }
  else {
    document.getElementById("pgpmime").selectedIndex = 1;
  }
}

function enigmailDlgOnAccept() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;

  var keyList = "";
  var ruleEmail = document.getElementById("ruleEmail");
  var matchingRule = document.getElementById("matchingRule").value;
  var matchBegin = false;
  var matchEnd = false;
  switch (Number(matchingRule)) {
    case 0:
      matchBegin = true;
      matchEnd = true;
      break;
    case 2:
      matchBegin = true;
      break;
    case 3:
      matchEnd = true;
      break;
  }

  // Remove trailing whitespace
  ruleEmail.value = ruleEmail.value.replace(/\s+$/, "").replace(/^\s+/, "");
  if (ruleEmail.value.length === 0) {
    EnigAlert(EnigGetString("noEmptyRule"));
    return false;
  }
  if (ruleEmail.value.search(/[<\>]/) >= 0) {
    EnigAlert(EnigGetString("invalidAddress"));
    return false;
  }
  if (ruleEmail.value.search(/[{}]/) >= 0) {
    EnigAlert(EnigGetString("noCurlyBrackets"));
    return false;
  }
  var encryptionList = document.getElementById("encryptionList");
  for (var i = 0; i < encryptionList.getRowCount(); i++) {
    var item = encryptionList.getItemAtIndex(i);
    var valueLabel = item.getAttribute("value");
    if (valueLabel.length > 0) {
      keyList += ", " + valueLabel;
    }
  }
  var email = "";
  var mailAddrs = ruleEmail.value.split(/[ ,]+/);
  for (let i = 0; i < mailAddrs.length; i++) {
    email += (matchBegin ? " {" : " ") + mailAddrs[i] + (matchEnd ? "}" : "");
  }
  window.arguments[RESULT].email = email.substr(1);
  window.arguments[RESULT].keyId = keyList.substr(2);
  window.arguments[RESULT].sign = document.getElementById("sign").value;
  window.arguments[RESULT].encrypt = document.getElementById("encrypt").value;
  window.arguments[RESULT].pgpMime = document.getElementById("pgpmime").value;
  window.arguments[RESULT].negate = 0; /*Number(document.getElementById("negateRule").value);*/

  var actionType = document.getElementById("actionType");
  switch (Number(actionType.selectedItem.value)) {
    case 1:
      window.arguments[RESULT].keyId = ".";
      break;

    case 2:
      if (keyList === "" && (window.arguments[RESULT].encrypt > 0)) {
        if (!EnigConfirm(EnigGetString("noEncryption", ruleEmail.value, ruleEmail.value))) {
          return false;
        }
        window.arguments[RESULT].encrypt = 0;
      }
      break;
  }

  window.arguments[RESULT].cancelled = false;
  if (window.arguments[INPUT].options.indexOf("nosave") < 0) {
    enigmailSvc.addRule(false,
      window.arguments[RESULT].email,
      window.arguments[RESULT].keyId,
      window.arguments[RESULT].sign,
      window.arguments[RESULT].encrypt,
      window.arguments[RESULT].pgpMime,
      window.arguments[RESULT].negate);
    enigmailSvc.saveRulesFile();
  }
  return true;
}

function enigmailDlgKeySelection() {
  EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: enigmailDlgKeySelection: \n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var resultObj = {};
  var inputObj = {};
  inputObj.dialogHeader = "";
  inputObj.forUser = document.getElementById("ruleEmail").value.replace(/[ ,]+/g, ", ");
  inputObj.toAddr = inputObj.forUser;
  inputObj.toKeys = "";
  var encryptionList = document.getElementById("encryptionList");
  encryptionList.clearSelection();
  for (var i = 0; i < encryptionList.getRowCount(); i++) {
    var item = encryptionList.getItemAtIndex(i);
    var valueLabel = item.getAttribute("value");
    if (valueLabel.length > 0) {
      inputObj.toKeys += valueLabel + ",";
    }
  }

  inputObj.options = "multisel,forUser,noplaintext";
  var button = document.getElementById("encryptionListButton");
  var label = button.getAttribute("label");
  inputObj.options += ",sendlabel=" + label;
  inputObj.options += ",";

  window.openDialog("chrome://enigmail/content/enigmailKeySelection.xul", "", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  try {
    if (resultObj.cancelled) return;
  }
  catch (ex) {
    // cancel pressed -> do nothing
    return;
  }
  enigSetKeys(resultObj.userList);
}

function enigSetKeys(keyList) {
  var encryptionList = document.getElementById("encryptionList");
  while (encryptionList.getRowCount() > 0) {
    encryptionList.removeItemAt(0);
  }
  if ((keyList.length === 0) || (keyList.length == 1 && keyList[0].length === 0)) {
    encryptionList.appendItem(EnigGetString("noKeyToUse"), "");
  }
  else {
    for (let i = 0; i < keyList.length; i++) {

      if (keyList[i].indexOf("GROUP:") === 0) {
        encryptionList.appendItem(keyList[i].substr(6) + " " + EnigGetString("keyTrust.group"), keyList[i]);
      }
      else {
        let keyObj = EnigmailKeyRing.getKeyById(keyList[i]);
        if (keyObj) {
          encryptionList.appendItem("0x" + keyObj.keyId.substr(-8, 8) + " (" + keyObj.userId + ")", keyList[i]);
        }
        else {
          encryptionList.appendItem(keyList[i], keyList[i]);
        }
      }
    }
  }
}

function enigEnableKeySel(enable) {
  if (enable) {
    document.getElementById("encryptionList").removeAttribute("disabled");
    document.getElementById("encryptionListButton").removeAttribute("disabled");
  }
  else {
    document.getElementById("encryptionList").setAttribute("disabled", "true");
    document.getElementById("encryptionListButton").setAttribute("disabled", "true");
  }
}
