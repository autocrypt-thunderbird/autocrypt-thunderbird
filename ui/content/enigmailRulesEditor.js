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
EnigInitCommon("enigmailRulesEditor");

const INPUT=0;
const RESULT=1;
 
var gSearchTimer = null;
var gSearchInput = null;
var gClearButton = null;
var gNumRows = null;

function enigmailDlgOnLoad() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var rulesListObj=new Object;
  if (enigmailSvc.getRulesData(rulesListObj)) {
    var treeChildren=document.getElementById("rulesTreeChildren");
    var rulesList=rulesListObj.value;
        if (rulesList.firstChild.nodeName=="parsererror") {
      EnigAlert("Invalid enigmail.xml file:\n"+ rulesList.firstChild.textContent);
      return;
    }
    DEBUG_LOG("enigmailRulesEditor.js: dlgOnLoad: keys loaded\n");
    gNumRows=0;
    var node=rulesList.firstChild.firstChild;
    while (node) {
      if (node.tagName=="pgpRule") {
        //try {
          var userObj={ 
                email: node.getAttribute("email"),
                keyId: node.getAttribute("keyId"),
                sign: node.getAttribute("sign"),
                encrypt: node.getAttribute("encrypt"),
                pgpMime: node.getAttribute("pgpMime")
              };
          var treeItem=document.createElement("treeitem");
          createRow(treeItem, userObj);
          treeChildren.appendChild(treeItem);
        //}
        //catch (ex) {}
      }
      node = node.nextSibling;
    }
  }
  var rulesTree=document.getElementById("rulesTree");
  gSearchInput = document.getElementById("filterEmail");
  gClearButton = document.getElementById("clearButton");

}

function enigmailDlgOnAccept() {
  DEBUG_LOG("enigmailRulesEditor.js: dlgOnAccept:\n");
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;
  enigmailSvc.clearRules();
  
  var node=getFirstNode();
  while(node) {
    enigmailSvc.addRule(true,
                        node.getAttribute("email"),
                        node.getAttribute("keyId"),
                        node.getAttribute("sign"),
                        node.getAttribute("encrypt"),
                        node.getAttribute("pgpMime"));
    node = node.nextSibling;
  }
  enigmailSvc.saveRulesFile();
  
  return true;
}

function createCol(value, label, treeItem, translate) {
  var column=document.createElement("treecell");
  column.setAttribute("id", value);
  treeItem.setAttribute(value, label);
  switch (value) {
  case "sign":
  case "encrypt":
  case "pgpMime":
    switch (Number(label)) {
    case 0: 
      label=EnigGetString("never");
      break;
    case 1: 
      label=EnigGetString("possible");
      break;
    case 2: 
      label=EnigGetString("always");
      break;
    }
    break;
  case "keyId":
    if (label==".") {
      label=EnigGetString("nextRcpt");
    }
  }
  column.setAttribute("label", label);
  return column;
}

function createRow(treeItem, userObj) {
  var email=createCol("email", userObj.email, treeItem);
  var keyId=createCol("keyId", userObj.keyId, treeItem);
  var sign=createCol("sign", userObj.sign, treeItem);
  var encrypt=createCol("encrypt", userObj.encrypt, treeItem);
  var pgpMime=createCol("pgpMime", userObj.pgpMime, treeItem);
  var treeRow=document.createElement("treerow");
  treeRow.appendChild(email);
  treeRow.appendChild(keyId);
  treeRow.appendChild(sign);
  treeRow.appendChild(encrypt);
  treeRow.appendChild(pgpMime);
  treeRow.setAttribute("rowId", ++gNumRows);
  
  if (treeItem.firstChild) {
    treeItem.replaceChild(treeRow, treeItem.firstChild);
  }
  else {
    treeItem.appendChild(treeRow);
  }
}

function getFirstNode() {
  return document.getElementById("rulesTreeChildren").firstChild;
}
  
function getCurrentNode() {
  var rulesTree=document.getElementById("rulesTree");
  return rulesTree.contentView.getItemAtIndex(rulesTree.currentIndex)
}


