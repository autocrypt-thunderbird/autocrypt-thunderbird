// enigmailCommon.js: shared JS functions for Enigmail

var gEnigmailVersion = "0.18.0.0";
var gIPCVersion = "0.98.0.0";

const NS_PROCESSINFO_CONTRACTID = "@mozilla.org/xpcom/process-info;1";
const NS_ENIGMAIL_CONTRACTID    = "@mozdev.org/enigmail/enigmail;1";
const ENIGMAIL_PREFS_ROOT       = "extensions.enigmail.";

// UserIdSource values
const USER_ID_SPECIFIED = 0;
const USER_ID_DEFAULT   = 1;
const USER_ID_FROMADDR  = 2;

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;
const BUTTON_TITLE_IS_STRING = 127;
  
const THREE_BUTTON_STRINGS   = (BUTTON_TITLE_IS_STRING * BUTTON_POS_0) +
                               (BUTTON_TITLE_IS_STRING * BUTTON_POS_1) +
                               (BUTTON_TITLE_IS_STRING * BUTTON_POS_2);


var gEnigmailPrefDefaults = {"configuredVersion":"",
                             "passivePrivacy":false,
                             "userIdSource":USER_ID_DEFAULT,
                             "userIdValue":"",
                             "defaultSignMsg":false,
                             "defaultEncryptMsg":false,
                             "alwaysTrustSend":true,
                             "encryptToSelf":false,
                             "maxIdleMinutes":5,
                             "autoDecrypt":true,
                             "replaceNonBreakingSpace":true,
                             "captureWebMail":false
                            };

// Encryption flags
const SIGN_MESSAGE      = 0x01;
const ENCRYPT_MESSAGE   = 0x02;
const ALWAYS_TRUST_SEND = 0x04;
const ENCRYPT_TO_SELF   = 0x08;

var gLogLevel = 3;     // Output only errors/warnings by default
var gLogFileStream = null;

var gPrefSvc, gPrefEnigmail;
try {
  var gPrefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefService);
  gPrefEnigmail = gPrefSvc.getBranch(ENIGMAIL_PREFS_ROOT);

} catch (ex) {
  ERROR_LOG("enigmailCommon.js: Error in instantiating PrefService\n");
  throw ("enigmailCommon.js: Error in instantiating PrefService\n");
}

var gPromptService;

// Initializes enigmailCommon
function EnigInitCommon(id) {
   gPromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

   try {
     var processInfo = Components.classes[NS_PROCESSINFO_CONTRACTID].getService(Components.interfaces.nsIProcessInfo);

     var nspr_log_modules = processInfo.getEnv("NSPR_LOG_MODULES");

     var matches = nspr_log_modules.match(/enigmailCommon:(\d+)/);

     if (matches && (matches.length > 1)) {
       gLogLevel = matches[1];
       WARNING_LOG("enigmailCommon.js: gLogLevel="+gLogLevel+"\n");
     }

   } catch (ex) {
     dump("enigmailCommon.js: Error in instantiating ProcessInfo\n");
   }

   DEBUG_LOG("enigmailCommon.js: EnigInitCommon: id="+id+"\n");
}

var gEnigmailSvc;
function GetEnigmailSvc() {
  // Lazy initialization of enigmail JS component (for efficiency)

  if (gEnigmailSvc) {
    return gEnigmailSvc.initialized ? gEnigmailSvc : null;
  }

  try {
    gEnigmailSvc = Components.classes[NS_ENIGMAIL_CONTRACTID].createInstance(Components.interfaces.nsIEnigmail);

  } catch (ex) {
    ERROR_LOG("enigmailCommon.js: Error in instantiating EnigmailService\n");
    return null;
  }

  DEBUG_LOG("enigmailCommon.js: gEnigmailSvc = "+gEnigmailSvc+"\n");

  if (!gEnigmailSvc.initialized) {

    var firstInitialization = !gEnigmailSvc.initializationAttempted;

    try {
      // Initialize enigmail
      gEnigmailSvc.initialize(gPrefEnigmail);

    } catch (ex) {

      if (firstInitialization) {
        var errMsg = gEnigmailSvc.initializationError ? gEnigmailSvc.initializationError : "Error in initializing Enigmail service";

        errMsg += "\n\nTo avoid this alert, uninstall Enigmail using the Edit->Preferences->Privacy&Security->Enigmail menu"

        EnigAlert(errMsg);
      }

      return null;
    }

    var configuredVersion = EnigGetPref("configuredVersion");

    DEBUG_LOG("enigmailCommon.js: EnigConfigure: "+configuredVersion+"\n");

    if (gEnigmailSvc.initialized && (gEnigmailVersion != configuredVersion)) {
      EnigConfigure();
    }
  }

  return gEnigmailSvc.initialized ? gEnigmailSvc : null;
}


