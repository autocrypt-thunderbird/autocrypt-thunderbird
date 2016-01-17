/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */


"use strict";
Components.utils.import("resource://enigmail/core.jsm"); /* global EnigmailCore: false */
Components.utils.import("resource://enigmail/keyEditor.jsm"); /* global EnigmailKeyEditor: false */
Components.utils.import("resource://enigmail/locale.jsm"); /* global EnigmailLocale: false */
Components.utils.import("resource://enigmail/data.jsm"); /* global EnigmailData: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /* global EnigmailDialog: false */

function onAccept() {
  var name = document.getElementById("addUid_name");
  var email = document.getElementById("addUid_email");

  if ((email.value.search(/^ *$/) === 0) || (name.value.search(/^ *$/) === 0)) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("addUidDlg.nameOrEmailError"));
    return false;
  }
  if (name.value.replace(/ *$/, "").length < 5) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("addUidDlg.nameMinLengthError"));
    return false;
  }
  if (email.value.search(/.@./) < 0) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("addUidDlg.invalidEmailError"));
    return false;
  }

  var enigmailSvc = EnigmailCore.getService();
  if (!enigmailSvc) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("accessError"));
    return true;
  }

  EnigmailKeyEditor.addUid(window,
    window.arguments[0].keyId,
    EnigmailData.convertFromUnicode(name.value),
    EnigmailData.convertFromUnicode(email.value),
    "", // user id comment
    function _addUidCb(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigmailDialog.alert(window, EnigmailLocale.getString("addUidFailed") + "\n\n" + errorMsg);
      }
      else {
        window.arguments[1].refresh = true;
        EnigmailDialog.alert(window, EnigmailLocale.getString("addUidOK"));
      }
      window.close();
    });

  return false;
}
