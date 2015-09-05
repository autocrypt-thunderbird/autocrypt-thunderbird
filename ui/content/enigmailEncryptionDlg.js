/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2003 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *   Ludwig Hügelschäfer <ludwig@hammernoch.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

function enigmailEncryptionDlgLoad() {
  EnigmailLog.DEBUG("enigmailEncryptionDlgLoad.js: Load\n");

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
  var usePgpMime = (pgpmimeElement.selectedItem.getAttribute("value") == "1");

  resultObj.sign = getResultStatus(sign);
  resultObj.encrypt = getResultStatus(encrypt);
  resultObj.pgpmime = getResultStatus(usePgpMime);
  resultObj.resetDefaults = false;

  resultObj.success = true;
}