function EnigConfigure() {
  var msg = "Do you wish to configure enigmail for version "+
            gEnigmailVersion+" now?";

  var checkValueObj = new Object();
  checkValueObj.value = false;
  var buttonPressedObj = new Object();

  var confirmed = gPromptService.confirmEx(window,
                                           "Configure Enigmail?",
                                            msg,
                                            THREE_BUTTON_STRINGS,
                                            "Yes",
                                            "No",
                                            "Do not ask me again",
                                            "",
                                            checkValueObj,
                                            buttonPressedObj);

  var buttonPressed = buttonPressedObj.value;

  if (buttonPressed == 0) {
    EnigPrefWindow();

  } else if (buttonPressed == 2) {
    // "Do not ask me again"
    EnigSetPref("configuredVersion", gEnigmailVersion);
    EnigSavePrefs();
  }
}

///////////////////////////////////////////////////////////////////////////////
// File read/write operations

const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0600;

const FileChannel = new Components.Constructor( "@mozilla.org/network/local-file-channel;1", "nsIFileChannel" );

const InputStream = new Components.Constructor( "@mozilla.org/scriptableinputstream;1", "nsIScriptableInputStream" );

function CreateFileStream(filePath, permissions) {

  var localFile = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
  localFile.initWithPath(filePath);

  if (localFile.exists()) {
    if (localFile.isDirectory() || !localFile.isWritable())
      throw Components.results.NS_ERROR_FAILURE;
    if (!permissions)
      permissions = localFile.permissions;
  }

  if (!permissions)
    permissions = DEFAULT_FILE_PERMS;

  var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

  var fileStream = Components.classes[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Components.interfaces.nsIFileOutputStream);

  fileStream.init(localFile, flags, permissions);

  return fileStream;
}

// maxBytes == -1 => read whole file
function ReadFileContents(localFile, maxBytes) {
  DEBUG_LOG("enigmailCommon.js: ReadFileContents: file="+localFile.leafName+
            ", "+maxBytes+"\n");

  var fileChannel = new FileChannel();

  if (!localFile.exists() || !localFile.isReadable())
    throw Components.results.NS_ERROR_FAILURE;

  fileChannel.init(localFile, NS_RDONLY, 0);

  var rawInStream = fileChannel.open();

  var scriptableInStream = new InputStream();    
  scriptableInStream.init(rawInStream);

  if ((maxBytes < 0) || (maxBytes > localFile.fileSize))
    maxBytes = localFile.fileSize;

  var fileContents = scriptableInStream.read(maxBytes);

  rawInStream.close();

  return fileContents;
}

function WriteFileContents(filePath, data, permissions) {

  DEBUG_LOG("enigmailCommon.js: WriteFileContents: file="+filePath+"\n");

  var fileOutStream = CreateFileStream(filePath, permissions);

  if (data.length) {
    if (fileOutStream.write(data, data.length) != data.length)
      throw Components.results.NS_ERROR_FAILURE;

    fileOutStream.flush();
  }
  fileOutStream.close();

  return;
}

///////////////////////////////////////////////////////////////////////////////

function WRITE_LOG(str) {
  dump(str);

  if (gLogFileStream) {
    gLogFileStream.write(str, str.length);
    gLogFileStream.flush();
  }
}

