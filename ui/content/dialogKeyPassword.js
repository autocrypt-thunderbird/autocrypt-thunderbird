/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global Components: false, EnigmailLog: false, EnigAlert: false, tick: false */

"use strict";

let view = { };

function onLoad() {
  view.dialog = document.getElementById("dialogKeyPassword");
  view.textboxPassword = document.getElementById("textboxPassword");
  view.buttonAccept = view.dialog.getButton("accept");
  view.buttonCancel = view.dialog.getButton("cancel");

  view.buttonAccept.label = "Decrypt";
  view.buttonCancel.label = "Cancel Import";

  setAcceptButtonEnabled(false);
}

function onTextPasswordInput() {
  let text_empty = Boolean(view.textboxPassword.value);
  setAcceptButtonEnabled(text_empty);
}

function setAcceptButtonEnabled(enabled) {
  view.buttonAccept.setAttribute("disabled", enabled ? "false" : "true");
}

function showProgress(on) {
  view.buttonAccept.label = on ? "Decrypting…" : "Decrypt";
  view.buttonAccept.setAttribute("disabled", on ? "true" : "false");
  view.buttonCancel.setAttribute("hidden", on ? "true" : "false");
}

function dialogAccept(event) {
  event.preventDefault();

  showProgress(true);

  let password = view.textboxPassword.value;
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

document.addEventListener("dialogaccept", dialogAccept, true);
