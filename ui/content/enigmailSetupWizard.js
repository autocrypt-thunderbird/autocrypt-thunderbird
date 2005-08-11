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

  The Initial Developer of this code is Patrick Brunschwig.
  Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org>
  are Copyright (C) 2005 Patrick Brunschwig.
  All Rights Reserved.

  Contributor(s):

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

var gEnigModifySettings;

EnigInitCommon("enigmailSetupWizard");

function onLoad() {
  gEnigModifySettings = {
    imapOnDemand: true,
    flowedText: true,
    viewPlainText: true,
    quotedPrintable: true
  };
}


function wizardGenKey() {
  var wizard = document.getElementById("enigmailSetupWizard");

  var passphrase = enigmailCheckPassphrase();
  if (!passphrase) return false;

  var enigmailSvc = enigGetSvc();

  var curId = wizardGetSelectedIdentity();

  var userName = curId.fullName;
  var userEmail = curId.email;

  document.getElementById("keygenConsoleBox").removeAttribute("collapsed");

  var ipcRequest = null;
  var requestObserver = new EnigRequestObserver(wizardKeygenTerminate,null);

  try {
    ipcRequest = enigmailSvc.generateKey(window,
                                         EnigConvertFromUnicode(userName),
                                         "",
                                         userEmail,
                                         365*5 /* 5 years */,
                                         2048,
                                         passphrase,
                                         requestObserver);
  } catch (ex) {}

  if (!ipcRequest) {
    EnigAlert(EnigGetString("keyGenFailed"));
    return false;
  }
  wizard.getButton("next").disabled = true;
  wizard.getButton("back").disabled = true;

  gKeygenRequest = ipcRequest;

  WRITE_LOG("enigmailKeygen.js: Start: gKeygenRequest = "+gKeygenRequest+"\n");
  // Refresh console every 2 seconds
  window.consoleIntervalId = window.setInterval(wizardRefreshConsole, 2000);
  wizardRefreshConsole();
  return false;
}

function wizardSelKey() {
  // use existing key
  var uidSel = document.getElementById("uidSelection");
  var currIndex = uidSel.view.selection.currentIndex;
  var currItem = uidSel.view.getItemAtIndex(currIndex);

  applyWizardSettings(currItem.getAttribute("keyId"));
}


function onCancel() {
  if (gKeygenRequest) {
    if (EnigConfirm(EnigGetString("keyAbort"))) {
      enigmailKeygenCloseRequest();
      return true;
    }
    else {
      return false;
    }
  }
  else {
    return true;
  }
}


function setLastPage() {
  var wizard = document.getElementById("enigmailSetupWizard");
  if (wizard.currentPage) {
    wizard.setAttribute("lastViewedPage", wizard.currentPage.pageid);
  }
}

function onBack() {
  DEBUG_LOG("onBack");
  setLastPage();
}

function onNext() {
  DEBUG_LOG("onNext");
  setLastPage();
  var wizard = document.getElementById("enigmailSetupWizard");
  if (wizard.currentPage) {
    switch(wizard.currentPage.pageid) {
    case "pgKeySel":
      wizardSelKey();
      break;
    case "pgKeyCreate":
      wizardGenKey();
      return false;
    }
  }

  return true;
}

function setNextPage(pageId) {
  var wizard = document.getElementById("enigmailSetupWizard");
  wizard.currentPage.next = pageId;
}

function clearKeyListEntries(){
  // remove all rows 
  var treeChildren = document.getElementById("uidSelectionChildren");
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
}


function onKeySelected(x) {
  var wizard = document.getElementById("enigmailSetupWizard");
  var uidSel = document.getElementById("uidSelection");
  wizard.getButton("next").disabled = (uidSel.view.selection.count == 0);
}


function loadKeys() {
  var wizard = document.getElementById("enigmailSetupWizard");
  wizard.getButton("next").disabled = true;
  
  var enigmailSvc = enigGetSvc();
  
  if (!enigmailSvc) {
    return false;
  }
  clearKeyListEntries();
  
  var exitCodeObj = {};
  var statusFlagsObj = {};
  var errorMsgObj = {};
  var keyList = enigmailSvc.getUserIdList(true, true, exitCodeObj, statusFlagsObj, errorMsgObj);
  if (exitCodeObj.value != 0) {
    EnigAlert(errorMsgObj.value);
    return false;
  }
  
  var uidList = [];
  var uidObj = {};
  var keyArr = keyList.split(/[\r\n]/);
  for (var i=0; i<keyArr.length; i++) {
    var l = keyArr[i].split(/:/);
    switch(l[0]) {
    case "sec":
      uidObj = {
        keyId: l[4],
        uid: "",
        created: EnigGetDateTime(l[5], true, false)
      };
      uidList.push(uidObj);
      break;
    case "uid":
      if (uidObj.uid == "") {
        uidObj.uid = EnigConvertGpgToUnicode(l[9]);
      }
      break;
    }
  }
  
  var uidChildren = document.getElementById("uidSelectionChildren")
  for (i=0; i<uidList.length; i++) {
    var item = uidChildren.appendChild( document.createElement('treeitem') );
    item.setAttribute("keyId", uidList[i].keyId);
    var row = item.appendChild(document.createElement('treerow'));
    row.appendChild( document.createElement('treecell') ).setAttribute('label', uidList[i].uid);
    row.appendChild( document.createElement('treecell') ).setAttribute('label', "0x"+uidList[i].keyId.substr(-8,8));
    row.appendChild( document.createElement('treecell') ).setAttribute('label', uidList[i].created);
  }
  return true;
}

