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
Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.

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
EnigInitCommon("pref-enigmail");

var gMimePartsElement, gMimePartsValue, gAdvancedMode;

function prefOnLoad() {

   EnigDisplayPrefs(false, true, false);
   document.getElementById("enigmail_agentPath").value = EnigConvertToUnicode(EnigGetPref("agentPath"), "utf-8");

   gAdvancedMode = EnigGetPref("advancedUser");

   if (window.arguments) {
      if (! window.arguments[0].showBasic) {
          // hide basic tab
          document.getElementById("basic").setAttribute("collapsed", true);
          document.getElementById("basicTab").setAttribute("collapsed", true);
          selectPrefTabPanel("sendTab");
      }
      else {
        EnigCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
        EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);
        enigShowUserModeButtons(gAdvancedMode);
      }

      if ((typeof window.arguments[0].selectTab)=="string") {
          selectPrefTabPanel(window.arguments[0].selectTab);
          prefTabs.selectedTab = selectTab;
      }

   }

   if ((! window.arguments) || (window.arguments[0].clientType!="seamonkey")) {
      document.getElementById("enigmail_disableSMIMEui").setAttribute("collapsed", true);
      var uninst = document.getElementById("uninstall");
      if (uninst) uninst.setAttribute("collapsed", "true");
      EnigCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
      EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);

   }

   EnigDisplayRadioPref("recipientsSelection", EnigGetPref("recipientsSelection"),
                        gEnigRecipientsSelection);

   gMimePartsElement = document.getElementById("mime_parts_on_demand");

   try {
     gMimePartsValue = gEnigPrefRoot.getBoolPref("mail.server.default.mime_parts_on_demand");
   } catch (ex) {
     gMimePartsValue = true;
   }

   if (gMimePartsValue) {
     gMimePartsElement.setAttribute("checked", "true");
   } else {
     gMimePartsElement.removeAttribute("checked");
   }

   var overrideGpg = document.getElementById("enigOverrideGpg")
   if (EnigGetPref("agentPath")) {
      overrideGpg.checked = true;
   }
   else {
      overrideGpg.checked = false;
   }
   enigActivateDependent(overrideGpg, "enigmail_agentPath enigmail_browsePath");
   activateRulesButton(document.getElementById("enigmail_recipientsSelection"), "openRulesEditor");

   var testEmailElement = document.getElementById("enigmail_test_email");
   var userIdValue = EnigGetPref("userIdValue");

   enigDetermineGpgPath();

   if (testEmailElement && userIdValue)
     testEmailElement.value = userIdValue;

}

function enigDetermineGpgPath() {
  if (! gEnigmailSvc) {
    try {
      gEnigmailSvc = ENIG_C.classes[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_C.interfaces.nsIEnigmail);
      if (! gEnigmailSvc.initialized) {
        // attempt to initialize Enigmail
        gEnigmailSvc.initialize(window, gEnigmailVersion, gPrefEnigmail);
      }
    } catch (ex) {}
  }

  if (gEnigmailSvc.initialized && typeof(gEnigmailSvc.agentPath) == "object") {
    try {
      var agentPath = "";
      if (EnigGetOS() == "WINNT") {
        agentPath = EnigGetFilePath(gEnigmailSvc.agentPath).replace(/\\\\/g, "\\");
      }
      else {
        agentPath = EnigGetFilePath(gEnigmailSvc.agentPath); // .replace(/\\\\/g, "\\");
      }
      if (agentPath.length > 50) {
        agentPath = agentPath.substring(0,50)+"..."
      }
      document.getElementById("enigmailGpgPath").setAttribute("value", EnigGetString("prefs.gpgFound", agentPath));
    }
    catch(ex) {
      document.getElementById("enigmailGpgPath").setAttribute("value", "error 2");
    }
  }
  else {
    document.getElementById("enigmailGpgPath").setAttribute("value", EnigGetString("prefs.gpgNotFound"));
  }
}

