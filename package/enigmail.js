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

/* Contract IDs and CIDs used by this module */
const NS_IPCSERVICE_CONTRACTID  = "@mozilla.org/process/ipc-service;1";

const NS_PIPECONSOLE_CONTRACTID = "@mozilla.org/process/pipe-console;1";

const NS_PROCESSINFO_CONTRACTID = "@mozilla.org/xpcom/process-info;1";

const NS_SIMPLEURI_CONTRACTID   = "@mozilla.org/network/simple-uri;1";

const NS_PROMPTSERVICE_CONTRACTID = "@mozilla.org/embedcomp/prompt-service;1";

const NS_HTTPPROTOCOLHANDLER_CID_STR= "{4f47e42e-4d23-4dd3-bfda-eb29255e9ea3}";

const NS_IOSERVICE_CID_STR          = "{9ac9e770-18bc-11d3-9337-00104ba0fd40}";

// User interaction flags
const UI_INTERACTIVE    = 0x01;
const IMPORT_KEY        = 0x02;

// Encryption flags
const SIGN_MESSAGE      = 0x01;
const ENCRYPT_MESSAGE   = 0x02;
const ALWAYS_TRUST_SEND = 0x04;
const ENCRYPT_TO_SELF   = 0x08;

/* Interfaces */
const nsISupports            = Components.interfaces.nsISupports;
const nsILocalFile           = Components.interfaces.nsILocalFile;
const nsIHttpProtocolHandler = Components.interfaces.nsIHttpProtocolHandler;
const nsIProtocolHandler     = Components.interfaces.nsIProtocolHandler;
const nsIIPCService          = Components.interfaces.nsIIPCService;
const nsIPipeConsole         = Components.interfaces.nsIPipeConsole;
const nsIProcessInfo         = Components.interfaces.nsIProcessInfo;
const nsIEnigmail            = Components.interfaces.nsIEnigmail;
const nsIPGPModule           = Components.interfaces.nsIPGPModule;
const nsIPGPMsgBody          = Components.interfaces.nsIPGPMsgBody;
const nsIPGPMsgHeader        = Components.interfaces.nsIPGPMsgHeader;

///////////////////////////////////////////////////////////////////////////////
// Global variables

var gLogLevel = 3;         // Output only errors/warnings by default
var gLogFileStream = null;

var gEnigmailSvc = null;   // Global Enigmail Service
var gXULOwner = null;      // Global XUL owner
var gEnvList = [];         // Global environment list

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

function CreateFileStream(filePath, permissions) {

  //DEBUG_LOG("enigmail.js: CreateFileStream: file="+filePath+"\n");

  try {
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

  } catch (ex) {
    ERROR_LOG("enigmail.js: CreateFileStream: Failed to create "+filePath+"\n");
    return null;
  }
}

function WriteFileContents(filePath, data, permissions) {

  //DEBUG_LOG("enigmail.js: WriteFileContents: file="+filePath+"\n");

  try {
    var fileOutStream = CreateFileStream(filePath, permissions);

    if (data.length) {
      if (fileOutStream.write(data, data.length) != data.length)
        throw Components.results.NS_ERROR_FAILURE;

      fileOutStream.flush();
    }
    fileOutStream.close();

  } catch (ex) {
    ERROR_LOG("enigmail.js: WriteFileContents: Failed to write to "+filePath+"\n");
  }

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
  if ((gLogLevel >= 4) || (gEnigmailSvc && gEnigmailSvc.debug))
    WRITE_LOG(str);
}

function WARNING_LOG(str) {
  if (gLogLevel >= 3)
    WRITE_LOG(str);

  if (gEnigmailSvc && gEnigmailSvc.console)
    gEnigmailSvc.console.write(str);
}

function ERROR_LOG(str) {
  if (gLogLevel >= 2)
    WRITE_LOG(str);

  if (gEnigmailSvc && gEnigmailSvc.console)
    gEnigmailSvc.console.write(str);
}

function CONSOLE_LOG(str) {
  if (gLogLevel >= 3)
    WRITE_LOG(str);

  if (gEnigmailSvc && gEnigmailSvc.console)
    gEnigmailSvc.console.write(str);
}

// Uncomment following two lines for debugging (use full path name on Win32)
///if (gLogLevel >= 4)
///  gLogFileStream = CreateFileStream("c:\\enigdbg1.txt");

///////////////////////////////////////////////////////////////////////////////

var EnigModuleObj = {
  registerSelf: function (componentManager, moduleFile, registryLocation, componentType)
  {
    WRITE_LOG("enigmail.js: Registering components\n");

    componentManager = componentManager.QueryInterface(Components.interfaces.nsIComponentManagerObsolete);

    componentManager.registerComponentWithType(NS_ENIGMAIL_CID,
                                               "Enigmail",
                                               NS_ENIGMAIL_CONTRACTID,
                                               moduleFile, registryLocation,
                                               true, true, componentType);

    componentManager.registerComponentWithType(NS_ENIGMAILPROTOCOLHANDLER_CID,
                                               "Enigmail Protocol Handler",
                                               NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID,
                                               moduleFile, registryLocation,
                                               true, true, componentType);

    componentManager.registerComponentWithType(NS_PGP_MODULE_CID,
                                               "PGP Module",
                                               NS_PGP_MODULE_CONTRACTID,
                                               moduleFile, registryLocation,
                                               true, true, componentType);
    DEBUG_LOG("enigmail.js: Registered components\n");
  },

  unregisterSelf: function(componentManager, moduleFile, registryLocation)
  {
    DEBUG_LOG("enigmail.js: unregisterSelf\n");

  },

  getClassObject: function (componentManager, cid, iid) {
    DEBUG_LOG("enigmail.js: getClassObject: cid="+cid+"\n");

    if (!iid.equals(Components.interfaces.nsIFactory))
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (gEnigmailSvc == null) {
      // Create Enigmail Service (delay initialization)
      gEnigmailSvc = new Enigmail(false);
    }

    if (cid.equals(NS_ENIGMAIL_CID)) {
      return new EnigmailFactory();
    }

    if (cid.equals(NS_ENIGMAILPROTOCOLHANDLER_CID)) {
      return new EnigmailProtocolHandlerFactory();
    }

    if (cid.equals(NS_PGP_MODULE_CID)) {
      return new PGPModuleFactory();
    }

  },

  canUnload: function(componentManager)
  {
    DEBUG_LOG("enigmail.js: canUnload:\n");
    return true;
  }
};

/* Module entry point */
function NSGetModule(componentManager, moduleFile) {
  DEBUG_LOG("enigmail.js: NSGetModule:\n");
  return EnigModuleObj;
}

///////////////////////////////////////////////////////////////////////////////

function EnigmailFactory()
{
}

