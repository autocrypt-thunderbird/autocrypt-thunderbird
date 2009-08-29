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
var gLastDirection=0;
var gEnigAccountMgr;

EnigInitCommon("enigmailSetupWizard");

function onLoad() {
  gEnigModifySettings = {
    imapOnDemand: true,
    flowedText: true,
    viewPlainText: true,
    quotedPrintable: true,
    composeHTML: true
  };
  gEnigAccountMgr = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);

  fillIdentities('checkbox');
}


function onCancel() {
  if (gKeygenRequest) {
    if (EnigConfirm(EnigGetString("keyAbort"), EnigGetString("keyMan.button.generateKeyAbort"), EnigGetString("keyMan.button.generateKeyContinue"))) {
      enigmailKeygenCloseRequest();
      return true;
    }
    else {
      return false;
    }
  }
  else {
    return (EnigLongAlert(EnigGetString("setupWizard.reallyCancel"), null, EnigGetString("dlg.button.close"), EnigGetString("dlg.button.continue")) == 0);
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
  gLastDirection=-1;
  setLastPage();
}

function onNext() {
  DEBUG_LOG("onNext");
  gLastDirection=1;
  setLastPage();
  var wizard = document.getElementById("enigmailSetupWizard");
  if (wizard.currentPage) {
    switch(wizard.currentPage.pageid) {
    case "pgKeySel":
      wizardSelKey();
      break;
    case "pgWelcome":
      checkIdentities();
      break;
    case "pgSettings":
      return loadKeys();
    case "pgKeyCreate":
      return checkPassphrase();
    }
  }

  return true;
}

function setNextPage(pageId) {
  var wizard = document.getElementById("enigmailSetupWizard");
  wizard.currentPage.next = pageId;
}

function disableNext(disable) {
  var wizard = document.getElementById("enigmailSetupWizard");
  wizard.getButton("next").disabled = disable;
}


function countSelectedId() {
  var idCount=0;
  var node = document.getElementById("idSelection").firstChild;
  while (node) {
    if (node.checked) {
      ++idCount;
    }
    node = node.nextSibling;
  }
  return idCount;
}


function displayKeyCreate() {
  if (gLastDirection == 1) {
    fillIdentities('menulist');
  }

  if (countSelectedId() == 1) {
    var node = document.getElementById("idSelection").firstChild;
    while (node) {
      if (node.checked) {
        var identity = gEnigAccountMgr.getIdentity(node.getAttribute("account-id"));
        var idName = identity.identityName;

        var serverSupports = gEnigAccountMgr.GetServersForIdentity(identity);
        if (serverSupports.GetElementAt(0)) {
          var inServer = serverSupports.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer);

          idName += " - "+inServer.prettyName;
        }
        document.getElementById("userIdentityLabel").value = idName;
        break;
      }
      node = node.nextSibling;
    }
    document.getElementById("userIdentity").setAttribute("collapsed", "true");
    document.getElementById("userIdentityLabel").removeAttribute("collapsed");

  }
  else {
    document.getElementById("userIdentityLabel").setAttribute("collapsed", "true");
    document.getElementById("userIdentity").removeAttribute("collapsed");
  }
}

function displayKeySel() {
  if (document.getElementById("createPgpKey").value=="0") {
    setUseKey();
  }
  else {
    setNewKey();
  }
}


function clearKeyListEntries(){
  // remove all rows
  var treeChildren = document.getElementById("uidSelectionChildren");
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
}

function onSetStartNow(doStart) {
  if (doStart) {
    setNextPage("pgSelectId");
  }
  else {
    setNextPage("pgNoStart")
  }
}

function onKeySelected() {
  var wizard = document.getElementById("enigmailSetupWizard");
  var uidSel = document.getElementById("uidSelection");
  disableNext(uidSel.view.selection.count == 0);
}

function wizardSetFocus() {
  document.getElementById("startNow").focus();
}

