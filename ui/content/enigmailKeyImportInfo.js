/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global Components: false */

"use strict";

Components.utils.import("resource://enigmail/locale.jsm"); /* global EnigmailLocale: false */
Components.utils.import("resource://enigmail/windows.jsm"); /* global EnigmailWindows: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /* global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /* global EnigmailDialog: false */
Components.utils.import("resource://enigmail/events.jsm"); /* global EnigmailEvents: false */
Components.utils.import("resource://enigmail/data.jsm"); /* global EnigmailData: false */
Components.utils.import("resource://enigmail/os.jsm"); /* global EnigmailOS: false */

function onLoad() {
  var dlg = document.getElementById("enigmailKeyImportInfo");

  let i, keys;

  dlg.getButton("help").setAttribute("hidden", "true");
  dlg.getButton("cancel").setAttribute("hidden", "true");
  dlg.getButton("extra1").setAttribute("hidden", "true");
  dlg.getButton("extra2").setAttribute("hidden", "true");
  dlg.setAttribute("title", EnigmailLocale.getString("importInfoTitle"));

  if (window.screen.width > 500) {
    dlg.setAttribute("maxwidth", window.screen.width - 150);
  }

  if (window.screen.height > 300) {
    dlg.setAttribute("maxheight", window.screen.height - 100);
  }

  var keyList = window.arguments[0].keyList;
  var button1 = window.arguments[0].button1;
  var button2 = window.arguments[0].button2;
  var button3 = window.arguments[0].button3;
  var checkboxLabel = window.arguments[0].checkboxLabel;
  if (button1) {
    setButton(0, button1);
  }

  if (checkboxLabel) {
    var prefCheck = document.getElementById("theCheckBox");
    prefCheck.setAttribute("label", checkboxLabel);
    prefCheck.removeAttribute("hidden");
  }

  let onClickFunc = function(event) {
    let keyId = event.target.getAttribute("keyid");
    EnigmailWindows.openKeyDetails(window, keyId, false);
  };

  for (i = 0, keys = []; i < keyList.length; i++) {
    let keyId = keyList[i];

    if (keyId.search(/^0x/) === 0) {
      keyId = keyId.substr(2).toUpperCase();
    }
    let keyObj = EnigmailKeyRing.getKeyById(keyId);
    if (keyObj && keyObj.fpr) {
      let keyGroupBox = buildKeyGroupBox(keyObj);
      keyGroupBox.getElementsByClassName("enigmailKeyImportDetails")[0].addEventListener('click', onClickFunc, true);
      keys.push(keyGroupBox);
    }
  }

  dlg.getButton("accept").focus();

  if (keys.length) {
    let keysInfoBox = document.getElementById("keyInfo"),
      keysGrid = document.createElement("grid"),
      keysRows = document.createElement("rows"),
      keysCols = document.createElement("columns");

    for (i = 0; i < 3; i++) {
      keysCols.appendChild(document.createElement("column"));
    }

    let keysRow;
    for (i = 0; i < keys.length; i++) {
      if ((i % 3) === 0) {
        keysRow = document.createElement("row");
        keysRows.appendChild(keysRow);
      }
      keysRow.appendChild(keys[i]);
    }

    keysGrid.appendChild(keysRows);
    keysGrid.appendChild(keysCols);
    keysInfoBox.appendChild(keysGrid);
  }
  else {
    EnigmailDialog.longAlert(window, EnigmailData.convertGpgToUnicode(EnigmailLocale.getString("importInfoNoKeys")));
    EnigmailEvents.dispatchEvent(window.close, 0);
    return;
  }

  EnigmailEvents.dispatchEvent(resizeDlg, 0);
}

