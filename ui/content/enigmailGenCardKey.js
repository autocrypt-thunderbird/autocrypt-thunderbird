/*
 * ***** BEGIN LICENSE BLOCK *****
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
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2005 Patrick Brunschwig. All Rights Reserved.
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
 * ***** END LICENSE BLOCK ***** *
 */

var gUserIdentityList;
var gUserIdentityListPopup;
var gUseForSigning;
var gUsedId;

function onLoad() {
  gUserIdentityList = document.getElementById("userIdentity");
  gUserIdentityListPopup = document.getElementById("userIdentityPopup");
  gUseForSigning = document.getElementById("useForSigning");
  //document.getElementById("bcNoExpiry")
  if (gUserIdentityListPopup) {
    fillIdentityListPopup();
  }
}

function onClose() {
  window.close();
}

function enableDisable(watchElement, bcElement, inverted) {
  var bcBackupKey = document.getElementById(bcElement);

  if (document.getElementById(watchElement).checked) {
    if (inverted) {
      bcBackupKey.setAttribute("disabled", "true");
    }
    else {
      bcBackupKey.removeAttribute("disabled");
    }
  }
  else {
    if (inverted) {
      bcBackupKey.removeAttribute("disabled");
    }
    else {
      bcBackupKey.setAttribute("disabled", "true");
    }
  }
}

function enigGenKeyObserver() {
  this._state = 0;
}

enigGenKeyObserver.prototype = {
  keyId: null,
  backupLocation: null,
  _state: null,

  QueryInterface: function(iid) {
    //EnigmailLog.DEBUG("enigmailGenCardKey: EnigMimeReadCallback.QI: "+iid+"\n");
    if (iid.equals(Components.interfaces.nsIEnigMimeReadCallback) ||
      iid.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  onDataAvailable: function(data) {

    var txt = "";
    var aLine = data.split(/ +/);

    if (aLine[0] == "[GNUPG:]") {

      if (aLine[1] == "GET_LINE" && aLine[2] == "keygen.comment") {
        txt = EnigmailLocale.getString("keygen.started") + "\n";
        this._state = 1;
      }
      else if (aLine[1] == "PROGRESS" && aLine[2] == "primegen") {
        txt = aLine[3];
      }
      else if (aLine[1] == "BACKUP_KEY_CREATED") {
        this.backupLocation = data.replace(/^.*BACKUP_KEY_CREATED [A-Z0-9]+ +/, "");
      }
      else if (aLine[1] == "KEY_CREATED") {
        this.keyId = aLine[3].substr(-16);
      }

    }
    else if (this._state > 0) {
      txt = data + "\n";
    }

    if (txt) {
      var contentFrame = EnigmailWindows.getFrame(window, "keygenConsole");

      if (contentFrame) {
        var consoleElement = contentFrame.document.getElementById('console');
        consoleElement.firstChild.data += txt;
        if (!contentFrame.mouseDownState)
          contentFrame.scrollTo(0, 9999);
      }
    }

    return "";
  }
};

function startKeyGen() {
  EnigmailLog.DEBUG("enigmailGenCardKey: startKeyGen(): Start\n");

  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("accessError"));
    return;
  }

  var passphraseElement = document.getElementById("passphrase");
  var passphrase2Element = document.getElementById("passphraseRepeat");
  var createBackupElement = document.getElementById("createBackup");

  var passphrase = passphraseElement.value;

  if (!createBackupElement.checked) {
    passphrase = "";
  }
  else {
    if (passphrase != passphrase2Element.value) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("passNoMatch"));
      return;
    }

    if (passphrase.search(/[^\x20-\x7E]/) >= 0) {
      if (!EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("keygen.passCharProblem"),
          EnigmailLocale.getString("dlg.button.ignore"), EnigmailLocale.getString("dlg.button.cancel"))) {
        return null;
      }
    }

    if (!passphrase) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("keygen.passRequired"));
      return;
    }
  }

  var commentElement = document.getElementById("keyComment");
  var comment = commentElement.value;

  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");

  var expiryTime = 0;
  var valid = "0";
  if (!noExpiry.checked) {
    expiryTime = Number(expireInput.value) * (timeScale.value == "y" ? 365 : (timeScale.value == "m" ? 30 : 1));
    if (expiryTime > 36500) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("expiryTooLong"));
      return;
    }
    if (expiryTime <= 0) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("expiryTooShort"));
      return;
    }
    valid = String(Number(expireInput.value));
    if (timeScale.value != "d") valid += timeScale.value;
  }
  var curId = getCurrentIdentity();
  gUsedId = curId;

  var userName = curId.fullName;
  var userEmail = curId.email;

  if (!userName) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("passUserName"));
    return;
  }

  var idString = userName;

  if (comment)
    idString += " (" + comment + ")";

  idString += " <" + userEmail + ">";

  var confirmMsg = EnigmailLocale.getString("keyConfirm", idString);

  if (!EnigConfirm(confirmMsg, EnigmailLocale.getString("keyMan.button.generateKey"))) {
    return;
  }
  var contentFrame = EnigmailWindows.getFrame(window, "keygenConsole");
  if (contentFrame) {
    var consoleElement = contentFrame.document.getElementById('console');
    consoleElement.firstChild.data = "";
  }

  var generateObserver = new enigGenKeyObserver();
  EnigmailKeyEditor.genCardKey(window,
    userName,
    userEmail,
    comment,
    valid,
    passphrase,
    generateObserver,
    function _keyGenCb(exitCode, errorMsg) {

      if (exitCode === 0 && generateObserver.keyId) {

        if (document.getElementById("useForSigning").checked && generateObserver.keyId) {
          gUsedId.setBoolAttribute("enablePgp", true);
          gUsedId.setIntAttribute("pgpKeyMode", 1);
          gUsedId.setCharAttribute("pgpkeyId", "0x" + generateObserver.keyId.substr(-8, 8));
        }

        var msg = EnigmailLocale.getString("keygen.completed", generateObserver.keyId);

        if (generateObserver.backupLocation) {
          msg += "\n" + EnigmailLocale.getString("keygen.keyBackup", generateObserver.backupLocation);
        }

        if (EnigmailDialog.confirmDlg(window, msg + "\n\n" + EnigmailLocale.getString("revokeCertRecommended"), EnigmailLocale.getString("keyMan.button.generateCert"))) {
          EnigCreateRevokeCert(generateObserver.keyId, curId.email, closeWin);
        }
        else
          closeWin();
      }
      else {
        EnigmailDialog.alert(window, errorMsg);
      }
    });
}

function closeWin() {
  window.close();
}