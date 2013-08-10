/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
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
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org> are
 * Copyright (C) 2012 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */


Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailKeyMgmt" ];

const Ec = EnigmailCommon;
const Cc = Components.classes;
const Ci = Components.interfaces;

const GET_BOOL = "GET_BOOL";
const GET_LINE = "GET_LINE";
const GET_HIDDEN = "GET_HIDDEN";


function KeyEditor(reqObserver, callbackFunc, inputData) {
  this._reqObserver = reqObserver;
  this._callbackFunc = callbackFunc;
  this._inputData = inputData;

  if (this._inputData && this._inputData.cardAdmin) {
    this._saveCmd = "quit";
  }
  else
    this._saveCmd = "save";
}

KeyEditor.prototype = {
  _stdin: null,
  _data: "",
  _txt: "",
  _exitCode: 0,
  errorMsg: "",

  setStdin: function(pipe) {
    this._stdin = pipe;
    if (this._data.length > 0) this.processData();
  },

  gotData: function(data) {
    //Ec.DEBUG_LOG("keyManagement.jsm: KeyEditor.gotData: '"+data+"'\n");
    this._data += data.replace(/\r\n/g, "\n");
    this.processData();
  },

  processData: function() {
    //Ec.DEBUG_LOG("keyManagement.jsm: KeyEditor.processData\n");
    var txt = "";
    while (this._data.length > 0 && this._stdin) {
      var index = this._data.indexOf("\n");
      if (index < 0) {
        txt = this._data;
        this._data = "";
      }
      else {
        txt = this._data.substr(0, index);
        this._data = this._data.substr(index+1);
      }
      this.nextLine(txt);
    }
  },

  closeStdin: function() {
    Ec.DEBUG_LOG("keyManagement.jsm: KeyEditor.closeStdin:\n");
    if (this._stdin) {
      this._stdin.close();
      this._stdin = null;
    }
  },

  done: function(parentCallback, exitCode) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.done: exitCode="+exitCode+"\n");

    if (exitCode == 0) exitCode = this._exitCode;

    if (exitCode == 0 && typeof(this._inputData) == "object" && this._inputData.usePassphrase) {
      Ec.stillActive();
    }

    Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.done: returning exitCode "+exitCode+"\n");

    parentCallback(exitCode, this.errorMsg);
  },

  writeLine: function (inputData) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.writeLine: '"+inputData+"'\n");
    this._stdin.write(inputData+"\n");
  },

  nextLine: function(txt) {
    if (txt.indexOf("[GNUPG:]") >= 0) {
      if (this._reqObserver) {
        var newTxt = this._reqObserver.onDataAvailable(txt);
        if (newTxt.length > 0) {

          txt = newTxt;
        }
      }
      this._txt = txt;
      this.processLine(txt);
    }
  },

  doCheck: function(inputType, promptVal) {
    var a=this._txt.split(/ /);
    return ((a[1] == inputType) && (a[2] == promptVal));
  },

  getText: function() {
    return this._txt;
  },

  processLine: function(txt) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.processLine: '"+txt+"'\n");
    var r = { quitNow: false,
              exitCode: -1 };

    try {
      if (txt.indexOf("[GNUPG:] BAD_PASSPHRASE")>=0 ||
          txt.indexOf("[GNUPG:] SC_OP_FAILURE 2") >= 0) {
        Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.processLine: detected bad passphrase\n");
        r.exitCode=-2;
        r.quitNow=true;
        this.errorMsg=Ec.getString("badPhrase");
        Ec.clearCachedPassphrase();
      }
      if (txt.indexOf("[GNUPG:] NO_CARD_AVAILABLE")>=0) {
        Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.processLine: detected missing card\n");
        this.errorMsg=Ec.getString("noCardAvailable");
        r.exitCode=-3;
        r.quitNow=true;
      }
      if (txt.indexOf("[GNUPG:] ENIGMAIL_FAILURE")==0) {
        Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.processLine: detected general failure\n");
        r.exitCode = -3;
        r.quitNow = true;
        this.errorMsg = txt.substr(26);
      }
      if (txt.indexOf("[GNUPG:] ALREADY_SIGNED")>=0) {
        Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.processLine: detected key already signed\n");
        this.errorMsg=Ec.getString("keyAlreadySigned");
        r.exitCode=-1;
        r.quitNow = true;
      }
      if (txt.indexOf("[GNUPG:] MISSING_PASSPHRASE")>=0) {
        Ec.DEBUG_LOG("keyManagmenent.jsm: KeyEditor.processLine: detected missing passphrase\n");
        this.errorMsg=Ec.getString("noPassphrase");
        r.exitCode = -2;
        this._exitCode = -2;
        r.quitNow = true;
      }
      if (txt.indexOf("[GNUPG:] GET_") < 0) {
        // return if no "GET" statement
        return;
      }
    }
    catch (ex) {
      txt="";
      r.quitNow=true;
    }

    if (! r.quitNow) {
      if (txt.indexOf("[GNUPG:] GOT_IT") < 0) {
        if (this._callbackFunc) {
          this._callbackFunc(this._inputData, this, r);
          if (r.exitCode == 0) {
            this.writeLine(r.writeTxt);
          }
          else {
            if (r.errorMsg && r.errorMsg.length > 0)
              this.errorMsg = r.errorMsg;
          }
        }
        else {
          r.quitNow=true;
          r.exitCode = 0;
        }
      }
      else {
        r.exitCode = 0;
      }
    }

    if (r.quitNow) {
      try {
        this.writeLine(this._saveCmd);
        this.closeStdin();
      }
      catch (ex) {
        Ec.DEBUG_LOG("no more data\n");
      }
    }

    if (r.exitCode != null)
      this._exitCode = r.exitCode;
  },

  QueryInterface: function (iid) {
    if (!iid.equals(Ci.nsISupports))
         throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

/*
 * NOTE: the callbackFunc used in every call to the key editor needs to be implemented like this:
 * callbackFunc(returnCode, errorMsg)
 * returnCode = 0 in case of success
 * returnCode != 0 and errorMsg set in case of failure
*/

var EnigmailKeyMgmt = {

  editKey: function (parent, needPassphrase, userId, keyId, editCmd, inputData, callbackFunc, requestObserver, parentCallback) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: editKey: parent="+parent+", editCmd="+editCmd+"\n");

    var enigmailSvc = Ec.getService(parent);
    if (!enigmailSvc) {
      Ec.ERROR_LOG("keyManagmenent.jsm: Enigmail.editKey: not yet initialized\n");
      parentCallback(-1, Ec.getString("notInit"));
      return -1;
    }

    var keyIdList = keyId.split(" ");
    var args = Ec.getAgentArgs(false);

    var statusFlags = new Object();

    var passphrase = "";
    var useAgentObj = new Object();

    if (needPassphrase) {
      args=args.concat(Ec.passwdCommand());

      var passwdObj = new Object();

      if (!Ec.getPassphrase(parent, passwdObj, useAgentObj, 0)) {
         Ec.ERROR_LOG("keyManagmenent.jsm: editKey: Error - no passphrase supplied\n");

         parentCallback(-1, Ec.getString("noPassphrase"));
         return -1;
      }

      passphrase = passwdObj.value;
    }
    else
    {
      useAgentObj.value = true;
    }

    args=args.concat(["--no-tty", "--status-fd", "1", "--logger-fd", "1", "--command-fd", "0"]);
    if (userId) args=args.concat(["-u", userId]);
    var editCmdArr;
    if (typeof(editCmd) == "string") {
      editCmdArr = [ editCmd ];
    }
    else {
      editCmdArr = editCmd;
    }

    if (editCmdArr[0] == "revoke") {
      // escape backslashes and ' characters
      args=args.concat(["-a", "-o"]);
      args.push(Ec.getEscapedFilename(inputData.outFile.path));
      args.push("--gen-revoke");
      args=args.concat(keyIdList);
    }
    else if (editCmdArr[0].indexOf("--")==0) {
      args=args.concat(editCmd);
      args=args.concat(keyIdList);
    }
    else {
      args=args.concat(["--ask-cert-level", "--edit-key", keyId]);
      args=args.concat(editCmd);
    }


    var command= enigmailSvc.agentPath;
    Ec.CONSOLE_LOG("enigmail> "+Ec.printCmdLine(command, args)+"\n");

    var keyEdit = new KeyEditor(requestObserver, callbackFunc, inputData);

    try {
      var proc = subprocess.call({
        command: command,
        arguments: args,
        charset: null,
        environment: Ec.getEnvList(),
        stdin: function (stdin) {
          if (needPassphrase && Ec.requirePassword()) {
            stdin.write(passphrase+"\n");
          }
          keyEdit.setStdin(stdin);
        },
        stdout: function(data) {
          keyEdit.gotData(data);
        },
        done: function(result) {
          Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.editKey: GnuPG terminated with code="+result.exitCode+"\n");
          keyEdit.done(parentCallback, result.exitCode);
        },
        mergeStderr: false
      });
    } catch (ex) {
      Ec.ERROR_LOG("keyManagement.jsm: editKey: "+command.path+" failed\n");
      parentCallback(-1, "");
    }
  },

  setKeyTrust: function (parent, keyId, trustLevel, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.setKeyTrust: trustLevel="+trustLevel+", keyId="+keyId+"\n");

    return this.editKey(parent, false, null, keyId, "trust",
                        { trustLevel: trustLevel},
                        keyTrustCallback,
                        null,
                        callbackFunc);
  },

  signKey: function (parent, userId, keyId, signLocally, trustLevel, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.signKey: trustLevel="+trustLevel+", userId="+userId+", keyId="+keyId+"\n");
    return this.editKey(parent, true, userId, keyId,
                        (signLocally ? "lsign" : "sign"),
                        { trustLevel: trustLevel,
                          usePassphrase: true },
                        signKeyCallback,
                        null,
                        callbackFunc);
  },

  genRevokeCert: function (parent, keyId, outFile, reasonCode, reasonText, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.genRevokeCert: keyId="+keyId+"\n");

    var r= this.editKey(parent, true, null, keyId, "revoke",
                        { outFile: outFile,
                          reasonCode: reasonCode,
                          reasonText: Ec.convertFromUnicode(reasonText),
                          usePassphrase: true },
                        revokeCertCallback,
                        null,
                        callbackFunc);
    return r;
  },

  addUid: function (parent, keyId, name, email, comment, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.addUid: keyId="+keyId+", name="+name+", email="+email+"\n");
    var r= this.editKey(parent, true, null, keyId, "adduid",
                        { email: email,
                          name: name,
                          comment: comment,
                          nameAsked: 0,
                          emailAsked: 0,
                          usePassphrase: true },
                        addUidCallback,
                        null,
                        callbackFunc);
    return r;
  },

  deleteKey: function (parent, keyId, deleteSecretKey, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.addUid: keyId="+keyId+", deleteSecretKey="+deleteSecretKey+"\n");

    var cmd = (deleteSecretKey ? "--delete-secret-and-public-key" : "--delete-key");
    var r= this.editKey(parent, false, null, keyId, cmd,
                        { usePassphrase: true },
                        deleteKeyCallback,
                        null,
                        callbackFunc);
    return r;
  },

  changePassphrase: function (parent, keyId, oldPw, newPw, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.changePassphrase: keyId="+keyId+"\n");

    var pwdObserver = new ChangePasswdObserver();
    var r= this.editKey(parent, false, null, keyId, "passwd",
                        { oldPw: oldPw,
                          newPw: newPw,
                          useAgent: Ec.enigmailSvc.useGpgAgent(),
                          step: 0,
                          observer: pwdObserver,
                          usePassphrase: true },
                        changePassphraseCallback,
                        pwdObserver,
                        callbackFunc);
    return r;
  },


  enableDisableKey: function (parent, keyId, disableKey, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.enableDisableKey: keyId="+keyId+", disableKey="+disableKey+"\n");

    var cmd = (disableKey ? "disable" : "enable");
    var r= this.editKey(parent, false, null, keyId, cmd,
                        { usePassphrase: true },
                        null,
                        null,
                        callbackFunc);
    return r;
  },

  setPrimaryUid: function (parent, keyId, idNumber, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.setPrimaryUid: keyId="+keyId+", idNumber="+idNumber+"\n");
    var r = this.editKey(parent, true, null, keyId, "",
                        { idNumber: idNumber,
                          step: 0,
                          usePassphrase: true },
                        setPrimaryUidCallback,
                        null,
                        callbackFunc);
    return r;
  },


  deleteUid: function (parent, keyId, idNumber, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.deleteUid: keyId="+keyId+", idNumber="+idNumber+"\n");
    var r = this.editKey(parent, true, null, keyId, "",
                        { idNumber: idNumber,
                          step: 0,
                          usePassphrase: true },
                        deleteUidCallback,
                        null,
                        callbackFunc);
    return r;
  },


  revokeUid: function (parent, keyId, idNumber, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.revokeUid: keyId="+keyId+", idNumber="+idNumber+"\n");
    var r = this.editKey(parent, true, null, keyId, "",
                        { idNumber: idNumber,
                          step: 0,
                          usePassphrase: true },
                        revokeUidCallback,
                        null,
                        callbackFunc);
    return r;
  },

  addPhoto: function (parent, keyId, photoFile, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.addPhoto: keyId="+keyId+"\n");

    var photoFileName = Ec.getEscapedFilename(Ec.getFilePath(photoFile.QueryInterface(Ec.getLocalFileApi())));

    var r = this.editKey(parent, true, null, keyId, "addphoto",
                        { file: photoFileName,
                          step: 0,
                          usePassphrase: true },
                        addPhotoCallback,
                        null,
                        callbackFunc);
    return r;
  },


  genCardKey: function (parent, name, email, comment, expiry, backupPasswd, requestObserver, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.genCardKey: \n");
    var generateObserver = new enigCardAdminObserver(requestObserver, Ec.isDosLike());
    var r = this.editKey(parent, false, null, "", ["--with-colons", "--card-edit"] ,
                        { step: 0,
                          name: Ec.convertFromUnicode(name),
                          email: email,
                          comment: Ec.convertFromUnicode(comment),
                          expiry: expiry,
                          backupPasswd: backupPasswd,
                          cardAdmin: true,
                          backupKey: (backupPasswd.length > 0 ? "Y" : "N"),
                          parent: parent },
                        genCardKeyCallback,
                        generateObserver,
                        callbackFunc);
    return r;
  },

  cardAdminData: function (parent, name, firstname, lang, sex, url, login, forcepin, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.cardAdminData: parent="+parent+", name="+name+", firstname="+firstname+", lang="+lang+", sex="+sex+", url="+url+", login="+login+", forcepin="+forcepin+"\n");
    var adminObserver = new enigCardAdminObserver(null, Ec.isDosLike());
    var r = this.editKey(parent, false, null, "", ["--with-colons", "--card-edit"],
            { step: 0,
              name: name,
              firstname: firstname,
              lang: lang,
              sex: sex,
              url: url,
              login: login,
              cardAdmin: true,
              forcepin: forcepin },
             cardAdminDataCallback,
             adminObserver,
             callbackFunc);
    return r;
  },

  cardChangePin: function (parent, action, oldPin, newPin, adminPin, pinObserver, callbackFunc) {
    Ec.DEBUG_LOG("keyManagmenent.jsm: Enigmail.cardChangePin: parent="+parent+", action="+action+"\n");
    var adminObserver = new enigCardAdminObserver(pinObserver, Ec.isDosLike());
    var enigmailSvc = Ec.getService(parent);

    var r = this.editKey(parent, enigmailSvc.useGpgAgent(), null, "", ["--with-colons", "--card-edit"],
            { step: 0,
              pinStep: 0,
              cardAdmin: true,
              action: action,
              oldPin: oldPin,
              newPin: newPin,
              adminPin: adminPin },
             cardChangePinCallback,
             adminObserver,
             callbackFunc);
    return r;
  }

}; // EnigmailKeyMgmt


