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
 * terms of the GNU General Public License (the "GPL") or the GNU 
 * Lesser General Public License (the "LGPL"), in which case
 * the provisions of the GPL or the LGPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL or the LGPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL or the 
 * LGPL respectively.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL, the
 * GPL or the LGPL.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailSingleRcptSettings");

const INPUT=0;
const RESULT=1;
 
function enigmailDlgOnLoad() {
  var matchBegin=false;
  var matchEnd=false;
  
  var ruleEmail=document.getElementById("ruleEmail");
  if (window.arguments[INPUT].toAddress.indexOf("{")==0) {
    matchBegin=true;
  }
  if (window.arguments[INPUT].toAddress.search(/}$/)>=0) {
    matchEnd=true;
  }

  var matchingRule=document.getElementById("matchingRule");
  if (matchBegin && matchEnd) {
    matchingRule.selectedIndex=0;
  }
  else if (matchBegin) {
    matchingRule.selectedIndex=2;
  }
  else if (matchEnd) {
    matchingRule.selectedIndex=3;
  }
  else {
    matchingRule.selectedIndex=1;
  }
  
  ruleEmail.value = window.arguments[INPUT].toAddress.replace(/[{}]/g, "");
  window.arguments[RESULT].cancelled=true;

  var action="";
  if (typeof(window.arguments[INPUT].keyId)=="object") {
    switch (window.arguments[INPUT].keyId.join("")) {
    case ".":
      enigSetKeys("");
      action="actionStop";
      break;
    case "":
      enigSetKeys("");
      action="actionCont";
      break;
    default:      
      enigSetKeys(window.arguments[INPUT].keyId);
      action="actionUseKey";
    }
  }
  else {
    enigSetKeys("");
    action="actionCont";
  }
  if (window.arguments[INPUT].command=="add") {
    action="actionUseKey";
  }

  var actionType = document.getElementById("actionType");
  actionType.selectedItem = document.getElementById("actionType."+action);
  enigEnableKeySel(action=="actionUseKey");

  if (typeof(window.arguments[INPUT].sign)=="number") {
    document.getElementById("sign").selectedIndex=window.arguments[INPUT].sign;
  }
  else {
    document.getElementById("sign").selectedIndex=1;
  }
  if (typeof(window.arguments[INPUT].encrypt)=="number") {
    document.getElementById("encrypt").selectedIndex=window.arguments[INPUT].encrypt;
  }
  else {
    document.getElementById("encrypt").selectedIndex=1;
  }
  if (typeof(window.arguments[INPUT].pgpmime)=="number") {
    document.getElementById("pgpmime").selectedIndex=window.arguments[INPUT].pgpmime;
  }
  else {
    document.getElementById("pgpmime").selectedIndex=1;
  }
}
 
