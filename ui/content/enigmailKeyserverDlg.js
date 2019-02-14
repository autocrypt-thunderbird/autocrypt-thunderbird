/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";




var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
var EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;


function onLoad() {
  window.arguments[1].value = "";
  let keyIdText = document.getElementById("keyIdText");
  let searchCollapser = document.getElementById("searchCollapser");
  let keyText;

  if (typeof(window.arguments[0].keyId) == "string") {
    var keyId = window.arguments[0].keyId;
    if (window.arguments[0].upload) {
      keyText = EnigmailLocale.getString("uploadKey", keyId);
    } else {
      keyText = EnigmailLocale.getString("importKey", keyId);
    }

    if (keyText.length > 400) {
      keyText = keyText.substr(0, 400) + " ...";
    }
    keyIdText.firstChild.data = keyText;
    searchCollapser.setAttribute("collapsed", "true");
  } else {
    keyIdText.setAttribute("collapsed", "true");
  }

  var keyservers = EnigmailPrefs.getPref("keyserver").split(/[ ,;]/g);
  var menulist = document.getElementById("selectedServer");

  for (var i = 0; i < keyservers.length; i++) {
    if (keyservers[i].length > 0 &&
      (!window.arguments[0].upload ||
        keyservers[i].slice(0, 10) !== "keybase://")) {
      menulist.appendItem(keyservers[i]);
    }
  }

  menulist.selectedIndex = 0;
  onSelectServer(menulist);
}

function onAccept() {
  let srvName = document.getElementById("enteredServerName");
  let menulist = document.getElementById("selectedServer");
  let srv = srvName.value;
  window.arguments[1].value = srv;
  if (typeof(window.arguments[0].keyId) !== "string") {
    window.arguments[1].email = document.getElementById("email").value;
    if (!window.arguments[1].email) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("noEmailProvided"));
      return false;
    }
  }

  let servers = [srv];
  let nodes = menulist.menupopup.getElementsByTagName('menuitem');
  for (let i = 0, e = nodes.length; i < e; ++i) {
    if (nodes[i].label == srv) {
      continue;
    }
    servers.push(nodes[i].label);
  }
  EnigmailPrefs.setPref("keyserver", servers.join(', '));

  return true;
}


function onSelectServer(menuList) {
  let srv = menuList.selectedItem;
  if (srv) {
    let srvName = document.getElementById("enteredServerName");
    srvName.value = srv.label;
  }
}