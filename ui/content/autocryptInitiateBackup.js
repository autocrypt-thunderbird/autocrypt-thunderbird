/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/autocrypt.jsm"); /*global EnigmailAutocrypt: false */

var gAccountList;
var gAccountManager;
var gCurrentIdentity = null;

function onLoad() {

  gAccountList = document.getElementById("selectedAccount");
  gAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);

  for (let acct = 0; acct < gAccountManager.accounts.length; acct++) {
    let ac = gAccountManager.accounts.queryElementAt(acct, Ci.nsIMsgAccount);

    for (let i = 0; i < ac.identities.length; i++) {
      let id = ac.identities.queryElementAt(i, Ci.nsIMsgIdentity);
      createIdentityEntry(ac, id);
    }
  }
  gAccountList.selectedIndex = 0;

}


function onSelectAccount(element) {
  gCurrentIdentity = element.value;
}

function createIdentityEntry(acct, id) {
  let srv = acct.incomingServer.prettyName;
  if (!gCurrentIdentity) {
    gCurrentIdentity = id.key;
  }

  gAccountList.appendItem(srv + " - " + id.identityName, id.key);
}

function getWizard() {
  return document.getElementById("enigmailInitiateACBackup");
}

function onNext() {
  let wizard = getWizard();
  if (wizard.currentPage && wizard.currentPage.pageid == "pgSelectId") {
    createSetupMessage();
  }

  return true;
}

function onCancel() {
  return true;
}

function createSetupMessage() {

  let id = gAccountManager.getIdentity(gCurrentIdentity);

  EnigmailAutocrypt.sendSetupMessage(id).then(passwd => {
    if (passwd) {
      for (let i = 1; i < 10; i++) {
        let e = document.getElementById("l" + i);
        e.value = passwd.substr((i - 1) * 5, 4);
      }
    }
  }).
  catch(err => {
    EnigmailDialog.alert(window, "Got error " + err);
  });
}