function enigmailDlgOnAccept() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;

  var keyList="";
  var ruleEmail  = document.getElementById("ruleEmail");
  var matchingRule = document.getElementById("matchingRule").value;
  var matchBegin=false;
  var matchEnd=false;
  switch (Number(matchingRule)) {
  case 0:
    matchBegin=true;
    matchEnd=true;
    break;
  case 2:
    matchBegin=true;
    break;
  case 3:
    matchEnd=true;
    break;
  }
  
  if (ruleEmail.value.length==0) {
    EnigAlert(EnigGetString("noEmptyRule"));
    return false;
  }
  if (ruleEmail.value.search(/[\<\>]/)>=0) {
    EnigAlert(EnigGetString("invalidAddress"));
    return false;
  }
  if (ruleEmail.value.search(/[{}]/)>=0) {
    EnigAlert(EnigGetString("noCurlyBrackets"));
    return false;
  }
  var encryptionList=document.getElementById("encryptionList");
  for (var i=0; i<encryptionList.getRowCount(); i++) {
    var item=encryptionList.getItemAtIndex(i);
    var valueLabel=item.getAttribute("value");
    if (valueLabel.length>0) {
      keyList+=", "+valueLabel;
    }
  }
  var email="";
  var mailAddrs=ruleEmail.value.split(/[ ,]+/);
  for (i=0; i<mailAddrs.length; i++) {
    email += (matchBegin ? " {" : " ") + mailAddrs[i] + (matchEnd ? "}" : "");
  }
  window.arguments[RESULT].email   = email.substr(1);
  window.arguments[RESULT].keyId   = keyList.substr(2);
  window.arguments[RESULT].sign    = document.getElementById("sign").value;
  window.arguments[RESULT].encrypt = document.getElementById("encrypt").value;
  window.arguments[RESULT].pgpMime = document.getElementById("pgpmime").value;
  
  var actionType = document.getElementById("actionType");
  switch(Number(actionType.selectedItem.value)) {
  case 1:
    window.arguments[RESULT].keyId = ".";
    break;
    
  case 2:
    if (keyList == "" && (window.arguments[RESULT].encrypt>0)) {
      if (!EnigConfirm(EnigGetString("noEncryption", ruleEmail.value, ruleEmail.value))) {
        return false;
      }
      window.arguments[RESULT].encrypt = 0;
    }
    break;
  }

  window.arguments[RESULT].cancelled=false;
  if (window.arguments[INPUT].options.indexOf("nosave")<0) {
    enigmailSvc.addRule(window.arguments[RESULT].email,
                        window.arguments[RESULT].keyId,
                        window.arguments[RESULT].sign,
                        window.arguments[RESULT].encrypt,
                        window.arguments[RESULT].pgpMime);
   enigmailSvc.saveRulesFile();
  }
  return true;
}

function enigmailDlgKeySelection() {
  DEBUG_LOG("enigmailMsgComposeHelper.js: enigmailDlgKeySelection: \n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var resultObj = new Object();
  var inputObj = new Object();
  inputObj.dialogHeader = "";
  inputObj.forUser = document.getElementById("ruleEmail").value.replace(/[ ,]+/g, ", ");
  inputObj.toAddr = inputObj.forUser;
  inputObj.toKeys = "";
  var encryptionList=document.getElementById("encryptionList");
  encryptionList.clearSelection();
  for (var i=0; i<encryptionList.getRowCount(); i++) {
    var item=encryptionList.getItemAtIndex(i);
    var valueLabel=item.getAttribute("value");
    if (valueLabel.length>0) {
      inputObj.toKeys += valueLabel+",";
    }
  }
  
  inputObj.options = "multisel,forUser";
  var userIdValue="";

  window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
  try {
    if (resultObj.cancelled) return;
  } catch (ex) {
    // cancel pressed -> do nothing
    return;
  }
  enigSetKeys(resultObj.userList);
}

function enigSetKeys(keyList) {
  var encryptionList=document.getElementById("encryptionList");
  while (encryptionList.getRowCount()>0) {
    encryptionList.removeItemAt(0);
  }
  if ((keyList.length==0) || (keyList.length==1 && keyList[0].length==0)) {
    encryptionList.appendItem(EnigGetString("noKeyToUse"),"");
  }
  else {
    var enigmailSvc = GetEnigmailSvc();
    if (!enigmailSvc)
      return;
      
    var exitCodeObj= new Object;
    var statusFlagsObj = new Object;
    var errorMsgObj = new Object;
    var userListTxt = enigmailSvc.getUserIdList(false,
                                               false,
                                               exitCodeObj,
                                               statusFlagsObj,
                                               errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(errorMsgObj.value);
      return;
    }

    for (var i=0; i<keyList.length; i++) {
      var keyId=keyList[i].substring(2);
      var keyStart=userListTxt.indexOf(":"+keyId+":");
      var keyEnd=userListTxt.substring(keyStart).indexOf("\n");
      var userDescList=userListTxt.substr(keyStart,keyEnd).split(/:/);
     
      encryptionList.appendItem("0x"+keyList[i].substr(10,8)+" ("+userDescList[6]+")",
                                keyList[i]);
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