function selectPrefTabPanel(panelName) {
  var prefTabs=document.getElementById("prefTabs");
  var selectTab=document.getElementById(panelName);
  prefTabs.selectedTab = selectTab;
}

function resetPrefs() {
  DEBUG_LOG("pref-enigmail.js: resetPrefs\n");

  EnigDisplayPrefs(true, true, false);

  EnigSetPref("configuredVersion", gEnigmailVersion);

  EnigDisplayRadioPref("recipientsSelection", EnigGetPref("recipientsSelection"),
                      gEnigRecipientsSelection);

}

function resetRememberedValues() {
  DEBUG_LOG("pref-enigmail.js: resetRememberedValues\n");
  var prefs=["confirmBeforeSend",
             "displaySignWarn",
             "encryptAttachmentsSkipDlg",
             "initAlert",
             "quotedPrintableWarn",
             "saveEncrypted",
             "warnOnRulesConflict",
             "warnClearPassphrase",
             "warnIso2022jp",
             "warnRefreshAll"];

  for (var j=0; j<prefs.length; j++) {
    EnigSetPref(prefs[j], EnigGetDefaultPref(prefs[j]));
  }
  EnigAlert(EnigGetString("warningsAreReset"));
}

function prefOnAccept() {

  DEBUG_LOG("pref-enigmail.js: prefOnAccept\n");

  var autoKey = document.getElementById("enigmail_autoKeyRetrieve").value;

  if (autoKey.search(/.[ ,;\t]./)>=0)  {
    EnigAlert(EnigGetString("prefEnigmail.oneKeyserverOnly"));
    return false;
  }

  var oldAgentPath = EnigGetPref("agentPath");

  if (! document.getElementById("enigOverrideGpg").checked) {
    document.getElementById("enigmail_agentPath").value = "";
  }
  var newAgentPath = document.getElementById("enigmail_agentPath").value;

  EnigDisplayPrefs(false, false, true);
  EnigSetPref("agentPath", EnigConvertFromUnicode(newAgentPath, "utf-8"));

  //setRecipientsSelectionPref(document.getElementById("enigmail_recipientsSelection").value);
  //EnigSetRadioPref("recipientsSelection", gEnigRecipientsSelection);

  if (gMimePartsElement &&
      (gMimePartsElement.checked != gMimePartsValue) ) {

    gEnigPrefRoot.setBoolPref("mail.server.default.mime_parts_on_demand", (gMimePartsElement.checked ? true : false));
  }

  EnigSetPref("configuredVersion", gEnigmailVersion);
  EnigSetPref("advancedUser", gAdvancedMode);

  EnigSavePrefs();

  if (oldAgentPath != newAgentPath) {
    if (! gEnigmailSvc) {
      try {
        gEnigmailSvc = ENIG_C.classes[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_C.interfaces.nsIEnigmail);
      } catch (ex) {}
    }

    if (gEnigmailSvc.initialized) {
      try {
        gEnigmailSvc.reinitialize();
      }
      catch (ex) {
        EnigError(EnigGetString("invalidGpgPath"));
      }
    }
    else {
      gEnigmailSvc = null;
      GetEnigmailSvc();
    }
  }

  return true;
}

function enigActivateDependent (obj, dependentIds) {
  var idList = dependentIds.split(/ /);
  var depId;

  for (depId in idList) {
    if (obj.checked) {
      document.getElementById(idList[depId]).removeAttribute("disabled");
    }
    else {
      document.getElementById(idList[depId]).setAttribute("disabled", "true");
    }
  }
  return true;
}

function enigShowUserModeButtons(expertUser) {
  var advUserButton = document.getElementById("enigmail_advancedUser");
  var basicUserButton = document.getElementById("enigmail_basicUser");
  if (! expertUser) {
    basicUserButton.setAttribute("hidden", true);
    advUserButton.removeAttribute("hidden");
  }
  else {
    advUserButton.setAttribute("hidden", true);
    basicUserButton.removeAttribute("hidden");
  }
}

