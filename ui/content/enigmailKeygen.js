// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailKeygen");

const ENIG_ACCOUNT_MANAGER_CONTRACTID = "@mozilla.org/messenger/account-manager;1";

var gAccountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);

var gAutoCrypto;

var gIdentityList;
var gIdentityListPopup;
var gUseForSigning;

var gKeygenRequest;

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

   var keygenProcess = ipcRequest.pipeTransport;

   if (keygenProcess && !keygenProcess.isAttached) {
     keygenProcess.terminate();
     var exitCode = keygenProcess.exitCode();
     DEBUG_LOG("enigmailKeygenConsole.htm: exitCode = "+exitCode+"\n");
   }

   enigRefreshConsole();

   ipcRequest.close(true);

   if (gUseForSigning.checked) {
      var identityItem = gIdentityList.selectedItem;
      var email = identityItem.getAttribute("email");

      EnigSetPref("userIdValue", email);
      EnigSetPref("userIdFromAddr", false);

      enigmailKeygenUpdate(false, true);

      EnigSavePrefs();

      EnigAlert(EnigGetString("genCompletePrefix")+email+EnigGetString("genCompleteSuffix"));

   } else {
      EnigAlert(EnigGetString("genCompleteNoSign"));
   }

   enigmailKeygenCloseRequest();

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

   var passphraseElement = document.getElementById("passphrase");
   var passphrase2Element = document.getElementById("passphraseRepeat");

   var passphrase = passphraseElement.value;

   if (passphrase != passphrase2Element.value) {
      EnigAlert(EnigGetString("passNoMatch"));
      return;
   }

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

   var curId = getCurrentIdentity();

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

   var confirmMsg = EnigGetString("keyConfirmPrefix")+idString+EnigGetString("keyConfirmSuffix");

   if (!EnigConfirm(confirmMsg)) {
     window.close();
     return;
   }

   var requestObserver = new EnigRequestObserver(enigmailKeygenTerminate,null);

   try {
      ipcRequest = enigmailSvc.generateKey(window,
                                           userName,
                                           comment,
                                           userEmail,
                                           0,
                                           passphrase,
                                           requestObserver);
   } catch (ex) {
   }

   if (!ipcRequest) {
      EnigAlert("Key generation failed!");
   }

   gKeygenRequest = ipcRequest;

   WRITE_LOG("enigmailKeygen.js: Start: gKeygenRequest = "+gKeygenRequest+"\n");
   // Refresh console every 2 seconds
   window.consoleIntervalId = window.setInterval(enigRefreshConsole, 2000);
   enigRefreshConsole();
}

function enigRefreshConsole() {
  //DEBUG_LOG("enigmailKeygen.js: enigRefreshConsole():\n");

  if (!gKeygenRequest)
    return;

  var keygenConsole = gKeygenRequest.stdoutConsole;

  try {
    keygenConsole = keygenConsole.QueryInterface(Components.interfaces.nsIPipeConsole);

    if (keygenConsole && keygenConsole.hasNewData()) {
      DEBUG_LOG("enigmailKeygen.js: enigRefreshConsole(): hasNewData\n");

      var contentFrame = window.frames["keygenConsole"];
      if (contentFrame) {

        var consoleElement = contentFrame.document.getElementById('console');

        consoleElement.firstChild.data = keygenConsole.getData();

        if (!contentFrame.mouseDownState)
         contentFrame.scrollTo(0,9999);
      }
    }
  } catch (ex) {}

  return false;
}

function enigmailKeygenCancel() {
   DEBUG_LOG("enigmailKeygen.js: Cancel\n");

   var confirmMsg = EnigGetString("keyAbort");

   if (EnigConfirm(confirmMsg)) {
     enigmailKeygenCloseRequest();
     window.close();
   }
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

    dump("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;
  
    var serverSupports = gAccountManager.GetServersForIdentity(identity);
  
    if (serverSupports.GetElementAt(0)) {
      var inServer = serverSupports.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer);

      var accountName = " - "+inServer.prettyName;
  
      DEBUG_LOG("enigmailKeygen.js: accountName="+accountName+"\n");
      DEBUG_LOG("enigmailKeygen.js: email="+identity.email+"\n");

      var item = document.createElement('menuitem');
      item.setAttribute('label', identity.identityName);
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
