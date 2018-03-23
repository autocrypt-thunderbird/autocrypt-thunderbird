/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const Cu = Components.utils;

const {
  EnigmailLocale
} = Cu.import("chrome://enigmail/content/modules/locale.jsm");
const {
  EnigmailPrefs
} = Cu.import("chrome://enigmail/content/modules/prefs.jsm");
const {
  EnigmailDialog
} = Cu.import("chrome://enigmail/content/modules/dialog.jsm");


function onLoad() {
  window.arguments[1].value = "";
  let keyIdText = document.getElementById("keyIdText");
  let searchCollapser = document.getElementById("searchCollapser");
  let keyText;

  if (typeof(window.arguments[0].keyId) == "string") {
    var keyId = window.arguments[0].keyId;
    if (window.arguments[0].upload) {
      keyText = EnigmailLocale.getString("uploadKey", keyId);
    }
    else {
      keyText = EnigmailLocale.getString("importKey", keyId);
    }

    if (keyText.length > 400) {
      keyText = keyText.substr(0, 400) + " ...";
    }
    keyIdText.firstChild.data = keyText;
    searchCollapser.setAttribute("collapsed", "true");
  }
  else {
    keyIdText.setAttribute("collapsed", "true");
  }

  var keyservers = EnigmailPrefs.getPref("keyserver").split(/[ ,;]/g);
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
  let menulist = document.getElementById("selectedServer");
  window.arguments[1].value = menulist.value;
  if (typeof(window.arguments[0].keyId) != "string") {
    window.arguments[1].email = document.getElementById("email").value;
    if (!window.arguments[1].email) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("noEmailProvided"));
      return false;
    }
  }
  var selected = menulist.selectedIndex;

  if (selected !== 0) {
    let servers = [menulist.value];
    let nodes = menulist.menupopup.getElementsByTagName('menuitem');
    for (let i = 0, e = nodes.length; i < e; ++i) {
      if (i == selected) {
        continue;
      }
      servers.push(nodes[i].label);
    }
    EnigmailPrefs.setPref("keyserver", servers.join(', '));
  }
  return true;
}
