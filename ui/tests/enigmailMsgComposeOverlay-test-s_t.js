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
  msgBox : function(){},
  alertPref : function(){}
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

function sendAborted_test(){

  EnigmailDialog = {
    info : function(){
      Assert.ok(true);
    }
  };
  Enigmail.msg.sendAborted(window, null);

  let errorMsgObj = {
    value : 'INV_RECP 10 key10\nINV_SGNR 1 key1\nINV_RECP 4 key4\nINV_SGNR 5 key5'
  };

  EnigmailDialog.info = function(window, val){
    Assert.equal(val, "Send operation aborted.\n\nNot enough trust for key 'key10'\nKey 'key1' not found\nKey 'key4' revoked\nKey 'key5' expired\n\nINV_RECP 10 key10\nINV_SGNR 1 key1\nINV_RECP 4 key4\nINV_SGNR 5 key5");
  };

  Enigmail.msg.sendAborted(window, errorMsgObj);

  errorMsgObj = {
    value : 'INV_RECP 10 key10'
  };

  EnigmailDialog.info = function(window, val){
    Assert.equal(val, "Send operation aborted.\n\nNot enough trust for key 'key10'\n\nINV_RECP 10 key10");
  };

  Enigmail.msg.sendAborted(window, errorMsgObj);

  errorMsgObj = {
    value : 'INV_RECP 10 key10\nI_SGNR 1 key1\nINV_RECP 4 key4\nINV_SGNR 5 key5'
  };

  EnigmailDialog.info = function(window, val){
    Assert.equal(val, "Send operation aborted.\n\nNot enough trust for key 'key10'\nKey 'key4' revoked\nKey 'key5' expired\n\nINV_RECP 10 key10\nI_SGNR 1 key1\nINV_RECP 4 key4\nINV_SGNR 5 key5");
  };

  Enigmail.msg.sendAborted(window, errorMsgObj);

  errorMsgObj = {
    value : 'INV_RECP10key10'
  };

  EnigmailDialog.info = function(window, val){
    Assert.equal(val, "Send operation aborted.\n\nINV_RECP10key10");
  };

  Enigmail.msg.sendAborted(window, errorMsgObj);

}

function setAdditionalHeader_test(){
  gMsgCompose = {
    compFields : {
      setHeader : function(){
        Assert.ok(true);
      }
    }
  };

  Enigmail.msg.setAdditionalHeader('hdr', 'val');

  gMsgCompose = {
    compFields : {
      otherRandomHeaders : 'hello'
    }
  };

  Enigmail.msg.setAdditionalHeader('hdr', 'val');

  Assert.equal(gMsgCompose.compFields.otherRandomHeaders, 'hellohdr: val\r\n');
}

function setChecked_test(){
  document = {
    getElementById : function(){
      return {
        setAttribute : function(str, bool){
          Assert.ok(true);
          Assert.ok(str, "checked");
          Assert.ok(bool, "true");
        },
        removeAttribute : function(str){
          Assert.ok(true);
          Assert.ok(str, "checked");
        }
      };
    }
  };

  Enigmail.msg.setChecked('id', true);

  Enigmail.msg.setChecked('id', false);

}

function setDraftStatus_test(){

  Enigmail.msg.encryptForced = 1;
  Enigmail.msg.signForced = 2;
  Enigmail.msg.pgpmimeForced = 3;
  Enigmail.msg.protectHeaders = 4;
  Enigmail.msg.attachOwnKeyObj = {
    appendAttachment : 1
  };

  Enigmail.msg.setAdditionalHeader = function(str, draftStatus){
    Assert.equal(str, "X-Enigmail-Draft-Status");
    Assert.equal(draftStatus, "N12311");
  };

  Enigmail.msg.setDraftStatus(1);


  Enigmail.msg.pgpmimeForced = 0;
  Enigmail.msg.protectHeaders = 4;
  Enigmail.msg.attachOwnKeyObj = {
    appendAttachment : null
  };

  Enigmail.msg.setAdditionalHeader = function(str, draftStatus){
    Assert.equal(str, "X-Enigmail-Draft-Status");
    Assert.equal(draftStatus, "N12000");
  };

  Enigmail.msg.setDraftStatus(0);
}