function enigSwitchAdvancedMode(expertUser) {

  var origPref = EnigGetPref("advancedUser");
  enigShowUserModeButtons(expertUser);
  gAdvancedMode = expertUser;

  if (expertUser) {
    EnigSetPref("advancedUser", true);
  }
  else {
    EnigSetPref("advancedUser", false);
  }

  var prefTabBox  = document.getElementById("prefTabBox");
  if (prefTabBox) {
    // Thunderbird
    EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);
    EnigCollapseAdvanced(prefTabBox, "collapsed", null);
  }
  else {
    // Seamonkey
    EnigCollapseAdvanced(document.getElementById("enigmailPrefsBox"), "hidden", null);
  }
  EnigSetPref("advancedUser", origPref);
}

function enigAlertAskNever () {
  EnigAlert(EnigGetString("prefs.warnAskNever"));
}

function activateRulesButton(radioListObj, buttonId) {
  switch (radioListObj.value) {
  case "3":
  case "4":
    document.getElementById(buttonId).setAttribute("disabled", "true");
    break;
  default:
    document.getElementById(buttonId).removeAttribute("disabled");
  }
}


function EnigMimeTest() {
  CONSOLE_LOG("\n\nEnigMimeTest: START ********************************\n");

  var lines = ["content-type: multipart/mixed;\r",
               "\n boundary=\"ABCD\"",
               "\r\n\r\nmultipart\r\n--ABCD\r",
               "\ncontent-type: text/html \r\n",
               "\r\n<html><body><b>TEST CONTENT1<b></body></html>\r\n\r",
               "\n--ABCD\r\ncontent-type: text/plain\r\ncontent-disposition:",
               " attachment; filename=\"abcd.txt\"\r\n",
               "\r\nFILE CONTENTS\r\n--ABCD--\r\n"];

  var linebreak = ["CRLF", "LF", "CR"];

  for (var j=0; j<linebreak.length; j++) {
    var listener = enigCreateInstance(ENIG_IPCBUFFER_CONTRACTID, "nsIIPCBuffer");

    listener.open(2000, false);

    var mimeFilter = enigCreateInstance(ENIG_ENIGMIMELISTENER_CONTRACTID, "nsIEnigMimeListener");

    mimeFilter.init(listener, null, 4000, j != 1, j == 1, false);

    for (var k=0; k<lines.length; k++) {
      var line = lines[k];
      if (j == 1) line = line.replace(/\r/g, "");
      if (j == 2) line = line.replace(/\n/g, "");
      mimeFilter.write(line, line.length, null, null);
    }

    mimeFilter.onStopRequest(null, null, 0);

    CONSOLE_LOG(linebreak[j]+" mimeFilter.contentType='"+mimeFilter.contentType+"'\n");
    CONSOLE_LOG(linebreak[j]+" listener.getData()='"+listener.getData().replace(/\r/g, "\\r")+"'\n");
  }

  CONSOLE_LOG("************************************************\n");
}

