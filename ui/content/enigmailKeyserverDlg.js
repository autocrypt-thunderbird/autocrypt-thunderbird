/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

"use strict";

/* global EnigGetString: false, EnigGetPref: false, EnigSetPref: false, EnigAlert: false*/

function onLoad() {
  window.arguments[1].value = "";
  var keyIdText = document.getElementById("keyIdText");
  var emailRow = document.getElementById("emailRow");
  var keyText;

  if (typeof(window.arguments[0].keyId) == "string") {
    var keyId = window.arguments[0].keyId;
    if (window.arguments[0].upload) {
      keyText = EnigGetString("uploadKey", keyId);
    }
    else {
      keyText = EnigGetString("importKey", keyId);
    }

    if (keyText.length > 400) {
      keyText = keyText.substr(0, 400) + " ...";
    }
    keyIdText.firstChild.data = keyText;
    emailRow.setAttribute("collapsed", "true");
  }
  else {
    keyIdText.setAttribute("collapsed", "true");
  }

  var keyservers = EnigGetPref("keyserver").split(/[ ,;]/g);
  var menulist = document.getElementById("selectedServer");
  var selected;

  for (var i = 0; i < keyservers.length; i++) {
    if (keyservers[i].length > 0 &&
      (!window.arguments[0].upload ||
        keyservers[i].slice(0, 10) != "keybase://")) {
      menulist.appendItem(keyservers[i]);

      if (selected === undefined) {
        selected = keyservers[i];
      }
    }
  }
  document.getElementById("selectedServer").value = selected;
}

function onAccept() {
  var menulist = document.getElementById("selectedServer");
  window.arguments[1].value = menulist.value;
  if (typeof(window.arguments[0].keyId) != "string") {
    window.arguments[1].email = document.getElementById("email").value;
    if (!window.arguments[1].email) {
      EnigAlert(EnigGetString("noEmailProvided"));
      return false;
    }
  }
  var selected = menulist.selectedIndex;

  if (selected !== 0) {
    var servers = [menulist.value];
    var nodes = menulist.menupopup.getElementsByTagName('menuitem');
    for (var i = 0, e = nodes.length; i < e; ++i) {
      if (i == selected) {
        continue;
      }
      servers.push(nodes[i].label);
    }
    EnigSetPref("keyserver", servers.join(', '));
  }
  return true;
}