function setFinalSendMode_test() {
  // test functionality of setFinalSendMode

  Enigmail.msg.determineSendFlags = () => {

  };

  Enigmail.msg.getAccDefault = () => {
    return true;
  };

  Enigmail.msg.identity = {};

  EnigmailDialog.alertPref = function(){
    Assert.ok(true);
  };

  Enigmail.msg.setFinalSendMode('final-encryptDefault');
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_UNDEF);

  Enigmail.msg.setFinalSendMode('final-encryptYes');
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_ALWAYS);

  Enigmail.msg.setFinalSendMode('final-encryptNo');
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.setFinalSendMode('final-signDefault');
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_UNDEF);

  Enigmail.msg.setFinalSendMode('final-signYes');
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_ALWAYS);

  Enigmail.msg.setFinalSendMode('final-signNo');
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.setFinalSendMode('final-pgpmimeDefault');
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_UNDEF);

  Enigmail.msg.setFinalSendMode('final-pgpmimeYes');
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_ALWAYS);

  Enigmail.msg.setFinalSendMode('final-pgpmimeNo');
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.setFinalSendMode('final-useSmime');
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_FORCE_SMIME);

  Enigmail.msg.statusSigned = EnigmailConstants.ENIG_FINAL_FORCENO;
  Enigmail.msg.setFinalSendMode('toggle-final-sign');
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_ALWAYS);

  Enigmail.msg.statusSigned = EnigmailConstants.ENIG_FINAL_FORCENO;
  Enigmail.msg.setFinalSendMode('toggle-final-sign');
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_ALWAYS);

  Enigmail.msg.statusSigned = EnigmailConstants.ENIG_FINAL_FORCEYES;
  Enigmail.msg.setFinalSendMode('toggle-final-sign');
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.statusSigned = EnigmailConstants.ENIG_FINAL_CONFLICT;
  Enigmail.msg.setFinalSendMode('toggle-final-sign');
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.juniorMode = false;

  Enigmail.msg.statusEncrypted = EnigmailConstants.ENIG_FINAL_FORCENO;
  Enigmail.msg.setFinalSendMode('toggle-final-encrypt');
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_ALWAYS);

  Enigmail.msg.statusEncrypted = EnigmailConstants.ENIG_FINAL_FORCEYES;
  Enigmail.msg.setFinalSendMode('toggle-final-encrypt');
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.statusEncrypted = EnigmailConstants.ENIG_FINAL_CONFLICT;
  Enigmail.msg.setFinalSendMode('toggle-final-encrypt');
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.statusPGPMime = EnigmailConstants.ENIG_FINAL_FORCENO;
  Enigmail.msg.setFinalSendMode('toggle-final-mime');
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_ALWAYS);

  Enigmail.msg.statusPGPMime= EnigmailConstants.ENIG_FINAL_FORCEYES;
  Enigmail.msg.setFinalSendMode('toggle-final-mime');
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_NEVER);

  Enigmail.msg.statusPGPMime = EnigmailConstants.ENIG_FINAL_CONFLICT;
  Enigmail.msg.setFinalSendMode('toggle-final-mime');
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_NEVER);
  Assert.equal(Enigmail.msg.sendModeDirty, true);

}

function setIdentityCallback_test(){

  Enigmail.msg.setIdentityDefaults = function(){
    //Function Overriding
    Assert.ok(true);
  };

  Enigmail.msg.setIdentityCallback('xyz');
}

