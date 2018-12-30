/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false */
/*global EnigmailCore: false, Cc: false, Ci: false, EnigmailFiles: false, EnigmailLog: false, EnigmailPrefs: false */
/*global Components: false, setupTestAccounts: false, setupTestAccount: false, getCurrentTime: true */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, addMacPaths: false, withEnigmail: false, withTestGpgHome: false, Cu: false*/
TestHelper.loadDirectly("tests/mailHelper.js"); /*global MailHelper: false */

testing("autoSetup.jsm"); /*global EnigmailAutoSetup: false, getMsgFolders: false, getStreamedMessage: false, getStreamedHeaders: false, checkHeaders: false */

component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
component("enigmail/autocrypt.jsm"); /*global EnigmailAutocrypt: false */
component("/modules/MailServices.jsm"); /*global MailServices: false */
component("enigmail/constants.jsm"); /*global EnigmailConstants: false */


const AC_HEADER =
  `addr=dev-tiger@test.notreal; prefer-encrypt=mutual; keydata=
mQENBFdGIzkBCADKys5q0rYiTr/FYdoupmNAJ0o20XWuFp/V58qsnQAMcAY2pCB/ydx9Y7
A80QjZPuVcE5QdROfvvkMXAA47ZxZrH79Kaqj11DS5XOgtLVtITGtWvrYqIFujxP42ICWB
h7LXUwrHfi93FX74ucXoWo/PZndbo+JBxc0ZsrHUdu24grTDuqLZQ8mRCx5U4tf+zEVIU6
kXubFzq8aPSnjfEg6MhXxSRictjIBKM0Ez2QwZmh1vAEmvn0kr0VaJJ7xVRgIH1CgNh/WW
tbr0lrblKCkFkTFnQfslWvSEko+LqvwgBSKyKg8VtWbYftnBkn8FPbP5Brp3wYgBc/c7mr
LROqAFABEBAAG0ImRldi10aWdlciA8ZGV2LXRpZ2VyQHRlc3Qubm90cmVhbD6JATcEEwEI
ACEFAldGIzkCGwMFCwkIBwIGFQgJCgsCBBYCAwECHgECF4AACgkQhDnhcEaXfEb3/gf/V0
da3gXN5TNOsWZKj/fI2FhQBglJ2vlEamnppwtnWZGktdFZ1h6ymzQ9PY3IidbKctqs/QQW
KtIBVh5k02fvUe99nsFZmINcLeajdu7IqvKxtFBuEwZAA1Bw9dhM3JRQM8z+l+CtbFh6dV
ufU7q5vVEXciCkhdn172QYTMAXNYE4Tfh7eaEAOdRyFcwiAGZ826pOp7Al52frK+MtaXa9
D2fRINlDXD9+IIR80sig2B4iBGeY+qAmE6bFuw7MtBya6uKupLjtAD/v48Z5wBYuU0jPld
4KH88IWksbQo1zW/O+1N7J1/U9ZGNwpvS+wtfyjlOpTS3YWGmY8sVturZqTrkBDQRXRiM5
AQgAsDN5j4viE5E8H5N9cfzQ9ZO5BUk66yI2DVEeasqZWFCkRA+uFHcTF6YpCoSn4/Jsvq
vUWVh63uV5vdAiU9+4sNFT8nkP7zD0LQthFtgEXqNo11NR7yvDRT3TOAnGaa+bLyoU/SLX
zSwctZksrQjzQJVSohQNznhj95XH3UEsUydHqje7ljp7NHWAJx+Tlp2Yh6q060/gwh37zs
fdVbaVtjeaAYECX3z6L7JB4KBb9KGlmDmOMngVUuR8XWWE+LEx0m7B+kZ+vZhUOSDDomBP
+8jGJmXlcIt8+LIBq0NeXs/YINCc89saUPw/V6X/NFRkekKFzIprCzwhg0LWl8oXAwARAQ
ABiQEfBBgBCAAJBQJXRiM5AhsMAAoJEIQ54XBGl3xGUvEH/jVTBoRfJ8ohc4Ahal8TyIm8
vdT/Ax/ddyyaLnCxkLFt0noBlA7062N1Fvv86Ts93EFrK9nF3g20gXKBKETo/vJRqtODIr
wtCMfzPbS/FkQweLtUDZXed0nq/Yaxk60H2HmWm+n9/126F3QIt7is0E3dY0e6DYJGRHnn
+lWnUs/8Ba16Zb/os3GgwEQwr4LPEty6CFQU2DNl5HmajeB1oEqmeDZ2f/y87GRpdCoTgu
dQiHMPdm2kPVbeAA6945W6Y2LSA5Hm+yS8s2dBs4+sEiW97owLz6vcak8Aw+7JFxL2JkoZ
uN28dueoVcFQw3uX0snoBXgo3LYsK71JoufrXhY=`;

