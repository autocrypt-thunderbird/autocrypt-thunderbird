/*global EnigInitCommon EnigGetString EnigmailLog */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

/* global EnigInitCommon: false, EnigSetPref: false, EnigGetPref: false */


"use strict";


// Initialize enigmailCommon
EnigInitCommon("enigmailAttachmentsDialog");


var gArguments = arguments;
const ENIG_INPUT = 0;
const ENIG_RESULT = 1;

function enigmailAttachDlgLoad() {
  EnigmailLog.DEBUG("enigmailAttachmentsDialog.js: Load\n");

  var dialog = document.getElementById("attachmentsDialog");
  dialog.setAttribute("title", EnigGetString("enigPrompt"));

  var optionSel = document.getElementById("enigmailAttachOptions");
  var descNotFound = document.getElementById("enigPgpMimeDetails");
  if (gArguments[ENIG_INPUT].inlinePossible) {
    descNotFound.firstChild.data = EnigGetString("pgpMimeNote", EnigGetString("second"));
  }
  else {
    descNotFound.firstChild.data = EnigGetString("pgpMimeNote", EnigGetString("first"));
  }

  // set radiobutton labels according to whether we ask for sign and/or encrypt policy
  if (window.arguments[ENIG_INPUT].reasonForCheck == "sign") {
    let rb = document.getElementById("enigEncryptAttachNone");
    rb.setAttribute("label", rb.getAttribute("data-signLabel"));
    rb = document.getElementById("enigEncryptAttachInline");
    rb.setAttribute("label", rb.getAttribute("data-signLabel"));
    rb = document.getElementById("enigEncryptAttachPgpMime");
    rb.setAttribute("label", rb.getAttribute("data-signLabel"));
    rb = document.getElementById("enigEncryptAttachDontEncryptMsg");
    rb.setAttribute("label", rb.getAttribute("data-signLabel"));
  }
  else if (window.arguments[ENIG_INPUT].reasonForCheck == "encrypt") {
    let rb = document.getElementById("enigEncryptAttachNone");
    rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
    rb = document.getElementById("enigEncryptAttachInline");
    rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
    rb = document.getElementById("enigEncryptAttachPgpMime");
    rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
    rb = document.getElementById("enigEncryptAttachDontEncryptMsg");
    rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
  }
  else if (window.arguments[ENIG_INPUT].reasonForCheck == "encryptAndSign") {
    let rb = document.getElementById("enigEncryptAttachNone");
    rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
    rb = document.getElementById("enigEncryptAttachInline");
    rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
    rb = document.getElementById("enigEncryptAttachPgpMime");
    rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
    rb = document.getElementById("enigEncryptAttachDontEncryptMsg");
    rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
  }

  var selected = EnigGetPref("encryptAttachments");
  if (!selected)
    selected = 0;

  var node = optionSel.firstChild;
  var nodeCount = 0;
  while (node) {
    if (!gArguments[ENIG_INPUT].inlinePossible && nodeCount == 1) {
      // disable inline PGP option
      node.disabled = true;
    }
    else if (!gArguments[ENIG_INPUT].pgpMimePossible && nodeCount == 2) {
      // disable PGP/MIME option
      node.disabled = true;
    }
    else if (nodeCount == selected) {
      optionSel.selectedItem = node;
      optionSel.value = selected;
    }

    ++nodeCount;
    node = node.nextSibling;
  }
  if (gArguments[ENIG_INPUT].restrictedScenario) {
    document.getElementById("enigmailAttachSkipDlg").disabled = true;
  }
}


function enigmailAttachDlgAccept() {
  EnigmailLog.DEBUG("enigmailAttachDlgAccept.js: Accept\n");

  var optionSel = document.getElementById("enigmailAttachOptions");
  var skipDlg = document.getElementById("enigmailAttachSkipDlg");

  if (skipDlg.checked) {
    EnigSetPref("encryptAttachmentsSkipDlg", 1);
  }
  if (optionSel) {
    if (optionSel.value !== "") {
      gArguments[ENIG_RESULT].selected = optionSel.value;
      if (gArguments[ENIG_INPUT].restrictedScenario === false) {
        EnigSetPref("encryptAttachments", optionSel.value);
      }
      return true;
    }
    else {
      return false;
    }
  }
  return true;
}
