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
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/keyManagement.jsm");
Components.utils.import("resource://enigmail/installGnuPG.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");
Components.utils.import("resource://enigmail/passwordCheck.jsm");

// const Ec is already defined in enigmailKeygen.js

var gLastDirection = 0;
var gWizardUserMode = "beginner";
var gEnigAccountMgr;
var gPubkeyFile = {value: null};
var gSeckeyFile = {value: null};
var gCreateNewKey=false;
var gPrefEnigmail;
var gDownoadObj = null;
var gPassPhraseQuality = null;

function onLoad() {
  gEnigAccountMgr = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);

  fillIdentities('checkbox');

  let winOptions = EnigGetWindowOptions();
  if ("skipIntro" in winOptions) {
    if (winOptions["skipIntro"] == "true") {
      var wizard = getWizard();
      wizard.currentPage = document.getElementById("pgWelcome");
    }
  }
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
    var r=(EnigLongAlert(EnigGetString("setupWizard.reallyCancel"), null, EnigGetString("dlg.button.close"), EnigGetString("dlg.button.continue")) == 0);

    if (r && gDownoadObj) {
      gDownoadObj.abort();
      gDownoadObj = null;
    }

    return r;
  }
}


function getWizard() {
  return document.getElementById("enigmailSetupWizard");
}

function setLastPage() {
  var wizard = getWizard();
  if (wizard.currentPage) {
    wizard.setAttribute("lastViewedPage", wizard.currentPage.pageid);
  }
}

function onBack() {
  DEBUG_LOG("onBack");
  gLastDirection=-1;
  setLastPage();
}

/***
 * State machine to decide which is the next page to show in the wizard.
 * This function is called when the "Next" button is pressed, before the
 * next page is opened, allowing to still modify the wiazrd's sequence.
 */

function onNext() {

  var enableNext = true;

  // private function to se the next page of the wizard
  function setNextPage(pageId) {
    if (pageId == "") {
      enableNext = false;
    }
    else {
      let wizard = getWizard();
      wizard.currentPage.next = pageId;
      enableNext = true;
    }
  }

  DEBUG_LOG("onNext");
  gLastDirection=1;
  setLastPage();
  var wizard = getWizard();
  if (wizard.currentPage) {
    switch(wizard.currentPage.pageid) {
    case "pgWelcome":
      setNextPage(onAfterPgWelcome());
      break;
    case "pgInstallGnuPG":
      setNextPage(onAfterPgInstallGnuPG());
      break;
    case "pgSelectId":
      setNextPage(onAfterPgSelectId());
      break;
    case "pgKeySel":
      setNextPage(onAfterPgKeySel());
      break;
    case "pgNoKeyFound":
      setNextPage(onAfterPgNoKeyFound());
      break;
    case "pgKeyImport":
      setNextPage(onAfterPgKeyImport());
      break;
    case "pgKeyCreate":
      setNextPage(onAfterPgKeyCreate());
      break;
    case "pgKeygen":
      setNextPage(onAfterPgKeygen());
      break;
    }
  }
  return enableNext;
}

/**** State machine helper functions ****
 *
 * All functions:
 * return the next page ID or "" in case the 'Next' button should be disabled
 */
function onAfterPgWelcome() {

  if (checkGnupgInstallation()) {
    let hasSecretKeys = checkSecretKeys();
    switch (gWizardUserMode) {
    case "beginner":
      if (hasSecretKeys) {
        return "pgKeySel";
      }
      else {
        return "pgKeyCreate";
      }
    case "advanced":
      if (countIdentities() > 1) {
        return "pgSelectId";
      }
      else {
        if (hasSecretKeys) {
          return "pgKeySel";
        }
        else {
          return "pgNoKeyFound";
        }
      }
    case "expert":
      return "pgExpert";
    }
  }
  else {
    return "pgInstallGnuPG";
  }
}

function onAfterPgInstallGnuPG() {
  let hasSecretKeys = checkSecretKeys();
  switch (gWizardUserMode) {
  case "beginner":
    if (hasSecretKeys) {
      return "pgKeySel";
    }
    else {
      return "pgKeyCreate";
    }
  case "advanced":
    if (countIdentities() > 1) {
      return "pgSelectId";
    }
    else {
      if (hasSecretKeys) {
        return "pgKeySel";
      }
      else {
        return "pgNoKeyFound";
      }
    }
  case "expert":
    return "pgExpert";
  }
}

