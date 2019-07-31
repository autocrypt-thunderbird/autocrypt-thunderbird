/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";

var EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;

var gInputArgs;

function onLoad() {
  gInputArgs = window.arguments[0];

  if (gInputArgs.dlgMode !== "input") {
    document.getElementById("enigmailAutocryptSetupPasswd").buttons = "accept";
    document.getElementById("dlgDesc").setAttribute("description", EnigmailLocale.getString("enigmail.acSetupPasswd.descCopyPasswd"));
    let b = document.getElementById("enigmailAutocryptSetupPasswd").getButton("accept");
    b.focus();
  } else {
    document.getElementById("dlgDesc").setAttribute("description", EnigmailLocale.getString("enigmail.acSetupPasswd.descEnterPasswd"));
  }

  if (gInputArgs.passwdType == "numeric9x4") {
    if ("initialPasswd" in gInputArgs) {
      document.getElementById("l1").value = gInputArgs.initialPasswd.substr(0, 2);
      if (gInputArgs.initialPasswd.length === 44) {
        for (let i = 1; i < 10; i++) {
          let p = document.getElementById("l" + i);
          p.value = gInputArgs.initialPasswd.substr((i - 1) * 5, 4);
        }
      }
    }
    if (gInputArgs.dlgMode === "input") {
      validate9x4Input();
    } else {
      let bc = document.getElementById("bc-input");
      bc.readOnly = true;
      bc.setAttribute("class", "plain enigmailTitle");
      for (let i = 1; i < 10; i++) {
        let p = document.getElementById("l" + i);
        p.value = gInputArgs.initialPasswd.substr((i - 1) * 5, 4);
      }
    }
  } else {
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
    if (gInputArgs.passwdType === "numeric9x4") {
      let passwd = "";

      for (let i = 1; i < 10; i++) {
        passwd += document.getElementById("l" + i).value + "-";
      }

      gInputArgs.password = passwd.substr(0, 44);
    } else {
      gInputArgs.password = document.getElementById("genericPasswd").value;
    }
  }
}

function onNumericInput(targetObj) {
  if (targetObj.value.length === 4) {
    document.commandDispatcher.advanceFocus();
  }


  let b = document.getElementById("enigmailAutocryptSetupPasswd").getButton("accept");
  validate9x4Input();
}


function validate9x4Input() {
  let isValid = true;

  for (let i = 1; i < 10; i++) {
    let p = document.getElementById("l" + i);
    isValid = (p.value.search(/^[0-9]{4}$/) === 0);
    if (!isValid) break;
  }

  let b = document.getElementById("enigmailAutocryptSetupPasswd").getButton("accept");
  if (isValid) {
    b.removeAttribute("disabled");
  } else {
    b.setAttribute("disabled", "true");
  }
}

document.addEventListener("dialogaccept", function(event) {
  onAccept();
});