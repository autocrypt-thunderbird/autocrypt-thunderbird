/*
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
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net> are
 * Copyright (C) 2003 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailEncryptionDlg");


function enigmailEncryptionDlgLoad() {
   DEBUG_LOG("enigmailEncryptionDlgLoad.js: Load\n");

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
}

function enigmailEncryptionDlgAccept () {
  var resultObj = window.arguments[0];
  resultObj.sendFlags = 0;
  if (document.getElementById("encryptMsg").getAttribute("checked")) {
    resultObj.sendFlags |= ENIG_ENCRYPT;
  }
  if (document.getElementById("signMsg").getAttribute("checked")) {
    resultObj.sendFlags |= ENIG_SIGN;
  }

  resultObj.usePgpMime = document.getElementById("usePgpMime").getAttribute("checked");
}
