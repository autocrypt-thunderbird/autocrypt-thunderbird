// enigmailCommon.js: shared JS functions for Enigmail

// This Enigmail version and compatible Enigmime version
var gEnigmailVersion = "0.81.6.0";
var gEnigmimeVersion = "0.81.6.0";

// Maximum size of message directly processed by Enigmail
const ENIG_MSG_BUFFER_SIZE = 96000;
const ENIG_MSG_HEADER_SIZE = 16000;

const ENIG_KEY_BUFFER_SIZE = 64000;

const ENIG_PROCESSINFO_CONTRACTID = "@mozilla.org/xpcom/process-info;1";
const ENIG_PIPECONSOLE_CONTRACTID = "@mozilla.org/process/pipe-console;1";
const ENIG_IPCBUFFER_CONTRACTID   = "@mozilla.org/process/ipc-buffer;1";
const ENIG_PIPEFILTERLISTENER_CONTRACTID = "@mozilla.org/process/pipe-filter-listener;1";
const ENIG_ENIGMAIL_CONTRACTID    = "@mozdev.org/enigmail/enigmail;1";
const ENIG_ENIGMIMELISTENER_CONTRACTID = "@mozilla.org/enigmail/mime-listener;1";
const ENIG_ENIGMIMESERVICE_CONTRACTID = "@mozdev.org/enigmail/enigmimeservice;1";
const ENIG_STRINGBUNDLE_CONTRACTID = "@mozilla.org/intl/stringbundle;1";
const ENIG_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const ENIG_DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";
const ENIG_MIME_CONTRACTID = "@mozilla.org/mime;1";
const ENIG_WMEDIATOR_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=window-mediator";
const ENIG_APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1"

const ENIG_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";
const ENIG_STANDARD_URL_CONTRACTID = "@mozilla.org/network/standard-url;1";

const ENIG_STREAMCONVERTERSERVICE_CID_STR =
      "{892FFEB0-3F80-11d3-A16C-0050041CAF44}";

const ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const ENIG_IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

const ENIGMAIL_PREFS_ROOT       = "extensions.enigmail.";

// Interfaces
const nsIEnigmail               = Components.interfaces.nsIEnigmail;
const nsIEnigStrBundle          = Components.interfaces.nsIStringBundleService;

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

// property name for temporary directory service
const ENIG_TEMPDIR_PROP = "TmpD";

var gUsePGPMimeOptionList = ["usePGPMimeNever", "usePGPMimePossible",
                             "usePGPMimeAlways"];

var gEnigDefaultEncryptionOptions = ["defaultEncryptionNone",
                                     "defaultEncryptionOnly",
                                     "defaultEncryptionSign"];

var gEnigRecipientsSelectionOptions = ["askRecipientsNever",
                                       "askRecipientsClever",
                                       "askRecipientsAlways"];

var gEnigImmediateSendOptions = ["sendLater",
                                 "sendNow"];

const ENIG_BUTTON_POS_0           = 1;
const ENIG_BUTTON_POS_1           = 1 << 8;
const ENIG_BUTTON_POS_2           = 1 << 16;
const ENIG_BUTTON_TITLE_IS_STRING = 127;

const ENIG_THREE_BUTTON_STRINGS   = (ENIG_BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_0) +
                               (ENIG_BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_1) +
                               (ENIG_BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_2);


var gEnigmailPrefDefaults = {"configuredVersion":"",
                             "logDirectory":"",
                             "initAlertCount":2,
                             "composeHtmlAlertCount":3,
                             "agentPath":"",
                             "autoCrypto":false,
                             "useDefaultComment":false,
                             "noPassphrase":false,
                             "usePGPMimeOption":PGP_MIME_POSSIBLE,
                             "mimeHashAlgorithm":1,
                             "alwaysTrustSend":true,
                             "encryptToSelf":true,
                             "confirmBeforeSend":false,
                             "doubleDashSeparator":true,
                             "maxIdleMinutes":5,
                             "keyserver":"wwwkeys.pgp.net",
                             "autoDecrypt":true,
                             "captureWebMail":false,
                             "useMimeExperimental":false,
                             "parseAllHeaders":true,
                             "show_headers":1,
                             "hushMailSupport":false,
                             "encryptAttachments":1,
                             "inlineAttachAsciiArmor":false,
                             "inlineAttachExt":".pgp",
                             "handleDoubleClick":false,
                             "useGpgAgent":false,
                             "wrapHtmlBeforeSend":true,
                             "keepSettingsForReply":false,
                             "recipientsSelectionOption":1
                            };

