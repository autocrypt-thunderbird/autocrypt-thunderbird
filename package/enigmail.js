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
const NS_IPCSERVICE_CONTRACTID = "@mozilla.org/protozilla/ipc-service;1";
const NS_PIPECONSOLE_CONTRACTID = "@mozilla.org/network/pipe-console;1"
const NS_SYSTEMENVIRONMENT_CONTRACTID = "@mozilla.org/system-environment;1";

const NS_SIMPLEURI_CONTRACTID = "@mozilla.org/network/simple-uri;1";
const NS_IHTTPHANDLER_CID_STR = "{52A30880-DD95-11d3-A1A7-0050041CAF44}";
const NS_IOSERVICE_CID_STR    = "{9ac9e770-18bc-11d3-9337-00104ba0fd40}";

/* Interfaces */
const nsISupports            = Components.interfaces.nsISupports;
const nsILocalFile           = Components.interfaces.nsILocalFile;
const nsIHTTPProtocolHandler = Components.interfaces.nsIHTTPProtocolHandler;
const nsIProtocolHandler     = Components.interfaces.nsIProtocolHandler;
const nsIIPCService          = Components.interfaces.nsIIPCService;
const nsIPipeConsole         = Components.interfaces.nsIPipeConsole;
const nsISystemEnvironment   = Components.interfaces.nsISystemEnvironment;
const nsIEnigmail            = Components.interfaces.nsIEnigmail;
const nsIPGPModule           = Components.interfaces.nsIPGPModule;
const nsIPGPMsgBody          = Components.interfaces.nsIPGPMsgBody;
const nsIPGPMsgHeader        = Components.interfaces.nsIPGPMsgHeader;

///////////////////////////////////////////////////////////////////////////////
// Global variables

var gLogLevel = 3;         // Output only errors/warnings by default
var gLogFileStream = null;

var gEnigmailSvc = null;   // Global Enigmail Service

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

  var localFile = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
  localFile.initWithPath(filePath);

  var fileStream = Components.classes[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Components.interfaces.nsIFileOutputStream);

  if (!permissions)
    permissions = DEFAULT_FILE_PERMS;
  var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

  fileStream.init(localFile, flags, permissions);

  return fileStream;
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

  gEnigmailSvc.console.write(str);
}

function ERROR_LOG(str) {
  if (gLogLevel >= 2)
    WRITE_LOG(str);

  gEnigmailSvc.console.write(str);
}

function CONSOLE_LOG(str) {
  if (gLogLevel >= 3)
    WRITE_LOG(str);

  gEnigmailSvc.console.write(str);
}

///////////////////////////////////////////////////////////////////////////////