function DEBUG_LOG(str) {
  if (gLogLevel >= 4)
    WRITE_LOG(str);
}

function WARNING_LOG(str) {
  if (gLogLevel >= 3)
    WRITE_LOG(str);
}

function ERROR_LOG(str) {
  if (gLogLevel >= 2)
    WRITE_LOG(str);
}

// Uncomment following two lines for debugging (use full path name on Win32)
///if (gLogLevel >= 4)
///  gLogFileStream = CreateFileStream("c:\\enigdbg2.txt");

///////////////////////////////////////////////////////////////////////////////

function EnigAlert(mesg) {
  return gPromptService.alert(window, "Enigmail Alert", mesg);
}

function EnigConfirm(mesg) {
  return gPromptService.confirm(window, "Enigmail Confirm", mesg);
}

function EnigError(mesg) {
  return gPromptService.alert(window, "Enigmail Error", mesg);
}

function EnigPrefWindow() {
  goPreferences("securityItem",
                "chrome://enigmail/content/pref-enigmail.xul",
                "enigmail");
}

function EnigUpgrade() {
  window.openDialog("http://enigmail.mozdev.org/update.html?upgrade=yes&enigmail="+gEnigmailVersion+"&ipc="+gIPCVersion, "dialog");
}

function EnigPassphrase() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
     return null;

  var maxIdleMinutes = EnigGetPref("maxIdleMinutes");

  var passwdObj = new Object();
  var checkObj = new Object();

  var promptMsg = "Please type in your "+enigmailSvc.agentType.toUpperCase()+" passphrase";
  passwdObj.value = "";
  checkObj.value = true;
  var checkMsg = maxIdleMinutes ? "Remember for "+maxIdleMinutes+" idle minutes"
                                : "";

  var success = gPromptService.promptPassword(window,
                               "Enigmail",
                               promptMsg,
                               passwdObj,
                               checkMsg,
                               checkObj);
  if (!success)
    return null;

  // Null string password is always remembered
  if (checkObj.value || (passwdObj.value.length == 0))
    enigmailSvc.setDefaultPassphrase(passwdObj.value);

  DEBUG_LOG("enigmailCommon.js: EnigPassphrase: "+passwdObj.value+"\n");

  return passwdObj.value;
}

// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email address
function EnigStripEmail(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       ERROR_LOG("enigmailCommon.js: EnigStripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
       throw Components.results.NS_ERROR_FAILURE;
     }
  
     mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
  }
  
  // Eliminate all whitespace, just to be safe
  mailAddrs = mailAddrs.replace(/\s+/g,"");
  
  // Extract pure e-mail address list (stripping out angle brackets)
  mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*(,|$)/g,"$1$2$3");

  return mailAddrs;
}
    
function EnigEncryptMessage(plainText, fromMailAddr, toMailAddr, encryptFlags,
                            exitCodeObj, errorMsgObj) {
  DEBUG_LOG("enigmailCommon.js: EnigEncryptMessage: To "+toMailAddr+"\n");

  exitCodeObj.value = -1;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     errorMsgObj.value = "Error in accessing Enigmail service";
     return "";
  }

  var passphrase = null;

  if ((encryptFlags & SIGN_MESSAGE) && !enigmailSvc.haveDefaultPassphrase()) {
    passphrase = EnigPassphrase();

    if ((typeof passphrase) != "string") {
      errorMsgObj.value = "Error - no passphrase supplied";
      return "";
    }
  }

  var statusMsgObj = new Object();    
  var cipherText = enigmailSvc.encryptMessage(plainText,
                                              EnigStripEmail(fromMailAddr),
                                              EnigStripEmail(toMailAddr),
                                              encryptFlags,
	                                      passphrase,
                                              exitCodeObj, errorMsgObj,
                                              statusMsgObj);

  return cipherText;
}


function IndexOfPGPString(text, str) {
  var offset = 0;

  while (offset < text.length) {

    var loc = text.indexOf(str, offset);

    if ((loc < 1) || (text.charAt(loc-1) == "\n"))
      return loc;

    offset = loc + str.length;
  }

  return -1;
}

