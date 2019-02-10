/*global Enigmail: false, Assert: false, do_load_module: false, JSUnit: false, Components: false, do_get_cwd: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");
/* global component: false, test: false, withTestGpgHome: false, withEnigmail: false, do_get_file: false, withOverwriteFuncs: false */
var window = JSUnit.createStubWindow();
var document = {
  getElementById: function(elemId) {
    if (elemId === "attachmentBucket") {
      return {
        hasChildNodes: function() {
          return false;
        }
      };
    }

    return null;
  }
};
window.document = document;

do_load_module("chrome://enigmail/content/ui/enigmailMsgComposeOverlay.js");
/* global EnigmailMimeEncrypt: false */
/* global EnigmailTb60Compat: false */
/* global EnigmailConstants: false */
/* global EnigmailLocale: false */
/* global EnigmailKeyRing: false */

const SECURITY_INFO = EnigmailTb60Compat.getSecurityField();

var gMsgCompose,
  gWindowLocked,
  getCurrentIdentity;

function Attachments2CompFields() {}

function DetermineConvertibility() {
  return Ci.nsIMsgCompConvertible.Yes;
}

function TestEditor(editorContent) {
  this._editorContent = editorContent;
}

TestEditor.prototype = {
  QueryInterface: EnigmailTb60Compat.generateQI([
    "nsIEditorMailSupport",
    "nsIPlaintextEditor"
  ]),

  wrapWidth: 72,
  documentCharacterSet: "utf-8",
  rewrap: function() {
    Assert.ok(false);
  },
  outputToString: function() {
    return this._editorContent;
  },
  insertAsQuotation: function(data) {
    this._editorContent = data;
  },
  insertTextWithQuotations: function(data) {
    this._editorContent = data;
  },
  selectAll: function() {}
};

test(withTestGpgHome(withEnigmail(withOverwriteFuncs(
  [{
    obj: Enigmail.msg,
    fn: "enableUndoEncryption",
    new: function() {}
  }],
  function encryptMsg_test1() {
    const isWin = (Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS === "WINNT");
    let secKey;
    if (!isWin) {
      secKey = do_get_file("../../package/tests/resources/dev-strike.sec", false);
    } else {
      secKey = do_get_file("..\\..\\package\\tests\\resources\\dev-strike.sec", false);
    }
    const importedKeysObj = {};
    const importResult = EnigmailKeyRing.importKeyFromFile(secKey, {}, importedKeysObj);

    const DeliverMode = Components.interfaces.nsIMsgCompDeliverMode;
    Enigmail.msg.statusEncrypted = EnigmailConstants.ENIG_FINAL_YES;
    Enigmail.msg.statusSigned = EnigmailConstants.ENIG_FINAL_YES;
    Enigmail.msg.statusPGPMime = EnigmailConstants.ENIG_FINAL_FORCEYES;

    gMsgCompose = {
      compFields: Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields),
      editor: new TestEditor("This is a test message!"),
      composeHTML: false
    };

    Enigmail.msg.juniorMode = false;
    Enigmail.msg.sendPgpMime = true;
    Enigmail.msg.protectHeaders = true;
    Enigmail.msg.editor = gMsgCompose.editor;
    let s = Enigmail.msg.getEncryptionFlags(DeliverMode.Now);
    Assert.equal(s.sendFlags, EnigmailConstants.SEND_ENCRYPTED | EnigmailConstants.SEND_SIGNED);

    gWindowLocked = false;
    gMsgCompose.compFields[SECURITY_INFO] = EnigmailMimeEncrypt.createMimeEncrypt(null);

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

    // Create PGP/MIME message
    gMsgCompose.compFields.to = "strike.devtest@gmail.com";
    gMsgCompose.compFields.from = "strike.devtest@gmail.com";
    let r = Enigmail.msg.encryptMsg();
    Assert.equal(r, true);
    let si = gMsgCompose.compFields[SECURITY_INFO].wrappedJSObject;

    Assert.equal(si.recipients, "0x65537E212DC19025AD38EDB2781617319CE311C4", "recipients");
    Assert.ok(si.sendFlags & EnigmailConstants.SEND_ENCRYPTED | EnigmailConstants.SEND_PGP_MIME, "sendFlags");

    // Create inline-PGP message
    Enigmail.msg.statusPGPMime = EnigmailConstants.ENIG_FINAL_FORCENO;
    Enigmail.msg.sendPgpMime = false;

    r = Enigmail.msg.encryptMsg();
    Assert.equal(r, true);
    si = gMsgCompose.compFields[SECURITY_INFO].wrappedJSObject;

    Assert.equal(si.recipients, "", "recipients");
    Assert.equal(si.sendFlags & EnigmailConstants.SEND_ENCRYPTED, 0, "sendFlags");
    Assert.equal(gMsgCompose.editor.outputToString().substr(0, 27), "-----BEGIN PGP MESSAGE-----");

  }))));