function onAfterPgSelectId() {
  let hasSecretKeys = checkSecretKeys();
  if (hasSecretKeys) {
    return "pgKeySel";
  }
  else {
    return "pgNoKeyFound";
  }
}

function onAfterPgKeySel() {
  if (gCreateNewKey) {
    return "pgKeyCreate";
  }
  else {
    return "pgComplete";
  }
}

function onAfterPgNoKeyFound() {
  if (gCreateNewKey) {
    return "pgKeyCreate";
  }
  else {
    return "pgKeyImport";
  }
}

function onAfterPgKeyImport() {
  return "pgKeySel";
}

function onAfterPgKeyCreate() {
  if (checkPassphrase()) {
    return "pgKeygen";
  }

  return "";
}

function onAfterPgKeygen() {
  return "pgComplete";
}

/**
 * Check if GnuPG is available
 */
function checkGnupgInstallation() {
  var s = enigGetSvc(true);
  return (s ? true : false);
}

/**
 * Check if secret keys are available
 */
function checkSecretKeys() {
  var keyList = Ec.getSecretKeys(window, true);
  if (keyList && keyList.length > 0) {
    return true;
  }

  return false;
}

/**
 * Enable or disable the "Next" (or "Done") button
 *
 * disable: boolean: true = button is disabled / false = button is enabled
 */