EnigmailFactory.prototype = {
  QueryInterface: function (iid) {

    //DEBUG_LOG("EnigmailFactory.QueryInterface:"+iid+"\n");
    if (!iid.equals(Components.interfaces.nsIFactory) &&
        !iid.equals(nsISupports))
    throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  createInstance: function (outer, iid) {
    //DEBUG_LOG("EnigmailFactory.createInstance:\n");
    if (!gEnigmailSvc)
      throw Components.results.NS_ERROR_NOT_INITIALIZED;

    return gEnigmailSvc;
  }
}

function PGPModuleFactory()
{
}

PGPModuleFactory.prototype = {
  QueryInterface: function (iid) {

    //DEBUG_LOG("PGPModuleFactory.QueryInterface:"+iid+"\n");
    if (!iid.equals(Components.interfaces.nsIFactory) &&
        !iid.equals(nsISupports))
    throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  createInstance: function (outer, iid) {
    DEBUG_LOG("PGPModuleFactory.createInstance:\n");
    return new PGPModule();
  }
}

function PGPMsgHeader(aTo, aCc, aBcc)
{
  this.to  = aTo;
  this.cc  = aCc;
  this.bcc = aBcc;
}

PGPMsgHeader.prototype = {

  to: "",
  cc: "",
  bcc: "",

  QueryInterface: function (iid) {
    DEBUG_LOG("PGPMsgHeader.QueryInterface:\n");

    if (!iid.equals(nsIPGPMsgHeader) && !iid.equals(nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
}

function PGPMsgBody(aBody)
{
  this.body = aBody;
}

PGPMsgBody.prototype = {

  body: "",

  QueryInterface: function (iid) {
    DEBUG_LOG("PGPMsgBody.QueryInterface:\n");

    if (!iid.equals(nsIPGPMsgBody) && !iid.equals(nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  }
}

function PGPModule()
{
}

PGPModule.prototype = {

  QueryInterface: function (iid) {
    DEBUG_LOG("PGPModule.QueryInterface:\n");

    if (!iid.equals(nsIPGPModule) && !iid.equals(nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  },

  // void SetEncrypt(in boolean aEncrypt, in long aFlags,
  //                 [retval] out long aNewFlags);
  SetEncrypt: function (aEncrypt, aFlags, aNewFlags) {
    DEBUG_LOG("PGPModule.SetEncrypt:\n");

    return 0;
  },

  // void SetSign(in boolean aSign, in long aFlags,
  // [retval] out long aNewFlags);
  SetSign: function (aSign, aFlags, aNewFlags) {
    DEBUG_LOG("PGPModule.SetSign:\n");

    return 0;
  },

  // void SetPGPMIME(in boolean aMime, in long aFlags,
  //                 [retval] out long aNewFlags);
  SetPGPMIME: function (aMime, Flags, aNewFlags) {
    DEBUG_LOG("PGPModule.SetPGPMIME:\n");

    return 0;
  },

  // nsISupports CreateMsgHeader(in string aTo, in string aCc, in string aBcc);
  CreateMsgHeader: function (aTo, aCc, aBcc) {
    DEBUG_LOG("PGPModuleCreateMsgHeader.:\n");

    return new PGPMsgHeader(aTo, aCc, aBcc);
  },

  //nsISupports CreateMsgBody(in string aBody);
  CreateMsgBody: function (aBody) {
    DEBUG_LOG("PGPModule.CreateMsgBody: "+aBody+"\n");
    return new PGPMsgBody(aBody);
  },

  // string GetStringFromMsgBody(in nsISupports aMsgBody);
  GetStringFromMsgBody: function (aMsgBody) {
    DEBUG_LOG("PGPModule.GetStringFromMsgBody:\n");

    aMsgBody = aMsgBody.QueryInterface(nsIPGPMsgBody);
    return aMsgBody.body;
  },

  //  void EncryptSign(in long aFlags, in nsISupports aMsgHeader, 
  //                   in nsISupports aOrigBody,
  //                   [retval] out nsISupports aNewBody);
  EncryptSign: function (aFlags, aMsgHeader, aOrigBody, aNewBody) {
    DEBUG_LOG("PGPModule.EncryptSign:\n");

    aMsgHeader = aMsgHeader.QueryInterface(nsIPGPMsgHeader);
    aOrigBody = aOrigBody.QueryInterface(nsIPGPMsgBody);

    DEBUG_LOG("PGPModule.EncryptSign: aMsgHeader.to="+aMsgHeader.to+"\n");
    DEBUG_LOG("PGPModule.EncryptSign: aOrigBody.body="+aOrigBody.body+"\n");
    DEBUG_LOG("PGPModule.EncryptSign: aNewBody="+aNewBody+"\n");

    var exitCodeObj  = new Object();
    var errorMsgObj  = new Object();
    var statusMsgObj = new Object();
    var encryptFlags = SIGN_MESSAGE|ENCRYPT_MESSAGE;

    var cipherText = gEnigmailSvc.encryptMessage(null, 0,
                                                 aOrigBody.body,
                                                 "",
                                                 aMsgHeader.to,
                                                 encryptFlags,
                                                 exitCodeObj,
                                                 errorMsgObj);

    return new PGPMsgBody(cipherText);
  },

  // void DecryptVerify(in nsISupports aOrigBody,
  //                    [retval] out nsISupports aNewBody)
  DecryptVerify: function (aOrigBody, aNewBody) {
    DEBUG_LOG("PGPModule.DecryptVerify:\n");

    aOrigBody = aOrigBody.QueryInterface(nsIPGPMsgBody);

    DEBUG_LOG("PGPModule.DecrypotVerify: aOrigBody.body="+aOrigBody.body+"\n");

    var exitCodeObj  = new Object();
    var errorMsgObj  = new Object();
    var signatureObj = new Object();

    var plainText = gEnigmailSvc.decryptMessage(null, 0,
                                                aOrigBody.body,
                                                exitCodeObj,
                                                errorMsgObj,
                                                signatureObj);

    return new PGPMsgBody(plainText);
  },

  // void FreeMsgHeader(in nsISupports aMsgHeader);
  FreeMsgHeader: function (aMsgHeader) {
    DEBUG_LOG("PGPModule.FreeMsgHeader:\n");
  },

  // void FreeMsgBody(in nsISupports aMsgBody);
  FreeMsgBody: function (aMsgBody) {
    DEBUG_LOG("PGPModule.FreeMsgBody:\n");
  },

  //  void FindHeader(in string aHeaderBuffer, in string aHeaderStr,
  //          out long aHeaderStartOffset, out long aHeaderLength, 
  //          [retval] out long aBufferEndOffset);
  FindHeader: function (aHeaderBuffer, aHeaderStr,
                        aHeaderStartOffset, aHeaderLength, aBufferEndOffset) {
   DEBUG_LOG("PGPModule.FindHeader:\n");

   DEBUG_LOG("PGPModule.EncryptSign: aHeaderBuffer="+aHeaderBuffer+"\n");

   for (var k in aHeaderStartOffset)
      DEBUG_LOG("PGPModule.EncryptSign: k="+k+"\n");

   DEBUG_LOG("PGPModule.EncryptSign: aHeaderStartOffset="+aHeaderStartOffset+"\n");
   DEBUG_LOG("PGPModule.EncryptSign: aHeaderLength="+aHeaderLength+"\n");
   DEBUG_LOG("PGPModule.EncryptSign: aBufferEndOffset="+aBufferEndOffset+"\n");

   aHeaderStartOffset.value = 0;
   aHeaderLength.value = 0;
   aBufferEndOffset.value = 0;
  },

  // boolean ContainsPGPContent(in string aBuffer);
  ContainsPGPContent: function (aBuffer) {
    DEBUG_LOG("PGPModule.ContainsPGPContent:\n");
    return false;
  }

}

///////////////////////////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////////////////////////

function isAbsolutePath(filePath, isWin32) {
  // Check if absolute path
  if (isWin32) {
    return (filePath.search(/^\w+:\\/) == 0);
  } else {
    return (filePath.search(/^\//) == 0)
  }
}

function ResolvePath(filePath, envPath, isWin32) {
  DEBUG_LOG("enigmail.js: ResolvePath: filePath="+filePath+"\n");

  if (isAbsolutePath(filePath, isWin32))
    return filePath;

  if (!envPath)
     return null;

  var pathDirs = envPath.split(isWin32 ? ";" : ":");

  for (var j=0; j<pathDirs.length; j++) {
     try {
        var pathDir = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);

        pathDir.initWithPath(pathDirs[j]);

        if (pathDir.exists() && pathDir.isDirectory()) {
           pathDir.appendRelativePath(filePath);

           if (pathDir.exists()) {
              return pathDir.path;
           }
        }
     } catch (ex) {
     }
  }

  return null;
}

///////////////////////////////////////////////////////////////////////////////
// Enigmail protocol handler
///////////////////////////////////////////////////////////////////////////////

function EnigmailProtocolHandler()
{
}

EnigmailProtocolHandler.prototype.scheme = "enigmail";
EnigmailProtocolHandler.prototype.defaultPort = -1;

EnigmailProtocolHandler.prototype.QueryInterface =
function (iid)
{
  DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.QueryInterface\n");

  if (!iid.equals(nsIProtocolHandler) && !iid.equals(nsISupports))
    throw Components.results.NS_ERROR_NO_INTERFACE;

  return this;
}

EnigmailProtocolHandler.prototype.newURI =
function (aSpec, aBaseURI)
{
  DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newURI: aSpec='"+aSpec+"'\n");

  if (aBaseURI) {
    ERROR_LOG("enigmail.js: Enigmail: Error - BaseURI for enigmail: protocol!");
    throw Components.results.NS_ERROR_FAILURE;
  }
    
  var uri = Components.classes[NS_SIMPLEURI_CONTRACTID].createInstance(Components.interfaces.nsIURI);
  uri.spec = aSpec;
    
  return uri;
}

EnigmailProtocolHandler.prototype.newChannel =
function (aURI)
{
  DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: URI='"+aURI.spec+"'\n");

  var spec;
  if (aURI.spec == aURI.scheme+":about") {
    // About Enigmail
    spec = "chrome://enigmail/content/enigmailAbout.htm";

  } else if (aURI.spec == aURI.scheme+":console") {
    // Display enigmail console messages
    spec = "chrome://enigmail/content/enigmailConsole.htm";

  } else if (aURI.spec == aURI.scheme+":keygenConsole") {
    // Display enigmail key generation console
    spec = "chrome://enigmail/content/enigmailKeygenConsole.htm";

  } else if (aURI.spec == aURI.scheme+":keygen") {
    // Display enigmail key generation console
    spec = "chrome://enigmail/content/enigmailKeygen.xul";

  } else {
    // Display Enigmail config page
    spec = "chrome://enigmail/content/enigmail.xul";
  }

  // ***NOTE*** Creating privileged channel
  var ioServ = Components.classesByID[NS_IOSERVICE_CID_STR].getService(Components.interfaces.nsIIOService);

  var privChannel = ioServ.newChannel(spec, null);

  privChannel.originalURI = aURI;

  // Make new channel owned by XUL owner
  privChannel.owner = GetXULOwner();

  return privChannel;
}

function EnigmailProtocolHandlerFactory() {
}

EnigmailProtocolHandlerFactory.prototype = {
  QueryInterface: function (iid) {

    //DEBUG_LOG("EnigmailProtocolHandlerFactory.QueryInterface:"+iid+"\n");
    if (!iid.equals(Components.interfaces.nsIFactory) &&
        !iid.equals(nsISupports))
    throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  createInstance: function (outer, iid) {
    DEBUG_LOG("enigmail.js: EnigmailProtocolHandlerFactory.createInstance\n");

    if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;

    if (!iid.equals(nsIProtocolHandler) && !iid.equals(nsISupports))
        throw Components.results.NS_ERROR_INVALID_ARG;

    return new EnigmailProtocolHandler();
  }
}

///////////////////////////////////////////////////////////////////////////////
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

function GetXULOwner () {
  if (gXULOwner)
    return gXULOwner;

  // Open temporary XUL channel
  var ioServ = Components.classesByID[NS_IOSERVICE_CID_STR].getService(Components.interfaces.nsIIOService);

  var temChannel = ioServ.newChannel("chrome://enigmail/content/dummy.xul",
                                     null);
  // Get owner of XUL channel
  gXULOwner = temChannel.owner;

  // Release channel
  temChannel = null;

  DEBUG_LOG("enigmail.js: GetXULOwner: gXULOwner="+gXULOwner+"\n");

  return gXULOwner;
}

function Enigmail(registeringModule)
{
  DEBUG_LOG("enigmail.js: Enigmail: START "+registeringModule+"\n");
  this.registeringModule = registeringModule;

  DEBUG_LOG("enigmail.js: Enigmail: END\n");
}

Enigmail.prototype.registeringModule = false;
Enigmail.prototype.initialized = false;
Enigmail.prototype.initializationAttempted = false;
Enigmail.prototype.initializationError = "";

Enigmail.prototype.debug = false;

Enigmail.prototype.isUnix  = false;
Enigmail.prototype.isWin32 = false;

Enigmail.prototype.ipcService = null;
Enigmail.prototype.prefBranch = null;
Enigmail.prototype.console = null;
Enigmail.prototype.keygenProcess = null;
Enigmail.prototype.keygenConsole = null;

Enigmail.prototype.agentType = "";
Enigmail.prototype.agentPath = "";

Enigmail.prototype._lastActiveTime = 0;
Enigmail.prototype._passphrase = null;

Enigmail.prototype.QueryInterface =
function (iid) {

  //DEBUG_LOG("Enigmail.QueryInterface:\n");
  if (!iid.equals(nsIEnigmail) && !iid.equals(nsISupports))
  throw Components.results.NS_ERROR_NO_INTERFACE;

  return this;
}

Enigmail.prototype.alertMsg =
function (domWindow, mesg) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  return promptService.alert(domWindow, "Enigmail Alert", mesg);
}

Enigmail.prototype.confirmMsg =
function (domWindow, mesg) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  return promptService.confirm(domWindow, "Enigmail Confirm", mesg);
}

Enigmail.prototype.errorMsg =
function (domWindow, mesg) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  return promptService.alert(domWindow, "Enigmail Error", mesg);
}

Enigmail.prototype.getMaxIdleMinutes =
function () {
  var maxIdleMinutes = 5;
  try {
    maxIdleMinutes = this.prefBranch.getIntPref("maxIdleMinutes");
  } catch (ex) {
  }

  return maxIdleMinutes;
}

Enigmail.prototype.stillActive =
function () {

  var maxIdleMinutes = this.getMaxIdleMinutes();
  var curDate = new Date();
  var currentTime = curDate.getTime();

  // Update last active time
  var lastActiveTime = this._lastActiveTime;
  this._lastActiveTime = currentTime;

  return ((currentTime - lastActiveTime) < (maxIdleMinutes*60*1000));
}


Enigmail.prototype.setDefaultPassphrase = 
function (passphrase) {
  DEBUG_LOG("enigmail.js: Enigmail.setDefaultPassphrase: \n");

  this._passphrase = passphrase;
  this.stillActive();
}


Enigmail.prototype.getPassphrase =
function (domWindow, passwdObj) {
  DEBUG_LOG("enigmail.js: Enigmail.getPassphrase: \n");

  try {
    var noPassphrase = this.prefBranch.getBoolPref("noPassphrase")

    if (noPassphrase) {
      passwdObj.value = "";
      return true;
    }

  } catch(ex) {
  }

  var havePassphrase = ((typeof this._passphrase) == "string");

  if (havePassphrase && !this.stillActive()) {
    // Too much idle time; forget default password
    WRITE_LOG("enigmail.js: Enigmail.getPassphrase: IDLED OUT\n");

    this._passphrase = null;
    havePassphrase = false;
  }

  if (havePassphrase) {
    passwdObj.value = this._passphrase;
    return true;
  }

  // Obtain password interactively
  var checkObj = new Object();

  var promptMsg = "Please type in your "+this.agentType.toUpperCase()+" passphrase";
  passwdObj.value = "";
  checkObj.value = true;
  var maxIdleMinutes = this.getMaxIdleMinutes();
  var checkMsg = (maxIdleMinutes>0) ? "Remember for "+maxIdleMinutes+" idle minutes"
                                : "";

  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  var success = promptService.promptPassword(domWindow,
                                             "Enigmail",
                                             promptMsg,
                                             passwdObj,
                                             checkMsg,
                                             checkObj);
  if (!success)
    return false;

  DEBUG_LOG("enigmail.js: getPassphrase: "+passwdObj.value.length+"\n");

  if (checkObj.value)
    this.setDefaultPassphrase(passwdObj.value);

  return true;
}


Enigmail.prototype.initialize =
function (prefBranch) {
  this.initializationAttempted = true;
  this.prefBranch = prefBranch;

  DEBUG_LOG("enigmail.js: Enigmail.initialize: START\n");
  if (this.initialized) return;

  var processInfo;
  try {
    processInfo = Components.classes[NS_PROCESSINFO_CONTRACTID].getService(nsIProcessInfo);

  } catch (ex) {
    this.initializationError = "IPCService/ProcessInfo not available";
    ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  this.processInfo = processInfo;

  var nspr_log_modules = processInfo.getEnv("NSPR_LOG_MODULES");
  var matches = nspr_log_modules.match(/enigmail:(\d+)/);

  if (matches && (matches.length > 1)) {
    gLogLevel = matches[1];
    WARNING_LOG("enigmail.js: Enigmail: gLogLevel="+gLogLevel+"\n");
  }

  try {
    this.debug = this.prefBranch.getBoolPref("debug");
  } catch (ex) {
  }

  // Initialize global environment variables list
  var passEnv = [ "PGPPATH", "GNUPGHOME",
                  "ALLUSERSPROFILE", "APPDATA",
                  "COMMONPROGRAMFILES", "COMSPEC", "DISPLAY",
                  "ENIGMAIL_PASS_ENV", "HOME", "HOMEDRIVE", "HOMEPATH",
                  "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE",  "LC_CTYPE",
                  "LC_MESSAGES",  "LC_MONETARY", "LC_NUMERIC", "LC_TIME",
                  "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
                  "NLSPATH", "PATH", "PATHEXT", "PROGRAMFILES", "PWD",
                  "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
                  "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR",
                  "USER", "USERPROFILE",
                  "WINDIR" ];

  var passList = this.processInfo.getEnv("ENIGMAIL_PASS_ENV");
  if (passList) {
    var passNames = passList.split(":");
    for (var k=0; k<passNames.length; k++)
      passEnv.push(passNames[k]);
  }

  gEnvList = [];
  for (var j=0; j<passEnv.length; j++) {
    var envName = passEnv[j];
    var envValue = this.processInfo.getEnv(envName);
    if (envValue)
       gEnvList.push(envName+"="+envValue);
  }

  DEBUG_LOG("enigmail.js: Enigmail.initialize: gEnvList = "+gEnvList+"\n");

  var httpHandler = Components.classesByID[NS_HTTPPROTOCOLHANDLER_CID_STR].createInstance();
  httpHandler = httpHandler.QueryInterface(nsIHttpProtocolHandler);

  this.oscpu = httpHandler.oscpu;
  DEBUG_LOG("enigmail.js: Enigmail.initialize: oscpu="+this.oscpu+"\n");

  this.platform = httpHandler.platform;
  DEBUG_LOG("enigmail.js: Enigmail.initialize: platform="+this.platform+"\n");

  this.isUnix  = (this.platform.search(/X11/i) == 0);
  this.isWin32 = (this.platform.search(/Win/i) == 0);

  this.passEnv = new Array();

  try {
    // Access IPC Service

    var ipcService = Components.classes[NS_IPCSERVICE_CONTRACTID].createInstance();
    ipcService = ipcService.QueryInterface(nsIIPCService);

    this.ipcService = ipcService;

    var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(nsIPipeConsole);

    DEBUG_LOG("enigmail.js: Enigmail.initialize: pipeConsole = "+pipeConsole+"\n");

    pipeConsole.open(500, 80, false);

    this.console = pipeConsole;

    pipeConsole.write("Initializing Enigmail service ...\n");

  } catch (ex) {
    this.initializationError = "IPCService not available";
    ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  var agentPath = "";
  try {
    agentPath = this.prefBranch.getCharPref("agentPath");
  } catch (ex) {
  }

  var agentList = ["gpg", "pgp"];
  var agentType = "";

  if (agentPath) {
    // Locate GPG/PGP executable
    try {
      var pathDir = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);

      pathDir.initWithPath(agentPath);

      if (!pathDir.exists())
        throw Components.results.NS_ERROR_FAILURE;

    } catch (ex) {
      this.initializationError = "Unable to locate GPG/PGP agent "+agentPath;
      ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    if (agentPath.search(/gpg[^\/\\]*$/i) > -1) {
      agentType = "gpg";

    } else if (agentPath.search(/pgp[^\/\\]*$/i) > -1) {
      agentType = "pgp";

    } else {
      this.initializationError = "Cannot determine agent type (GPG/PGP) from executable filename "+agentPath;
      ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

  } else {
    // Resolve relative path using PATH environment variable
    var envPath = this.processInfo.getEnv("PATH");

    var j;
    for (j=0; j<agentList.length; j++) {
      agentType = agentList[j];
      var agentName = this.isWin32 ? agentType+".exe" : agentType;

      agentPath = ResolvePath(agentName, envPath, this.isWin32);
      if (agentPath) {
        // Discard path info for win32
        if (this.isWin32)
          agentPath = agentType;
        break;
      }
    }

    if (!agentPath && this.isWin32) {
      // Win32: search for GPG in c:\gnupg, c:\gnupg\bin, d:\gnupg, d:\gnupg\bin
      var gpgPath = "c:\\gnupg;c:\\gnupg\\bin;d:\\gnupg;d:\\gnupg\\bin";

      agentType = "gpg";
      agentPath = ResolvePath("gpg.exe", gpgPath, this.isWin32);
    }

    if (!agentPath) {
      this.initializationError = "Unable to locate GPG or PGP executable in the path";
      ERROR_LOG("enigmail.js: Enigmail: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }
  }

  // Escape any backslashes in agent path
  agentPath = agentPath.replace(/\\/g, "\\\\");

  CONSOLE_LOG("EnigmailAgentPath="+agentPath+"\n\n");

  this.agentType = agentType;
  this.agentPath = agentPath;

  var command = agentPath;
  if (agentType == "gpg") {
     command += " --batch --no-tty --version";
  } else {
     command += " -h";
  }

  // This particular command execution seems to be essential on win32
  // (In particular, this should be the first command executed and
  //  *should* use the shell, i.e., command.com)
  var outStrObj = new Object();
  var outLenObj = new Object();
  var errStrObj = new Object();
  var errLenObj = new Object();

  var exitCode = this.ipcService.execPipe(command, true, "", 0, [], 0,
                                outStrObj, outLenObj, errStrObj, errLenObj);

  CONSOLE_LOG("enigmail> "+command+"\n");

  var version = outStrObj.value;
  if (errStrObj.value)
    version += errStrObj.value;

  CONSOLE_LOG(version+"\n");

  this.stillActive();

  this.initialized = true;

  DEBUG_LOG("enigmail.js: Enigmail.initialize: END\n");
}


Enigmail.prototype.execCmd = 
function (command, input, passFD, exitCodeObj, errorMsgObj, statusMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.execCmd: command = "+command+"\n");

  if ((typeof input) != "string") input = "";

  var envList = [];
  envList = envList.concat(gEnvList);

  if (passFD) {
    envList.push("PGPPASSFD=0");
  }

  var prefix = this.isWin32 ? "c:\\" : "";
  if (gLogLevel >= 4) {
    WriteFileContents(prefix+"enigcmd.txt", command+"\n");
    WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");
    WriteFileContents(prefix+"eniginp.txt", input);
    DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
  }

  var outObj = new Object();
  var errObj = new Object();
  var outLenObj = new Object();
  var errLenObj = new Object();

  CONSOLE_LOG("\nenigmail> "+command+"\n");
  
  try {
    var useShell = false;
    exitCodeObj.value = gEnigmailSvc.ipcService.execPipe(command,
                                                       useShell,
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

  if (gLogLevel >= 4) {
    WriteFileContents(prefix+"enigout.txt", outputData);
    WriteFileContents(prefix+"enigerr.txt", errOutput);
    DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
  }

  DEBUG_LOG("enigmail.js: Enigmail.execCmd: exitCode = "+exitCodeObj.value+"\n");
  DEBUG_LOG("enigmail.js: Enigmail.execCmd: errOutput = "+errOutput+"\n");

  var errLines = errOutput.split(/\r?\n/);

  // Discard last null string, if any
  if ((errLines.length > 1) && !errLines[errLines.length-1])
    errLines.pop();

  var errArray    = new Array();
  var statusArray = new Array();

  var statusPat = /^\[GNUPG:\] /;

  for (var j=0; j<errLines.length; j++) {
    if (errLines[j].search(statusPat) == 0) {
      statusArray.push(errLines[j].replace(statusPat,""));

    } else {
      errArray.push(errLines[j]);
    }
  }

  errorMsgObj.value  = errArray.join("\n");
  statusMsgObj.value = statusArray.join("\n");

  CONSOLE_LOG(errorMsgObj.value+"\n");

  //DEBUG_LOG("enigmail.js: Enigmail.execCmd: status = "+statusMsgObj.value+"\n");
  this.stillActive();

  return outputData;
}


// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email address
function EnigStripEmail(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       ERROR_LOG("enigmail.js: EnigStripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
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
    

Enigmail.prototype.encryptMessage = 
function (parent, uiFlags, plainText, fromMailAddr, toMailAddr,
          encryptFlags, exitCodeObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: "+plainText.length+" bytes from "+fromMailAddr+" to "+toMailAddr+" ("+encryptFlags+")\n");

  exitCodeObj.value = -1;
  errorMsgObj.value = "";

  if (!encryptFlags) {
    errorMsgObj.value = "No encryption or signing requested";
    return plainText;
  }

  if (!this.initialized) {
    errorMsgObj.value = "Error - Enigmail service not yet initialized";
    return "";
  }

  if (this.keygenProcess) {
    errorMsgObj.value = "Error - key generation not yet completed";
    return "";
  }

  try {
    fromMailAddr = EnigStripEmail(fromMailAddr);
    toMailAddr = EnigStripEmail(toMailAddr);

  } catch (ex) {
    errorMsgObj.value = "Error - invalid email address(es)";
    return "";
  }

  var signMessage = encryptFlags & SIGN_MESSAGE;
  var encryptMessage = encryptFlags & ENCRYPT_MESSAGE;

  if (encryptMessage) {
    // Ensure canonical line endings (CRLF) when encrypting
    plainText = plainText.replace(/\r\n/g, "\n");
    plainText = plainText.replace(/\n/g, "\r\n");
  }

  var recipientPrefix;
  var encryptCommand = this.agentPath;

  if (this.agentType == "pgp") {
    encryptCommand += " +batchmode +force -fat "
    recipientPrefix = " ";

    if (signMessage)
      encryptCommand += " -s";

    if (encryptMessage)
      encryptCommand += " -e";

  } else {
    encryptCommand += " --batch --no-tty --status-fd 2";
    recipientPrefix = " -r ";

    if (encryptFlags & ALWAYS_TRUST_SEND)
      encryptCommand += " --always-trust";

    if ((encryptFlags & ENCRYPT_TO_SELF) && fromMailAddr)
      encryptCommand += " --encrypt-to " + fromMailAddr;

    if (encryptMessage) {
      encryptCommand += " -a -e";

      if (signMessage)
        encryptCommand += " -s";

    } else if (signMessage) {
      encryptCommand += " --clearsign";
    }
  }

  DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: MID...\n");

  var inputText;

  if (!signMessage) {
    inputText = plainText;

  } else {
    var passwdObj = new Object();

    if (!this.getPassphrase(parent, passwdObj)) {
        ERROR_LOG("enigmail.js: Enigmail: Error - no passphrase supplied\n");

        errorMsgObj.value = "Error - no passphrase supplied";
        return "";
    }

    // Prepend passphrase to input data
    inputText = passwdObj.value + "\n" + plainText;

    if (this.agentType == "gpg")
      encryptCommand += " --passphrase-fd 0";
  }

  if (fromMailAddr) {
    encryptCommand += " -u " + fromMailAddr;
  }

  if (encryptMessage) {
    var addrList = toMailAddr.split(/\s*,\s*/);
    for (var k=0; k<addrList.length; k++)
       encryptCommand += recipientPrefix+addrList[k];
  }

  var cmdErrorMsgObj = new Object();
  var statusMsgObj   = new Object();    

  var cipherText = gEnigmailSvc.execCmd(encryptCommand, inputText, signMessage,
                                 exitCodeObj, cmdErrorMsgObj, statusMsgObj);

  CONSOLE_LOG(cmdErrorMsgObj.value+"\n");

  if ((exitCodeObj.value == 0) && !cipherText)
    exitCodeObj.value = -1;

  var statusMsg = statusMsgObj.value;

  if (exitCodeObj.value == 0) {
    // Normal return
    errorMsgObj.value = cmdErrorMsgObj.value;
    return cipherText;
  }

  // Error processing
  ERROR_LOG("enigmail.js: Enigmail.encryptMessage: Error in command execution\n");

  if (signMessage &&
      (!statusMsg || (statusMsg.search("BAD_PASSPHRASE") >= 0)) ) {
    // "Unremember" passphrase on signing failure
    // NOTE: May need to be more selective in unremembering,
    //       depending upon the details of the error
    this.setDefaultPassphrase(null);
  }

  errorMsgObj.value = "Error - encryption command failed";

  if (cmdErrorMsgObj.value) {
    errorMsgObj.value += "\n" + encryptCommand;
    errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
  }

  return "";
}


// Locates STRing in TEXT occurring only at the beginning of a line
function IndexOfArmorDelimiter(text, str, offset) {
  //DEBUG_LOG("enigmail.js: IndexOfArmorDelimiter: "+str+", "+offset+"\n");

  while (offset < text.length) {

    var loc = text.indexOf(str, offset);

    if ((loc < 1) || (text.charAt(loc-1) == "\n"))
      return loc;

    offset = loc + str.length;
  }

  return -1;
}

// Returns array of two integers and a string containing the indices of the
// first and last characters of the PGP armor block and the block type.
// If block is not found, the array [-1, -1, ""] is returned;
function IndicesOfPGPArmorBlock(text, offset, dashEscaped) {
  //DEBUG_LOG("enigmail.js: IndicesOfPGPArmorBlock: "+offset+"\n");

  var prefix = dashEscaped ? "- -----" : "-----";

  var notFound = [-1, -1, ""];

  var beginIndex = IndexOfArmorDelimiter(text, prefix+"BEGIN PGP ", offset);

  if (beginIndex == -1)
    return notFound;

  // Locate newline at end of armor header
  offset = text.indexOf("\n", beginIndex);

  if (offset == -1)
    return notFound;

  var endIndex = IndexOfArmorDelimiter(text, prefix+"END PGP ", offset);

  if (endIndex == -1)
    return notFound;

  // Locate newline at end of PGP block
  endIndex = text.indexOf("\n", endIndex);

  if (endIndex == -1)
    return notFound;

  var blockHeader = text.substr(beginIndex, offset-beginIndex+1);

  var matches = blockHeader.match(/^-----BEGIN PGP (.*)-----\s*\r?\n/);

  var blockType = "";
  if (matches && (matches.length > 1)) {
      blockType = matches[1];
      DEBUG_LOG("enigmail.js: IndicesOfPGPArmorBlock: blockType="+blockType+"\n");
  }

  if (blockType == "UNVERIFIED MESSAGE") {
    // Skip any unverified message block
    return IndicesOfPGPArmorBlock(text, endIndex+1, dashEscaped);
  }

  return [beginIndex, endIndex, blockType];
}


function ExtractPGPSignature(signedText) {

  var beginIndex = signedText.indexOf("-----BEGIN PGP SIGNATURE-----");
  if (beginIndex == -1)
    return "";

  // Locate newline at end of armor header
  var offset = signedText.indexOf("\n", beginIndex);

  if (offset == -1)
    return "";

  var endIndex = signedText.indexOf("-----END PGP SIGNATURE-----", offset);
  if (endIndex == -1)
    return "";

  var signBlock = signedText.substr(offset, endIndex-offset);

  var dataIndex = signBlock.search(/\n\s*\r?\n/);
  if (dataIndex == -1)
    return "";
  dataIndex = signBlock.indexOf("\n", dataIndex+1);

  var signData = signBlock.substr(dataIndex, endIndex-dataIndex);
  signData = signData.replace(/\s*/g, "");

  //DEBUG_LOG("enigmail.js: ExtractPGPSignature: signature='"+signData+"'\n");

  return signData;
}


Enigmail.prototype.decryptMessage = 
function (parent, uiFlags, cipherText,
          exitCodeObj, errorMsgObj, signatureObj) {
  DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: "+cipherText.length+" bytes, "+uiFlags+"\n");

  var interactive = uiFlags & UI_INTERACTIVE;
  var importKey   = uiFlags & IMPORT_KEY;

  //DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: signatureObj.value="+signatureObj.value+"\n");

  exitCodeObj.value = -1;
  errorMsgObj.value = "";

  if (!this.initialized) {
    errorMsgObj.value = "Error - Enigmail service not yet initialized";
    return "";
  }

  if (this.keygenProcess) {
    errorMsgObj.value = "Error - key generation not yet completed";
    return "";
  }

  var blockIndices = IndicesOfPGPArmorBlock(cipherText, 0, false);

  var blockType = blockIndices[2];

  if (!blockType) {
    errorMsgObj.value = "Error - No valid armored PGP data block found";
    return "";
  }

  var pgpBlock = cipherText.substr(blockIndices[0],
                                   blockIndices[1]-blockIndices[0]+1);

  var verifyOnly = (blockType == "SIGNED MESSAGE");

  var pgpSignature = "";

  if (verifyOnly) {
    pgpSignature = ExtractPGPSignature(pgpBlock);

    if (signatureObj.value && (pgpSignature != signatureObj.value)) {
      errorMsgObj.value = "Error - Signature mismatch";
      return "";
    }

    signatureObj.value = "";
  }

  var decryptCommand = this.agentPath;

  if (this.agentType == "pgp") {
    decryptCommand += " +batchmode +force -ft";

  } else {
    decryptCommand += " --batch --no-tty --status-fd 2 -d";
  }

  var inputText;

  if (verifyOnly) {
    inputText = cipherText;

  } else {

    var passwdObj = new Object();

    if (!this.getPassphrase(parent, passwdObj)) {
        ERROR_LOG("enigmail.js: Enigmail: Error - no passphrase supplied\n");

        errorMsgObj.value = "Error - no passphrase supplied";
        return "";
    }

    inputText = passwdObj.value + "\n" + cipherText;

    if (this.agentType == "gpg")
      decryptCommand += " --passphrase-fd 0";
  }

  var cmdErrorMsgObj = new Object();
  var statusMsgObj   = new Object();    

  var plainText = gEnigmailSvc.execCmd(decryptCommand,
                                 inputText, !verifyOnly,
                                 exitCodeObj, cmdErrorMsgObj, statusMsgObj);

  if ((exitCodeObj.value == 0) && !plainText)
    exitCodeObj.value = -1;

  var statusMsg = statusMsgObj.value;

  if (exitCodeObj.value == 0) {
    // Normal return
    var errLines = cmdErrorMsgObj.value.split(/\r?\n/);

    var goodSignPat = /Good signature from (user )?"(.*)"\.?/i;
    var badSignPat = /BAD signature from (user )?"(.*)"\.?/i;

    errorMsgObj.value = "";

    for (var j=0; j<errLines.length; j++) {
      if (errLines[j].search(badSignPat) != -1) {
        errorMsgObj.value = (errLines[j].match(badSignPat))[0];
        exitCodeObj.value = -1;
        break;
      }

      if (errLines[j].search(goodSignPat) != -1) {
        errorMsgObj.value = (errLines[j].match(goodSignPat))[0];
      }
    }

    var trustPrefix = "";

    if (statusMsg && (statusMsg.search("TRUST_") > -1)) {
      var matches = statusMsg.match(/(^|\n)(TRUST_\w+)/);

      if (matches && (matches.length > 2)) {
        trustPrefix = matches[2] + ": ";;
      }
    }

    errorMsgObj.value = trustPrefix + errorMsgObj.value;

    return plainText;
  }

  // Error processing
  ERROR_LOG("enigmail.js: Enigmail.decryptMessage: Error in command execution\n");

  if ( !verifyOnly &&
      (!statusMsg || (statusMsg.search("BAD_PASSPHRASE") >= 0)) ) {
    // "Unremember" passphrase on decryption failure
    // NOTE: May need to be more selective in unremembering,
    //       depending upon the details of the error
    this.setDefaultPassphrase(null);
  }

  errorMsgObj.value = "";

  if (cmdErrorMsgObj.value) {
    errorMsgObj.value += "\n" + decryptCommand;
    errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
  }

  var importKeyId;

  if (statusMsg && (statusMsg.search("ERRSIG ") > -1)) {
    var matches = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);

    if (matches && (matches.length > 3)) {
      importKeyId = "0x" + matches[3];
      DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: NO_PUBKEY "+importKeyId+"\n");
    }

  } else if (statusMsg && (statusMsg.search("BADSIG ") > -1)) {
    signatureObj.value = pgpSignature;
  }

  var keyserver;
  try {
    keyserver = this.prefBranch.getCharPref("keyserver");
  } catch (ex) {
  }

  if (importKeyId && importKey && keyserver) {

    var confirmMsg = "Import public key "+importKeyId+" from keyserver "+keyserver+"?";
    if (this.confirmMsg(parent, confirmMsg)) {
      var recvErrorMsgObj = new Object();
      var recvFlags = interactive ? UI_INTERACTIVE : 0;
      var exitStatus = this.receiveKey(parent, recvFlags, importKeyId,
                                       keyserver, recvErrorMsgObj);

      if (exitStatus != 0) {
        this.alertMsg(parent, "Unable to receive public key\n\n"+recvErrorMsgObj.value);

      } else {
        // Recursive call
        // Note that IMPORT_KEY is set to false to break the recursion
        var uiFlagsDeep = interactive ? UI_INTERACTIVE : 0;
        return this.decryptMessage(parent, uiFlagsDeep, cipherText,
                                   exitCodeObj, errorMsgObj, signatureObj);
      }
    }
  }

  if (importKeyId) {

    if (keyserver && !interactive)
      errorMsgObj.value = "Click Decrypt button to import public key "+importKeyId+" from keyserver";
    else
      errorMsgObj.value = "Error - public key "+importKeyId+" needed to verify signature";

    if (plainText && !interactive) {
      // Append original PGP block to unverified message
      plainText = "-----BEGIN PGP UNVERIFIED MESSAGE-----\r\n" + plainText +
                  "-----END PGP UNVERIFIED MESSAGE-----\r\n\r\n" + pgpBlock;
    }

  } else if (verifyOnly) {
    errorMsgObj.value = "Error - signature verification failed";
    if (!interactive) 
      errorMsgObj.value += "; click Decrypt for details";

  } else {
    errorMsgObj.value = "Error - decryption/verification failed";
    if (!interactive) 
      errorMsgObj.value += "; click Decrypt for details";
  }

  if (cmdErrorMsgObj.value)
    errorMsgObj.value += "\n\n" + cmdErrorMsgObj.value;

  return verifyOnly ? "" : plainText;
}


Enigmail.prototype.extractFingerprint = 
function (email, secret, exitCodeObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.extractFingerprint: "+email+"\n");

  exitCodeObj.value = -1;
  statusMsgObj.value = "";

  if (!this.initialized) {
    errorMsgObj.value = "Error - Enigmail service not yet initialized";
    return "";
  }

  var email_addr = "<"+email+">";

  var command = this.agentPath;

  if (this.agentType == "pgp") {
    command += " +batchmode -kvc "+email_addr;
    if (secret)
      command += " secring.pkr";

  } else {
    command += " --batch --no-tty --fingerprint ";
    command += secret ? " --list-secret-keys" : " --list-keys";
    command += " "+email_addr;
  }

  var cmdErrorMsgObj  = new Object();
  var statusMsgObj = new Object();

  var keyText = gEnigmailSvc.execCmd(command, "", false,
                                 exitCodeObj, cmdErrorMsgObj, statusMsgObj);

  if ((exitCodeObj.value == 0) && !keyText)
    exitCodeObj.value = -1;

  if (exitCodeObj.value != 0) {
    errorMsgObj.value = "Error - fingerprint extraction command failed";
    return "";
  }

  var outputLines = keyText.split(/\r?\n/);

  var fingerprintPat = /^\s*Key\s+fingerprint\s*=\s*/i;

  var fingerprint;
  for (var j=0; j<outputLines.length; j++) {
    if (outputLines[j].search(fingerprintPat) == 0) {
      if (fingerprint) {
        errorMsgObj.value = "Error - Multiple keys found for "+email_addr;
        return "";
      }

      fingerprint = outputLines[j].replace(fingerprintPat,"");
    }
  }

  if (!fingerprint) {
    errorMsgObj.value = "Error - No key found for "+email_addr;
    return "";
  }

  // Canonicalize fingerprint (remove spaces, lowercase)
  fingerprint = fingerprint.replace(/\s+/g, "");
  fingerprint = fingerprint.toLowerCase();

  DEBUG_LOG("enigmail.js: Enigmail.extractFingerprint: fprint="+fingerprint+"\n");
  return fingerprint;
}


Enigmail.prototype.receiveKey = 
function (parent, uiFlags, keyId, keyserver, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.receiveKey: "+keyId+" from "+keyserver+"\n");

  if (!this.initialized) {
    errorMsgObj.value = "Error - Enigmail service not yet initialized";
    return "";
  }

  var command = this.agentPath;

  if (this.agentType == "pgp") {
    command += " +batchmode -kvv "+keyId + " http://" + keyserver;

  } else {
    command += " --batch --no-tty --keyserver " + keyserver + " --recv-keys ";
    command += keyId;
  }

  var exitCodeObj  = new Object();
  var statusMsgObj = new Object();

  var output = gEnigmailSvc.execCmd(command, "", false,
                                 exitCodeObj, errorMsgObj, statusMsgObj);

  return exitCodeObj.value;
}


Enigmail.prototype.generateKey = 
function (parent, name, comment, email, expiryDate, passphrase,
          requestObserver) {
  WRITE_LOG("enigmail.js: Enigmail.generateKey: \n");

  if (this.keygenProcess || (this.agentType != "gpg"))
    throw Components.results.NS_ERROR_FAILURE;

  var command = this.agentPath+" --batch --no-tty --gen-key"

  var inputData =
"%echo Generating a standard key\nKey-Type: DSA\nKey-Length: 1024\nSubkey-Type: ELG-E\nSubkey-Length: 1024\n";

  inputData += "Name-Real: "+name+"\n";
  inputData += "Name-Comment: "+comment+"\n";
  inputData += "Name-Email: "+email+"\n";
  inputData += "Expire-Date: "+expiryDate+"\n";
  if (passphrase.length)
    inputData += "Passphrase: "+passphrase+"\n";
  inputData += "%commit\n%echo done\n";

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  pipeConsole.open(100, 80, true);

  pipeConsole.write(command+"\n");
  pipeConsole.write(inputData);

  DEBUG_LOG("enigmail.js: Enigmail.generateKey: inputData="+inputData+"\n");

  var ipcRequest = null;
  try {
    var useShell = this.isWin32;
    ipcRequest = gEnigmailSvc.ipcService.execAsync(command,
                                                   useShell,
                                                   inputData,
                                                   inputData.length,
                                                   [], 0,
                                                   pipeConsole,
                                                   pipeConsole,
                                                   true,
                                                   requestObserver);
  } catch (ex) {
  }

  if (!ipcRequest) {
    ERROR_LOG("enigmail.js: Enigmail.generateKey: execAsync failed\n");
    return null;
  }

  this.keygenRequest = ipcRequest;

  DEBUG_LOG("enigmail.js: Enigmail.generateKey: ipcRequest = "+ipcRequest+"\n");

  return ipcRequest;
}

Enigmail.prototype.execAsync = 
function (command, input, passFD, requestObserver) {
  WRITE_LOG("enigmail.js: Enigmail.execAsync: \n");

  if ((typeof input) != "string") input = "";

  var envList = gEnvList;
  if (passFD)
    envList.push("PGPPASSFD=0");

  var prefix = this.isWin32 ? "c:\\" : "";
  if (gLogLevel >= 4) {
    WriteFileContents(prefix+"enigcmd.txt", command+"\n");
    WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");
    WriteFileContents(prefix+"eniginp.txt", input);
    DEBUG_LOG("enigmail.js: Enigmail.execAsync: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
  }

  var outConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  var errConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  outConsole.open(-1, 0, true);
  errConsole.open(-1, 0, true);

  CONSOLE_LOG("\nenigmail> "+command+"\n");

  var ipcRequest = null;
  try {
    var useShell = this.isWin32;
    ipcRequest = gEnigmailSvc.ipcService.execAsync(command,
                                                   useShell,
                                                   input, input.length,
                                                   envList, envList.length,
                                                   outConsole,
                                                   errConsole,
                                                   true,
                                                   reequestObserver);
  } catch (ex) {
  }

  if (!ipcRequest) {
    ERROR_LOG("enigmail.js: Enigmail.execAsync: FAILED\n");
    return null;
  }

  DEBUG_LOG("enigmail.js: Enigmail.execAsync: ipcRequest = "+ipcRequest+"\n");

  this.stillActive();

  return;
}

Enigmail.prototype.processAsync = 
function (ipcRequest, exitCodeObj, errorMsgObj, statusMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.processAsync:\n");

  if (!ipcRequest || !ipcRequest.stdoutConsole) {
    exitCodeObj.value = -1;
  }

  var outputData =  ipcRequest.stdoutConsole.data;

  var errOutput  = "";
  if (ipcContent.stderrConsole) {
     ipcContent.stderrConsole.join();
     errOutput = ipcRequest.stderrConsole.data;
  }

  ipcRequest.close(true);

  var prefix = this.isWin32 ? "c:\\" : "";
  if (gLogLevel >= 4) {
    WriteFileContents(prefix+"enigout.txt", outputData);
    WriteFileContents(prefix+"enigerr.txt", errOutput);
    DEBUG_LOG("enigmail.js: Enigmail.processAsync: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
  }

  WRITE_LOG("enigmail.js: Enigmail.processAsync: exitCode = "+exitCodeObj.value+"\n");
  WRITE_LOG("enigmail.js: Enigmail.processAsync: errOutput = "+errOutput+"\n");

  var errLines = errOutput.split(/\r?\n/);

  // Discard last null string, if any
  if ((errLines.length > 1) && !errLines[errLines.length-1])
    errLines.pop();

  var errArray    = new Array();
  var statusArray = new Array();

  var statusPat = /^\[GNUPG:\] /;

  for (var j=0; j<errLines.length; j++) {
    if (errLines[j].search(statusPat) == 0) {
      statusArray.push(errLines[j].replace(statusPat,""));

    } else {
      errArray.push(errLines[j]);
    }
  }

  errorMsgObj.value  = errArray.join("\n");
  statusMsgObj.value = statusArray.join("\n");

  CONSOLE_LOG(errorMsgObj.value+"\n");

  WRITE_LOG("enigmail.js: Enigmail.processAsync: status = "+statusMsgObj.value+"\n");

  return outputData;
}

function IPCContext()
{
}

IPCContext.prototype = {

  command: "",
  pipeTransport: null,
  stdoutConsole: null,
  stderrConsole: null,

  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsIIPCContext) &&
        !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
}

const ENIGMAIL_PANEL_URL = "chrome://enigmail/content/enigmailPanel.xul";
const WMEDIATOR_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=window-mediator";

Enigmail.prototype.selectPanel = 
function (url) {
  WRITE_LOG("enigmail.js: Enigmail.selectPanel: "+url+"\n");

  var wm = Components.classes[WMEDIATOR_CONTRACTID].getService(Components.interfaces.nsIWindowMediator);
  var navWindowList = wm.getEnumerator("navigator:browser");

  var retval = false;
  while (navWindowList.hasMoreElements()) {

    var navWindow =navWindowList.getNext();
    DEBUG_LOG("enigmail.js: navWindow="+navWindow+"\n");
 
    var href = navWindow._content.location.href;
    DEBUG_LOG("enigmail.js: href="+href+"\n");

    if (href.toLowerCase().indexOf(url.toLowerCase()) != 0)
      continue;

    var enigmailPanel = navWindow.document.getElementById("urn:sidebar:3rdparty-panel:"+ENIGMAIL_PANEL_URL);
  DEBUG_LOG("enigmail.js: panel="+enigmailPanel+"\n");

    if (!enigmailPanel) {
      // Add panel
      enigmailAddPanel();

      enigmailPanel = navWindow.document.getElementById("urn:sidebar:3rdparty-panel:"+ENIGMAIL_PANEL_URL);
      DEBUG_LOG("enigmail.js: panel="+enigmailPanel+"\n");

      if (!enigmailPanel) {
        DEBUG_LOG("enigmail.js: Added panel not found in document!\n");
        return false;
      }
    }

    navWindow.SidebarSelectPanel(enigmailPanel, true, true);
    retval = true;
  }

  return retval;
}

// Chrome sidebar panel adding code

function enigmailAddPanel() {
  DEBUG_LOG("enigmail.js: Adding Enigmail panel\n");
  var sidebarObj = new chromeSidebar();
  sidebarObj.addPanel("Enigmail", ENIGMAIL_PANEL_URL, "");
}

const PANELS_RDF_FILE  = "UPnls"; /* directory services property to find panels.rdf */

const CONTAINER_CONTRACTID = "@mozilla.org/rdf/container;1";
const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1"
const NETSEARCH_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=internetsearch"
const RDF_CONTRACTID = "@mozilla.org/rdf/rdf-service;1";

const nsIRDFService          = Components.interfaces.nsIRDFService;
const nsIRDFContainer        = Components.interfaces.nsIRDFContainer;
const nsIRDFRemoteDataSource = Components.interfaces.nsIRDFRemoteDataSource;

function chromeSidebar()
{
    this.rdf = Components.classes[RDF_CONTRACTID].getService(nsIRDFService);
    this.datasource_uri = getSidebarDatasourceURI(PANELS_RDF_FILE);
    DEBUG_LOG("enigmail.js: datasource_uri is" + this.datasource_uri + "\n");
    this.resource = 'urn:sidebar:current-panel-list';
    this.datasource = this.rdf.GetDataSource(this.datasource_uri);
}

chromeSidebar.prototype.nc = "http://home.netscape.com/NC-rdf#";

function sidebarURLSecurityCheck(url)
{
    if (url.search(/(^chrome:|^http:|^ftp:|^https:)/) == -1)
        throw "Script attempted to add sidebar panel from illegal source";
}

chromeSidebar.prototype.isPanel =
function (aContentURL)
{
    var container = 
        Components.classes[CONTAINER_CONTRACTID].createInstance(nsIRDFContainer);

    /* Create a resource for the new panel and add it to the list */
    var panel_resource = 
        this.rdf.GetResource("urn:sidebar:3rdparty-panel:" + aContentURL);

    return (container.IndexOf(panel_resource) != -1);
}

/* decorate prototype to provide ``class'' methods and property accessors */
chromeSidebar.prototype.addPanel =
function (aTitle, aContentURL, aCustomizeURL)
{
    DEBUG_LOG("enigmail.js: addPanel(" + aTitle + ", " + aContentURL + ", " +
          aCustomizeURL + ")" + "\n");

    sidebarURLSecurityCheck(aContentURL);

    // Create a "container" wrapper around the current panels to
    // manipulate the RDF:Seq more easily.
    var panel_list = this.datasource.GetTarget(this.rdf.GetResource(this.resource), this.rdf.GetResource(chromeSidebar.prototype.nc+"panel-list"), true);
    if (panel_list) {
        panel_list.QueryInterface(Components.interfaces.nsIRDFResource);
    } else {
        // Datasource is busted. Start over.
        DEBUG_LOG("enigmail.js: Sidebar datasource is busted\n");
  }

    var container = Components.classes[CONTAINER_CONTRACTID].createInstance(nsIRDFContainer);
    container.Init(this.datasource, panel_list);

    /* Create a resource for the new panel and add it to the list */
    var panel_resource = 
        this.rdf.GetResource("urn:sidebar:3rdparty-panel:" + aContentURL);
    var panel_index = container.IndexOf(panel_resource);
    if (panel_index != -1)
    {
        DEBUG_LOG("enigmail.js: addPanel(): panel already in list"+"\n");
        return;
    }
    
    /* Now make some sidebar-ish assertions about it... */
    this.datasource.Assert(panel_resource,
                           this.rdf.GetResource(this.nc + "title"),
                           this.rdf.GetLiteral(aTitle),
                           true);
    this.datasource.Assert(panel_resource,
                           this.rdf.GetResource(this.nc + "content"),
                           this.rdf.GetLiteral(aContentURL),
                           true);
    if (aCustomizeURL)
        this.datasource.Assert(panel_resource,
                               this.rdf.GetResource(this.nc + "customize"),
                               this.rdf.GetLiteral(aCustomizeURL),
                               true);
        
    container.AppendElement(panel_resource);

    // Use an assertion to pass a "refresh" event to all the sidebars.
    // They use observers to watch for this assertion (in sidebarOverlay.js).
    this.datasource.Assert(this.rdf.GetResource(this.resource),
                           this.rdf.GetResource(this.nc + "refresh"),
                           this.rdf.GetLiteral("true"),
                           true);
    this.datasource.Unassert(this.rdf.GetResource(this.resource),
                             this.rdf.GetResource(this.nc + "refresh"),
                             this.rdf.GetLiteral("true"));

    /* Write the modified panels out. */
    this.datasource.QueryInterface(nsIRDFRemoteDataSource).Flush();

    DEBUG_LOG("enigmail.js: Panel successfully added to sidebar\n");
}

function getSidebarDatasourceURI(panels_file_id)
{
    try 
    {
        /* use the fileLocator to look in the profile directory 
         * to find 'panels.rdf', which is the
         * database of the user's currently selected panels. */
        var directory_service = Components.classes[DIR_SERV_CONTRACTID].getService();
        if (directory_service)
            directory_service = directory_service.QueryInterface(Components.interfaces.nsIProperties);

        /* if <profile>/panels.rdf doesn't exist, get will copy
         *bin/defaults/profile/panels.rdf to <profile>/panels.rdf */
        var sidebar_file = directory_service.get(panels_file_id, Components.interfaces.nsIFile);

        if (!sidebar_file.exists())
        {
            /* this should not happen, as GetFileLocation() should copy
             * defaults/panels.rdf to the users profile directory */
            DEBUG_LOG("enigmail.js: sidebar file does not exist" + "\n");
            return null;
        }

        DEBUG_LOG("enigmail.js: sidebar uri is " + sidebar_file.URL + "\n");
        return sidebar_file.URL;
    }
    catch (ex)
    {
        /* this should not happen */
        DEBUG_LOG("enigmail.js: caught " + ex + " getting sidebar datasource uri" + "\n");
        return null;
    }
}