function EnigTest() {
  var plainText = "TEST MESSAGE 123\nTEST MESSAGE 345\n";
  var testEmailElement = document.getElementById("enigmail_test_email");
  var toMailAddr = testEmailElement.value;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("testNoSvc"));
    return;
  }

  if (!toMailAddr) {

    try {
      EnigMimeTest();
    } catch (ex) {}

    EnigAlert(EnigGetString("testNoEmail"));
    return;
  }

  try {
    CONSOLE_LOG("\n\nEnigTest: START ********************************\n");
    CONSOLE_LOG("EnigTest: To: "+toMailAddr+"\n"+plainText+"\n");

    var uiFlags = nsIEnigmail.UI_INTERACTIVE;

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();

    var cipherText = enigmailSvc.encryptMessage(window, uiFlags, null, plainText,
                                                "", toMailAddr,
                                                nsIEnigmail.SEND_SIGNED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("EnigTest: SIGNING ONLY\n");
    CONSOLE_LOG("EnigTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("EnigTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    var signatureObj   = new Object();
    var keyIdObj       = new Object();
    var userIdObj      = new Object();
    var sigDetailsObj  = new Object();
    var blockSeparationObj  = new Object();

    var decryptedText = enigmailSvc.decryptMessage(window,
                                        uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        sigDetailsObj,
                                        errorMsgObj,
                                        blockSeparationObj);

    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("EnigTest: VERIFICATION\n");
    CONSOLE_LOG("EnigTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("EnigTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("EnigTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    cipherText = enigmailSvc.encryptMessage(window, uiFlags, null, plainText,
                                                "", toMailAddr,
                                                nsIEnigmail.SEND_SIGNED|
                                                nsIEnigmail.SEND_ENCRYPTED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("EnigTest: SIGNING + ENCRYPTION\n");
    CONSOLE_LOG("EnigTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("EnigTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    decryptedText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        sigDetailsObj,
                                        errorMsgObj, blockSeparationObj);

    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("EnigTest: DECRYPTION\n");
    CONSOLE_LOG("EnigTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("EnigTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("EnigTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    EnigAlert(EnigGetString("testSucceeded"));
  }
  catch (ex) {
    EnigAlert(EnigGetString("undefinedError"));
  }
}

function enigLocateGpg() {
  var fileName="gpg";
  var ext="";
  if (EnigGetOS() == "WINNT") {
    ext=".exe";
  }
  var filePath = EnigFilePicker(EnigGetString("locateGpg"),
                           "", false, ext,
                           fileName+ext, null);
  if (filePath) {
    document.getElementById("enigmail_agentPath").value = EnigGetFilePath(filePath);
  }
}


/////////////////////////////////////////////////
// Uninstallation stuff for Seamonkey < 2.0
/////////////////////////////////////////////////

function enigUninstall()
{
  if (!EnigConfirm(EnigGetString("uninstallConfirm"))) {
    return;
  }

  try {
    var uninst=new enigUninstaller();
    uninst.uninstallPackage();
    EnigAlert(EnigGetString("uninstallSuccess"));
    window.close();
  }
  catch (ex) {
    EnigAlert(EnigGetString("uninstallFail"));
  }

}

// The part below is taken from jslib (http://jslib.mozdev.org)
// CONSTRUCTOR
function enigUninstaller()
{

  this.mNames = ["enigmail", "enigmime"];

  this.gRDF = enigGetService("@mozilla.org/rdf/rdf-service;1", "nsIRDFService");
  this.gDirService = enigGetService("@mozilla.org/file/directory_service;1", "nsIProperties");
}

/*********** UNINSTALL ***************/
enigUninstaller.prototype =
{
  gRDF                    : null,
  gDirService             : null,

  CHRM_REG_CID            : "@mozilla.org/chrome/chrome-registry;1",
  CHROME_NS               : "http://www.mozilla.org/rdf/chrome#",

  mNames                  : null,
  mUninstallInfoGenerated : false,
  mInstallCallback        : null,

  filesToDelete           : [],
  filesToDeleteHash       : {},
  overlaysToDelete        : [],
  baseURIs                : {},
  packageDisplayName      : "",


  finish : function ()
  {
    // do nothing
  },

  generateUninstallInfo : function ()
  {
    if (!this.mUninstallInfoGenerated){
      this.mUninstallInfoGenerated = true;

      this.filesToDelete = [];
      this.filesToDeleteHash = {};
      this.overlaysToDelete = [];
      this.baseURIs = {};

      this.doUninstall(false);
    }
  },

  uninstallPackage : function ()
  {
    this.generateUninstallInfo();
    this.doUninstall(true);
  },

  /**
   * Iterates over the items in an RDF Container
   */
  iterateContainer : function(ds, resource, callback)
  {
    try {
      var container = enigCreateInstance("@mozilla.org/rdf/container;1", "nsIRDFContainer");
      container.Init(ds, resource);
    }
    catch (ex){ return; }

    var elements = container.GetElements();
    while (elements.hasMoreElements()){
      var element = elements.getNext();
      callback(resource, element, this);
    }
  },

  /**
   * Get all of the currently installed packages. This function is not currently used.
   */
  getAllPackagesInfo : function(chromeDS)
  {
    var allPackages = {};

    var handlePackages = function(container, packres, uninstallObj)
    {
      var childPred = uninstallObj.gRDF.GetResource(uninstallObj.CHROME_NS + "name")
      var childName = chromeDS.GetTarget(packres, childPred, true);

      var displayPred = uninstallObj.gRDF.GetResource(uninstallObj.CHROME_NS + "displayName")
      var displayName = chromeDS.GetTarget(packres, displayPred, true);

      if (childName instanceof ENIG_C.interfaces.nsIRDFLiteral){
        if (displayName instanceof ENIG_C.interfaces.nsIRDFLiteral){
          displayName = displayName.Value;
        }
        else {
          displayName = childName.Value;
        }
        allPackages[childName.Value] = displayName;
      }
    }

    var rootseq = this.gRDF.GetResource("urn:mozilla:package:root");
    this.iterateContainer(chromeDS, rootseq, handlePackages);
  },

  /**
   * Do the uninstallation. This function will be called twice. Once to generate
   * the list of files and overlays to delete, and the second to do the deletions.
   */
  doUninstall : function(makeChanges)
  {
    var ioService = enigGetService("@mozilla.org/network/io-service;1", "nsIIOService");

    // scan through chrome.rdf and find all references to the package and remove them.
    var appChromeDir = this.gDirService.get("AChrom", ENIG_C.interfaces.nsIFile);
    var chromeRdfFile = appChromeDir.clone();
    chromeRdfFile.append("chrome.rdf");
    var chromeUrl = ioService.newFileURI(chromeRdfFile).spec;
    var appChromeDS = this.gRDF.GetDataSourceBlocking(chromeUrl);

    for (var pt = 0; pt < this.mNames.length; pt++){
      this.handleChromeRDF(this.mNames[pt], appChromeDir, appChromeDS, makeChanges);
    }

    // scan through chrome.rdf and find all references to the package and remove them.
    var userChromeDir = this.gDirService.get("UChrm", ENIG_C.interfaces.nsIFile);
    chromeRdfFile = userChromeDir.clone();
    chromeRdfFile.append("chrome.rdf");
    chromeUrl = ioService.newFileURI(chromeRdfFile).spec;
    var userChromeDS = this.gRDF.GetDataSourceBlocking(chromeUrl);

    for (pt = 0; pt < this.mNames.length; pt++){
      this.handleChromeRDF(this.mNames[pt], userChromeDir, userChromeDS, makeChanges);
    }

    if (makeChanges){
      if (appChromeDS instanceof ENIG_C.interfaces.nsIRDFRemoteDataSource)
          appChromeDS.Flush();
      if (userChromeDS instanceof ENIG_C.interfaces.nsIRDFRemoteDataSource)
          userChromeDS.Flush();

      for (t=0; t<this.overlaysToDelete.length; t++){
        this.removeOverlay(this.overlaysToDelete[t]);
      }

      this.removeFromInstalledChrome(appChromeDir);

      var uninstallObj = this;
      var callback = function() {  uninstallObj.doNextUninstallStep(uninstallObj,0); }
      setTimeout(callback,50);
    }
  },

  doNextUninstallStep : function(uninstallObj,step)
  {

    if (step >= uninstallObj.filesToDelete.length){
      return;
    }

    // ignore errors since it doesn't matter if a file could not be found, and
    // non-empty directories should not be deleted.
    try {
      var file = uninstallObj.filesToDelete[step];
      var path = file.path;

      DEBUG_LOG("pref-enigmail.js: Uninstalling " + file.leafName+": ");

      var ext = path.substring(path.lastIndexOf(".")+1, path.length);
      // close the jar filehandle so we can unlock it and delete it on
      // OS's like Windows that like to lock their open files
      if (ext == "jar") {
        var IOService = enigGetService("@mozilla.org/network/io-service;1", "nsIIOService");
        var handler = IOService.getProtocolHandler("jar");
        if (handler instanceof ENIG_C.interfaces.nsIJARProtocolHandler) {
          var zrc = handler.JARCache;
          var nsIZipReader = zrc.getZip(file);
          nsIZipReader.close();
        }
      }
      DEBUG_LOG("Delete " + file.path + "\n");
      try {
        if (file.exists()) file.remove(false);
      }
      catch (ex) {}
    }
    catch (ex){ DEBUG_LOG(ex); }

    var callback = function() {  uninstallObj.doNextUninstallStep(uninstallObj,step + 1); }
    setTimeout(callback,50);
  },

  /**
   * Gather information about the package from a chrome.rdf file and remove it.
   */
  handleChromeRDF :function(packagename, chromeDir, chromeDS, makeChanges)
  {
    // remove package from content
    var rootseq = this.gRDF.GetResource("urn:mozilla:package:root");
    var packres = this.gRDF.GetResource("urn:mozilla:package:" + packagename);

    if (makeChanges){
      this.removeFromChrome(chromeDS, rootseq, packres);
    }
    else {
      this.generateUninstallData(chromeDS, rootseq, packres, chromeDir);

      if (!this.packageDisplayName){
        var displayNamePred = this.gRDF.GetResource(this.CHROME_NS + "displayName")
        var displayName = chromeDS.GetTarget(packres, displayNamePred, true);
        if (displayName instanceof Components.interfaces.nsIRDFLiteral){
          this.packageDisplayName = displayName.Value;
        }
        else {
          this.packageDisplayName = packagename;
        }
      }
    }

    // remove package from skin
    var provider = "skin";

    var handleSkinLocaleList = function(container, skinLocale, uninstallObj)
    {
      var rootseq = chromeDS.GetTarget(skinLocale,
                      uninstallObj.gRDF.GetResource(uninstallObj.CHROME_NS + "packages"),true);
      rootseq.QueryInterface(ENIG_C.interfaces.nsIRDFResource);

      var skinLocaleName = chromeDS.GetTarget(skinLocale,
            uninstallObj.gRDF.GetResource(uninstallObj.CHROME_NS + "name"),true);

      if (skinLocaleName instanceof ENIG_C.interfaces.nsIRDFLiteral){
        var skinLocaleRes = uninstallObj.gRDF.GetResource("urn:mozilla:" + provider + ":" +
                              skinLocaleName.Value + ":" + packagename);

        if (makeChanges) uninstallObj.removeFromChrome(chromeDS, rootseq, skinLocaleRes);
        else uninstallObj.generateUninstallData(chromeDS, rootseq, skinLocaleRes, chromeDir);
      }
    };

    var packreslist = this.gRDF.GetResource("urn:mozilla:skin:root");
    this.iterateContainer(chromeDS, packreslist, handleSkinLocaleList);

    // remove package from locale
    provider = "locale";

    packreslist = this.gRDF.GetResource("urn:mozilla:locale:root");
    this.iterateContainer(chromeDS, packreslist, handleSkinLocaleList);
  },

  /**
   * Perform an uninstallation given a contents.rdf datasource.
   *   aChromeDS   - chrome.rdf datasource
   *   rootseq     - root sequence
   *   packres     - packagename as a resource
   */
  generateUninstallData : function(chromeDS, rootseq, packres, chromeDir)
  {
    var baseUrlPred = this.gRDF.GetResource(this.CHROME_NS + "baseURL")
    var baseUrl = chromeDS.GetTarget(packres, baseUrlPred, true);
    if (baseUrl instanceof Components.interfaces.nsIRDFLiteral){
      var ds;
      try {
        ds = this.gRDF.GetDataSourceBlocking(baseUrl.Value + "contents.rdf");
      }
      catch (ex){ DEBUG_LOG(ex); return; }

      this.markJarForDeletion(baseUrl.Value);

      this.generateFilesToDelete(ds, packres);
      this.generateOverlaysToDelete(ds, chromeDir, "overlays");
      this.generateOverlaysToDelete(ds, chromeDir, "stylesheets");
    }
  },

  /**
   * Generate the files to delete, which are listed in the uninstallInfo section
   * of the contents.rdf
   */
  generateFilesToDelete : function(aDS, node)
  {
    var pred = this.gRDF.GetResource(this.CHROME_NS + "uninstallInfo");
    var uninstallInfo = aDS.GetTarget(node,pred,true);
    if (uninstallInfo){
      this.iterateContainer(aDS, uninstallInfo, this.makeFileForDeletion);
    }
  },

  /**
   * Mark a file for deletion.
   */
  makeFileForDeletion : function(container, filename, uninstallObj)
  {
    if (!(filename instanceof ENIG_C.interfaces.nsIRDFLiteral)) return;
    filename = filename.Value;

    var filekey;
    var colonIdx = filename.indexOf(":");
    if (colonIdx >= 0){
      filekey = filename.substring(0,colonIdx);
      filename = filename.substring(colonIdx + 1);
    }
    else {
      filekey = "CurProcD";
    }

    var file;
    try {
       file = uninstallObj.gDirService.get(filekey, ENIG_C.interfaces.nsIFile);
    } catch (ex) { return; }

    var fileparts = filename.split("/");
    for (var t=0; t<fileparts.length; t++){
      file.append(fileparts[t]);
    }

    if (!uninstallObj.filesToDeleteHash[file.path]){
      uninstallObj.filesToDeleteHash[file.path] = file;
      uninstallObj.filesToDelete.push(file);
    }
  },

  /**
   * Given a baseURI reference, determine the JAR file to delete.
   */
  markJarForDeletion : function(url)
  {
    this.baseURIs[url] = url;

    if (url.indexOf("jar:")) return;

    var jarfile;

    url = url.substring(4);

    var expos = url.indexOf("!");
    if (expos > 0){
      url = url.substring(0,expos);

      if (url.indexOf("resource:/") == 0){
        url = url.substring(10);

        jarfile = this.gDirService.get("CurProcD", ENIG_C.interfaces.nsIFile);

        var fileparts = url.split("/");
        for (var t=0; t<fileparts.length; t++){
          jarfile.append(fileparts[t]);
        }
      }
      else if (url.indexOf("file://") == 0) {
        var ioService = enigGetService("@mozilla.org/network/io-service;1", "nsIIOService");
        var fileuri = ioService.newURI(url,"",null);
        if (fileuri instanceof ENIG_C.interfaces.nsIFileURL){
          jarfile = fileuri.file;
        }
      }
    }

    if (!this.filesToDeleteHash[jarfile.path]){
      this.filesToDeleteHash[jarfile.path] = jarfile;
      this.filesToDelete.push(jarfile);
    }
  },

  /**
   * Generate the list of overlays referenced in a contents.rdf file.
   */
  generateOverlaysToDelete : function(aDS, chromeDir, overlayType)
  {
    var iterateOverlays = function(container, overlayFile, uninstallObj)
    {
      if ((container instanceof ENIG_C.interfaces.nsIRDFResource) &&
          (overlayFile instanceof ENIG_C.interfaces.nsIRDFLiteral)){
        uninstallObj.overlaysToDelete.push(
          { overlaidFile: container,
            overlayFile: overlayFile,
            chromeDir : chromeDir,
            type: overlayType });
      }
    }

    var iterateOverlaids = function(container, overlaidFile, uninstallObj)
    {
      uninstallObj.iterateContainer(aDS, overlaidFile, iterateOverlays);
    }

    var oroot = this.gRDF.GetResource("urn:mozilla:" + overlayType);
    this.iterateContainer(aDS, oroot, iterateOverlaids);
  },

  /**
   * Remove an overlay from the overlayinfo.
   */
  removeOverlay : function(overlay)
  {
    DEBUG_LOG("pref-enigmail: removeOverlay\n");
    var overlayItems = this.splitURL(overlay.overlaidFile.Value);

    var overlayRdfFile = overlay.chromeDir.clone();
    overlayRdfFile.append("overlayinfo");
    overlayRdfFile.append(overlayItems.packagename);
    overlayRdfFile.append(overlayItems.provider);
    overlayRdfFile.append(overlay.type + ".rdf");

    var ioService = enigGetService("@mozilla.org/network/io-service;1", "nsIIOService");
    var overlayRdfUrl = ioService.newFileURI(overlayRdfFile).spec;
    var dsource = this.gRDF.GetDataSourceBlocking(overlayRdfUrl);

    try {
      DEBUG_LOG("pref-enigmail: removeOverlay: Uncontain Overlay " + this.RDFGetValue(overlay.overlayFile) +
           " from " + this.RDFGetValue(overlay.overlaidFile) + "\n");
      var container = enigCreateInstance("@mozilla.org/rdf/container;1", "nsIRDFContainer");
      container.Init(dsource, overlay.overlaidFile);
      container.RemoveElement(overlay.overlayFile, true);
    }
    catch (ex) { DEBUG_LOG(ex); }

    if (dsource instanceof ENIG_C.interfaces.nsIRDFRemoteDataSource)
      dsource.Flush();
  },

  /**
   * split a chrome URL into component parts.
   *
   * The algorithm was taken from mozilla/rdf/chrome/src/nsChromeRegistry.cpp
   */
  splitURL : function(url)
  {
    if (url.indexOf("chrome://")) return null;

    var packagename = url.substring(9);
    var slashidx = packagename.indexOf("/");
    if (slashidx == -1) return null;

    var provider = packagename.substring(slashidx + 1);
    packagename = packagename.substring(0,slashidx);

    slashidx = provider.indexOf("/");
    if (slashidx >= 0){
      provider = provider.substring(0,slashidx);
    }

    return {
      packagename: packagename,
      provider: provider
    };
  },

  /**
   * Useful debugging function to convert an nsIRDFNode into a string.
   */
  RDFGetValue : function(node)
  {
    return ((node instanceof ENIG_C.interfaces.nsIRDFResource) ? node.Value :
            ((node instanceof ENIG_C.interfaces.nsIRDFLiteral) ? node.Value : ""));
  },

  /**
   * Remove references to a package from chrome.rdf.
   */
  removeFromChrome : function (dsource, rootseq, packres)
  {
    DEBUG_LOG("pref-enigmail: removeFromChrome\n");
    var packresnode = packres.QueryInterface(ENIG_C.interfaces.nsIRDFNode);

    try {
      DEBUG_LOG("pref-enigmail: removeFromChrome: Uncontain " + packres.Value + " from " +
                 rootseq.Value + "\n");
      var container = enigCreateInstance("@mozilla.org/rdf/container;1", "nsIRDFContainer");
      container.Init(dsource, rootseq);
      container.RemoveElement(packresnode, true);
    }
    catch (ex) { DEBUG_LOG(ex); }

    var arcs = dsource.ArcLabelsOut(packres);

    while(arcs.hasMoreElements()) {
      var arc = arcs.getNext();

      var prop = arc.QueryInterface(ENIG_C.interfaces.nsIRDFResource);

      var targets = dsource.GetTargets(packres, prop, true);

      while (targets.hasMoreElements()) {
        var target = targets.getNext();

        var targetNode = target.QueryInterface(ENIG_C.interfaces.nsIRDFNode);
        DEBUG_LOG("pref-enigmail: removeFromChrome: Unassert [" + packres.Value + " , " +
              prop.Value + " , " + this.RDFGetValue(target) + "]\n");
        dsource.Unassert(packres, prop, targetNode);
      }
    }
  },

  removeFromInstalledChrome : function(chromeDir)
  {
    DEBUG_LOG("pref-enigmail: removeFromInstalledChrome\n");
  }
}

