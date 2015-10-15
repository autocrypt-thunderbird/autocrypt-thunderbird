/*
 * ***** BEGIN LICENSE BLOCK *****
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


Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/keyEditor.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */

var gKeyList = [];

function onLoad() {
  // set current key trust if only one key is changed
  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc)
    return;

  var errorMsgObj = {};
  var exitCodeObj = {};

  try {
    window.arguments[1].refresh = false;
    var currTrust = -1;
    var lastTrust = -1;

    gKeyList = [];
    let k = window.arguments[0].keyId;

    for (let i in k) {
      let o = EnigmailKeyRing.getKeyById(k[i]);
      if (o) {
        gKeyList.push(o);
      }
    }

    if (gKeyList.length > 0) {
      for (let i = 0; i < gKeyList.length; i++) {
        currTrust = (("-nmfuq").indexOf(gKeyList[i].keyTrust) % 5) + 1;
        if (lastTrust == -1) lastTrust = currTrust;
        if (currTrust != lastTrust) {
          currTrust = -1;
          break;
        }
      }
    }
    if (currTrust > 0) {
      var t = document.getElementById("trustLevel" + currTrust.toString());
      document.getElementById("trustLevelGroup").selectedItem = t;
    }
  }
  catch (ex) {}

  var keyIdList = document.getElementById("keyIdList");

  for (let i = 0; i < gKeyList.length; i++) {
    var keyId = gKeyList[i].userId + " - 0x" + gKeyList[i].keyId.substr(-8, 8);
    keyIdList.appendItem(keyId);
  }
}

function processNextKey(index) {
  EnigmailLog.DEBUG("enigmailEditKeyTrust: processNextKey(" + index + ")\n");

  var t = document.getElementById("trustLevelGroup");

  EnigmailKeyEditor.setKeyTrust(window,
    gKeyList[index].keyId,
    Number(t.selectedItem.value),
    function(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigmailDialog.alert(window, EnigmailLocale.getString("setKeyTrustFailed") + "\n\n" + errorMsg);
        window.close();
        return;
      }
      else {
        window.arguments[1].refresh = true;
      }

      ++index;
      if (index >= gKeyList.length)
        window.close();
      else {
        processNextKey(index);
      }
    });
}

function onAccept() {
  processNextKey(0);

  return false;
}