function EnigDecryptMessage(cipherText, exitCodeObj, errorMsgObj) {
  DEBUG_LOG("enigmailCommon.js: EnigDecryptMessage: \n");

  exitCodeObj.value = -1;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     errorMsgObj.value = "Error in accessing Enigmail service";
     return "";
  }

  var beginIndex = IndexOfPGPString(cipherText, "-----BEGIN PGP ");
  var endIndex   = IndexOfPGPString(cipherText, "-----END PGP ");

  // Locate newline at end of PGP block
  if (endIndex > -1)
    endIndex = cipherText.indexOf("\n", endIndex);

  if ((beginIndex == -1) || (endIndex == -1) || (beginIndex > endIndex)) {
     errorMsgObj.value = "Error - No valid armored PGP data block found";
     return "";
  }

  var headBlock = cipherText.substr(0,beginIndex);
  var pgpBlock  = cipherText.substr(beginIndex, endIndex-beginIndex+1);
  var tailBlock = cipherText.substr(endIndex+1, cipherText.length-endIndex-1);

  // Eliminate leading/trailing whitespace around the PGP block
  headBlock = headBlock.replace(/\s+$/, "");
  tailBlock = tailBlock.replace(/^\s+/, "");

  if (headBlock)
    headBlock = "-----UNSIGNED TEXT BELOW-----\n" + headBlock + "\n-----BEGIN SIGNED TEXT-----\n";

  if (tailBlock)
    tailBlock = "-----END SIGNED TEXT-----\n" + tailBlock + "\n-----UNSIGNED TEXT ABOVE-----\n";

  var verifyOnly = (pgpBlock.indexOf("-----BEGIN PGP SIGNED MESSAGE-----") == 0);

  var passphrase = null;

  if (!verifyOnly && !enigmailSvc.haveDefaultPassphrase()) {
    passphrase = EnigPassphrase();

    if ((typeof passphrase) != "string") {
      errorMsgObj.value = "Error - no passphrase supplied";
      return "";
    }
  }

  if ( (pgpBlock.indexOf("\xA0") != -1) &&
        EnigGetPref("replaceNonBreakingSpace") ) {
    // TEMPORARY WORKAROUND?
    // Replace non-breaking spaces with plain spaces, if preferred

    pgpBlock = pgpBlock.replace(/\xA0/g, " ");
    DEBUG_LOG("enigmailCommon.js: replaced non-breaking spaces\n");
  }

  if (gLogLevel >= 4) {
    WriteFileContents("enigdata.txt", pgpBlock);
    DEBUG_LOG("enigmailCommon.js: copied pgpBlock to file enigdata.txt\n");
  }

  var statusMsgObj = new Object();    
  var plainText = enigmailSvc.decryptMessage(pgpBlock, verifyOnly,
                                             passphrase,
                                             exitCodeObj, errorMsgObj,
                                             statusMsgObj);

  return headBlock + plainText + tailBlock;
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
    gPrefSvc.savePrefFile(null);
  } catch (ex) {
  }
}

function EnigGetPref(prefName) {
   var defaultValue = gEnigmailPrefDefaults[prefName];

   var prefValue = defaultValue;
   try {
      // Get pref value
      switch (typeof defaultValue) {
      case "string":
         prefValue = gPrefEnigmail.getCharPref(prefName);
         break;

      case "boolean":
         prefValue = gPrefEnigmail.getBoolPref(prefName);
         break;

      case "number":
         prefValue = gPrefEnigmail.getIntPref(prefName);
         break;

      default:
         prefValue = undefined;
     }

   } catch (ex) {
      // Failed to get pref value; set pref to default value
      switch (typeof defaultValue) {
      case "string":
         gPrefEnigmail.setCharPref(prefName, defaultValue);
         break;

      case "boolean":
         gPrefEnigmail.setBoolPref(prefName, defaultValue);
         break;

      case "number":
         gPrefEnigmail.setIntPref(prefName, defaultValue);
         break;

      default:
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
      case "string":
         gPrefEnigmail.setCharPref(prefName, value);
         retVal = true;
         break;

      case "boolean":
         gPrefEnigmail.setBoolPref(prefName, value);
         retVal = true;
         break;

      case "number":
         gPrefEnigmail.setIntPref(prefName, value);
         retVal = true;
         break;

      default:
         break;
   }

   return retVal;
}


function RequestObserver(terminateFunc, terminateArg)
{
  this._terminateFunc = terminateFunc;
  this._terminateArg = terminateArg;
}

RequestObserver.prototype = {

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
    DEBUG_LOG("enigmailCommon.js: RequestObserver.onStartRequest\n");
  },

  onStopRequest: function (channel, ctxt, status)
  {
    DEBUG_LOG("enigmailCommon.js: RequestObserver.onStopRequest\n");
    this._terminateFunc(this._terminateArg);
  }
}

