/*
The contents of this file are subject to the Mozilla Public
License Version 1.1 (the "MPL"); you may not use this file
except in compliance with the MPL. You may obtain a copy of
the MPL at http://www.mozilla.org/MPL/

Software distributed under the MPL is distributed on an "AS
IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
implied. See the MPL for the specific language governing
rights and limitations under the MPL.

The Original Code is Enigmail.

The Initial Developer of the Original Code is Ramalingam Saravanan.
Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.

Contributor(s):
Patrick Brunschwig <patrick.brunschwig@gmx.net>

Alternatively, the contents of this file may be used under the
terms of the GNU General Public License (the "GPL"), in which case
the provisions of the GPL are applicable instead of
those above. If you wish to allow use of your version of this
file only under the terms of the GPL and not to allow
others to use your version of this file under the MPL, indicate
your decision by deleting the provisions above and replace them
with the notice and other provisions required by the GPL.
If you do not delete the provisions above, a recipient
may use your version of this file under either the MPL or the
GPL.
*/

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailKeygen");

var gAccountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);

var gAutoCrypto;

var gIdentityList;
var gIdentityListPopup;
var gUseForSigning;

var gKeygenRequest;
var gAllData = "";
var gGeneratedKey="";
var gUsedId;

function enigmailKeygenLoad() {
  DEBUG_LOG("enigmailKeygen.js: Load\n");

  gAutoCrypto = EnigGetPref("autoCrypto");

  gIdentityList      = document.getElementById("userIdentity");
  gIdentityListPopup = document.getElementById("userIdentityPopup");
  gUseForSigning     = document.getElementById("useForSigning");

  if (gIdentityListPopup) {
    fillIdentityListPopup();
  }

  enigmailKeygenUpdate(true, false);

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     EnigAlert(EnigGetString("accessError"));
  }

  if (enigmailSvc.agentType != "gpg") {
     EnigAlert(EnigGetString("onlyGPG"));
     return;
  }  
}

function enigmailOnClose() {
  enigmailKeygenCancel();
}

function enigmailKeygenUnload() {
   DEBUG_LOG("enigmailKeygen.js: Unload\n");

   enigmailKeygenCloseRequest();
}


function enigmailKeygenUpdate(getPrefs, setPrefs) {
  DEBUG_LOG("enigmailKeygen.js: Update: "+getPrefs+", "+setPrefs+"\n");

  var noPassphrase        = document.getElementById("noPassphrase");
  var noPassphraseChecked = getPrefs ? EnigGetPref("noPassphrase")
                                     : noPassphrase.checked;

  if (setPrefs) {
    EnigSetPref("noPassphrase", noPassphraseChecked);
  }

  noPassphrase.checked = noPassphraseChecked;

  var passphrase1 = document.getElementById("passphrase");
  var passphrase2 = document.getElementById("passphraseRepeat");
  passphrase1.disabled = noPassphraseChecked;
  passphrase2.disabled = noPassphraseChecked;

  if (gAutoCrypto) {
    var commentElement = document.getElementById("keyComment");
    commentElement.value = "Enigmail auto crypto";
    commentElement.disabled = true;
  }
}

function enigmailKeygenTerminate(terminateArg, ipcRequest) {
   DEBUG_LOG("enigmailKeygen.js: Terminate: "+ipcRequest+"\n");

   // Give focus to this window
   window.focus();

   if (!ipcRequest.pipeTransport) {
      // changed interface in TB 1.1
      ipcRequest = ipcRequest.QueryInterface(Components.interfaces.nsIIPCRequest);
   }
   var keygenProcess = ipcRequest.pipeTransport;
   var enigmailSvc = GetEnigmailSvc();
   if (!enigmailSvc) {
     EnigAlert(EnigGetString("accessError"));
   }
   if (keygenProcess && !keygenProcess.isAttached) {
     keygenProcess.terminate();
     var exitCode = keygenProcess.exitCode();
     DEBUG_LOG("enigmailKeygenConsole.htm: exitCode = "+exitCode+"\n");
     if (enigmailSvc) {
        exitCode = enigmailSvc.fixExitCode(exitCode, 0);
     }
   }

   enigRefreshConsole();

   ipcRequest.close(true);

   if (gUseForSigning.checked) {
      var curId = gUsedId;
      curId.setBoolAttribute("enablePgp", true);
      curId.setIntAttribute("pgpKeyMode", 1);
      if (gGeneratedKey) {
        curId.setCharAttribute("pgpkeyId", "0x"+gGeneratedKey.substr(-8,8));
      }
      else {
        curId.setCharAttribute("pgpkeyId", curId.email);
      }

      enigmailKeygenUpdate(false, true);

      EnigSavePrefs();

      if (EnigConfirm(EnigGetString("keygenComplete", curId.email)+"\n\n"+EnigGetString("revokeCertRecommended"))) {
        EnigCreateRevokeCert(gGeneratedKey, curId.email);
      }
      

   } else {
      EnigAlert(EnigGetString("genCompleteNoSign"));
   }

   enigmailKeygenCloseRequest();

   enigmailSvc.invalidateUserIdList();
   window.close();
}


