/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
var EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
var EnigmailLazy = ChromeUtils.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;
var AutocryptSetup = ChromeUtils.import("chrome://enigmail/content/modules/autocryptSetup.jsm").EnigmailAutocryptSetup;

const sqlite = ChromeUtils.import("chrome://enigmail/content/modules/sqliteDb.jsm").EnigmailSqliteDb;


const getOpenPGP = EnigmailLazy.loader("enigmail/openpgp.jsm", "EnigmailOpenPGP");
const openpgp = getOpenPGP().openpgp;

const getCore = EnigmailLazy.loader("enigmail/core.jsm", "EnigmailCore");

/* Imported from commonWorkflows.js: */
/* global EnigmailCommon_importKeysFromFile: false */

function onLoad() {
  EnigmailLog.DEBUG(`setupWizardAutocrypt.js: onLoad()\n`);
  const dlg = document.getElementById("setupWizardDlg");
  dlg.getButton("accept").setAttribute("disabled", "true");
  dlg.getButton("accept").onclick = function() {
    onFinish();
  };

  // let the dialog be loaded asynchronously such that we can disply the dialog
  // before we start working on it.
  EnigmailTimer.setTimeout(onLoadAsync, 1);
}

function onLoadAsync() {
  AutocryptSetup.createKeyForAllAccounts();

  const dlg = document.getElementById("setupWizardDlg");
  dlg.getButton("accept").setAttribute("disabled", "false");
}

function onFinish() {
  const dlg = document.getElementById("setupWizardDlg");
  dlg.dismiss();
}
