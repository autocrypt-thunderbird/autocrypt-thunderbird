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

// enigmailCommon.js: shared JS functions for Enigmail

// The compatible Enigmime version
var gEnigmimeVersion = "1.2";

// Maximum size of message directly processed by Enigmail
const ENIG_MSG_BUFFER_SIZE = 96000;
const ENIG_MSG_HEADER_SIZE = 16000;
const ENIG_UNLIMITED_BUFFER_SIZE = -1;

const ENIG_KEY_BUFFER_SIZE = 64000;

const ENIG_PROCESSINFO_CONTRACTID = "@mozilla.org/xpcom/process-info;1";
const ENIG_PIPECONSOLE_CONTRACTID = "@mozilla.org/process/pipe-console;1";
const ENIG_IPCBUFFER_CONTRACTID   = "@mozilla.org/process/ipc-buffer;1";
const ENIG_IPCSERVICE_CONTRACTID  = "@mozilla.org/process/ipc-service;1";
const ENIG_PIPEFILTERLISTENER_CONTRACTID = "@mozilla.org/process/pipe-filter-listener;1";
const ENIG_ENIGMAIL_CONTRACTID    = "@mozdev.org/enigmail/enigmail;1";
const ENIG_ENIGMIMELISTENER_CONTRACTID = "@mozilla.org/enigmail/mime-listener;1";
const ENIG_ENIGMIMESERVICE_CONTRACTID = "@mozdev.org/enigmail/enigmimeservice;1";
const ENIG_ENIGMIMEVERIFY_CONTRACTID = "@mozilla.org/enigmail/mime-verify;1";
const ENIG_STRINGBUNDLE_CONTRACTID = "@mozilla.org/intl/stringbundle;1";
const ENIG_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const ENIG_DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";
const ENIG_MIME_CONTRACTID = "@mozilla.org/mime;1";
const ENIG_WMEDIATOR_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=window-mediator";
const ENIG_APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1"
const ENIG_ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const ENIG_CLIPBOARD_CONTRACTID = "@mozilla.org/widget/clipboard;1";
const ENIG_CLIPBOARD_HELPER_CONTRACTID = "@mozilla.org/widget/clipboardhelper;1"
const ENIG_TRANSFERABLE_CONTRACTID = "@mozilla.org/widget/transferable;1"
const ENIG_LOCALE_SVC_CONTRACTID = "@mozilla.org/intl/nslocaleservice;1";
const ENIG_DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1"
const ENIG_ACCOUNT_MANAGER_CONTRACTID = "@mozilla.org/messenger/account-manager;1";
const ENIG_XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const ENIG_THREAD_MANAGER_CID = "@mozilla.org/thread-manager;1";
const ENIG_SIMPLEURI_CONTRACTID   = "@mozilla.org/network/simple-uri;1";
const ENIG_SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"


const ENIG_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";
const ENIG_STANDARD_URL_CONTRACTID = "@mozilla.org/network/standard-url;1";
const ENIG_SCRIPTABLEINPUTSTREAM_CONTRACTID = "@mozilla.org/scriptableinputstream;1";
const ENIG_SAVEASCHARSET_CONTRACTID = "@mozilla.org/intl/saveascharset;1";

const ENIG_STREAMCONVERTERSERVICE_CID_STR =
      "{892FFEB0-3F80-11d3-A16C-0050041CAF44}";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";


const ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const ENIG_IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

const ENIGMAIL_PREFS_ROOT       = "extensions.enigmail.";
const ENIG_C = Components;

// Key algorithms
const ENIG_KEYTYPE_DSA = 1;
const ENIG_KEYTYPE_RSA = 2;


// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const ENIG_KEY_TRUST=1;
const ENIG_KEY_ID = 4;
const ENIG_CREATED = 5;
const ENIG_EXPIRY = 6;
const ENIG_UID_ID = 7;
const ENIG_OWNERTRUST = 8;
const ENIG_USER_ID = 9;
const ENIG_SIG_TYPE = 10;
const ENIG_KEY_USE_FOR = 11;

const ENIG_KEY_EXPIRED="e";
const ENIG_KEY_REVOKED="r";
const ENIG_KEY_INVALID="i";
const ENIG_KEY_DISABLED="d";
const ENIG_KEY_NOT_VALID=ENIG_KEY_EXPIRED+ENIG_KEY_REVOKED+ENIG_KEY_INVALID+ENIG_KEY_DISABLED;


// Interfaces
const nsIEnigmail               = ENIG_C.interfaces.nsIEnigmail;
const nsIEnigStrBundle          = ENIG_C.interfaces.nsIStringBundleService;

// Encryption flags
if (nsIEnigmail) {
  const ENIG_SIGN    = nsIEnigmail.SEND_SIGNED;
  const ENIG_ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;
  const ENIG_ENCRYPT_OR_SIGN = ENIG_ENCRYPT | ENIG_SIGN;
}

// UsePGPMimeOption values
const PGP_MIME_NEVER    = 0;
const PGP_MIME_POSSIBLE = 1;
const PGP_MIME_ALWAYS   = 2;

const ENIG_POSSIBLE_PGPMIME = -2081;

// property name for temporary directory service
const ENIG_TEMPDIR_PROP = "TmpD";

var gUsePGPMimeOptionList = ["usePGPMimeNever", "usePGPMimePossible",
                             "usePGPMimeAlways"];

var gEnigRecipientsSelection = ["-",
                                "perRecipientRules",
                                "perRecipientRulesAndEmail",
                                "perEmailAddress",
                                "askRecipientsAlways"];

const ENIG_BUTTON_POS_0           = 1;
const ENIG_BUTTON_POS_1           = 1 << 8;
const ENIG_BUTTON_POS_2           = 1 << 16;
const ENIG_BUTTON_TITLE_IS_STRING = 127;

const ENIG_HEADERMODE_KEYID = 0x01;
const ENIG_HEADERMODE_URL   = 0x10;


const ENIG_THREE_BUTTON_STRINGS   = (ENIG_BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_0) +
                               (ENIG_BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_1) +
                               (ENIG_BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_2);

var gEnigLogLevel = 2;     // Output only errors/warnings by default
var gEnigDebugLog;
var gEnigExtensionVersion;


var gEnigPrefSvc, gEnigPrefRoot, gPrefEnigmail, gEnigConsoleSvc;
try {
  gEnigPrefSvc = enigGetService("@mozilla.org/preferences-service;1", "nsIPrefService");

  gEnigPrefRoot        = gEnigPrefSvc.getBranch(null);
  gPrefEnigmail = gEnigPrefSvc.getBranch(ENIGMAIL_PREFS_ROOT);

  if (EnigGetPref("logDirectory"))
    gEnigLogLevel = 5;

} catch (ex) {
  ERROR_LOG("enigmailCommon.js: Error in instantiating PrefService\n");
}

try {
  // Gecko 2.0 only
  Components.utils.import("resource://gre/modules/AddonManager.jsm");
  AddonManager.getAddonByID(ENIG_EXTENSION_GUID,
    function (aAddon) {
      gEnigExtensionVersion = aAddon.version;
    }
  );
}
catch (ex) {}

function EnigGetFrame(win, frameName) {
  DEBUG_LOG("enigmailCommon.js: EnigGetFrame: name="+frameName+"\n");
  for (var j=0; j<win.frames.length; j++) {
    if (win.frames[j].name == frameName) {
      return win.frames[j];
    }
  }
  return null;
}

var gEnigPromptSvc;

var gEnigStrBundle;

// Initializes enigmailCommon
function EnigInitCommon(id) {
   DEBUG_LOG("enigmailCommon.js: EnigInitCommon: id="+id+"\n");

   gEnigPromptSvc = enigGetService("@mozilla.org/embedcomp/prompt-service;1", "nsIPromptService");

   // Do not instantiate ProcessInfo for Prefs
   if (id && (id.indexOf("pref-") == 0))
     return;

   try {
     var processInfo = enigGetService(ENIG_PROCESSINFO_CONTRACTID, "nsIProcessInfo");

     var nspr_log_modules = processInfo.getEnv("NSPR_LOG_MODULES");

     var matches = nspr_log_modules.match(/enigmailCommon:(\d+)/);

     if (matches && (matches.length > 1)) {
       gEnigLogLevel = matches[1];
       WARNING_LOG("enigmailCommon.js: gEnigLogLevel="+gEnigLogLevel+"\n");
     }

   } catch (ex) {
     dump("enigmailCommon.js: Error in instantiating ProcessInfo\n");
   }

}

var gEnigmailSvc;

