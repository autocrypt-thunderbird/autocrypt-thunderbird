// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailKeygen");

const ACCOUNT_MANAGER_CONTRACTID = "@mozilla.org/messenger/account-manager;1";

var gAccountManager = Components.classes[ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);

var gPassivePrivacy = EnigGetPref("passivePrivacy");

var gIdentityList;
var gIdentityListPopup;
var gUseForSigning;

function enigmailKeygenLoad() {
  DEBUG_LOG("enigmailKeygen.js: Load\n");

  gIdentityList      = document.getElementById("userIdentity");
  gIdentityListPopup = document.getElementById("userIdentityPopup");
  gUseForSigning     = document.getElementById("useForSigning");

  if (gIdentityListPopup) {
    fillIdentityListPopup();
  }

  enigmailKeygenUpdate(true, false);

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     EnigAlert("Error in accessing Enigmail service");
  }

  if (enigmailSvc.agentType != "gpg") {
     EnigAlert("Key generation only works with GPG (not with PGP)!");
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

  if (gPassivePrivacy) {
    var commentElement = document.getElementById("keyComment");
    commentElement.value = "Enigmail passive privacy";
    commentElement.disabled = true;
  }
}

var gKeygenRequest;

function enigmailKeygenTerminate(terminateArg, ipcRequest) {
   DEBUG_LOG("enigmailKeygen.js: Terminate: "+ipcRequest+"\n");

   ipcRequest.close(true);

   if (gUseForSigning.checked) {
      var identityItem = gIdentityList.selectedItem;
      var email = identityItem.getAttribute("email");

      EnigSetPref( "userIdValue", email);
      EnigSetPref( "userIdSource", USER_ID_SPECIFIED);

      enigmailKeygenUpdate(false, true);

      EnigSavePrefs();

      EnigAlert("Key generation completed!\nIdentity <"+email+"> will be used for signing");

   } else {
      EnigAlert("Key generation completed!");
   }

   enigmailKeygenCloseRequest();

   window.close();
}


// Cleanup and close window
function enigmailKeygenCloseRequest() {
   DEBUG_LOG("enigmailKeygen.js: CloseRequest\n");

   if (gKeygenRequest) {
     gKeygenRequest.close(true);
     gKeygenRequest = null;
   }
}

function enigmailKeygenStart() {
   DEBUG_LOG("enigmailKeygen.js: Start\n");

   if (gKeygenRequest && gKeygenRequest.isPending()) {
     EnigAlert("Key generation already in progress!");
     return;
   }

   var enigmailSvc = GetEnigmailSvc();
   if (!enigmailSvc) {
      EnigAlert("Error in accessing Enigmail service");
      return;
   }

   var passphraseElement = document.getElementById("passphrase");
   var passphrase2Element = document.getElementById("passphraseRepeat");

   var passphrase = passphraseElement.value;

   if (passphrase != passphrase2Element.value) {
      EnigAlert("Passphrase entries do not match; please re-enter");
      return;
   }

   var noPassphraseElement = document.getElementById("noPassphrase");

   if (!passphrase && !noPassphraseElement.checked) {
      EnigAlert("Please check box if specifying no passphrase for key\n");
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

   var idString = userName;

   if (comment)
      idString += " (" + comment + ")";

   idString += " <" + userEmail + ">";

   var confirmMsg = "Generate public and private keys for \""+idString+
                    "\"?\n(NOTE: Do not exit the browser while key generation is in progress)";

   if (!EnigConfirm(confirmMsg)) {
     window.close();
     return;
   }

   var requestObserver = new RequestObserver(enigmailKeygenTerminate, null);

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
}

function enigmailKeygenCancel() {
   DEBUG_LOG("enigmailKeygen.js: Cancel\n");

   var confirmMsg = "Cancel key generation?";

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

  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];
  
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

      if (identity.key == defIdentity.key)
        gIdentityList.selectedItem = item;
    }
  }

}
