/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm"); /*global EnigmailDialog: false */
ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm"); /*global EnigmailLocale: false */
ChromeUtils.import("chrome://enigmail/content/modules/key.jsm"); /*global EnigmailKey: false */
ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm"); /*global EnigmailKeyRing: false */

/**
 * import OpenPGP keys from file
 */
function EnigmailCommon_importKeysFromFile()  {

  let inFile = EnigmailDialog.filePicker(window, EnigmailLocale.getString("importKeyFile"),
    "", false, "*.asc", "", [EnigmailLocale.getString("gnupgFile"), "*.asc;*.gpg;*.pgp"]);
  if (!inFile) return false;

  let errorMsgObj = {};
  // preview
  let preview = EnigmailKey.getKeyListFromKeyFile(inFile, errorMsgObj);

  if (errorMsgObj.value && errorMsgObj.value.length > 0) {
    EnigmailDialog.alert(window, errorMsgObj.value);
    return false;
  }
  let exitStatus = -1;

  if (preview.length > 0) {
    if (preview.length == 1) {
      exitStatus = EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("doImportOne", [preview[0].name, preview[0].id]));
    }
    else {
      exitStatus = EnigmailDialog.confirmDlg(window,
        EnigmailLocale.getString("doImportMultiple", [
          preview.map(function(a) {
            return "\t" + a.name + " (" + a.id + ")";
          }).join("\n")
        ]));
    }

    if (exitStatus) {
      // import
      let exitCode = EnigmailKeyRing.importKeyFromFile(inFile, errorMsgObj);
      if (exitCode !== 0) {
        EnigmailDialog.alert(window, EnigmailLocale.getString("importKeysFailed") + "\n\n" + errorMsgObj.value);
      }
      else {
        var keyList = preview.map(function(a) {
          return a.id;
        });
        EnigmailDialog.keyImportDlg(window, keyList);
        return true;
      }
    }
  }

  return false;
}