function setIdentityDefaults_test(){


  Enigmail.msg.processAccountSpecificDefaultOptions = function(){
    //Function Overriding
  };

  Enigmail.msg.determineSendFlags = function(){
    //Function Overriding
  };

  Enigmail.msg.processFinalState = function(){
    //Function Overriding
  };

  Enigmail.msg.updateStatusBar = function(){
    //Function Overriding
  };

  EnigmailFuncs = {
    //Function Overriding
    getSignMsg : function(){
      Assert.ok(true);
    }
  };

  Enigmail.msg.isEnigmailEnabled = function() {
    //Function Overriding
    return true;
  };

  Enigmail.msg.juniorMode = false;
  Enigmail.msg.sendModeDirty = true;

  getCurrentIdentity = function(){
    //Function Overriding
    return {
      getIntAttribute : function(){
        return true;
      }
    };
  };

  Enigmail.msg.setIdentityDefaults();

  Enigmail.msg.isEnigmailEnabled = function() {
    //Function Overriding
    return false;
  };

  Enigmail.msg.setIdentityDefaults();

  Assert.equal(Enigmail.msg.statusEncryptedStr, EnigmailLocale.getString("encryptNo"));
  Assert.equal(Enigmail.msg.statusSignedStr, EnigmailLocale.getString("signNo", [""]));
  Assert.equal(Enigmail.msg.statusPGPMimeStr, EnigmailLocale.getString("pgpmimeNormal"));
  Assert.equal(Enigmail.msg.statusInlinePGPStr, EnigmailLocale.getString("inlinePGPNormal"));
  Assert.equal(Enigmail.msg.statusSMimeStr, EnigmailLocale.getString("smimeNormal"));
  Assert.equal(Enigmail.msg.statusAttachOwnKey, EnigmailLocale.getString("attachOwnKeyNo"));

  Enigmail.msg.juniorMode = true;

  Enigmail.msg.pepEnabled = function(){
    //Function Overriding
    return false;
  };

  document = {
    getElementById : function(){
      return {
        setAttribute : function(str1, bool){
          Assert.equal(bool, "false");
        }
      };
    }
  };

  Enigmail.msg.setIdentityDefaults();

  Enigmail.msg.pepEnabled = function(){
    //Function Overriding
    return true;
  };

  document = {
    getElementById : function(){
      return {
        setAttribute : function(str1, bool){
          Assert.equal(bool, "true");
        }
      };
    }
  };

  Enigmail.msg.setIdentityDefaults();

  Enigmail.msg.sendModeDirty = false;
  Enigmail.msg.setIdentityDefaults();

  Enigmail.msg.statusEncryptedStr = "";
  Enigmail.msg.statusSignedStr = "";
  Enigmail.msg.statusPGPMimeStr = "";
  Enigmail.msg.statusInlinePGPStr = "";
  Enigmail.msg.statusSMimeStr = "";
  Enigmail.msg.statusAttachOwnKey = "";

}

function setOwnKeyStatus_test(){

  Enigmail.msg.allowAttachOwnKey = function(){
    //Function Overriding
    return 0;
  };

  document.getElementById = function(str){
    return {
      setAttribute : function(){
        Assert.ok(true);
      },
      removeAttribute : function(){
        Assert.ok(true);
      }
    };
  };

  Enigmail.msg.setOwnKeyStatus();
  Assert.equal(Enigmail.msg.statusAttachOwnKey, EnigmailLocale.getString("attachOwnKeyDisabled"));

  Enigmail.msg.allowAttachOwnKey = function(){
    //Function Overriding
    return 1;
  };

  Enigmail.msg.attachOwnKeyObj.appendAttachment = true;
  Enigmail.msg.setOwnKeyStatus();
  Assert.equal(Enigmail.msg.statusAttachOwnKey, EnigmailLocale.getString("attachOwnKeyYes"));

  Enigmail.msg.attachOwnKeyObj.appendAttachment = false;
  Enigmail.msg.setOwnKeyStatus();
  Assert.equal(Enigmail.msg.statusAttachOwnKey, EnigmailLocale.getString("attachOwnKeyNo"));
}

function setPepPrivacyLabel_test(){
  document.getElementById = function(){
    return {
      getAttribute : function(){
        return "false";
      },
      setAttribute : function(prop, val){
        if(prop === "value"){
          Assert.equal(val, EnigmailLocale.getString("msgCompose.pepSendUnsecure"));
        }
        else if(prop === "class"){
          Assert.equal(val, "enigmail-statusbar-pep-unsecure");
        }
      }
    };
  };

  EnigmailPEPAdapter.calculateColorFromRating = function(){
    return "green";
  };

  Enigmail.msg.setPepPrivacyLabel(1);

  document.getElementById = function(){
    return {
      getAttribute : function(){
        return "true";
      },
      setAttribute : function(prop, val){
        if(prop === "value"){
          Assert.equal(val, EnigmailLocale.getString("msgCompose.pepSendUnknown"));
        }
        else if(prop === "class"){
          Assert.equal(val, "enigmail-statusbar-pep-unsecure");
        }
      }
    };
  };

  Enigmail.msg.setPepPrivacyLabel(0);

  document.getElementById = function(){
    return {
      getAttribute : function(){
        return "true";
      },
      setAttribute : function(prop, val){
        if(prop === "value"){
          Assert.equal(val, EnigmailLocale.getString("msgCompose.pepSendTrusted"));
        }
        else if(prop === "class"){
          Assert.equal(val, "enigmail-statusbar-pep-trusted");
        }
      }
    };
  };

  Enigmail.msg.setPepPrivacyLabel(1);

  EnigmailPEPAdapter.calculateColorFromRating = function(){
    return "yellow";
  };

  document.getElementById = function(){
    return {
      getAttribute : function(){
        return "true";
      },
      setAttribute : function(prop, val){
        if(prop === "value"){
          Assert.equal(val, EnigmailLocale.getString("msgCompose.pepSendSecure"));
        }
        else if(prop === "class"){
          Assert.equal(val, "enigmail-statusbar-pep-secure");
        }
      }
    };
  };

  Enigmail.msg.setPepPrivacyLabel(1);
}

