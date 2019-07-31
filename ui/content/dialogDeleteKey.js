/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

function getConfirmString() {
  let args = window.arguments[0];
  return args.confirm_string;
}

async function onLoad() {
  if (!getConfirmString()) {
    window.close();
    return;
  }

  const dialog = document.getElementById("dialogDeleteKey");
  dialog.getButton("accept").label = "Delete Key";
  setAcceptButtonEnabled(false);
}

function onTextConfirmInput() {
  const textboxConfirmKeyDelete = document.getElementById("textboxConfirmKeyDelete");
  let is_confirmed = textboxConfirmKeyDelete.value == getConfirmString();
  setAcceptButtonEnabled(is_confirmed);
}

function setAcceptButtonEnabled(enabled) {
  const dialog = document.getElementById("dialogDeleteKey");
  dialog.getButton("accept").setAttribute("disabled", enabled ? "false" : "true");
}

function dialogConfirm() {
  window.arguments[1].confirmed = true;
  window.close();
}

document.addEventListener("dialogaccept", dialogConfirm);
