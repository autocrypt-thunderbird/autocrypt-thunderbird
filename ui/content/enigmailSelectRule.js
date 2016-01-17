/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

// uses enigmailCommon.js:
/* global EnigInitCommon: false, EnigGetString: false */

// uses enigmailRulesEditor.js:
/* global enigmailDlgOnAccept: false, createRow: false, getCurrentNode: false, enigmailDlgOnLoad: false */

"use strict";

EnigInitCommon("enigmailSelectRule");

Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */

function addKeyToRule() {
  var node = getCurrentNode();

  var keyId = node.getAttribute("keyId").split(/[ ,]+/);
  keyId.push("0x" + window.arguments[0].keyId);

  var inputObj = {
    email: node.getAttribute("email"),
    keyId: keyId.join(", "),
    sign: Number(node.getAttribute("sign")),
    encrypt: Number(node.getAttribute("encrypt")),
    pgpMime: Number(node.getAttribute("pgpMime")),
    negate: Number(node.getAttribute("negateRule"))
  };

  createRow(node, inputObj);

  enigmailDlgOnAccept();
  window.close();

}


function createNewRuleWithKey() {
  let inputObj = {};
  let resultObj = {};
  let keyObj = EnigmailKeyRing.getKeyById(window.arguments[0].keyId);

  inputObj.options = "nosave";
  inputObj.toAddress = "{}";
  inputObj.keyId = ["0x" + window.arguments[0].keyId];
  inputObj.command = "add";

  if (keyObj) {
    inputObj.toAddress = "{" + EnigmailFuncs.stripEmail(keyObj.userId) + "}";
  }

  window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul", "", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  if (!resultObj.cancelled) {
    var treeItem = document.createElement("treeitem");
    createRow(treeItem, resultObj);
    var treeChildren = document.getElementById("rulesTreeChildren");
    if (treeChildren.firstChild) {
      treeChildren.insertBefore(treeItem, treeChildren.firstChild);
    }
    else {
      treeChildren.appendChild(treeItem);
    }

    enigmailDlgOnAccept();
  }
  window.close();
}

function editDlgOnLoad() {
  enigmailDlgOnLoad();
  document.getElementById("editDialogTitle").setAttribute("value", EnigGetString("addKeyToRule", window.arguments[0].userId, "0x" + window.arguments[0].keyId.substr(-8, 8)));
}