function enigGetSvc() {
  // Lazy initialization of enigmail JS component (for efficiency)
  // variant of GetEnigmailSvc function

  if (gEnigmailSvc) {
    return gEnigmailSvc.initialized ? gEnigmailSvc : null;
  }

  try {
    gEnigmailSvc = ENIG_C.classes[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_C.interfaces.nsIEnigmail);

  } catch (ex) {
    ERROR_LOG("enigmailCommon.js: Error in instantiating EnigmailService\n");
    return null;
  }

  DEBUG_LOG("enigmailCommon.js: gEnigmailSvc = "+gEnigmailSvc+"\n");

  if (!gEnigmailSvc.initialized) {
    // Initialize enigmail

    var firstInitialization = !gEnigmailSvc.initializationAttempted;

    try {
      // Initialize enigmail
      gEnigmailSvc.initialize(window, gEnigmailVersion, gPrefEnigmail);

      try {
        // Reset alert count to default value
        gPrefEnigmail.clearUserPref("initAlert");
      } catch(ex) {
      }

    } catch (ex) {

      if (firstInitialization) {
        // Display initialization error alert
        EnigAlert("Could not find GnuPG, please specify path");
        if (EnigGetPref("initAlert")) {
          gEnigmailSvc.initializationAttempted = false;
          gEnigmailSvc = null;
        }
      }

      return null;
    }

    var configuredVersion = EnigGetPref("configuredVersion");

    DEBUG_LOG("enigmailCommon.js: GetEnigmailSvc: "+configuredVersion+"\n");

    if (firstInitialization && gEnigmailSvc.initialized &&
        gEnigmailSvc.agentType && gEnigmailSvc.agentType == "pgp") {
      EnigAlert(EnigGetString("pgpNotSupported"));
    }
  }

  if (gEnigmailSvc.logFileStream) {
    gEnigDebugLog = true;
    gEnigLogLevel = 5;
  }

  return gEnigmailSvc.initialized ? gEnigmailSvc : null;
}

function queryISupportsArray(supportsArray, iid) {
    var result = new Array;
    for (var i=0; i<supportsArray.Count(); i++) {
      result[i] = supportsArray.GetElementAt(i).QueryInterface(iid);
    }
    return result;
}

function fillIdentities(fillType)
{
  DEBUG_LOG("enigmailSetupWizard.js: fillIdentities\n");

  if (fillType == "checkbox"){
    var parentElement = document.getElementById("idSelection");
  }
  else {
    parentElement = document.getElementById("userIdentityPopup");
  }
  
  var child=parentElement.firstChild;
  while (child) {
    parentElement.removeChild(child);
    child=parentElement.firstChild;
  }
  var accountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);
  var idSupports = accountManager.allIdentities;
  var identities = queryISupportsArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);

  DEBUG_LOG("enigmailSetupWizard.js: fillIdentities: "+identities + "\n");

  // Default identity
  var defIdentity;
  var defIdentities = accountManager.defaultAccount.identities;
  if (defIdentities.Count() >= 1) {
    defIdentity = defIdentities.QueryElementAt(0, Components.interfaces.nsIMsgIdentity);
  } else {
    defIdentity = identities[0];
  }

  var disableId = document.getElementById("activateId").value == "1";
  var selected = false;
  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];

    DEBUG_LOG("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;

    var serverSupports = accountManager.GetServersForIdentity(identity);

    if (serverSupports.GetElementAt(0)) {
      var inServer = serverSupports.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer);

      var accountName = " - "+inServer.prettyName;

      DEBUG_LOG("enigmailKeygen.js: accountName="+accountName+"\n");
      DEBUG_LOG("enigmailKeygen.js: email="+identity.email+"\n");

      if (fillType == "checkbox") {
        var item = document.createElement('checkbox');
        item.setAttribute('checked', "true");
        item.setAttribute('disabled', disableId);
      }
      else {
        item = document.createElement('menuitem');
        item.setAttribute('label', identity.identityName + accountName);
        item.setAttribute('class', 'identity-popup-item');
      }
      item.setAttribute('label', identity.identityName + accountName);
      item.setAttribute('accountname', accountName);
      item.setAttribute('id', "acc-"+identity.key);
      item.setAttribute('account-id', identity.key);
      item.setAttribute('email', identity.email);

      parentElement.appendChild(item);

      if (fillType != "checkbox") {
        var idList = document.getElementById("userIdentity")
        if (!selected)
          idList.selectedItem = item;

        if (identity.key == defIdentity.key) {
          idList.selectedItem = item;
          selected = true;
        }
      }
    }
  }
}

