/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */
/* global EnigmailKeyEditor: false, EnigmailLog: false, EnigmailLocale: false, EnigmailDialog: false */

"use strict";

Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/keyEditor.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/trust.jsm"); /*global EnigmailTrust: false */

var gExportableSignatureList = null;
var gLocalSignatureList = null;
var gUidCount = null;

function onLoad() {
  var key;
  var i;

  window.arguments[1].refresh = false;

  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc) {
    EnigmailDialog.alert(null, EnigmailLocale.getString("accessError"));
    window.close();
    return;
  }
  var keys = EnigmailKeyRing.getAllSecretKeys(true);
  if (keys.length === 0) {
    EnigmailDialog.alert(null, EnigmailLocale.getString("noTrustedOwnKeys"));
    window.close();
    return;
  }
  var menulist = document.getElementById("signWithKey");

  for (key of keys) {
    menulist.appendItem(key.userId + " - 0x" + key.keyId.substr(-8, 8), key.keyId);
  }
  if (menulist.selectedIndex == -1) {
    menulist.selectedIndex = 0;
  }

  // determine keys that have already signed the key
  try {
    var exitCodeObj = {};
    var errorMsgObj = {};
    gExportableSignatureList = [];
    gLocalSignatureList = [];
    var sigType = null;
    gUidCount = [];
    var keyId = null;

    var keyObj = EnigmailKeyRing.getKeyById(window.arguments[0].keyId);

    if (keyObj) {
      let sig = keyObj.signatures;
      var currKey = null;
      var currUID = null;
      gUidCount[keyObj.keyId] = 1;

      for (i in keyObj.signatures) {
        gUidCount[keyObj.keyId]++;
        let s = keyObj.signatures[i];
        for (let j in s.sigList) {
          sigType = s.sigList[j].sigType.charAt(s.sigList[j].sigType.length - 1);

          let signer = s.sigList[j].signerKeyId;

          if (sigType === "x") {
            if (gExportableSignatureList[signer] === undefined) {
              gExportableSignatureList[signer] = 1;
            }
            else {
              gExportableSignatureList[signer] += 1;
            }
          }
          if (sigType === "l") {
            if (gLocalSignatureList[signer] === undefined) {
              gLocalSignatureList[signer] = 1;
            }
            else {
              gLocalSignatureList[signer] += 1;
            }
          }
        }
      }
    }
    enigKeySelCb();

    var keyDesc = keyObj.userId + " - 0x" + keyObj.keyId.substr(-8, 8);
    document.getElementById("keyId").value = keyDesc;
    if (keyObj.fpr && keyObj.fpr.length > 0) {
      document.getElementById("fingerprint").value = keyObj.fprFormatted;
    }

    if (keyObj.hasSubUserIds()) {
      let sUid = document.getElementById("secondaryUids");
      let nUid = 0;

      for (let j = 1; j < keyObj.userIds.length; j++) {
        if (keyObj.userIds[j].type === "uid" && (!EnigmailTrust.isInvalid(keyObj.userIds[j].keyTrust))) {
          ++nUid;
          let uidLbl = document.createElement("label");
          uidLbl.setAttribute("value", keyObj.userIds[j].userId);
          sUid.appendChild(uidLbl);
        }
      }

      if (nUid > 0) {
        document.getElementById("secondaryUidRow").removeAttribute("collapsed");
      }
    }

  }
  catch (ex) {}
}

function onAccept() {
  var trustLevel = document.getElementById("trustLevel");
  var localSig = document.getElementById("localSig");
  var signWithKey = document.getElementById("signWithKey");

  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("accessError"));
    return true;
  }

  EnigmailKeyEditor.signKey(window,
    "0x" + signWithKey.selectedItem.value,
    window.arguments[0].keyId,
    localSig.checked,
    trustLevel.selectedItem.value,
    function(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigmailDialog.alert(window, EnigmailLocale.getString("signKeyFailed") + "\n\n" + errorMsg);
      }
      else {
        window.arguments[1].refresh = true;
      }
      window.close();
    }
  );

  return false; // wait with closing until subprocess terminated
}

function enigKeySelCb() {
  var keyToBeSigned = window.arguments[0].keyId;
  var keyToBeSigned32 = keyToBeSigned.substr(-8, 8);
  var signWithKey = document.getElementById("signWithKey");
  var signWithKeyId = signWithKey.selectedItem.value;
  var alreadySigned = document.getElementById("alreadySigned");
  var acceptButton = document.getElementById("enigmailSignKeyDlg").getButton("accept");
  var doLocalSig = document.getElementById("localSig");
  var signatureCount = 0;

  if (doLocalSig.checked) {
    signatureCount = gLocalSignatureList[signWithKeyId];
  }
  else {
    signatureCount = gExportableSignatureList[signWithKeyId];
  }

  if ((doLocalSig.checked) && (gExportableSignatureList[signWithKeyId] > 0)) {
    // User tries to locally sign a key he has already signed (at least partially) with an exportable signature
    // Here we display a hint and DISable the OK button
    alreadySigned.setAttribute("value", EnigmailLocale.getString("alreadySignedexportable.label", "0x" + keyToBeSigned32));
    alreadySigned.removeAttribute("collapsed");
    acceptButton.disabled = true;
  }
  else if (signatureCount === undefined) {
    // No signature yet, Hide hint field and ENable OK button
    alreadySigned.setAttribute("collapsed", "true");
    acceptButton.disabled = false;
  }
  else if (signatureCount == gUidCount[keyToBeSigned]) {
    // Signature count == UID count, so key is already fully signed and another signing operation makes no more sense
    // Here, we display a hint and DISable the OK button
    alreadySigned.setAttribute("value", EnigmailLocale.getString("alreadySigned.label", "0x" + keyToBeSigned32));
    alreadySigned.removeAttribute("collapsed");
    acceptButton.disabled = true;
  }
  else if (signatureCount > 0) {
    // Signature count != UID count, so key is partly signed and another sign operation makes sense
    // Here, we display a hint and ENable the OK button
    alreadySigned.setAttribute("value", EnigmailLocale.getString("partlySigned.label", "0x" + keyToBeSigned32));
    alreadySigned.removeAttribute("collapsed");
    acceptButton.disabled = false;
  }
  else {
    // Default catch for unforeseen cases. Hide hint field and enable OK button
    alreadySigned.setAttribute("collapsed", "true");
    acceptButton.disabled = false;
  }
}
