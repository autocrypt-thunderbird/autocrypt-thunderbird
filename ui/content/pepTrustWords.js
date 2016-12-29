/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Components.utils.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Components.utils.import("resource://enigmail/promise.jsm"); /*global Promise: false */
Components.utils.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */

const INPUT = 0;
const CLOSE_WIN = "close";
var emailId = null;
var useOwnId = null;
var useLocale = "en";
var emailAddress = "";

function onLoad() {
  let argsObj = window.arguments[INPUT];
  let ownIds = [];
  let supportedLocale = [];

  let uiLocale = EnigmailLocale.getUILocale().substr(0, 2).toLowerCase();

  emailAddress = argsObj.emailAddress.toLowerCase();

  let allEmails = "";

  if ("from" in argsObj.headerData) {
    allEmails += argsObj.headerData.from.headerValue + ",";
  }
  if ("to" in argsObj.headerData) {
    allEmails += argsObj.headerData.to.headerValue + ",";
  }
  if ("cc" in argsObj.headerData) {
    allEmails += argsObj.headerData.cc.headerValue + ",";
  }

  let emailsInMessage = EnigmailFuncs.stripEmail(allEmails.toLowerCase()).split(/,/);

  EnigmailPEPAdapter.pep.getOwnIdentities().then(function _gotOwnIds(data) {
    if (("result" in data) && typeof data.result[0] === "object" && Array.isArray(data.result[0])) {
      ownIds = data.result[0];
    }

    for (let i = 0; i < ownIds.length; i++) {
      if (ownIds[i].address.toLowerCase() === emailAddress) {
        EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotVerifyOwnId"));
        let deferred = Promise.defer();
        deferred.reject(CLOSE_WIN);
        return deferred.promise;
      }

      useOwnId = ownIds[0];
      for (let j = 0; j < emailsInMessage.length; j++) {
        if (ownIds[i].address.toLowerCase() === emailsInMessage[j]) {
          useOwnId = ownIds[i];
          break;
        }
      }
    }

    return EnigmailPEPAdapter.getIdentityForEmail(emailAddress);
  }).then(function _gotIdentityForEmail(data) {
    if (("result" in data) && typeof data.result === "object" && typeof data.result[0] === "object") {
      emailId = data.result[0];
    }
    else {
      EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotFindKey", emailAddress));
      let deferred = Promise.defer();
      deferred.reject(CLOSE_WIN);
      return deferred.promise;
    }

    return EnigmailPEPAdapter.getSupportedLanguages();
  }).then(function _gotLocale(supportedLocale) {

    for (let i = 0; i < supportedLocale.length; i++) {
      let item = appendLocaleMenuEntry(supportedLocale[i].short, supportedLocale[i].long);
      if (supportedLocale[i].short === uiLocale) {
        useLocale = supportedLocale[i].short;
        document.getElementById("selectTwLocale").selectedItem = item;
      }
    }

    document.getElementById("partnerEmailAddr").setAttribute("value", emailId.address);
    document.getElementById("myEmailAddr").setAttribute("value", useOwnId.address);
    getTrustWords(useLocale);
  }).catch(function _err(errorMsg) {
    if (!((typeof errorMsg === typeof CLOSE_WIN) && (errorMsg === CLOSE_WIN))) {
      EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.generalFailure", emailAddress));
    }
    window.close();
  });
}

function appendLocaleMenuEntry(localeShort, localeLong) {
  let localeMenu = document.getElementById("selectTwLocale");
  let m = localeMenu.appendItem(localeLong, localeShort);
  m.setAttribute("oncommand", "getTrustWords('" + localeShort + "')");
  return m;
}


function getTrustWords(language) {
  // TODO: broken in pEp
  //EnigmailPEPAdapter.pep.getTrustWords(useOwnId, emailId, language).
  simulateTrustWords(useOwnId, emailId, language).
  then(function _gotTrustWords(data) {
    if (("result" in data) && typeof data.result === "object" && typeof data.result[0] === "string") {
      let trustWords = data.result[0];
      document.getElementById("wordList").textContent = trustWords;
      resizeDlg();
    }
    else {
      EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.generalFailure", emailAddress));
    }
  }).
  catch(function _err(errorMsg) {});
}

function simulateTrustWords(useOwnId, emailId, locale) {
  let deferred = Promise.defer();
  let tw = locale + " - IMMUNITY EXCERCISE MASTERPLAN SOMETHING OVERWHELMING SEEMINLGY PERTURBATING SENSITIVITY IRREGULARLY SETTLEMENT";

  if (locale === "de") {
    tw = "IMMUNITÄT STICHPROBENARTIG INFEKTIÖS AUFZUPRÄGEN WANKEN KURSIEREN BEZIEHEN BOOMEN AUFGEHETZT AUSLÖSEN";
  }

  deferred.resolve({
    jsonrpc: "2.0",
    result: [tw, {
      status: 0,
      hex: "PEP_STATUS_OK"
    }],
    id: 2
  });
  return deferred.promise;
}

function onAccept() {
  if (emailId) {
    EnigmailPEPAdapter.pep.trustIdentity(emailId).then(function _trustDone(data) {
      if (!("result" in data && (typeof data.result === "object") && data.result[0].status === 0)) {
        EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotStoreChange", emailId.address));
      }
      window.close();
    });
  }
  return false;
}

function onCancel() {}


function resizeDlg() {
  window.sizeToContent();
}