function setSendMode_test() {

  Enigmail.msg.processFinalState = () => {
    //Function Overriding
    return null;
  };

  Enigmail.msg.updateStatusBar = () => {
    //Function Overriding
    return null;
  };

  Enigmail.msg.sendMode = EnigmailConstants.SEND_SIGNED;
  Enigmail.msg.setSendMode('sign');
  Assert.equal(Enigmail.msg.sendMode, EnigmailConstants.SEND_SIGNED);

  Enigmail.msg.sendMode = EnigmailConstants.SEND_ENCRYPTED;
  Enigmail.msg.setSendMode('sign');
  Assert.equal(Enigmail.msg.sendMode, 3);

  Enigmail.msg.sendMode = EnigmailConstants.SEND_ENCRYPTED;
  Enigmail.msg.setSendMode('encrypt');
  Assert.equal(Enigmail.msg.sendMode, EnigmailConstants.SEND_ENCRYPTED);

  Enigmail.msg.sendMode = EnigmailConstants.SEND_SIGNED;
  Enigmail.msg.setSendMode('encrypt');
  Assert.equal(Enigmail.msg.sendMode, 3);

}

function signingNoLongerDependsOnEnc_test() {
  Enigmail.msg.finalSignDependsOnEncrypt = true;
  Enigmail.msg.juniorMode = true;
  Enigmail.msg.signingNoLongerDependsOnEnc();
  EnigmailDialog.alertPref = function(){
    Assert.ok(true);
  };
  Assert.equal(Enigmail.msg.finalSignDependsOnEncrypt, true);

  Enigmail.msg.juniorMode = false;
  EnigmailDialog.alertPref = function(){};
  Enigmail.msg.signingNoLongerDependsOnEnc();
  EnigmailDialog.alertPref = function(){
    Assert.ok(true);
  };
  Assert.equal(Enigmail.msg.finalSignDependsOnEncrypt, false);
}

function toggleAccountAttr_test(){

  Enigmail.msg.identity = {};

  let attr_name = 'random';
  Enigmail.msg.identity.getBoolAttribute = function(){
    //Function Overriding
    return true;
  };

  Enigmail.msg.identity.setBoolAttribute = function(attrName, oldValue){
    //Function Overriding
    Assert.equal(attrName, attr_name);
    Assert.equal(oldValue, false);
  };

  Enigmail.msg.toggleAccountAttr(attr_name);

}

function toggleAttachOwnKey_test(){

  EnigmailCore.getService = function(){
    Assert.ok(true);
  };

  Enigmail.msg.attachOwnKeyObj.appendAttachment = true;

  Enigmail.msg.setOwnKeyStatus = function(){
    Assert.ok(true);
  };

  Enigmail.msg.toggleAttachOwnKey();
  Assert.equal(Enigmail.msg.attachOwnKeyObj.appendAttachment, false);

}

function toggleAttribute_test(){

  let attr_name = 'random';
  EnigmailPrefs.getPref = function(){
    //Function Overriding
    return true;
  };

  EnigmailPrefs.setPref = function(attrName, oldValue){
    //Function Overriding
    Assert.equal(attrName, attr_name);
    Assert.equal(oldValue, false);
  };

  Enigmail.msg.toggleAttribute(attr_name);

}

function toggleProtectHeaders_test(){
  EnigmailCore.getService = function(){
    Assert.ok(true);
  };

  Enigmail.msg.protectHeaders = true;

  Enigmail.msg.displayProtectHeadersStatus = function(){
    Assert.ok(true);
  };

  Enigmail.msg.toggleProtectHeaders();
  Assert.equal(Enigmail.msg.protectHeaders, false);
}

