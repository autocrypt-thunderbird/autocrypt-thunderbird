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

Components.utils.import("resource://enigmail/enigmailCommon.jsm");

const Ec = EnigmailCommon;

function enigmailEncryptionDlgLoad() {
  Ec.DEBUG_LOG("enigmailEncryptionDlgLoad.js: Load\n");

  // Get Enigmail service, such that e.g. the wizard can be executed
  // if needed.
  var enigmailSvc = Ec.getService();
  if (!enigmailSvc) {
    window.close();
    return;
  }

  var inputObj = window.arguments[0];

  var signElement = document.getElementById("signMsg");
  switch(inputObj.statusSigned) {
    case EnigmailCommon.ENIG_FINAL_FORCEYES:
    case EnigmailCommon.ENIG_FINAL_YES:
      signElement.setAttribute("checked", true);
      break;
    default:
      signElement.removeAttribute("checked");
  }

  var encElement = document.getElementById("encryptMsg");
  switch(inputObj.statusEncrypted) {
    case EnigmailCommon.ENIG_FINAL_FORCEYES:
    case EnigmailCommon.ENIG_FINAL_YES:
      encElement.setAttribute("checked", true);
      break;
    default:
      encElement.removeAttribute("checked");
  }

  var pgpmimeElement = document.getElementById("pgpmimeGroup");
  switch(inputObj.statusPGPMime) {
    case EnigmailCommon.ENIG_FINAL_FORCEYES:
    case EnigmailCommon.ENIG_FINAL_YES:
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
  resultObj.sign = EnigmailCommon.ENIG_UNDEF;
  resultObj.encrypt = EnigmailCommon.ENIG_UNDEF;
  resultObj.pgpmime = EnigmailCommon.ENIG_UNDEF;
  window.close();
}


function getResultStatus(origStatus, newStatus) {


  switch(origStatus) {
    case EnigmailCommon.ENIG_FINAL_FORCEYES:
    case EnigmailCommon.ENIG_FINAL_YES:
      if (newStatus) {
        return origStatus;
      }
      else {
        return EnigmailCommon.ENIG_NEVER;
      }
      break;
    default:
      if (!newStatus) {
        return origStatus;
      }
      else {
        return EnigmailCommon.ENIG_ALWAYS;
      }
  }
}

function enigmailEncryptionDlgAccept () {
  var resultObj = window.arguments[0];
  var sign = document.getElementById("signMsg").checked;
  var encrypt = document.getElementById("encryptMsg").checked;
  var pgpmimeElement = document.getElementById("pgpmimeGroup");
  var usePgpMime = (pgpmimeElement.selectedItem.getAttribute("value") == "1");

  resultObj.sign = getResultStatus(resultObj.statusSigned, sign);
  resultObj.encrypt = getResultStatus(resultObj.statusSigned, encrypt);
  resultObj.pgpmime = getResultStatus(resultObj.statusPGPMime, usePgpMime);

  resultObj.success = true;
}

