/*
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
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net> are
 * Copyright (C) 2003 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function EnigmailPrefService() {}

EnigmailPrefService.prototype = {
  name: "enigprefs",
  chromePackageName: "enigmail",
  classID:  Components.ID("{847b3ab0-7ab1-11d4-8f02-006008948af5}"),
  classDescription: "Enigmail Account Manager Extension Service",
  contractID: "@mozilla.org/accountmanager/extension;1?name=enigprefs",
  _xpcom_categories: [{
    category: "mailnews-accountmanager-extensions",
    entry: "Enigmail account manager extension",
    service: false
  }],
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMsgAccountManagerExtension]),
  showPanel: function (server)
  {
    // show Enigmail panel for POP3, IMAP, NNTP and "movemail" (unix) account types
    switch (server.type) {
    case "nntp":
    case "imap":
    case "pop3":
    case "movemail":
      return true;
    }
    return false;
  }
};

if (XPCOMUtils.generateNSGetFactory) {
  // Gecko >= 2.0
  var components = [EnigmailPrefService];
  const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
}
else {
  // Gecko <= 1.9.x
  var NSGetModule = XPCOMUtils.generateNSGetModule([EnigmailPrefService], postModuleRegisterCallback);

}

function postModuleRegisterCallback (compMgr, fileSpec, componentsArray) {
  dump("Enigmail account manager extension registered\n");
}