// Cleanup and close window
function enigmailKeygenCloseRequest() {
   DEBUG_LOG("enigmailKeygen.js: CloseRequest\n");

  // Cancel console refresh
  if (window.consoleIntervalId) {
    window.clearInterval(window.consoleIntervalId);
    window.consoleIntervalId = null;
  }

  if (gKeygenRequest) {
    try {
      var keygenProcess = gKeygenRequest.pipeTransport;
      if (keygenProcess)
        keygenProcess.terminate();
    } catch(ex) {}

    gKeygenRequest.close(true);
    gKeygenRequest = null;
  }
}

function enigmailCheckPassphrase() {
  var passphraseElement = document.getElementById("passphrase");
  var passphrase2Element = document.getElementById("passphraseRepeat");

  var passphrase = passphraseElement.value;

  if (passphrase != passphrase2Element.value) {
    EnigAlert(EnigGetString("passNoMatch"));
    return null;
  }

  if (passphrase.search(/[\x80-\xFF]/)>=0) {
    EnigAlert(EnigGetString("passCharProblem"));
    return null;
  }
  return passphrase;
}



function enigmailKeygenStart() {
   DEBUG_LOG("enigmailKeygen.js: Start\n");

   if (gKeygenRequest && gKeygenRequest.isPending()) {
     EnigAlert(EnigGetString("genGoing"));
     return;
   }

   var enigmailSvc = GetEnigmailSvc();
   if (!enigmailSvc) {
      EnigAlert(EnigGetString("accessError"));
      return;
   }

   var passphrase = enigmailCheckPassphrase();
   if (passphrase == null) return;
   
   var noPassphraseElement = document.getElementById("noPassphrase");

   if (!passphrase && !noPassphraseElement.checked) {
      EnigAlert(EnigGetString("passCheckBox"));
      return;
   }

   var commentElement = document.getElementById("keyComment");
   var comment = commentElement.value;

   if (!passphrase) {
      if (comment)
        comment += "; ";
      comment += "no password";
   }

   var noExpiry = document.getElementById("noExpiry");
   var expireInput = document.getElementById("expireInput");
   var timeScale = document.getElementById("timeScale");

   var expiryTime = 0;
   if (! noExpiry.checked) {
      expiryTime = Number(expireInput.value) * Number(timeScale.value);
      if (expiryTime > 36500) {
        EnigAlert(EnigGetString("expiryTooLong"));
        return;
      }
      if (! (expiryTime > 0)) {
        EnigAlert(EnigGetString("expiryTooShort"));
        return;
      }
   }
   var keySize = Number(document.getElementById("keySize").value);
   var keyType = Number(document.getElementById("keyType").value);
   
   var curId = getCurrentIdentity();
   gUsedId = curId;

   var userName = curId.fullName;
   var userEmail = curId.email;
   
   if (!userName) {
      EnigAlert(EnigGetString("passUserName"));
      return;
   }

   var idString = userName;

   if (comment)
      idString += " (" + comment + ")";

   idString += " <" + userEmail + ">";

   var confirmMsg = EnigGetString("keyConfirm",idString);

   if (!EnigConfirm(confirmMsg)) {
     return;
   }

   var ipcRequest = null;
   var requestObserver = new EnigRequestObserver(enigmailKeygenTerminate,null);

   try {
      ipcRequest = enigmailSvc.generateKey(window,
                                           EnigConvertFromUnicode(userName),
                                           EnigConvertFromUnicode(comment),
                                           userEmail,
                                           expiryTime,
                                           keySize,
                                           keyType,
                                           passphrase,
                                           requestObserver);
   } catch (ex) {
   }

   if (!ipcRequest) {
      EnigAlert(EnigGetString("keyGenFailed"));
   }

   gKeygenRequest = ipcRequest;

   WRITE_LOG("enigmailKeygen.js: Start: gKeygenRequest = "+gKeygenRequest+"\n");
   // Refresh console every 2 seconds
   window.consoleIntervalId = window.setInterval(enigRefreshConsole, 2000);
   enigRefreshConsole();
}