function GetEnigmailSvc() {
  // Lazy initialization of enigmail JS component (for efficiency)

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
      gEnigmailSvc.initialize(window, EnigGetVersion(), gPrefEnigmail);

      try {
        // Reset alert count to default value
        gPrefEnigmail.clearUserPref("initAlert");
      } catch(ex) {
      }

    } catch (ex) {

      if (firstInitialization) {
        // Display initialization error alert
        var errMsg = gEnigmailSvc.initializationError ? gEnigmailSvc.initializationError : EnigGetString("accessError");

        errMsg += "\n\n"+EnigGetString("avoidInitErr");


        var checkedObj = {value: false};
        if (EnigGetPref("initAlert")) {
          var r = EnigLongAlert("Enigmail: "+errMsg, EnigGetString("dlgNoPrompt"), null, ":help", null, checkedObj);
          if (r >= 0 && checkedObj.value) {
            EnigSetPref("initAlert", false);
          }
          if (r == 1) {
            EnigHelpWindow("initError");
          }
        }
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

    if (gEnigmailSvc.initialized && (EnigGetVersion() != configuredVersion)) {
      EnigConfigure();
    }
  }

  if (gEnigmailSvc.logFileStream) {
    gEnigDebugLog = true;
    gEnigLogLevel = 5;
  }

  return gEnigmailSvc.initialized ? gEnigmailSvc : null;
}



function EnigUpgradeRecipientsSelection () {
  // Upgrade perRecipientRules and recipientsSelectionOption to
  // new recipientsSelection

  var  keySel = EnigGetPref("recipientsSelectionOption");
  var  perRecipientRules = EnigGetPref("perRecipientRules");

  var setVal = 2;

  /*
  1: rules only
  2: rules & email addresses (normal)
  3: email address only (no rules)
  4: manually (always prompt, no rules)
  5: no rules, no key selection
  */

  switch (perRecipientRules) {
  case 0:
    switch (keySel) {
    case 0:
      setVal = 5;
      break;
    case 1:
      setVal = 3;
      break;
    case 2:
      setVal = 4;
      break;
    default:
      setVal = 2;
    }
    break;
  case 1:
    setVal = 2;
    break;
  case 2:
    setVal = 1;
    break;
  default:
    setVal = 2;
  }

  // set new pref
  EnigSetPref("recipientsSelection", setVal);

  // clear old prefs
  gPrefEnigmail.clearUserPref("perRecipientRules");
  gPrefEnigmail.clearUserPref("recipientsSelectionOption");
}

function EnigUpgradeHeadersView() {
  // all headers hack removed -> make sure view is correct
  var hdrMode = null;
  try {
    var hdrMode = EnigGetPref("show_headers");
  }
  catch (ex) {}

  if (hdrMode == null) hdrMode = 1;
  try {
    gPrefEnigmail.clearUserPref("show_headers");
  }
  catch (ex) {}

  gEnigPrefRoot.setIntPref("mail.show_headers", hdrMode);
  try {
    enigMessageReload(false);
  }
  catch (ex) {}
}

function EnigUpgradeCustomHeaders() {
  try {
    var extraHdrs = " " + gEnigPrefRoot.getCharPref("mailnews.headers.extraExpandedHeaders").toLowerCase() + " ";

    var extraHdrList = [
      "x-enigmail-version",
      "content-transfer-encoding",
      "openpgp",
      "x-mimeole",
      "x-bugzilla-reason",
      "x-php-bug" ];

    for (hdr in extraHdrList) {
      extraHdrs = extraHdrs.replace(" "+extraHdrList[hdr]+" ", " ");
    }

    extraHdrs = extraHdrs.replace(/^ */, "").replace(/ *$/, "");
    gEnigPrefRoot.setCharPref("mailnews.headers.extraExpandedHeaders", extraHdrs)
  }
  catch(ex) {}
}

function EnigUpgradePgpMime() {
  var pgpMimeMode = false;
  try {
    var pgpMimeMode = (EnigGetPref("usePGPMimeOption") == 2);
  }
  catch (ex) {
    return;
  }

  try {
    if (pgpMimeMode) {
      var accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);
      for (var i=0; i < accountManager.allIdentities.Count(); i++) {
        var id = accountManager.allIdentities.QueryElementAt(i, Components.interfaces.nsIMsgIdentity);
        if (id.getBoolAttribute("enablePgp")) {
          id.setBoolAttribute("pgpMimeMode", true);
        }
      }
    }
    gPrefEnigmail.clearUserPref("usePGPMimeOption");
  }
  catch (ex) {}
}

function EnigConfigure() {
  var oldVer=EnigGetPref("configuredVersion");

  try {
    var vc = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
    if (oldVer == "") {
      EnigOpenSetupWizard();
    }
    else if (oldVer < "0.95") {
      try {
        EnigUpgradeHeadersView();
        EnigUpgradePgpMime();
        EnigUpgradeRecipientsSelection();
      }
      catch (ex) {}
    }
    else if (vc.compare(oldVer, "1.0") < 0) EnigUpgradeCustomHeaders();
  }
  catch(ex) {};
  EnigSetPref("configuredVersion", EnigGetVersion());
  EnigSavePrefs();
}

///////////////////////////////////////////////////////////////////////////////
// File read/write operations


const ENIG_RDONLY      = 0x01;
const ENIG_WRONLY      = 0x02;
const ENIG_CREATE_FILE = 0x08;
const ENIG_TRUNCATE    = 0x20;
const ENIG_DEFAULT_FILE_PERMS = 0600;


