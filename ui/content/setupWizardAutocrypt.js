/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const AutocryptSecret = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSecret.jsm").AutocryptSecret;

/* Imported from commonWorkflows.js: */
/* global EnigmailCommon_importKeysFromFile: false */

function onLoad() {
  EnigmailLog.DEBUG(`setupWizardAutocrypt.js: onLoad()\n`);
  const dlg = document.getElementById("setupWizardDlg");
  dlg.getButton("accept").setAttribute("disabled", "true");
  dlg.getButton("accept").setAttribute("label", "Got it");

  // let the dialog be loaded asynchronously such that we can disply the dialog
  // before we start working on it.
  onLoadAsync();
}

async function onLoadAsync() {
  try {
    await AutocryptSecret.generateKeysForAllIdentities();
  } catch (ex) {
    EnigmailLog.DEBUG(`setupWizardAutocrypt.js: onLoadAsync(): error ${ex} ${ex.stack}\n`);
  }

  const dlg = document.getElementById("setupWizardDlg");
  dlg.getButton("accept").setAttribute("disabled", "false");
}