function enigDoEdit() {
  var node=getCurrentNode()
  if (node) {
    var inputObj  = new Object;
    var resultObj = new Object;
    inputObj.command = "edit";
    inputObj.options = "nosave";
    inputObj.toAddress = node.getAttribute("email");
    inputObj.keyId     = node.getAttribute("keyId").split(/[ ,]+/);
    inputObj.sign      = Number(node.getAttribute("sign"));
    inputObj.encrypt   = Number(node.getAttribute("encrypt"));
    inputObj.pgpmime   = Number(node.getAttribute("pgpMime"));
    
    window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    if (resultObj.cancelled==false) {
      createRow(node, resultObj);
    }
  }
}

function enigDoAdd() {
  var inputObj  = new Object;
  var resultObj = new Object;
  inputObj.options = "nosave";
  inputObj.toAddress = "{}";
  inputObj.command = "add";
  
  window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  if (resultObj.cancelled==false) {
    var treeItem=document.createElement("treeitem");
    createRow(treeItem, resultObj);
    var treeChildren=document.getElementById("rulesTreeChildren");
    if (treeChildren.firstChild) {
      treeChildren.insertBefore(treeItem, treeChildren.firstChild);
    }
    else {
      treeChildren.appendChild(treeItem);
    }
  }
}

function enigDoDelete() {
  var node=getCurrentNode();
  if (node) {
    if (EnigConfirm(EnigGetString("deleteRule"))) {
      var treeChildren=document.getElementById("rulesTreeChildren");
      treeChildren.removeChild(node);
    }
  }
}

function enigDoMoveUp() {
  var node=getCurrentNode();
  if (! node) return;
  var prev=node.previousSibling;
  if (prev) {
    var rulesTree=document.getElementById("rulesTree");
    var currentIndex = rulesTree.currentIndex;
    var treeChildren=document.getElementById("rulesTreeChildren");
    var newNode=node.cloneNode(true);
    treeChildren.removeChild(node);
    treeChildren.insertBefore(newNode, prev);
    rulesTree.currentIndex = -1;
    rulesTree.currentIndex = currentIndex - 1;
  }
}

function enigDoMoveDown() {
  var node=getCurrentNode();
  if (! node) return;
  var nextNode=node.nextSibling;
  if (nextNode) {
    var rulesTree=document.getElementById("rulesTree");
    var currentIndex = rulesTree.currentIndex;
    var treeChildren=document.getElementById("rulesTreeChildren");
    var newNode=nextNode.cloneNode(true);
    treeChildren.removeChild(nextNode);
    treeChildren.insertBefore(newNode, node);
    rulesTree.currentIndex = currentIndex + 1;
  }
}

function enigDoSearch() {
  var searchTxt=document.getElementById("filterEmail").value;
  if (!searchTxt) return;
  searchTxt = searchTxt.toLowerCase();
  var node=getFirstNode();
  while (node) {
    if (node.getAttribute("email").toLowerCase().indexOf(searchTxt) <0) {
      node.hidden=true;
    }
    else {
      node.hidden=false;
    }
    node = node.nextSibling;
  }
}

function enigDoResetFilter() {
  document.getElementById("filterEmail").value="";
  var node=getFirstNode();
  while (node) {
    node.hidden=false;
    node = node.nextSibling;
  }
  gClearButton.setAttribute("disabled", true);
}

function onEnterInSearchBar()
{
   if (gSearchInput.value == "") 
   {
     enigDoResetFilter();
     return;
   }

   gClearButton.setAttribute("disabled", false);

   enigDoSearch();
}



function onSearchKeyPress(event)
{
  // 13 == return
  if (event && event.keyCode == 13) {
    event.stopPropagation(); // make sure the dialog is not closed...
    onSearchInput(true);
  }
}


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


function disableQuickSearchClearButton()
{
 if (gClearButton)
   gClearButton.setAttribute("disabled", true); 
}

