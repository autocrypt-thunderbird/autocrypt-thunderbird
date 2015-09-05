/*
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
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
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** *
 */

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
