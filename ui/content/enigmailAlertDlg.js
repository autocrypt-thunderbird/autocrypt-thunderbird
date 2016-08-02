/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global EnigInitCommon: false, EnigmailEvents: false, EnigGetString: false, EnigGetOS: false */
/* global Components: false */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://enigmail/clipboard.jsm"); /*global EnigmailClipboard: false */


EnigInitCommon("enigmailAlertDlg");

function onLoad() {
  var dlg = document.getElementById("enigmailAlertDlg");
  dlg.getButton("help").setAttribute("hidden", "true");
  dlg.getButton("cancel").setAttribute("hidden", "true");
  dlg.getButton("extra1").setAttribute("hidden", "true");
  dlg.getButton("extra2").setAttribute("hidden", "true");
  dlg.setAttribute("title", EnigGetString("enigAlert"));

  if (window.screen.width > 500) {
    dlg.setAttribute("maxwidth", window.screen.width - 150);
  }

  if (window.screen.height > 300) {
    dlg.setAttribute("maxheight", window.screen.height - 100);
  }

  var msgtext = window.arguments[0].msgtext;
  var button1 = window.arguments[0].button1;
  var button2 = window.arguments[0].button2;
  var button3 = window.arguments[0].button3;
  var checkboxLabel = window.arguments[0].checkboxLabel;
  var m = msgtext.match(/(\n)/g);
  var lines = 2;
  if (!m) {
    lines = (msgtext.length / 80) + 2;
  }
  else {
    try {
      lines = (m.length > 20 ? 20 : m.length + 2);
    }
    catch (ex) {
      lines = 2;
    }
  }
  if (button1) {
    setButton(0, button1);
  }
  if (button2) {
    setButton(1, button2);
  }
  if (button3) {
    setButton(2, button3);
  }

  if (checkboxLabel) {
    var prefCheck = document.getElementById("theCheckBox");
    prefCheck.setAttribute("label", checkboxLabel);
    prefCheck.removeAttribute("hidden");
  }
  dlg.getButton("accept").focus();
  var textbox = document.getElementById("msgtext");
  textbox.textContent = msgtext;
  window.addEventListener("keypress", onKeyPress);
  EnigmailEvents.dispatchEvent(resizeDlg, 0);
}

function resizeDlg() {

  var txt = document.getElementById("msgtext");
  var box = document.getElementById("outerbox");
  var dlg = document.getElementById("enigmailAlertDlg");

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
  if (EnigGetOS() != "Darwin")
    document.getElementById("enigmailAlertDlg").centerWindowOnScreen();
}

function setButton(buttonId, label) {
  var labelType = "extra" + buttonId.toString();
  if (labelType == "extra0") labelType = "accept";

  var dlg = document.getElementById("enigmailAlertDlg");
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


function copyToClipbrd() {
  let s = window.getSelection().toString();

  EnigmailClipboard.setClipboardContent(s);
}

function onKeyPress(event) {
  if (event.key == "c" && event.getModifierState("Accel")) {
    copyToClipbrd();
    event.stopPropagation();
  }
}
