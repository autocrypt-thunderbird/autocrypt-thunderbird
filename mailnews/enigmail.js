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
const NS_PGP_MODULE_CONTRACTID = "@mozilla.org/mimecth/pgp;1";

const NS_PGP_MODULE_CID =
Components.ID("{847b3ab1-7ab1-11d4-8f02-006008948af5}");

/* Contract IDs and CIDs used by this module */
const NS_IPCSERVICE_CONTRACTID = "@mozilla.org/protozilla/ipc-service;1";
const NS_SYSTEMENVIRONMENT_CONTRACTID = "@mozilla.org/system-environment;1";

const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const NS_IHTTPHANDLER_CID_STR  = "{52A30880-DD95-11d3-A1A7-0050041CAF44}";

/* Interfaces */
const nsISupports            = Components.interfaces.nsISupports;
const nsIHTTPProtocolHandler = Components.interfaces.nsIHTTPProtocolHandler
const nsIIPCService          = Components.interfaces.nsIIPCService;
const nsISystemEnvironment   = Components.interfaces.nsISystemEnvironment;
const nsIPGPModule           = Components.interfaces.nsIPGPModule;
const nsIPGPMsgBody          = Components.interfaces.nsIPGPMsgBody;
const nsIPGPMsgHeader        = Components.interfaces.nsIPGPMsgHeader;

///////////////////////////////////////////////////////////////////////////////
// Global variables

var gLogLevel = 4;             // Output only errors/warnings by default

var gEnigMailSvc = null;   // Global Enigmail Service

///////////////////////////////////////////////////////////////////////////////

function DEBUG_LOG(str) {
  if (gLogLevel >= 4)
    dump(str);
}

function WARNING_LOG(str) {
  if (gLogLevel >= 3)
    dump(str);
}

function ERROR_LOG(str) {
  if (gLogLevel >= 2)
    dump(str);
}

function CONSOLE_LOG(str) {
  if (gLogLevel >= 3)
    dump(str);

  gEnigMailSvc.console.write(str);
}

///////////////////////////////////////////////////////////////////////////////