function enigRefreshConsole() {
  //DEBUG_LOG("enigmailKeygen.js: enigRefreshConsole:\n");

  if (!gKeygenRequest)
    return;

  var keygenConsole = gKeygenRequest.stdoutConsole;

  try {
    keygenConsole = keygenConsole.QueryInterface(Components.interfaces.nsIPipeConsole);

    if (keygenConsole && keygenConsole.hasNewData()) {
      DEBUG_LOG("enigmailKeygen.js: enigRefreshConsole(): hasNewData\n");

      gAllData += keygenConsole.getNewData();
      var keyCreatedIndex = gAllData.indexOf("[GNUPG:] KEY_CREATED");
      if (keyCreatedIndex >0) {
        gGeneratedKey = gAllData.substr(keyCreatedIndex);
        gGeneratedKey = gGeneratedKey.replace(/(.*\[GNUPG:\] KEY_CREATED . )([a-fA-F0-9]+)([\n\r].*)*/, "$2");
        gAllData = gAllData.replace(/\[GNUPG:\] KEY_CREATED . [a-fA-F0-9]+[\n\r]/, "");
      }
      gAllData = gAllData.replace(/[\r\n]*\[GNUPG:\] GOOD_PASSPHRASE/g, "").replace(/([\r\n]*\[GNUPG:\] PROGRESS primegen )(.)( \d+ \d+)/g, "$2")
      var progMeter = document.getElementById("keygenProgress");
      var progValue = Number(progMeter.value);
      progValue += (1+(100-progValue)/20);
      if (progValue >= 95) progValue=10;
      progMeter.setAttribute("value", progValue);
    }
  } catch (ex) {}
}

function enigmailKeygenCancel() {
   DEBUG_LOG("enigmailKeygen.js: Cancel\n");

   if (gKeygenRequest) {
      var closeWin = EnigConfirm(EnigGetString("keyAbort"));
   }
   else {
      closeWin=true;
   }
   if (closeWin) {
     enigmailKeygenCloseRequest();
     window.close();
   }
}

function onNoExpiry() {
  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");
  
  expireInput.disabled=noExpiry.checked;
  timeScale.disabled=noExpiry.checked;
}


function queryISupportsArray(supportsArray, iid) {
    var result = new Array;
    for (var i=0; i<supportsArray.Count(); i++) {
      result[i] = supportsArray.GetElementAt(i).QueryInterface(iid);
    }
    return result;
}

function getCurrentIdentity()
{
  var item = gIdentityList.selectedItem;
  var identityKey = item.getAttribute('id');

  var identity = gAccountManager.getIdentity(identityKey);

  return identity;
}

function fillIdentityListPopup()
{
  DEBUG_LOG("enigmailKeygen.js: fillIdentityListPopup\n");

  var idSupports = gAccountManager.allIdentities;
  var identities = queryISupportsArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);

  DEBUG_LOG("enigmailKeygen.js: fillIdentityListPopup: "+identities + "\n");

  // Default identity
  var defIdentity;
  var defIdentities = gAccountManager.defaultAccount.identities;
  if (defIdentities.Count() >= 1) {
    defIdentity = defIdentities.QueryElementAt(0, Components.interfaces.nsIMsgIdentity);
  } else {
    defIdentity = identities[0];
  }

  DEBUG_LOG("enigmailKeygen.js: fillIdentityListPopup: default="+defIdentity.key+"\n");

  var selected = false;
  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];

    DEBUG_LOG("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;

    var serverSupports = gAccountManager.GetServersForIdentity(identity);

    if (serverSupports.GetElementAt(0)) {
      var inServer = serverSupports.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer);

      var accountName = " - "+inServer.prettyName;

      DEBUG_LOG("enigmailKeygen.js: accountName="+accountName+"\n");
      DEBUG_LOG("enigmailKeygen.js: email="+identity.email+"\n");

      var item = document.createElement('menuitem');
//      item.setAttribute('label', identity.identityName);
      item.setAttribute('label', identity.identityName + accountName);
      item.setAttribute('class', 'identity-popup-item');
      item.setAttribute('accountname', accountName);
      item.setAttribute('id', identity.key);
      item.setAttribute('email', identity.email);

      gIdentityListPopup.appendChild(item);

      if (!selected)
        gIdentityList.selectedItem = item;

      if (identity.key == defIdentity.key) {
        gIdentityList.selectedItem = item;
        selected = true;
      }
    }
  }

}
