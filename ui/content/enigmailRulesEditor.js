/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

/* global Components */
/* global EnigInitCommon, EnigGetString, GetEnigmailSvc, EnigAlert, EnigConfirm */

"use strict";

// Initialize enigmailCommon
EnigInitCommon("enigmailRulesEditor");

const Cu = Components.utils;
Cu.import("resource://enigmail/rules.jsm"); /*global EnigmailRules: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */

const INPUT = 0;
const RESULT = 1;

var gSearchInput = null;
var gNumRows = null;

function enigmailDlgOnLoad() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var rulesListObj = {};
  if (EnigmailRules.getRulesData(rulesListObj)) {
    var treeChildren = document.getElementById("rulesTreeChildren");
    var rulesList = rulesListObj.value;
    if (rulesList.firstChild.nodeName == "parsererror") {
      EnigAlert("Invalid pgprules.xml file:\n" + rulesList.firstChild.textContent);
      return;
    }
    EnigmailLog.DEBUG("enigmailRulesEditor.js: dlgOnLoad: keys loaded\n");
    gNumRows = 0;
    var node = rulesList.firstChild.firstChild;
    while (node) {
      if (node.tagName == "pgpRule") {
        //try {
        var userObj = {
          email: node.getAttribute("email"),
          keyId: node.getAttribute("keyId"),
          sign: node.getAttribute("sign"),
          encrypt: node.getAttribute("encrypt"),
          pgpMime: node.getAttribute("pgpMime"),
          negate: "0"
        };
        if (node.getAttribute("negateRule")) {
          userObj.negate = node.getAttribute("negateRule");
        }

        var treeItem = document.createElement("treeitem");
        createRow(treeItem, userObj);
        treeChildren.appendChild(treeItem);
        //}
        //catch (ex) {}
      }
      node = node.nextSibling;
    }
  }
  var rulesTree = document.getElementById("rulesTree");
  gSearchInput = document.getElementById("filterEmail");

}

function enigmailDlgOnAccept() {
  EnigmailLog.DEBUG("enigmailRulesEditor.js: dlgOnAccept:\n");
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;
  enigmailSvc.clearRules();

  var node = getFirstNode();
  while (node) {
    enigmailSvc.addRule(true,
      node.getAttribute("email"),
      node.getAttribute("keyId"),
      node.getAttribute("sign"),
      node.getAttribute("encrypt"),
      node.getAttribute("pgpMime"),
      node.getAttribute("negateRule")
    );
    node = node.nextSibling;
  }
  enigmailSvc.saveRulesFile();

  return true;
}

function createCol(value, label, treeItem, translate) {
  var column = document.createElement("treecell");
  column.setAttribute("id", value);
  treeItem.setAttribute(value, label);
  switch (value) {
    case "sign":
    case "encrypt":
    case "pgpMime":
      switch (Number(label)) {
        case 0:
          label = EnigGetString("never");
          break;
        case 1:
          label = EnigGetString("possible");
          break;
        case 2:
          label = EnigGetString("always");
          break;
      }
      break;
    case "keyId":
      if (label == ".") {
        label = EnigGetString("nextRcpt");
      }
      break;
    case "negateRule":
      if (Number(label) == 1) {
        label = EnigGetString("negateRule");
      }
      else {
        label = "";
      }
  }
  column.setAttribute("label", label);
  return column;
}

function createRow(treeItem, userObj) {
  var negate = createCol("negateRule", userObj.negate, treeItem);
  var email = createCol("email", userObj.email, treeItem);
  var keyId = createCol("keyId", userObj.keyId, treeItem);
  var sign = createCol("sign", userObj.sign, treeItem);
  var encrypt = createCol("encrypt", userObj.encrypt, treeItem);
  var pgpMime = createCol("pgpMime", userObj.pgpMime, treeItem);
  var treeRow = document.createElement("treerow");
  treeRow.appendChild(negate);
  treeRow.appendChild(email);
  treeRow.appendChild(keyId);
  treeRow.appendChild(encrypt);
  treeRow.appendChild(sign);
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
  var rulesTree = document.getElementById("rulesTree");
  return rulesTree.contentView.getItemAtIndex(rulesTree.currentIndex);
}


function enigDoEdit() {
  var node = getCurrentNode();
  if (node) {
    var inputObj = {};
    var resultObj = {};
    inputObj.command = "edit";
    inputObj.options = "nosave";
    inputObj.toAddress = node.getAttribute("email");
    inputObj.keyId = node.getAttribute("keyId").split(/[ ,]+/);
    inputObj.sign = Number(node.getAttribute("sign"));
    inputObj.encrypt = Number(node.getAttribute("encrypt"));
    inputObj.pgpmime = Number(node.getAttribute("pgpMime"));
    inputObj.negate = Number(node.getAttribute("negateRule"));

    window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul", "", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    if (resultObj.cancelled === false) {
      createRow(node, resultObj);
    }
  }
}

function enigDoAdd() {
  var inputObj = {};
  var resultObj = {};
  inputObj.options = "nosave";
  inputObj.toAddress = "{}";
  inputObj.command = "add";

  window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul", "", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  if (resultObj.cancelled === false) {
    var treeItem = document.createElement("treeitem");
    createRow(treeItem, resultObj);
    var treeChildren = document.getElementById("rulesTreeChildren");
    if (treeChildren.firstChild) {
      treeChildren.insertBefore(treeItem, treeChildren.firstChild);
    }
    else {
      treeChildren.appendChild(treeItem);
    }
  }
}

function enigDoDelete() {
  var node = getCurrentNode();
  if (node) {
    if (EnigConfirm(EnigGetString("deleteRule"), EnigGetString("dlg.button.delete"))) {
      var treeChildren = document.getElementById("rulesTreeChildren");
      treeChildren.removeChild(node);
    }
  }
}

function enigDoMoveUp() {
  var node = getCurrentNode();
  if (!node) return;
  var prev = node.previousSibling;
  if (prev) {
    var rulesTree = document.getElementById("rulesTree");
    var currentIndex = rulesTree.currentIndex;
    var treeChildren = document.getElementById("rulesTreeChildren");
    var newNode = node.cloneNode(true);
    treeChildren.removeChild(node);
    treeChildren.insertBefore(newNode, prev);
    rulesTree.currentIndex = -1;
    rulesTree.currentIndex = currentIndex - 1;
  }
}

function enigDoMoveDown() {
  var node = getCurrentNode();
  if (!node) return;
  var nextNode = node.nextSibling;
  if (nextNode) {
    var rulesTree = document.getElementById("rulesTree");
    var currentIndex = rulesTree.currentIndex;
    var treeChildren = document.getElementById("rulesTreeChildren");
    var newNode = nextNode.cloneNode(true);
    treeChildren.removeChild(nextNode);
    treeChildren.insertBefore(newNode, node);
    rulesTree.currentIndex = currentIndex + 1;
  }
}

function enigDoSearch() {
  var searchTxt = document.getElementById("filterEmail").value;
  if (!searchTxt) return;
  searchTxt = searchTxt.toLowerCase();
  var node = getFirstNode();
  while (node) {
    if (node.getAttribute("email").toLowerCase().indexOf(searchTxt) < 0) {
      node.hidden = true;
    }
    else {
      node.hidden = false;
    }
    node = node.nextSibling;
  }
}

function enigDoResetFilter() {
  document.getElementById("filterEmail").value = "";
  var node = getFirstNode();
  while (node) {
    node.hidden = false;
    node = node.nextSibling;
  }
}

function onSearchInput() {
  if (gSearchInput.value === "") {
    enigDoResetFilter();
    return;
  }

  enigDoSearch();
}