function EnigCreateFileStream(filePath, permissions) {
  //DEBUG_LOG("enigmailCommon.js: EnigCreateFileStream: file="+filePath+"\n");

  try {
    var localFile = ENIG_C.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(ENIG_C.interfaces.nsILocalFile);

    localFile.initWithPath(filePath);

    if (localFile.exists()) {

      if (localFile.isDirectory() || !localFile.isWritable())
         throw ENIG_C.results.NS_ERROR_FAILURE;

      if (!permissions)
        permissions = localFile.permissions;
    }

    if (!permissions)
      permissions = ENIG_DEFAULT_FILE_PERMS;

    var flags = ENIG_WRONLY | ENIG_CREATE_FILE | ENIG_TRUNCATE;

    var fileStream = ENIG_C.classes[ENIG_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(ENIG_C.interfaces.nsIFileOutputStream);

    fileStream.init(localFile, flags, permissions, 0);

    return fileStream;

  } catch (ex) {
    ERROR_LOG("enigmailCommon.js: EnigCreateFileStream: Failed to create "+filePath+"\n");
    return null;
  }
}

function EnigWriteFileContents(filePath, data, permissions) {

  //DEBUG_LOG("enigmailCommon.js: EnigWriteFileContents: file="+filePath+"\n");

  try {
    var fileOutStream = EnigCreateFileStream(filePath, permissions);

    if (data.length) {
      if (fileOutStream.write(data, data.length) != data.length)
        throw ENIG_C.results.NS_ERROR_FAILURE;

      fileOutStream.flush();
    }
    fileOutStream.close();

  } catch (ex) {
    ERROR_LOG("enigmailCommon.js: EnigWriteFileContents: Failed to write to "+filePath+"\n");
    return false;
  }

  return true;
}

// maxBytes == -1 => read everything
function EnigReadURLContents(url, maxBytes) {
  DEBUG_LOG("enigmailCommon.js: EnigReadURLContents: url="+url+
            ", "+maxBytes+"\n");

  var ioServ = enigGetService(ENIG_IOSERVICE_CONTRACTID, "nsIIOService");
  if (!ioServ)
    throw ENIG_C.results.NS_ERROR_FAILURE;

  var fileChannel = ioServ.newChannel(url, null, null)

  var rawInStream = fileChannel.open();

  var scriptableInStream = ENIG_C.classes[ENIG_SCRIPTABLEINPUTSTREAM_CONTRACTID].createInstance(ENIG_C.interfaces.nsIScriptableInputStream);
  scriptableInStream.init(rawInStream);

  var available = scriptableInStream.available()
  if ((maxBytes < 0) || (maxBytes > available))
    maxBytes = available;

  var urlContents = scriptableInStream.read(maxBytes);

  scriptableInStream.close();

  return urlContents;
}

// maxBytes == -1 => read whole file
function EnigReadFileContents(localFile, maxBytes) {

  DEBUG_LOG("enigmailCommon.js: EnigReadFileContents: file="+localFile.leafName+
            ", "+maxBytes+"\n");

  if (!localFile.exists() || !localFile.isReadable())
    throw ENIG_C.results.NS_ERROR_FAILURE;

  var ioServ = enigGetService(ENIG_IOSERVICE_CONTRACTID, "nsIIOService");
  if (!ioServ)
    throw ENIG_C.results.NS_ERROR_FAILURE;

  var fileURI = ioServ.newFileURI(localFile);
  return EnigReadURLContents(fileURI.asciiSpec, maxBytes);

}

///////////////////////////////////////////////////////////////////////////////

function WRITE_LOG(str) {
  function f00(val, digits) {
    return ("0000"+val.toString()).substr(-digits);
  }

  var d = new Date();
  var datStr=d.getFullYear()+"-"+f00(d.getMonth()+1, 2)+"-"+f00(d.getDate(),2)+" "+f00(d.getHours(),2)+":"+f00(d.getMinutes(),2)+":"+f00(d.getSeconds(),2)+"."+f00(d.getMilliseconds(),3)+" ";
  if (gEnigLogLevel >= 4)
    dump(datStr+str);

  if (gEnigDebugLog && gEnigmailSvc && gEnigmailSvc.logFileStream) {
    gEnigmailSvc.logFileStream.write(datStr, datStr.length);
    gEnigmailSvc.logFileStream.write(str, str.length);
  }
}

function DEBUG_LOG(str) {
  if (gEnigLogLevel >= 4)
    WRITE_LOG("[DEBUG] "+str);
}

function WARNING_LOG(str) {
  if (gEnigLogLevel >= 3)
    WRITE_LOG("[WARN] "+str);
}

function ERROR_LOG(str) {
  try {
    var consoleSvc = Components.classes["@mozilla.org/consoleservice;1"].
        getService(Components.interfaces.nsIConsoleService);

    var scriptError = Components.classes["@mozilla.org/scripterror;1"]
                                .createInstance(Components.interfaces.nsIScriptError);
    scriptError.init(str, null, null, 0,
                     0, scriptError.errorFlag, "Enigmail");
    consoleSvc.logMessage(scriptError);

  }
  catch (ex) {}

  if (gEnigLogLevel >= 2)
    WRITE_LOG("[ERROR] "+str);
}

function CONSOLE_LOG(str) {
  if (gEnigLogLevel >= 3)
    WRITE_LOG("[CONSOLE] "+str);

  if (gEnigmailSvc && gEnigmailSvc.console)
    gEnigmailSvc.console.write(str);
}


// write exception information
function EnigWriteException(referenceInfo, ex) {
  ERROR_LOG(referenceInfo+": caught exception: "
            +ex.name+"\n"
            +"Message: '"+ex.message+"'\n"
            +"File:    "+ex.fileName+"\n"
            +"Line:    "+ex.lineNumber+"\n"
            +"Stack:   "+ex.stack+"\n");
}

///////////////////////////////////////////////////////////////////////////////

function EnigAlert(mesg) {
  gEnigPromptSvc.alert(window, EnigGetString("enigAlert"), mesg);
}

/**
 * Displays an alert dialog with 3-4 optional buttons.
 * prefName: if not null, display checkbox "don't show again", linked to the prefName preference
 * button-Labels: use "&" to indicate access key
 *     use "buttonType:label" or ":buttonType" to indicate special button types
 *        (buttonType is one of cancel, help, extra1, extra2)
 * return: 0-2: button Number pressed
 *          -1: ESC or close window button pressed
 *
 */
function EnigLongAlert(mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj) {
  var result = {
    value: -1,
    checked: false
  };
  window.openDialog("chrome://enigmail/content/enigmailAlertDlg.xul", "",
            "chrome,centerscreen,modal",
            {msgtext: mesg, checkboxLabel: checkBoxLabel, button1: okLabel, button2: labelButton2, button3: labelButton3},
            result);

  if (checkBoxLabel) {
    checkedObj.value=result.checked
  }
  return result.value;
}

function EnigAlertCount(countPrefName, mesg) {
  var alertCount = EnigGetPref(countPrefName);

  if (alertCount <= 0)
    return;

  alertCount--;
  EnigSetPref(countPrefName, alertCount);

  if (alertCount > 0) {
    mesg += EnigGetString("repeatPrefix",alertCount) + " ";
    mesg += (alertCount == 1) ? EnigGetString("repeatSuffixSingular") : EnigGetString("repeatSuffixPlural");
  } else {
    mesg += EnigGetString("noRepeat");
  }

  EnigAlert(mesg);
}

function EnigAlertPref(mesg, prefText) {
  const display = true;
  const dontDisplay = false;

  var prefValue = EnigGetPref(prefText);
  if (prefValue == display) {
    var checkBoxObj = { value: false } ;
    var buttonPressed = gEnigPromptSvc.confirmEx(window,
                          EnigGetString("enigAlert"),
                          mesg,
                          (gEnigPromptSvc.BUTTON_TITLE_OK * ENIG_BUTTON_POS_0),
                          null, null, null,
                          EnigGetString("dlgNoPrompt"), checkBoxObj);
    if (checkBoxObj.value && buttonPressed==0) {
      EnigSetPref(prefText, dontDisplay);
    }
  }
}

// Confirmation dialog with OK / Cancel buttons (both customizable)
function EnigConfirm(mesg, okLabel, cancelLabel) {
  var dummy=new Object();

  var buttonTitles = 0;
  if (okLabel == null && cancelLabel == null) {
    buttonTitles = (gEnigPromptSvc.BUTTON_TITLE_YES * ENIG_BUTTON_POS_0) +
                   (gEnigPromptSvc.BUTTON_TITLE_NO * ENIG_BUTTON_POS_1);
  }
  else {
    if (okLabel != null) {
      buttonTitles += (gEnigPromptSvc.BUTTON_TITLE_IS_STRING * gEnigPromptSvc.BUTTON_POS_0);
    }
    else {
      buttonTitles += gEnigPromptSvc.BUTTON_TITLE_OK * ENIG_BUTTON_POS_0;
    }

    if (cancelLabel != null) {
      buttonTitles += (gEnigPromptSvc.BUTTON_TITLE_IS_STRING * gEnigPromptSvc.BUTTON_POS_1);
    }
    else {
      buttonTitles += gEnigPromptSvc.BUTTON_TITLE_CANCEL * ENIG_BUTTON_POS_1;
    }
  }

  var buttonPressed = gEnigPromptSvc.confirmEx(window,
                        EnigGetString("enigConfirm"),
                        mesg,
                        buttonTitles,
                        okLabel, cancelLabel, null,
                        null, dummy);

  return (buttonPressed == 0);
}


function EnigConfirmPref(mesg, prefText, okLabel, cancelLabel) {
  const notSet = 0;
  const yes = 1;
  const no = 2;
  const display = true;
  const dontDisplay = false;

  var buttonTitles = 0;
  if (okLabel == null && cancelLabel == null) {
    buttonTitles = (gEnigPromptSvc.BUTTON_TITLE_YES * ENIG_BUTTON_POS_0) +
                   (gEnigPromptSvc.BUTTON_TITLE_NO * ENIG_BUTTON_POS_1);
  }
  else {
    if (okLabel != null) {
      buttonTitles += (gEnigPromptSvc.BUTTON_TITLE_IS_STRING * gEnigPromptSvc.BUTTON_POS_0);
    }
    else {
      buttonTitles += gEnigPromptSvc.BUTTON_TITLE_OK * ENIG_BUTTON_POS_0;
    }

    if (cancelLabel != null) {
      buttonTitles += (gEnigPromptSvc.BUTTON_TITLE_IS_STRING * gEnigPromptSvc.BUTTON_POS_1);
    }
    else {
      buttonTitles += gEnigPromptSvc.BUTTON_TITLE_CANCEL * ENIG_BUTTON_POS_1;
    }
  }

  var prefValue = EnigGetPref(prefText);

  if (typeof(prefValue) != "boolean") {
    // number: remember user's choice
    switch (prefValue) {
    case notSet:
      var checkBoxObj = { value: false} ;
      var buttonPressed = gEnigPromptSvc.confirmEx(window,
                            EnigGetString("enigConfirm"),
                            mesg,
                            buttonTitles,
                            okLabel, cancelLabel, null,
                            EnigGetString("dlgKeepSetting"), checkBoxObj);
      if (checkBoxObj.value) {
        EnigSetPref(prefText, (buttonPressed==0 ? yes : no));
      }
      return (buttonPressed==0 ? 1 : 0);

    case yes:
      return 1;

    case no:
      return 0;

    default:
      return -1;
    }
  }
  else {
    // boolean: "do not show this dialog anymore" (and return default)
    switch (prefValue) {
    case display:
      var checkBoxObj = { value: false} ;
      var buttonPressed = gEnigPromptSvc.confirmEx(window,
                            EnigGetString("enigConfirm"),
                            mesg,
                            buttonTitles,
                            okLabel, cancelLabel, null,
                            EnigGetString("dlgNoPrompt"), checkBoxObj);
      if (checkBoxObj.value) {
        EnigSetPref(prefText, false);
      }
      return (buttonPressed==0 ? 1 : 0);

    case dontDisplay:
      return 1;

    default:
      return -1;
    }

  }
}

function EnigError(mesg) {
  return gEnigPromptSvc.alert(window, EnigGetString("enigError"), mesg);
}

function EnigPromptValue(mesg, valueObj) {
  var checkObj = new Object();
  return gEnigPromptSvc.prompt(window, EnigGetString("enigPrompt"),
                               mesg, valueObj, "", checkObj);
}

function EnigOverrideAttribute(elementIdList, attrName, prefix, suffix) {
  for (var index = 0; index < elementIdList.length; index++) {
    var elementId = elementIdList[index];
    var element = document.getElementById(elementId);
    if (element) {
      try {
        var oldValue = element.getAttribute(attrName);
        var newValue = prefix+elementId+suffix;

        //DEBUG_LOG("enigmailCommon.js: *** overriding id="+ elementId+" "+attrName+"="+oldValue+" with "+newValue+"\n");

        element.setAttribute(attrName, newValue);
      } catch (ex) {}
    } else {
      DEBUG_LOG("enigmailCommon.js: *** UNABLE to override id="+ elementId+"\n");
    }
  }
}


function EnigPrefWindow(showBasic, clientType, selectTab) {
  DEBUG_LOG("enigmailCommon.js: EnigPrefWindow\n");

  GetEnigmailSvc();
  if (showBasic && clientType == "seamonkey" && selectTab==null) {
    // Open the seamonkey pref window
    goPreferences("securityItem",
                  "chrome://enigmail/content/pref-enigmail.xul",
                  "enigmail");
  }
  else {
    // open the normal pref window
    window.openDialog("chrome://enigmail/content/pref-enigmail.xul",
                      "_blank", "chrome,resizable=yes",
                      {'showBasic': showBasic,
                      'clientType': clientType,
                      'selectTab': selectTab});
  }
}

function EnigAdvPrefWindow() {
  EnigAlert("This function doesn't exist anymore!");
}

function EnigHelpWindow(source) {

  EnigOpenWin("enigmail:help",
              "chrome://enigmail/content/enigmailHelp.xul?src="+source,
              "centerscreen,resizable");
}


function EnigDisplayRadioPref(prefName, prefValue, optionElementIds) {
  DEBUG_LOG("enigmailCommon.js: EnigDisplayRadioPref: "+prefName+", "+prefValue+"\n");

  if (prefValue >= optionElementIds.length)
    return;

  var groupElement = document.getElementById("enigmail_"+prefName);
  var optionElement = document.getElementById(optionElementIds[prefValue]);

  if (groupElement && optionElement) {
    groupElement.selectedItem = optionElement;
    groupElement.value = prefValue;
  }
}

function EnigSetRadioPref(prefName, optionElementIds) {
  DEBUG_LOG("enigmailCommon.js: EnigSetRadioPref: "+prefName+"\n");

  try {
    var groupElement = document.getElementById("enigmail_"+prefName);
    if (groupElement) {
      var optionElement = groupElement.selectedItem;
      var prefValue = optionElement.value;
      if (prefValue < optionElementIds.length) {
        EnigSetPref(prefName, prefValue);
        groupElement.value = prefValue;
      }
    }
  }
  catch (ex) {}
}

function EnigSetDefaultPrefs() {
  DEBUG_LOG("enigmailCommon.js: EnigSetDefaultPrefs\n");
  // has become obsolete
}

function EnigSavePrefs() {
  DEBUG_LOG("enigmailCommon.js: EnigSavePrefs\n");
  try {
    gEnigPrefSvc.savePrefFile(null);
  } catch (ex) {
  }
}

function EnigGetPref(prefName) {
   var prefValue = null;
   try {
      var prefType = gPrefEnigmail.getPrefType(prefName);
      // Get pref value
      switch (prefType) {
      case gPrefEnigmail.PREF_BOOL:
         prefValue = gPrefEnigmail.getBoolPref(prefName);
         break;

      case gPrefEnigmail.PREF_INT:
         prefValue = gPrefEnigmail.getIntPref(prefName);
         break;

      case gPrefEnigmail.PREF_STRING:
         prefValue = gPrefEnigmail.getCharPref(prefName);
         break;

      default:
         prefValue = undefined;
         break;
     }

   } catch (ex) {
      // Failed to get pref value
      ERROR_LOG("enigmailCommon.js: EnigGetPref: unknown prefName:"+prefName+" \n");
   }

   return prefValue;
}

function EnigGetDefaultPref(prefName) {
  DEBUG_LOG("enigmailCommon.js: EnigGetDefaultPref: prefName="+prefName+"\n");
  var prefValue=null;
  try {
    gPrefEnigmail.lockPref(prefName);
    prefValue = EnigGetPref(prefName);
    gPrefEnigmail.unlockPref(prefName);
  }
  catch (ex) {}

  return prefValue;
}

function EnigSetPref(prefName, value) {
   DEBUG_LOG("enigmailCommon.js: EnigSetPref: "+prefName+", "+value+"\n");
   var prefType;
   try {
     prefType = gPrefEnigmail.getPrefType(prefName);
   }
   catch (ex) {
     switch (typeof value) {
       case "boolean":
         prefType = gPrefEnigmail.PREF_BOOL;
         break;
       case "integer":
         prefType = gPrefEnigmail.PREF_INT;
         break;
       case "string":
         prefType = gPrefEnigmail.PREF_STRING;
         break;
       default:
         prefType = 0;
         break;
     }
   }
   var retVal = false;

   switch (prefType) {
      case gPrefEnigmail.PREF_BOOL:
         gPrefEnigmail.setBoolPref(prefName, value);
         retVal = true;
         break;

      case gPrefEnigmail.PREF_INT:
         gPrefEnigmail.setIntPref(prefName, value);
         retVal = true;
         break;

      case gPrefEnigmail.PREF_STRING:
         gPrefEnigmail.setCharPref(prefName, value);
         retVal = true;
         break;

      default:
         break;
   }

   return retVal;
}

function EnigGetSignMsg(identity) {
  DEBUG_LOG("enigmailCommon.js: EnigGetSignMsg: identity.key="+identity.key+"\n");
  var sign = null;

  if (gEnigPrefRoot.getPrefType("mail.identity."+identity.key+".pgpSignPlain")==0) {
    if (gEnigPrefRoot.getPrefType("mail.identity."+identity.key+".pgpSignMsg")==0) {
      sign=identity.getBoolAttribute("pgpAlwaysSign");
      identity.setBoolAttribute("pgpSignEncrypted", sign);
      identity.setBoolAttribute("pgpSignPlain", sign);
    }
    else {
      sign = identity.getIntAttribute("pgpSignMsg");
      identity.setBoolAttribute("pgpSignEncrypted", sign==1);
      identity.setBoolAttribute("pgpSignPlain", sign>0);
    }
    gEnigPrefRoot.deleteBranch("mail.identity."+identity.key+".pgpSignMsg");
    gEnigPrefRoot.deleteBranch("mail.identity."+identity.key+".pgpAlwaysSign");
  }

}

function EnigRequestObserver(terminateFunc, terminateArg)
{
  this._terminateFunc = terminateFunc;
  this._terminateArg = terminateArg;
}

EnigRequestObserver.prototype = {

  _terminateFunc: null,
  _terminateArg: null,

  QueryInterface: function (iid) {
    if (!iid.equals(ENIG_C.interfaces.nsIRequestObserver) &&
        !iid.equals(ENIG_C.interfaces.nsISupports))
      throw ENIG_C.results.NS_ERROR_NO_INTERFACE;
    return this;
  },

  onStartRequest: function (channel, ctxt)
  {
    DEBUG_LOG("enigmailCommon.js: EnigRequestObserver.onStartRequest\n");
  },

  onStopRequest: function (channel, ctxt, status)
  {
    DEBUG_LOG("enigmailCommon.js: EnigRequestObserver.onStopRequest: "+ctxt+"\n");
    this._terminateFunc(this._terminateArg, ctxt);
  }
}


function EnigConvertFromUnicode(text, charset) {
  DEBUG_LOG("enigmailCommon.js: EnigConvertFromUnicode: "+charset+"\n");

  if (!text)
    return "";

  if (! charset) charset="utf-8";

  // Encode plaintext
  try {
    var unicodeConv = ENIG_C.classes[ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(ENIG_C.interfaces.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertFromUnicode(text);

  } catch (ex) {
    DEBUG_LOG("enigmailCommon.js: EnigConvertFromUnicode: caught an exception\n");

    return text;
  }
}


function EnigConvertToUnicode(text, charset) {
  // DEBUG_LOG("enigmailCommon.js: EnigConvertToUnicode: "+charset+"\n");

  if (!text || !charset /*|| (charset.toLowerCase() == "iso-8859-1")*/)
    return text;

  // Encode plaintext
  try {
    var unicodeConv = ENIG_C.classes[ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(ENIG_C.interfaces.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertToUnicode(text);

  } catch (ex) {
    DEBUG_LOG("enigmailCommon.js: EnigConvertToUnicode: caught an exception while converting'"+text+"' to "+charset+"\n");
    return text;
  }
}

function EnigConvertGpgToUnicode(text) {
  if (typeof(text)=="string") {
    text = text.replace(/\\x3a/ig, "\\e3A");
    a=text.search(/\\x[0-9a-fA-F]{2}/);
    while (a>=0) {
        ch=unescape('%'+text.substr(a+2,2));
        r= new RegExp("\\"+text.substr(a,4));
        text=text.replace(r, ch);

        a=text.search(/\\x[0-9a-fA-F]{2}/);
    }

    text = EnigConvertToUnicode(text, "utf-8").replace(/\\e3A/g, ":");
  }

  return text;
}

function EnigFormatFpr(fingerprint) {
  // format key fingerprint
  DEBUG_LOG("enigmailCommon.js: EnigFormatFpr: fingerprint="+fingerprint+"\n");

  var r="";
  var fpr = fingerprint.match(/(....)(....)(....)(....)(....)(....)(....)(....)(....)?(....)?/);
  if (fpr && fpr.length > 2) {
    fpr.shift();
    r=fpr.join(" ");
  }

  return r;
}


function EnigGetDeepText(node, findStr) {

  DEBUG_LOG("enigmailCommon.js: EnigDeepText: <" + node.tagName + ">, '"+findStr+"'\n");

  if (findStr) {
    if (node.innerHTML.replace(/&nbsp;/g, " ").indexOf(findStr) < 0) {
      // exit immediately if findStr is not found at all
      return "";
    }
  }

  // EnigDumpHTML(node);

  var plainText = EnigParseChildNodes(node);
  // Replace non-breaking spaces with plain spaces
  plainText = plainText.replace(/\xA0/g," ");

  if (findStr) {
     if (plainText.indexOf(findStr) < 0) {
        return "";
     }
  }

  return plainText;

}

// extract the plain text by iterating recursively through all nodes
function EnigParseChildNodes(node) {

  var plainText="";

  if (node.nodeType == Node.TEXT_NODE) {
    // text node
    plainText = plainText.concat(node.data);
  }
  else {

    if (node.nodeType == Node.ELEMENT_NODE) {
      if (node.tagName=="IMG" && node.className=="moz-txt-smily") {
        // get the "alt" part of graphical smileys to ensure correct
        // verification of signed messages
        if (node.getAttribute("alt")) {
            plainText = plainText.concat(node.getAttribute("alt"));
        }
      }
    }

    var child = node.firstChild;
    // iterate over child nodes
    while (child) {
      if (! (child.nodeType == Node.ELEMENT_NODE &&
            child.tagName == "BR" &&
            ! child.hasChildNodes())) {
        // optimization: don't do an extra loop for the very frequent <BR> elements
        plainText = plainText.concat(EnigParseChildNodes(child));
      }
      child = child.nextSibling;
    }
  }

  return plainText;
}


// Dump HTML content as plain text
function EnigDumpHTML(node)
{
    var type = node.nodeType;
    if (type == Node.ELEMENT_NODE) {

        // open tag
        DEBUG_LOG("<" + node.tagName)

        // dump the attributes if any
        attributes = node.attributes;
        if (null != attributes) {
            var countAttrs = attributes.length;
            var index = 0
            while(index < countAttrs) {
                att = attributes[index];
                if (null != att) {
                    DEBUG_LOG(" "+att.name+"='"+att.value+"'")
                }
                index++
            }
        }

        // close tag
        DEBUG_LOG(">")

        // recursively dump the children
        if (node.hasChildNodes()) {
            // get the children
            var children = node.childNodes;
            var length = children.length;
            var count = 0;
            while(count < length) {
                var child = children[count]
                EnigDumpHTML(child)
                count++
            }
            DEBUG_LOG("</" + node.tagName + ">");
        }


    }
    // if it's a piece of text just dump the text
    else if (type == Node.TEXT_NODE) {
        DEBUG_LOG(node.data)
    }
}

/////////////////////////
// Console stuff
/////////////////////////


function EnigClearPassphrase() {
  DEBUG_LOG("enigmailCommon.js: EnigClearPassphrase: \n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (enigmailSvc.useGpgAgent()) {
    EnigAlert(EnigGetString("passphraseCannotBeCleared"))
  }
  else {
    enigmailSvc.clearCachedPassphrase();
    EnigAlertPref(EnigGetString("passphraseCleared"), "warnClearPassphrase");
  }
}

function EnigOpenWin (winName, spec, winOptions, optList) {
  var windowManager = ENIG_C.classes[ENIG_APPSHELL_MEDIATOR_CONTRACTID].getService(ENIG_C.interfaces.nsIWindowMediator);

  /* according to the docs, this doesn't seem to work ...
    var recentWin = windowManager.getMostRecentWindow(winName);
  */
  var winEnum=windowManager.getEnumerator(null);
  var recentWin=null;
  while (winEnum.hasMoreElements() && ! recentWin) {
    var thisWin = winEnum.getNext();
    if (thisWin.location.href==spec) {
      recentWin = thisWin;
    }
  }

  if (recentWin) {
    recentWin.focus();
  } else {
    var appShellSvc = ENIG_C.classes[ENIG_ASS_CONTRACTID].getService(ENIG_C.interfaces.nsIAppShellService);
    var domWin = appShellSvc.hiddenDOMWindow;
    //nsIDOMJSWindow
    domWin.open(spec, winName, "chrome,"+winOptions, optList);
  }
}

// return the options passed to a window
function EnigGetWindowOptions() {
  var winOptions=[];
  if (window.location.search) {
    var optList=window.location.search.substr(1).split(/\&/);
    for (var i=0; i<optList.length; i++) {
      var anOption=optList[i].split(/\=/);
      winOptions[anOption[0]] = unescape(anOption[1]);
    }
  }
  return winOptions;
}

function EnigViewAbout() {
  DEBUG_LOG("enigmailCommon.js: EnigViewAbout\n");

  EnigOpenWin ("about:enigmail",
               "chrome://enigmail/content/enigmailAbout.xul",
               "resizable,centerscreen");
}

function EnigViewConsole() {
  DEBUG_LOG("enigmailCommon.js: EnigViewConsole\n");

  EnigOpenWin("enigmail:console",
              "chrome://enigmail/content/enigmailConsole.xul",
              "resizable,centerscreen");
}

function EnigViewDebugLog() {
  DEBUG_LOG("enigmailCommon.js: EnigViewDebugLog\n");

  var logDirectory = EnigGetPref("logDirectory");

  if (!logDirectory) {
    EnigAlert(EnigGetString("noLogDir"));
    return;
  }

  if (!gEnigmailSvc) {
    EnigAlert(EnigGetString("noLogFile"));
    return;
  }

  if (!gEnigmailSvc.logFileStream) {
    EnigAlert(EnigGetString("restartForLog"));
    return;
  }

  gEnigmailSvc.logFileStream.flush();

  logDirectory = logDirectory.replace(/\\/g, "/");

  var logFileURL = "file:///" + logDirectory + "/enigdbug.txt";
  var opts="fileUrl="+escape(logFileURL)+"&title="+escape("Enigmail Debug Log");

  EnigOpenWin("enigmail:logFile",
              "chrome://enigmail/content/enigmailViewFile.xul?"+opts,
              "resizable,centerscreen");

//  window.open(logFileURL, 'Enigmail Debug Log');
}

function EnigKeygen() {
  DEBUG_LOG("enigmailCommon.js: EnigKeygen\n");

  window.open('chrome://enigmail/content/enigmailKeygen.xul',
                    "enigmail:generateKey",
                    'chrome,dialog,modal,resizable=yes');

}

function EnigKeyManager() {
  DEBUG_LOG("enigmailCommon.js: EnigKeygen\n");
  GetEnigmailSvc();
  EnigOpenWin("enigmail:KeyManager",
              "chrome://enigmail/content/enigmailKeyManager.xul",
              "resizable");
}


function EnigLaunchFile(fileName) {
  try {
    var mimeService = Components.classes[ENIG_MIME_CONTRACTID].getService(Components.interfaces.nsIMIMEService);
    var fileMimeType = mimeService.getTypeFromFile(fileName);
    var fileMimeInfo = mimeService.getFromTypeAndExtension(fileMimeType, fileExt);

    fileMimeInfo.launchWithFile(fileName);
  }
  catch (ex) {
    // if the attachment file type is unknown, an exception is thrown,
    // so let it be handled by a browser window
    enigLoadExternalURL(outFileUri.asciiSpec);
  }
}

// retrieves the most recent navigator window (opens one if need be)
function EnigLoadURLInNavigatorWindow(url, aOpenFlag)
{
  DEBUG_LOG("enigmailCommon.js: EnigLoadURLInNavigatorWindow: "+url+", "+aOpenFlag+"\n");

  var navWindow;

  // if this is a browser window, just use it
  if ("document" in top) {
    var possibleNavigator = top.document.getElementById("main-window");
    if (possibleNavigator &&
        possibleNavigator.getAttribute("windowtype") == "navigator:browser")
      navWindow = top;
  }

  // if not, get the most recently used browser window
  if (!navWindow) {
    var wm;
    wm = ENIG_C.classes[ENIG_APPSHELL_MEDIATOR_CONTRACTID].getService(ENIG_C.interfaces.nsIWindowMediator);
    navWindow = wm.getMostRecentWindow("navigator:browser");
  }

  if (navWindow) {

    if ("loadURI" in navWindow)
      navWindow.loadURI(url);
    else
      navWindow._content.location.href = url;

  } else if (aOpenFlag) {
    // if no browser window available and it's ok to open a new one, do so
    navWindow = window.open(url, "Enigmail");
  }

  DEBUG_LOG("enigmailCommon.js: EnigLoadURLInNavigatorWindow: navWindow="+navWindow+"\n");

  return navWindow;
}

// retrieves a localized string from the enigmail.properties stringbundle
function EnigGetString(aStr) {
  var restCount = arguments.length - 1;
  if(!gEnigStrBundle) {
    try {
      var strBundleService = ENIG_C.classes[ENIG_STRINGBUNDLE_CONTRACTID].getService();
      strBundleService = strBundleService.QueryInterface(nsIEnigStrBundle);
      gEnigStrBundle = strBundleService.createBundle("chrome://enigmail/locale/enigmail.properties");
    } catch (ex) {
      ERROR_LOG("enigmailCommon.js: Error in instantiating stringBundleService\n");
    }
  }
  if(gEnigStrBundle) {
    try {
      if(restCount > 0) {
        var subPhrases = new Array();
        for (var i = 1; i < arguments.length; i++) {
          subPhrases.push(arguments[i]);
        }
        return gEnigStrBundle.formatStringFromName(aStr, subPhrases, subPhrases.length);
      }
      else {
        return gEnigStrBundle.GetStringFromName(aStr);
      }
    } catch (ex) {
      ERROR_LOG("enigmailCommon.js: Error in querying stringBundleService for string '"+aStr+"'\n");
    }
  }
  return null;
}

// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email addresses
function EnigStripEmail(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       ERROR_LOG("enigmailMsgComposeOverlay.js: EnigStripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
       throw ENIG_C.results.NS_ERROR_FAILURE;
     }

     mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
  }

  // Eliminate all whitespace, just to be safe
  mailAddrs = mailAddrs.replace(/\s+/g,"");

  // Extract pure e-mail address list (stripping out angle brackets)
  mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

  return mailAddrs;
}


//get path for temporary directory (e.g. /tmp, C:\TEMP)
function EnigGetTempDir() {
  var tmpDir;

  try {
    var ds = ENIG_C.classes[ENIG_DIRSERVICE_CONTRACTID].getService();
    var dsprops = ds.QueryInterface(ENIG_C.interfaces.nsIProperties);
    var tmpDirComp = dsprops.get(ENIG_TEMPDIR_PROP, ENIG_C.interfaces.nsILocalFile);
    tmpDir=tmpDirComp.path;
  }
  catch (ex) {
    // let's guess ...
    if (EnigGetOS() == "WINNT") {
      tmpDir="C:\\TEMP";
    } else {
      tmpDir="/tmp";
    }
  }
  return tmpDir;
}

// get the OS platform
function EnigGetOS () {

  var xulAppinfo = ENIG_C.classes[ENIG_XPCOM_APPINFO].getService(ENIG_C.interfaces.nsIXULRuntime);
  return xulAppinfo.OS;

}

function EnigGetVersion() {
  DEBUG_LOG("enigmailCommon.js: EnigGetVersion\n");

  var addonVersion = "?";
  try {
    // Gecko 1.9.x
    addonVersion = Components.classes["@mozilla.org/extensions/manager;1"].
      getService(Components.interfaces.nsIExtensionManager).
      getItemForID(ENIG_EXTENSION_GUID).version
  }
  catch (ex) {
    // Gecko 2.0
    addonVersion = gEnigExtensionVersion;
  }

  DEBUG_LOG("enigmailCommon.js: installed version: "+addonVersion+"\n");
  return addonVersion;
}

function EnigDisplayPrefs(showDefault, showPrefs, setPrefs) {
  DEBUG_LOG("enigmailCommon.js: EnigDisplayPrefs\n");

  var obj = new Object;
  var prefList = gPrefEnigmail.getChildList("",obj);

  for (var prefItem in prefList) {
    var prefName=prefList[prefItem];
    var prefElement = document.getElementById("enigmail_"+prefName);

    if (prefElement) {
      var prefType = gPrefEnigmail.getPrefType(prefName);
      var prefValue;
      if (showDefault) {
        prefValue = EnigGetDefaultPref(prefName);
      }
      else {
        prefValue = EnigGetPref(prefName);
      }

      DEBUG_LOG("enigmailCommon.js: EnigDisplayPrefs: "+prefName+"="+prefValue+"\n");

      switch (prefType) {
      case gPrefEnigmail.PREF_BOOL:
        if (showPrefs) {
          if (prefElement.getAttribute("invert") == "true") {
            prefValue = ! prefValue;
          }

          if (prefValue) {
            prefElement.setAttribute("checked", "true");
          } else {
            prefElement.removeAttribute("checked");
          }
        }

        if (setPrefs) {

          if (prefElement.getAttribute("invert") == "true") {
            if (prefElement.checked) {
              EnigSetPref(prefName, false);
            } else {
              EnigSetPref(prefName, true);
            }
          }
          else {
            if (prefElement.checked) {
              EnigSetPref(prefName, true);
            } else {
              EnigSetPref(prefName, false);
            }
          }
        }

        break;

      case gPrefEnigmail.PREF_INT:
        if (showPrefs)
          prefElement.value = prefValue;

        if (setPrefs) {
          try {
            EnigSetPref(prefName, 0+prefElement.value);
          } catch (ex) {}
        }
        break;

      case gPrefEnigmail.PREF_STRING:
        if (showPrefs)
          prefElement.value = prefValue;
        if (setPrefs)
          EnigSetPref(prefName, prefElement.value);
        break;

      default:
        DEBUG_LOG("enigmailCommon.js: EnigDisplayPrefs: "+prefName+" does not have a type?!\n");
      }
    }
  }
}

function EnigFilePicker(title, displayDir, save, defaultExtension, defaultName, filterPairs) {
  DEBUG_LOG("enigmailCommon.js: EnigFilePicker: "+save+"\n");

  const nsIFilePicker = ENIG_C.interfaces.nsIFilePicker;
  var filePicker = ENIG_C.classes["@mozilla.org/filepicker;1"].createInstance();
  filePicker = filePicker.QueryInterface(nsIFilePicker);

  var mode = save ? nsIFilePicker.modeSave : nsIFilePicker.modeOpen;

  filePicker.init(window, title, mode);

  if (displayDir) {
    var localFile = ENIG_C.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(ENIG_C.interfaces.nsILocalFile);

    try {
      localFile.initWithPath(displayDir);
      filePicker.displayDirectory = localFile;
    } catch (ex) {
    }
  }

  if (defaultExtension)
    filePicker.defaultExtension = defaultExtension;

  if (defaultName)
    filePicker.defaultString=defaultName;

  var nfilters = 0;
  if (filterPairs && filterPairs.length)
    nfilters = filterPairs.length / 2;

  for (var index=0; index < nfilters; index++) {
    filePicker.appendFilter(filterPairs[2*index], filterPairs[2*index+1]);
  }

  filePicker.appendFilters(nsIFilePicker.filterAll);

  if (filePicker.show() == nsIFilePicker.returnCancel)
    return null;

  var file = filePicker.file.QueryInterface(ENIG_C.interfaces.nsILocalFile);

  return file;
}

function EnigRulesEditor() {
  EnigOpenWin("enigmail:rulesEditor",
              "chrome://enigmail/content/enigmailRulesEditor.xul",
              "dialog,centerscreen,resizable");
}

function EnigOpenSetupWizard() {
  window.open("chrome://enigmail/content/enigmailSetupWizard.xul",
            "", "chrome,modal,centerscreen");
}

// get keys from keyserver
function EnigDownloadKeys(inputObj, resultObj) {
  DEBUG_LOG("enigmailCommon.js: EnigSearchKeys: searchList="+inputObj.searchList+"\n");

  resultObj.importedKeys=0;

  var ioService = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
  if (ioService && ioService.offline) {
    EnigAlert(EnigGetString("needOnline"));
    return;
  }

  var valueObj = {};
  if (inputObj.searchList) {
    valueObj = { keyId: "<"+inputObj.searchList.join("> <")+">" };
  }

  var keysrvObj = new Object();

  window.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
        "", "dialog,modal,centerscreen", valueObj, keysrvObj);
  if (! keysrvObj.value) {
    return;
  }

  inputObj.keyserver = keysrvObj.value;
  if (! inputObj.searchList) {
    inputObj.searchList = keysrvObj.email.split(/[,; ]+/);
  }

  window.openDialog("chrome://enigmail/content/enigmailSearchKey.xul",
        "", "dialog,modal,centerscreen", inputObj, resultObj);
}

// create new PGP Rule
function EnigNewRule(emailAddress) {
  // make sure the rules database is loaded
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;
   var rulesListObj= new Object;

  // open rule dialog
  enigmailSvc.getRulesData(rulesListObj);
  var inputObj=new Object;
  var resultObj=new Object;
  inputObj.toAddress="{"+emailAddress+"}";
  inputObj.options="";
  inputObj.command = "add";
  window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","",
                    "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  return true;
}

// Obtain kay list from GnuPG
function EnigObtainKeyList(secretOnly, refresh) {
  DEBUG_LOG("enigmailCommon.js: EnigObtainKeyList\n");

  try {
    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj = new Object();

    var enigmailSvc = GetEnigmailSvc();
    if (! enigmailSvc)
      return null;
    var userList = enigmailSvc.getUserIdList(secretOnly,
                                             refresh,
                                             exitCodeObj,
                                             statusFlagsObj,
                                             errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(errorMsgObj.value);
      return null;
    }
  } catch (ex) {
    ERROR_LOG("ERROR in enigmailCommon: EnigObtainKeyList\n");
  }

  if (typeof(userList) == "string") {
    return userList.split(/\n/);
  }
  else {
    return [];
  }
}

// Load the key list into memory
function EnigLoadKeyList(refresh, keyListObj) {
  DEBUG_LOG("enigmailCommon.js: EnigLoadKeyList\n");

  const TRUSTLEVEL_SORTED="oidre-qnmfu"; // trust level sorted by increasing level of trust

  var sortUsers = function (a, b) {
    if (a.userId.toLowerCase()<b.userId.toLowerCase()) { return -1; } else { return 1; }
  }

  var aGpgUserList = EnigObtainKeyList(false, refresh);
  if (!aGpgUserList) return;

  var aGpgSecretsList = EnigObtainKeyList(true, refresh);
  if (!aGpgSecretsList && !refresh) {
    if (EnigConfirm(EnigGetString("noSecretKeys"), EnigGetString("keyMan.button.generateKey"), EnigGetString("keyMan.button.skip"))) {
      EnigKeygen();
      EnigLoadKeyList(true, keyListObj);
    }
  }

  keyListObj.keyList = [];
  keyListObj.keySortList = [];

  var keyObj = new Object();
  var i;
  var uatNum=0; // counter for photos (counts per key)

  for (i=0; i<aGpgUserList.length; i++) {
    var listRow=aGpgUserList[i].split(/:/);
    if (listRow.length>=0) {
      switch (listRow[0]) {
      case "pub":
        keyObj = new Object();
        uatNum = 0;
        keyObj.expiry=EnigGetDateTime(listRow[ENIG_EXPIRY], true, false);
        keyObj.created=EnigGetDateTime(listRow[ENIG_CREATED], true, false);
        keyObj.keyId=listRow[ENIG_KEY_ID];
        keyObj.keyTrust=listRow[ENIG_KEY_TRUST];
        keyObj.keyUseFor=listRow[ENIG_KEY_USE_FOR];
        keyObj.ownerTrust=listRow[ENIG_OWNERTRUST];
        keyObj.SubUserIds=new Array();
        keyObj.fpr="";
        keyObj.photoAvailable=false;
        keyObj.secretAvailable=false;
        keyListObj.keyList[listRow[ENIG_KEY_ID]] = keyObj;
        break;
      case "fpr":
        keyObj.fpr=listRow[ENIG_USER_ID];
        break;
      case "uid":
        if (listRow[ENIG_USER_ID].length == 0) {
          listRow[ENIG_USER_ID] = "-";
        }
        if (typeof(keyObj.userId) != "string") {
          keyObj.userId=EnigConvertGpgToUnicode(listRow[ENIG_USER_ID]);
          keyListObj.keySortList.push({userId: keyObj.userId, keyId: keyObj.keyId});
          if (TRUSTLEVEL_SORTED.indexOf(listRow[ENIG_KEY_TRUST]) < TRUSTLEVEL_SORTED.indexOf(keyObj.keyTrust)) {
            // reduce key trust if primary UID is less trusted than public key
            keyObj.keyTrust = listRow[ENIG_KEY_TRUST];
          }
        }
        else {
          var subUserId = {
            userId: EnigConvertGpgToUnicode(listRow[ENIG_USER_ID]),
            keyTrust: listRow[ENIG_KEY_TRUST],
            type: "uid"
          }
          keyObj.SubUserIds.push(subUserId);
        }
        break;
      case "uat":
        if (listRow[ENIG_USER_ID].indexOf("1 ")==0) {
          var userId=EnigGetString("userAtt.photo");
          keyObj.SubUserIds.push({userId: userId,
                                  keyTrust:listRow[ENIG_KEY_TRUST],
                                  type: "uat",
                                  uatNum: uatNum});
          keyObj.photoAvailable=true;
          ++uatNum;
        }
      }
    }
  }

  // search and mark keys that have secret keys
  for (i=0; i<aGpgSecretsList.length; i++) {
     listRow=aGpgSecretsList[i].split(/:/);
     if (listRow.length>=0) {
       if (listRow[0] == "sec") {
         if (typeof(keyListObj.keyList[listRow[ENIG_KEY_ID]]) == "object") {
           keyListObj.keyList[listRow[ENIG_KEY_ID]].secretAvailable=true;
         }
       }
     }
  }

  keyListObj.keySortList.sort(sortUsers);
}

function EnigGetSecretKeys() {
  // return a sorted array containing objects of (valid, usable) secret keys.
  // @return: [ {name: <userId>, id: 0x1234ABCD, created: YYYY-MM-DD },  { ... } ]
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    window.close();
    return null;
  }
  var exitCodeObj = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj = new Object();
  var keyList=enigmailSvc.getUserIdList(true, false, exitCodeObj, statusFlagsObj, errorMsgObj);

  if (exitCodeObj.value != 0) {
    EnigAlert(errorMsgObj.value);
    window.close();
    return null;
  }

  var userList=keyList.split(/\n/);
  var secretKeyList = new Array();
  var secretKeyCreated = new Array();
  var i;
  var keyId = null;

  var keyId = null;
  var keys = [];
  for (i=0; i < userList.length; i++) {
    if (userList[i].substr(0,4) == "sec:") {
      var aLine=userList[i].split(/:/);
      keyId = aLine[4];
      secretKeyCreated[keyId] = EnigGetDateTime(aLine[5], true, false);
      secretKeyList.push(keyId);
    }
  }

  keyList = enigmailSvc.getKeyDetails(secretKeyList.join(" "), false);
  userList=keyList.split(/\n/);

  for (var i=0; i < userList.length; i++) {
    var aLine = userList[i].split(/:/);
    switch (aLine[0]) {
    case "pub":
      if (aLine[1] == "u") keyId = aLine[4]; // public key is ultimately trusted
      break;
    case "uid":
      if ((keyId != null) && (aLine[1] == 'u')) {
        // UID is valid and ultimately trusted
        keys.push({ name: EnigConvertGpgToUnicode(aLine[9]),
                    id: keyId,
                    created: secretKeyCreated[keyId]});
        keyId = null;
      }
    }
  }

  keys.sort(function(a,b) { return a.name == b.name ? (a.id < b.id ? -1 : 1) : (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1); });
  return keys;
}

function EnigEditKeyTrust(userIdArr, keyIdArr) {
  var inputObj = {
    keyId: keyIdArr,
    userId: userIdArr
  }
  var resultObj = { refresh: false };
  window.openDialog("chrome://enigmail/content/enigmailEditKeyTrustDlg.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  return resultObj.refresh;
}

function EnigDisplayKeyDetails(keyId, refresh) {
  var keyListObj = {};

  EnigLoadKeyList(refresh, keyListObj);

  var inputObj = {
    keyId:  keyId,
    keyListArr: keyListObj.keyList,
    secKey: keyListObj.keyList[ keyId ].secretAvailable
  };
  var resultObj = { refresh: false };
  window.openDialog("chrome://enigmail/content/enigmailKeyDetailsDlg.xul",
        "", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  if (resultObj.refresh) {
    enigmailRefreshKeys();
  }


}

function EnigSignKey(userId, keyId, signingKeyHint) {
  var inputObj = {
    keyId: keyId,
    userId: userId,
    signingKeyHint: signingKeyHint
  }
  var resultObj = { refresh: false };
  window.openDialog("chrome://enigmail/content/enigmailSignKeyDlg.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
  return resultObj.refresh;
}


function EnigChangeKeyPwd(keyId, userId) {
  var inputObj = {
    keyId: keyId,
    userId: userId
  };

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if (! enigmailSvc.useGpgAgent()) {
    window.openDialog("chrome://enigmail/content/enigmailChangePasswd.xul",
        "", "dialog,modal,centerscreen", inputObj);
  }
  else {
    // gpg-agent will handle everything
    var errorMsgObj = new Object();
    var r = enigmailSvc.changePassphrase(window, "0x"+keyId, "", "", errorMsgObj);


    if (r != 0) {
      EnigAlert(EnigGetString("changePassFailed")+"\n\n"+errorMsgObj.value);
    }
  }
}


function EnigRevokeKey(keyId, userId) {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;

  var userDesc="0x"+keyId.substr(-8,8)+" - "+userId;
  if (!EnigConfirm(EnigGetString("revokeKeyAsk", userDesc), EnigGetString("keyMan.button.revokeKey"))) return;

  var tmpDir=EnigGetTempDir();

  try {
    var revFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
    revFile.initWithPath(tmpDir);
    if (!(revFile.isDirectory() && revFile.isWritable())) {
      EnigAlert(EnigGetString("noTempDir"));
      return false;
    }
  }
  catch (ex) {}
  revFile.append("revkey.asc");
  revFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);

  var errorMsgObj = {};
  var r=enigmailSvc.genRevokeCert(window, "0x"+keyId, revFile.path, "0", "", errorMsgObj);
  if (r != 0) {
    revFile.remove(false);
    EnigAlert(EnigGetString("revokeKeyFailed")+"\n\n"+errorMsgObj.value);
    return false;
  }
  r = enigmailSvc.importKeyFromFile(window, revFile, errorMsgObj);
  revFile.remove(false);
  if (r != 0) {
    EnigAlert(EnigGetString("revokeKeyFailed")+"\n\n"+EnigConvertGpgToUnicode(errorMsgObj.value));
  }
  else {
    EnigAlert(EnigGetString("revokeKeyOk"));
  }
  return (r == 0);
}


function EnigShowPhoto(keyId, userId, photoNumber) {
  var enigmailSvc = GetEnigmailSvc();
  if (enigmailSvc) {
    if (photoNumber==null) photoNumber=0;
    var exitCodeObj = new Object();
    var errorMsgObj = new Object();
    var photoPath = enigmailSvc.showKeyPhoto("0x"+keyId, photoNumber, exitCodeObj, errorMsgObj);
    if (photoPath && exitCodeObj.value==0) {
      var photoFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
      photoFile.initWithPath(photoPath);
      if (! (photoFile.isFile() && photoFile.isReadable())) {
        EnigAlert("Photo path '"+photoPath+"' is not readable");
      }
      else {
        var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        var photoUri = ioServ.newFileURI(photoFile).spec;
        var argsObj = {
          photoUri: photoUri,
          userId: userId,
          keyId: keyId
        };
        window.openDialog("chrome://enigmail/content/enigmailDispPhoto.xul",photoUri, "chrome,modal=1,resizable=1,dialog=1,centerscreen", argsObj);
        try {
          // delete the photo file
          photoFile.remove(false);
        }
        catch (ex) {}
     }
    }
    else {
      EnigAlert(EnigGetString("noPhotoAvailable"));
    }
  }
}

function EnigGetFilePath (nsFileObj) {
  if (EnigGetOS() == "WINNT") {
    return EnigConvertToUnicode(nsFileObj.persistentDescriptor, "utf-8");
  }
  return EnigConvertFromUnicode(nsFileObj.path, "utf-8");
}

function EnigCreateRevokeCert(keyId, userId) {
  var defaultFileName = userId.replace(/[\<\>]/g, "");
  defaultFileName += " (0x"+keyId.substr(-8,8)+") rev.asc"
  var outFile = EnigFilePicker(EnigGetString("saveRevokeCertAs"),
                               "", true, "*.asc",
                               defaultFileName,
                               [EnigGetString("asciiArmorFile"), "*.asc"]);
  if (! outFile) return -1;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return -1;

  var errorMsgObj = {};
  var r=enigmailSvc.genRevokeCert(window, "0x"+keyId, EnigGetFilePath(outFile), "1", "", errorMsgObj);
  if (r != 0) {
    EnigAlert(EnigGetString("revokeCertFailed")+"\n\n"+errorMsgObj.value);
  }
  else {
    EnigAlert(EnigGetString("revokeCertOK"));
  }
  return r;
}

function EngmailCardDetails() {
  EnigOpenWin("enigmail:cardDetails",
              "chrome://enigmail/content/enigmailCardDetails.xul",
              "centerscreen");
}


// return the label of trust for a given trust code
function EnigGetTrustLabel(trustCode) {
  var keyTrust;
  switch (trustCode) {
  case 'q':
    keyTrust=EnigGetString("keyValid.unknown");
    break;
  case 'i':
    keyTrust=EnigGetString("keyValid.invalid");
    break;
  case 'd':
    keyTrust=EnigGetString("keyValid.disabled");
    break;
  case 'r':
    keyTrust=EnigGetString("keyValid.revoked");
    break;
  case 'e':
    keyTrust=EnigGetString("keyValid.expired");
    break;
  case 'n':
    keyTrust=EnigGetString("keyTrust.untrusted");
    break;
  case 'm':
    keyTrust=EnigGetString("keyTrust.marginal");
    break;
  case 'f':
    keyTrust=EnigGetString("keyTrust.full");
    break;
  case 'u':
    keyTrust=EnigGetString("keyTrust.ultimate");
    break;
  case 'g':
    keyTrust=EnigGetString("keyTrust.group");
    break;
  case '-':
    keyTrust="-";
    break;
  default:
    keyTrust="";
  }
  return keyTrust;
}

function EnigGetDateTime(dateNum, withDate, withTime) {
  if (dateNum != 0) {
    var dat=new Date(dateNum * 1000);
    var appLocale = Components.classes[ENIG_LOCALE_SVC_CONTRACTID].getService(Components.interfaces.nsILocaleService).getApplicationLocale();
    var dateTimeFormat = Components.classes[ENIG_DATE_FORMAT_CONTRACTID].getService(Components.interfaces.nsIScriptableDateFormat);

    var dateFormat = (withDate ? dateTimeFormat.dateFormatShort : dateTimeFormat.dateFormatNone);
    var timeFormat = (withTime ? dateTimeFormat.timeFormatNoSeconds : dateTimeFormat.timeFormatNone);
    return dateTimeFormat.FormatDateTime(appLocale.getCategory("NSILOCALE_TIME"),
              dateFormat,
              timeFormat,
              dat.getFullYear(), dat.getMonth()+1, dat.getDate(),
              dat.getHours(), dat.getMinutes(), 0);
  }
  else {
    return "";
  }
}

function enigCreateInstance (aURL, aInterface)
{
  return ENIG_C.classes[aURL].createInstance(ENIG_C.interfaces[aInterface]);
}

function enigGetInterface (aInterface) {
  return rv = ENIG_C.interfaces[aInterface];
}

function enigGetService (aURL, aInterface)
{
  // determine how 'aInterface' is passed and handle accordingly
  switch (typeof(aInterface))
  {
    case "object":
      return ENIG_C.classes[aURL].getService(aInterface);
      break;

    case "string":
      return ENIG_C.classes[aURL].getService(ENIG_C.interfaces[aInterface]);
      break;

    default:
      return ENIG_C.classes[aURL].getService();
  }

  return null;
}

function EnigCollapseAdvanced(obj, attribute, dummy) {
  DEBUG_LOG("enigmailCommon.js: EnigCollapseAdvanced: test\n");

  var advancedUser = EnigGetPref("advancedUser");

  var obj = obj.firstChild;
  while (obj) {
    if (obj.getAttribute("advanced") == "true") {
      if (advancedUser) {
        obj.removeAttribute(attribute);
      }
      else {
        obj.setAttribute(attribute, "true");
      }
    }
    else if (obj.getAttribute("advanced") == "reverse") {
      if (advancedUser) {
        obj.setAttribute(attribute, "true");
      }
      else {
        obj.removeAttribute(attribute);
      }
    }

    obj = obj.nextSibling;
  }
}


function EnigOpenURL(event, hrefObj) {
  var xulAppinfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
  if (xulAppinfo.ID == ENIG_SEAMONKEY_ID) return;

  try {
    var ioservice  = Components.classes["@mozilla.org/network/io-service;1"].
                  getService(Components.interfaces.nsIIOService);
    var iUri = ioservice.newURI(hrefObj.href, null, null);
    var eps  = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].
                  getService(Components.interfaces.nsIExternalProtocolService);

    eps.loadURI(iUri, null);

    event.preventDefault();
    event.stopPropagation();
  }
  catch (ex) {}
}