var gEnigLogLevel = 2;     // Output only errors/warnings by default
var gEnigDebugLog;

var gEnigPrefSvc, gEnigPrefRoot, gPrefEnigmail;
try {
  gEnigPrefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefService);

  gEnigPrefRoot        = gEnigPrefSvc.getBranch(null);
  gPrefEnigmail = gEnigPrefSvc.getBranch(ENIGMAIL_PREFS_ROOT);

  if (EnigGetPref("logDirectory"))
    gEnigLogLevel = 5;

} catch (ex) {
  ERROR_LOG("enigmailCommon.js: Error in instantiating PrefService\n");
}

function EnigGetFrame(win, frameName) {
  DEBUG_LOG("enigmailCommon.js: EnigGetFrame: name="+frameName+"\n");
  dump("direct="+win.frames[frameName]+"\n");
  for (var j=0; j<win.frames.length; j++) {
    dump(win.frames[j].name+"\n");
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

   gEnigPromptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

   // Do not instantiate ProcessInfo for Prefs
   if (id && (id.indexOf("pref-") == 0))
     return;

   try {
     var processInfo = Components.classes[ENIG_PROCESSINFO_CONTRACTID].getService(Components.interfaces.nsIProcessInfo);

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
    gEnigmailSvc = Components.classes[ENIG_ENIGMAIL_CONTRACTID].createInstance(Components.interfaces.nsIEnigmail);

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
        gPrefEnigmail.clearUserPref("initAlertCount");
      } catch(ex) {
      }

    } catch (ex) {

      if (firstInitialization) {
        // Display initialization error alert
        var errMsg = gEnigmailSvc.initializationError ? gEnigmailSvc.initializationError : "Error in initializing Enigmail service";

        errMsg += "\n\nTo avoid this alert, either fix the problem or uninstall Enigmail using the Edit->Preferences->Privacy&Security->Enigmail menu"

        EnigAlertCount("initAlertCount", "Enigmail: "+errMsg);
      }

      return null;
    }

    var configuredVersion = EnigGetPref("configuredVersion");

    DEBUG_LOG("enigmailCommon.js: GetEnigmailSvc: "+configuredVersion+"\n");

    if (firstInitialization && gEnigmailSvc.initialized &&
        gEnigmailSvc.agentType && gEnigmailSvc.agentType == "pgp") {
      EnigAlert(EnigGetString("pgpNotSupported"));
    }

    if (gEnigmailSvc.initialized && (gEnigmailVersion != configuredVersion)) {
      EnigConfigure();
    }
  }

  if (gEnigmailSvc.logFileStream) {
    gEnigDebugLog = true;
    gEnigLogLevel = 5;
  }

  return gEnigmailSvc.initialized ? gEnigmailSvc : null;
}


function EnigUpdate_0_60() {
  DEBUG_LOG("enigmailCommon.js: EnigUpdate_0_60: \n");

  var savePrefs = false;

  try {
    var userIdSource = gPrefEnigmail.getIntPref("userIdSource");

    gPrefEnigmail.deleteBranch("userIdSource");
    savePrefs = true;

    if (!EnigGetPref("userIdFromAddr")) {

      var userIdFromAddr = false;

      if (userIdSource > 1) {
        userIdFromAddr = true;

      } else {
        var userIdValue = EnigGetPref("userIdValue");

        var mesg = EnigGetString("specifyEmail");

        var valueObj = new Object();
        valueObj.value = userIdValue;

        if (EnigPromptValue(mesg, valueObj)) {
          userIdValue = valueObj.value;
          EnigSetPref("userIdValue", userIdValue);
        }

        userIdFromAddr = !userIdValue;

        if (userIdFromAddr)
          EnigAlert(EnigGetString("usingFrom"));
        else
          EnigAlert(EnigGetString("usingId",userIdValue));

      }

      EnigSetPref("userIdFromAddr", userIdFromAddr);
    }

  } catch (ex) {}

  try {
    var defaultEncryptMsg = gPrefEnigmail.getBoolPref("defaultEncryptMsg");

    gPrefEnigmail.deleteBranch("defaultEncryptMsg");
    savePrefs = true;
  } catch (ex) {}

  try {
    var defaultEncryptSignMsg = gPrefEnigmail.getBoolPref("defaultEncryptSignMsg");
    gPrefEnigmail.deleteBranch("defaultEncryptSignMsg");
    savePrefs = true;

    if (defaultEncryptSignMsg)
        gPrefEnigmail.setIntPref("defaultEncryptionOption", 2);

  } catch (ex) {}

  if (savePrefs) {
    DEBUG_LOG("enigmailCommon.js: EnigUpdate_0_60: Updating prefs\n");
    EnigSavePrefs();
  }
}

