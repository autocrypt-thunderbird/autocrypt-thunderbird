/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/app.jsm"); /*global EnigmailApp: false */
Cu.import("resource://enigmail/buildDate.jsm"); /*global EnigmailBuildDate: false */
Cu.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */

var gAccountList;
var gAccountManager;
var gCurrentIdentity = null;
var gTrustedServer;
var gEnableEncryption;
var gPassiveMode;
var gProtectedSubject;
var gWarnReply;
var gLookupKeys;
var gJuniorMode;

function onLoad() {

  gAccountList = document.getElementById("selectedAccount");
  gTrustedServer = document.getElementById("trustedServer");
  gEnableEncryption = document.getElementById("enableEncryption");
  gPassiveMode = document.getElementById("passiveMode");
  gProtectedSubject = document.getElementById("protectedSubject");
  gWarnReply = document.getElementById("warnReply");
  gLookupKeys = document.getElementById("lookupKeys");
  gJuniorMode = EnigmailPrefs.getPref("juniorMode");
  document.getElementById("juniorMode").value = gJuniorMode;

  gLookupKeys.checked = (EnigmailPrefs.getPref("autoKeyRetrieve").length > 0);

  let versionNum = EnigmailApp.getVersion() + " (" + EnigmailBuildDate + ")";
  let displayVersion = EnigmailLocale.getString("enigmailPepVersion", versionNum);
  document.getElementById("enigmailVersion").setAttribute("value", displayVersion);

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

function onAccept() {
  storeIdentitySettings();

  let origLookupKeys = (EnigmailPrefs.getPref("autoKeyRetrieve").length > 0);

  EnigmailPrefs.setPref("autoKeyRetrieve", gLookupKeys.checked ? "pool.sks-keyservers.net" : "");
  EnigmailPrefs.setPref("juniorMode", gJuniorMode);

  if (gLookupKeys.checked && (!origLookupKeys)) {
    EnigmailPEPAdapter.pep.startKeyserverLookup();
  }
  else if ((!gLookupKeys.checked) && origLookupKeys) {
    EnigmailPEPAdapter.pep.stopKeyserverLookup();
  }

  EnigmailPrefs.savePrefs();
}

function onSelectAccount(element) {
  if (gCurrentIdentity) {
    storeIdentitySettings();
  }

  gCurrentIdentity = element.value;
  loadIdentitySettings();
}

function createIdentityEntry(acct, id) {
  let srv = acct.incomingServer.prettyName;
  if (!gCurrentIdentity) {
    gCurrentIdentity = id.key;
    loadIdentitySettings();
  }

  gAccountList.appendItem(srv + " - " + id.identityName, id.key);
}


function loadIdentitySettings() {
  let id = gAccountManager.getIdentity(gCurrentIdentity);

  gTrustedServer.checked = id.getBoolAttribute("autoEncryptDrafts");
  gEnableEncryption.checked = id.getBoolAttribute("enablePEP");
  gPassiveMode.checked = id.getBoolAttribute("attachPepKey");
  gProtectedSubject.checked = id.getBoolAttribute("protectSubject");
  gWarnReply.checked = id.getBoolAttribute("warnWeakReply");
}

function storeIdentitySettings() {
  let id = gAccountManager.getIdentity(gCurrentIdentity);

  id.setBoolAttribute("autoEncryptDrafts", gTrustedServer.checked);
  id.setBoolAttribute("enablePEP", gEnableEncryption.checked);
  id.setBoolAttribute("attachPepKey", gPassiveMode.checked);
  id.setBoolAttribute("protectSubject", gProtectedSubject.checked);
  id.setBoolAttribute("warnWeakReply", gWarnReply.checked);
}


function contentAreaClick(event) {
  let t = event.target;

  return openURL(t);
}

function openURL(hrefObj) {
  if (!hrefObj) return true;

  let href = hrefObj.getAttribute("href");
  if (!href || !href.length) return true;

  if (href.substr(0, 1) === ">") {
    href = hrefObj.getAttribute(href.substr(1));
  }

  let ioservice = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  let iUri = ioservice.newURI(href, null, null);
  let eps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);

  eps.loadURI(iUri, null);

  return false;
}

function juniorModeCallback(item) {
  gJuniorMode = Number(item.value);
}
