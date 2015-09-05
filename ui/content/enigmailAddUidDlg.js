/* * ***** BEGIN LICENSE BLOCK *****
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
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
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
 * ***** END LICENSE BLOCK ***** *
 */

Components.utils.import("resource://enigmail/core.jsm");
Components.utils.import("resource://enigmail/keyEditor.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/data.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");

function onAccept() {
  var name = document.getElementById("addUid_name");
  var email = document.getElementById("addUid_email");
  var comment = document.getElementById("addUid_comment");

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
  if (comment.value.search(/[()]/) >= 0) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("addUidDlg.commentError"));
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
    EnigmailData.convertFromUnicode(comment.value),
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