function EnigGetDeepText(node) {

  DEBUG_LOG("enigmailCommon.js: EnigDeepText: <" + node.tagName + ">\n")

  var depth = 0;
  var textArr = [""];

  while (node) {

    while (node.hasChildNodes()) {
       depth++;
       node = node.firstChild;
    }

    if (node.nodeType == Node.TEXT_NODE) {
      textArr.push(node.data);
    }

    while (!node.nextSibling && (depth > 0)) {
      depth--;
      node = node.parentNode;
    }

    if (depth > 0) {
      node = node.nextSibling;
    } else {
      node = null;
    }
  }

  return textArr.join("");
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
                child = children[count]
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


function EnigTest() {
  var plainText = "TEST MESSAGE 123\n";
  var toMailAddr = "r_sarava@yahoo.com";

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();

  var cipherText = EnigEncryptMessage(plainText, "", toMailAddr, 3,
                                      exitCodeObj, errorMsgObj);
  DEBUG_LOG("enigmailCommon.js: enigTest: cipherText = "+cipherText+"\n");
  DEBUG_LOG("enigmailCommon.js: enigTest: exitCode = "+exitCodeObj.value+"\n");
  DEBUG_LOG("enigmailCommon.js: enigTest: errorMsg = "+errorMsgObj.value+"\n");

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();

  var decryptedText = EnigDecryptMessage(cipherText,
                                         exitCodeObj, errorMsgObj);
  DEBUG_LOG("enigmailCommon.js: enigTest: decryptedText = "+decryptedText+"\n");
  DEBUG_LOG("enigmailCommon.js: enigTest: exitCode = "+exitCodeObj.value+"\n");
  DEBUG_LOG("enigmailCommon.js: enigTest: errorMsg = "+errorMsgObj.value+"\n");
}

/////////////////////////
// Console stuff
/////////////////////////


const WMEDIATOR_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=window-mediator";
const nsIWindowMediator    = Components.interfaces.nsIWindowMediator;

function EnigViewConsole() {
  DEBUG_LOG("enigmailCommon.js: EnigViewConsole\n");
  window.open('enigmail:console', 'Enigmail Console');

  //var navWindow = LoadURLInNavigatorWindow("enigmail:console", true);
  //if (navWindow) navWindow.focus();
}

function EnigKeygen() {
  DEBUG_LOG("enigmailCommon.js: EnigKeygen\n");

  window.openDialog('chrome://enigmail/content/enigmailKeygen.xul',
                    'Enigmail Key Generation',
                    'chrome,dialog,close=no');

}

// retrieves the most recent navigator window (opens one if need be)
function LoadURLInNavigatorWindow(url, aOpenFlag)
{
  DEBUG_LOG("enigmailCommon.js: LoadURLInNavigatorWindow: "+url+", "+aOpenFlag+"\n");

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
    var wm = Components.classes[WMEDIATOR_CONTRACTID].getService(nsIWindowMediator);
    navWindow = wm.getMostRecentWindow("navigator:browser");
  }

  if (navWindow) {

    if ("loadURI" in navWindow)
      navWindow.loadURI(url);
    else
      navWindow._content.location.href = url;

  } else if (aOpenFlag) {
    // if no browser window available and it's ok to open a new one, do so
    navWindow = window.open(url, "EnigmailConsole");
  }

  DEBUG_LOG("enigmailCommon.js: LoadURLInNavigatorWindow: navWindow="+navWindow+"\n");

  return navWindow;
}

