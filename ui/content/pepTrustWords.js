/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const Ci = Components.interfaces;

Components.utils.import("chrome://enigmail/content/modules/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Components.utils.import("chrome://enigmail/content/modules/windows.jsm"); /*global EnigmailWindows: false */
Components.utils.import("chrome://enigmail/content/modules/key.jsm"); /*global EnigmailKey: false */
Components.utils.import("chrome://enigmail/content/modules/locale.jsm"); /*global EnigmailLocale: false */

const INPUT = 0;
const CLOSE_WIN = "close";

const MODE_USER_USER = 0;
const MODE_KEY_SYNC = 1;

const PEP_SYNC_HANDSHAKE_ACCEPTED = 0;
const PEP_SYNC_HANDSHAKE_REJECTED = 1;
const PEP_SYNC_HANDSHAKE_CANCEL = -1;


var gLocale = "";
var gDialogMode = MODE_USER_USER;

/**
  Argmuments (param[0]):
    - supportedLocale,
    - locale
    - otherId
    - userRating
    - ownId
    - trustWords
    - dialogMode (0: user/user, 1: keySync)
*/
function onLoad() {
  let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.loadSheetUsingURIString("chrome://enigmail/skin/enigmail.css", 1);

  let argsObj = window.arguments[INPUT];
  let supportedLocale = argsObj.supportedLocale;
  gLocale = argsObj.locale;

  if ("dialogMode" in argsObj) gDialogMode = argsObj.dialogMode;

  for (let i = 0; i < supportedLocale.length; i++) {
    let item = appendLocaleMenuEntry(supportedLocale[i].short, supportedLocale[i].long);
    if (supportedLocale[i].short === argsObj.locale) {
      document.getElementById("selectTwLocale").selectedItem = item;
    }
  }

  let partnerEmail = document.getElementById("partnerEmailAddr");
  if (gDialogMode === MODE_USER_USER) {
    partnerEmail.setAttribute("value", argsObj.otherId.username + " <" + argsObj.otherId.address + ">");
    partnerEmail.setAttribute("class", EnigmailPEPAdapter.getRatingClass(argsObj.userRating.rating));
    document.getElementById("partnerFprLbl").setAttribute("value", EnigmailLocale.getString("pepTrustWords.partnerFingerprint", argsObj.otherId.address));
    document.getElementById("partnerFpr").setAttribute("value", EnigmailKey.formatFpr(argsObj.otherId.fpr));
    document.getElementById("myFpr").setAttribute("value", EnigmailKey.formatFpr(argsObj.ownId.fpr));
  }
  else {
    partnerEmail.setAttribute("collapsed", "true");
    document.getElementById("partnerFpr").setAttribute("collapsed", "true");
    document.getElementById("fprBox").setAttribute("collapsed", "true");
    document.getElementById("selectVerifyType").setAttribute("collapsed", "true");
    document.getElementById("overallDesc").setAttribute("collapsed", "true");
    document.getElementById("keySyncDesc").removeAttribute("collapsed");
  }

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
    if (("result" in data) && typeof data.result === "object" && typeof data.result.outParams[1] === "string") {
      let trustWords = data.result.outParams[1];
      displayTrustWords(trustWords);
    }
  }).
  catch(function _err() {});
}


function onAccept() {
  if (gDialogMode == MODE_USER_USER) {
    return acceptUserHandshake();
  }
  else {
    return completeKeySync(PEP_SYNC_HANDSHAKE_ACCEPTED);
  }
}

function acceptUserHandshake() {
  let argsObj = window.arguments[INPUT];

  if (argsObj.otherId) {
    EnigmailPEPAdapter.pep.resetIdentityTrust(argsObj.otherId).
    then(function _resetDone() {
      return EnigmailPEPAdapter.pep.trustIdentity(argsObj.otherId);
    }).
    then(function _trustDone(data) {
      if (!("result" in data && (typeof data.result === "object") && data.result.return.status === 0)) {
        EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotStoreChange", argsObj.otherId.address));
      }
      window.close();
    }).
    catch(function _err() {});
  }

  return false;
}


function onMistrustKey() {
  if (gDialogMode === MODE_USER_USER) {
    let argsObj = window.arguments[INPUT];

    if (argsObj.otherId) {
      EnigmailPEPAdapter.pep.mistrustIdentity(argsObj.otherId).then(function _trustDone(data) {
        if (!("result" in data && (typeof data.result === "object") && data.result.return.status === 0)) {
          EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotStoreChange", argsObj.otherId.address));
        }
        window.close();
      });
    }
  }
  else completeKeySync(PEP_SYNC_HANDSHAKE_REJECTED);
}

function completeKeySync(keySyncResult) {
  let argsObj = window.arguments[INPUT];

  if (argsObj.otherId) {
    EnigmailPEPAdapter.pep.deliverHandshakeResult(argsObj.otherId, keySyncResult).
    then(function _syncDone(data) {
      if (!("result" in data && (typeof data.result === "object") && data.result.return.status === 0)) {
        EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotStoreChange", argsObj.otherId.address));
      }
      window.close();
    }).
    catch(function _err() {});
  }

  return false;
}

function onCancel() {
  if (gDialogMode === MODE_KEY_SYNC) {
    completeKeySync(PEP_SYNC_HANDSHAKE_CANCEL);
  }

  return true;
}


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