function disableNext(disable) {
  var wizard = getWizard();
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

function onShowPgInstallGnuPG() {
  var ok = enigGetSvc(true);
  disableNext(!ok);

  if (InstallGnuPG.checkAvailability()) {
    document.getElementById("installBox").removeAttribute("collapsed");
  }
  else {
    document.getElementById("findGpgBox").removeAttribute("collapsed");
  }
}



function installGnuPG() {
  var progressBox = document.getElementById("progressBox");
  var downloadProgress = document.getElementById("downloadProgress");
  var installLabel = document.getElementById("installLabel");
  var installProgress = document.getElementById("installProgress");
  var btnInstallGnupg = document.getElementById("btnInstallGnupg");
  var btnLocateGnuPG = document.getElementById("btnLocateGnuPG");

  btnInstallGnupg.setAttribute("disabled", true);
  btnLocateGnuPG.setAttribute("disabled", true);
  progressBox.removeAttribute("collapsed");

  InstallGnuPG.startInstaller({
    onStart: function(reqObj) {
      gDownoadObj = reqObj;
    },

    onError: function (errorMessage) {
      if (typeof(errorMessage) == "object") {
        var s = EnigGetString("errorType."+errorMessage.type);
        if (errorMessage.type.startsWith("Security")) {
          s += "\n"+ EnigGetString("setupWizard.downloadForbidden");
        }
        else
          s += "\n"+ EnigGetString("setupWizard.downloadImpossible");

        EnigAlert(s);
      }
      else {
        EnigAlert(EnigGetString(errorMessage));
      }

      this.returnToDownload();
    },

    onWarning: function(message) {
      var ret = false;
      if (message == "hashSumMismatch") {
        ret = EnigConfirm(EnigGetString("setupWizard.hashSumError"), EnigGetString("dlgYes"),
                  EnigGetString("dlgNo"));
      }

      if (! ret) this.returnToDownload();

      return ret;
    },

    onProgress: function(event) {
      if (event.lengthComputable) {
        var percentComplete = event.loaded / event.total * 100;
        downloadProgress.setAttribute("value", percentComplete);
      }
      else {
        downloadProgress.setAttribute("mode", "undetermined");
      }
    },

    onDownloaded: function() {
      gDownoadObj = null;
      downloadProgress.setAttribute("value", 100);
      installLabel.removeAttribute("collapsed");
      installProgress.removeAttribute("collapsed");
    },


    returnToDownload: function() {
      btnInstallGnupg.removeAttribute("disabled");
      btnLocateGnuPG.removeAttribute("disabled");
      progressBox.setAttribute("collapsed", "true");
      downloadProgress.setAttribute("value", 0);
      installLabel.setAttribute("collapsed", "true");
      installProgress.setAttribute("collapsed", "true");
    },

    onLoaded: function() {
      installProgress.setAttribute("value", 100);
      installProgress.setAttribute("mode", "determined");

      document.getElementById("installComplete").removeAttribute("collapsed");

      var origPath = EnigGetPref("agentPath");
      EnigSetPref("agentPath", "");

      var s = enigGetSvc(true);
      if (s) {
        disableNext(false);
      }
      else {
        EnigSetPref("agentPath", origPath);
        this.returnToDownload();
        EnigAlert(EnigGetString("setupWizard.installFailed"));
      }
    }
  });
}

function browseKeyFile(referencedId, referencedVar) {
  var filePath = EnigFilePicker(EnigGetString("importKeyFile"),
                               "", false, "*.asc", "",
                               [EnigGetString("gnupgFile"), "*.asc;*.gpg;*.pgp"]);

  if (filePath) {
    document.getElementById(referencedId).value = EnigGetFilePath(filePath);
    referencedVar.value = filePath;
  }
}

function importKeyFiles() {
  if (document.getElementById("publicKeysFile").value.length == 0) {
    EnigAlert(EnigGetString("setupWizard.specifyFile"));
    return false;
  }

  var importedKeys;
  var exitCode;

  var enigmailSvc = enigGetSvc(false);
  if (! enigmailSvc) return false;

  var errorMsgObj = {};
  var keyListObj = {};
  exitCode = enigmailSvc.importKeyFromFile(window, gPubkeyFile.value, errorMsgObj, keyListObj);
  if (exitCode != 0) {
    EnigAlert(EnigGetString("importKeysFailed")+"\n\n"+errorMsgObj.value);
    return false;
  }
  importedKeys = keyListObj.value;

  if (document.getElementById("privateKeysFile").value.length > 0) {

    exitCode = enigmailSvc.importKeyFromFile(window, gSeckeyFile.value, errorMsgObj, keyListObj);
    if (exitCode != 0) {
      EnigAlert(EnigGetString("importKeysFailed")+"\n\n"+errorMsgObj.value);
      return false;
    }
    importedKeys += keyListObj.value;
  }


  exitCode = 0;
  var keyList=importedKeys.split(/;/);
  setKeyTrustNextKey(keyList, 0);

  return true;
}

function setKeyTrustNextKey(keyList, index) {
  Ec.DEBUG_LOG("enigmailSetupWizard.js: setKeyTrustNextKey("+index+")\n");

  if (index == keyList.length) {
    // end of list reached
    Ec.recalcTrustDb();
    loadKeys();
    return;
  }

  var aKey = keyList[index].split(/:/);

  let keyType;
  try {
    keyType = Number(aKey[1]);
  }
  catch (ex) {
    keyType = 0;
  }

  if (keyType & 16) {
    // imported key contains secret key
    EnigmailKeyMgmt.setKeyTrust(window, aKey[0], 5,
      function(exitCode, errorMsg) {
        if (exitCode != 0) {
          return;
        }

        if (index < keyList.length) {
          setKeyTrustNextKey(keyList, index + 1);
        }
      }
    );
  }
  else {
    if (index < keyList.length) {
      setKeyTrustNextKey(keyList, index + 1);
    }
  }
}


function displayKeyCreate() {
  if (gLastDirection == 1) {
    fillIdentities('menulist');
  }

  gPassPhraseQuality = document.getElementById("passphraseQuality");

  // gpg 2.1.0 and 2.1.1 queries passphrase only gpg-agent only
  if (! Ec.getGpgFeature("keygen-passphrase")) {
    document.getElementById("keyCreateDescSec1").setAttribute("collapsed", "true");
    document.getElementById("passphraseBox").setAttribute("collapsed", "true");
    document.getElementById("keyCreateDescSec2").removeAttribute("collapsed");
  }
  else {
    checkPassphrasesEqual();
  }

  if (countSelectedId() == 1) {
    var node = document.getElementById("idSelection").firstChild;
    while (node) {
      if (node.checked) {
        var identity = gEnigAccountMgr.getIdentity(node.getAttribute("account-id"));
        var idName = identity.identityName;

        var serverList = queryISupArray(
                getServersForIdentity(gEnigAccountMgr, identity),
                Components.interfaces.nsIMsgIncomingServer);

        if (serverList.length > 0) {
          var inServer = serverList[0];

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


function checkPassphraseQuality(txtBox) {
  var qualityRes = passwordCheck.checkQuality(txtBox.value);

  if (qualityRes.valid) {
    gPassPhraseQuality.value = qualityRes.complexity;
  }
  else if (txtBox.value.length > 0) {
    gPassPhraseQuality.value = (qualityRes.complexity / 2);
  }
  else {
    gPassPhraseQuality.value = 0;
  }

  checkPassphrasesEqual();
}

/**
 * Check if entered passphrases are equal. If yes, enable the next button
 */
function checkPassphrasesEqual() {
  let p1 = document.getElementById("passphrase").value;
  let p2 = document.getElementById("passphraseRepeat").value;

  disableNext(p1 != p2);
}


function displayKeySel() {
  loadKeys();
  var uidChildren = document.getElementById("uidSelectionChildren");
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

function onSetStartNow(mode) {
  var wizard = getWizard();
  if (mode == 0) {
    wizard.lastPage = true;
    wizard.getButton("next").hidden = true;
    wizard.getButton("finish").hidden = false;
    wizard.currentPage.next = "";
  }
  else {
    wizard.lastPage = false;
    wizard.getButton("next").hidden = false;
    wizard.getButton("finish").hidden = true;
    wizard.currentPage.next = "pgWelcome";
  }
}

function onSetSelectMode(userMode) {
  gWizardUserMode = userMode;
}

function onKeySelected() {
  var wizard = getWizard();
  var uidSel = document.getElementById("uidSelection");

  if (uidSel.view.selection.count == 1) {
    var currIndex = uidSel.view.selection.currentIndex;
    var currItem = uidSel.view.getItemAtIndex(currIndex);
    gGeneratedKey = currItem.getAttribute("keyId");
  }
  else {
    gGeneratedKey = null;
  }

  disableNext(uidSel.view.selection.count == 0);
}

function wizardSetFocus() {
  document.getElementById("selectMode").focus();
  disableNext(false);

}

function loadKeys() {
  var enigmailSvc = enigGetSvc(false);

  if (!enigmailSvc) {
    return;
  }
  clearKeyListEntries();

  var exitCodeObj = {};
  var statusFlagsObj = {};
  var errorMsgObj = {};
  var keyList = Ec.getSecretKeys(window, true);
  if (keyList == null) {
    return;
  }

  var uidChildren = document.getElementById("uidSelectionChildren");
  for (i=0; i < keyList.length; i++) {
    var item = uidChildren.appendChild( document.createElement('treeitem') );
    item.setAttribute("keyId", keyList[i].id);
    var row = item.appendChild(document.createElement('treerow'));
    var cell = row.appendChild( document.createElement('treecell') );
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

function enigGetSvc(resetCheck) {
  // Lazy initialization of enigmail JS component (for efficiency)
  // variant of GetEnigmailSvc function

  if (resetCheck) gEnigmailSvc = null;

  if (gEnigmailSvc) {
    return gEnigmailSvc.initialized ? gEnigmailSvc : null;
  }

  try {
    gEnigmailSvc = ENIG_C[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_I.nsIEnigmail);

  } catch (ex) {
    ERROR_LOG("enigmailWizard.js: Error in instantiating EnigmailService\n");
    return null;
  }

  DEBUG_LOG("enigmailWizard.js: gEnigmailSvc = "+gEnigmailSvc+"\n");

  if (!gEnigmailSvc.initialized) {
    // Try to initialize enigmail

    if (! gPrefEnigmail) {
      EnigmailCore.initPrefService();
      gPrefEnigmail = EnigmailCore.prefBranch;
    }

    try {
      // Initialize enigmail
      gEnigmailSvc.initialize(window, EnigGetVersion(), gPrefEnigmail);

      try {
        // Reset alert count to default value
        gPrefEnigmail.clearUserPref("initAlert");
      } catch(ex) {}

    } catch (ex) {

      return null;
     }

    var configuredVersion = EnigGetPref("configuredVersion");

    DEBUG_LOG("enigmailWizard.js: enigGetSvc: "+configuredVersion+"\n");

  }

  return gEnigmailSvc.initialized ? gEnigmailSvc : null;
}



function wizardLocateGpg() {
  var fileName = "gpg";
  var ext = "";
  if (Ec.isDosLike()) {
    ext = ".exe";
  }
  var filePath = EnigFilePicker(EnigGetString("locateGpg"),
                           "", false, ext,
                           fileName+ext, null);

  if (filePath) {
    EnigSetPref("agentPath", EnigGetFilePath(filePath));
    var svc = enigGetSvc(true);

    if (! svc) {
      EnigAlert(EnigGetString("setupWizard.invalidGpg"));
    }
    else {
      document.getElementById("gpgFoundBox").removeAttribute("collapsed");
      disableNext(false);
    }
  }

}

function checkPassphrase() {

  // gpg >= 2.1 queries passphrase using gpg-agent only

  if (Ec.getGpgFeature("keygen-passphrase")) {
    var passphrase = enigmailCheckPassphrase();
    if (passphrase == null) return false;

    if (passphrase.length < 8) {
      EnigAlert(EnigGetString("passphrase.min8keys"));
      return false;
    }
  }

  return true;

}

function wizardGenKey() {
  var wizard = getWizard();
  var passphrase = document.getElementById("passphrase").value;

  // gpg >= 2.1 queries passphrase using gpg-agent only
  if (! Ec.getGpgFeature("keygen-passphrase")) {
    passphrase = "";
  }

  var curId = wizardGetSelectedIdentity();

  var userName = curId.fullName;
  var userEmail = curId.email;

  var ipcRequest = null;
  var listener = {
      onStartRequest: function () {},
      onStopRequest: function(status) {
        wizardKeygenTerminate(status);
      },
      onDataAvailable: function(data) {
        DEBUG_LOG("enigmailSetupWizard.js: genKey - onDataAvailable() "+data+"\n");

        gAllData += data;
        var keyCreatedIndex = gAllData.indexOf("[GNUPG:] KEY_CREATED");
        if (keyCreatedIndex >0) {
          gGeneratedKey = gAllData.substr(keyCreatedIndex);
          gGeneratedKey = gGeneratedKey.replace(/(.*\[GNUPG:\] KEY_CREATED . )([a-fA-F0-9]+)([\n\r].*)*/, "$2");
          gAllData = gAllData.replace(/\[GNUPG:\] KEY_CREATED . [a-fA-F0-9]+[\n\r]/, "");
        }
        gAllData = gAllData.replace(/[\r\n]*\[GNUPG:\] GOOD_PASSPHRASE/g, "").replace(/([\r\n]*\[GNUPG:\] PROGRESS primegen )(.)( \d+ \d+)/g, "$2");
        var progMeter = document.getElementById("keygenProgress");
        var progValue = Number(progMeter.value);
        progValue += (1+(100-progValue)/200);
        if (progValue >= 95) progValue=10;
        progMeter.setAttribute("value", progValue);
      }
  };
  wizard.getButton("next").disabled = true;
  wizard.getButton("back").disabled = true;

  try {
    gKeygenRequest = Ec.generateKey(window,
                       Ec.convertFromUnicode(userName),
                       "",
                       userEmail,
                       365*5 /* 5 years */,
                       4096,
                       ENIG_KEYTYPE_RSA,
                       passphrase,
                       listener);
  } catch (ex) {
    Ec.DEBUG_LOG("enigmailSetupWizard.js: genKey - generateKey() failed with "+ex.toString()+"\n"+ex.stack+"\n");
  }

  if (!gKeygenRequest) {
    EnigAlert(EnigGetString("keyGenFailed"));
    wizard.getButton("back").disabled = false;
    return false;
  }

  WRITE_LOG("enigmailKeygen.js: Start: gKeygenRequest = "+gKeygenRequest+"\n");
  return false;
}


function queryISupArray(supportsArray, iid) {
  var result = [];
  var i;

  for (i=0; i<supportsArray.length; i++) {
    result.push(supportsArray.queryElementAt(i, iid));
  }

  return result;
}

function countIdentities() {
  var accountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);
  var idSupports = accountManager.allIdentities;
  var identities = queryISupArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);
  return identities.length;
}

function fillIdentities(fillType)
{
  DEBUG_LOG("enigmailSetupWizard.js: fillIdentities\n");

  var defIdentity;
  var parentElement;
  var identities = queryISupArray(gEnigAccountMgr.allIdentities,
                                       Components.interfaces.nsIMsgIdentity);

  if (fillType == "checkbox") {
    parentElement = document.getElementById("idSelection");
  }
  else {
    parentElement = document.getElementById("userIdentityPopup");

    // Find out default identity
    var defIdentities = gEnigAccountMgr.defaultAccount.identities;
    if (defIdentities.length >= 1) {
      defIdentity = defIdentities.queryElementAt(0, Components.interfaces.nsIMsgIdentity);
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

  DEBUG_LOG("enigmailSetupWizard.js: fillIdentities: "+identities + "\n");

  var disableId = document.getElementById("activateId").value == "1";
  var selected = false;
  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];

    DEBUG_LOG("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;

    var serverList = queryISupArray(
            getServersForIdentity(gEnigAccountMgr, identity),
            Components.interfaces.nsIMsgIncomingServer);

    if (serverList.length > 0) {
      var inServer = serverList[0];

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
        var idList = document.getElementById("userIdentity");
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
  debugger;

  loadLastPage();

  Ec.setPref("encryptionModel", 0);

  if (document.getElementById("activateId").value == "1") {
    // activate all identities
    var idSupports = gEnigAccountMgr.allIdentities;
    var identities = queryISupArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);
    for (var i=0; i<identities.length; i++) {
      wizardApplyId(identities[i], gGeneratedKey);
    }
  }
  else {
    // activate selected identities
    var node = document.getElementById("idSelection").firstChild;
    while (node) {
      if (node.checked) {
        var identity = gEnigAccountMgr.getIdentity(node.getAttribute("account-id"));
        wizardApplyId(identity, gGeneratedKey);
      }
      node = node.nextSibling;
    }
  }

  applyMozSetting("mail.server.default.mime_parts_on_demand", false);
  applyMozSetting("mailnews.send_plaintext_flowed", false);
  applyMozSetting("mail.strictly_mime", false);

  EnigSetPref("configuredVersion", EnigGetVersion());
  EnigSavePrefs();
}

function applyMozSetting(preference, newVal)
{
  if (typeof(newVal)=="boolean") {
    EnigmailCore.prefRoot.setBoolPref(preference, newVal);
  }
  else if (typeof(newVal)=="number") {
    EnigmailCore.prefRoot.setIntPref(preference, newVal);
  }
  else if (typeof(newVal)=="string") {
    EnigmailCore.prefRoot.setCharPref(preference, newVal);
  }
}


function wizardApplyId(identity, keyId)
{
  DEBUG_LOG("enigmailSetupWizard.js: wizardApplyId: identity.Key="+identity.key+"\n");
  var accountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);
  var idServers = getServersForIdentity(accountManager, identity);
  var servers = queryISupArray(idServers ,Components.interfaces.nsIMsgIncomingServer);

  var newsServer = false;
  for (var i=0; i<servers.length; i++) {
    newsServer = (servers[i].localStoreType == "news");
  }

  identity.setBoolAttribute("enablePgp", true);
  identity.setIntAttribute("pgpKeyMode", 1);
  identity.setCharAttribute("pgpkeyId", "0x"+keyId.substr(-8,8));
  identity.setIntAttribute("openPgpHeaderMode", 0);

  // process signing settings:
  // NOTE: option defaultSigningPolicy is an INT
  identity.setIntAttribute("defaultSigningPolicy", 0);
  identity.setBoolAttribute("pgpSignEncrypted", false);
  identity.setBoolAttribute("pgpSignPlain", false);

  // process encryption settings:
  //  0: convenient encryption (global preference)
  //  1: by default encrypt (account preference)
  //  2: by default don't encrypt (account preference)
  // NOTE: option defaultEncryptionPolicy is an INT
  identity.setIntAttribute("defaultEncryptionPolicy", 0);

  // change default composition mode to plain text
  identity.setBoolAttribute("compose_html", false);
}


function wizardKeygenTerminate(exitCode)
{
  DEBUG_LOG("enigmailSetupWizard.js: wizardKeygenTerminate\n");

  // Give focus to this window
  window.focus();

  gKeygenRequest = null;

  if ((! gGeneratedKey) || gGeneratedKey == KEYGEN_CANCELLED) return;

  var progMeter = document.getElementById("keygenProgress");
  progMeter.setAttribute("value", 100);

  var curId = wizardGetSelectedIdentity();

  if (EnigCreateRevokeCert(gGeneratedKey, curId.email, wizardKeygenCleanup) < 0) {
    wizardKeygenCleanup();
  };

}

function wizardKeygenCleanup() {
  DEBUG_LOG("enigmailSetupWizard.js: wizardKeygenCleanup\n");
  enigmailKeygenCloseRequest();
  var enigmailSvc = enigGetSvc(false);
  enigmailSvc.invalidateUserIdList();

  var wizard = getWizard();
  wizard.goTo("pgComplete");
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


function loadLastPage() {
  var wizard = getWizard();
  wizard.canRewind=false;
  wizard.getButton("cancel").disabled = true;
}


function setNewKey() {
  disableNext(false);
  gCreateNewKey = true;
  document.getElementById("uidSelection").boxObject.element.setAttribute("disabled", "true");
}

function setUseKey() {
  gCreateNewKey = false;
  document.getElementById("uidSelection").boxObject.element.removeAttribute("disabled");
  onKeySelected();
}

function setImportKeys() {
  gCreateNewKey = false;
  disableNext(false);
  document.getElementById("uidSelection").boxObject.element.setAttribute("disabled", "true");
}


// Helper function
function getServersForIdentity(accMgr, identity) {
  return accMgr.getServersForIdentity(identity);
}
