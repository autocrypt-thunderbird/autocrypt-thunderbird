// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailKeygen");

const NS_PIPECONSOLE_CONTRACTID = "@mozilla.org/process/pipe-console;1"
const ACCOUNT_MANAGER_CONTRACTID = "@mozilla.org/messenger/account-manager;1";

var gAccountManager = Components.classes[ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);

var gIdentityList;
var gIdentityListPopup;

function enigmailKeygenLoad() {
  DEBUG_LOG("enigmailKeygen.js: Load\n");

  gIdentityList = document.getElementById("userIdentity");
  gIdentityListPopup = document.getElementById("userIdentityPopup");

  if (gIdentityListPopup) {
    fillIdentityListPopup();
  }

}

function enigmailKeygenUnload() {
   DEBUG_LOG("enigmailKeygen.js: Unload\n");
}

function enigmailKeygenTerminate() {
   EnigAlert("Key generation completed!");
}

var gKeygenConsole;
var gKeygenProcess;

function enigmailKeygenStart() {
   DEBUG_LOG("enigmailKeygen.js: Start\n");

   if (gKeygenProcess && gKeygenProcess.isAttached) {
     EnigAlert("Key generation already in progress!");
     return;
   }

   var curId = getCurrentIdentity();

   var userName = curId.fullName;
   var userEmail = curId.email;

   if (!EnigConfirm("Generate public and private keys for user \""+userName+" <"+userEmail+">\"?")) {
     window.close();
     return;
   }

   gKeygenConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

   DEBUG_LOG("enigmailKeygen.js: gKeygenConsole = "+gKeygenConsole+"\n");

   gKeygenConsole.open(100, 80);

   var requestObserver = new RequestObserver(enigmailKeygenTerminate, null);
   gKeygenConsole.observe(requestObserver, null);

   var passphrase = null;

   passphrase = EnigPassphrase();

   var comment = "enigmail";
   if (!passphrase)
      comment = "no password";

   try {
      gKeygenProcess = gEnigmailSvc.generateKey(userName,
                                                comment,
                                                userEmail,
                                                0,
                                                passphrase,
                                                gKeygenConsole);
   } catch (ex) {
   }

   if (!gKeygenProcess) {
      EnigAlert("Key generation failed!");
   }

   dump("enigmailKeygen.js: Start: gKeygenProcess = "+gKeygenProcess+"\n");
}

function enigmailKeygenCancel() {
   DEBUG_LOG("enigmailKeygen.js: Cancel\n");

   if (gKeygenProcess)
      gKeygenProcess.terminate();

   window.close();
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

      var item = document.createElement('menuitem');
      item.setAttribute('label', identity.identityName);
      item.setAttribute('class', 'identity-popup-item');
      item.setAttribute('accountname', accountName);
      item.setAttribute('id', identity.key);
      gIdentityListPopup.appendChild(item);

      if (identity.key == defIdentity.key)
        gIdentityList.selectedItem = item;
    }
  }

}
