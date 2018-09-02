/*global Enigmail: false, Assert: false, do_load_module: false, JSUnit: false, Components: false, do_get_cwd: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");
/* global component: false, test: false, withTestGpgHome: false, withEnigmail: false, do_get_file: false */

var window = JSUnit.createStubWindow();
var document = JSUnit.createDOMDocument();
window.document = document;

do_load_module("chrome://enigmail/content/ui/enigmailMsgComposeOverlay.js");
/* global EnigmailMimeEncrypt: false */

component("enigmail/constants.jsm"); /* global EnigmailConstants: false */
component("enigmail/locale.jsm"); /* global EnigmailLocale: false */
component("enigmail/keyRing.jsm"); /* global EnigmailKeyRing: false */


var gMsgCompose, gWindowLocked, getCurrentIdentity;

function Attachments2CompFields() {}

test(withTestGpgHome(withEnigmail(function encryptMsg_test1() {
  const secKey = do_get_file("../../package/tests/resources/dev-strike.sec", false);
  const importedKeysObj = {};
  const importResult = EnigmailKeyRing.importKeyFromFile(secKey, {}, importedKeysObj);

  const DeliverMode = Components.interfaces.nsIMsgCompDeliverMode;
  Enigmail.msg.statusEncrypted = EnigmailConstants.ENIG_FINAL_YES;
  Enigmail.msg.statusSigned = EnigmailConstants.ENIG_FINAL_YES;
  Enigmail.msg.statusPGPMime = EnigmailConstants.ENIG_FINAL_FORCEYES;

  Enigmail.msg.juniorMode = false;
  Enigmail.msg.sendPgpMime = true;
  Enigmail.msg.protectHeaders = true;
  let s = Enigmail.msg.getEncryptionFlags(DeliverMode.Now);
  Assert.equal(s.sendFlags, EnigmailConstants.SEND_ENCRYPTED |  EnigmailConstants.SEND_SIGNED);

  gWindowLocked = false;
  gMsgCompose = {
    compFields: Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields)
  };

  gMsgCompose.compFields.securityInfo = EnigmailMimeEncrypt.createMimeEncrypt(null);

  Enigmail.hlp = {
    validKeysForAllRecipients: function(toAddrStr) {
      Assert.equal(toAddrStr, "strike.devtest@gmail.com");
      return ["0x65537E212DC19025AD38EDB2781617319CE311C4"];
    },
    getInvalidAddress: function(toAddrStr) {
      Assert.equal(toAddrStr, "");
      return [];
    }
  };

  getCurrentIdentity = function() {
    return {
      email: "strike.devtest@gmail.com",
      getBoolAttribute: function(param) {
        switch (param) {
          case "enablePgp":
            return true;
        }
        return false;
      },
      getIntAttribute: function(param) {
        switch (param) {
          case "pgpKeyMode":
            return 1;
        }
        return 0;
      },
      getCharAttribute: function(param) {
        switch (param) {
          case "pgpkeyId":
            return "0x65537E212DC19025AD38EDB2781617319CE311C4";
        }
        return "";
      },
      setCharAttribute: function(param, value) {
        switch (param) {
          case "pgpkeyId":
            Assert.equal(value, "0x65537E212DC19025AD38EDB2781617319CE311C4");
            break;
        }
      }
    };
  };

  gMsgCompose.compFields.to = "strike.devtest@gmail.com";
  gMsgCompose.compFields.from = "strike.devtest@gmail.com";
  let r = Enigmail.msg.encryptMsg();
  Assert.equal(r, true);
  let si = gMsgCompose.compFields.securityInfo.wrappedJSObject;

  Assert.equal(si.recipients, "0x65537E212DC19025AD38EDB2781617319CE311C4", "recipients");
  Assert.ok(si.sendFlags & EnigmailConstants.SEND_ENCRYPTED, "sendFlags");
})));