/////////////////////////
// Uninstallation stuff
/////////////////////////

function GetFileOfProperty(prop) {
  var dscontractid = "@mozilla.org/file/directory_service;1";
  var ds = Components.classes[dscontractid].getService();

  var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
  DEBUG_LOG("enigmailCommon.js: GetFileOfProperty: prop="+prop+"\n");
  var file = dsprops.get(prop, Components.interfaces.nsIFile);
  DEBUG_LOG("enigmailCommon.js: GetFileOfProperty: file="+file+"\n");
  return file;
}


function EnigUninstall() {
  var delFiles = [];

  var confirm;

  confirm = EnigConfirm("Do you wish to delete all EnigMail-related files in the Mozilla component and chrome directories?");

  if (confirm) {
    var overlay1Removed = RemoveOverlay("communicator",
                          ["chrome://enigmail/content/enigmailPrefsOverlay.xul"]);

    var overlay2Removed = RemoveOverlay("messenger",
                          ["chrome://enigmail/content/enigmailMsgComposeOverlay.xul",
                           "chrome://enigmail/content/enigmailMessengerOverlay.xul"]);

    if (!overlay1Removed || !overlay2Removed) {
      EnigAlert("Failed to uninstall EnigMail communicator overlay RDF; not deleting chrome jar file");

    } else {
      var chromeFile = GetFileOfProperty("AChrom");
      chromeFile.append("enigmail.jar");

      delFiles.push(chromeFile);
    }

    var compDir = GetFileOfProperty("ComsD");
    var compFiles = ["enigmail.js", "enigmail.xpt", "ipc.xpt"];
    if (gPlatform.search(/^win/i)==0) {
      compFiles.push("ipc.dll");
    } else {
      compFiles.push("libipc.so");
    }

    for (var k=0; k<compFiles.length; k++) {
      var compFile = compDir.clone();
      compFile.append(compFiles[k]);
      delFiles.push(compFile);
    }
  }

  // Need to unregister chrome: how???

  // Delete files
  for (var j=0; j<delFiles.length; j++) {
    var delFile = delFiles[j];
    if (delFile.exists()) {
      WRITE_LOG("enigmailCommon.js: UninstallPackage: Deleting "+delFile.path+"\n")
      try {
          delFile.remove(true);
      } catch (ex) {
          EnigError("Error in deleting file "+delFile.path)
      }
    }
  }

  EnigAlert("Uninstalled EnigMail");

  // Close window
  window.close();
}


function RemoveOverlay(module, urls) {
   DEBUG_LOG("enigmailCommon.js: RemoveOverlay: module="+module+", urls="+urls.join(",")+"\n");

   var overlayFile = GetFileOfProperty("AChrom");
   overlayFile.append("overlayinfo");
   overlayFile.append(module);
   overlayFile.append("content");
   overlayFile.append("overlays.rdf");

   DEBUG_LOG("enigmailCommon.js: RemoveOverlay: overlayFile="+overlayFile.path+"\n");

   var overlayRemoved = false;

   try {
      var fileContents = ReadFileContents(overlayFile, -1);

      for (var j=0; j<urls.length; j++) {
         var overlayPat=new RegExp("\\s*<RDF:li>\\s*"+urls[j]+"\\s*</RDF:li>");

         while (fileContents.search(overlayPat) != -1) {

            fileContents = fileContents.replace(overlayPat, "");

            overlayRemoved = true;

            DEBUG_LOG("enigmailCommon.js: RemoveOverlay: removed overlay "+urls[j]+"\n");
         }
      }

      if (overlayRemoved)
         WriteFileContents(overlayFile.path, fileContents, 0);

   } catch (ex) {
   }

   return overlayRemoved;
}