function buildKeyGroupBox(keyObj) {

  let i,
    groupBox = document.createElement("groupbox"),
    caption = document.createElement("caption"),
    userid = document.createElement("label"),
    infoGrid = document.createElement("grid"),
    infoColumns = document.createElement("columns"),
    infoColId = document.createElement("column"),
    infoColDate = document.createElement("column"),
    infoRows = document.createElement("rows"),
    infoRowHead = document.createElement("row"),
    infoRowBody = document.createElement("row"),
    infoLabelH1 = document.createElement("label"),
    infoLabelH2 = document.createElement("label"),
    infoLabelH3 = document.createElement("label"),
    infoLabelB1 = document.createElement("label"),
    infoLabelB2 = document.createElement("label"),
    infoLabelB3 = document.createElement("label"),
    fprGrid = document.createElement("grid"),
    fprLabel = document.createElement("label"),
    fprColumns = document.createElement("columns"),
    fprRows = document.createElement("rows"),
    fprRow1 = document.createElement("row"),
    fprRow2 = document.createElement("row");

  userid.setAttribute("value", keyObj.userId);
  userid.setAttribute("class", "enigmailKeyImportUserId");
  caption.setAttribute("label", EnigmailLocale.getString("importInfoSuccess"));
  caption.setAttribute("class", "enigmailKeyImportCaption");
  infoLabelH1.setAttribute("value", EnigmailLocale.getString("importInfoBits"));
  infoLabelH2.setAttribute("value", EnigmailLocale.getString("importInfoCreated"));
  infoLabelH3.setAttribute("value", "");
  infoLabelB1.setAttribute("value", keyObj.keySize);
  infoLabelB2.setAttribute("value", keyObj.created);
  infoLabelB3.setAttribute("value", EnigmailLocale.getString("importInfoDetails"));
  infoLabelB3.setAttribute("keyid", keyObj.keyId);
  infoLabelB3.setAttribute("class", "enigmailKeyImportDetails");

  infoRowHead.appendChild(infoLabelH1);
  infoRowHead.appendChild(infoLabelH2);
  infoRowHead.appendChild(infoLabelH3);
  infoRowHead.setAttribute("class", "enigmailKeyImportHeader");
  infoRowBody.appendChild(infoLabelB1);
  infoRowBody.appendChild(infoLabelB2);
  infoRowBody.appendChild(infoLabelB3);
  infoRows.appendChild(infoRowHead);
  infoRows.appendChild(infoRowBody);
  infoColumns.appendChild(infoColId);
  infoColumns.appendChild(infoColDate);
  infoGrid.appendChild(infoColumns);
  infoGrid.appendChild(infoRows);

  fprLabel.setAttribute("value", EnigmailLocale.getString("importInfoFpr"));
  fprLabel.setAttribute("class", "enigmailKeyImportHeader");
  for (i = 0; i < keyObj.fpr.length; i += 4) {
    var label = document.createElement("label");
    label.setAttribute("value", keyObj.fpr.substr(i, 4));
    if (i < keyObj.fpr.length / 2) {
      fprColumns.appendChild(document.createElement("column"));
      fprRow1.appendChild(label);
    }
    else {
      fprRow2.appendChild(label);
    }
  }

  fprRows.appendChild(fprRow1);
  fprRows.appendChild(fprRow2);
  fprGrid.appendChild(fprColumns);
  fprGrid.appendChild(fprRows);
  groupBox.appendChild(caption);
  groupBox.appendChild(userid);
  groupBox.appendChild(infoGrid);
  groupBox.appendChild(fprLabel);
  groupBox.appendChild(fprGrid);

  return groupBox;
}

function resizeDlg() {

  var txt = document.getElementById("keyInfo");
  var box = document.getElementById("outerbox");
  var dlg = document.getElementById("enigmailKeyImportInfo");

  var deltaWidth = window.outerWidth - box.clientWidth;
  var newWidth = txt.scrollWidth + deltaWidth + 20;

  if (newWidth > window.screen.width - 50) {
    newWidth = window.screen.width - 50;
  }

  txt.style["white-space"] = "pre-wrap";
  window.outerWidth = newWidth;

  var textHeight = txt.scrollHeight;
  var boxHeight = box.clientHeight;
  var deltaHeight = window.outerHeight - boxHeight;

  var newHeight = textHeight + deltaHeight + 20;


  if (newHeight > window.screen.height - 100) {
    newHeight = window.screen.height - 100;
  }

  window.outerHeight = newHeight;
}

function centerDialog() {
  if (EnigmailOS.getOS() != "Darwin")
    document.getElementById("enigmailKeyImportInfo").centerWindowOnScreen();
}

function setButton(buttonId, label) {
  var labelType = "extra" + buttonId.toString();
  if (labelType == "extra0") labelType = "accept";

  var dlg = document.getElementById("enigmailKeyImportInfo");
  var elem = dlg.getButton(labelType);

  var i = label.indexOf(":");
  if (i === 0) {
    elem = dlg.getButton(label.substr(1));
    elem.setAttribute("hidden", "false");
    elem.setAttribute("oncommand", "dlgClose(" + buttonId.toString() + ")");
    return;
  }
  if (i > 0) {
    labelType = label.substr(0, i);
    label = label.substr(i + 1);
    elem = dlg.getButton(labelType);
  }
  i = label.indexOf("&");
  if (i >= 0) {
    var c = label.substr(i + 1, 1);
    if (c != "&") {
      elem.setAttribute("accesskey", c);
    }
    label = label.substr(0, i) + label.substr(i + 1);
  }
  elem.setAttribute("label", label);
  elem.setAttribute("oncommand", "dlgClose(" + buttonId.toString() + ")");
  elem.removeAttribute("hidden");
}

function dlgClose(buttonNumber) {
  window.arguments[1].value = buttonNumber;
  window.arguments[1].checked = (document.getElementById("theCheckBox").getAttribute("checked") == "true");
  window.close();
}

function checkboxCb() {
  // do nothing
}