function loadKeys() {
  var wizard = document.getElementById("enigmailSetupWizard");

  var enigmailSvc = enigGetSvc();

  if (!enigmailSvc) {
    return false;
  }
  clearKeyListEntries();

  var exitCodeObj = {};
  var statusFlagsObj = {};
  var errorMsgObj = {};
  var keyList = EnigGetSecretKeys();
  if (keyList == null) {
    return false;
  }

  if (keyList.length ==0) {
    setNextPage("pgKeyCreate");
    return true;
  }


  var uidChildren = document.getElementById("uidSelectionChildren")
  for (i=0; i < keyList.length; i++) {
    var item = uidChildren.appendChild( document.createElement('treeitem') );
    item.setAttribute("keyId", keyList[i].id);
    var row = item.appendChild(document.createElement('treerow'));
    var cell = row.appendChild( document.createElement('treecell') )
    cell.setAttribute('label', keyList[i].name);
    cell.setAttribute('observes', "bcKeyEnabled");
    cell = row.appendChild( document.createElement('treecell') );
    cell.setAttribute('label', "0x"+keyList[i].id.substr(-8,8));
    cell.setAttribute('observes', "bcKeyEnabled");
    cell = row.appendChild( document.createElement('treecell') );
    cell.setAttribute('label', keyList[i].created);
    cell.setAttribute('observes', "bcKeyEnabled");
  }
  onKeySelected();
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
    ERROR_LOG("enigmailWizard.js: Error in instantiating EnigmailService\n");
    return null;
  }

  DEBUG_LOG("enigmailWizard.js: gEnigmailSvc = "+gEnigmailSvc+"\n");

  while (!gEnigmailSvc.initialized) {
    // Try to initialize enigmail

    try {
      // Initialize enigmail
      gEnigmailSvc.initialize(window, gEnigmailVersion, gPrefEnigmail);

      try {
        // Reset alert count to default value
        gPrefEnigmail.clearUserPref("initAlert");
      } catch(ex) {}

    } catch (ex) {

      // Display initialization error alert
      EnigAlert(EnigGetString("setupWizard.locateGpg"));
      var gpgPath = wizardLocateGpg();
      if (! gpgPath) {
        if (onCancel()) {
          window.close();
          return null;
        }
      }
      else {
        EnigSetPref("agentPath", EnigGetFilePath(gpgPath));
      }
    }

    var configuredVersion = EnigGetPref("configuredVersion");

    DEBUG_LOG("enigmailWizard.js: enigGetSvc: "+configuredVersion+"\n");

  }

  if (gEnigmailSvc.logFileStream) {
    gEnigDebugLog = true;
    gEnigLogLevel = 5;
  }

  return gEnigmailSvc.initialized ? gEnigmailSvc : null;
}

function wizardLocateGpg() {
  var fileName="gpg";
  var ext="";
  if (navigator.platform.search(/Win/i) == 0) {
    ext=".exe";
  }
  var filePath = EnigFilePicker(EnigGetString("locateGpg"),
                           "", false, ext,
                           fileName+ext, null);
  return filePath;
}

function checkPassphrase() {

  var passphrase = enigmailCheckPassphrase();
  if (passphrase == null) return false;

  if (passphrase.length < 8) {
    EnigAlert(EnigGetString("passphrase.min8keys"));
    return false;
  }
  return true;

}

function wizardGenKey() {
  var wizard = document.getElementById("enigmailSetupWizard");
  var passphrase = document.getElementById("passphrase").value;
  var enigmailSvc = enigGetSvc();

  var curId = wizardGetSelectedIdentity();

  var userName = curId.fullName;
  var userEmail = curId.email;

  var ipcRequest = null;
  var requestObserver = new EnigRequestObserver(wizardKeygenTerminate,null);
  wizard.getButton("next").disabled = true

  try {
    ipcRequest = enigmailSvc.generateKey(window,
                                         EnigConvertFromUnicode(userName),
                                         "",
                                         userEmail,
                                         365*5 /* 5 years */,
                                         2048,
                                         ENIG_KEYTYPE_RSA,
                                         passphrase,
                                         requestObserver);
  } catch (ex) {}

  if (!ipcRequest) {
    EnigAlert(EnigGetString("keyGenFailed"));
    return false;
  }
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
  var createKey=document.getElementById("createPgpKey");
  if (createKey.value == "0") {
    var uidSel = document.getElementById("uidSelection");
    var currIndex = uidSel.view.selection.currentIndex;
    var currItem = uidSel.view.getItemAtIndex(currIndex);
    gGeneratedKey = currItem.getAttribute("keyId");
  }
}


function queryISupportsArray(supportsArray, iid) {
    var result = new Array;
    for (var i=0; i<supportsArray.Count(); i++) {
      result[i] = supportsArray.GetElementAt(i).QueryInterface(iid);
    }
    return result;
}

function countIdentities() {
  var accountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);
  var idSupports = accountManager.allIdentities;
  var identities = queryISupportsArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);
  return identities.length;
}

function checkIdentities() {
  var wizard = document.getElementById("enigmailSetupWizard");

  if (wizard.currentPage.next != "pgNoStart") {
    if (countIdentities() <= 1) {
      setNextPage("pgSign");
    }
  }
}


