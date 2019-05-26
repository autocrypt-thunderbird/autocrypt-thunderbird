/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

var EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
var EnigmailKeyEditor = ChromeUtils.import("chrome://enigmail/content/modules/keyEditor.jsm").EnigmailKeyEditor;
var EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;

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
        currTrust = (("-nmfuq").indexOf(gKeyList[i].ownerTrust) % 5) + 1;
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
  } catch (ex) {}

  var keyIdList = document.getElementById("keyIdList");

  for (let i = 0; i < gKeyList.length; i++) {
    var keyId = gKeyList[i].userId + " - 0x" + gKeyList[i].keyId;
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
      } else {
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

document.addEventListener("dialogaccept", function(event) {
  if (!onAccept())
    event.preventDefault(); // Prevent the dialog closing.
});