function signKeyCallback(inputData, keyEdit, ret) {

  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_BOOL, "sign_uid.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.sign_all.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "sign_uid.expire" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";
  }
  else if (keyEdit.doCheck(GET_LINE, "trustsig_prompt.trust_value" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";
  }
  else if (keyEdit.doCheck(GET_LINE, "trustsig_prompt.trust_depth" )) {
    ret.exitCode = 0;
    ret.writeTxt = "";
  }
  else if (keyEdit.doCheck(GET_LINE, "trustsig_prompt.trust_regexp" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";}
  else if (keyEdit.doCheck(GET_LINE, "siggen.valid" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";
  }
  else if (keyEdit.doCheck(GET_BOOL, "sign_uid.local_promote_okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "sign_uid.class" )) {
    ret.exitCode = 0;
    ret.writeTxt = new String(inputData.trustLevel);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.exitCode = 0;
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function keyTrustCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "edit_ownertrust.value" )) {
    ret.exitCode = 0;
    ret.writeTxt = new String(inputData.trustLevel);
  }
  else if (keyEdit.doCheck(GET_BOOL, "edit_ownertrust.set_ultimate.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.exitCode = 0;
    ret.quitNow = true;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function addUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keygen.name" )) {
    ++inputData.nameAsked;
    if (inputData.nameAsked==1) {
      ret.exitCode = 0;
      ret.writeTxt = inputData.name;
    }
    else {
      ret.exitCode=-1;
      ret.quitNow=true;
      ret.errorMsg="Invalid name (too short)";
    }
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.email")) {
    ++inputData.emailAsked;
    if (inputData.emailAsked==1) {
      ret.exitCode = 0;
      ret.writeTxt = inputData.email;
    }
    else {
      ret.exitCode=-1;
      ret.quitNow=true;
      ret.errorMsg="Invalid email";
    }
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.comment")) {
    ret.exitCode = 0;
    if (inputData.comment) {
      ret.writeTxt = inputData.comment;
    }
    else {
      ret.writeTxt="";
    }
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.exitCode = 0;
    ret.quitNow = true;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function revokeCertCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.code" )) {
    ret.exitCode = 0;
    ret.writeTxt = new String(inputData.reasonCode);
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.text" )) {
    ret.exitCode = 0;
    ret.writeTxt = "";
  }
  else if (keyEdit.doCheck(GET_BOOL, "gen_revoke.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "ask_revocation_reason.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "openfile.overwrite.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.exitCode = 0;
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function setPrimaryUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ++inputData.step;
    switch (inputData.step) {
    case 1:
      ret.exitCode = 0;
      ret.writeTxt = "uid "+inputData.idNumber;
      break;
    case 2:
      ret.exitCode = 0;
      ret.writeTxt = "primary";
      break;
    case 3:
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    default:
      ret.exitCode = -1;
      ret.quitNow=true;
    }

  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function changePassphraseCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_HIDDEN, "passphrase.enter")) {
    switch (inputData.observer.passphraseStatus) {
    case 0:
      ret.writeTxt = inputData.oldPw;
      ret.exitCode = 0;
      break;
    case 1:
      ret.writeTxt = inputData.newPw;
      ret.exitCode = 0;
      break;
    case -1:
      ret.exitCode = -2;
      ret.quitNow=true;
      break;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "change_passwd.empty.okay")) {
    ret.writeTxt = "Y";
    ret.exitCode = 0;
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    if (inputData.useAgent) {
      ret.exitCode=0;
    }
    else
      ret.exitCode = null;
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function deleteUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ++inputData.step;
    switch (inputData.step) {
    case 1:
      ret.exitCode = 0;
      ret.writeTxt = "uid "+inputData.idNumber;
      break;
    case 2:
      ret.exitCode = 0;
      ret.writeTxt = "deluid";
      break;
    case 4:
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    default:
      ret.exitCode = -1;
      ret.quitNow=true;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.remove.uid.okay" )) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function revokeUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ++inputData.step;
    switch (inputData.step) {
    case 1:
      ret.exitCode = 0;
      ret.writeTxt = "uid "+inputData.idNumber;
      break;
    case 2:
      ret.exitCode = 0;
      ret.writeTxt = "revuid";
      break;
    case 7:
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    default:
      ret.exitCode = -1;
      ret.quitNow=true;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.revoke.uid.okay" )) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.code")) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "0"; // no reason specified
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.text")) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "";
  }
  else if (keyEdit.doCheck(GET_BOOL, "ask_revocation_reason.okay")) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function deleteKeyCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_BOOL, "delete_key.secret.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.remove.subkey.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "delete_key.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function GetPin(domWindow, promptMsg, ret) {
  Ec.DEBUG_LOG("keyManagmenent.jsm: GetPin: \n");

  var passwdObj = {value: ""};
  var dummyObj = {};

  var success = false;

  var promptService = Cc[NS_PROMPTSERVICE_CONTRACTID].getService(Ci.nsIPromptService);
  success = promptService.promptPassword(domWindow,
                                         Ec.getString("Enigmail"),
                                         promptMsg,
                                         passwdObj,
                                         null,
                                         dummyObj);

  if (!success) {
    ret.errorMsg = Ec.getString("noPassphrase");
    ret.quitNow=true;
    return false;
  }

  Ec.DEBUG_LOG("keyManagmenent.jsm: GetPin: got pin\n");
  ret.writeTxt = passwdObj.value;

  return true;
}

function genCardKeyCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  var pinObj={};

  if (keyEdit.doCheck(GET_LINE, "cardedit.prompt")) {
    if (inputData.step == 0) {
      ret.exitCode = 0;
      ret.writeTxt = "admin";
    }
    else if (inputData.step == 1) {
      ret.exitCode = 0;
      ret.writeTxt = "generate";
    }
    else {
      ret.exitCode = 0;
      ret.quitNow=true;
      ret.writeTxt = "quit";
    }
    ++inputData.step;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.genkeys.backup_enc") ||
           keyEdit.doCheck(GET_BOOL, "cardedit.genkeys.backup_enc")) {
    ret.exitCode = 0;
    ret.writeTxt = new String(inputData.backupKey);
  }
  else if (keyEdit.doCheck(GET_BOOL, "cardedit.genkeys.replace_keys")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.enter")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.backupPasswd;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.valid")) {
    ret.exitCode = 0;
    ret.writeTxt = new String(inputData.expiry);
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.genkeys.size")) {
    ret.exitCode = 0;
    ret.writeTxt = "2048";
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.name")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.name;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.email")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.email;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.comment")) {
    ret.exitCode = 0;
    if (inputData.comment) {
      ret.writeTxt = inputData.comment;
    }
    else {
      ret.writeTxt="";
    }
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function cardAdminDataCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  var pinObj={};

  if (keyEdit.doCheck(GET_LINE, "cardedit.prompt")) {
    ++inputData.step;
    ret.exitCode = 0;
    switch(inputData.step) {
    case 1:
      ret.writeTxt = "admin";
      break;
    case 2:
      ret.writeTxt = "name";
      break;
    case 3:
      ret.writeTxt = "lang";
      break;
    case 4:
      ret.writeTxt = "sex";
      break;
    case 5:
      ret.writeTxt = "url";
      break;
    case 6:
      ret.writeTxt = "login";
      break;
    case 7:
      if (inputData.forcepin != 0) {
        ret.writeTxt = "forcesig";
        break;
      }
    default:
      ret.writeTxt = "quit";
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    }
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.smartcard.surname")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.firstname.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.smartcard.givenname")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.name.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_sex")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.sex;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_lang")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.lang.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_url")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.url.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_login")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.login.replace(/^$/, "-");
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function cardChangePinCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "cardedit.prompt")) {
    ++inputData.step;
    ret.exitCode=0;
    switch (inputData.step) {
    case 1:
      ret.writeTxt = "admin";
      break;
    case 2:
      ret.writeTxt = "passwd";
      break;
    default:
      ret.writeTxt = "quit";
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    }
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    ret.exitCode=0;
    ret.writeTxt = inputData.adminPin;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    ret.exitCode=0;
    ret.writeTxt = inputData.oldPin;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.new.ask") ||
           keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.repeat") ||
           keyEdit.doCheck(GET_HIDDEN, "passphrase.ask") ||
           keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.new.ask")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.newPin;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardutil.change_pin.menu")) {
    ret.exitCode=0;
    ++inputData.pinStep;
    if (inputData.pinStep == 1) {
      ret.writeTxt = inputData.action.toString();
    }
    else {
      ret.writeTxt = "Q";
    }
  }
  else {
    ret.exitCode=-1;
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
  }
}


function addPhotoCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ret.exitCode = 0;
    ret.writeTxt = "save";
    ret.quitNow=true;
  }
  else if (keyEdit.doCheck(GET_LINE, "photoid.jpeg.add" )) {
    if (inputData.step == 0) {
      ++inputData.step;
      ret.exitCode = 0;
      ret.writeTxt = inputData.file;
    }
    else {
      ret.exitCode = -1;
      ret.quitNow=true;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "photoid.jpeg.size")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y"; // add large file
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function enigCardAdminObserver(guiObserver, isDosLike) {
  this._guiObserver = guiObserver;
  this._isDosLike = isDosLike;
}

enigCardAdminObserver.prototype =
{
  _guiObserver: null,
  _failureCode: 0,

  QueryInterface : function(iid)
  {
    if (iid.equals(Ci.nsIEnigMimeReadCallback) ||
        iid.equals(Ci.nsISupports) )
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  onDataAvailable: function (data) {
    var ret="";
    Ec.DEBUG_LOG("keyManagmenent.jsm: enigCardAdminObserver.onDataAvailable: data="+data+"\n");
    if (this._isDosLike && data.indexOf("[GNUPG:] BACKUP_KEY_CREATED") == 0) {
      data=data.replace(/\//g, "\\");
    }
    if (data.indexOf("[GNUPG:] SC_OP_FAILURE")>=0) {
      data=data.substr(23);
      if (data == "2") {
        data = "[GNUPG:] BAD_PASSPHRASE 0";
        this._failureCode = 2;
      }
      else
        this._failureCode = 1;
    }
    if (this._failureCode == 1) {
      ret = "[GNUPG:] ENIGMAIL_FAILURE "+data;
    }
    if (this._guiObserver) {
      this._guiObserver.onDataAvailable(data);
    }
    return ret;
  }
};

function ChangePasswdObserver() {}

ChangePasswdObserver.prototype =
{
  _failureCode: 0,
  passphraseStatus: 0,

  QueryInterface : function(iid)
  {
    if (iid.equals(Ci.nsIEnigMimeReadCallback) ||
        iid.equals(Ci.nsISupports) )
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  onDataAvailable: function (data) {
    var ret="";
    Ec.DEBUG_LOG("keyManagmenent.jsm: ChangePasswdObserver.onDataAvailable: data="+data+"\n");
    if (this._failureCode) {
      ret = "[GNUPG:] ENIGMAIL_FAILURE "+data;
    }
    if (data.indexOf("[GNUPG:] GOOD_PASSPHRASE")>=0) {
      this.passphraseStatus = 1;
    }
    else if (data.indexOf("[GNUPG:] BAD_PASSPHRASE")>=0) {
      this.passphraseStatus = -1;
    }
    return ret;
  }
};

