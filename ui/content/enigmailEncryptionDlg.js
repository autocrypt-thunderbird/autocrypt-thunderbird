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

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailEncryptionDlg");


function enigmailEncryptionDlgLoad() {
  DEBUG_LOG("enigmailEncryptionDlgLoad.js: Load\n");

  // Get Enigmail service, such that e.g. the wizard can be executed
  // if needed.
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    window.close();
    return;
  }

  /*
  var sendFlags = window.arguments[0].sendFlags;
  if (sendFlags & ENIG_ENCRYPT) {
    document.getElementById("encryptMsg").setAttribute("checked", true);
  }
  if (sendFlags & ENIG_SIGN) {
    document.getElementById("signMsg").setAttribute("checked", true);
  }
  if (window.arguments[0].usePgpMime) {
    document.getElementById("usePgpMime").setAttribute("checked", true);
  }
  if (window.arguments[0].disableRules) {
    document.getElementById("IgnoreRules").setAttribute("checked", true);
  }
  */

  var inputObj = window.arguments[0];

  var statusSignedStr = inputObj.statusSignedStr;
  if (statusSignedStr) {
    document.getElementById("enigmail_compose_popup_sign_caption").setAttribute("label", statusSignedStr);
  }
  var signGroupElement = document.getElementById("enigmail_compose_popup_sign");
  if (inputObj.finalSign == 0) {
    signGroupElement.selectedItem = document.getElementById("enigmail_final_signNo");
  }
  else if (inputObj.finalSign == 1) {
    signGroupElement.selectedItem = document.getElementById("enigmail_final_signDefault");
  }
  else if (inputObj.finalSign == 2) {
    signGroupElement.selectedItem = document.getElementById("enigmail_final_signYes");
  }

  var statusEncryptedStr = inputObj.statusEncryptedStr;
  if (statusEncryptedStr) {
    document.getElementById("enigmail_compose_popup_encrypt_caption").setAttribute("label", statusEncryptedStr);
  }
  var encGroupElement = document.getElementById("enigmail_compose_popup_encrypt");
  // note: for whatever reason a switch over inputObj.finalEncrypt does not work
  if (inputObj.finalEncrypt == 0) {
    encGroupElement.selectedItem = document.getElementById("enigmail_final_encryptNo");
  }
  else if (inputObj.finalEncrypt == 1) {
    encGroupElement.selectedItem = document.getElementById("enigmail_final_encryptDefault");
  }
  else if (inputObj.finalEncrypt == 2) {
    encGroupElement.selectedItem = document.getElementById("enigmail_final_encryptYes");
  }

  var statusPGPMimeStr = inputObj.statusPGPMimeStr;
  if (statusPGPMimeStr) {
    document.getElementById("enigmail_compose_popup_pgpmime_caption").setAttribute("label", statusPGPMimeStr);
  }
  var pgpmimeGroupElement = document.getElementById("enigmail_compose_popup_pgpmime");
  if (inputObj.finalPGPMime == 0) {
    pgpmimeGroupElement.selectedItem = document.getElementById("enigmail_final_pgpmimeNo");
  }
  else if (inputObj.finalPGPMime == 1) {
    pgpmimeGroupElement.selectedItem = document.getElementById("enigmail_final_pgpmimeDefault");
  }
  else if (inputObj.finalPGPMime == 2) {
    pgpmimeGroupElement.selectedItem = document.getElementById("enigmail_final_pgpmimeYes");
  }
}


function enigmailEncryptionDlgAccept () {
  var resultObj = window.arguments[0];
  /*
  resultObj.sendFlags = 0;
  if (document.getElementById("encryptMsg").getAttribute("checked")) {
    resultObj.sendFlags |= ENIG_ENCRYPT;
  }
  if (document.getElementById("signMsg").getAttribute("checked")) {
    resultObj.sendFlags |= ENIG_SIGN;
  }

  resultObj.usePgpMime = document.getElementById("usePgpMime").getAttribute("checked");
  resultObj.disableRules = document.getElementById("IgnoreRules").getAttribute("checked");
  */

  resultObj.finalSign = document.getElementById("enigmail_compose_popup_sign").value;
  resultObj.finalEncrypt = document.getElementById("enigmail_compose_popup_encrypt").value;
  resultObj.finalPGPMime = document.getElementById("enigmail_compose_popup_pgpmime").value;
}
