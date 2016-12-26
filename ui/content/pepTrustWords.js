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

const INPUT = 0;
const CLOSE_WIN = "close";
var emailId = null;


function onLoad() {
  let argsObj = window.arguments[INPUT];
  let ownIds = [];
  let useOwnId = 0;

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
        EnigmailWindows.alert(null, "Cannot verify trustwords for own account.");
        let deferred = Promise.defer();
        deferred.reject(CLOSE_WIN);
        return deferred.promise;
      }

      for (let j = 0; j < emailsInMessage.length; j++) {
        if (ownIds[i].address.toLowerCase() === emailsInMessage[j]) {
          useOwnId = i;
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
      EnigmailWindows.alert(null, "Cannot find key for " + argsObj.emailAddress + ".");
      let deferred = Promise.defer();
      deferred.reject(CLOSE_WIN);
      return deferred.promise;
    }

    document.getElementById("emailAddress").setAttribute("value", emailId.address);
    document.getElementById("wordList").setAttribute("value", ownIds[useOwnId].address);
  }).catch(function _err(errorMsg) {
    if (!((typeof errorMsg === typeof CLOSE_WIN) && (errorMsg === CLOSE_WIN))) {
      EnigmailWindows.alert(null, "Cannot verify trustwords for " + argsObj.emailAddress + ".");
    }
    window.close();
  });



  /*
    EnigmailPEPAdapter.getTrustWordsForEmail(emailAddr, "en").
    then(function _succeed(trustWords) {}).
    catch(function _err(data) {
      EnigmailWindows.alert(window, "Cannot verify trustwords for " + emailAddr + ".");
    });

  */


}

function onAccept() {
  if (emailId) {
    EnigmailPEPAdapter.pep.trustIdentity(emailId).then(function _trustDone(data) {
      if (!("result" in data && (typeof data.result === "object") && data.result[0].status === 0)) {
        EnigmailWindows.alert(null, "Could not change trust for " + emailId.address + ".");
      }
      window.close();
    });
  }
  return false;
}

function onCancel() {}