function toggleSMimeEncrypt_test() {

  gSMFields = {
    requireEncryptMessage : true
  };
  Enigmail.msg.toggleSMimeEncrypt();
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_ALWAYS);
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_FORCE_SMIME);

  gSMFields = {
    requireEncryptMessage : false,
    signMessage : false
  };
  Enigmail.msg.toggleSMimeEncrypt();
  Assert.equal(Enigmail.msg.encryptForced, EnigmailConstants.ENIG_NEVER);
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_UNDEF);

}

function toggleSMimeSign_test() {
  gSMFields = {
    signMessage : true
  };
  Enigmail.msg.toggleSMimeSign();
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_ALWAYS);
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_FORCE_SMIME);

  gSMFields = {
    requireEncryptMessage : false,
    signMessage : false
  };
  Enigmail.msg.toggleSMimeSign();
  Assert.equal(Enigmail.msg.signForced, EnigmailConstants.ENIG_NEVER);
  Assert.equal(Enigmail.msg.pgpmimeForced, EnigmailConstants.ENIG_UNDEF);

}

function toggleSmimeToolbar_test(){

  Enigmail.msg.toggleSMimeEncrypt = function(){
    //Function Overriding
    Assert.ok(true);
  };

  Enigmail.msg.toggleSMimeSign = function(){
    //Function Overriding
    Assert.ok(true);
  };

  let event  = {
    'target' : {
      'id' : "menu_securitySign2"
    },
    stopPropagation : function(){
      Assert.ok(true);
    }
  };
  Enigmail.msg.toggleSmimeToolbar(event);

  event  = {
    'target' : {
      'id' : "menu_securityEncryptRequire2"
    },
    stopPropagation : function(){
      Assert.ok(true);
    }
  };
  Enigmail.msg.toggleSmimeToolbar(event);

}

function trustAllKeys_test() {
  // test functionality of trustAllKeys
  Enigmail.msg.trustAllKeys = true;
  Enigmail.msg.tempTrustAllKeys();
  Assert.equal(Enigmail.msg.trustAllKeys, false, "check trustAllKeys is false");

  Enigmail.msg.tempTrustAllKeys();
  Assert.equal(Enigmail.msg.trustAllKeys, true, "check trustAllKeys is true");

}