function fillIdentities(fillType)
{
  DEBUG_LOG("enigmailSetupWizard.js: fillIdentities\n");

  if (fillType == "checkbox") {
    var parentElement = document.getElementById("idSelection");
  }
  else {
    parentElement = document.getElementById("userIdentityPopup");

    // Find out default identity
    var defIdentity;
    var defIdentities = gEnigAccountMgr.defaultAccount.identities;
    if (defIdentities.Count() >= 1) {
      defIdentity = defIdentities.QueryElementAt(0, Components.interfaces.nsIMsgIdentity);
    } else {
      defIdentity = identities[0];
    }

    if (document.getElementById("activateId").value == "0") {
      // try to match with selected id
      var node = document.getElementById("idSelection").firstChild;
      while (node) {
        if (node.checked) {
          var currId = gEnigAccountMgr.getIdentity(node.getAttribute("account-id"));
          if (currId.key == defIdentity.key) {
            break;
          }
        }
        node = node.nextSibling;
      }

      // default ID wasn't selected, take 1st selected ID
      if (! node) {
        node = document.getElementById("idSelection").firstChild;
        while (node) {
          if (node.checked) {
            defIdentity = gEnigAccountMgr.getIdentity(node.getAttribute("account-id"));
            break;
          }
          node = node.nextSibling;
        }
      }
    }
  }

  var child=parentElement.firstChild;
  while (child) {
    parentElement.removeChild(child);
    child=parentElement.firstChild;
  }
  var idSupports = gEnigAccountMgr.allIdentities;
  var identities = queryISupportsArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);

  DEBUG_LOG("enigmailSetupWizard.js: fillIdentities: "+identities + "\n");

  var disableId = document.getElementById("activateId").value == "1";
  var selected = false;
  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];

    DEBUG_LOG("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;

    var serverSupports = gEnigAccountMgr.GetServersForIdentity(identity);

    if (serverSupports.GetElementAt(0)) {
      var inServer = serverSupports.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer);

      var accountName = " - "+inServer.prettyName;

      DEBUG_LOG("enigmailKeygen.js: accountName="+accountName+"\n");
      DEBUG_LOG("enigmailKeygen.js: email="+identity.email+"\n");

      if (fillType == "checkbox") {
        var item = document.createElement('checkbox');
        item.setAttribute('checked', "true");
        item.setAttribute('disabled', disableId);
        item.setAttribute('oncommand', "checkIdSelection()");
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
        // pre-select default ID
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

  return gEnigAccountMgr.getIdentity(identityKey);
}

function applyWizardSettings() {
  DEBUG_LOG("enigmailSetupWizard.js: applyWizardSettings\n");

  loadLastPage();

  if (document.getElementById("activateId").value == "1") {
    var idSupports = gEnigAccountMgr.allIdentities;
    var identities = queryISupportsArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);
    for (var i=0; i<identities.length; i++) {
      wizardApplyId(identities[i], gGeneratedKey);
    }
  }
  else {
    var node = document.getElementById("idSelection").firstChild;
    while (node) {
      if (node.checked) {
        var identity = gEnigAccountMgr.getIdentity(node.getAttribute("account-id"));
        wizardApplyId(identity, gGeneratedKey);
      }
      node = node.nextSibling;
    }
  }

  applyMozSetting("imapOnDemand", "mail.server.default.mime_parts_on_demand", false);
  applyMozSetting("flowedText" ,"mailnews.send_plaintext_flowed", false)
  applyMozSetting("quotedPrintable", "mail.strictly_mime", false);
  applyMozSetting("viewPlainText", "mailnews.display.html_as", 1);
  applyMozSetting("viewPlainText", "mailnews.display.prefer_plaintext", true);

  EnigSetPref("configuredVersion", gEnigmailVersion);
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
  var accountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);
  var idServers = accountManager.GetServersForIdentity(identity);
  var servers = queryISupportsArray(idServers ,Components.interfaces.nsIMsgIncomingServer);

  var newsServer = false;
  for (var i=0; i<servers.length; i++) {
    newsServer = (servers[i].localStoreType == "news")
  }

  identity.setBoolAttribute("enablePgp", true);
  identity.setIntAttribute("pgpKeyMode", 1);
  identity.setCharAttribute("pgpkeyId", "0x"+keyId.substr(-8,8));
  identity.setIntAttribute("openPgpHeaderMode", 0);

  var signMsg = (document.getElementById("signMsg").value== "1");
  var encryptMsg = ((!newsServer) && (document.getElementById("encryptMsg").value== "1"));

  identity.setBoolAttribute("pgpSignEncrypted", signMsg);
  identity.setBoolAttribute("pgpSignPlain", signMsg);
  identity.setIntAttribute("defaultEncryptionPolicy", (encryptMsg ? 1 : 0));
  if ((document.getElementById("changeSettings").value == "1") &&
      gEnigModifySettings["composeHTML"]) {
    identity.setBoolAttribute("compose_html", false);
  }
}


