/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */

var gInputArgs;

function onLoad() {
  gInputArgs = window.arguments[0];

  if (gInputArgs.dlgMode !== "input") {
    document.getElementById("enigmailAutocryptSetupPasswd").buttons = "accept";
    document.getElementById("dlgDesc").setAttribute("description", EnigmailLocale.getString("enigmail.acSetupPasswd.descCopyPasswd"));
    let b = document.getElementById("enigmailAutocryptSetupPasswd").getButton("accept");
    b.focus();
  }
  else {
    document.getElementById("dlgDesc").setAttribute("description", EnigmailLocale.getString("enigmail.acSetupPasswd.descEnterPasswd"));
  }

  if (gInputArgs.passwdType == "9x4") {
    if ("initialPasswd" in gInputArgs) {
      //document.getElementById("l1").setAttribute("value", gInputArgs.initialPasswd.substr(0, 2));
      document.getElementById("l1").value = gInputArgs.initialPasswd.substr(0, 2);
    }
    if (gInputArgs.dlgMode !== "input") {
      for (let i = 1; i < 10; i++) {
        let p = document.getElementById("l" + i);
        p.value = gInputArgs.initialPasswd.substr((i - 1) * 5, 4);
        p.readOnly = true;
        p.setAttribute("class", "plain enigmailTitle");
      }
    }
  }
  else {
    document.getElementById("dlg9x4").setAttribute("collapsed", true);
    document.getElementById("dlgGeneric").removeAttribute("collapsed");
    if (gInputArgs.dlgMode !== "input") {
      let p = document.getElementById("genericPasswd");
      p.value = gInputArgs.initialPasswd;
      p.setAttribute("class", "plain enigmailTitle");
      p.readOnly = true;
    }
  }
}


function onAccept() {

  if (gInputArgs.dlgMode === "input") {
    if (gInputArgs.passwdType === "9x4") {
      let passwd = "";

      for (let i = 1; i < 10; i++) {
        passwd += document.getElementById("l" + i).value + "-";
      }

      gInputArgs.password = passwd.substr(0, 44);
    }
    else {
      gInputArgs.password = document.getElementById("genericPasswd").value;
    }
  }
}
