/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

/* global EnigmailLog: false, EnigmailCore: false, EnigmailConstants: false */

const Ci = Components.interfaces;

function enigmailEncryptionDlgLoad() {
  EnigmailLog.DEBUG("enigmailEncryptionDlgLoad.js: Load\n");
  let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.loadSheetUsingURIString("chrome://enigmail/skin/enigmail.css", 1);

  // Get Enigmail service, such that e.g. the wizard can be executed
  // if needed.
  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc) {
    window.close();
    return;
  }

  var inputObj = window.arguments[0];

  var signElement = document.getElementById("signMsg");
  switch (inputObj.statusSigned) {
    case EnigmailConstants.ENIG_FINAL_FORCEYES:
    case EnigmailConstants.ENIG_FINAL_YES:
      signElement.setAttribute("checked", true);
      break;
    default:
      signElement.removeAttribute("checked");
  }

  var encElement = document.getElementById("encryptMsg");
  switch (inputObj.statusEncrypted) {
    case EnigmailConstants.ENIG_FINAL_FORCEYES:
    case EnigmailConstants.ENIG_FINAL_YES:
      encElement.setAttribute("checked", true);
      break;
    default:
      encElement.removeAttribute("checked");
  }

  var pgpmimeElement = document.getElementById("pgpmimeGroup");
  switch (inputObj.statusPGPMime) {
    case EnigmailConstants.ENIG_FINAL_FORCEYES:
    case EnigmailConstants.ENIG_FINAL_YES:
      pgpmimeElement.selectedItem = document.getElementById("usePgpMime");
      break;
    case EnigmailConstants.ENIG_FINAL_SMIME:
    case EnigmailConstants.ENIG_FINAL_FORCESMIME:
      pgpmimeElement.selectedItem = document.getElementById("useSMime");
      break;
    default:
      pgpmimeElement.selectedItem = document.getElementById("useInlinePgp");
  }
}

// Reset to defaults and close dialog
function resetDefaults() {
  var resultObj = window.arguments[0];

  resultObj.success = true;
  resultObj.sign = EnigmailConstants.ENIG_UNDEF;
  resultObj.encrypt = EnigmailConstants.ENIG_UNDEF;
  resultObj.pgpmime = EnigmailConstants.ENIG_UNDEF;
  resultObj.resetDefaults = true;
  window.close();
}


function getResultStatus(newStatus) {
  if (newStatus) {
    if ((typeof newStatus == "number") && newStatus === 3) {
      return EnigmailConstants.ENIG_FORCE_SMIME;
    }
    return EnigmailConstants.ENIG_ALWAYS;
  }
  else {
    return EnigmailConstants.ENIG_NEVER;
  }
}

function enigmailEncryptionDlgAccept() {
  var resultObj = window.arguments[0];
  var sign = document.getElementById("signMsg").checked;
  var encrypt = document.getElementById("encryptMsg").checked;
  var pgpmimeElement = document.getElementById("pgpmimeGroup");
  var usePgpMime = Number(pgpmimeElement.selectedItem.getAttribute("value"));

  resultObj.sign = getResultStatus(sign);
  resultObj.encrypt = getResultStatus(encrypt);
  resultObj.pgpmime = getResultStatus(usePgpMime);
  resultObj.resetDefaults = false;

  resultObj.success = true;
}