function createCopyListener(callback) {
  return {
    // nsIRequestObserver
    OnStartCopy: function() {},
    OnProgress: function() {},
    SetMessageKey: function() {},
    GetMessageId: function() {
      return "";
    },
    OnStopCopy: function() {
      callback();
    }
  };
}

function copyMailToFolder(emlPath, folder) {
  //let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
  return new Promise((resolve, reject) => {
    var listener = createCopyListener(() => {
      resolve(0);
    });
    let emailFile = do_get_file(emlPath, false);
    MailServices.copy.CopyFileMessage(emailFile, folder, null, false, 0, null, listener, null);
  });
}


test(withTestGpgHome(withEnigmail(function determinePreviousInstallType_noAccount_Test() {

  getCurrentTime = function() {
    return new Date('2018-07-22T17:00:00').getTime() / 1000;
  };

  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  MailHelper.deleteAllAccounts();
  EnigmailAutoSetup.determinePreviousInstallType().then((returnMsgValue) => {
    Assert.equal(returnMsgValue.value, EnigmailConstants.AUTOSETUP_NO_ACCOUNT);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  MailHelper.init();
  setupTestAccounts("user1@enigmail-test.net");
})));

//testing: createAutocryptKey
test(withTestGpgHome(withEnigmail(function keyGenTest() {

  EnigmailKeyRing.clearCache();
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  const userName = 'Test Name';
  const userEmail = 'testing@domain.invalid';
  const KEY_ID = "0x4F128BD42AEA7F1D732123954C83EE00FF0245BE";

  EnigmailKeyRing.clearCache();

  EnigmailKeyRing._generateKey = EnigmailKeyRing.generateKey;

  EnigmailKeyRing.generateKey = function(userName, comment, userEmail, expiry, keyLength, keyType, passphrase, generateObserver) {
    let keyFile = do_get_file("resources/testing-domain.invalid.pub-sec", false);

    let exitCode = EnigmailKeyRing.importKeyFromFile(keyFile, {}, {});
    generateObserver.keyId = KEY_ID;
    generateObserver.onStopRequest(exitCode);
  };

  EnigmailAutoSetup.createAutocryptKey(userName, userEmail).then((value) => {
    let keys = EnigmailKeyRing.getAllSecretKeys();

    EnigmailKeyRing.generateKey = EnigmailKeyRing._generateKey;
    Assert.equal(value, KEY_ID);
    Assert.equal(keys.length, 1);
    Assert.equal(keys[0].userIds[0].userId, "Test Name <testing@domain.invalid>");
    Assert.equal(keys[0].keySize, "4096");
    inspector.exitNestedEventLoop();
  }).catch(res => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
})));

//testing: createAutocryptKey_error_Test
test(withTestGpgHome(withEnigmail(function keyGen_error_Test() {

  EnigmailKeyRing.clearCache();
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  EnigmailKeyRing.clearCache();
  EnigmailAutoSetup.createAutocryptKey(undefined, undefined).then((value) => {
    Assert.equal(value, null);
    inspector.exitNestedEventLoop();
  }).catch(res => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
})));

//testing: processAutocryptHeader
test(function processAutocryptHeaderTest() {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  let date = new Date();
  date.setTime(Date.now()); // now
  const sentDate = date.toUTCString();

  let headerValue = {
    msgHeaders: [{
      date: sentDate,
      fromAddr: 'dev-tiger@test.notreal',
      msgType: 'Autocrypt',
      msgData: AC_HEADER
    }]
  };

  var window = JSUnit.createStubWindow();
  EnigmailKeyRing.clearCache();

  EnigmailAutoSetup.processAutocryptHeader(headerValue, window).then((value) => {
    Assert.equal(value, 0);
    return EnigmailAutocrypt.getOpenPGPKeyForEmail(["dev-tiger@test.notreal"]);
  }).then((keys) => {
    Assert.equal(keys.length, 1);
    Assert.equal(keys[0].email, "dev-tiger@test.notreal");
    Assert.equal(keys[0].lastAutocrypt.toUTCString(), sentDate);
    inspector.exitNestedEventLoop();
  }).catch(res => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
});

//testing: processAutocryptHeader for Error
test(function processAutocryptHeader_error_Test() {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  let date = new Date();
  date.setTime(Date.now() - 5 * 86400 * 1000); // 5 days ago
  const sentDate = date.toUTCString();

  let headerValue = {
    msgHeaders: [{
      date: sentDate,
      fromAddr: '',
      msgType: 'Autocrypt',
      msgData: AC_HEADER
    }]
  };

  var window = JSUnit.createStubWindow();
  EnigmailKeyRing.clearCache();

  EnigmailAutoSetup.processAutocryptHeader(headerValue, window).then((value) => {
    Assert.equal(value, 1);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
});

//testing: getMsgFolders
test(withTestGpgHome(withEnigmail(function getMsgFoldersTest() {

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());
  const sourceFolder = MailHelper.createMailFolder("source-box");

  var database1 = [];
  getMsgFolders(sourceFolder, database1);

  Assert.equal(database1.length, 1);

  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);
  copyMailToFolder("resources/encrypted-email.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  Assert.equal(sourceFolder.getTotalMessages(false), 1);

  var database2 = [];
  getMsgFolders(MailHelper.getRootFolder(), database2);

  Assert.equal(database2.length, 1);

})));

//testing: getStreamedMessage
test(withTestGpgHome(withEnigmail(function getStreamedMessageTest() {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const rootFolder = MailHelper.getRootFolder();
  const sourceFolder = MailHelper.createMailFolder("source-box");
  copyMailToFolder("resources/encrypted-email-with-attachment.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgheader = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);

  getStreamedMessage(sourceFolder, msgheader).then((value) => {
    Assert.notEqual(value, null);
    Assert.equal(value.displayName, 'attachment.txt.pgp');
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
})));

//testing: getStreamedHeaders
test(withTestGpgHome(withEnigmail(function getStreamedHeadersTest() {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const rootFolder = MailHelper.getRootFolder();
  const sourceFolder = MailHelper.createMailFolder("source-box");
  copyMailToFolder("resources/encrypted-email.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgheader = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
  let msgURI = sourceFolder.getUriForMsg(msgheader);
  let messenger = Components.classes["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

  let mms = messenger.messageServiceFromURI(msgURI).QueryInterface(Ci.nsIMsgMessageService);

  getStreamedHeaders(msgURI, mms).then((value) => {
    Assert.notEqual(value, null);
    Assert.equal(value.subject, "Encrypted email");
    Assert.equal(value.date, "Tue, 09 Jun 2015 16:43:45 -0500");
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
})));

//testing: getStreamedHeaders Error
test(withTestGpgHome(withEnigmail(function getStreamedHeadersTest() {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const rootFolder = MailHelper.getRootFolder();
  const sourceFolder = MailHelper.createMailFolder("source-box");
  copyMailToFolder("resources/encrypted-email.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgheader = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
  let msgURI = sourceFolder.getUriForMsg(msgheader);
  let messenger = Components.classes["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

  let mms = undefined;

  getStreamedHeaders(msgURI, mms).then((value) => {
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.equal(Object.keys(err).length, 0);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
})));


//testing: checkHeaders
test(withTestGpgHome(withEnigmail(function checkHeadersTest() {
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  let returnMsgValue = {
    value: EnigmailConstants.AUTOSETUP_NO_HEADER
  };

  let msgHeaders = [];

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const rootFolder = MailHelper.getRootFolder();
  const sourceFolder = MailHelper.createMailFolder("source-box");
  copyMailToFolder("resources/encrypted-email.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgAuthor = "tester@enigmail.org";
  let msgHeader1 = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);

  let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
  let accounts = msgAccountManager.accounts;
  let account = accounts.queryElementAt(0, Ci.nsIMsgAccount);

  let msgURI1 = sourceFolder.getUriForMsg(msgHeader1);
  let messenger1 = Components.classes["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let mms1 = messenger1.messageServiceFromURI(msgURI1).QueryInterface(Ci.nsIMsgMessageService);


  getStreamedHeaders(msgURI1, mms1).then(async(value) => {
    let returnValue = await checkHeaders(value, msgHeader1, msgAuthor, account.defaultIdentity.email, sourceFolder, returnMsgValue, msgHeaders);
    Assert.notEqual(returnValue, null);
    Assert.equal(returnValue.returnMsgValue.value, EnigmailConstants.AUTOSETUP_NO_HEADER);
    Assert.equal(returnValue.msgHeaders.length, 0);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const setupFolder = MailHelper.createMailFolder("setup-box");
  copyMailToFolder("resources/autocrypt-setup-message.eml", setupFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgHeader2 = MailHelper.fetchFirstMessageHeaderIn(setupFolder);

  let msgURI2 = setupFolder.getUriForMsg(msgHeader2);
  let messenger2 = Components.classes["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let mms2 = messenger2.messageServiceFromURI(msgURI2).QueryInterface(Ci.nsIMsgMessageService);

  getStreamedHeaders(msgURI2, mms2).then(async(value) => {
    let returnValue = await checkHeaders(value, msgHeader2, msgAuthor, account.defaultIdentity.email, setupFolder, returnMsgValue, msgHeaders);
    Assert.notEqual(returnValue, null);
    Assert.equal(returnValue.returnMsgValue.value, EnigmailConstants.AUTOSETUP_AC_SETUP_MSG);
    Assert.equal(returnMsgValue.acSetupMessage.author, 'nobody');
    Assert.notEqual(returnMsgValue.attachment, null);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const autocryptFolder = MailHelper.createMailFolder("autocrypt-box");
  copyMailToFolder("resources/encrypted-email-with-autocrypt.eml", autocryptFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgHeader3 = MailHelper.fetchFirstMessageHeaderIn(autocryptFolder);

  let msgURI3 = autocryptFolder.getUriForMsg(msgHeader3);
  let messenger3 = Components.classes["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let mms3 = messenger3.messageServiceFromURI(msgURI3).QueryInterface(Ci.nsIMsgMessageService);

  let msgAuthor2 = account.defaultIdentity.email;

  getStreamedHeaders(msgURI3, mms3).then(async(value) => {
    let returnValue = await checkHeaders(value, msgHeader3, msgAuthor2, account.defaultIdentity.email, autocryptFolder, returnMsgValue, msgHeaders);
    Assert.notEqual(returnValue, null);
    Assert.equal(returnValue.msgHeaders.length, 1);
    Assert.equal(returnValue.msgHeaders[0].fromAddr, msgAuthor2);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

})));

//testing: determinePreviousInstallType
test(withTestGpgHome(withEnigmail(function determinePreviousInstallTypeTest() {

  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  const rootFolder = MailHelper.getRootFolder();
  const sourceFolder = MailHelper.createMailFolder("source-box");
  copyMailToFolder("resources/encrypted-email.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  EnigmailAutoSetup.determinePreviousInstallType().then((returnMsgValue) => {
    Assert.equal(returnMsgValue.value, EnigmailConstants.AUTOSETUP_NO_HEADER);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const autocryptFolder = MailHelper.createMailFolder("autocrypt-box");
  copyMailToFolder("resources/encrypted-email-with-autocrypt.eml", autocryptFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  EnigmailAutoSetup.determinePreviousInstallType().then((returnMsgValue) => {
    Assert.equal(returnMsgValue.value, EnigmailConstants.AUTOSETUP_NO_HEADER);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  let acc2 = setupTestAccount("Unit Test Account 2", "dummy2", "testing@domain.invalid");
  let inbox = acc2.incomingServer.rootFolder.getFolderWithFlags(Components.interfaces.nsMsgFolderFlags.Inbox);

  copyMailToFolder("resources/email-acc2-pEp-message.eml", inbox).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  EnigmailAutoSetup.determinePreviousInstallType().then((returnMsgValue) => {
    Assert.equal(returnMsgValue.value, EnigmailConstants.AUTOSETUP_PEP_HEADER);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  copyMailToFolder("resources/autocrypt-setup-message.eml", inbox).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  EnigmailAutoSetup.determinePreviousInstallType().then((returnMsgValue) => {
    Assert.equal(returnMsgValue.value, EnigmailConstants.AUTOSETUP_AC_SETUP_MSG);
    inspector.exitNestedEventLoop();
  }).catch(err => {
    Assert.ok(false);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);

  //MailHelper.cleanMailFolder(MailHelper.getRootFolder());
})));

//testing: performAutocryptSetup
test(withTestGpgHome(withEnigmail(function performAutocryptSetupTest() {
  EnigmailKeyRing.clearCache();
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const rootFolder = MailHelper.getRootFolder();
  const sourceFolder = MailHelper.createMailFolder("source-box");
  copyMailToFolder("resources/autocrypt-setup-message-2.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgheader = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
  let msgURI = sourceFolder.getUriForMsg(msgheader);
  let messenger = Components.classes["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

  getStreamedMessage(sourceFolder, msgheader).then((value) => {
    Assert.notEqual(value, null);
    let headervalue = {
      'acSetupMessage': msgheader,
      'attachment': value
    };

    var passwordWindow = JSUnit.createStubWindow();
    var confirmWindow = JSUnit.createStubWindow();

    var confirmWindowDocument = passwordWindow.document;
    var passwordWindowDocument = confirmWindow.document;

    passwordWindow.openDialog = function(arg1, arg2, arg3, arg4) {
      const pass = "6460-5183-7821-0632-0177-4451-8821-9031-7887";
      arg4.password = pass;
      return arg4.password;
    };

    confirmWindow.openDialog = function() {
      inspector.exitNestedEventLoop();
      return null;
    };

    EnigmailAutoSetup.performAutocryptSetup(headervalue, passwordWindow, confirmWindow);

  }).catch(err => {
    Assert.ok(false, `got exception: ${err}`);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);


  let keys = EnigmailKeyRing.getKeyById("B3A85460D9D9CC47");
  Assert.notEqual(keys, null, "keys must not be null");
  Assert.equal(keys.keyId, "B3A85460D9D9CC47");

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

})));

//testing: performAutocryptSetup
test(withTestGpgHome(withEnigmail(function performAutocryptSetup_wrongPassword_Test() {
  EnigmailKeyRing.clearCache();
  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());

  const rootFolder = MailHelper.getRootFolder();
  const sourceFolder = MailHelper.createMailFolder("source-box");
  copyMailToFolder("resources/autocrypt-setup-message-2.eml", sourceFolder).then(() => {
    inspector.exitNestedEventLoop(0);
  });
  inspector.enterNestedEventLoop(0);

  let msgheader = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
  let msgURI = sourceFolder.getUriForMsg(msgheader);
  let messenger = Components.classes["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

  getStreamedMessage(sourceFolder, msgheader).then((value) => {
    Assert.notEqual(value, null);
    let headervalue = {
      'acSetupMessage': msgheader,
      'attachment': value
    };

    var passwordWindow = JSUnit.createStubWindow();
    var confirmWindow = JSUnit.createStubWindow();

    passwordWindow.document = JSUnit.createDOMDocument();
    confirmWindow.document = JSUnit.createDOMDocument();

    var confirmWindowDocument = passwordWindow.document;
    var passwordWindowDocument = confirmWindow.document;

    passwordWindow.openDialog = function(arg1, arg2, arg3, arg4) {
      const pass = "6460-5183-7821-0632-0177-4451-8821-9031-7888";
      arg4.password = pass;
      return arg4.password;
    };

    confirmWindow.openDialog = function() {
      inspector.exitNestedEventLoop();
      return null;
    };

    EnigmailAutoSetup.performAutocryptSetup(headervalue, passwordWindow, confirmWindow);

  }).catch(err => {
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);


  let keys = EnigmailKeyRing.getKeyById("B3A85460D9D9CC47");
  Assert.equal(keys, null);

  MailHelper.cleanMailFolder(MailHelper.getRootFolder());
})));
