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
var useLocale = "";

function onLoad() {
  let argsObj = window.arguments[INPUT];
  let ownIds = [];
  let supportedLocale = [];

  let uiLocale = EnigmailLocale.getUILocale().substr(0, 2).toLowerCase();
  useLocale = "en";

  argsObj.emailAddress = argsObj.emailAddress.toLowerCase();

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
      if (ownIds[i].address.toLowerCase() === argsObj.emailAddress) {
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

    return EnigmailPEPAdapter.getIdentityForEmail(argsObj.emailAddress);
  }).then(function _gotIdentityForEmail(data) {
    if (("result" in data) && typeof data.result === "object" && typeof data.result[0] === "object") {
      emailId = data.result[0];
    }
    else {
      EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.cannotFindKey", argsObj.emailAddress));
      let deferred = Promise.defer();
      deferred.reject(CLOSE_WIN);
      return deferred.promise;
    }

    return EnigmailPEPAdapter.getSupportedLanguages();
  }).then(function _gotLocale(localeArr) {
    supportedLocale = localeArr;
    let i = supportedLocale.indexOf(uiLocale);
    if (i > 0) {
      useLocale = uiLocale;
    }

    // TODO: broken in pEp
    //return EnigmailPEPAdapter.pep.getTrustWords(useOwnId, emailId, useLocale);
    return simulateTrustWords(useOwnId, emailId, useLocale);
  }).then(function _gotTrustWords(data) {
    if (("result" in data) && typeof data.result === "object" && typeof data.result[0] === "string") {
      let trustWords = data.result[0];
      document.getElementById("emailAddress").setAttribute("value", emailId.address);
      document.getElementById("wordList").setAttribute("value", trustWords);
    }
    else {
      throw "error";
    }
  }).catch(function _err(errorMsg) {
    if (!((typeof errorMsg === typeof CLOSE_WIN) && (errorMsg === CLOSE_WIN))) {
      EnigmailWindows.alert(null, EnigmailLocale.getString("pepTrustWords.generalFailure", argsObj.emailAddress));
    }
    window.close();
  });
}

function simulateTrustWords(useOwnId, emailId, locale) {
  let deferred = Promise.defer();
  let tw = "HELLO WORLD";

  if (locale === "de") {
    tw = "HALLO WELT";
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