function EnigUpdate_0_80() {
  try {
    var oldVer=EnigGetPref("configuredVersion");

    if (oldVer.substring(0,4)<"0.81") {
      window.openDialog("chrome://enigmail/content/enigmailUpgrade.xul",
          "", "dialog,modal,centerscreen");
    }
  }
  catch (ex) {}
}

function EnigConfigure() {
  try {
    // Updates for specific versions (to be cleaned-up periodically)
    EnigUpdate_0_60();
    EnigUpdate_0_80();
  } catch (ex) {}

  var msg = EnigGetString("configNow",gEnigmailVersion);

  var checkValueObj = new Object();
  checkValueObj.value = false;

  var buttonPressed = gEnigPromptSvc.confirmEx(window,
                                           EnigGetString("configEnigmail"),
                                            msg,
                                            ENIG_THREE_BUTTON_STRINGS,
                                            EnigGetString("dlgYes"),
                                            EnigGetString("dlgNo"),
                                            EnigGetString("dlgNever"),
                                            "",
                                            checkValueObj);

  DEBUG_LOG("enigmailCommon.js: EnigConfigure: "+buttonPressed+" \n");

  if (buttonPressed == 1)  // Configure later
    return;

  for (var prefName in gEnigmailPrefDefaults) {
    if (prefName.search(/AlertCount$/) >= 0) {
       // Reset alert count to default value
      try {
        gPrefEnigmail.clearUserPref(prefName);
      } catch(ex) {
      }
    }
  }

  if (buttonPressed == 0) {
    // Configure now
    EnigPrefWindow();

  } else {
    // "Do not ask me again" => "already configured"
    EnigSetPref("configuredVersion", gEnigmailVersion);
    EnigSavePrefs();
  }
}

///////////////////////////////////////////////////////////////////////////////
// File read/write operations


const ENIG_RDONLY      = 0x01;
const ENIG_WRONLY      = 0x02;
const ENIG_CREATE_FILE = 0x08;
const ENIG_TRUNCATE    = 0x20;
const ENIG_DEFAULT_FILE_PERMS = 0600;

const EnigInputStream = new Components.Constructor( "@mozilla.org/scriptableinputstream;1", "nsIScriptableInputStream" );

function EnigCreateFileStream(filePath, permissions) {
  //DEBUG_LOG("enigmailCommon.js: EnigCreateFileStream: file="+filePath+"\n");

  try {
    var localFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);

    localFile.initWithPath(filePath);

    if (localFile.exists()) {

      if (localFile.isDirectory() || !localFile.isWritable())
         throw Components.results.NS_ERROR_FAILURE;

      if (!permissions)
        permissions = localFile.permissions;
    }

    if (!permissions)
      permissions = ENIG_DEFAULT_FILE_PERMS;

    var flags = ENIG_WRONLY | ENIG_CREATE_FILE | ENIG_TRUNCATE;

    var fileStream = Components.classes[ENIG_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Components.interfaces.nsIFileOutputStream);

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
        throw Components.results.NS_ERROR_FAILURE;

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

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
  if (!ioServ)
    throw Components.results.NS_ERROR_FAILURE;

  var fileChannel = ioServ.newChannel(url, null, null)

  var rawInStream = fileChannel.open();

  var scriptableInStream = new EnigInputStream();
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
    throw Components.results.NS_ERROR_FAILURE;


  return EnigReadURLContents("file://"+localFile.path, maxBytes);

}

///////////////////////////////////////////////////////////////////////////////

function WRITE_LOG(str) {
  dump(str);

  if (gEnigDebugLog && gEnigmailSvc && gEnigmailSvc.logFileStream) {
    gEnigmailSvc.logFileStream.write(str, str.length);
  }
}

function DEBUG_LOG(str) {
  if (gEnigLogLevel >= 4)
    WRITE_LOG(str);
}

function WARNING_LOG(str) {
  if (gEnigLogLevel >= 3)
    WRITE_LOG(str);
}

function ERROR_LOG(str) {
  if (gEnigLogLevel >= 2)
    WRITE_LOG(str);
}

