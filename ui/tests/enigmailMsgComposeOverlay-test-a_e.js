/*global Enigmail: false, Assert: false, do_load_module: false, trustAllKeys_test: false, JSUnit: false, Components: false, EnigmailConstants: false, EnigmailLocale: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var window;
var document;

var EnigmailApp = {};
var getCurrentAccountKey = {};
var MailServices = {};
var CommandUpdate_MsgCompose = {};
var top = {};
var EnigmailDialog = {
  msgBox : function(){}
};
var AddAttachment;
var AddAttachments;
var EnigmailMsgCompFields = {};
var EnigmailPEPAdapter = {};
var Recipients2CompFields = {};
var MailUtils = {};
var GetResourceFromUri = {};
var EnigmailCore = {};

var gSMFields;

var EnigmailPrefs = {
  getPref : (prop) => {
    return 1;
  },
  setPref : function(){}
};

var EnigmailTimer = {
  setTimeout : function(){}
};

var gMsgCompose = {};

function toggleEncryptMessage(){
  Assert.ok(true);
}

function toggleSignMessage(){
  Assert.ok(true);
}

var getCurrentIdentity = function(){

};

var EnigmailFuncs = {

};


function addAttachment_test(){

  AddAttachments = function(att){
    Assert.equal(att[0], 'xyz');
  };

  Enigmail.msg.addAttachment('xyz');

  AddAttachment = function(att){
    Assert.equal(att, 'xyz');
  };

  Enigmail.msg.addAttachment('xyz');
}

function addRecipients_test(){
  let recList = [
    "user1@enigmail.net,",
    "user2@enigmail.net,"
  ];

  let addrList = [];

  EnigmailFuncs.stripEmail = function(val){
    return val;
  };

  Enigmail.msg.addRecipients(addrList, recList);
  Assert.equal(addrList.length, 2);
  Assert.equal(addrList[0], 'user1@enigmail.net');
  Assert.equal(addrList[1], 'user2@enigmail.net');

}

function addressOnChange_test(){

  Enigmail.msg.addrOnChangeTimer = false;
  Enigmail.msg.fireSendFlags = function(){
    Assert.ok(true);
  };
  EnigmailTimer.setTimeout = function(callback, time){
    Assert.equal(time, 250);
    callback();
    Assert.equal(Enigmail.msg.addrOnChangeTimer, null);
    return true;
  };

  Enigmail.msg.addressOnChange();

  Assert.equal(Enigmail.msg.addrOnChangeTimer, true);
}

function allowAttachOwnKey_test(){

  Enigmail.msg.identity = {};

  Enigmail.msg.isEnigmailEnabled = function(){
    return false;
  };
  let ret = Enigmail.msg.allowAttachOwnKey();
  Assert.equal(ret, -1);

  Enigmail.msg.isEnigmailEnabled = function(){
    return true;
  };

  Enigmail.msg.identity.getIntAttribute = function(){
    return 0;
  };
  ret = Enigmail.msg.allowAttachOwnKey();
  Assert.equal(ret, 0);

  Enigmail.msg.identity.getIntAttribute = function(){
    return 2;
  };

  Enigmail.msg.identity.getCharAttribute = function(){
    return 'xyz';
  };
  ret = Enigmail.msg.allowAttachOwnKey();
  Assert.equal(ret, 0);

  Enigmail.msg.identity.getCharAttribute = function(){
    return '02';
  };
  ret = Enigmail.msg.allowAttachOwnKey();
  Assert.equal(ret, 1);

}

function attachKey_test(){
  window.openDialog = function(xulFilePath, str1, options, inputObj, resultObj){
    Assert.equal(xulFilePath, "chrome://enigmail/content/ui/enigmailKeySelection.xul");
    Assert.equal(str1, '');
    Assert.equal(options, "dialog,modal,centerscreen,resizable");
    Assert.equal(inputObj.options, "multisel,allowexpired,nosending");
    Assert.equal(inputObj.dialogHeader, EnigmailLocale.getString("keysToExport"));
  };

  Enigmail.msg.extractAndAttachKey = function(){
    Assert.ok(true);
  };

  Enigmail.msg.trustAllKeys = false;

  Enigmail.msg.attachKey();

  window.openDialog = function(xulFilePath, str1, options, inputObj, resultObj){
    Assert.equal(inputObj.options, "multisel,allowexpired,nosending,trustallkeys");
  };

  Enigmail.msg.trustAllKeys = true;

  Enigmail.msg.attachKey();
}

function attachOwnKey_test(){

  Enigmail.msg.attachOwnKeyObj.attachedKey = 'xy';
  Enigmail.msg.identity = {
    getIntAttribute : function(){
      return 1;
    },
    getCharAttribute : function(){
      return 'xyz';
    }
  };

  Enigmail.msg.removeAttachedKey = function(){
    Assert.ok(true);
  };

  Enigmail.msg.attachOwnKey();

  Enigmail.msg.removeAttachedKey = function(){
    Assert.ok(false);
  };

  Enigmail.msg.attachOwnKeyObj.attachedKey = 'xyz';
  Enigmail.msg.attachOwnKey();

  Enigmail.msg.attachOwnKeyObj.attachedKey = null;

  Enigmail.msg.extractAndAttachKey = function(){
    return 'key';
  };

  Enigmail.msg.attachOwnKey();
  Assert.equal(Enigmail.msg.attachOwnKeyObj.attachedObj, 'key');
  Assert.equal(Enigmail.msg.attachOwnKeyObj.attachedKey, 'xyz');

  Enigmail.msg.attachOwnKeyObj.attachedObj = null;
  Enigmail.msg.attachOwnKeyObj.attachedKey = null;
  Enigmail.msg.extractAndAttachKey = function(){
    return null;
  };
  Enigmail.msg.attachOwnKey();
  Assert.equal(Enigmail.msg.attachOwnKeyObj.attachedObj, null);
  Assert.equal(Enigmail.msg.attachOwnKeyObj.attachedKey, null);

}

function attachPepKey_test(){

  gMsgCompose.compFields = {};

  Enigmail.msg.identity = {
    getBoolAttribute : function(){
      Assert.ok(true);
      return true;
    }
  };

  EnigmailPEPAdapter.getOwnIdentityForEmail = function(){
    Assert.ok(true);
    return null;
  };

  Enigmail.msg.attachPepKey();

  EnigmailPEPAdapter.getOwnIdentityForEmail = function(){
    Assert.ok(true);
    return {
      fpr : "001"
    };
  };

  Enigmail.msg.attachOwnKeyObj.attachedKey = "0x002";

  Enigmail.msg.removeAttachedKey = function(){
    Assert.ok(true);
    Enigmail.msg.attachOwnKeyObj.attachedKey = null;
  };

  Enigmail.msg.extractAndAttachKey = function(){
    Assert.ok(true);
    return {
      name : ''
    };
  };

  gMsgCompose.compFields.addAttachment = function(attachedObj){
    Assert.ok(true);
    Assert.equal(attachedObj.name, "pEpkey.asc");
  };

  Enigmail.msg.attachPepKey();
  Assert.equal(Enigmail.msg.attachOwnKeyObj.attachedObj.name, "pEpkey.asc");
  Assert.equal(Enigmail.msg.attachOwnKeyObj.attachedKey, "0x001");
}

function checkProtectHeaders_test(){

  let ret = Enigmail.msg.checkProtectHeaders(0x0080);
  Assert.equal(ret, true);

  ret = Enigmail.msg.checkProtectHeaders(0x0082);
  Assert.equal(ret, true);

  ret = Enigmail.msg.checkProtectHeaders(0x0002);
  Assert.equal(ret, true);

  Enigmail.msg.protectHeaders = true;

  ret = Enigmail.msg.checkProtectHeaders(0x0082);
  Assert.equal(ret, true);

  Enigmail.msg.protectHeaders = false;

  EnigmailDialog.msgBox = function(){
    return -1;
  };

  EnigmailPrefs.getPref = function(){
    return 1;
  };

  ret = Enigmail.msg.checkProtectHeaders(0x0082);
  Assert.equal(ret, false);

  Enigmail.msg.protectHeaders = false;

  EnigmailDialog.msgBox = function(){
    Assert.ok(true);
    return 0;
  };

  Enigmail.msg.displayProtectHeadersStatus = function(){
    Assert.ok(true);
  };

  EnigmailPrefs.setPref = function(prop, val){
    Assert.equal(val, 2);
  };

  ret = Enigmail.msg.checkProtectHeaders(0x0082);
  Assert.equal(ret, true);
  Assert.equal(Enigmail.msg.protectHeaders, true);

  Enigmail.msg.protectHeaders = false;

  EnigmailDialog.msgBox = function(){
    return -2;
  };

  Enigmail.msg.displayProtectHeadersStatus = function(){
    Assert.ok(true);
  };

  EnigmailPrefs.setPref = function(prop, val){
    Assert.equal(val, 0);
  };

  ret = Enigmail.msg.checkProtectHeaders(0x00082);
  Assert.equal(ret, true);
  Assert.equal(Enigmail.msg.protectHeaders, false);

}

function compileFromAndTo_test(){
  Enigmail.msg.composeBodyReady = {};

  gMsgCompose.expandMailingLists = function(){
    Assert.ok(true);
  };

  Recipients2CompFields = function(){
    Assert.ok(true);
  };

  gMsgCompose.compFields = {
    to : ['user1@enigmail.net','user2@enigmail.net'],
    cc : ['user3@enigmail.net','user4@enigmail.net'],
    bcc : ['user5@enigmail.net','user6@enigmail.net']
  };

  getCurrentIdentity = function(){
    Assert.ok(true);
    return {
      email : 'user@enigmail.net',
      fullName : 'User Name'
    };
  };

  EnigmailFuncs.parseEmails = function(emailAddr){
    Assert.ok(true);
    return [
      {
        email : emailAddr[0]
      }, {
        email : emailAddr[1]
      }
    ];
  };

  let ret = Enigmail.msg.compileFromAndTo();
  Assert.equal(ret.from.email, 'user@enigmail.net');
  Assert.equal(ret.from.name, 'User Name');
  Assert.equal(ret.toAddrList.length, 6);

  gMsgCompose.compFields = {
    to : ['user1@enigmail.net','user2@enigmail.net'],
    cc : ['user3@enigmail.net','user4@enigmail.net'],
    bcc : ['user5@enigmail.net','user6.enigmail.net']
  };

  ret = Enigmail.msg.compileFromAndTo();
  Assert.equal(ret, null);

}

function createEnigmailSecurityFields_test(){

  gMsgCompose.compFields.securityInfo = '';
  EnigmailMsgCompFields.createObject = function(){
    Assert.ok(true);
    return 'secureInformation';
  };

  Enigmail.msg.createEnigmailSecurityFields();
  Assert.equal(gMsgCompose.compFields.securityInfo, 'secureInformation');

}

function delayedProcessFinalState_test(){

  Enigmail.msg.processFinalState = function(){
    //Function Overriding
    Assert.ok(true);
  };
  Enigmail.msg.updateStatusBar = function(){
    //Function Overriding
    Assert.ok(true);
  };

  EnigmailTimer.setTimeout = function(callback, val){
    //Function Overriding
    Assert.equal(val, 100);
    callback();
  };

  Enigmail.msg.delayedProcessFinalState();

}

function displayPartialEncryptedWarning_test(){

  Enigmail.msg.notifyUser = function(priority, msgText, messageId, detailsText){
    Assert.equal(priority, 1);
    Assert.equal(detailsText, EnigmailLocale.getString("msgCompose.partiallyEncrypted.inlinePGP"));
    Assert.equal(msgText, EnigmailLocale.getString("msgCompose.partiallyEncrypted.short"));
    Assert.equal(messageId, "notifyPartialDecrypt");
  };

  Enigmail.msg.displayPartialEncryptedWarning();
}

function displayProtectHeadersStatus_test(){
  document.getElementById = function(){
    return {
      setAttribute : function(prop, val){
        if(prop === "checked"){
          Assert.equal(val, "true");
        }
        else if(prop === "tooltiptext"){
          Assert.equal(val, EnigmailLocale.getString("msgCompose.protectSubject.tooltip"));
        }
      }
    };
  };

  Enigmail.msg.protectHeaders = ['headers'];

  Enigmail.msg.displayProtectHeadersStatus();

  document.getElementById = function(){
    return {
      setAttribute : function(prop, val){
        Assert.equal(val, EnigmailLocale.getString("msgCompose.noSubjectProtection.tooltip"));
        Assert.equal(prop, "tooltiptext");
      },
      removeAttribute : function(prop){
        Assert.equal(prop, "checked");
      }
    };
  };

  Enigmail.msg.protectHeaders = null;

  Enigmail.msg.displayProtectHeadersStatus();
}

function displaySecuritySettings_test(){

  Enigmail.msg.processFinalState = function(){
    Assert.ok(true);
  };

  Enigmail.msg.updateStatusBar = function(){
    Assert.ok(true);
  };

  window.openDialog = function(windowURL, str1, prop, param){
    param.resetDefaults = true;
  };

  Enigmail.msg.encryptForced = null;
  Enigmail.msg.signForced = null;
  Enigmail.msg.pgpmimeForced = null;
  Enigmail.msg.finalSignDependsOnEncrypt = null;

  Enigmail.msg.displaySecuritySettings();
  Assert.equal(Enigmail.msg.encryptForced, null);
  Assert.equal(Enigmail.msg.signForced, null);
  Assert.equal(Enigmail.msg.pgpmimeForced, null);
  Assert.equal(Enigmail.msg.finalSignDependsOnEncrypt, null);

  window.openDialog = function(windowURL, str1, prop, param){
    param.resetDefaults = true;
    param.success = true;
  };

  Enigmail.msg.displaySecuritySettings();
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_UNDEF);
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_UNDEF);
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_UNDEF);
  Assert.equal(Enigmail.msg.finalSignDependsOnEncrypt, true);

  window.openDialog = function(windowURL, str1, prop, param){
    param.resetDefaults = false;
    param.success = true;
    param.sign = 1;
    param.encrypt = 2;
    param.pgpmime = 3;
  };

  Enigmail.msg.signForced = null;

  Enigmail.msg.displaySecuritySettings();
  Assert.equal(Enigmail.msg.dirty, 2);
  Assert.equal(Enigmail.msg.signForced, 1);
  Assert.equal(Enigmail.msg.finalSignDependsOnEncrypt, false);
  Assert.equal(Enigmail.msg.encryptForced, 2);
  Assert.equal(Enigmail.msg.pgpmimeForced, 3);

  Enigmail.msg.signForced = 1;
  Enigmail.msg.encryptForced = 1;
  Enigmail.msg.dirty = null;

  Enigmail.msg.displaySecuritySettings();
  Assert.equal(Enigmail.msg.dirty, 2);
}

function displaySMimeToolbar_test(){
  document.getElementById = function() {
    return {
      removeAttribute : function(){
        Assert.ok(true);
      }
    };
  };

  Enigmail.msg.statusPGPMime = EnigmailConstants.ENIG_FINAL_SMIME;
  Enigmail.msg.displaySMimeToolbar();

  Enigmail.msg.statusPGPMime = EnigmailConstants.ENIG_FINAL_FORCESMIME;
  Enigmail.msg.displaySMimeToolbar();

  Enigmail.msg.statusPGPMime = null;
  document.getElementById = function() {
    return {
      setAttribute : function(){
        Assert.ok(true);
      }
    };
  };

  Enigmail.msg.displaySMimeToolbar();

}

function editorGetCharset_test(){

  Enigmail.msg.editor = {
    documentCharacterSet: 'xyz'
  };

  Enigmail.msg.editorGetCharset();
  Assert.equal(Enigmail.msg.editor.documentCharacterSet, 'xyz');
}

function editorGetContentAs_test(){
  Enigmail.msg.editor = {
    outputToString : function(mimeType, flags){
      Assert.equal(mimeType, 'mime');
      Assert.equal(flags, 'flags');
      return true;
    }
  };

  let ret = Enigmail.msg.editorGetContentAs('mime', 'flags');
  Assert.equal(ret, true);

  Enigmail.msg.editor = false;
  ret = Enigmail.msg.editorGetContentAs('mime', 'flags');
  Assert.equal(ret, null);

}

function editorInsertAsQuotation_test(){

  Enigmail.msg.editor = null;
  let ret = Enigmail.msg.editorInsertAsQuotation();
  Assert.equal(ret, 0);

  Enigmail.msg.editor = {};
  ret = Enigmail.msg.editorInsertAsQuotation();
  Assert.equal(ret, 0);

  // Enigmail.msg.editor = Components.classes["@mozilla.org/editor/texteditor;1"].createInstance();
  // ret = Enigmail.msg.editorInsertAsQuotation(null);
  // Assert.equal(ret, 1);
}

function editorSelectAll_test(){
  Enigmail.msg.editor = {
    selectAll : function(){
      Assert.ok(true);
    }
  };
  Enigmail.msg.editorSelectAll();
}

function enableUndoEncryption_test(){

  document.getElementById = function(){
    return {
      removeAttribute : function(){
        Assert.ok(true);
      },
      setAttribute : function(){
        Assert.ok(true);
      }
    };
  };

  Enigmail.msg.enableUndoEncryption(true);

  Enigmail.msg.enableUndoEncryption(false);

}


function run_test() {
  window = JSUnit.createStubWindow();
  window.document = JSUnit.createDOMDocument();
  document = window.document;

  do_load_module("chrome://enigmail/content/ui/enigmailMsgComposeOverlay.js");
  do_load_module("chrome://enigmail/content/modules/constants.jsm");
  do_load_module("chrome://enigmail/content/modules/locale.jsm");

  //Overriding Problem
  //TODO Use testHelper
  displayProtectHeadersStatus_test();

  addAttachment_test();
  addRecipients_test();
  addressOnChange_test();
  allowAttachOwnKey_test();
  attachKey_test();
  attachOwnKey_test();
  attachPepKey_test();
  checkProtectHeaders_test();
  compileFromAndTo_test();
  createEnigmailSecurityFields_test();
  delayedProcessFinalState_test();
  displayPartialEncryptedWarning_test();
  displaySecuritySettings_test();
  displaySMimeToolbar_test();
  editorGetCharset_test();
  editorGetContentAs_test();
  editorInsertAsQuotation_test();
  editorSelectAll_test();
  enableUndoEncryption_test();
}