function wizardKeygenTerminate(terminateArg, ipcRequest) {
  DEBUG_LOG("enigmailSetupWizard.js: Terminate: "+ipcRequest+"\n");

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

  if (EnigConfirm(EnigGetString("keygenComplete", curId.email)+"\n\n"+EnigGetString("revokeCertRecommended"), EnigGetString("keyMan.button.generateCert"), EnigGetString("dlg.button.skip"))) {
    EnigCreateRevokeCert(gGeneratedKey, curId.email);
  }

  enigmailKeygenCloseRequest();
  enigmailSvc.invalidateUserIdList();

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

  if (doDisable) {
    disableNext(false);
  }
  else {
    checkIdSelection();
  }
}

function checkIdSelection() {
  var node = document.getElementById("idSelection").firstChild;

  disableNext(countSelectedId() < 1);
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


function setNewKey() {
  setNextPage('pgKeyCreate');
  disableNext(false);
  document.getElementById("uidSelection").boxObject.element.setAttribute("disabled", "true")
}

function setUseKey() {
  setNextPage('pgSummary');
  document.getElementById("uidSelection").boxObject.element.removeAttribute("disabled");
  onKeySelected();
}

function displayActions() {

  var currItem=0;
  function appendDesc(what) {
    ++currItem;
    var item = document.getElementById("applyDesc"+currItem);
    item.value="\u2013 "+what;
    item.removeAttribute("collapsed");
  }

  var createKey=document.getElementById("createPgpKey");

  if (createKey.value == "1" ||
      document.getElementById("pgSettings").next == "pgKeyCreate") {
    setNextPage('pgKeygen');
    appendDesc(EnigGetString("setupWizard.createKey"));
  }
  else {
    setNextPage('pgComplete');
    appendDesc(EnigGetString("setupWizard.useKey", gGeneratedKey))
  }

  var descList=document.getElementById("appliedSettings");

  if (countIdentities() >1) {
    if (document.getElementById("activateId").value == "1") {
      appendDesc(EnigGetString("setupWizard.applyAllId"));
    }
    else {
      var idList = "";
      var node = document.getElementById("idSelection").firstChild;
      while (node) {
        if (node.checked) {
          var identity = gEnigAccountMgr.getIdentity(node.getAttribute("account-id"));
          idList+="<"+identity.email+"> "
        }
        node = node.nextSibling;
      }
      appendDesc(EnigGetString("setupWizard.applySomeId", idList));
    }
  }
  else {
    appendDesc(EnigGetString("setupWizard.applySingleId", idList));
  }

  if (document.getElementById("signMsg").value== "1") {
    appendDesc(EnigGetString("setupWizard.signAll"));
  }
  else {
    appendDesc(EnigGetString("setupWizard.signNone"));
  }

  if (document.getElementById("encryptMsg").value== "1") {
    appendDesc(EnigGetString("setupWizard.encryptAll"));
  }
  else {
    appendDesc(EnigGetString("setupWizard.encryptNone"));
  }

  if (document.getElementById("changeSettings").value == "1") {
    if (gEnigModifySettings["imapOnDemand"] &&
        gEnigModifySettings["flowedText"] &&
        gEnigModifySettings["quotedPrintable"] &&
        gEnigModifySettings["viewPlainText"] &&
        gEnigModifySettings["composeHTML"]) {
      appendDesc(EnigGetString("setupWizard.setAllPrefs"));
    }
    else if (gEnigModifySettings["imapOnDemand"] ||
        gEnigModifySettings["flowedText"] ||
        gEnigModifySettings["quotedPrintable"] ||
        gEnigModifySettings["viewPlainText"] ||
        gEnigModifySettings["composeHTML"]) {
      appendDesc(EnigGetString("setupWizard.setSomePrefs"));
    }
    else {
      appendDesc(EnigGetString("setupWizard.setNoPrefs"));
    }
  }
  else {
    appendDesc(EnigGetString("setupWizard.setNoPrefs"));
  }
}
