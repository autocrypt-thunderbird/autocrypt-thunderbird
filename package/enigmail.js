/*
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
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick.brunschwig@gmx.net>
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Maximum size of message directly processed by Enigmail
const MSG_BUFFER_SIZE = 98304;   // 96 kB
const MAX_MSG_BUFFER_SIZE = 512000 // slightly less than 512 kB

const ERROR_BUFFER_SIZE = 32768; // 32 kB

const GPG_BATCH_OPT_LIST = [ "--batch", "--no-tty", "--status-fd", "2" ];

const gDummyPKCS7 = 'Content-Type: multipart/mixed;\r\n boundary="------------060503030402050102040303\r\n\r\nThis is a multi-part message in MIME format.\r\n--------------060503030402050102040303\r\nContent-Type: application/x-pkcs7-mime\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303\r\nContent-Type: application/x-enigmail-dummy\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303--\r\n';

/* Implementations supplied by this module */
const NS_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";
const NS_PGP_MODULE_CONTRACTID = "@mozilla.org/mimecth/pgp;1";

const NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID =
    "@mozilla.org/network/protocol;1?name=enigmail";

const NS_ENIGMAIL_CID =
  Components.ID("{847b3a01-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGMAILPROTOCOLHANDLER_CID =
  Components.ID("{847b3a11-7ab1-11d4-8f02-006008948af5}");

const NS_PGP_MODULE_CID =
  Components.ID("{847b3af1-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGMSGCOMPOSE_CID =
  Components.ID("{847b3a21-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGMSGCOMPOSEFACTORY_CID =
  Components.ID("{847b3a22-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGCLINE_SERVICE_CID =
  Components.ID("{847b3ab1-7ab1-11d4-8f02-006008948af5}");

const ENIGMAIL_EXTENSION_ID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

// Contract IDs and CIDs used by this module
const NS_IPCSERVICE_CONTRACTID  = "@mozilla.org/process/ipc-service;1";
const NS_IPCBUFFER_CONTRACTID   = "@mozilla.org/process/ipc-buffer;1";
const NS_PIPECONSOLE_CONTRACTID = "@mozilla.org/process/pipe-console;1";
const NS_PIPETRANSPORT_CONTRACTID="@mozilla.org/process/pipe-transport;1";
const NS_PROCESS_UTIL_CONTRACTID = "@mozilla.org/process/util;1"
const NS_MSGCOMPOSESECURE_CONTRACTID = "@mozilla.org/messengercompose/composesecure;1";
const NS_ENIGMSGCOMPOSE_CONTRACTID   = "@mozilla.org/enigmail/composesecure;1";
const NS_ENIGMSGCOMPOSEFACTORY_CONTRACTID   = "@mozilla.org/enigmail/composesecure-factory;1";
const NS_ENIGMIMESERVICE_CONTRACTID = "@mozdev.org/enigmail/enigmimeservice;1";
const NS_SIMPLEURI_CONTRACTID   = "@mozilla.org/network/simple-uri;1";
const NS_TIMER_CONTRACTID       = "@mozilla.org/timer;1";
const NS_OBSERVERSERVICE_CONTRACTID = "@mozilla.org/observer-service;1";
const NS_PROMPTSERVICE_CONTRACTID = "@mozilla.org/embedcomp/prompt-service;1";
const ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const WMEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const NS_IOSERVICE_CONTRACTID       = "@mozilla.org/network/io-service;1";
const NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";
const NS_SCRIPTABLEINPUTSTREAM_CONTRACTID = "@mozilla.org/scriptableinputstream;1"
const ENIG_STRINGBUNDLE_CONTRACTID = "@mozilla.org/intl/stringbundle;1";
const NS_PREFS_SERVICE_CID = "@mozilla.org/preferences-service;1";
const NS_DOMPARSER_CONTRACTID = "@mozilla.org/xmlextras/domparser;1";
const NS_DOMSERIALIZER_CONTRACTID = "@mozilla.org/xmlextras/xmlserializer;1";
const NS_CATMAN_CONTRACTID = "@mozilla.org/categorymanager;1";
const NS_CLINE_SERVICE_CONTRACTID = "@mozilla.org/enigmail/cline-handler;1";
const NS_EXTENSION_MANAGER_CONTRACTID = "@mozilla.org/extensions/manager;1"
const NS_XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";


const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1"

// Interfaces
const nsISupports            = Components.interfaces.nsISupports;
const nsIObserver            = Components.interfaces.nsIObserver;
const nsILocalFile           = Components.interfaces.nsILocalFile;
const nsILocalFileWin        = Components.interfaces.nsILocalFileWin;
const nsIProtocolHandler     = Components.interfaces.nsIProtocolHandler;
const nsIIPCService          = Components.interfaces.nsIIPCService;
const nsIPipeConsole         = Components.interfaces.nsIPipeConsole;
const nsIEnvironment         = Components.interfaces.nsIEnvironment;
const nsIEnigmail            = Components.interfaces.nsIEnigmail;
const nsIEnigStrBundle       = Components.interfaces.nsIStringBundleService;
const nsICmdLineHandler      = Components.interfaces.nsICmdLineHandler;
const nsIWindowWatcher       = Components.interfaces.nsIWindowWatcher;
const nsICommandLineHandler  = Components.interfaces.nsICommandLineHandler;
const nsIWindowsRegKey       = Components.interfaces.nsIWindowsRegKey;
const nsIFactory             = Components.interfaces.nsIFactory

const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";

var Ec = null;

///////////////////////////////////////////////////////////////////////////////
// Global variables

const GPG_COMMENT_OPT = "Using GnuPG with %s - http://enigmail.mozdev.org/";

var gLogLevel = 3;            // Output only errors/warnings by default

var gEnigmailSvc = null;      // Global Enigmail Service
var gEnvList = [];            // Global environment list
var gEnigStrBundle;           // Global string bundle

// GPG status flags mapping (see doc/DETAILS file in the GnuPG distribution)
var gStatusFlags = {GOODSIG:         nsIEnigmail.GOOD_SIGNATURE,
                    BADSIG:          nsIEnigmail.BAD_SIGNATURE,
                    ERRSIG:          nsIEnigmail.UNVERIFIED_SIGNATURE,
                    EXPSIG:          nsIEnigmail.EXPIRED_SIGNATURE,
                    REVKEYSIG:       nsIEnigmail.GOOD_SIGNATURE,
                    EXPKEYSIG:       nsIEnigmail.EXPIRED_KEY_SIGNATURE,
                    KEYEXPIRED:      nsIEnigmail.EXPIRED_KEY,
                    KEYREVOKED:      nsIEnigmail.REVOKED_KEY,
                    NO_PUBKEY:       nsIEnigmail.NO_PUBKEY,
                    NO_SECKEY:       nsIEnigmail.NO_SECKEY,
                    IMPORTED:        nsIEnigmail.IMPORTED_KEY,
                    INV_RECP:        nsIEnigmail.INVALID_RECIPIENT,
                    MISSING_PASSPHRASE: nsIEnigmail.MISSING_PASSPHRASE,
                    BAD_PASSPHRASE:  nsIEnigmail.BAD_PASSPHRASE,
                    BADARMOR:        nsIEnigmail.BAD_ARMOR,
                    NODATA:          nsIEnigmail.NODATA,
                    ERROR:           nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.DECRYPTION_FAILED,
                    DECRYPTION_FAILED: nsIEnigmail.DECRYPTION_FAILED,
                    DECRYPTION_OKAY: nsIEnigmail.DECRYPTION_OKAY,
                    TRUST_UNDEFINED: nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_NEVER:     nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_MARGINAL:  nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_FULLY:     nsIEnigmail.TRUSTED_IDENTITY,
                    TRUST_ULTIMATE:  nsIEnigmail.TRUSTED_IDENTITY,
                    CARDCTRL:        nsIEnigmail.CARDCTRL,
                    SC_OP_FAILURE:   nsIEnigmail.SC_OP_FAILURE,
                    UNKNOWN_ALGO:    nsIEnigmail.UNKNOWN_ALGO,
                    SIG_CREATED:     nsIEnigmail.SIG_CREATED,
                    END_ENCRYPTION : nsIEnigmail.END_ENCRYPTION,
                    INV_SGNR:				 0x100000000
};

var gPGPHashNum = {md5:1, sha1:2, ripemd160:3, sha256:4, sha384:5, sha512:6, sha224:7};

var gCachedPassphrase = null;
var gCacheTimer = null;

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

const GET_BOOL = "GET_BOOL";
const GET_LINE = "GET_LINE";
const GET_HIDDEN = "GET_HIDDEN";

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

const ENC_TYPE_MSG = 0;
const ENC_TYPE_ATTACH_BINARY = 1;
const ENC_TYPE_ATTACH_ASCII = 2;

const DUMMY_AGENT_INFO = "none";
const ENIGMAIL_PANEL_URL = "chrome://enigmail/content/enigmailPanel.xul";


var gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224"];

var gKeyAlgorithms = [];

function CreateFileStream(filePath, permissions) {

  //Ec.DEBUG_LOG("enigmail.js: CreateFileStream: file="+filePath+"\n");

  try {
    var localFile;
    if (typeof filePath == "string") {
      localFile = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
      initPath(localFile, filePath);
    }
    else {
      localFile = filePath.QueryInterface(Components.interfaces.nsILocalFile);
    }

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

    fileStream.init(localFile, flags, permissions, 0);

    return fileStream;

  } catch (ex) {
    Ec.ERROR_LOG("enigmail.js: CreateFileStream: Failed to create "+filePath+"\n");
    return null;
  }
}

function WriteFileContents(filePath, data, permissions) {

  Ec.DEBUG_LOG("enigmail.js: WriteFileContents: file="+filePath.toString()+"\n");

  try {
    var fileOutStream = CreateFileStream(filePath, permissions);

    if (data.length) {
      if (fileOutStream.write(data, data.length) != data.length)
        throw Components.results.NS_ERROR_FAILURE;

      fileOutStream.flush();
    }
    fileOutStream.close();

  } catch (ex) {
    Ec.ERROR_LOG("enigmail.js: WriteFileContents: Failed to write to "+filePath+"\n");
    return false;
  }

  return true;
}

// Read the contents of a file into a string

function EnigReadFile(filePath) {

// @filePath: nsILocalFile

  if (filePath.exists()) {

    var ioServ = Components.classes[NS_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
    if (!ioServ)
      throw Components.results.NS_ERROR_FAILURE;

    var fileURI = ioServ.newFileURI(filePath);
    var fileChannel = ioServ.newChannel(fileURI.asciiSpec, null, null);

    var rawInStream = fileChannel.open();

    var scriptableInStream = Components.classes[NS_SCRIPTABLEINPUTSTREAM_CONTRACTID].createInstance(Components.interfaces.nsIScriptableInputStream);
    scriptableInStream.init(rawInStream);
    var available = scriptableInStream.available()
    var fileContents = scriptableInStream.read(available);
    scriptableInStream.close();
    return fileContents;
  }
  return "";
}


function printCmdLine(command, args) {
  return (getFilePathDesc(command)+" "+args.join(" ")).replace(/\\\\/g, "\\")
}


///////////////////////////////////////////////////////////////////////////////

// path initialization function
// uses persistentDescriptor in case that initWithPath fails
// (seems to happen frequently with UTF-8 characters in path names)
function initPath(localFileObj, pathStr) {
  localFileObj.initWithPath(pathStr);

  if (! localFileObj.exists()) {
    localFileObj.persistentDescriptor = pathStr;
  }
}

// return the human readable path of a file object
function getFilePathDesc (nsFileObj) {
  if (detectOS() == "WINNT")
    return nsFileObj.persistentDescriptor;
  else
    return nsFileObj.path;
}

// return the useable path (for gpg) of a file object
function getFilePath (nsFileObj, creationMode) {
  if (creationMode == null) creationMode = NS_RDONLY;

  if (detectOS() == "WINNT") {
    if (creationMode & NS_WRONLY) {
      // HACK to get a canonical file name
      if (!nsFileObj.exists()) {
        nsFileObj.create(nsFileObj.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);
        var nsFileObjTmp=nsFileObj.clone();
        return Ec.convertToUnicode(nsFileObjTmp.QueryInterface(nsILocalFileWin).canonicalPath, "utf-8");
      }
    }
      return Ec.convertToUnicode(nsFileObj.QueryInterface(nsILocalFileWin).canonicalPath, "utf-8");
  }

  return Ec.convertFromUnicode(nsFileObj.path, "utf-8");
}

// return the OS string from XUL runtime
function detectOS () {

  var xulAppinfo = Components.classes[NS_XPCOM_APPINFO].getService(Components.interfaces.nsIXULRuntime);
  return xulAppinfo.OS;

}


///////////////////////////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////////////////////////

function isAbsolutePath(filePath, isDosLike) {
  // Check if absolute path
  if (isDosLike) {
    return ((filePath.search(/^\w+:\\/) == 0) || (filePath.search(/^\\\\/) == 0));
  } else {
    return (filePath.search(/^\//) == 0);
  }
}

function ResolvePath(filePath, envPath, isDosLike) {
  Ec.DEBUG_LOG("enigmail.js: ResolvePath: filePath="+filePath+"\n");

  if (isAbsolutePath(filePath, isDosLike))
    return filePath;

  if (!envPath)
     return null;

  var pathDirs = envPath.split(isDosLike ? ";" : ":");

  for (var j=0; j<pathDirs.length; j++) {
     try {
        var pathDir = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);

        initPath(pathDir, pathDirs[j]);

        if (pathDir.exists() && pathDir.isDirectory()) {
           pathDir.appendRelativePath(filePath);

           if (pathDir.exists()) {
              return pathDir;
           }
        }
     } catch (ex) {
     }
  }

  return null;
}



// get a Windows registry value (string)
// @ keyPath: the path of the registry (e.g. Software\\GNU\\GnuPG)
// @ keyName: the name of the key to get (e.g. InstallDir)
// @ rootKey: HKLM, HKCU, etc. (according to constants in nsIWindowsRegKey)
function getWinRegistryString(keyPath, keyName, rootKey) {
  var registry = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);

  var retval = "";
  try {
    registry.open(rootKey, keyPath, registry.ACCESS_READ);
    retval = registry.readStringValue(keyName);
    registry.close();
  }
  catch (ex) {}

  return retval;
}

function ExtractMessageId(uri) {
  var messageId = "";

  var matches = uri.match(/^enigmail:message\?id=(.+)/);

  if (matches && (matches.length > 1)) {
    messageId = matches[1];
  }

  return messageId;
}


///////////////////////////////////////////////////////////////////////////////
// Enigmail protocol handler
///////////////////////////////////////////////////////////////////////////////

function EnigmailProtocolHandler()
{
}

EnigmailProtocolHandler.prototype = {

  classDescription: "Enigmail Protocol Handler",
  classID:          NS_ENIGMAILPROTOCOLHANDLER_CID,
  contractID:       NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID,
  scheme: "enigmail",
  defaultPort: -1,

  QueryInterface: XPCOMUtils.generateQI([nsIProtocolHandler]),

  newURI: function (aSpec, originCharset, aBaseURI) {
    Ec.DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newURI: aSpec='"+aSpec+"'\n");

    var uri = Components.classes[NS_SIMPLEURI_CONTRACTID].createInstance(Components.interfaces.nsIURI);
    uri.spec = aSpec;

    return uri;
  },

  newChannel: function (aURI) {
    Ec.DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: URI='"+aURI.spec+"'\n");

    var messageId = ExtractMessageId(aURI.spec);

    if (messageId) {
      // Handle enigmail:message?id=...

      if (!gEnigmailSvc)
        throw Components.results.NS_ERROR_FAILURE;

      var contentType, contentCharset, contentData;

      if (gEnigmailSvc._messageIdList[messageId]) {
        var messageUriObj = gEnigmailSvc._messageIdList[messageId];

        contentType    = messageUriObj.contentType;
        contentCharset = messageUriObj.contentCharset;
        contentData    = messageUriObj.contentData;

        Ec.DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: messageURL="+messageUriObj.originalUrl+", content length="+contentData.length+", "+contentType+", "+contentCharset+"\n");

        // do NOT delete the messageUriObj now from the list, this will be done once the message is unloaded (fix for bug 9730).

      } else {

        contentType = "text/plain";
        contentCharset = "";
        contentData = "Enigmail error: invalid URI "+aURI.spec;
      }

      var channel = gEnigmailSvc.ipcService.newStringChannel(aURI,
                                                      contentType,
                                                      "UTF-8",
                                                      contentData);

      return channel;
    }

    if (aURI.spec == aURI.scheme+":dummy") {
      // Dummy PKCS7 content (to access mimeEncryptedClass)
      channel = gEnigmailSvc.ipcService.newStringChannel(aURI,
                                                         "message/rfc822",
                                                          "",
                                                          gDummyPKCS7);
      return channel;
    }

    var winName, spec;
    if (aURI.spec == "about:"+aURI.scheme) {
      // About Enigmail
      winName = "about:"+enigmail;
      spec = "chrome://enigmail/content/enigmailAbout.xul";

    } else if (aURI.spec == aURI.scheme+":console") {
      // Display enigmail console messages
      winName = "enigmail:console";
      spec = "chrome://enigmail/content/enigmailConsole.xul";

    } else if (aURI.spec == aURI.scheme+":keygen") {
      // Display enigmail key generation console
      winName = "enigmail:keygen";
      spec = "chrome://enigmail/content/enigmailKeygen.xul";

    } else {
      // Display Enigmail about page
      winName = "about:enigmail";
      spec = "chrome://enigmail/content/enigmailAbout.xul";
    }

    var windowManager = Components.classes[WMEDIATOR_CONTRACTID].getService(Components.interfaces.nsIWindowMediator);

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
      var appShellSvc = Components.classes[ASS_CONTRACTID].getService(Components.interfaces.nsIAppShellService);
      var domWin = appShellSvc.hiddenDOMWindow;

      domWin.open(spec, "_blank", "chrome,menubar,toolbar,resizable");
    }

    throw Components.results.NS_ERROR_FAILURE;
  }
};


///////////////////////////////////////////////////////////////////////////////
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

function GetPassphrase(domWindow, passwdObj, useAgentObj, rememberXTimes) {
  Ec.DEBUG_LOG("enigmail.js: GetPassphrase:\n");

  useAgentObj.value = false;
  try {
    var noPassphrase = gEnigmailSvc.prefBranch.getBoolPref("noPassphrase");
    useAgentObj.value = gEnigmailSvc.useGpgAgent();

    if (noPassphrase || useAgentObj.value) {
      passwdObj.value = "";
      return true;
    }

  }
  catch(ex) {}

  var maxIdleMinutes = gEnigmailSvc.getMaxIdleMinutes();

  if (gEnigmailSvc.haveCachedPassphrase()) {
    passwdObj.value = gCachedPassphrase;

    if (gEnigmailSvc._passwdAccessTimes > 0) {
      --gEnigmailSvc._passwdAccessTimes;

      if (gEnigmailSvc._passwdAccessTimes <= 0 && maxIdleMinutes <= 0) {
        gEnigmailSvc.clearCachedPassphrase();
      }
    }
    return true;
  }

  // Obtain password interactively
  var checkObj = new Object();

  var promptMsg = Ec.getString("enterPassOrPin");
  passwdObj.value = "";
  checkObj.value = true;

  var checkMsg = (maxIdleMinutes>0) ? Ec.getString("rememberPass",maxIdleMinutes) : "";

  var success;

  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  success = promptService.promptPassword(domWindow,
                                         Ec.getString("enigPrompt"),
                                         promptMsg,
                                         passwdObj,
                                         checkMsg,
                                         checkObj);

  if (!success)
    return false;

  Ec.DEBUG_LOG("enigmail.js: GetPassphrase: got passphrase\n");

  // remember the passphrase for accessing serveral times in a sequence

  if (rememberXTimes) gEnigmailSvc._passwdAccessTimes = rememberXTimes;

  // Remember passphrase only if necessary
  if ((checkObj.value && (maxIdleMinutes > 0)) || rememberXTimes)
    gEnigmailSvc.setCachedPassphrase(passwdObj.value, rememberXTimes);

  return true;
}

// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email address
function EnigStripEmail(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       Ec.ERROR_LOG("enigmail.js: EnigStripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
       mailAddrs=mailAddrs.replace(/\"/g, "");
       break;
     }

     mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
  }

  // Eliminate all whitespace, just to be safe
  mailAddrs = mailAddrs.replace(/\s+/g,"");

  // Extract pure e-mail address list (stripping out angle brackets)
  mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

  return mailAddrs;
}

// Locates STRing in TEXT occurring only at the beginning of a line
function IndexOfArmorDelimiter(text, str, offset) {
  //Ec.DEBUG_LOG("enigmail.js: IndexOfArmorDelimiter: "+str+", "+offset+"\n");

  while (offset < text.length) {

    var loc = text.indexOf(str, offset);

    if ((loc < 1) || (text.charAt(loc-1) == "\n"))
      return loc;

    offset = loc + str.length;
  }

  return -1;
}


function Enigmail()
{
  Components.utils.import("resource://enigmail/enigmailCommon.jsm");
  Ec = EnigCommon;
}

Enigmail.prototype = {

  classDescription: "Enigmail",
  classID:  NS_ENIGMAIL_CID,
  contractID: NS_ENIGMAIL_CONTRACTID,

  initialized: false,
  initializationAttempted: false,
  initializationError: "",
  composeSecure: false,
  logFileStream: null,

  isUnix   : false,
  isWin32  : false,
  isMacOs  : false,
  isOs2    : false,
  isDosLike: false,

  ipcService: null,
  prefBranch: null,
  console:    null,
  keygenProcess: null,
  keygenConsole: null,

  agentType: "",
  agentPath: "",
  agentVersion: "",
  gpgAgentProcess: null,
  userIdList: null,
  rulesList: null,
  gpgAgentInfo: {preStarted: false, envStr: ""},

  _lastActiveTime: 0,
  _passwdAccessTimes: 0,
  _messageIdList: {},
  _xpcom_factory: {
    createInstance: function (aOuter, iid) {
      // Enigmail is a service -> only instanciate once
      if (gEnigmailSvc == null) {
        gEnigmailSvc = new Enigmail();
      }
      return gEnigmailSvc;
    },
    lockFactory: function (lock) {}
  },
  QueryInterface: XPCOMUtils.generateQI([ nsIEnigmail, nsIObserver, nsISupports ]),


  observe: function (aSubject, aTopic, aData) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.observe: topic='"+aTopic+"' \n");

    if (aTopic == "timer-callback") {
      // Cause cached password to expire, if need be
      if (!this.haveCachedPassphrase()) {
        // No cached password; cancel repeating timer
        if (gCacheTimer)
          gCacheTimer.cancel();
      }

    } else if (aTopic == NS_XPCOM_SHUTDOWN_OBSERVER_ID) {
      // XPCOM shutdown
      this.finalize();

    }
    else {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.observe: no handler for '"+aTopic+"'\n");
    }
  },

  alertMsg: function (domWindow, mesg) {
    var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
    return promptService.alert(domWindow, Ec.getString("enigAlert"), mesg);
  },

  confirmMsg: function (domWindow, mesg, okLabel, cancelLabel) {
    var dummy={};
    var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);

    var buttonTitles = 0;
    if (okLabel == null && cancelLabel == null) {
      buttonTitles = (promptService.BUTTON_TITLE_YES * ENIG_BUTTON_POS_0) +
                     (promptService.BUTTON_TITLE_NO * ENIG_BUTTON_POS_1);
    }
    else {
      if (okLabel != null) {
        buttonTitles += (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0);
      }
      else {
        buttonTitles += promptService.BUTTON_TITLE_OK * promptService.BUTTON_POS_1;
      }

      if (cancelLabel != null) {
        buttonTitles += (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_1);
      }
      else {
        buttonTitles += promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1;
      }
    }

    var buttonPressed = promptService.confirmEx(domWindow,
                          Ec.getString("enigConfirm"),
                          mesg,
                          buttonTitles,
                          okLabel, cancelLabel, null,
                          null, dummy);
    return (buttonPressed==0);
  },

  promptValue: function (domWindow, mesg, valueObj) {
    var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
    var checkObj = new Object();
    return promptService.prompt(domWindow, Ec.getString("enigPrompt"),
                                 mesg, valueObj, "", checkObj);
  },

  errorMsg: function (domWindow, mesg) {
    var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
    return promptService.alert(domWindow, Ec.getString("enigError"), mesg);
  },

  getMaxIdleMinutes: function () {
    var maxIdleMinutes = 5;
    try {
      maxIdleMinutes = this.prefBranch.getIntPref("maxIdleMinutes");
    } catch (ex) {
    }

    return maxIdleMinutes;
  },

  getLogDirectoryPrefix: function () {
    var logDirectory = "";
    try {
      logDirectory = this.prefBranch.getCharPref("logDirectory");
    } catch (ex) {
    }

    if (!logDirectory)
      return "";

    var dirPrefix = logDirectory + (this.isDosLike ? "\\" : "/");

    return dirPrefix;
  },

  stillActive: function () {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.stillActive: \n");

    // Update last active time
    var curDate = new Date();
    this._lastActiveTime = curDate.getTime();
  //  Ec.DEBUG_LOG("enigmail.js: Enigmail.stillActive: _lastActiveTime="+this._lastActiveTime+"\n");
  },


  clearCachedPassphrase: function () {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.clearCachedPassphrase: \n");

    gCachedPassphrase = null;
  },

  setCachedPassphrase: function (passphrase) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.setCachedPassphrase: \n");

    gCachedPassphrase = passphrase;
    this.stillActive();

    var maxIdleMinutes = this.getMaxIdleMinutes();

    var createTimerType = null;
    const nsITimer = Components.interfaces.nsITimer;

    if (this.haveCachedPassphrase() && (this._passwdAccessTimes > 0) && (maxIdleMinutes <= 0)) {
      // we remember the passphrase for at most 1 minute
      createTimerType = nsITimer.TYPE_ONE_SHOT;
      maxIdleMinutes = 1;
    }
    else if (this.haveCachedPassphrase() && (maxIdleMinutes > 0)) {
      createTimerType = nsITimer.TYPE_REPEATING_SLACK;
    }

    if (createTimerType != null) {
      // Start timer
      if (gCacheTimer)
        gCacheTimer.cancel();

      var delayMillisec = maxIdleMinutes*60*1000;

      gCacheTimer = Components.classes[NS_TIMER_CONTRACTID].createInstance(nsITimer);

      if (!gCacheTimer) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.setCachedPassphrase: Error - failed to create timer\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

      gCacheTimer.init(this, delayMillisec,
                        createTimerType);

      Ec.DEBUG_LOG("enigmail.js: Enigmail.setCachedPassphrase: gCacheTimer="+gCacheTimer+"\n");
    }
  },

  haveCachedPassphrase: function () {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.haveCachedPassphrase: \n");

    var havePassphrase = ((typeof gCachedPassphrase) == "string");

    if (!havePassphrase)
      return false;

    var curDate = new Date();
    var currentTime = curDate.getTime();

    var maxIdleMinutes = this.getMaxIdleMinutes();
    var delayMillisec = maxIdleMinutes*60*1000;

    var expired = ((currentTime - this._lastActiveTime) >= delayMillisec);

  //  Ec.DEBUG_LOG("enigmail.js: Enigmail.haveCachedPassphrase: ")
  //  Ec.DEBUG_LOG("currentTime="+currentTime+", _lastActiveTime="+this._lastActiveTime+", expired="+expired+"\n");

    if (expired && (this._passwdAccessTimes <= 0)) {
      // Too much idle time; forget cached password
      gCachedPassphrase = null;
      havePassphrase = false;

      Ec.WRITE_LOG("enigmail.js: Enigmail.haveCachedPassphrase: CACHE IDLED OUT\n");
    }

    return havePassphrase;
  },


  finalize: function () {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.finalize:\n");
    if (!this.initialized) return;

    if (this.gpgAgentProcess != null) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.finalize: stopping gpg-agent PID="+this.gpgAgentProcess+"\n");
      try {
        var installLoc = Components.classes[NS_EXTENSION_MANAGER_CONTRACTID]
                 .getService(Components.interfaces.nsIExtensionManager)
                 .getInstallLocation(ENIGMAIL_EXTENSION_ID);
        var extensionLoc = installLoc.getItemFile(ENIGMAIL_EXTENSION_ID, "wrappers");
        extensionLoc.append("gpg-agent-wrapper.sh");
        try {
          extensionLoc.permissions=0755;
        }
        catch(ex) {}

        agentProcess = Components.classes[NS_PROCESS_UTIL_CONTRACTID].createInstance(Components.interfaces.nsIProcess);
        agentProcess.init(extensionLoc);
        agentProcess.run(true, [ "stop", this.gpgAgentProcess ], 2);
      }
      catch (ex) {
      }
    }

    if (this.logFileStream) {
      this.logFileStream.close();
      this.logFileStream = null;
    }

    if (this.console) {
      this.console.shutdown();
      this.console = null;
    }

    gLogLevel = 3;
    this.initializationError = "";
    this.initializationAttempted = false;
    this.initialized = false;
  },


  mimeInitialized: function () {
    var enigMimeService = Components.classes[NS_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

    var value = enigMimeService.initialized;
    Ec.DEBUG_LOG("enigmail.js: Enigmail.mimeInitialized: "+value+"\n");
    return value;
  },

  initialize: function (domWindow, version, prefBranch) {
    this.initializationAttempted = true;

    this.prefBranch = prefBranch;

    Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: START\n");
    if (this.initialized) return;

    this.composeSecure = true;
    try {
      if (XPCOMUtils.generateNSGetModule) {
        // Gecko 1.9.x
        var enigMsgComposeFactory = Components.classes[NS_ENIGMSGCOMPOSEFACTORY_CONTRACTID].createInstance(Components.interfaces.nsIFactory);

        var compMgr = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);

        compMgr.registerFactory(NS_ENIGMSGCOMPOSE_CID,
                                "Enig Msg Compose",
                                NS_MSGCOMPOSESECURE_CONTRACTID,
                                enigMsgComposeFactory);

        var msgComposeSecureCID = compMgr.contractIDToCID(NS_MSGCOMPOSESECURE_CONTRACTID);

        this.composeSecure = (msgComposeSecureCID.toString() ==
                              NS_ENIGMSGCOMPOSE_CID);
      }
      else
        this.composeSecure = true;
    } catch (ex) {
      Ec.ERROR_LOG("could not register Enig Msg Compose handler\n");
    }

    var ioServ = Components.classes[NS_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

    try {
      var httpHandler = ioServ.getProtocolHandler("http");
      httpHandler = httpHandler.QueryInterface(Components.interfaces.nsIHttpProtocolHandler);
    }
    catch (ex) {
      httpHandler = domWindow.navigator;
    }

    this.oscpu = httpHandler.oscpu;

    this.platform = httpHandler.platform;

    if (httpHandler.vendor) {
      this.vendor = httpHandler.vendor;
    } else {
      this.vendor = "Mozilla";
    }

    this.isUnix  = (this.platform.search(/X11/i) == 0);
    this.isWin32 = (this.platform.search(/Win/i) == 0);
    this.isOs2   = (this.platform.search(/OS\/2/i) == 0);
    this.isMacOs = (this.platform.search(/Mac/i) == 0);

    this.isDosLike = (this.isWin32 || this.isOs2);

    var prefix = this.getLogDirectoryPrefix();
    if (prefix) {
      gLogLevel = 5;
      this.logFileStream = CreateFileStream(prefix+"enigdbug.txt");
      Ec.DEBUG_LOG("enigmail.js: Logging debug output to "+prefix+"enigdbug.txt\n");
    }

    Ec.initialize(this, gLogLevel);
    this.version = version;

    Ec.DEBUG_LOG("enigmail.js: Enigmail version "+this.version+"\n");
    Ec.DEBUG_LOG("enigmail.js: OS/CPU="+this.oscpu+"\n");
    Ec.DEBUG_LOG("enigmail.js: Platform="+this.platform+"\n");
    Ec.DEBUG_LOG("enigmail.js: composeSecure="+this.composeSecure+"\n");

    var environment;
    try {
      environment = Components.classes["@mozilla.org/process/environment;1"].getService(nsIEnvironment);

    } catch (ex) {
      this.initializationError = Ec.getString("enigmimeNotAvail");
      Ec.ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    this.environment = environment;

    var nspr_log_modules = environment.get("NSPR_LOG_MODULES");
    var matches = nspr_log_modules.match(/enigmail:(\d+)/);

    if (matches && (matches.length > 1)) {
      gLogLevel = matches[1];
      WARNING_LOG("enigmail.js: Enigmail: gLogLevel="+gLogLevel+"\n");
    }

    // Initialize global environment variables list
    var passEnv = [ "GNUPGHOME", "GPGDIR", "ETC",
                    "ALLUSERSPROFILE", "APPDATA", "BEGINLIBPATH",
                    "COMMONPROGRAMFILES", "COMSPEC", "DISPLAY",
                    "ENIGMAIL_PASS_ENV", "ENDLIBPATH",
                    "HOME", "HOMEDRIVE", "HOMEPATH",
                    "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE",  "LC_CTYPE",
                    "LC_MESSAGES",  "LC_MONETARY", "LC_NUMERIC", "LC_TIME",
                    "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
                    "NLSPATH", "PATH", "PATHEXT", "PROGRAMFILES", "PWD",
                    "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
                    "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR", "UNIXROOT",
                    "USER", "USERPROFILE", "WINDIR" ];

    var passList = this.environment.get("ENIGMAIL_PASS_ENV");
    if (passList) {
      var passNames = passList.split(":");
      for (var k=0; k<passNames.length; k++)
        passEnv.push(passNames[k]);
    }

    gEnvList = [];
    for (var j=0; j<passEnv.length; j++) {
      var envName = passEnv[j];
      var envValue = this.environment.get(envName);
      if (envValue)
         gEnvList.push(envName+"="+envValue);
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: gEnvList = "+gEnvList+"\n");

    try {
      // Access IPC Service

      var ipcService = Components.classes[NS_IPCSERVICE_CONTRACTID].getService();
      ipcService = ipcService.QueryInterface(nsIIPCService);

      this.ipcService = ipcService;

      // Create a non-joinable console
      var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(nsIPipeConsole);

      pipeConsole.open(499, 0, false);

      this.console = pipeConsole;

      pipeConsole.write("Initializing Enigmail service ...\n");

    } catch (ex) {
      this.initializationError = Ec.getString("enigmimeNotAvail");
      Ec.ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    this.setAgentPath(domWindow);

    this.detectGpgAgent(domWindow);

    if (this.useGpgAgent() && (! this.isDosLike)) {
      if (this.gpgAgentInfo.envStr != DUMMY_AGENT_INFO)
        gEnvList.push("GPG_AGENT_INFO="+this.gpgAgentInfo.envStr);
    }




    // Register to observe XPCOM shutdown
    var obsServ = Components.classes[NS_OBSERVERSERVICE_CONTRACTID].getService();
    obsServ = obsServ.QueryInterface(Components.interfaces.nsIObserverService);

    obsServ.addObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);

    this.stillActive();
    this.initialized = true;

    Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: END\n");
  },

  useGpgAgent: function() {
    var useAgent = false;

    try {
      if (this.isDosLike && this.agentVersion < "2.0") {
        useAgent = false;
      }
      else {
        useAgent = (this.gpgAgentInfo.envStr.length>0 || this.prefBranch.getBoolPref("useGpgAgent"));
      }
    }
    catch (ex) {}
    return useAgent;
  },


  reinitialize: function () {
    this.initialized = false;
    this.initializationAttempted = true;

    this.console.write("Reinitializing Enigmail service ...\n");
    this.setAgentPath();
    this.initialized = true;
  },


  determineGpgHomeDir: function () {

    var homeDir = "";

    homeDir = this.environment.get("GNUPGHOME");

    if (! homeDir && this.isWin32) {
      homeDir=getWinRegistryString("Software\\GNU\\GNUPG", "HomeDir", nsIWindowsRegKey.ROOT_KEY_CURRENT_USER);

      if (! homeDir) {
        homeDir = this.environment.get("USERPROFILE");

        if (! homeDir) {
          homeDir = this.environment.get("SystemRoot");
        }

        if (homeDir) homeDir += "\\Application Data\\GnuPG";
      }

      if (! homeDir) homeDir = "C:\\gnupg";
    }

    if (! homeDir) homeDir = this.environment.get("HOME")+"/.gnupg";

    return homeDir;
  },


  setAgentPath: function () {
    var agentPath = "";
    try {
      agentPath = this.prefBranch.getCharPref("agentPath");
    } catch (ex) {}

    var agentType = "gpg";
    var agentName = this.isDosLike ? agentType+".exe" : agentType;

    if (agentPath) {
      // Locate GnuPG executable

      // Append default .exe extension for DOS-Like systems, if needed
      if (this.isDosLike && (agentPath.search(/\.\w+$/) < 0))
        agentPath += ".exe";

      try {
        var pathDir = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);

        if (! isAbsolutePath(agentPath, this.isDosLike)) {
          // path relative to Mozilla installation dir
          var ds = Components.classes[DIR_SERV_CONTRACTID].getService();
          var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
          pathDir = dsprops.get("CurProcD", Components.interfaces.nsILocalFile);

          var dirs=agentPath.split(RegExp(this.isDosLike ? "\\\\" : "/"));
          for (var i=0; i< dirs.length; i++) {
            if (dirs[i]!=".") {
              pathDir.append(dirs[i]);
            }
          }
          pathDir.normalize();
        }
        else {
          // absolute path
          initPath(pathDir, agentPath);
        }
        if (! (pathDir.isFile() /* && pathDir.isExecutable()*/))
          throw Components.results.NS_ERROR_FAILURE;
        agentPath = pathDir.QueryInterface(Components.interfaces.nsIFile);

      } catch (ex) {
        this.initializationError = Ec.getString("gpgNotFound", agentPath);
        Ec.ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

    } else {
      // Resolve relative path using PATH environment variable
      var envPath = this.environment.get("PATH");

      agentPath = ResolvePath(agentName, envPath, this.isDosLike);

      if (!agentPath && this.isDosLike) {
        // DOS-like systems: search for GPG in c:\gnupg, c:\gnupg\bin, d:\gnupg, d:\gnupg\bin
        var gpgPath = "c:\\gnupg;c:\\gnupg\\bin;d:\\gnupg;d:\\gnupg\\bin";
        agentPath = ResolvePath(agentName, gpgPath, this.isDosLike);
      }

      if ((! agentPath) && this.isWin32) {
        // Look up in Windows Registry
        var enigMimeService = Components.classes[NS_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
        try {
          gpgPath = getWinRegistryString("Software\\GNU\\GNUPG", "Install Directory", nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE);
          agentPath = ResolvePath(agentName, gpgPath, this.isDosLike)
        }
        catch (ex) {}
      }

      if (!agentPath && !this.isDosLike) {
        // Unix-like systems: check /usr/bin and /usr/local/bin
        gpgPath = "/usr/bin:/usr/local/bin";
        agentPath = ResolvePath(agentName, gpgPath, this.isDosLike)
      }

      if (!agentPath) {
        this.initializationError = Ec.getString("gpgNotInPath");
        Ec.ERROR_LOG("enigmail.js: Enigmail: Error - "+this.initializationError+"\n");
        throw Components.results.NS_ERROR_FAILURE;
      }
      agentPath = agentPath.QueryInterface(Components.interfaces.nsIFile);
    }

    Ec.CONSOLE_LOG("EnigmailAgentPath="+getFilePathDesc(agentPath)+"\n\n");

    this.agentType = agentType;
    this.agentPath = agentPath;

    var command = agentPath;
    var args = [];
    if (agentType == "gpg") {
       args = [ "--version", "--version", "--batch", "--no-tty", "--charset", "utf8", "--display-charset", "utf8" ];
    }

    // This particular command execution seems to be essential on win32
    // (In particular, this should be the first command executed and
    //  *should* use the shell, i.e., command.com)
    var outStrObj = new Object();
    var outLenObj = new Object();
    var errStrObj = new Object();
    var errLenObj = new Object();

    var exitCode = this.ipcService.runPipe(command, args, args.length,
                                  "", "", 0, [], 0,
                                  outStrObj, outLenObj, errStrObj, errLenObj);

    Ec.CONSOLE_LOG("enigmail> "+printCmdLine(command, args)+"\n");

    var outStr = outStrObj.value;
    if (errStrObj.value)
      outStr += errStrObj.value;

    Ec.CONSOLE_LOG(outStr+"\n");

    // detection for Gpg4Win wrapper
    if (outStr.search(/^gpgwrap.*;/) == 0) {
      var outLines = outStr.split(/[\n\r]+/);
      var firstLine = outLines[0];
      outLines.splice(0,1);
      outStr = outLines.join("\n");
      agentPath = firstLine.replace(/^.*;[ \t]*/, "")

      Ec.CONSOLE_LOG("gpg4win-gpgwrapper detected; EnigmailAgentPath="+agentPath+"\n\n");
    }

    var versionParts = outStr.replace(/[\r\n].*/g,"").replace(/ *\(gpg4win.*\)/i, "").split(/ /);
    var gpgVersion = versionParts[versionParts.length-1]

    Ec.DEBUG_LOG("enigmail.js: detected GnuPG version '"+gpgVersion+"'\n");
    this.agentVersion = gpgVersion;

    // check GnuPG version number
    var evalVersion = this.agentVersion.match(/^\d+\.\d+/)
    if (evalVersion && evalVersion[0]<"1.2") {
      this.alertMsg(domWindow, Ec.getString("oldGpgVersion", gpgVersion));
      throw Components.results.NS_ERROR_FAILURE;
    }
  },

  detectGpgAgent: function (domWindow) {
    Ec.DEBUG_LOG("enigmail.js: detectGpgAgent\n");

    function extractAgentInfo(fullStr) {
      if (fullStr) {
        fullStr = fullStr.replace(/^.*\=/,"");
        fullStr = fullStr.replace(/^\;.*$/,"");
        fullStr = fullStr.replace(/[\n\r]*/g,"");
        return fullStr;
      }
      else
        return "";
    }


    function resolveAgentPath(fileName) {
      var filePath = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);

      if (gEnigmailSvc.isDosLike) {
        fileName += ".exe";
      }

      filePath = gEnigmailSvc.agentPath.clone();

      if (filePath) filePath = filePath.parent;
      if (filePath) {
        filePath.append(fileName);
        if (filePath.exists()) {
          filePath.normalize();
          return filePath;
        }
      }

      var foundPath = ResolvePath(fileName, gEnigmailSvc.environment.get("PATH"), gEnigmailSvc.isDosLike)
      if ((! foundPath) && gEnigmailSvc.isWin32) {
        // Look up in Windows Registry
        var enigMimeService = Components.classes[NS_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
        try {
          var regPath = enigMimeService.getGpgPathFromRegistry();
          foundPath = ResolvePath(fileName, regPath, gEnigmailSvc.isDosLike)
        }
        catch (ex) {}
      }

      if (foundPath != null) { foundPath.normalize(); }
      return foundPath;
    }

    var gpgAgentInfo = this.environment.get("GPG_AGENT_INFO");
    if (gpgAgentInfo && gpgAgentInfo.length>0) {
      Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO variable available\n");
      // env. variable suggests running gpg-agent
      this.gpgAgentInfo.preStarted = true;
      this.gpgAgentInfo.envStr = gpgAgentInfo;
    }
    else {
      Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: no GPG_AGENT_INFO variable set\n");
      this.gpgAgentInfo.preStarted = false;

      if (this.agentVersion >= "2.0") {
        var command = null;
        var gpgConnectAgent = resolveAgentPath("gpg-connect-agent");

        var outStrObj = new Object();
        var outLenObj = new Object();
        var errStrObj = new Object();
        var errLenObj = new Object();

        if (gpgConnectAgent && gpgConnectAgent.isExecutable()) {
          // try to connect to a running gpg-agent

          Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: gpg-connect-agent is executable\n");

          this.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;

          command = gpgConnectAgent.QueryInterface(Components.interfaces.nsIFile);
          var exitCode = -1;

          Ec.CONSOLE_LOG("enigmail> "+command.path+"\n");
          try {
            var inputTxt="/echo OK\n";
            exitCode = this.ipcService.runPipe(command, [], 0,
                                        "", inputTxt, inputTxt.length,
                                        gEnvList, gEnvList.length,
                                        outStrObj, outLenObj, errStrObj, errLenObj);

            if (exitCode==0 || outStrObj.value.substr(0,2)=="OK") {
              Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: found running gpg-agent\n");
              return;
            }
            else
              Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: no running gpg-agent. Output='"+outStrObj.value+"' error text='"+errStrObj.value+"'\n");
          }
          catch (ex) {
            Ec.ERROR_LOG("enigmail.js: detectGpgAgent: "+command.path+" failed\n");
          }

        }

        // and finally try to start gpg-agent
        var args = [];
        var commandFile = resolveAgentPath("gpg-agent");
        var agentProcess = null;

        if ((! commandFile) || (! commandFile.exists())) {
          commandFile = resolveAgentPath("gpg-agent2");
        }

        if (commandFile  && commandFile.exists()) {
          command = commandFile.QueryInterface(Components.interfaces.nsIFile);
        }

        if (command == null) {
          Ec.ERROR_LOG("enigmail.js: detectGpgAgent: gpg-agent not found\n");
          this.alertMsg(domWindow, Ec.getString("gpgAgentNotStarted", this.agentVersion));
          throw Components.results.NS_ERROR_FAILURE;
        }

        if (! this.isDosLike) {
          args = [ "--sh", "--no-use-standard-socket",
                  "--daemon",
                  "--default-cache-ttl", (this.getMaxIdleMinutes()*60).toString(),
                  "--max-cache-ttl", "999999" ];  // ca. 11 days

          try {
            var installLoc = Components.classes[NS_EXTENSION_MANAGER_CONTRACTID]
                     .getService(Components.interfaces.nsIExtensionManager)
                     .getInstallLocation(ENIGMAIL_EXTENSION_ID);
            var extensionLoc = installLoc.getItemFile(ENIGMAIL_EXTENSION_ID, "wrappers");
            extensionLoc.append("gpg-agent-wrapper.sh");
            try {
              extensionLoc.permissions=0755;
            }
            catch(ex) {}
            args.unshift(command.path);
            args.unshift("start");
            command = extensionLoc;
            exitCode = this.ipcService.runPipe(command, args, args.length,
                                          "", "", 0,
                                          gEnvList, gEnvList.length,
                                          outStrObj, outLenObj, errStrObj, errLenObj);

          }
          catch (ex) {
            Ec.ERROR_LOG("enigmail.js: detectGpgAgent: "+command+" failed\n");
            exitCode = -1;
          }

          Ec.CONSOLE_LOG("enigmail> "+printCmdLine(command, args)+"\n");

          if (exitCode == 0) {
            this.gpgAgentInfo.envStr = extractAgentInfo(outStrObj.value);
            this.gpgAgentProcess = this.gpgAgentInfo.envStr.split(":")[1];
          }
          else {
            Ec.ERROR_LOG("enigmail.js: detectGpgAgent: gpg-agent output: "+errStrObj.value+"\n");
            this.alertMsg(domWindow, Ec.getString("gpgAgentNotStarted", this.agentVersion));
            throw Components.results.NS_ERROR_FAILURE;
          }
        }
        else {
          this.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;
          initPath(envFile, this.determineGpgHomeDir());
          envFile.append("gpg-agent.conf");

          var data="default-cache-ttl " + (this.getMaxIdleMinutes()*60)+"\n";
          data += "max-cache-ttl 999999";
          if (! envFile.exists()) {
            try {
              var flags = 0x02 | 0x08 | 0x20;
              var fileOutStream = Components.classes[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Components.interfaces.nsIFileOutputStream);
              fileOutStream.init(envFile, flags, 0600, 0);
              fileOutStream.write(data, data.length);
              fileOutStream.flush();
              fileOutStream.close();
            }
            catch (ex) {} // ignore file write errors
          }
        }
      }
      else {
        Ec.DEBUG_LOG("enigmail.js: detectGpgAgent - gpg 1.x found\n");
      }
    }
    Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO='"+this.gpgAgentInfo.envStr+"'\n");
  },


  getAgentArgs: function (withBatchOpts) {
  // return the arguments to pass to every call GnuPG

    function pushTrimmedStr(arr, str, splitStr) {
      // Helper function for pushing a string without leading/trailing spaces
      // to an array
      str = str.replace(/^ */, "").replace(/ *$/, "");
      if (str.length > 0) {
        if (splitStr) {
          var tmpArr = str.split(/[\t ]+/);
          for (var i=0; i< tmpArr.length; i++) {
            arr.push(tmpArr[i]);
          }
        }
        else {
          arr.push(str);
        }
      }
      return (str.length > 0);
    }


    var r = [ "--charset", "utf8" ]; // mandatory parameter to add in all cases

    try {
      var p = "";
      p=this.prefBranch.getCharPref("agentAdditionalParam").replace(/\\\\/g, "\\");

      var i = 0;
      var last = 0;
      var foundSign="";
      var startQuote=-1;

      while ((i=p.substr(last).search(/['"]/)) >= 0) {
        if (startQuote==-1) {
          startQuote = i;
          foundSign=p.substr(last).charAt(i);
          last = i +1;
        }
        else if (p.substr(last).charAt(i) == foundSign) {
          // found enquoted part
          if (startQuote > 1) pushTrimmedStr(r, p.substr(0, startQuote), true);

          pushTrimmedStr(r, p.substr(startQuote + 1, last + i - startQuote -1), false);
          p = p.substr(last + i + 1);
          last = 0;
          startQuote = -1;
          foundSign = "";
        }
        else {
          last = last + i + 1;
        }
      }

      pushTrimmedStr(r, p, true);
    }
    catch (ex) {}


    if (withBatchOpts) {
      r = r.concat(GPG_BATCH_OPT_LIST);
    }

    return r;
  },


  passwdCommand: function () {

    var commandArgs = [];

    try {
      var  gpgVersion = this.agentVersion.match(/^\d+\.\d+/);
      if (this.useGpgAgent()) {
         commandArgs.push("--use-agent");
      }
      else {
        if (! gEnigmailSvc.prefBranch.getBoolPref("noPassphrase")) {
          commandArgs.push("--passphrase-fd");
          commandArgs.push("0");
          if (gpgVersion && gpgVersion[0] >= "1.1") {
            commandArgs.push("--no-use-agent");
          }
        }
      }
    } catch (ex) {}

    return commandArgs;
  },

  /***
   * determine if a password is required to be sent to GnuPG
   */
  requirePassword: function () {
    if (this.useGpgAgent()) {
      return false;
    }

    return (! gEnigmailSvc.prefBranch.getBoolPref("noPassphrase"));
  },

  fixExitCode: function (exitCode, statusFlags) {
    if (exitCode != 0) {
      if ((statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
          (statusFlags & nsIEnigmail.DECRYPTION_OKAY )) {
        Ec.DEBUG_LOG("enigmail.js: Enigmail.fixExitCode: Changing exitCode for decrypted msg "+exitCode+"->0\n");
        exitCode = 0;
      }
    }
    if ((this.agentType == "gpg") && (exitCode == 256)) {
      WARNING_LOG("enigmail.js: Enigmail.fixExitCode: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
      if (statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
        WARNING_LOG("enigmail.js: Enigmail.fixExitCode: Changing exitCode 256->2\n");
        exitCode = 2;
      } else {
        WARNING_LOG("enigmail.js: Enigmail.fixExitCode: Changing exitCode 256->0\n");
        exitCode = 0;
      }
    }
    if (((this.agentVersion >= "1.3") && (this.agentVersion < "1.4.1" )) && (this.isDosLike)) {
        if ((exitCode == 2) && (!(statusFlags & (nsIEnigmail.BAD_PASSPHRASE |
                                nsIEnigmail.UNVERIFIED_SIGNATURE |
                                nsIEnigmail.MISSING_PASSPHRASE |
                                nsIEnigmail.BAD_ARMOR |
                                nsIEnigmail.DECRYPTION_INCOMPLETE |
                                nsIEnigmail.DECRYPTION_FAILED |
                                nsIEnigmail.NO_PUBKEY |
                                nsIEnigmail.NO_SECKEY)))) {
        WARNING_LOG("enigmail.js: Enigmail.fixExitCode: Using gpg version "+this.agentVersion+", activating countermeasures for file renaming bug.\n");
        exitCode = 0;
      }
    }
    return exitCode;
  },


  simpleExecCmd: function (command, args, exitCodeObj, errorMsgObj) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.simpleExecCmd: command = "+command+" "+args.join(" ")+"\n");

    var envList = [];
    envList = envList.concat(gEnvList);

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {

      WriteFileContents(prefix+"enigcmd.txt", printCmdLine(command, args)+"\n");
      WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

      Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
    }

    var outObj = new Object();
    var errObj = new Object();
    var outLenObj = new Object();
    var errLenObj = new Object();

    Ec.CONSOLE_LOG("\nenigmail> "+printCmdLine(command, args)+"\n");

    try {
      exitCodeObj.value = gEnigmailSvc.ipcService.runPipe(command,
                                                          args,
                                                          args.length,
                                                          "",
                                                          "", 0,
                                                          envList, envList.length,
                                                          outObj, outLenObj,
                                                          errObj, errLenObj);
    } catch (ex) {
      exitCodeObj.value = -1;
    }

    var outputData = "";
    var errOutput  = "";

    if (outObj.value)
       outputData = outObj.value;

    if (errObj.value)
       errorMsgObj.value  = errObj.value;

    if (prefix && (gLogLevel >= 4)) {
      WriteFileContents(prefix+"enigout.txt", outputData);
      WriteFileContents(prefix+"enigerr.txt", errOutput);
      Ec.DEBUG_LOG("enigmail.js: Enigmail.simpleExecCmd: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.simpleExecCmd: exitCode = "+exitCodeObj.value+"\n");
    Ec.DEBUG_LOG("enigmail.js: Enigmail.simpleExecCmd: errOutput = "+errOutput+"\n");

    exitCodeObj.value = exitCodeObj.value;

    this.stillActive();

    return outputData;
  },

  execCmd: function (command, args, passphrase, input, exitCodeObj, statusFlagsObj,
            statusMsgObj, errorMsgObj) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.execCmd: command = "+command+"\n");

    if ((typeof input) != "string") input = "";
    var prependPassphrase = ((typeof passphrase) == "string");

    var envList = [];
    envList = envList.concat(gEnvList);

    var preInput;

    if (prependPassphrase) {
      preInput = passphrase;
      input = "\n" + input;

    } else {
      preInput = "";
    }

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {

      if (prependPassphrase) {
        // Obscure passphrase
        WriteFileContents(prefix+"eniginp.txt", "<passphrase>"+input);
      } else {
        WriteFileContents(prefix+"eniginp.txt", input);
      }

      WriteFileContents(prefix+"enigcmd.txt", printCmdLine(command, args)+"\n");
      WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

      Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
    }

    var outObj = new Object();
    var errObj = new Object();
    var outLenObj = new Object();
    var errLenObj = new Object();
    var blockSeparationObj = new Object();

    Ec.CONSOLE_LOG("\nenigmail> "+printCmdLine(command, args)+"\n");

    try {
      exitCodeObj.value = gEnigmailSvc.ipcService.runPipe(command,
                                                          args,
                                                          args.length,
                                                          preInput,
                                                          input, input.length,
                                                          envList, envList.length,
                                                          outObj, outLenObj,
                                                          errObj, errLenObj);
    } catch (ex) {
      exitCodeObj.value = -1;
    }

    var outputData = "";
    var errOutput  = "";

    if (outObj.value)
       outputData = outObj.value;

    if (errObj.value)
       errOutput  = errObj.value;

    if (prefix && (gLogLevel >= 4)) {
      WriteFileContents(prefix+"enigout.txt", outputData);
      WriteFileContents(prefix+"enigerr.txt", errOutput);
      Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: exitCode = "+exitCodeObj.value+"\n");
    Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: errOutput = "+errOutput+"\n");


    errorMsgObj.value = Ec.parseErrorOutput(errOutput, statusFlagsObj, statusMsgObj, blockSeparationObj);
    exitCodeObj.value = this.fixExitCode(exitCodeObj.value, statusFlagsObj.value);

    if (blockSeparationObj.value.indexOf(" ") > 0) {
      exitCodeObj.value = 2;
    }

    Ec.CONSOLE_LOG(errorMsgObj.value+"\n");

    this.stillActive();

    return outputData;
  },


  execStart: function (command, args, needPassphrase, domWindow, prompter, listener,
            noProxy, statusFlagsObj) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.execStart: command = "+printCmdLine(command, args)+", needPassphrase="+needPassphrase+", domWindow="+domWindow+", prompter="+prompter+", listener="+listener+", noProxy="+noProxy+"\n");

    statusFlagsObj.value = 0;

    var envList = [];
    envList = envList.concat(gEnvList);

    var passphrase = null;
    var useAgentObj = {value: false};

    if (needPassphrase) {
      args = args.concat(this.passwdCommand());

      var passwdObj = new Object();

      if (!GetPassphrase(domWindow, passwdObj, useAgentObj, 0)) {
         Ec.ERROR_LOG("enigmail.js: Enigmail.execStart: Error - no passphrase supplied\n");

         statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
         return null;
      }

      passphrase = passwdObj.value;
    }

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {

      WriteFileContents(prefix+"enigcmd.txt", printCmdLine(command, args)+"\n");
      WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

      Ec.DEBUG_LOG("enigmail.js: Enigmail.execStart: copied command line/env to files "+prefix+"enigcmd.txt/enigenv.txt\n");
    }

    Ec.CONSOLE_LOG("\nenigmail> "+printCmdLine(command, args)+"\n");

    var pipetrans = Components.classes[NS_PIPETRANSPORT_CONTRACTID].createInstance();

    pipetrans = pipetrans.QueryInterface(Components.interfaces.nsIPipeTransport);
    Ec.DEBUG_LOG("enigmail.js: Enigmail.execStart: pipetrans = " + pipetrans + "\n");

    try {
      var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
      ipcBuffer.open(ERROR_BUFFER_SIZE, false);

      var mergeStderr = false;
      pipetrans.init(command);
      pipetrans.openPipe(args, args.length, envList, envList.length,
                            0, "", noProxy, mergeStderr,
                            ipcBuffer);

      if (listener) {
        pipetrans.asyncRead(listener, null, 0, -1, 0);
      }

      if (needPassphrase) {
        // Write to child STDIN
        // (ignore errors, because child may have exited already, closing STDIN)
        try {
          if (this.requirePassword()) {
             pipetrans.writeSync(passphrase, passphrase.length);
             pipetrans.writeSync("\n", 1);
          }
        } catch (ex) {}
      }

      return pipetrans;

    } catch (ex) {
      Ec.CONSOLE_LOG("enigmail.js: Enigmail.execStart: Error - Failed to start PipeTransport\n");
      return null;
    }
  },


  execEnd: function (pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj, blockSeparationObj) {

    Ec.WRITE_LOG("enigmail.js: Enigmail.execEnd: \n");

    // Extract command line
    try {
      var request = pipeTransport.QueryInterface(Components.interfaces.nsIRequest);

      cmdLineObj.value = request.name;
    } catch (ex) {
      cmdLineObj.value = "unknown-command";
    }

    // Extract exit code and error output from pipeTransport
    var exitCode = pipeTransport.exitValue;

    var errListener = pipeTransport.console.QueryInterface(Components.interfaces.nsIIPCBuffer);

    var outLength = new Object();
    var errOutput = errListener.getByteData(outLength);

    // Terminate pipeTransport
    errListener.shutdown();

    pipeTransport.terminate();

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {
      WriteFileContents(prefix+"enigerr.txt", errOutput);
      Ec.DEBUG_LOG("enigmail.js: Enigmail.execEnd: copied command err output to file "+prefix+"enigerr.txt\n");
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.execEnd: exitCode = "+exitCode+"\n");
    Ec.DEBUG_LOG("enigmail.js: Enigmail.execEnd: errOutput = "+errOutput+"\n");


    errorMsgObj.value = Ec.parseErrorOutput(errOutput, statusFlagsObj, statusMsgObj, blockSeparationObj);

    if (errOutput.search(/jpeg image of size \d+/)>-1) {
      statusFlagsObj.value |= nsIEnigmail.PHOTO_AVAILABLE;
    }
    if (blockSeparationObj && blockSeparationObj.value.indexOf(" ") > 0) {
      exitCode = 2;
    }

    Ec.CONSOLE_LOG(Ec.convertFromUnicode(errorMsgObj.value)+"\n");

    this.stillActive();

    return exitCode;
  },


  stripWhitespace: function(sendFlags) {
    var stripThem=false;
    if ((sendFlags & nsIEnigmail.SEND_SIGNED) &&
        (!(sendFlags & nsIEnigmail.SEND_ENCRYPTED))) {
      if (this.agentVersion >= "1.4.0" && this.agentVersion < "1.4.1") {
        stripThem = true;
      }
    }

    return stripThem;
  },

  encryptMessage: function (parent, uiFlags, hashAlgorithm, plainText, fromMailAddr, toMailAddr, bccMailAddr,
            sendFlags, exitCodeObj, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: "+plainText.length+" bytes from "+fromMailAddr+" to "+toMailAddr+" ("+sendFlags+")\n");

    exitCodeObj.value    = -1;
    statusFlagsObj.value = 0;
    errorMsgObj.value    = "";

    var hashAlgo = gMimeHashAlgorithms[this.prefBranch.getIntPref("mimeHashAlgorithm")];

    if (hashAlgo == null) {
      hashAlgo = hashAlgorithm;
    }

    if (!plainText) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: NO ENCRYPTION!\n");
      exitCodeObj.value = 0;
      return plainText;
    }

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessage: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

    if (encryptMsg) {
      // First convert all linebreaks to newlines
      plainText = plainText.replace(/\r\n/g, "\n");
      plainText = plainText.replace(/\r/g,   "\n");

      // Using platform-specific linebreaks confuses some windows mail clients,
      // so we convert everything to windows like good old PGP worked anyway.
      plainText = plainText.replace(/\n/g, "\r\n");
    }

    var noProxy = true;
    var startErrorMsgObj = new Object();

    var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
    var bufferSize = ((plainText.length + 20000)/1024).toFixed(0)*1024;
    if (MSG_BUFFER_SIZE > bufferSize)
      bufferSize=MSG_BUFFER_SIZE;

    ipcBuffer.open(bufferSize, false);

    var pipeTrans = this.encryptMessageStart(parent, null, uiFlags,
                                             fromMailAddr, toMailAddr, bccMailAddr,
                                             hashAlgo, sendFlags, ipcBuffer,
                                             noProxy, statusFlagsObj, startErrorMsgObj);

    if (!pipeTrans) {
      errorMsgObj.value = startErrorMsgObj.value;

      return "";
    }

    // Write to child STDIN
    // (ignore errors, because child may have exited already, closing STDIN)
    try {
      pipeTrans.writeSync(plainText, plainText.length);
    } catch (ex) {}

    // Wait for child STDOUT to close
    pipeTrans.join();

    var cipherText = ipcBuffer.getData();
    ipcBuffer.shutdown();

    var exitCode = this.encryptMessageEnd(parent, null, uiFlags, sendFlags,
                                          plainText.length, pipeTrans,
                                          statusFlagsObj, errorMsgObj);

    exitCodeObj.value = exitCode;

    if ((exitCodeObj.value == 0) && !cipherText)
      exitCodeObj.value = -1;

    if (exitCodeObj.value == 0) {
      // Normal return
      return cipherText;
    }

    // Error processing
    Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessage: command execution exit code: "+exitCodeObj.value+"\n");

    return "";
  },


  encryptMessageEnd: function (parent, prompter, uiFlags, sendFlags, outputLen, pipeTransport,
            statusFlagsObj, errorMsgObj)
  {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessageEnd: uiFlags="+uiFlags+", sendFlags="+Ec.bytesToHex(Ec.pack(sendFlags,4))+", outputLen="+outputLen+", pipeTransport="+pipeTransport+"\n");

    var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;
    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

    statusFlagsObj.value = 0;
    errorMsgObj.value    = "";

    if (!this.initialized) {
       Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessageEnd: not yet initialized\n");
       errorMsgObj.value = Ec.getString("notInit");
       return -1;
    }

    // Terminate job and parse error output
    var statusMsgObj   = new Object();
    var cmdLineObj     = new Object();
    var cmdErrorMsgObj = new Object();

    var exitCode = this.execEnd(pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, cmdErrorMsgObj);
    var statusMsg = statusMsgObj.value;
    exitCode = this.fixExitCode(exitCode, statusFlagsObj.value);
    if ((exitCode == 0) && !outputLen) {
      exitCode = -1;
    }

    if (exitCode != 0 && (signMsg || encryptMsg)) {
      // GnuPG might return a non-zero exit code, even though the message was correctly
      // signed or encryped -> try to fix the exit code

      var correctedExitCode = 0;
      if (signMsg) {
        if (! (statusFlagsObj.value & nsIEnigmail.SIG_CREATED)) correctedExitCode = exitCode;
      }
      if (encryptMsg) {
        if (! (statusFlagsObj.value & nsIEnigmail.END_ENCRYPTION)) correctedExitCode = exitCode;
      }
      exitCode = correctedExitCode;
    }

    if (exitCode == 0) {
      // Normal return
      errorMsgObj.value = cmdErrorMsgObj.value;
      return 0;
    }

    // Error processing
    Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessageEnd: command execution exit code: "+exitCode+"\n");

    if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
      // "Unremember" passphrase on error return
      this.clearCachedPassphrase();
    }

    if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
      errorMsgObj.value = Ec.getString("badPhrase");
    }
    else if (statusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) {
      errorMsgObj.value = statusMsg;
      cmdErrorMsgObj.value = null;
    }
    else if (statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) {
      errorMsgObj.value = statusMsg;

    }
    else {
      errorMsgObj.value = Ec.getString("badCommand");
    }

    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n\n" + this.agentType + " "+Ec.getString("cmdLine");
      errorMsgObj.value += "\n" + cmdLineObj.value;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    if (pgpMime && errorMsgObj.value) {
      if (prompter)
        prompter.alert(Ec.getString("enigAlert"), errorMsgObj.value);
      else
        this.alertMsg(parent, errorMsgObj.value);
    }

    return exitCode;
  },


  getEncryptCommand: function (fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj) {
    try {
      fromMailAddr = EnigStripEmail(fromMailAddr);
      toMailAddr = EnigStripEmail(toMailAddr);
      bccMailAddr = EnigStripEmail(bccMailAddr);

    } catch (ex) {
      errorMsgObj.value = Ec.getString("invalidEmail");
      return null;
    }

    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;
    var usePgpMime =  sendFlags & nsIEnigmail.SEND_PGP_MIME;

    var useDefaultComment = false;
    try {
       useDefaultComment = this.prefBranch.getBoolPref("useDefaultComment")
    } catch(ex) { }

    var hushMailSupport = false;
    try {
       hushMailSupport = this.prefBranch.getBoolPref("hushMailSupport")
    } catch(ex) { }

    var detachedSig = (usePgpMime || (sendFlags & nsIEnigmail.SEND_ATTACHMENT)) && signMsg && !encryptMsg;

    var toAddrList = toMailAddr.split(/\s*,\s*/);
    var bccAddrList = bccMailAddr.split(/\s*,\s*/);
    var k;

    var encryptArgs = this.getAgentArgs(true);

    if (!useDefaultComment)
      encryptArgs = encryptArgs.concat(["--comment", GPG_COMMENT_OPT.replace(/\%s/, this.vendor)]);

    var angledFromMailAddr = ((fromMailAddr.search(/^0x/) == 0) || hushMailSupport)
                           ? fromMailAddr : "<" + fromMailAddr + ">";
    angledFromMailAddr = angledFromMailAddr.replace(/([\"\'\`])/g, "\\$1");

    if (signMsg && hashAlgorithm) {
      encryptArgs = encryptArgs.concat(["--digest-algo", hashAlgorithm]);
    }

    if (encryptMsg) {
      switch (isAscii) {
      case ENC_TYPE_MSG:
        encryptArgs.push("-a");
        encryptArgs.push("-t");
        break;
      case ENC_TYPE_ATTACH_ASCII:
        encryptArgs.push("-a");
      }

      encryptArgs.push("--encrypt");

      if (signMsg)
        encryptArgs.push("--sign");

      if (sendFlags & nsIEnigmail.SEND_ALWAYS_TRUST) {
        if (this.agentVersion >= "1.4") {
          encryptArgs.push("--trust-model");
          encryptArgs.push("always");
        }
        else {
          encryptArgs.push("--always-trust");
        }
      }
      if ((sendFlags & nsIEnigmail.SEND_ENCRYPT_TO_SELF) && fromMailAddr)
        encryptArgs = encryptArgs.concat(["--encrypt-to", angledFromMailAddr]);

      for (k=0; k<toAddrList.length; k++) {
        toAddrList[k] = toAddrList[k].replace(/\'/g, "\\'");
        if (toAddrList[k].length > 0) {
           encryptArgs.push("-r");
           if (toAddrList[k].search(/^GROUP:/) == 0) {
             // groups from gpg.conf file
             encryptArgs.push(toAddrList[k].substr(6));
           }
           else {
             encryptArgs.push((hushMailSupport || (toAddrList[k].search(/^0x/) == 0)) ? toAddrList[k]
                            :"<" + toAddrList[k] + ">");
           }
        }
      }

      for (k=0; k<bccAddrList.length; k++) {
        bccAddrList[k] = bccAddrList[k].replace(/\'/g, "\\'");
        if (bccAddrList[k].length > 0) {
          encryptArgs.push("--hidden-recipient");
          encryptArgs.push((hushMailSupport || (bccAddrList[k].search(/^0x/) == 0)) ? bccAddrList[k]
                    :"<" + bccAddrList[k] + ">");
        }
      }

    } else if (detachedSig) {
      encryptArgs = encryptArgs.concat(["-s", "-b"]);

      switch (isAscii) {
      case ENC_TYPE_MSG:
        encryptArgs = encryptArgs.concat(["-a", "-t"]);
        break;
      case ENC_TYPE_ATTACH_ASCII:
        encryptArgs.push("-a");
      }

    } else if (signMsg) {
      encryptArgs = encryptArgs.concat(["-t", "--clearsign"]);
    }

    if (fromMailAddr) {
      encryptArgs = encryptArgs.concat(["-u", angledFromMailAddr]);
    }

    return encryptArgs;
  },

  determineHashAlgorithm: function (prompter, uiFlags, fromMailAddr, hashAlgoObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: from "+fromMailAddr+"\n");

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();

    var sendFlags = nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED;

    var hashAlgo = gMimeHashAlgorithms[this.prefBranch.getIntPref("mimeHashAlgorithm")];

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.determineHashAlgorithm: Enigmail not initialized\n")
      this.alertMsg(null, Ec.getString("notInit"));
      return 2;
    }

    if (typeof(gKeyAlgorithms[fromMailAddr]) != "string") {
      // hash algorithm not yet known
      var passwdObj   = new Object();
      var useAgentObj = new Object();
      // Get the passphrase and remember it for the next 2 subsequent calls to gpg
      if (!GetPassphrase(null, passwdObj, useAgentObj, 2)) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.determineHashAlgorithm: Error - no passphrase supplied\n");

        return 3;
      }

      var noProxy = true;
      var testUiFlags = nsIEnigmail.UI_TEST;

      var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
      var bufferSize = 10240;

      ipcBuffer.open(bufferSize, false);

      var pipeTrans = this.encryptMessageStart(null, prompter, testUiFlags,
                                               fromMailAddr, "", "",
                                               hashAlgo, sendFlags, ipcBuffer,
                                               noProxy, statusFlagsObj, errorMsgObj);
      if (!pipeTrans) {
        return 1;
      }

      var plainText = "Dummy Test";

      // Write to child STDIN
      // (ignore errors, because child may have exited already, closing STDIN)
      try {
        pipeTrans.writeSync(plainText, plainText.length);
      } catch (ex) {}

      // Wait for child STDOUT to close
      pipeTrans.join();

      var msgText = ipcBuffer.getData();
      ipcBuffer.shutdown();

      var exitCode = this.encryptMessageEnd(null, prompter, testUiFlags, sendFlags,
                                            plainText.length, pipeTrans,
                                            statusFlagsObj, errorMsgObj);

      if ((exitCode == 0) && !msgText) exitCode = 1;
      // if (exitCode > 0) exitCode = -exitCode;

      if (exitCode != 0) {
        // Abormal return
        if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
          // "Unremember" passphrase on error return
          this.clearCachedPassphrase();
          errorMsgObj.value = Ec.getString("badPhrase");
        }
        this.alertMsg(null, errorMsgObj.value);
        return exitCode;
      }

      var m = msgText.match(/^(Hash: )(.*)$/m);
      if (m.length > 2 && m[1] == "Hash: ") {
        var hashAlgorithm = m[2].toLowerCase();
        for (var i=1; i < gMimeHashAlgorithms.length; i++) {
          if (gMimeHashAlgorithms[i] == hashAlgorithm) {
            Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: found hashAlgorithm "+hashAlgorithm+"\n");
            gKeyAlgorithms[fromMailAddr] = hashAlgorithm;
            hashAlgoObj.value = hashAlgorithm;
            return 0;
          }
        }
      }

      Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: no hashAlgorithm found\n");

      return 2;
    }
    else {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: hashAlgorithm "+gKeyAlgorithms[fromMailAddr]+" is cached\n");
      hashAlgoObj.value = gKeyAlgorithms[fromMailAddr];
    }

    return 0;
  },


  encryptMessageStart: function (parent, prompter, uiFlags, fromMailAddr, toMailAddr, bccMailAddr,
            hashAlgorithm, sendFlags, listener, noProxy, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: prompter="+prompter+", uiFlags="+uiFlags+", from "+fromMailAddr+" to "+toMailAddr+", hashAlgorithm="+hashAlgorithm+" ("+Ec.bytesToHex(Ec.pack(sendFlags,4))+")\n");

    var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;

    errorMsgObj.value = "";

    if (!sendFlags) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: NO ENCRYPTION!\n");
      errorMsgObj.value = Ec.getString("notRequired");
      return null;
    }

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessageStart: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return null;
    }

    if (this.keygenProcess) {
      errorMsgObj.value = Ec.getString("notComplete");
      return null;
    }

    var encryptArgs = this.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, ENC_TYPE_MSG, errorMsgObj);
    if (! encryptArgs)
      return null;

    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;

    var pipetrans = this.execStart(this.agentPath, encryptArgs, signMsg, parent, prompter,
                                   listener, noProxy, statusFlagsObj);

    if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = "";
    }

    if (pgpMime && errorMsgObj.value) {
      if (prompter)
        prompter.alert(Ec.getString("enigAlert"), errorMsgObj.value);
      else
        this.alertMsg(parent, errorMsgObj.value);
    }

    return pipetrans;
  },


  // Locates offsets bracketing PGP armored block in text,
  // starting from given offset, and returns block type string.
  // beginIndex = offset of first character of block
  // endIndex = offset of last character of block (newline)
  // If block is not found, the null string is returned;

  locateArmoredBlock: function (text, offset, indentStr, beginIndexObj, endIndexObj,
            indentStrObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.locateArmoredBlock: "+offset+", '"+indentStr+"'\n");

    beginIndexObj.value = -1;
    endIndexObj.value = -1;

    var beginIndex = IndexOfArmorDelimiter(text, indentStr+"-----BEGIN PGP ", offset);

    if (beginIndex == -1) {
      var blockStart=text.indexOf("-----BEGIN PGP ")
      if (blockStart>=0) {
        var indentStart=text.search(/\n.*\-\-\-\-\-BEGIN PGP /)+1;
        indentStrObj.value=text.substring(indentStart, blockStart);
        indentStr=indentStrObj.value;
        beginIndex = IndexOfArmorDelimiter(text, indentStr+"-----BEGIN PGP ", offset);
      }
    }

    if (beginIndex == -1)
      return "";

    // Locate newline at end of armor header
    offset = text.indexOf("\n", beginIndex);

    if (offset == -1)
      return "";

    var endIndex = IndexOfArmorDelimiter(text, indentStr+"-----END PGP ", offset);

    if (endIndex == -1)
      return "";

    // Locate newline at end of PGP block
    endIndex = text.indexOf("\n", endIndex);

    if (endIndex == -1) {
      // No terminating newline
      endIndex = text.length - 1;
    }

    var blockHeader = text.substr(beginIndex, offset-beginIndex+1);

    var blockRegex = new RegExp("^" + indentStr +
                                "-----BEGIN PGP (.*)-----\\s*\\r?\\n");

    var matches = blockHeader.match(blockRegex);

    var blockType = "";
    if (matches && (matches.length > 1)) {
        blockType = matches[1];
        Ec.DEBUG_LOG("enigmail.js: Enigmail.locateArmoredBlock: blockType="+blockType+"\n");
    }

    if (blockType == "UNVERIFIED MESSAGE") {
      // Skip any unverified message block
      return this.locateArmoredBlock(text, endIndex+1, indentStr,
                                     beginIndexObj, endIndexObj, indentStrObj);
    }

    beginIndexObj.value = beginIndex;
    endIndexObj.value = endIndex;

    return blockType;
  },


  extractSignaturePart: function (signatureBlock, part) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.extractSignaturePart: part="+part+"\n");

    // Search for blank line
    var offset = signatureBlock.search(/\n\s*\r?\n/);
    if (offset == -1)
      return "";

    offset = signatureBlock.indexOf("\n", offset+1);
    if (offset == -1)
      return "";

    var beginIndex = signatureBlock.indexOf("-----BEGIN PGP SIGNATURE-----",
                                            offset+1);
    if (beginIndex == -1)
      return "";

    if (part == nsIEnigmail.SIGNATURE_TEXT) {
      var signedText = signatureBlock.substr(offset+1, beginIndex-offset-1);

      // Unescape leading dashes
      signedText = signedText.replace(/^- -/, "-");
      signedText = signedText.replace(/\n- -/g, "\n-");
      signedText = signedText.replace(/\r- -/g, "\r-");

      return signedText;
    }

    // Locate newline at end of armor header
    offset = signatureBlock.indexOf("\n", beginIndex);

    if (offset == -1)
      return "";

    var endIndex = signatureBlock.indexOf("-----END PGP SIGNATURE-----", offset);
    if (endIndex == -1)
      return "";

    var signBlock = signatureBlock.substr(offset, endIndex-offset);

    // Search for blank line
    var armorIndex = signBlock.search(/\n\s*\r?\n/);
    if (armorIndex == -1)
      return "";

    if (part == nsIEnigmail.SIGNATURE_HEADERS) {
      return signBlock.substr(1, armorIndex);
    }

    armorIndex = signBlock.indexOf("\n", armorIndex+1);
    if (armorIndex == -1)
      return "";

    if (part == nsIEnigmail.SIGNATURE_ARMOR) {
      var armorData = signBlock.substr(armorIndex, endIndex-armorIndex);
      armorData = armorData.replace(/\s*/g, "");
      return armorData;
    }

    return "";
  },


  decryptMessage: function (parent, uiFlags, cipherText, signatureObj, exitCodeObj,
            statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj,
            blockSeparationObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: "+cipherText.length+" bytes, "+uiFlags+"\n");

    if (! cipherText)
      return "";

    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
    var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
    var oldSignature = signatureObj.value;

    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: oldSignature="+oldSignature+"\n");

    signatureObj.value   = "";
    exitCodeObj.value    = -1;
    statusFlagsObj.value = 0;
    keyIdObj.value       = "";
    userIdObj.value      = "";
    errorMsgObj.value    = "";

    var beginIndexObj = new Object();
    var endIndexObj = new Object();
    var indentStrObj = new Object();
    var blockType = this.locateArmoredBlock(cipherText, 0, "",
                                            beginIndexObj, endIndexObj, indentStrObj);

    if (!blockType || blockType == "SIGNATURE") {
      errorMsgObj.value = Ec.getString("noPGPblock");
      statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
      return "";
    }

    var publicKey = (blockType == "PUBLIC KEY BLOCK");

    var verifyOnly = (blockType == "SIGNED MESSAGE");

    var pgpBlock = cipherText.substr(beginIndexObj.value,
                            endIndexObj.value - beginIndexObj.value + 1);

    if (indentStrObj.value) {
      RegExp.multiline = true;
      var indentRegexp = new RegExp("^"+indentStrObj.value, "g");
      pgpBlock = pgpBlock.replace(indentRegexp, "");
      RegExp.multiline = false;
    }

    var head = cipherText.substr(0, beginIndexObj.value);
    var tail = cipherText.substr(endIndexObj.value+1,
                                 cipherText.length - endIndexObj.value - 1);

    if (publicKey) {
      if (!allowImport) {
        errorMsgObj.value = Ec.getString("decryptToImport");
        statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
        statusFlagsObj.value |= nsIEnigmail.INLINE_KEY;

        return "";
      }

      // Import public key
      var importFlags = nsIEnigmail.UI_INTERACTIVE;
      exitCodeObj.value = this.importKey(parent, importFlags, pgpBlock, "",
                                         errorMsgObj);
      if (exitCodeObj.value == 0) {
        statusFlagsObj.value |= nsIEnigmail.IMPORTED_KEY;
      }
      return "";
    }

    var newSignature = "";

    if (verifyOnly) {
      newSignature = this.extractSignaturePart(pgpBlock,
                                                nsIEnigmail.SIGNATURE_ARMOR);

      if (oldSignature && (newSignature != oldSignature)) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessage: Error - signature mismatch "+newSignature+"\n");
        errorMsgObj.value = Ec.getString("sigMismatch");
        statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

        return "";
      }
    }

    var noOutput = false;
    var noProxy = true;
    var startErrorMsgObj = new Object();

    var readBytes = MSG_BUFFER_SIZE;
    if (verifyOnly && pgpBlock.length > MSG_BUFFER_SIZE) {
      readBytes = ((pgpBlock.length+1500)/1024).toFixed(0)*1024;
    }
    if (readBytes > MAX_MSG_BUFFER_SIZE) {
      errorMsgObj.value = Ec.getString("messageSizeError");
      statusFlagsObj.value |= nsIEnigmail.OVERFLOWED;
      exitCodeObj.value = 1;
      return "";
    }

    const maxTries = 2;
    var tryCount = 0;
    while (tryCount < maxTries) {
      tryCount++;

      var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
      ipcBuffer.open(readBytes, false);

      var pipeTrans = this.decryptMessageStart(parent, null, verifyOnly, noOutput,
                                            ipcBuffer, noProxy, statusFlagsObj, startErrorMsgObj);

      if (!pipeTrans) {
        errorMsgObj.value = startErrorMsgObj.value;
        statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

        return "";
      }

      // Write to child STDIN
      // (ignore errors, because child may have exited already, closing STDIN)
      try {
        pipeTrans.writeSync(pgpBlock, pgpBlock.length);
      } catch (ex) {}

      // Wait for child STDOUT to close
      pipeTrans.join();

      var overflowed = ipcBuffer.overflowed;
      var plainText = ipcBuffer.getData();
      if (ipcBuffer.overflowed && plainText.length < ipcBuffer.totalBytes) {
        readBytes = ((ipcBuffer.totalBytes+1500)/1024).toFixed(0)*1024;
        Ec.WRITE_LOG("enigmail.js: Enigmail.decryptMessage: decrypted text too big for standard buffer, retrying with buffer size="+readBytes+"\n");
      }
      else {
        tryCount = maxTries;
      }

      ipcBuffer.shutdown();
      ipcBuffer = null; // make sure the object gets freed

      var exitCode = this.decryptMessageEnd(uiFlags, plainText.length, pipeTrans,
                                          verifyOnly, noOutput,
                                          statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj,
                                          errorMsgObj, blockSeparationObj);
      exitCodeObj.value = exitCode;
    }

    if ((head.search(/\S/) >= 0) ||
        (tail.search(/\S/) >= 0)) {
      statusFlagsObj.value |= nsIEnigmail.PARTIALLY_PGP;
    }


    if (exitCodeObj.value == 0) {
      // Normal return

      var doubleDashSeparator = false;
      try {
         doubleDashSeparator = this.prefBranch.getBoolPref("doubleDashSeparator")
      } catch(ex) { }

      if (doubleDashSeparator && (plainText.search(/(\r|\n)-- +(\r|\n)/) < 0) ) {
        // Workaround for MsgCompose stripping trailing spaces from sig separator
        plainText = plainText.replace(/(\r|\n)--(\r|\n)/, "$1-- $2");
      }

      statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

      if (verifyOnly && indentStrObj.value) {
        RegExp.multiline = true;
        plainText = plainText.replace(/^/g, indentStrObj.value)
        RegExp.multiline = false;
      }
      return plainText;
    }

    var pubKeyId = keyIdObj.value;

    if (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE) {
      if (verifyOnly && indentStrObj.value) {
        // Probably replied message that could not be verified
        errorMsgObj.value = Ec.getString("unverifiedReply")+"\n\n"+errorMsgObj.value;
        return "";
      }

      // Return bad signature (for checking later)
      signatureObj.value = newSignature;

    } else if (pubKeyId &&
               (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE)) {

      var innerKeyBlock;
      if (verifyOnly) {
        // Search for indented public key block in signed message
        var innerBlockType = this.locateArmoredBlock(pgpBlock, 0, "- ",
                                                     beginIndexObj, endIndexObj,
                                                     indentStrObj);

        if (innerBlockType == "PUBLIC KEY BLOCK") {

          innerKeyBlock = pgpBlock.substr(beginIndexObj.value,
                                     endIndexObj.value - beginIndexObj.value + 1);

          innerKeyBlock = innerKeyBlock.replace(/- -----/g, "-----");

          statusFlagsObj.value |= nsIEnigmail.INLINE_KEY;
          Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: innerKeyBlock found\n");
        }
      }

      if (allowImport) {

        var importedKey = false;

        if (innerKeyBlock) {
          var importErrorMsgObj = new Object();
          var importFlags2 = nsIEnigmail.UI_INTERACTIVE;
          var exitStatus = this.importKey(parent, importFlags2, innerKeyBlock,
                                          pubKeyId, importErrorMsgObj);

          importedKey = (exitStatus == 0);

          if (exitStatus > 0) {
            this.alertMsg(parent, Ec.getString("cantImport")+importErrorMsgObj.value);
          }
        }

        if (importedKey) {
          // Recursive call; note that nsIEnigmail.UI_ALLOW_KEY_IMPORT is unset
          // to break the recursion
          var uiFlagsDeep = interactive ? nsIEnigmail.UI_INTERACTIVE : 0;
          signatureObj.value = "";
          return this.decryptMessage(parent, uiFlagsDeep, pgpBlock,
                                      signatureObj, exitCodeObj, statusFlagsObj,
                                      keyIdObj, userIdObj, sigDetailsObj, errorMsgObj);
        }

      }

      if (plainText && !unverifiedEncryptedOK) {
        // Append original PGP block to unverified message
        plainText = "-----BEGIN PGP UNVERIFIED MESSAGE-----\r\n" + plainText +
                    "-----END PGP UNVERIFIED MESSAGE-----\r\n\r\n" + pgpBlock;
      }

    }

    return verifyOnly ? "" : plainText;
  },


  decryptMessageStart: function (parent, prompter, verifyOnly, noOutput,
            listener, noProxy, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessageStart: prompter="+prompter+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessageStart: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return null;
    }

    if (this.keygenProcess) {
      errorMsgObj.value = Ec.getString("notComplete");
      return null;
    }

    var args = this.getAgentArgs(true);

    var keyserver = this.prefBranch.getCharPref("autoKeyRetrieve");
    if (keyserver != "") {
      args.push("--keyserver-options");
      var keySrvArgs="auto-key-retrieve";
      var srvProxy = this.getHttpProxy(keyserver);
      if (srvProxy && this.agentVersion>="1.4" ) {
        keySrvArgs += ",http-proxy="+srvProxy;
      }
      args.push(keySrvArgs);
      args.push("--keyserver");
      args.push(keyserver);
    }

    if (noOutput) {
      args.push("--verify");

    } else {
      args.push("--decrypt");
    }

    var pipetrans = this.execStart(this.agentPath, args, !verifyOnly, parent, prompter,
                                   listener, noProxy, statusFlagsObj);

    if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = Ec.getString("noPassphrase");
      return null;
    }

    return pipetrans;
  },


  decryptMessageEnd: function (uiFlags, outputLen, pipeTransport, verifyOnly, noOutput,
            statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessageEnd: uiFlags="+uiFlags+", outputLen="+outputLen+", pipeTransport="+pipeTransport+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
    var pgpMime     = uiFlags & nsIEnigmail.UI_PGP_MIME;
    var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
    var j;

    statusFlagsObj.value = 0;
    errorMsgObj.value    = "";
    blockSeparationObj.value = "";

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessageEnd: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return -1;
    }

    // Terminate job and parse error output
    var statusMsgObj   = new Object();
    var cmdLineObj     = new Object();
    var cmdErrorMsgObj = new Object();

    var exitCode = this.execEnd(pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, cmdErrorMsgObj, blockSeparationObj);

    if (pgpMime) {
      statusFlagsObj.value |= verifyOnly ? nsIEnigmail.PGP_MIME_SIGNED
                                         : nsIEnigmail.PGP_MIME_ENCRYPTED;
    }

    var statusMsg = statusMsgObj.value;
    exitCode = this.fixExitCode(exitCode, statusFlagsObj.value);
    if ((exitCode == 0) && !noOutput && !outputLen &&
        ((statusFlagsObj.value & (gStatusFlags.DECRYPTION_OKAY | gStatusFlags.GOODSIG)) == 0)) {
      exitCode = -1;
    }

    if (exitCode == 0) {
      // Normal return
      var errLines, goodSignPat, badSignPat, keyExpPat;

      if (statusMsg) {
          errLines = statusMsg.split(/\r?\n/);

          goodSignPat =   /GOODSIG (\w{16}) (.*)$/i;
          badSignPat  =    /BADSIG (\w{16}) (.*)$/i;
          keyExpPat   = /EXPKEYSIG (\w{16}) (.*)$/i
          revKeyPat   = /REVKEYSIG (\w{16}) (.*)$/i;
          validSigPat =  /VALIDSIG (\w+) (.*) (\d+) (.*)/i;

      } else {
          errLines = cmdErrorMsgObj.value.split(/\r?\n/);

          goodSignPat = /Good signature from (user )?"(.*)"\.?/i;
          badSignPat  =  /BAD signature from (user )?"(.*)"\.?/i;
          keyExpPat   = /This key has expired/i;
          revKeyPat   = /This key has been revoked/i;
          validSigPat = /dummy-not-used/i;
      }

      errorMsgObj.value = "";

      var matches;

      var signed = false;
      var goodSignature;

      var userId = "";
      var keyId = "";
      var sigDetails = "";

      for (j=0; j<errLines.length; j++) {
        matches = errLines[j].match(badSignPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = false;
          userId = matches[2];
          keyId = matches[1];
          break;
        }

        matches = errLines[j].match(revKeyPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = true;
          userId = matches[2];
          keyId = matches[1];
          break;
        }

        matches = errLines[j].match(goodSignPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = true;
          userId = matches[2];
          keyId = matches[1];
          break;
        }

        matches = errLines[j].match(keyExpPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = true;
          userId = matches[2];
          keyId = matches[1];

          break;
        }
      }

      if (goodSignature) {
        for (var j=0; j<errLines.length; j++) {
          matches = errLines[j].match(validSigPat);

          if (matches && (matches.length > 2)) {
            sigDetails = errLines[j].substr(9);
            break;
          }
        }
      }

      try {
        if (userId && keyId && this.prefBranch.getBoolPref("displaySecondaryUid")) {
          uids = this.getKeyDetails(keyId, true);
          if (uids) {
            userId = uids;
          }
        }
      }
      catch (ex) {}

      if (userId) {
        userId = Ec.convertToUnicode(userId, "UTF-8");
      }

      userIdObj.value = userId;
      keyIdObj.value = keyId;
      sigDetailsObj.value = sigDetails;

      if (signed) {
        var trustPrefix = "";

        if (statusFlagsObj.value & nsIEnigmail.UNTRUSTED_IDENTITY) {
          trustPrefix += Ec.getString("prefUntrusted")+" ";
        }

        if (statusFlagsObj.value & nsIEnigmail.REVOKED_KEY) {
          trustPrefix += Ec.getString("prefRevoked")+" ";
        }

        if (statusFlagsObj.value & nsIEnigmail.EXPIRED_KEY_SIGNATURE) {
          trustPrefix += Ec.getString("prefExpiredKey")+" ";

        } else if (statusFlagsObj.value & nsIEnigmail.EXPIRED_SIGNATURE) {
          trustPrefix += Ec.getString("prefExpired")+" ";
        }

        if (goodSignature) {
          errorMsgObj.value = trustPrefix + Ec.getString("prefGood",userId) /* + ", " +
                Ec.getString("keyId") + " 0x" + keyId.substring(8,16); */
        } else {
          errorMsgObj.value = trustPrefix + Ec.getString("prefBad",userId) /*+ ", " +
                Ec.getString("keyId") + " 0x" + keyId.substring(8,16); */
          if (!exitCode)
            exitCode = 1;
        }
      }

      if (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        keyIdObj.value = this.extractPubkey(statusMsg)
      }

      return exitCode;
    }


    if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
      // "Unremember" passphrase on decryption failure
      this.clearCachedPassphrase();
    }

    var pubKeyId;

    if (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE) {
      // Unverified signature
      keyIdObj.value = this.extractPubkey(statusMsg);

      if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY) {
        exitCode=0;
      }

    }

    if (exitCode != 0) {
      // Error processing
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessageEnd: command execution exit code: "+exitCode+"\n");
    }

    if (cmdErrorMsgObj.value) {
      errorMsgObj.value = this.agentType + " " + Ec.getString("cmdLine");
      errorMsgObj.value += "\n" + cmdLineObj.value;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    return exitCode;
  },


  // Extract public key from Status Message
  extractPubkey: function (statusMsg) {
    var keyId = null;
    var matchb = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);

    if (matchb && (matchb.length > 3)) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.extractPubkey: NO_PUBKEY 0x"+matchb[3]+"\n");
      keyId = matchb[2]+matchb[3];
    }

    return keyId;
  },


  // ExitCode == 0  => success
  // ExitCode > 0   => error
  // ExitCode == -1 => Cancelled by user
  receiveKey: function (recvFlags, keyserver, keyId, requestObserver, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.receiveKey: "+keyId+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.receiveKey: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return null;
    }

    if (!keyserver) {
      errorMsgObj.value = Ec.getString("failNoServer");
      return null;
    }

    if (!keyId && ! (recvFlags & nsIEnigmail.REFRESH_KEY)) {
      errorMsgObj.value = Ec.getString("failNoID");
      return null;
    }

    var envList = [];
    envList = envList.concat(gEnvList);

    var proxyHost = this.getHttpProxy(keyserver);
    var args = this.getAgentArgs(false);

    if (! (recvFlags & nsIEnigmail.SEARCH_KEY)) args = this.getAgentArgs(true);

    if (proxyHost) {
      args = args.concat(["--keyserver-options", "honor-http-proxy"]);
      envList.push("http_proxy="+proxyHost);
    }
    args = args.concat(["--keyserver", keyserver]);

    var keyIdList = keyId.split(" ");

    if (recvFlags & nsIEnigmail.DOWNLOAD_KEY) {
      args.push("--recv-keys");
      args = args.concat(keyIdList);
    }
    else if (recvFlags & nsIEnigmail.SEARCH_KEY) {
      args.push("--search-keys");
      args = args.concat(keyIdList);
    }
    else if (recvFlags & nsIEnigmail.UPLOAD_KEY) {
      args.push("--send-keys");
      args = args.concat(keyIdList);
    }
    else if (recvFlags & nsIEnigmail.REFRESH_KEY) {
      args.push("--refresh-keys");
    }

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var cmdLineObj   = new Object();

    Ec.CONSOLE_LOG("enigmail> "+printCmdLine(this.agentPath, args)+"\n");

    var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);
    // Create joinable console
    pipeConsole.open(30, 0, true);

    var ipcRequest = null;
    try {
      ipcRequest = gEnigmailSvc.ipcService.runAsync (this.agentPath,
                                                     args, args.length,
                                                     "",
                                                     "",
                                                     0,
                                                     envList, envList.length,
                                                     pipeConsole,
                                                     pipeConsole,
                                                     requestObserver);
    } catch (ex) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.receiveKey: runAsync failed\n");
    }

    if (!ipcRequest) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.receiveKey: runAsync failed due to unknown reasons\n");
      return null;
    }

    return ipcRequest;
  },

  getHttpProxy: function (hostName) {

    function GetPasswdForHost(hostname, userObj, passwdObj) {
      var loginmgr = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);

      // search HTTP password 1st
      var logins = loginmgr.findLogins({}, "http://"+hostname, "", "");
      if (logins.length > 0) {
        userObj.value = logins[0].username;
        passwdObj.value = logins[0].password;
        return true;
      }

      // look for any other password for same host
      logins = loginmgr.getAllLogins({});
      for (var i=0; i < logins.lenth; i++) {
        if (hostname == logins[i].hostname.replace(/^.*:\/\//, "")) {
          userObj.value = logins[i].username;
          passwdObj.value = logins[i].password;
          return true;
        }
      }
      return false;
    }

    var proxyHost = null;
    //try {
      if (this.prefBranch.getBoolPref("respectHttpProxy")) {
        // determine proxy host
        var prefsSvc = Components.classes[NS_PREFS_SERVICE_CID].getService(Components.interfaces.nsIPrefService);
        var prefRoot = prefsSvc.getBranch(null);
        var useProxy = prefRoot.getIntPref("network.proxy.type");
        if (useProxy==1) {
          var proxyHostName = prefRoot.getCharPref("network.proxy.http");
          var proxyHostPort = prefRoot.getIntPref("network.proxy.http_port");
          var noProxy = prefRoot.getCharPref("network.proxy.no_proxies_on").split(/[ ,]/);
          for (var i=0; i<noProxy.length; i++) {
            var proxySearch=new RegExp(noProxy[i].replace(/\./, "\\.")+"$", "i");
            if (noProxy[i] && hostName.search(proxySearch)>=0) {
              i=noProxy.length+1;
              proxyHostName=null;
            }
          }

          if (proxyHostName) {
            var userObj = new Object();
            var passwdObj = new Object();
            if (GetPasswdForHost(proxyHostName, userObj, passwdObj)) {
              proxyHostName = userObj.value+":"+passwdObj.value+"@"+proxyHostName;
            }
          }
          if (proxyHostName && proxyHostPort) {
            proxyHost="http://"+proxyHostName+":"+proxyHostPort;
          }
        }
      }
    //}
    //catch (ex) {}
    return proxyHost;
  },

  searchKey: function (recvFlags, protocol, keyserver, port, keyValue, requestObserver, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.searchKey: "+keyValue+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.searchKey: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return null;
    }

    if (!keyserver) {
      errorMsgObj.value = Ec.getString("failNoServer");
      return null;
    }

    if (!keyValue) {
      errorMsgObj.value = Ec.getString("failNoID");
      return null;
    }

    var envList = [];
    envList = envList.concat(gEnvList);

    var args;
    var command = null;

    var proxyHost = null;
    if (protocol=="hkp") {
      proxyHost = this.getHttpProxy(keyserver);
    }

    if (this.agentVersion < "1.4") {
      var baseCommand = "gpgkeys_" + protocol;
      if (this.isDosLike) {
        baseCommand+=".exe";
      }

      var baseDir = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);
      initPath(baseDir, this.agentPath);

      // try to locate gpgkeys_*
      if (baseDir)
        baseDir = baseDir.parent;
      if (baseDir) {
        var theCommand=baseDir.clone();

        // first the same dir as gpg executable
        theCommand.append(baseCommand);
        if (theCommand.exists() && theCommand.isExecutable())
          command = theCommand.path;

        if (! command) {
          // then lib
          theCommand.append("lib");
          theCommand.append(baseCommand);
          if (theCommand.exists() && theCommand.isExecutable())
            command = theCommand.path;
        }

        if (!command) {
          if (baseDir.parent) {
            baseDir=baseDir.parent;
            theCommand=baseDir.clone();
            // then ..\lib\gnupg or ../lib/gnupg
            theCommand.append("lib");
            theCommand.append("gnupg");
            theCommand.append(baseCommand);
            if (theCommand.exists() && theCommand.isExecutable()) {
              command = theCommand.path;
            }
            else {
              theCommand=baseDir.clone();
              // then ..\libexec\gnupg or ../libexec/gnupg
              theCommand.append("libexec");
              theCommand.append("gnupg");
              theCommand.append(baseCommand);
              if (theCommand.exists() && theCommand.isExecutable())
                command = theCommand.path;
            }
          }
        }
      }

      if (! command) {
        // no gpgkeys_* found
        return null;
      }

      // call gpgkeys to check the version number

      var outObj     = new Object();
      var outLenObj  = new Object();
      var errObj     = new Object();
      var errLenObj  = new Object();

      args = [ "-V" ];
      Ec.CONSOLE_LOG("\nenigmail> "+printCmdLine(command, args)+"\n");

      try {
        var exitCode = this.ipcService.execPipe(command, args, args.length,
                                              false,
                                              "",
                                              "", 0,
                                              envList, envList.length,
                                              outObj, outLenObj,
                                              errObj, errLenObj);
      }
      catch (ex) {
        Ec.CONSOLE_LOG(printCmdLine(command, args)+" failed\n");
        return null;
      }

      if (exitCode !=0) {
        Ec.CONSOLE_LOG(printCmdLine(command, args)+" not found\n");
        return null;
      }

      Ec.CONSOLE_LOG(outObj.value+"\n");

      var ver = outObj.value.split(/[\n\r]+/);
      if (Number(ver[0])==0 || Number(ver[0])==1) {
        var inputData="VERSION "+ver[0]+"\nHOST "+keyserver+"\nPORT "+port+"\n";
      }
      else {
        return null;
      }
      if (proxyHost) {
        inputData+="OPTION honor-http-proxy\n";
        envList.push("http_proxy="+proxyHost);
      }

      if (recvFlags & nsIEnigmail.SEARCH_KEY) {
        inputData+="COMMAND search\n\n"+keyValue+"\n\n";
      }
      else if (recvFlags & nsIEnigmail.DOWNLOAD_KEY) {
        inputData+="COMMAND get\n\n+"+keyValue+"\n\n";
      }
    }
    else {
      // GnuPG >= v1.4.0
      command = this.agentPath;
      args= this.getAgentArgs();
      args = args.concat(["--command-fd", "0", "--no-tty", "--batch", "--fixed-list", "--with-colons"]);
      if (proxyHost) args = args.concat(["--keyserver-options", "http-proxy="+proxyHost]);
      args.push("--keyserver");
      if (! protocol) protocol="hkp";
      if (port) {
        args.push(protocol + "://" + keyserver + ":"+port);
      }
      else {
        args.push(protocol + "://" + keyserver);
      }

      if (recvFlags & nsIEnigmail.SEARCH_KEY) {
        args.push("--search-keys");
        inputData = "quit\n";
      }
      else if (recvFlags & nsIEnigmail.DOWNLOAD_KEY) {
        args = args.concat(["--status-fd", "1", "--recv-keys"]);
        inputData = "";
      }
      args.push(keyValue);
    }

    var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);
    // Create joinable console
    pipeConsole.open(5000, 0, true);

    var errorConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);
    errorConsole.open(20, 0, true);

    Ec.CONSOLE_LOG("enigmail> "+printCmdLine(command, args)+"\n");


    var ipcRequest = null;
    try {
      ipcRequest = gEnigmailSvc.ipcService.runAsync (command,
                                                     args, args.length,
                                                     "",
                                                     inputData,
                                                     inputData.length,
                                                     envList, envList.length,
                                                     pipeConsole,
                                                     errorConsole,
                                                     requestObserver);
    } catch (ex) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.searchKey: runAsync failed\n");
    }

    if (!ipcRequest) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.searchKey: runAsync failed for unkown reasons\n");
      return null;
    }

    return ipcRequest;
  },

  extractKey: function (parent, exportFlags, userId, outputFile, exitCodeObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.extractKey: "+userId+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.extractKey: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var uidList=userId.split(/[ ,\t]+/);

    var args = this.getAgentArgs(true);
    args = args.concat(["-a", "--export"]);
    args = args.concat(uidList);

    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();

    var keyBlock = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if ((exitCodeObj.value == 0) && !keyBlock)
      exitCodeObj.value = -1;

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = Ec.getString("failKeyExtract");

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + command;
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
      args = this.getAgentArgs(true);
      args = args.concat(["-a", "--export-secret-keys"]);
      args = args.concat(uidList);

      var secKeyBlock = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

      if ((exitCodeObj.value == 0) && !secKeyBlock)
        exitCodeObj.value = -1;

      if (exitCodeObj.value != 0) {
        errorMsgObj.value = Ec.getString("failKeyExtract");

        if (cmdErrorMsgObj.value) {
          errorMsgObj.value += "\n" + command;
          errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
        }

        return "";
      }

      if (keyBlock.substr(-1,1).search(/[\r\n]/)<0) keyBlock += "\n"
      keyBlock+=secKeyBlock;
    }

    if (outputFile) {
      if (! WriteFileContents(outputFile, keyBlock, DEFAULT_FILE_PERMS)) {
        exitCodeObj.value = -1;
        errorMsgObj.value = Ec.getString("fileWriteFailed", outputFile);
      }
      return "";
    }
    return keyBlock;
  },


  // ExitCode == 0  => success
  // ExitCode > 0   => error
  // ExitCode == -1 => Cancelled by user
  importKey: function (parent, uiFlags, msgText, keyId, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.importKey: id="+keyId+", "+uiFlags+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.importKey: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return 1;
    }

    var beginIndexObj = new Object();
    var endIndexObj   = new Object();
    var indentStrObj   = new Object();
    var blockType = this.locateArmoredBlock(msgText, 0, "",
                                            beginIndexObj, endIndexObj,
                                            indentStrObj);

    if (!blockType) {
      errorMsgObj.value = Ec.getString("noPGPblock");
      return 1;
    }

    if (blockType != "PUBLIC KEY BLOCK") {
      errorMsgObj.value = Ec.getString("notFirstBlock");
      return 1;
    }

    var pgpBlock = msgText.substr(beginIndexObj.value,
                                  endIndexObj.value - beginIndexObj.value + 1);

    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;

    if (interactive) {
      if (!this.confirmMsg(parent, Ec.getString("importKeyConfirm"), Ec.getString("keyMan.button.import"))) {
        errorMsgObj.value = Ec.getString("failCancel");
        return -1;
      }
    }

    var args = this.getAgentArgs(true);
    args.push("--import");

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();

    var output = this.execCmd(this.agentPath, args, null, pgpBlock,
                        exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    var statusMsg = statusMsgObj.value;

    var pubKeyId;

    if (exitCodeObj.value == 0) {
      // Normal return
      this.invalidateUserIdList();
      if (statusMsg && (statusMsg.search("IMPORTED ") > -1)) {
        var matches = statusMsg.match(/(^|\n)IMPORTED (\w{8})(\w{8})/);

        if (matches && (matches.length > 3)) {
          pubKeyId = "0x" + matches[3];
          Ec.DEBUG_LOG("enigmail.js: Enigmail.importKey: IMPORTED "+pubKeyId+"\n");
        }
      }
    }

    return exitCodeObj.value;
  },

  getEscapedFilename: function (fileNameStr) {
    if (this.isDosLike) {
      // escape the backslashes and the " character (for Windows and OS/2)
      fileNameStr = fileNameStr.replace(/([\\\"])/g, "\\$1");
    }
    return fileNameStr;
  },

  importKeyFromFile: function (parent, inputFile, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.importKeyFromFile: fileName="+inputFile.path+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.importKeyFromFile: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return 1;
    }

    var fileName=this.getEscapedFilename(getFilePath(inputFile.QueryInterface(nsILocalFile)));

    var args = this.getAgentArgs(true);
    args.push("--import");
    args.push(fileName);

    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var exitCodeObj    = new Object();

    var output = this.execCmd(this.agentPath, args, null, "",
                        exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    var statusMsg = statusMsgObj.value;

    var pubKeyId;

    if (exitCodeObj.value == 0) {
      // Normal return
      this.invalidateUserIdList();
      if (statusMsg && (statusMsg.search("IMPORTED ") > -1)) {
        var matches = statusMsg.match(/(^|\n)IMPORTED (\w{8})(\w{8})/);

        if (matches && (matches.length > 3)) {
          pubKeyId = "0x" + matches[3];
          Ec.DEBUG_LOG("enigmail.js: Enigmail.importKey: IMPORTED "+pubKeyId+"\n");
        }
      }
    }

    return exitCodeObj.value;
  },

  generateKey: function (parent, name, comment, email, expiryDate, keyLength, keyType,
            passphrase, requestObserver) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.generateKey: \n");

    if (this.keygenProcess)
      throw Components.results.NS_ERROR_FAILURE;

    var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

    // Create joinable console
    pipeConsole.open(100, 0, true);

    var args = this.getAgentArgs(true);
    args.push("--gen-key");

    pipeConsole.write(printCmdLine(this.agentPath, args)+"\n");
    Ec.CONSOLE_LOG(printCmdLine(this.agentPath, args)+"\n");

    var inputData = "%echo Generating key\nKey-Type: "

    switch (keyType) {
    case KEYTYPE_DSA:
      inputData += "DSA\nKey-Length: 1024\nSubkey-Type: 16\nSubkey-Length: ";
      break;
    case KEYTYPE_RSA:
      inputData += "RSA\nKey-Usage: sign,auth\nKey-Length: "+keyLength;
      inputData += "\nSubkey-Type: RSA\nSubkey-Usage: encrypt\nSubkey-Length: ";
      break;
    default:
      return null;
    }

    inputData += keyLength+"\n";
    inputData += "Name-Real: "+name+"\n";
    if (comment)
      inputData += "Name-Comment: "+comment+"\n";
    inputData += "Name-Email: "+email+"\n";
    inputData += "Expire-Date: "+String(expiryDate)+"\n";

    pipeConsole.write(Ec.convertToUnicode(inputData, "utf-8")+"\n");
    Ec.CONSOLE_LOG(inputData+" \n");

    if (passphrase.length)
      inputData += "Passphrase: "+passphrase+"\n";

    inputData += "%commit\n%echo done\n";

    var ipcRequest = null;
    try {
      ipcRequest = gEnigmailSvc.ipcService.runAsync (this.agentPath,
                                                     args, args.length,
                                                     "",
                                                     inputData,
                                                     inputData.length,
                                                     [], 0,
                                                     pipeConsole,
                                                     pipeConsole,
                                                     requestObserver);
    } catch (ex) {
    }

    if (!ipcRequest) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.generateKey: runAsync failed\n");
      return null;
    }

    this.keygenRequest = ipcRequest;

    Ec.DEBUG_LOG("enigmail.js: Enigmail.generateKey: ipcRequest = "+ipcRequest+"\n");

    return ipcRequest;
  },


  createMessageURI: function (originalUrl, contentType, contentCharset, contentData, persist) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.createMessageURI: "+originalUrl+
              ", "+contentType+", "+contentCharset+"\n");

    var messageId = "msg" + Math.floor(Math.random()*1.0e9);

    this._messageIdList[messageId] = {originalUrl:originalUrl,
                                      contentType:contentType,
                                      contentCharset:contentCharset,
                                      contentData:contentData,
                                      persist:persist};

    return "enigmail:message?id="+messageId;
  },

  deleteMessageURI: function (uri) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.deleteMessageURI: "+uri+"\n");

    var messageId = ExtractMessageId(uri);

    if (!messageId)
      return false;

    return (delete this._messageIdList[messageId]);
  },


  selectPanel: function (url) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.selectPanel: "+url+"\n");

    var wm = Components.classes[WMEDIATOR_CONTRACTID].getService(Components.interfaces.nsIWindowMediator);
    var navWindowList = wm.getEnumerator("navigator:browser");

    var retval = false;
    while (navWindowList.hasMoreElements()) {

      var navWindow =navWindowList.getNext();
      Ec.DEBUG_LOG("enigmail.js: navWindow="+navWindow+"\n");

      var href = navWindow._content.location.href;
      Ec.DEBUG_LOG("enigmail.js: href="+href+"\n");

      if (href.toLowerCase().indexOf(url.toLowerCase()) != 0)
        continue;

      var enigmailPanel = navWindow.document.getElementById("urn:sidebar:3rdparty-panel:"+ENIGMAIL_PANEL_URL);
      Ec.DEBUG_LOG("enigmail.js: panel="+enigmailPanel+"\n");

      if (!enigmailPanel) {
        // Add panel
        enigmailAddPanel();

        enigmailPanel = navWindow.document.getElementById("urn:sidebar:3rdparty-panel:"+ENIGMAIL_PANEL_URL);
        Ec.DEBUG_LOG("enigmail.js: panel="+enigmailPanel+"\n");

        if (!enigmailPanel) {
          Ec.DEBUG_LOG("enigmail.js: Added panel not found in document!\n");
          return false;
        }
      }

      navWindow.SidebarSelectPanel(enigmailPanel, true, true);
      retval = true;
    }

    return retval;
  },



  invalidateUserIdList: function () {
    // clean the userIdList to force reloading the list at next usage
    this.userIdList= null;
  },

  // returns the output of -with-colons --list[-secret]-keys
  getUserIdList: function  (secretOnly, refresh, exitCodeObj, statusFlagsObj, errorMsgObj) {

    if (secretOnly || refresh || this.userIdList == null) {
      var args = this.getAgentArgs(true);

      if (secretOnly) {
        args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"]);
      }
      else {
        args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-keys"]);
      }

      if (!this.initialized) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.getUserIdList: not yet initialized\n");
        errorMsgObj.value = Ec.getString("notInit");
        return "";
      }

      statusFlagsObj.value = 0;

      var statusMsgObj   = new Object();
      var cmdErrorMsgObj = new Object();

      var listText = this.execCmd(this.agentPath, args, null, "",
                        exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

      if (exitCodeObj.value != 0) {
        errorMsgObj.value = Ec.getString("badCommand");
        if (cmdErrorMsgObj.value) {
          errorMsgObj.value += "\n" + printCmdLine(this.agentPath, args);
          errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
        }

        return "";
      }

      listText=listText.replace(/(\r\n|\r)/g, "\n");
      if (secretOnly) {
        return listText;
      }
      this.userIdList = listText;
    }
    else {
      exitCodeObj.value=0;
      statusFlagsObj.value=0;
      errorMsgObj.value="";
    }

    return this.userIdList;
  },

  // returns the output of --with-colons --list-sig
  getKeySig: function  (keyId, exitCodeObj, errorMsgObj) {

    var keyIdList = keyId.split(" ");
    var args = this.getAgentArgs(true);
    args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]);
    args=args.concat(keyIdList);

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.getKeySig: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();

    var listText = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = Ec.getString("badCommand");
      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + printCmdLine(this.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }
    return listText;
  },

  getKeyDetails: function (keyId, uidOnly) {
    var args = this.getAgentArgs(true);
    var keyIdList = keyId.split(" ");
    args=args.concat([ "--fixed-list-mode", "--with-colons", "--list-keys"]);
    args=args.concat(keyIdList);

    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();
    var statusFlagsObj = new Object();
    var exitCodeObj = new Object();

    var listText = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);
    if (exitCodeObj.value != 0) {
      return "";
    }
    listText=listText.replace(/(\r\n|\r)/g, "\n");

    if (uidOnly) {
      var userList="";
      var hideInvalidUid=true;
      var keyArr=listText.split(/\n/);
      for (var i=0; i<keyArr.length; i++) {
        switch (keyArr[i].substr(0,4)) {
        case "pub:":
          if ("idre".indexOf(keyArr[i].split(/:/)[1]) >= 0) {
            // pub key not valid (anymore)-> display all UID's
            hideInvalidUid = false;
          }
        case "uid:":
          var theLine=keyArr[i].split(/:/);
          if (("idre".indexOf(theLine[1]) < 0) || (! hideInvalidUid)) {
            // UID valid or key not valid
            userList += theLine[9] + "\n";
          }
        }
      }
      return userList.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n\n+/g, "\n");
    }

    return listText;
  },

  // returns the output of --with-colons --list-config
  getGnupgConfig: function  (exitCodeObj, errorMsgObj) {

    var args = this.getAgentArgs(true);

    args=args.concat(["--fixed-list-mode", "--with-colons", "--list-config"]);

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.getGnupgConfig: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();
    var statusFlagsObj = new Object();

    var listText = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = Ec.getString("badCommand");
      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + printCmdLine(this.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    listText=listText.replace(/(\r\n|\r)/g, "\n");
    return listText;
  },


  encryptAttachment: function (parent, fromMailAddr, toMailAddr, bccMailAddr, sendFlags, inFile, outFile,
            exitCodeObj, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptAttachment infileName="+inFile.path+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptAttachment: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    statusFlagsObj.value = 0;
    sendFlags |= nsIEnigmail.SEND_ATTACHMENT;

    var asciiArmor = false;
    try {
      asciiArmor = this.prefBranch.getBoolPref("inlineAttachAsciiArmor");
    } catch (ex) {}
    var asciiFlags = (asciiArmor ? ENC_TYPE_ATTACH_ASCII : ENC_TYPE_ATTACH_BINARY);

    var args = this.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, "", sendFlags, asciiFlags, errorMsgObj);

    if (! args)
        return null;

    var passphrase = null;
    var signMessage = (sendFlags & nsIEnigmail.SEND_SIGNED);

    if (signMessage ) {
      args = args.concat(this.passwdCommand());

      var passwdObj = new Object();
      var useAgentObj = new Object();

      if (!GetPassphrase(parent, passwdObj, useAgentObj, 0)) {
         Ec.ERROR_LOG("enigmail.js: Enigmail.encryptAttachment: Error - no passphrase supplied\n");

         statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
         return null;
      }

      passphrase = passwdObj.value;
    }

    var inFilePath  = this.getEscapedFilename(getFilePath(inFile.QueryInterface(nsILocalFile)));
    var outFilePath = this.getEscapedFilename(getFilePath(outFile.QueryInterface(nsILocalFile)));

    args = args.concat(["--yes", "-o", outFilePath, inFilePath ]);

    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();

    var msg = this.execCmd(this.agentPath, args, passphrase, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value != 0) {

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value = printCmdLine(this.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }
      else {
        errorMsgObj.value = "An unknown error has occurred";
      }

      return "";
    }

    return msg;
  },


  getAttachmentFileName: function (parent, inputBuffer) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.getAttachmentFileName\n");

    var args = this.getAgentArgs(true);
    args = args.concat(this.passwdCommand());
    args.push("--list-Ec.packets");

    var passphrase = null;
    var passwdObj = new Object();
    var useAgentObj = new Object();

    if (!GetPassphrase(parent, passwdObj, useAgentObj, 0)) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.getAttachmentFileName: Error - no passphrase supplied\n");
      return null;
    }

    var dataLength = new Object();
    var byteData = inputBuffer.getByteData(dataLength);

    passphrase = passwdObj.value;

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var errorMsgObj    = new Object();

    var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
    ipcBuffer.open(MSG_BUFFER_SIZE, false);

    var noProxy = true;

    var pipeTrans = this.execStart(this.agentPath, args, false, parent, 0,
                                   ipcBuffer, noProxy, statusFlagsObj);


    if (!pipeTrans) {
      return false;
    }

    try {
      if (this.requirePassword()) {
        pipeTrans.writeSync(passphrase, passphrase.length);
        pipeTrans.writeSync("\n", 1);
      }
      pipeTrans.writeSync(byteData, dataLength.value);

    }
    catch (ex) {
      return false;
    }
    // Wait for child STDOUT to close
    pipeTrans.join();

    exitCodeObj.value = pipeTrans.exitValue;

    var statusMsgObj = new Object();
    var cmdLineObj   = new Object();

    try {
      this.execEnd(pipeTrans, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);
    }
    catch (ex) {};

    outputTxt = ipcBuffer.getData();

    var matches = outputTxt.match(/:literal data Ec.packet:\n.*name="(.*)",/m);
    if (matches && (matches.length > 1)) {
      return matches[1];
    }
    else
      return null;
  },


  decryptAttachment: function (parent, outFile, displayName, inputBuffer,
            exitCodeObj, statusFlagsObj, errorMsgObj) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.decryptAttachment: parent="+parent+", outFileName="+outFile.path+"\n");

    var dataLength = new Object();
    var byteData = inputBuffer.getByteData(dataLength);
    var attachmentHead = byteData.substr(0,200);
    if (attachmentHead.match(/\-\-\-\-\-BEGIN PGP \w+ KEY BLOCK\-\-\-\-\-/)) {
      // attachment appears to be a PGP key file

      if (this.confirmMsg(parent, Ec.getString("attachmentPgpKey", displayName), Ec.getString("keyMan.button.import"), Ec.getString("dlg.button.view"))) {
        exitCodeObj.value = this.importKey(parent, 0, byteData, "", errorMsgObj);
        statusFlagsObj.value = gStatusFlags.IMPORTED;
      }
      else {
        exitCodeObj.value = 0;
        statusFlagsObj.value = nsIEnigmail.DISPLAY_MESSAGE;
      }
      return true;
    }

    var outFileName = this.getEscapedFilename(getFilePath(outFile.QueryInterface(nsILocalFile), NS_WRONLY));

    var args = this.getAgentArgs(true);
    args = args.concat(["-o", outFileName, "--yes"]);
    args = args.concat(this.passwdCommand());
    args.push("-d");


    statusFlagsObj.value = 0;

    var passphrase = null;
    var passwdObj = new Object();
    var useAgentObj = new Object();

    if (!GetPassphrase(parent, passwdObj, useAgentObj, 0)) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptAttachment: Error - no passphrase supplied\n");

      statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
      return null;
    }

    passphrase = passwdObj.value;

    var noProxy = true;

    var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
    ipcBuffer.open(MSG_BUFFER_SIZE, false);

    var pipeTrans = this.execStart(this.agentPath, args, false, parent, 0,
                                   ipcBuffer, noProxy, statusFlagsObj);


    if (!pipeTrans) {
      return false;
    }

    try {
      if (this.requirePassword()) {
        pipeTrans.writeSync(passphrase, passphrase.length);
        pipeTrans.writeSync("\n", 1);
      }
      pipeTrans.writeSync(byteData, dataLength.value);

    }
    catch (ex) {
      return false;
    }
    // Wait for child STDOUT to close
    pipeTrans.join();

    exitCodeObj.value = pipeTrans.exitValue;

    var statusMsgObj = new Object();
    var cmdLineObj   = new Object();

    try {
      this.execEnd(pipeTrans, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);
    }
    catch (ex) {};

    return true;

  },

  getCardStatus: function(exitCodeObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.getCardStatus\n");
    var args = this.getAgentArgs(false);

    args = args.concat(["--status-fd", "2", "--fixed-list-mode", "--with-colons", "--card-status"]);
    var statusMsgObj = new Object();
    var statusFlagsObj = new Object();

    var outputTxt = this.execCmd(this.agentPath, args, null, "",
                  exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    if ((exitCodeObj.value == 0) && !outputTxt) {
      exitCodeObj.value = -1;
      return "";
    }

    return outputTxt;
  },

  showKeyPhoto: function(keyId, photoNumber, exitCodeObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.showKeyPhoto, keyId="+keyId+" photoNumber="+photoNumber+"\n");

    var args = this.getAgentArgs();
    args = args.concat(["--no-secmem-warning", "--no-verbose", "--no-auto-check-trustdb", "--batch", "--no-tty", "--status-fd", "1", "--attribute-fd", "2" ]);
    args = args.concat(["--fixed-list-mode", "--list-keys", keyId]);

    var photoDataObj = new Object();

    var outputTxt = this.simpleExecCmd(this.agentPath, args, exitCodeObj, photoDataObj);

    if ((exitCodeObj.value == 0) && !outputTxt) {
      exitCodeObj.value = -1;
      return "";
    }

    if (/*this.agentVersion<"1.5" &&*/ this.isDosLike) {
      // workaround for error in gpg
      photoDataObj.value=photoDataObj.value.replace(/\r\n/g, "\n");
    }

  // [GNUPG:] ATTRIBUTE A053069284158FC1E6770BDB57C9EB602B0717E2 2985
    var foundPicture = -1;
    var skipData = 0;
    var imgSize = -1;
    var statusLines = outputTxt.split(/[\n\r+]/);

    for (var i=0; i < statusLines.length; i++) {
      var matches = statusLines[i].match(/\[GNUPG:\] ATTRIBUTE ([A-F\d]+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)/)
      if (matches && matches[3]=="1") {
        // attribute is an image
        ++foundPicture;
        if (foundPicture == photoNumber) {
          imgSize = Number(matches[2]);
          break;
        }
        else {
          skipData += Number(matches[2]);
        }
      }
    }

    if (foundPicture>=0 && foundPicture == photoNumber) {
      var pictureData = photoDataObj.value.substr(16+skipData, imgSize);
      if (! pictureData.length)
        return "";
      try {
        var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

        var ds = Components.classes[DIR_SERV_CONTRACTID].getService();
        var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
        var picFile = dsprops.get("TmpD", Components.interfaces.nsIFile);

        picFile.append(keyId+".jpg");
        picFile.createUnique(picFile.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);

        var fileStream = Components.classes[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Components.interfaces.nsIFileOutputStream);
        fileStream.init(picFile, flags, DEFAULT_FILE_PERMS, 0);
        if (fileStream.write(pictureData, pictureData.length) != pictureData.length)
            throw Components.results.NS_ERROR_FAILURE;

        fileStream.flush();
        fileStream.close();
      }
      catch (ex) {
        exitCodeObj.value = -1;
        return "";
      }
    }
    return picFile.path;
  },


  // Methods for handling Per-Recipient Rules

  getRulesFile: function () {
    Ec.DEBUG_LOG("enigmail.js: getRulesFile\n");
    var ds = Components.classes[DIR_SERV_CONTRACTID].getService();
    var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
    var rulesFile = dsprops.get("ProfD", Components.interfaces.nsILocalFile);
    rulesFile.append("pgprules.xml");
    return rulesFile;
  },

  loadRulesFile: function () {
    Ec.DEBUG_LOG("enigmail.js: loadRulesFile\n");
    var flags = NS_RDONLY;
    var rulesFile = this.getRulesFile();
    if (rulesFile.exists()) {
      fileContents = EnigReadFile(rulesFile);

      if (fileContents.length==0 || fileContents.search(/^\s*$/)==0) {
        return false;
      }

      var domParser=Components.classes[NS_DOMPARSER_CONTRACTID].createInstance(Components.interfaces.nsIDOMParser);
      this.rulesList = domParser.parseFromString(fileContents, "text/xml");

      return true;
    }
    return false;
  },

  saveRulesFile: function () {
    Ec.DEBUG_LOG("enigmail.js: saveRulesFile\n");

    var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;
    var domSerializer=Components.classes[NS_DOMSERIALIZER_CONTRACTID].createInstance(Components.interfaces.nsIDOMSerializer);
    var rulesFile = this.getRulesFile();
    if (rulesFile) {
      if (this.rulesList) {
        // the rule list is not empty -> write into file
        return WriteFileContents(rulesFile.path,
                               domSerializer.serializeToString(this.rulesList.firstChild),
                               DEFAULT_FILE_PERMS);
      }
      else {
        // empty rule list -> delete rules file
        try {
          rulesFile.remove(false);
        }
        catch (ex) {}
        return true;
      }
    }
    else
      return false;
  },

  getRulesData: function (rulesListObj) {
    Ec.DEBUG_LOG("enigmail.js: getRulesData\n");
    var ret=true;
    if (! this.rulesList) {
       ret=this.loadRulesFile();
    }
    if (this.rulesList) {
      rulesListObj.value = this.rulesList;
      return ret;
    }

    rulesListObj.value = null;
    return false;
  },

  addRule: function (appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags) {
    Ec.DEBUG_LOG("enigmail.js: addRule\n");
    if (! this.rulesList) {
      var domParser=Components.classes[NS_DOMPARSER_CONTRACTID].createInstance(Components.interfaces.nsIDOMParser);
      this.rulesList = domParser.parseFromString("<pgpRuleList/>", "text/xml");
    }
    var negate = (flags & 1);
    var rule=this.rulesList.createElement("pgpRule");
    rule.setAttribute("email", toAddress);
    rule.setAttribute("keyId", keyList);
    rule.setAttribute("sign", sign);
    rule.setAttribute("encrypt", encrypt);
    rule.setAttribute("pgpMime", pgpMime);
    rule.setAttribute("negateRule", flags);
    var origFirstChild = this.rulesList.firstChild.firstChild;

    if (origFirstChild && (! appendToEnd)) {
      this.rulesList.firstChild.insertBefore(rule, origFirstChild);
      this.rulesList.firstChild.insertBefore(this.rulesList.createTextNode(this.isDosLike ? "\r\n" : "\n"), origFirstChild);
    }
    else {
      this.rulesList.firstChild.appendChild(rule);
      this.rulesList.firstChild.appendChild(this.rulesList.createTextNode(this.isDosLike ? "\r\n" : "\n"));
    }

  },

  clearRules: function () {
    this.rulesList = null;
  },

  signKey: function (parent, userId, keyId, signLocally, trustLevel, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.signKey: trustLevel="+trustLevel+", userId="+userId+", keyId="+keyId+"\n");
    var r = this.editKey(parent, true, userId, keyId,
                        (signLocally ? "lsign" : "sign"),
                        { trustLevel: trustLevel},
                        signKeyCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },

  setKeyTrust: function (parent, keyId, trustLevel, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.setKeyTrust: trustLevel="+trustLevel+", keyId="+keyId+"\n");

    return this.editKey(parent, false, null, keyId, "trust",
                        { trustLevel: trustLevel},
                        keyTrustCallback,
                        null,
                        errorMsgObj);
  },

  genRevokeCert: function (parent, keyId, outFile, reasonCode, reasonText, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.genRevokeCert: keyId="+keyId+"\n");

    var r= this.editKey(parent, true, null, keyId, "revoke",
                        { outFile: outFile,
                          reasonCode: reasonCode,
                          reasonText: Ec.convertFromUnicode(reasonText) },
                        revokeCertCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },

  addUid: function (parent, keyId, name, email, comment, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.addUid: keyId="+keyId+", name="+name+", email="+email+"\n");
    var r= this.editKey(parent, true, null, keyId, "adduid",
                        { email: email,
                          name: name,
                          comment: comment,
                          nameAsked: 0,
                          emailAsked: 0 },
                        addUidCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },

  deleteKey: function (parent, keyId, deleteSecretKey, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.addUid: keyId="+keyId+", deleteSecretKey="+deleteSecretKey+"\n");

    var cmd = (deleteSecretKey ? "--delete-secret-and-public-key" : "--delete-key");
    var r= this.editKey(parent, false, null, keyId, cmd,
                        {},
                        deleteKeyCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },

  changePassphrase: function (parent, keyId, oldPw, newPw, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.changePassphrase: keyId="+keyId+"\n");

    var pwdObserver = new enigChangePasswdObserver();
    var r= this.editKey(parent, false, null, keyId, "passwd",
                        { oldPw: oldPw,
                          newPw: newPw,
                          useAgent: this.useGpgAgent(),
                          step: 0,
                          observer: pwdObserver },
                        changePassphraseCallback,
                        pwdObserver,
                        errorMsgObj);
    this.stillActive();

    return r;
  },


  revokeSubkey: function (parent, keyId, subkeys, reasonCode, reasonText, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.revokeSubkey: keyId="+keyId+"\n");

    var r= this.editKey(parent, true, null, keyId, "",
                        { step: 0,
                          subkeys: subkeys.split(/,/),
                          reasonCode: reasonCode,
                          reasonText: Ec.convertFromUnicode(reasonText) },
                        revokeSubkeyCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },

  enableDisableKey: function (parent, keyId, disableKey, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.addUid: keyId="+keyId+", disableKey="+disableKey+"\n");

    var cmd = (disableKey ? "disable" : "enable");
    var r= this.editKey(parent, false, null, keyId, cmd,
                        {},
                        null,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },

  setPrimaryUid: function (parent, keyId, idNumber, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.setPrimaryUid: keyId="+keyId+", idNumber="+idNumber+"\n");
    var r = this.editKey(parent, true, null, keyId, "",
                        { idNumber: idNumber,
                          step: 0 },
                        setPrimaryUidCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },


  deleteUid: function (parent, keyId, idNumber, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.deleteUid: keyId="+keyId+", idNumber="+idNumber+"\n");
    var r = this.editKey(parent, true, null, keyId, "",
                        { idNumber: idNumber,
                          step: 0 },
                        deleteUidCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },


  revokeUid: function (parent, keyId, idNumber, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.revokeUid: keyId="+keyId+", idNumber="+idNumber+"\n");
    var r = this.editKey(parent, true, null, keyId, "",
                        { idNumber: idNumber,
                          step: 0 },
                        revokeUidCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },

  addPhoto: function (parent, keyId, photoFile, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.addPhoto: keyId="+keyId+"\n");

    var photoFileName = this.getEscapedFilename(getFilePath(photoFile.QueryInterface(nsILocalFile)));

    var r = this.editKey(parent, true, null, keyId, "addphoto",
                        { file: photoFileName, step: 0 },
                        addPhotoCallback,
                        null,
                        errorMsgObj);
    this.stillActive();

    return r;
  },


  genCardKey: function (parent, name, email, comment, expiry, backupPasswd, requestObserver, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.genCardKey: \n");
    var generateObserver = new enigCardAdminObserver(requestObserver, this.isDosLike);
    var r = this.editKey(parent, false, null, "", ["--with-colons", "--card-edit"] ,
                        { step: 0,
                          name: Ec.convertFromUnicode(name),
                          email: email,
                          comment: Ec.convertFromUnicode(comment),
                          expiry: expiry,
                          backupPasswd: backupPasswd,
                          backupKey: (backupPasswd.length > 0 ? "Y" : "N"),
                          parent: parent },
                        genCardKeyCallback,
                        generateObserver,
                        errorMsgObj);
    return r;
  },

  cardAdminData: function (parent, name, firstname, lang, sex, url, login, forcepin, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.cardAdminData: parent="+parent+", name="+name+", firstname="+firstname+", lang="+lang+", sex="+sex+", url="+url+", login="+login+", forcepin="+forcepin+"\n");
    var adminObserver = new enigCardAdminObserver(null, this.isDosLike);
    var r = this.editKey(parent, false, null, "", ["--with-colons", "--card-edit"],
            { step: 0,
              name: name,
              firstname: firstname,
              lang: lang,
              sex: sex,
              url: url,
              login: login,
              forcepin: forcepin },
             cardAdminDataCallback,
             adminObserver,
             errorMsgObj);
    return r;
  },

  cardChangePin: function (parent, action, oldPin, newPin, adminPin, pinObserver, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.cardChangePin: parent="+parent+", action="+action+"\n");
    var adminObserver = new enigCardAdminObserver(pinObserver, this.isDosLike);
    var r = this.editKey(parent, false, null, "", ["--with-colons", "--card-edit"],
            { step: 0,
              pinStep: 0,
              action: action,
              oldPin: oldPin,
              newPin: newPin,
              adminPin: adminPin },
             cardChangePinCallback,
             adminObserver,
             errorMsgObj);
    return r;
  },


  editKey: function (parent, needPassphrase, userId, keyId, editCmd, inputData, callbackFunc, requestObserver, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.editKey: parent="+parent+", editCmd="+editCmd+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.editKey: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return -1;
    }

    errorMsgObj.value = "";
    var keyIdList = keyId.split(" ");
    var args = this.getAgentArgs(false);

    var statusFlags = new Object();

    var passphrase = "";
    var useAgentObj = new Object();

    if (needPassphrase) {
      args=args.concat(this.passwdCommand());

      var passwdObj = new Object();

      if (!GetPassphrase(parent, passwdObj, useAgentObj, 0)) {
         Ec.ERROR_LOG("enigmail.js: Enigmail.editKey: Error - no passphrase supplied\n");

         errorMsgObj.value = Ec.getString("noPassphrase");
         return -1;
      }

      passphrase = passwdObj.value;
    }
    else
    {
      useAgentObj.value = true;
    }

    args=args.concat(["--no-tty", "--status-fd", "1", "--logger-fd", "1", "--command-fd", "0"]);
    if (userId) args=args.concat(["-u", userId]);
    var editCmdArr;
    if (typeof(editCmd) == "string") {
      editCmdArr = [ editCmd ];
    }
    else {
      editCmdArr = editCmd;
    }

    if (editCmdArr[0] == "revoke") {
      // escape backslashes and ' characters
      args=args.concat(["-a", "-o"]);
      args.push(this.getEscapedFilename(inputData.outFile));
      args.push("--gen-revoke");
      args=args.concat(keyIdList);
    }
    else if (editCmdArr[0].indexOf("--")==0) {
      args=args.concat(editCmd);
      args=args.concat(keyIdList);
    }
    else {
      args=args.concat(["--ask-cert-level", "--edit-key", keyId]);
      args=args.concat(editCmd);
    }

    var pipeTrans = this.execStart(this.agentPath, args, false, parent, null, null,
                                   true, statusFlags);
    if (! pipeTrans) return -1;

    if (needPassphrase && this.requirePassword()) {
      try {
        pipeTrans.writeSync(passphrase, passphrase.length);
        pipeTrans.writeSync("\n", 1);
      } catch (ex) {}
    }


    var returnCode=-1;
    try {
      var keyEdit = new KeyEditor(pipeTrans, requestObserver);
      returnCode = keyEdit.keyEditorMainLoop(callbackFunc, inputData, errorMsgObj);
    } catch (ex) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.editKey: caught exception from writing to pipeTrans\n");
    }

    var mimeSvc = Components.classes[NS_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

    var exitCode = -1;
    switch(returnCode) {
    case 0:
      for (var retryCount = 100; retryCount > 0; retryCount--) {
        if (pipeTrans.isRunning) {
          Ec.DEBUG_LOG("enigmail.js: Enigmail.editKey: sleeping 100 ms\n");
          mimeSvc.sleep(100);
        }
        else {
          retryCount = -1;
        }
      }
      try{
        exitCode = pipeTrans.exitValue;
      } catch (ex) {
        Ec.DEBUG_LOG("enigmail.js: Enigmail.editKey: caught exception from pipeTrans\n");
      }
      break;
    case -2:
      errorMsgObj.value=Ec.getString("badPhrase");
      this.clearCachedPassphrase();
    default:
      exitCode = returnCode;
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.editKey: GnuPG terminated with code="+exitCode+"\n");
    return exitCode;
  }
} // Enigmail.protoypte

function KeyEditor(pipeTrans, reqObserver) {
  this._pipeTrans = pipeTrans;
  this._reqObserver = reqObserver;
}

KeyEditor.prototype = {
  _pipeTrans: null,
  _txt: null,
  _req: null,

  writeLine: function (inputData) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.keyEditor.writeLine: '"+inputData+"'\n");
    this._pipeTrans.writeSync(inputData+"\n", inputData.length+1);
  },

  nextLine: function() {
    var txt="";
    while (txt.indexOf("[GNUPG:]") < 0) {
      txt = this._pipeTrans.readLine(-1);
      if (this._reqObserver) {
        var newTxt = this._reqObserver.onDataAvailable(txt);
        if (newTxt) {
          txt = newTxt;
        }
      }
    }
    this._txt = txt;
    return this._txt;
  },

  doCheck: function(inputType, promptVal) {
    var a=this._txt.split(/ /);
    return ((a[1] == inputType) && (a[2] == promptVal))
  },

  getText: function() {
    return this._txt;
  },

  keyEditorMainLoop: function (callbackFunc, inputData, errorMsgObj) {
    // main method that loops over the requests & responses of the
    // GnuPG key editor
    var txt="";
    var r = { quitNow: false,
              exitCode: -1 };
    errorMsgObj.value=Ec.getString("undefinedError");

    while (! r.quitNow) {
      while ((txt.indexOf("[GNUPG:] GET_") < 0) && (! r.quitNow)) {
        try {
          txt = this.nextLine();
          Ec.DEBUG_LOG(txt+"\n");
          if (txt.indexOf("KEYEXPIRED") > 0) {
            errorMsgObj.value=Ec.getString("noSignKeyExpired");
            r.exitCode=-1;
          }
          if (txt.indexOf("[GNUPG:] BAD_PASSPHRASE")>=0) {
            r.exitCode=-2;
          }
          if (txt.indexOf("[GNUPG:] NO_CARD_AVAILABLE")>=0) {
            errorMsgObj.value=Ec.getString("noCardAvailable");
            r.exitCode=-3;
          }
          if (txt.indexOf("[GNUPG:] ENIGMAIL_FAILURE")==0) {
            r.exitCode = -3;
            r.quitNow = true;
            errorMsgObj.value = txt.substr(26);
          }
          if (txt.indexOf("[GNUPG:] ALREADY_SIGNED")>=0) {
            errorMsgObj.value=Ec.getString("keyAlreadySigned");
            r.exitCode=-1;
          }
        }
        catch (ex) {
          txt="";
          r.quitNow=true;
        }
      }

      if (! r.quitNow) {
        if (callbackFunc) {
          callbackFunc(inputData, this, r);
          if (r.exitCode == 0) {
            this.writeLine(r.writeTxt);
          }
          else {
            errorMsgObj.value = r.errorMsg;
          }
        }
        else {
          r.quitNow=true;
          r.exitCode = 0;
        }
      }
      if (! r.quitNow) {
        try{
          txt = this.nextLine();
          Ec.DEBUG_LOG(txt+"\n");
        }
        catch(ex) {
          r.quitNow=true;
        }
      }
    }

    try {
      this.writeLine("save\n");
      txt = this.nextLine();
      Ec.DEBUG_LOG(txt+"\n");
    }
    catch (ex) {
      Ec.DEBUG_LOG("no more data\n");
    }

    return r.exitCode;
  },

  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsISupports))
         throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

function signKeyCallback(inputData, keyEdit, ret) {

  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_BOOL, "sign_uid.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.sign_all.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "sign_uid.expire" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";
  }
  else if (keyEdit.doCheck(GET_LINE, "trustsig_prompt.trust_value" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";
  }
  else if (keyEdit.doCheck(GET_LINE, "trustsig_prompt.trust_depth" )) {
    ret.exitCode = 0;
    ret.writeTxt = "";}
  else if (keyEdit.doCheck(GET_LINE, "trustsig_prompt.trust_regexp" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";}
  else if (keyEdit.doCheck(GET_LINE, "siggen.valid" )) {
    ret.exitCode = 0;
    ret.writeTxt = "0";
  }
  else if (keyEdit.doCheck(GET_BOOL, "sign_uid.local_promote_okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "sign_uid.class" )) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.trustLevel;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function keyTrustCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "edit_ownertrust.value" )) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.trustLevel;
  }
  else if (keyEdit.doCheck(GET_BOOL, "edit_ownertrust.set_ultimate.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.quitNow = true;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function addUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keygen.name" )) {
    ++inputData.nameAsked;
    if (inputData.nameAsked==1) {
      ret.exitCode = 0;
      ret.writeTxt = inputData.name;
    }
    else {
      ret.exitCode=-1;
      ret.quitNow=true;
      ret.errorMsg="Invalid name (too short)";
    }
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.email")) {
    ++inputData.emailAsked;
    if (inputData.emailAsked==1) {
      ret.exitCode = 0;
      ret.writeTxt = inputData.email;
    }
    else {
      ret.exitCode=-1;
      ret.quitNow=true;
      ret.errorMsg="Invalid email";
    }
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.comment")) {
    ret.exitCode = 0;
    if (inputData.comment) {
      ret.writeTxt = inputData.comment;
    }
    else {
      ret.writeTxt="";
    }
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.quitNow = true;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function revokeCertCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.code" )) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.reasonCode;
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.text" )) {
    ret.exitCode = 0;
    ret.writeTxt = "";
  }
  else if (keyEdit.doCheck(GET_BOOL, "gen_revoke.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "ask_revocation_reason.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "openfile.overwrite.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function revokeSubkeyCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    if (inputData.step < inputData.subkeys.length) {
      ret.exitCode = 0;
      ret.writeTxt = "key "+inputData.subkeys[inputData.step];
      ++inputData.step;
    }
    else if (inputData.step == inputData.subkeys.length) {
      ret.exitCode = 0;
      ret.writeTxt = "revkey";
      ++inputData.step;
    }
    else {
      if (inputData.step == (inputData.subkeys.length+1)) {
        ret.exitCode = 0;
      }
      else {
        ret.exitCode = -1;
      }
      ret.quitNow = true;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.revoke.subkey.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.code" )) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.reasonCode;
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.text" )) {
    ret.exitCode = 0;
    ret.writeTxt = "";
  }
  else if (keyEdit.doCheck(GET_BOOL, "ask_revocation_reason.okay" )) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function setPrimaryUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ++inputData.step;
    switch (inputData.step) {
    case 1:
      ret.exitCode = 0;
      ret.writeTxt = "uid "+inputData.idNumber;
      break;
    case 2:
      ret.exitCode = 0;
      ret.writeTxt = "primary";
      break;
    case 3:
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    default:
      ret.exitCode = -1;
      ret.quitNow=true;
    }

  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function changePassphraseCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_HIDDEN, "passphrase.enter")) {
    switch (inputData.observer.passphraseStatus) {
    case 0:
      ret.writeTxt = inputData.oldPw;
      ret.exitCode = 0;
      break;
    case 1:
      ret.writeTxt = inputData.newPw;
      ret.exitCode = 0;
      break;
    case -1:
      ret.exitCode = -2;
      ret.quitNow=true;
      break;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "change_passwd.empty.okay")) {
    ret.writeTxt = "Y";
    ret.exitCode = 0;
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    if (inputData.useAgent) ret.exitCode=0;
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function deleteUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ++inputData.step;
    switch (inputData.step) {
    case 1:
      ret.exitCode = 0;
      ret.writeTxt = "uid "+inputData.idNumber;
      break;
    case 2:
      ret.exitCode = 0;
      ret.writeTxt = "deluid";
      break;
    case 4:
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    default:
      ret.exitCode = -1;
      ret.quitNow=true;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.remove.uid.okay" )) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function revokeUidCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ++inputData.step;
    switch (inputData.step) {
    case 1:
      ret.exitCode = 0;
      ret.writeTxt = "uid "+inputData.idNumber;
      break;
    case 2:
      ret.exitCode = 0;
      ret.writeTxt = "revuid";
      break;
    case 7:
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    default:
      ret.exitCode = -1;
      ret.quitNow=true;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.revoke.uid.okay" )) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.code")) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "0"; // no reason specified
  }
  else if (keyEdit.doCheck(GET_LINE, "ask_revocation_reason.text")) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "";
  }
  else if (keyEdit.doCheck(GET_BOOL, "ask_revocation_reason.okay")) {
    ++inputData.step;
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}


function deleteKeyCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_BOOL, "delete_key.secret.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "keyedit.remove.subkey.okay")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_BOOL, "delete_key.okay" )) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function GetPin(domWindow, promptMsg, ret) {
  Ec.DEBUG_LOG("enigmail.js: GetPin: \n");

  var passwdObj = {value: ""};
  var dummyObj = {};

  var success = false;

  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  success = promptService.promptPassword(domWindow,
                                         Ec.getString("Enigmail"),
                                         promptMsg,
                                         passwdObj,
                                         null,
                                         dummyObj);

  if (!success) {
    ret.errorMsg = Ec.getString("noPassphrase");
    ret.quitNow=true;
    return false;
  }

  Ec.DEBUG_LOG("enigmail.js: GetPin: got pin\n");
  ret.writeTxt = passwdObj.value;

  return true;
}

function genCardKeyCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  var pinObj={};

  if (keyEdit.doCheck(GET_LINE, "cardedit.prompt")) {
    if (inputData.step == 0) {
      ret.exitCode = 0;
      ret.writeTxt = "admin";
    }
    else if (inputData.step == 1) {
      ret.exitCode = 0;
      ret.writeTxt = "generate";
    }
    else {
      ret.exitCode = 0;
      ret.quitNow=true;
      ret.writeTxt = "quit";
    }
    ++inputData.step;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.genkeys.backup_enc") ||
           keyEdit.doCheck(GET_BOOL, "cardedit.genkeys.backup_enc")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.backupKey;
  }
  else if (keyEdit.doCheck(GET_BOOL, "cardedit.genkeys.replace_keys")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y";
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.enter")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.backupPasswd;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.valid")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.expiry;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.genkeys.size")) {
    ret.exitCode = 0;
    ret.writeTxt = "2048";
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.name")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.name;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.email")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.email;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.comment")) {
    ret.exitCode = 0;
    if (inputData.comment) {
      ret.writeTxt = inputData.comment;
    }
    else {
      ret.writeTxt="";
    }
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function cardAdminDataCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  var pinObj={};

  if (keyEdit.doCheck(GET_LINE, "cardedit.prompt")) {
    ++inputData.step;
    ret.exitCode = 0;
    switch(inputData.step) {
    case 1:
      ret.writeTxt = "admin";
      break;
    case 2:
      ret.writeTxt = "name";
      break;
    case 3:
      ret.writeTxt = "lang";
      break;
    case 4:
      ret.writeTxt = "sex";
      break;
    case 5:
      ret.writeTxt = "url";
      break;
    case 6:
      ret.writeTxt = "login";
      break;
    case 7:
      if (inputData.forcepin != 0) {
        ret.writeTxt = "forcesig";
        break;
      }
    default:
      ret.writeTxt = "quit";
      ret.quitNow=true;
      break;
    }
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.smartcard.surname")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.firstname.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.smartcard.givenname")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.name.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_sex")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.sex;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_lang")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.lang.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_url")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.url.replace(/^$/, "-");;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_login")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.login.replace(/^$/, "-");
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function cardChangePinCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "cardedit.prompt")) {
    ++inputData.step;
    ret.exitCode=0;
    switch (inputData.step) {
    case 1:
      ret.writeTxt = "admin";
      break;
    case 2:
      ret.writeTxt = "passwd";
      break;
    default:
      ret.writeTxt = "quit";
      ret.exitCode = 0;
      ret.quitNow=true;
      break;
    }
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    ret.exitCode=0;
    ret.writeTxt = inputData.adminPin;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    ret.exitCode=0;
    ret.writeTxt = inputData.oldPin;
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.new.ask") ||
           keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.repeat") ||
           keyEdit.doCheck(GET_HIDDEN, "passphrase.ask") ||
           keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.new.ask")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.newPin;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardutil.change_pin.menu")) {
    ret.exitCode=0;
    ++inputData.pinStep;
    if (inputData.pinStep == 1) {
      ret.writeTxt = inputData.action.toString();
    }
    else {
      ret.writeTxt = "Q";
    }
  }
  else {
    ret.exitCode=-1;
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
  }
}


function addPhotoCallback(inputData, keyEdit, ret) {
  ret.writeTxt = "";
  ret.errorMsg = "";

  if (keyEdit.doCheck(GET_LINE, "keyedit.prompt" )) {
    ret.exitCode = 0;
    ret.writeTxt = "save";
    ret.quitNow=true;
  }
  else if (keyEdit.doCheck(GET_LINE, "photoid.jpeg.add" )) {
    if (inputData.step == 0) {
      ++inputData.step;
      ret.exitCode = 0;
      ret.writeTxt = inputData.file;
    }
    else {
      ret.exitCode = -1;
      ret.quitNow=true;
    }
  }
  else if (keyEdit.doCheck(GET_BOOL, "photoid.jpeg.size")) {
    ret.exitCode = 0;
    ret.writeTxt = "Y"; // add large file
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.adminpin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, Ec.getString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    Ec.ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function enigCardAdminObserver(guiObserver, isDosLike) {
  this._guiObserver = guiObserver;
  this.isDosLike = isDosLike;
}

enigCardAdminObserver.prototype =
{
  _guiObserver: null,
  _failureCode: 0,

  QueryInterface : function(iid)
  {
    if (iid.equals(Components.interfaces.nsIEnigMimeReadCallback) ||
        iid.equals(Components.interfaces.nsISupports) )
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  onDataAvailable: function (data) {
    var ret="";
    Ec.DEBUG_LOG("enigmail.js: enigCardAdminObserver.onDataAvailable: data="+data+"\n");
    if (this.isDosLike && data.indexOf("[GNUPG:] BACKUP_KEY_CREATED") == 0) {
      data=data.replace(/\//g, "\\");
    }
    if (this._failureCode) {
      ret = "[GNUPG:] ENIGMAIL_FAILURE "+data;
    }
    if (data.indexOf("[GNUPG:] SC_OP_FAILURE")>=0) {
      this._failureCode = 1;
    }
    if (this._guiObserver) {
      this._guiObserver.onDataAvailable(data);
    }
    return ret;
  }
}

function enigChangePasswdObserver() {}

enigChangePasswdObserver.prototype =
{
  _failureCode: 0,
  passphraseStatus: 0,

  QueryInterface : function(iid)
  {
    if (iid.equals(Components.interfaces.nsIEnigMimeReadCallback) ||
        iid.equals(Components.interfaces.nsISupports) )
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  onDataAvailable: function (data) {
    var ret="";
    Ec.DEBUG_LOG("enigmail.js: enigChangePasswdObserver.onDataAvailable: data="+data+"\n");
    if (this._failureCode) {
      ret = "[GNUPG:] ENIGMAIL_FAILURE "+data;
    }
    if (data.indexOf("[GNUPG:] GOOD_PASSPHRASE")>=0) {
      this.passphraseStatus = 1;
    }
    else if (data.indexOf("[GNUPG:] BAD_PASSPHRASE")>=0) {
      this.passphraseStatus = -1;
    }
    return ret;
  }
}


function EnigCmdLineHandler() {}

EnigCmdLineHandler.prototype = {
  classDescription: "Enigmail Key Management CommandLine Service",
  classID:  NS_ENIGCLINE_SERVICE_CID,
  contractID: NS_CLINE_SERVICE_CONTRACTID,
  _xpcom_categories: [{
    category: "command-line-handler",
    entry: "cline-enigmail",
    service: false
  }],
  QueryInterface: XPCOMUtils.generateQI([nsICommandLineHandler, nsIFactory, nsISupports]),

  // nsICommandLineHandler
  handle: function(cmdLine) {
    if (cmdLine.handleFlag("pgpkeyman", false)) {
      cmdLine.preventDefault = true; // do not open main app window

      var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                             .getService(Components.interfaces.nsIWindowWatcher);
      wwatch.openWindow(null, "chrome://enigmail/content/enigmailKeyManager.xul", "_blank",
                        "chrome,dialog=no,all", cmdLine);
    }
  },

  helpInfo: "  -pgpkeyman         Open the OpenPGP key management.\n",

  lockFactory: function (lock) {}
};


function enigExtractHashAlgo(msgTxt) {
  Ec.DEBUG_LOG("enigmail.js: enigExtractHashAlgo\n");

  var m = msgTxt.match(/^(Hash: )(.*)$/m);
  if (m.length > 2 && m[1] == "Hash: ") {
    var hashAlgorithm = m[2].toLowerCase();
    for (var i=1; i < gMimeHashAlgorithms.length; i++) {
      if (gMimeHashAlgorithms[i] == hashAlgorithm) {
        Ec.DEBUG_LOG("enigmail.js: enigExtractHashAlgo: found hashAlgorithm "+hashAlgorithm+"\n");
        return hashAlgorithm;
      }
    }
  }

  Ec.DEBUG_LOG("enigmail.js: enigExtractHashAlgo: no hashAlgorithm found\n");
  return null;
}

///////////////////////////////////////////////////////////////////////////////

if (XPCOMUtils.generateNSGetFactory) {
  // Gecko >= 2.0
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([Enigmail, EnigmailProtocolHandler, EnigCmdLineHandler]);
  dump("enigmail.js: Registered components\n");
}
else {
  // Gecko <= 1.9.x
  var NSGetModule = XPCOMUtils.generateNSGetModule([Enigmail, EnigmailProtocolHandler, EnigCmdLineHandler, EnigmailPrefService]);
  dump("enigmail.js: Registered components\n");
}

