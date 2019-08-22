/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global Components: false, AutocryptLog: false, EnigAlert: false, tick: false */

"use strict";

var AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;

let gInputArgs;
let view = { };

function onLoad() {
  gInputArgs = window.arguments[0];

  view.dialog = document.getElementById("dialogBackupCode");
  view.buttonAccept = view.dialog.getButton("accept");
  view.buttonCancel = view.dialog.getButton("cancel");

  if (gInputArgs.format == "numeric9x4") {
    if ("hint" in gInputArgs) {
      document.getElementById("l1").placeholder = gInputArgs.hint.substr(0, 2);
    }
    validate9x4Input();
  } else {
    document.getElementById("dlg9x4").setAttribute("collapsed", true);
    document.getElementById("dlgGeneric").removeAttribute("collapsed");
  }

  view.buttonAccept.label = "Decrypt";
  view.buttonCancel.label = "Cancel Import";

  setAcceptButtonEnabled(false);
}

function getTypedPassword() {
  if (gInputArgs.format === "numeric9x4") {
    let passwd = "";

    for (let i = 1; i < 10; i++) {
      passwd += document.getElementById("l" + i).value + "-";
    }

    return passwd.substr(0, 44);
  } else {
    return document.getElementById("genericPasswd").value;
  }
}

function onNumericInput(targetObj) {
  if (targetObj.value.length === 4) {
    document.commandDispatcher.advanceFocus();
  }

  validate9x4Input();
}

function validate9x4Input() {
  let isValid = true;

  for (let i = 1; i < 10; i++) {
    let p = document.getElementById("l" + i);
    isValid = (p.value.search(/^[0-9]{4}$/) === 0);
    if (!isValid) break;
  }

  setAcceptButtonEnabled(isValid);
}

function setAcceptButtonEnabled(enabled) {
  view.buttonAccept.setAttribute("disabled", !enabled);
}

function showProgress(on) {
  view.buttonAccept.label = on ? "Decrypting…" : "Decrypt";
  view.buttonAccept.setAttribute("disabled", on);
  view.buttonCancel.setAttribute("hidden", on);
}

function dialogAccept(event) {
  event.preventDefault();

  showProgress(true);

  let password = getTypedPassword();
  let attempt = window.arguments[0].attempt;
  // couldn't figure out how to do this async ¯\_(ツ)_/¯
  setTimeout(async function() {
    if (await attempt(password)) {
      window.close();
    } else {
      showProgress(false);
      EnigAlert("Failed to decrypt. Bad password?");
    }
  }, 50);
}

document.addEventListener("dialogaccept", dialogAccept);
