/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Components.utils.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Components.utils.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */

const INPUT = 0;
const CLOSE_WIN = "close";

var gLocale = "";

function onLoad() {
  let argsObj = window.arguments[INPUT];
  let supportedLocale = argsObj.supportedLocale;
  gLocale = argsObj.locale;

  for (let i = 0; i < supportedLocale.length; i++) {
    let item = appendLocaleMenuEntry(supportedLocale[i].short, supportedLocale[i].long);
    if (supportedLocale[i].short === argsObj.locale) {
      document.getElementById("selectTwLocale").selectedItem = item;
    }
  }

  let partnerEmail = document.getElementById("partnerEmailAddr");
  partnerEmail.setAttribute("value", argsObj.otherId.username + " <" + argsObj.otherId.address + ">");
  partnerEmail.setAttribute("class", EnigmailPEPAdapter.getRatingClass(argsObj.userRating.rating));
  document.getElementById("partnerFprLbl").setAttribute("value", EnigmailLocale.getString("pepTrustWords.partnerFingerprint", argsObj.otherId.address));
  document.getElementById("partnerFpr").setAttribute("value", EnigmailKey.formatFpr(argsObj.otherId.fpr));
  document.getElementById("myFpr").setAttribute("value", EnigmailKey.formatFpr(argsObj.ownId.fpr));
  displayTrustWords(argsObj.trustWords);
}

function appendLocaleMenuEntry(localeShort, localeLong) {
  let localeMenu = document.getElementById("selectTwLocale");
  let m = localeMenu.appendItem(localeLong, localeShort);
  m.setAttribute("oncommand", "getTrustWords('" + localeShort + "')");
  return m;
}


function displayTrustWords(trustWords) {
  document.getElementById("wordList").setAttribute("value", trustWords);
}

function getTrustWords(locale) {
  gLocale = locale;
  let verifyType = document.getElementById("selectVerifyType").selectedItem;

  let longWordList = false;
  if (verifyType && verifyType.value === "tw-1") {
    longWordList = true;
  }

  let argsObj = window.arguments[INPUT];
  EnigmailPEPAdapter.getTrustWordsForLocale(argsObj.ownId, argsObj.otherId, locale, longWordList).
  then(function _f(data) {
    if (("result" in data) && typeof data.result === "object" && typeof data.result[1] === "string") {
      let trustWords = data.result[1];
      displayTrustWords(trustWords);
    }
  }).
  catch(function _err() {});
}


function onAccept() {
  let argsObj = window.arguments[INPUT];

  if (argsObj.otherId) {
    EnigmailPEPAdapter.pep.resetIdentityTrust(argsObj.otherId).
    then(function _resetDone() {
      return EnigmailPEPAdapter.pep.trustIdentity(argsObj.otherId);
    }).
    then(function _trustDone(data) {
      if (!("result" in data && (typeof data.result === "object") && data.result[0].status === 0)) {
        EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotStoreChange", argsObj.otherId.address));
      }
      window.close();
    }).
    catch(function _err() {});
  }

  return false;
}

function onMistrustKey() {
  let argsObj = window.arguments[INPUT];

  if (argsObj.otherId) {
    EnigmailPEPAdapter.pep.mistrustIdentity(argsObj.otherId).then(function _trustDone(data) {
      if (!("result" in data && (typeof data.result === "object") && data.result[0].status === 0)) {
        EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotStoreChange", argsObj.otherId.address));
      }
      window.close();
    });
  }
}

function onCancel() {}


function changeVerifcationType(type) {
  if (type === "tw") {
    // display trustwords
    document.getElementById("wordList").removeAttribute("collapsed");
    document.getElementById("fprBox").setAttribute("collapsed", "true");
    document.getElementById("selectTwLocale").removeAttribute("disabled");

    getTrustWords(gLocale);
  }
  else {
    // display fingerprint
    document.getElementById("fprBox").removeAttribute("collapsed");
    document.getElementById("wordList").setAttribute("collapsed", "true");
    document.getElementById("selectTwLocale").setAttribute("disabled", "true");
  }
}