function wizardGetSelectedIdentity()
{
  var item = document.getElementById("userIdentity").selectedItem;
  var identityKey = item.getAttribute('account-id');

  return gAccountManager.getIdentity(identityKey);
}

function applyWizardSettings(keyId) {
  DEBUG_LOG("enigmailSetupWizard.js: applyWizardSettings: keyId="+keyId+"\n");

  if (document.getElementById("activateId").value == "1") {
    var idSupports = gAccountManager.allIdentities;
    var identities = queryISupportsArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);
    for (var i=0; i<identities.length; i++) {
      wizardApplyId(identities[i], keyId);
    }
  }
  else {
    var node = document.getElementById("idSelection").firstChild;
    while (node) {
      if (node.checked) {
        var identity = gAccountManager.getIdentity(node.getAttribute("account-id"));
        wizardApplyId(identity, keyId);
      }
      node = node.nextSibling;
    }
  }
  
  applyMozSetting("imapOnDemand", "mail.server.default.mime_parts_on_demand", false);
  applyMozSetting("flowedText" ,"mailnews.send_plaintext_flowed", false)
  applyMozSetting("quotedPrintable", "mail.strictly_mime", false);
  applyMozSetting("viewPlainText", "mailnews.display.html_as", 1);
  applyMozSetting("viewPlainText", "mailnews.display.prefer_plaintext", true);

  EnigSavePrefs();
}

function applyMozSetting(param, preference, newVal) {
  if (gEnigModifySettings[param]) {
    if (typeof(newVal)=="boolean") {
      gEnigPrefRoot.setBoolPref(preference, newVal);
    }
    else if (typeof(newVal)=="number") {
      gEnigPrefRoot.setIntPref(preference, newVal);
    }
    else if (typeof(newVal)=="string") {
      gEnigPrefRoot.setCharPref(preference, newVal);
    }
  }
}

function wizardApplyId(identity, keyId) {
  DEBUG_LOG("enigmailSetupWizard.js: wizardApplyId: identity.Key="+identity.key+"\n");
  
  identity.setBoolAttribute("enablePgp", true);
  identity.setIntAttribute("pgpKeyMode", 1);
  identity.setCharAttribute("pgpkeyId", "0x"+keyId.substr(-8,8));

  var signMsg = (document.getElementById("signMsg").value== "1");
  var encryptMsg = (document.getElementById("encryptMsg").value== "1");

  identity.setBoolAttribute("pgpSignEncrypted", signMsg);
  identity.setBoolAttribute("pgpSignPlain", signMsg);
  identity.setIntAttribute("defaultEncryptionPolicy", (encryptMsg ? 1 : 0));
}


function wizardKeygenTerminate(terminateArg, ipcRequest) {
  DEBUG_LOG("enigmailSetupWizard.js: Terminate: "+ipcRequest+"\n");

  // Give focus to this window
  window.focus();

  var keygenProcess = ipcRequest.pipeTransport;
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
  }
  if (keygenProcess && !keygenProcess.isAttached) {
    keygenProcess.terminate();
    var exitCode = keygenProcess.exitCode();
    DEBUG_LOG("enigmailSetupWizard.js: exitCode = "+exitCode+"\n");
    if (enigmailSvc) {
      exitCode = enigmailSvc.fixExitCode(exitCode, 0);
    }
  }

  wizardRefreshConsole();
  var progMeter = document.getElementById("keygenProgress");
  progMeter.setAttribute("value", 100);

  ipcRequest.close(true);
  var curId = wizardGetSelectedIdentity();

  if (EnigConfirm(EnigGetString("keygenComplete", curId.email)+"\n\n"+EnigGetString("revokeCertRecommended"))) {
    EnigCreateRevokeCert(gGeneratedKey, curId.email);
  }

  enigmailKeygenCloseRequest();
  enigmailSvc.invalidateUserIdList();
  applyWizardSettings(gGeneratedKey);

  var wizard = document.getElementById("enigmailSetupWizard");
  wizard.goTo("pgComplete");
}


function wizardRefreshConsole() {
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


function disableIdSel(doDisable) {
  var idSelectionBox = document.getElementById("idSelection");
  var node = idSelectionBox.firstChild;
  while (node) {
    node.setAttribute('disabled',doDisable);
    node = node.nextSibling;
  }
}

function showPrefDetails() {

  window.openDialog("chrome://enigmail/content/enigmailWizardPrefs.xul",
            "", "chrome,modal,centerscreen", gEnigModifySettings);
  return true;
}

function loadLastPage() {
  var wizard = document.getElementById("enigmailSetupWizard");
  wizard.canRewind=false;
  wizard.getButton("cancel").disabled = true;
}
