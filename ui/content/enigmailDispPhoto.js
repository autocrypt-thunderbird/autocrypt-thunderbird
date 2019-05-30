/*global Components: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";



var EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;
var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailTrust = ChromeUtils.import("chrome://enigmail/content/modules/trust.jsm").EnigmailTrust;
var EnigmailWindows = ChromeUtils.import("chrome://enigmail/content/modules/windows.jsm").EnigmailWindows;

var gRepaintCount = 0;
var gKeyId;

/* imports from enigmailCommon.js: */
/* global EnigGetTrustLabel: false */


function appendUid(uidStr) {
  let uidCont = document.getElementById("uidContainer");
  let l = document.createXULElement("label");
  l.setAttribute("value", uidStr);
  uidCont.appendChild(l);
}

function onLoad() {
  window.addEventListener("MozAfterPaint", resizeDlg, false);

  let key = EnigmailKeyRing.getKeyById(window.arguments[0].keyId);
  gKeyId = key.keyId;

  document.getElementById("photoImage").setAttribute("src", window.arguments[0].photoUri);
  for (let su of key.userIds) {
    if (su.type === "uid") {
      appendUid(su.userId);
    }
  }
  document.getElementById("keyId").setAttribute("value", EnigmailLocale.getString("keyId") + ": 0x" + gKeyId);
  document.getElementById("keyValidity").setAttribute("value", EnigmailTrust.getTrustLabel(key.keyTrust));
}

function resizeDlg(event) {
  ++gRepaintCount;
  window.sizeToContent();
  if (gRepaintCount > 3) {
    removeListener();
  }
}

function removeListener() {
  window.removeEventListener("MozAfterPaint", resizeDlg, false);
}

function displayKeyProps() {
  EnigmailWindows.openKeyDetails(window, gKeyId, false);
}