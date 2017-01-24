/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/clipboard.jsm"); /*global EnigmailClipboard: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/events.jsm"); /*global EnigmailEvents: false */

var gAddHeight = 20;

function onLoad() {
  var dlg = document.getElementById("enigmailMsgBox");
  dlg.getButton("help").setAttribute("hidden", "true");
  dlg.getButton("cancel").setAttribute("hidden", "true");
  dlg.getButton("extra1").setAttribute("hidden", "true");
  dlg.getButton("extra2").setAttribute("hidden", "true");

  if (window.screen.width > 500) {
    dlg.setAttribute("maxwidth", window.screen.width - 150);
  }

  if (window.screen.height > 300) {
    dlg.setAttribute("maxheight", window.screen.height - 100);
  }

  let args = window.arguments[0];
  let msgtext = args.msgtext;
  let button1 = args.button1;
  let button2 = args.button2;
  let button3 = args.button3;
  let checkboxLabel = args.checkboxLabel;
  let iconType = args.iconType;

  if (args.iconType) {
    let icn = document.getElementById("infoImage");
    icn.removeAttribute("collapsed");
    let iconClass = "";

    switch (args.iconType) {
      case 2:
        iconClass = "question-icon";
        break;
      case 3:
        iconClass = "alert-icon";
        break;
      case 4:
        iconClass = "error-icon";
        break;
      default:
        iconClass = "message-icon";
    }
    icn.setAttribute("class", "spaced " + iconClass);
  }

  if (args.dialogTitle) {
    if (EnigmailOS.isMac) {
      let t = document.getElementById("macosDialogTitle");
      t.setAttribute("value", args.dialogTitle);
      t.removeAttribute("collapsed");
      gAddHeight = 30;
    }

    dlg.setAttribute("title", args.dialogTitle);
  }
  else {
    dlg.setAttribute("title", EnigmailLocale.getString("enigAlert"));
  }

  let m = msgtext.match(/(\n)/g);
  let lines = 2;
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
  var dlg = document.getElementById("enigmailMsgBox");

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

  var newHeight = textHeight + deltaHeight + gAddHeight;


  if (newHeight > window.screen.height - 100) {
    newHeight = window.screen.height - 100;
  }

  window.outerHeight = newHeight;
}

function centerDialog() {
  if (!EnigmailOS.isMac)
    document.getElementById("enigmailMsgBox").centerWindowOnScreen();
}

function setButton(buttonId, label) {
  var labelType = "extra" + buttonId.toString();
  if (labelType == "extra0") labelType = "accept";

  var dlg = document.getElementById("enigmailMsgBox");
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