var EnigModuleObj = {
  registerSelf: function (componentManager, moduleFile, registryLocation, componentType)
  {
    dump("enigmail.js: Registering components\n");

    if (gEnigMailSvc == null) {
      // Create EnigMail Service
      gEnigMailSvc = new EnigMail(true);
    }

    componentManager.registerComponentWithType(
                                               NS_PGP_MODULE_CID,
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

    if (gEnigMailSvc == null) {
      // Create Global EnigMail Service
      gEnigMailSvc = new EnigMail(false);
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

    dump("PGPModule.EncryptSign: aMsgHeader.to="+aMsgHeader.to+"\n");
    dump("PGPModule.EncryptSign: aOrigBody.body="+aOrigBody.body+"\n");
    dump("PGPModule.EncryptSign: aNewBody="+aNewBody+"\n");

    var cipherText = gEnigMailSvc.encryptMessage(aOrigBody.body,
                                                 aMsgHeader.to)

    return new PGPMsgBody(cipherText);
  },

  // void DecryptVerify(in nsISupports aOrigBody,
  //                    [retval] out nsISupports aNewBody)
  DecryptVerify: function (aOrigBody, aNewBody) {
    DEBUG_LOG("PGPModule.DecryptVerify:\n");

    aOrigBody = aOrigBody.QueryInterface(nsIPGPMsgBody);

    dump("PGPModule.DecrypotVerify: aOrigBody.body="+aOrigBody.body+"\n");

    var plainText = gEnigMailSvc.decryptMessage(aOrigBody.body);

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

   dump("PGPModule.EncryptSign: aHeaderBuffer="+aHeaderBuffer+"\n");

   for (var k in aHeaderStartOffset)
      dump("PGPModule.EncryptSign: k="+k+"\n");

   dump("PGPModule.EncryptSign: aHeaderStartOffset="+aHeaderStartOffset+"\n");
   dump("PGPModule.EncryptSign: aHeaderLength="+aHeaderLength+"\n");
   dump("PGPModule.EncryptSign: aBufferEndOffset="+aBufferEndOffset+"\n");

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

function ResolvePath(filePath, envPath) {
  DEBUG_LOG("enigmail.js: ResolvePath: filePath="+filePath+"\n");

  if (isAbsolutePath(filePath))
    return filePath;

  if (!envPath)
     return null;

  var retValue = null;
  var pathDirs = envPath.split(pzilla.unix ? ":" : ";");
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
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

function EnigMail(registeringModule)
{
  DEBUG_LOG("enigmail.js: EnigMail: START "+registeringModule+"\n");
  this.registeringModule = registeringModule;

  var httpHandler = Components.classesByID[NS_IHTTPHANDLER_CID_STR].createInstance();
  httpHandler = httpHandler.QueryInterface(nsIHTTPProtocolHandler);

  this.oscpu = httpHandler.oscpu;
  DEBUG_LOG("enigmail.js: EnigMail: oscpu="+this.oscpu+"\n");

  this.platform = httpHandler.platform;
  DEBUG_LOG("enigmail.js: EnigMail: platform="+this.platform+"\n");

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
      WARNING_LOG("enigmail.js: EnigMail: gLogLevel="+gLogLevel+"\n");
    }

    this.ipcService = ipcService;
    this.console    = ipcService.console;

  } catch (ex) {
    ERROR_LOG("enigmail.js: EnigMail: Error - IPCService not available\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  DEBUG_LOG("enigmail.js: EnigMail: END\n");
}

EnigMail.prototype.registeringModule = false;
EnigMail.prototype.ipcService = null;
EnigMail.prototype.console = null;

EnigMail.prototype.getPassPhrase = 
function () {

  return "passphrase"; // TEMPORARY HACK

  var passwdObj = new Object();

  var success = window.prompter.promptPassword("Enigmail",
                               "Please type in your passphrase",
                               "",
                               0,
                               passwdObj);
  if (!success)
    return "";

  dump("enigmail.js: EnigMail.getPassPhrase: "+passwdObj.value+"\n");

  return passwdObj.value;
}


EnigMail.prototype.execCmd = 
function (command, input, errMessages, status) {
  dump("enigmail.js: EnigMail.execCmd: command = "+command+"\n");

  if ((typeof input) != "string") input = "";
  var outObj = new Object();
  var errObj = new Object();

  var exitCode = gEnigMailSvc.ipcService.execPipe(command, input, input.length,
                                                  [], 0, outObj, errObj);
  var outputData = outObj.value;
  var errOutput  = errObj.value;

  dump("enigmail.js: EnigMail.execCmd: exitCode = "+exitCode+"\n");
  dump("enigmail.js: EnigMail.execCmd: errOutput = "+errOutput+"\n");

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

  errMessages = errArray.join("\n");
  status      = statusArray.join("\n");

  dump("enigmail.js: EnigMail.execCmd: status = "+status+"\n");
  return outputData;
}


EnigMail.prototype.encryptMessage = 
function (plainText, toMailAddr) {
  dump("enigmail.js: EnigMail.encryptMessage: To "+toMailAddr+"\n");

  var encryptCommand = "gpg --batch --no-tty --encrypt --armor --sign --passphrase-fd 0 --status-fd 2 --recipient "+toMailAddr;

  var passphrase = gEnigMailSvc.getPassPhrase();

  if (!passphrase)
    return;

  var errMessages, status;
  var cipherText = gEnigMailSvc.execCmd(encryptCommand,
                               passphrase+"\n"+plainText, errMessages, status);

  return cipherText;
}

EnigMail.prototype.decryptMessage = 
function (cipherText) {
  dump("enigmail.js: Enigmail.decryptMessage: \n");

  var decryptCommand = "gpg --batch --no-tty --decrypt --passphrase-fd 0 --status-fd 2";

  var passphrase = gEnigMailSvc.getPassPhrase();

  if (!passphrase)
    return;

  var errMessages, status;
  var plainText = gEnigMailSvc.execCmd(decryptCommand,
                               passphrase+"\n"+cipherText, errMessages,status);

  return plainText;
}