var EnigModuleObj = {
  registerSelf: function (componentManager, moduleFile, registryLocation, componentType)
  {
    WRITE_LOG("enigmail.js: Registering components\n");

    if (gEnigmailSvc == null) {
      // Create Enigmail Service (delay initialization)
      gEnigmailSvc = new Enigmail(true);
    }

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
      // Create Global Enigmail Service
      gEnigmailSvc = new Enigmail(false);
    }

    if (!gEnigmailSvc.initialized) {
      // Initialize service
      gEnigmailSvc.startup();
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

    WRITE_LOG("PGPModule.EncryptSign: aMsgHeader.to="+aMsgHeader.to+"\n");
    WRITE_LOG("PGPModule.EncryptSign: aOrigBody.body="+aOrigBody.body+"\n");
    WRITE_LOG("PGPModule.EncryptSign: aNewBody="+aNewBody+"\n");

    var statusCodeObj = new Object();
    var statusMsgObj = new Object();
    var cipherText = gEnigmailSvc.encryptMessage(aOrigBody.body,
                                                 aMsgHeader.to,
                                                 statusCodeObj,
                                                 statusMsgObj);

    return new PGPMsgBody(cipherText);
  },

  // void DecryptVerify(in nsISupports aOrigBody,
  //                    [retval] out nsISupports aNewBody)
  DecryptVerify: function (aOrigBody, aNewBody) {
    DEBUG_LOG("PGPModule.DecryptVerify:\n");

    aOrigBody = aOrigBody.QueryInterface(nsIPGPMsgBody);

    WRITE_LOG("PGPModule.DecrypotVerify: aOrigBody.body="+aOrigBody.body+"\n");

    var statusCodeObj = new Object();
    var statusMsgObj = new Object();
    var plainText = gEnigmailSvc.decryptMessage(aOrigBody.body,
                                                statusCodeObj,
                                                statusMsgObj);

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

   WRITE_LOG("PGPModule.EncryptSign: aHeaderBuffer="+aHeaderBuffer+"\n");

   for (var k in aHeaderStartOffset)
      WRITE_LOG("PGPModule.EncryptSign: k="+k+"\n");

   WRITE_LOG("PGPModule.EncryptSign: aHeaderStartOffset="+aHeaderStartOffset+"\n");
   WRITE_LOG("PGPModule.EncryptSign: aHeaderLength="+aHeaderLength+"\n");
   WRITE_LOG("PGPModule.EncryptSign: aBufferEndOffset="+aBufferEndOffset+"\n");

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

var gSysEnv = Components.classes[NS_SYSTEMENVIRONMENT_CONTRACTID].getService();
gSysEnv = gSysEnv.QueryInterface(nsISystemEnvironment);

function GetSysEnv(name) {
  DEBUG_LOG("enigmail.js: GetSysEnv: "+name+"\n")
  return gSysEnv.getEnv(name);
}

function isAbsolutePath(filePath, isUnix) {
  // Check if absolute path
  if (isUnix) {
    return (filePath.search(/^\//) == 0)
  } else {
    return (filePath.search(/^\w+:\\/) == 0);
  }
}

function ResolvePath(filePath, envPath, isUnix) {
  DEBUG_LOG("enigmail.js: ResolvePath: filePath="+filePath+"\n");

  if (isAbsolutePath(filePath, isUnix))
    return filePath;

  if (!envPath)
     return null;

  var retValue = null;
  var pathDirs = envPath.split(isUnix ? ":" : ";");
  for (var j=0; j<pathDirs.length; j++) {
     var pathDir = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);

     pathDir.initWithPath(pathDirs[j]);

     if (pathDir.exists() && pathDir.isDirectory()) {
        pathDir.appendRelativePath(filePath);

        if (pathDir.exists()) {
           retValue = pathDir.path;
           break;
        }
     }
  }

  DEBUG_LOG("enigmail.js: ResolvePath: return value="+retValue+"\n");
  return retValue;
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
  WRITE_LOG("enigmail.js: EnigmailProtocolHandler.QueryInterface\n");

  if (!iid.equals(nsIProtocolHandler) && !iid.equals(nsISupports))
    throw Components.results.NS_ERROR_NO_INTERFACE;

  return this;
}

EnigmailProtocolHandler.prototype.newURI =
function (aSpec, aBaseURI)
{
  WRITE_LOG("enigmail.js: EnigmailProtocolHandler.newURI: aSpec='"+aSpec+"'\n");

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
  WRITE_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: URI='"+aURI.spec+"'\n");

  var spec;
  if (aURI.spec == aURI.scheme+":about") {
    // About Enigmail
    spec = "chrome://enigmail/content/enigmailAbout.htm";

  } else if (aURI.spec == aURI.scheme+":console") {
    // Display enigmail console messages
    spec = "chrome://enigmail/content/enigmailConsole.htm";

  } else if (aURI.spec == aURI.scheme+":keygen") {
    // Display enigmail key generation status
    spec = "chrome://enigmail/content/enigmailKeygen.htm";

  } else {
    // Display Enigmail config page
    spec = "chrome://enigmail/content/enigmail.xul";
  }

  // ***NOTE*** Creating privileged channel
  var ioServ = Components.classesByID[NS_IOSERVICE_CID_STR].getService(Components.interfaces.nsIIOService);

  var privChannel = ioServ.newChannel(spec, null);

  privChannel.originalURI = aURI;

  // Make new channel owned by XUL owner
  privChannel.owner = gEnigmailSvc.xulOwner

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
    WRITE_LOG("enigmail.js: EnigmailProtocolHandlerFactory.createInstance\n");

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

function Enigmail(registeringModule)
{
  DEBUG_LOG("enigmail.js: Enigmail: START "+registeringModule+"\n");
  this.registeringModule = registeringModule;

  var httpHandler = Components.classesByID[NS_IHTTPHANDLER_CID_STR].createInstance();
  httpHandler = httpHandler.QueryInterface(nsIHTTPProtocolHandler);

  this.oscpu = httpHandler.oscpu;
  DEBUG_LOG("enigmail.js: Enigmail: oscpu="+this.oscpu+"\n");

  this.platform = httpHandler.platform;
  DEBUG_LOG("enigmail.js: Enigmail: platform="+this.platform+"\n");

  this.unix = (this.platform == "X11");

  this.passEnv = new Array();

  try {
    // Access IPC Service

    var ipcService = Components.classes[NS_IPCSERVICE_CONTRACTID].createInstance();
    ipcService = ipcService.QueryInterface(nsIIPCService);

    var nspr_log_modules = GetSysEnv("NSPR_LOG_MODULES");

    var matches = nspr_log_modules.match(/enigmail:(\d+)/);

    if (matches && (matches.length > 1)) {
      gLogLevel = matches[1];
      WARNING_LOG("enigmail.js: Enigmail: gLogLevel="+gLogLevel+"\n");
    }

    this.ipcService = ipcService;

    var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(nsIPipeConsole);

    WRITE_LOG("enigmail.js: Enigmail: pipeConsole = "+pipeConsole+"\n");

    pipeConsole.open(500, 80);

    this.console = pipeConsole;

    pipeConsole.write("Enigmail initialized\n");

  } catch (ex) {
    ERROR_LOG("enigmail.js: Enigmail: Error - IPCService not available\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  DEBUG_LOG("enigmail.js: Enigmail: END\n");
}

if (gLogLevel >= 4)
  gLogFileStream = CreateFileStream("enigdbg1.txt");

Enigmail.prototype.registeringModule = false;
Enigmail.prototype.initialized = false;

Enigmail.prototype.xulOwner = null;
Enigmail.prototype.ipcService = null;
Enigmail.prototype.console = null;
Enigmail.prototype.keygenProcess = null;
Enigmail.prototype.keygenConsole = null;

Enigmail.prototype.agentType = "";
Enigmail.prototype.agentPath = "";

Enigmail.prototype.encryptMsg = false;
Enigmail.prototype.signMsg = true;

Enigmail.prototype.haveDefaultPassphrase = false;
Enigmail.prototype._passphrase = null;

Enigmail.prototype.QueryInterface =
function (iid) {

  //DEBUG_LOG("Enigmail.QueryInterface:\n");
  if (!iid.equals(nsIEnigmail) && !iid.equals(nsISupports))
  throw Components.results.NS_ERROR_NO_INTERFACE;

  return this;
}

Enigmail.prototype.startup =
function () {

  DEBUG_LOG("Enigmail.startup: START\n");
  if (this.initialized) return;

  // Open temporary XUL channel
  var ioServ = Components.classesByID[NS_IOSERVICE_CID_STR].getService(Components.interfaces.nsIIOService);

  var temChannel = ioServ.newChannel("chrome://enigmail/content/dummy.xul",
                                     null);

  // Get owner of XUL channel
  var xulOwner = temChannel.owner;

  // Release channel
  temChannel = null;

  DEBUG_LOG("Enigmail.startup: xulOwner="+xulOwner+"\n");

  if (!xulOwner) {
    ERROR_LOG("Enigmail.startup: Error - Null XUL owner\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  this.xulOwner = xulOwner;

  var agentList = ["gpg", "pgp"];
  var agentType = "";
  var agentPath = "";

  // Resolve relative path using PATH environment variable
  var envPath = GetSysEnv("PATH");

  for (j=0; j<agentList.length; j++) {
    agentType = agentList[j];
    var agentName = this.unix ? agentType : agentType+".exe";

    agentPath = ResolvePath(agentName, envPath, this.unix);
    if (agentPath)
      break;
  }

  if (!agentPath) {
    ERROR_LOG("enigmail.js: Enigmail: Error - Unable to locate GPG or PGP executable\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  WRITE_LOG("Enigmail.startup: agentPath="+agentPath+"\n");

  this.agentType = agentType;
  this.agentPath = agentPath;

  this.initialized = true;

  DEBUG_LOG("Enigmail.startup: END\n");
}

Enigmail.prototype.setDefaultPassphrase = 
function (passphrase) {
  if (passphrase == null)
    throw Components.results.NS_ERROR_FAILURE;

  this._passphrase = passphrase;
  this.haveDefaultPassphrase = true;
}

Enigmail.prototype.execCmd = 
function (command, input, errMessagesObj, statusObj, exitCodeObj) {
  WRITE_LOG("enigmail.js: Enigmail.execCmd: command = "+command+"\n");

  if ((typeof input) != "string") input = "";
  var outObj = new Object();
  var errObj = new Object();

  var envList = ["PGPPASSFD=0"];
  var passEnv = ["HOME", "GNUPGHOME", "PGPPATH"];

  for (var j=0; j<passEnv.length; j++) {
    var envName = passEnv[j];
    var envValue = GetSysEnv(envName);
    if (envValue)
       envList.push(envName+"="+envValue);
  }

  WRITE_LOG("enigmail.js: Enigmail.execCmd: envList = "+envList+"\n");

  exitCodeObj.value = gEnigmailSvc.ipcService.execPipe(command,
                                                       input, input.length,
                                                       envList, envList.length,
                                                       outObj, errObj);
  var outputData = outObj.value;
  var errOutput  = errObj.value;

  WRITE_LOG("enigmail.js: Enigmail.execCmd: exitCode = "+exitCodeObj.value+"\n");
  WRITE_LOG("enigmail.js: Enigmail.execCmd: errOutput = "+errOutput+"\n");

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

  errMessagesObj.value = errArray.join("\n");
  statusObj.value      = statusArray.join("\n");

  WRITE_LOG("enigmail.js: Enigmail.execCmd: status = "+statusObj.value+"\n");
  return outputData;
}


Enigmail.prototype.encryptMessage = 
function (plainText, toMailAddr, passphrase, statusCodeObj, statusMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.encryptMessage: To "+toMailAddr+"\n");

  if (!gEnigmailSvc.encryptMessage && !gEnigmailSvc.signMessage) {
    statusCodeObj.value = 0;
    statusMsgObj.value = "No encryption or signing requested";
    return plainText;
  }

  if (this.keygenProcess) {
    statusCodeObj.value = -1;
    statusMsgObj.value = "Error - key generation not yet completed";
    return "";
  }

  var encryptCommand;

  if (this.agentType == "pgp") {
    encryptCommand = "pgp +batchmode +force -fat "

    if (gEnigmailSvc.encryptMsg)
      encryptCommand += " -e";

    if (gEnigmailSvc.signMsg)
      encryptCommand += " -s";

    encryptCommand += " "+toMailAddr;

  } else {
    encryptCommand = "gpg --batch --no-tty --passphrase-fd 0 --status-fd 2";

    if (gEnigmailSvc.encryptMsg) {
      encryptCommand += " --armor --encrypt";

      if (gEnigmailSvc.signMsg)
        encryptCommand += " --sign";

    } else if (gEnigmailSvc.signMsg) {
      encryptCommand += " --clearsign";
    }

    encryptCommand += " --recipient "+toMailAddr;
  }

  if (passphrase == null) {
     if (!this.haveDefaultPassphrase) {
       ERROR_LOG("enigmail.js: Enigmail: Error - no passphrase supplied\n");

       statusCodeObj.value = -1;
       statusMsgObj.value = "Error - no passphrase supplied";
       return "";
     }

     passphrase = this._passphrase;
  }

  var errMessagesObj = new Object();
  var statusObj      = new Object();

  var cipherText = gEnigmailSvc.execCmd(encryptCommand,
                                  passphrase+"\n"+plainText,
                                  errMessagesObj, statusObj, statusCodeObj);

  if (statusCodeObj.value != 0) {
    // "Unremember" passphrase on error exit
    this.haveDefaultPassphrase = false;
    this._passphrase = null;

    ERROR_LOG("enigmail.js: Enigmail.encryptMessage: Error in command execution\n");

    statusMsgObj.value = "Error in command execution";
    return "";
  }

  statusMsgObj.value = "** status line **";

  return cipherText;
}


Enigmail.prototype.decryptMessage = 
function (cipherText, passphrase, statusCodeObj, statusMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.decryptMessage: \n");

  if (this.keygenProcess) {
    statusCodeObj.value = -1;
    statusMsgObj.value = "Error - key generation not yet completed";
    return "";
  }

  var decryptCommand;

  if (this.agentType == "pgp") {
    decryptCommand = "pgp +batchmode +force -ft";

  } else {
    decryptCommand = "gpg --batch --no-tty --passphrase-fd 0 --status-fd 2 --decrypt";
  }

  if (passphrase == null) {
     if (!this.haveDefaultPassphrase) {
       ERROR_LOG("enigmail.js: Enigmail: Error - no passphrase supplied\n");

       statusCodeObj.value = -1;
       statusMsgObj.value = "Error - no passphrase supplied";
       return "";
     }

     passphrase = this._passphrase;
  }

  var errMessagesObj = new Object();
  var statusObj      = new Object();

  var plainText = gEnigmailSvc.execCmd(decryptCommand,
                                 passphrase+"\n"+cipherText,
                                 errMessagesObj, statusObj, statusCodeObj);

  if (statusCodeObj.value != 0) {
    // "Unremember" passphrase on error exit
    // NOTE: May need to be more selective in unremembering,
    //       depending upon the details of the error
    this.haveDefaultPassphrase = false;
    this._passphrase = null;

    ERROR_LOG("enigmail.js: Enigmail.decryptMessage: Error in command execution\n");

    statusMsgObj.value = "Error in command execution";
    return "";
  }

  statusMsgObj.value = "** status line **";

  return plainText;
}

Enigmail.prototype.generateKey = 
function (name, comment, email, expiryDate, passphrase) {
  WRITE_LOG("enigmail.js: Enigmail.generateKey: \n");

  if (this.keygenProcess || (this.agentType != "gpg"))
    throw Components.results.NS_ERROR_FAILURE;

  var  command = "gpg --batch --no-tty --gen-key"

  var inputData =
"%echo Generating a standard key\nKey-Type: DSA\nKey-Length: 1024\nSubkey-Type: ELG-E\nSubkey-Length: 1024\n";

  inputData += "Name-Real: "+name+"\n";
  inputData += "Name-Comment: "+comment+"\n";
  inputData += "Name-Email: "+email+"\n";
  inputData += "Expire-Date: "+expiryDate+"\n";
  if (passphrase.length)
    inputData += "Passphrase: "+passphrase+"\n";
  inputData += "%commit\n%echo done\n";

  WRITE_LOG("enigmail.js: Enigmail.generateKey: inputData="+inputData+"\n");

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(nsIPipeConsole);

  WRITE_LOG("enigmail.js: Enigmail.generateKey: pipeConsole = "+pipeConsole+"\n");

  pipeConsole.open(100, 80);

  var keygenProcess = gEnigmailSvc.ipcService.execAsync(command,
                                                       inputData,
                                                       inputData.length,
                                                       [], 0,
                                                       pipeConsole,
                                                       pipeConsole);
  this.keygenProcess = keygenProcess;
  this.keygenConsole = pipeConsole;

  WRITE_LOG("enigmail.js: Enigmail.generateKey: keygenProcess = "+keygenProcess+"\n");

  // Null string password is always remembered
  if (passphrase.length == 0)
    this.setDefaultPassphrase(passphrase);

  return keygenProcess;
}