function CONSOLE_LOG(str) {
  if (gEnigLogLevel >= 3)
    WRITE_LOG(str);

  if (gEnigmailSvc && gEnigmailSvc.console)
    gEnigmailSvc.console.write(str);
}

///////////////////////////////////////////////////////////////////////////////

function EnigAlert(mesg) {
  gEnigPromptSvc.alert(window, EnigGetString("enigAlert"), mesg);
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

function EnigConfirm(mesg) {
  return gEnigPromptSvc.confirm(window, EnigGetString("enigConfirm"), mesg);
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


function EnigPrefWindow() {
  window.openDialog("chrome://enigmail/content/pref-enigmail.xul",
                    "_blank", "chrome,resizable=yes");
}


function EnigAdvPrefWindow() {
  EnigAlert("This function doesn't exist anymore!");
}

function EnigHelpWindow(source) {

   var helpUrl = "http://enigmail.mozdev.org/help.html";

   if (source)
     helpUrl += "#" + source

   window.open(helpUrl);
}

function EnigUpgrade() {
  window.openDialog("http://enigmail.mozdev.org/no_wrap/update.html?upgrade=yes&enigmail="+gEnigmailVersion+"&enigmime="+gEnigmimeVersion, "dialog");
}

function EnigShowHeadersAll(status) {
  DEBUG_LOG("enigmailCommon.js: EnigShowHeadersAll: "+status+"\n");

  if (status && EnigGetPref("parseAllHeaders")) {
    // Show all mail headers
    gEnigPrefRoot.setIntPref("mail.show_headers", 2);

  } else {
    // Reset mail.show_headers pref to "original" value
    gEnigPrefRoot.setIntPref("mail.show_headers",
                             EnigGetPref("show_headers"));
  }
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

function EnigSetDefaultPrefs() {
  DEBUG_LOG("enigmailCommon.js: EnigSetDefaultPrefs\n");
  for (var prefName in gEnigmailPrefDefaults) {
    var prefValue = EnigGetPref(prefName);
  }
}

function EnigSavePrefs() {
  DEBUG_LOG("enigmailCommon.js: EnigSavePrefs\n");
  try {
    gEnigPrefSvc.savePrefFile(null);
  } catch (ex) {
  }
}

function EnigGetPref(prefName) {
   var defaultValue = gEnigmailPrefDefaults[prefName];

   var prefValue = defaultValue;
   try {
      // Get pref value
      switch (typeof defaultValue) {
      case "boolean":
         prefValue = gPrefEnigmail.getBoolPref(prefName);
         break;

      case "number":
         prefValue = gPrefEnigmail.getIntPref(prefName);
         break;

      case "string":
         prefValue = gPrefEnigmail.getCharPref(prefName);
         break;

      default:
         prefValue = undefined;
         break;
     }

   } catch (ex) {
      // Failed to get pref value; set pref to default value
      switch (typeof defaultValue) {
      case "boolean":
         gPrefEnigmail.setBoolPref(prefName, defaultValue);
         break;

      case "number":
         gPrefEnigmail.setIntPref(prefName, defaultValue);
         break;

      case "string":
         gPrefEnigmail.setCharPref(prefName, defaultValue);
         break;

      default:
         break;
     }
   }

   //DEBUG_LOG("enigmailCommon.js: EnigGetPref: "+prefName+"="+prefValue+"\n");
   return prefValue;
}

function EnigSetPref(prefName, value) {
   DEBUG_LOG("enigmailCommon.js: EnigSetPref: "+prefName+", "+value+"\n");

   var defaultValue = gEnigmailPrefDefaults[prefName];

   var retVal = false;

   switch (typeof defaultValue) {
      case "boolean":
         gPrefEnigmail.setBoolPref(prefName, value);
         retVal = true;
         break;

      case "number":
         gPrefEnigmail.setIntPref(prefName, value);
         retVal = true;
         break;

      case "string":
         gPrefEnigmail.setCharPref(prefName, value);
         retVal = true;
         break;

      default:
         break;
   }

   return retVal;
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
    if (!iid.equals(Components.interfaces.nsIRequestObserver) &&
        !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
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

  if (!text || !charset || (charset.toLowerCase() == "iso-8859-1"))
    return text;

  // Encode plaintext
  try {
    var unicodeConv = Components.classes[ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Components.interfaces.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertFromUnicode(text);

  } catch (ex) {
    return text;
  }
}


function EnigConvertToUnicode(text, charset) {
  DEBUG_LOG("enigmailCommon.js: EnigConvertToUnicode: "+charset+"\n");

  if (!text || !charset || (charset.toLowerCase() == "iso-8859-1"))
    return text;

  // Encode plaintext
  try {
    var unicodeConv = Components.classes[ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Components.interfaces.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertToUnicode(text);

  } catch (ex) {
    return text;
  }
}


function EnigGetDeepText(node, findStr) {

  DEBUG_LOG("enigmailCommon.js: EnigDeepText: <" + node.tagName + ">, '"+findStr+"'\n");

  /*
  try {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

    var plainText = enigMimeService.getPlainText(node, findStr);
    return plainText;

  } catch (ex) {
    DEBUG_LOG("enigmailCommon.js: EnigDeepText: Failed to access EnigMimeService\n");
  }
  */
  
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

  enigmailSvc.clearCachedPassphrase();
}

function EnigViewAbout() {
  DEBUG_LOG("enigmailCommon.js: EnigViewAbout\n");

  toOpenWindowByType("enigmail:about",
                     "chrome://enigmail/content/enigmailAbout.xul");
}

function EnigViewConsole() {
  DEBUG_LOG("enigmailCommon.js: EnigViewConsole\n");

  toOpenWindowByType("enigmail:console",
                     "chrome://enigmail/content/enigmailConsole.xul");
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

  window.open(logFileURL, 'Enigmail Debug Log');
}

function EnigKeygen() {
  DEBUG_LOG("enigmailCommon.js: EnigKeygen\n");

  window.openDialog('chrome://enigmail/content/enigmailKeygen.xul',
                    'Enigmail Key Generation',
                    'chrome,dialog,close=no,resizable=yes,width=600');

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
    try {
      // Mozilla up to 1.0
      wm = Components.classes[ENIG_WMEDIATOR_CONTRACTID].getService(Components.interfaces.nsIWindowMediator);
    }
    catch (ex) {
      // Mozilla 1.1 and newer
      wm = Components.classes[ENIG_APPSHELL_MEDIATOR_CONTRACTID].getService(Components.interfaces.nsIWindowMediator);
    }
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
      var strBundleService = Components.classes[ENIG_STRINGBUNDLE_CONTRACTID].getService();
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
function enigStripEmail(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       ERROR_LOG("enigmailMsgComposeOverlay.js: enigStripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
       throw Components.results.NS_ERROR_FAILURE;
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
    var ds = Components.classes[ENIG_DIRSERVICE_CONTRACTID].getService();
    var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
    var tmpDirComp = dsprops.get(ENIG_TEMPDIR_PROP, Components.interfaces.nsILocalFile);
    tmpDir=tmpDirComp.path;
  }
  catch (ex) {
    // let's guess ...
    var httpHandler = ioServ.getProtocolHandler("http");
    httpHandler = httpHandler.QueryInterface(Components.interfaces.nsIHttpProtocolHandler);
    isWin = (httpHandler.platform.search(/Win/i) == 0);
    if (isWin) {
      tmpDir="C:\\TEMP";
    } else {
      tmpDir="/tmp";
    }
  }
  return tmpDir;
}


function EnigDisplayPrefs(showDefault, showPrefs, setPrefs) {
   DEBUG_LOG("enigmailCommon.js: EnigDisplayPrefs\n");

   for (var prefName in gEnigmailPrefDefaults) {
      var prefElement = document.getElementById("enigmail_"+prefName);

      if (prefElement) {
         var defaultValue = gEnigmailPrefDefaults[prefName];
         var prefValue = showDefault ? defaultValue : EnigGetPref(prefName);

         DEBUG_LOG("enigmailCommon.js: EnigDisplayPrefs: "+prefName+"="+prefValue+"\n");

         switch (typeof defaultValue) {
         case "boolean":
            if (showPrefs) {
               if (prefValue) {
                  prefElement.setAttribute("checked", "true");
               } else {
                  prefElement.removeAttribute("checked");
               }
            }

            if (setPrefs) {
               if (prefElement.checked) {
                  EnigSetPref(prefName, true);
               } else {
                  EnigSetPref(prefName, false);
               }
            }

         break;

         case "number":
            if (showPrefs)
              prefElement.value = prefValue;

            if (setPrefs) {
               try {
                 EnigSetPref(prefName, 0+prefElement.value);
               } catch (ex) {
               }
            }
         break;

         case "string":
            if (showPrefs)
              prefElement.value = prefValue;
            if (setPrefs)
              EnigSetPref(prefName, prefElement.value);
            break;

         default:
         }
      }
   }
}