function tryEnablingSMime_test() {

  gSMFields = {};

  var encFinally = EnigmailConstants.ENIG_FINAL_FORCENO;
  var signFinally = EnigmailConstants.ENIG_FINAL_FORCENO;
  var ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);


  Enigmail.msg.mimePreferOpenPGP = 1;
  Enigmail.msg.encryptByRules = EnigmailConstants.ENIG_ALWAYS;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);


  Enigmail.msg.mimePreferOpenPGP = 1;
  Enigmail.msg.encryptByRules = null;
  Enigmail.msg.autoPgpEncryption = 1;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);


  Enigmail.msg.mimePreferOpenPGP = 0;
  Enigmail.msg.encryptByRules = EnigmailConstants.ENIG_NEVER;
  Enigmail.msg.autoPgpEncryption = 0;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);


  Enigmail.msg.encryptByRules = null;
  Enigmail.msg.pgpmimeForced = EnigmailConstants.ENIG_NEVER;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);


  Enigmail.msg.pgpmimeForced = EnigmailConstants.ENIG_ALWAYS;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);


  encFinally = EnigmailConstants.ENIG_FINAL_FORCEYES;
  signFinally = EnigmailConstants.ENIG_FINAL_YES;
  Enigmail.msg.pgpmimeForced = EnigmailConstants.ENIG_FORCE_SMIME;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCEYES);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_YES);
  Assert.equal(Enigmail.msg.statusPGPMime, EnigmailConstants.ENIG_FINAL_FORCESMIME);
  Assert.equal(gSMFields.requireEncryptMessage, true);
  Assert.equal(gSMFields.signMessage, true);


  Enigmail.msg.isSmimeEncryptionPossible = () => {
    //Function Overriding
    return true;
  };
  EnigmailPrefs.getPref = function(){
    //Function Overriding
    return 1;
  };
  Enigmail.msg.tryEnablingSMime.autoSendEncrypted = 0;
  Enigmail.msg.pgpmimeForced = null;
  Enigmail.msg.mimePreferOpenPGP = 0;
  encFinally = EnigmailConstants.ENIG_FINAL_FORCEYES;
  signFinally = EnigmailConstants.ENIG_FINAL_FORCENO;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_YES);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(Enigmail.msg.statusPGPMime, EnigmailConstants.ENIG_FINAL_SMIME);
  Assert.equal(gSMFields.requireEncryptMessage, true);
  Assert.equal(gSMFields.signMessage, false);

  Enigmail.msg.autoPgpEncryption = false;
  Enigmail.msg.mimePreferOpenPGP = null;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_YES);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(Enigmail.msg.statusPGPMime, EnigmailConstants.ENIG_FINAL_SMIME);
  Assert.equal(gSMFields.requireEncryptMessage, true);
  Assert.equal(gSMFields.signMessage, false);

  Enigmail.msg.isSmimeEncryptionPossible = () => {
    //Function Overriding
    return false;
  };
  Enigmail.msg.autoPgpEncryption = true;
  encFinally = EnigmailConstants.ENIG_FINAL_NO;
  signFinally = EnigmailConstants.ENIG_FINAL_YES;
  Enigmail.msg.mimePreferOpenPGP = 0;
  Enigmail.msg.autoPgpEncryption = false;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_NO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_YES);
  Assert.equal(Enigmail.msg.statusPGPMime, EnigmailConstants.ENIG_FINAL_SMIME);
  Assert.equal(gSMFields.requireEncryptMessage, false);
  Assert.equal(gSMFields.signMessage, true);


  encFinally = EnigmailConstants.ENIG_FINAL_FORCENO;
  signFinally = EnigmailConstants.ENIG_FINAL_FORCEYES;
  Enigmail.msg.autoPgpEncryption = true;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCENO);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCEYES);
  Assert.equal(Enigmail.msg.statusPGPMime, EnigmailConstants.ENIG_FINAL_SMIME);
  Assert.equal(gSMFields.requireEncryptMessage, false);
  Assert.equal(gSMFields.signMessage, false);


  EnigmailPrefs = {
    getPref : (prop) => {
      //Function Overriding
      return 0;
    }
  };

  Enigmail.msg.isSmimeEncryptionPossible = () => {
    //Function Overriding
    return true;
  };

  encFinally = EnigmailConstants.ENIG_FINAL_FORCEYES;
  signFinally = EnigmailConstants.ENIG_FINAL_FORCEYES;
  Enigmail.msg.autoPgpEncryption = false;
  Enigmail.msg.mimePreferOpenPGP = null;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCEYES);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCEYES);
  Assert.equal(Enigmail.msg.statusPGPMime, EnigmailConstants.ENIG_FINAL_SMIME);
  Assert.equal(gSMFields.requireEncryptMessage, true);
  Assert.equal(gSMFields.signMessage, true);

  Enigmail.msg.statusPGPMime = null;
  Enigmail.msg.autoPgpEncryption = true;
  Enigmail.msg.mimePreferOpenPGP = null;
  ret = Enigmail.msg.tryEnablingSMime(encFinally, signFinally);
  Assert.equal(ret.encFinally, EnigmailConstants.ENIG_FINAL_FORCEYES);
  Assert.equal(ret.signFinally, EnigmailConstants.ENIG_FINAL_FORCEYES);
  Assert.equal(Enigmail.msg.statusPGPMime, null);
  Assert.equal(gSMFields.requireEncryptMessage, false);
  Assert.equal(gSMFields.signMessage, false);

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
  setIdentityDefaults_test();

  sendAborted_test();
  setAdditionalHeader_test();
  setChecked_test();
  setDraftStatus_test();
  setFinalSendMode_test();
  setIdentityCallback_test();
  setOwnKeyStatus_test();
  setPepPrivacyLabel_test();
  setSendMode_test();
  signingNoLongerDependsOnEnc_test();
  toggleAccountAttr_test();
  toggleAttachOwnKey_test();
  toggleAttribute_test();
  toggleProtectHeaders_test();
  toggleSMimeEncrypt_test();
  toggleSMimeSign_test();
  toggleSmimeToolbar_test();
  trustAllKeys_test();
  tryEnablingSMime_test();

}
