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

// Maximum size of message directly processed by Enigmail
const MSG_BUFFER_SIZE = 98304;   // 96 kB
const MAX_MSG_BUFFER_SIZE = 512000 // slightly less than 512 kB

const ERROR_BUFFER_SIZE = 16384; // 16 kB

const PGP_BATCH_OPTS  = " +batchmode +force";
const GPG_BATCH_OPTS  = " --batch --no-tty --status-fd 2";

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

// Contract IDs and CIDs used by this module
const NS_IPCSERVICE_CONTRACTID  = "@mozilla.org/process/ipc-service;1";
const NS_IPCBUFFER_CONTRACTID   = "@mozilla.org/process/ipc-buffer;1";
const NS_PIPECONSOLE_CONTRACTID = "@mozilla.org/process/pipe-console;1";
const NS_PIPETRANSPORT_CONTRACTID="@mozilla.org/process/pipe-transport;1";
const NS_PROCESSINFO_CONTRACTID = "@mozilla.org/xpcom/process-info;1";
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

// Interfaces
const nsISupports            = Components.interfaces.nsISupports;
const nsIObserver            = Components.interfaces.nsIObserver;
const nsILocalFile           = Components.interfaces.nsILocalFile;
const nsIProtocolHandler     = Components.interfaces.nsIProtocolHandler;
const nsIIPCService          = Components.interfaces.nsIIPCService;
const nsIPipeConsole         = Components.interfaces.nsIPipeConsole;
const nsIProcessInfo         = Components.interfaces.nsIProcessInfo;
const nsIEnigmail            = Components.interfaces.nsIEnigmail;
//const nsIPGPModule           = Components.interfaces.nsIPGPModule;
//const nsIPGPMsgBody          = Components.interfaces.nsIPGPMsgBody;
//const nsIPGPMsgHeader        = Components.interfaces.nsIPGPMsgHeader;
const nsIEnigStrBundle       = Components.interfaces.nsIStringBundleService;
const nsICmdLineHandler      = Components.interfaces.nsICmdLineHandler;
const nsICategoryManager     = Components.interfaces.nsICategoryManager;
const nsIWindowWatcher       = Components.interfaces.nsIWindowWatcher;
const nsICommandLineHandler  = Components.interfaces.nsICommandLineHandler;

const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";

///////////////////////////////////////////////////////////////////////////////
// Global variables

const GPG_COMMENT_OPT = "Using GnuPG with %s - http://enigmail.mozdev.org";

var gLogLevel = 3;            // Output only errors/warnings by default

var gEnigmailSvc = null;      // Global Enigmail Service
var gCachedPassphrase = null; // Cached passphrase
var gCacheTimer = null;       // Cache timer
var gXULOwner = null;         // Global XUL owner
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
                    DECRYPTION_FAILED: nsIEnigmail.DECRYPTION_FAILED,
                    DECRYPTION_OKAY: nsIEnigmail.DECRYPTION_OKAY,
                    TRUST_UNDEFINED: nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_NEVER:     nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_MARGINAL:  nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_FULLY:     nsIEnigmail.TRUSTED_IDENTITY,
                    TRUST_ULTIMATE:  nsIEnigmail.TRUSTED_IDENTITY,
                    CARDCTRL:        nsIEnigmail.NO_SC_AVAILABLE,
                    SC_OP_FAILURE:   nsIEnigmail.SC_OP_FAILURE
                    };

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

var gMimeHashAlgorithms = ["md5", "sha1", "ripemd160", "sha256", "sha384", "sha512"];

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

    fileStream.init(localFile, flags, permissions, 0);

    return fileStream;

  } catch (ex) {
    ERROR_LOG("enigmail.js: CreateFileStream: Failed to create "+filePath+"\n");
    return null;
  }
}

function WriteFileContents(filePath, data, permissions) {

  DEBUG_LOG("enigmail.js: WriteFileContents: file="+filePath+"\n");

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
    return false;
  }

  return true;
}

// Pack/unpack: Network (big-endian) byte order

function pack(value, bytes) {
  var str = '';
  var mask = 0xff;
  for (var j=0; j < bytes; j++) {
    str = String.fromCharCode( (value & mask) >> j*8 ) + str;
    mask <<= 8;
  }

  return str;
}

function unpack(str) {
  var len = str.length;
  var value = 0;

  for (var j=0; j < len; j++) {
    value <<= 8;
    value  |= str.charCodeAt(j);
  }

  return value;
}

const hexTable = "0123456789abcdef";

function bytesToHex(str) {
  var len = str.length;

  var hex = '';
  for (var j=0; j < len; j++) {
    var charCode = str.charCodeAt(j);
    hex += hexTable.charAt((charCode & 0xf0) >> 4) +
           hexTable.charAt((charCode & 0x0f));
  }

  return hex;
}

function hexToBytes(hex) {
  hex = hex.toLowerCase();

  var bytes = (1+hex.length)/2;

  var str = '';
  for (var j=0; j < bytes; j++) {
    var loc1 = hexTable.indexOf(hex.charAt(2*j));
    var loc2 = 0;

    if ((2*j+1) < hex.length)
      loc2 = hexTable.indexOf(hex.charAt(2*j+1));

    if (loc1 < 0) loc1 = 0;
    if (loc2 < 0) loc2 = 0;

    str += String.fromCharCode((loc1 << 4) + loc2);
  }

  return str;
}
///////////////////////////////////////////////////////////////////////////////

function WRITE_LOG(str) {
  function f00(val, digits) {
    return ("0000"+val.toString()).substr(-digits);
  }

  var d = new Date();
  var datStr=d.getFullYear()+"-"+f00(d.getMonth()+1, 2)+"-"+f00(d.getDate(),2)+" "+f00(d.getHours(),2)+":"+f00(d.getMinutes(),2)+":"+f00(d.getSeconds(),2)+"."+f00(d.getMilliseconds(),3)+" ";
  if (gLogLevel >= 4)
    dump(datStr+str);

  if (gEnigmailSvc && gEnigmailSvc.logFileStream) {
    gEnigmailSvc.logFileStream.write(datStr, datStr.length);
    gEnigmailSvc.logFileStream.write(str, str.length);
    //gEnigmailSvc.logFileStream.flush();
  }
}

function DEBUG_LOG(str) {
  if ((gLogLevel >= 4) || (gEnigmailSvc && gEnigmailSvc.logFileStream))
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

///////////////////////////////////////////////////////////////////////////////

var EnigModuleObj = {
  registerSelf: function (compRegistrar, moduleFile,
                          registryLocation, componentType)
  {
    WRITE_LOG("enigmail.js: Registering components\n");

    compRegistrar = compRegistrar.QueryInterface(Components.interfaces.nsIComponentRegistrar);

    compRegistrar.registerFactoryLocation(NS_ENIGMAIL_CID,
                                          "Enigmail",
                                          NS_ENIGMAIL_CONTRACTID,
                                          moduleFile, registryLocation,
                                          componentType);

    compRegistrar.registerFactoryLocation(NS_ENIGMAILPROTOCOLHANDLER_CID,
                                          "Enigmail Protocol Handler",
                                          NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID,
                                          moduleFile, registryLocation,
                                          componentType);

    compRegistrar.registerFactoryLocation(NS_PGP_MODULE_CID,
                                          "PGP Module",
                                          NS_PGP_MODULE_CONTRACTID,
                                          moduleFile, registryLocation,
                                          componentType);

    compRegistrar.registerFactoryLocation(NS_ENIGCLINE_SERVICE_CID,
                                          "Enigmail Key Management CommandLine Service",
                                          NS_CLINE_SERVICE_CONTRACTID,
                                          moduleFile,
                                          registryLocation,
                                          componentType);

  	var catman = Components.classes[NS_CATMAN_CONTRACTID].getService(nsICategoryManager);
  	catman.addCategoryEntry("command-line-handler",
                            "cline-enigmail",
                            NS_CLINE_SERVICE_CONTRACTID, true, true);

    WRITE_LOG("enigmail.js: Registered components\n");
  },

  unregisterSelf: function(compRegistrar, moduleFile, registryLocation)
  {
    DEBUG_LOG("enigmail.js: unregisterSelf\n");
    compRegistrar = compRegistrar.QueryInterface(Components.interfaces.nsIComponentRegistrar);

    compRegistrar.unregisterFactoryLocation(NS_ENIGCLINE_SERVICE_CID,
                                            moduleFile);
    var catman = Components.classes[NS_CATMAN_CONTRACTID]
                           .getService(nsICategoryManager);
    catman.deleteCategoryEntry("command-line-handler",
                               NS_CLINE_SERVICE_CONTRACTID, true);

  },

  getClassObject: function (compRegistrar, cid, iid) {
    DEBUG_LOG("enigmail.js: getClassObject: cid="+cid+"\n");

    if (!iid.equals(Components.interfaces.nsIFactory))
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (gEnigmailSvc == null) {
      // Create Enigmail Service (delay initialization)
      gEnigmailSvc = new Enigmail(false);
    }

    if (cid.equals(NS_ENIGCLINE_SERVICE_CID)) {
      return EnigCmdLineHandler.QueryInterface(iid);
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

    return null;
  },

  canUnload: function(compRegistrar)
  {
    DEBUG_LOG("enigmail.js: canUnload:\n");
    return true;
  }
};

/* Module entry point */
function NSGetModule(compRegistrar, moduleFile) {
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
      throw Components.results.NS_ERROR_NOT_D;

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

/*
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

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();
    var encryptFlags = nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED;

    var cipherText = gEnigmailSvc.encryptMessage(null, 0,
                                                 aOrigBody.body,
                                                 "",
                                                 aMsgHeader.to,
                                                 encryptFlags,
                                                 exitCodeObj,
                                                 statusFlagsObj,
                                                 errorMsgObj);

    return new PGPMsgBody(cipherText);
  },

  // void DecryptVerify(in nsISupports aOrigBody,
  //                    [retval] out nsISupports aNewBody)
  DecryptVerify: function (aOrigBody, aNewBody) {
    DEBUG_LOG("PGPModule.DecryptVerify:\n");

    aOrigBody = aOrigBody.QueryInterface(nsIPGPMsgBody);

    DEBUG_LOG("PGPModule.DecryptVerify: aOrigBody.body="+aOrigBody.body+"\n");

    var exitCodeObj    = new Object();
    var errorMsgObj    = new Object();
    var signatureObj   = new Object();
    var statusFlagsObj = new Object();
    var keyIdObj       = new Object();
    var userIdObj      = new Object();

    var plainText = gEnigmailSvc.decryptMessage(null, 0,
                                                aOrigBody.body,
                                                signatureObj,
                                                exitCodeObj,
                                                statusFlagsObj,
                                                keyIdObj,
                                                userIdObj,
                                                errorMsgObj);

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
*/

///////////////////////////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////////////////////////

function isAbsolutePath(filePath, isDosLike) {
  // Check if absolute path
  if (isDosLike) {
    return (filePath.search(/^\w+:\\/) == 0);
  } else {
    return (filePath.search(/^\//) == 0)
  }
}

function ResolvePath(filePath, envPath, isDosLike) {
  DEBUG_LOG("enigmail.js: ResolvePath: filePath="+filePath+"\n");

  if (isAbsolutePath(filePath, isDosLike))
    return filePath;

  if (!envPath)
     return null;

  var pathDirs = envPath.split(isDosLike ? ";" : ":");

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

function EnigConvertToUnicode(text, charset) {
  DEBUG_LOG("enigmail.js: EnigConvertToUnicode: "+charset+"\n");

  if (!text || !charset || (charset.toLowerCase() == "iso-8859-1"))
    return text;

  // Encode plaintext
  try {
    var unicodeConv = Components.classes[NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Components.interfaces.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertToUnicode(text);

  } catch (ex) {
    return text;
  }
}

function EnigConvertFromUnicode(text, charset) {
  DEBUG_LOG("enigmail.js: EnigConvertFromUnicode: "+charset+"\n");

  if (!text)
    return "";

  if (! charset) charset="utf-8";

  // Encode plaintext
  try {
    var unicodeConv = Components.classes[NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Components.interfaces.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertFromUnicode(text);

  } catch (ex) {
    DEBUG_LOG("enigmail.js: EnigConvertFromUnicode: caught an exception\n");

    return text;
  }
}


function EnigConvertGpgToUnicode(text) {
  if (typeof(text)=="string") {
    var a=text.search(/[\x80-\xFF]{2}/);
    var b=0;

    while (a>=0) {
      var ch=text.substr(a,2).toSource().substr(13,8).replace(/\\x/g, "\\u00");
      var newCh=EnigConvertToUnicode(EnigConvertToUnicode(ch, "x-u-escaped"), "utf-8");
      if (newCh != ch) {
        //dump(ch+"\n");
        var r=new RegExp(text.substr(a, 2), "g");
        text=text.replace(r, newCh);
      }
      b=a+2;
      a=text.substr(b+2).search(/[\x80-\xFF]{2}/);
      if (a>=0) {
        a += b+2;
      }
    }

    a=text.search(/\\x3a/i);
    if (a>0) {
      text = text.replace(/\\x3a/ig, "\\e3A");
    }

    a=text.search(/\\x/);
    while (a>=0) {
      ch=text.substr(a,4).replace(/\\x/g, "\\u00");
      newCh=EnigConvertToUnicode(ch, "x-u-escaped");
      if (newCh != ch) {
        r=new RegExp("\\"+text.substr(a, 4), "g");
        text=text.replace(r, newCh);
      }
      a=text.search(/\\x/);
    }

  }

  return text;
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
function (aSpec, originCharset, aBaseURI)
{
  DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newURI: aSpec='"+aSpec+"'\n");

  var uri = Components.classes[NS_SIMPLEURI_CONTRACTID].createInstance(Components.interfaces.nsIURI);
  uri.spec = aSpec;

  return uri;
}

EnigmailProtocolHandler.prototype.newChannel =
function (aURI)
{
  DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: URI='"+aURI.spec+"'\n");

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

      DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: messageURL="+messageUriObj.originalUrl+", "+contentType+", "+contentCharset+"\n");

      if (!messageUriObj.persist)
        delete gEnigmailSvc._messageIdList[messageId];

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
  var ioServ = Components.classes[NS_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  var temChannel = ioServ.newChannel("chrome://enigmail/content/dummy.xul",
                                     "",
                                     null);
  // Get owner of XUL channel
  gXULOwner = temChannel.owner;

  // Release channel
  temChannel = null;

  DEBUG_LOG("enigmail.js: GetXULOwner: gXULOwner="+gXULOwner+"\n");

  return gXULOwner;
}


function GetPassphrase(domWindow, passwdObj, useAgentObj, agentVersion) {
  DEBUG_LOG("enigmail.js: GetPassphrase:\n");

  useAgentObj.value = false;
  try {
    var noPassphrase = gEnigmailSvc.prefBranch.getBoolPref("noPassphrase");
    var useAgent = gEnigmailSvc.prefBranch.getBoolPref("useGpgAgent");
    useAgentObj.value = useAgent;

    if (noPassphrase || useAgent) {
      passwdObj.value = "";
      return true;
    }

  }
  catch(ex) {}

  if (gEnigmailSvc.haveCachedPassphrase()) {
    passwdObj.value = gCachedPassphrase;
    return true;
  }

  // Obtain password interactively
  var checkObj = new Object();

  if (agentVersion>="1.4") {
    var promptMsg = EnigGetString("enterPassOrPin");
  }
  else {
    promptMsg = EnigGetString("enterPass",gEnigmailSvc.agentType.toUpperCase());
  }
  passwdObj.value = "";
  checkObj.value = true;

  var maxIdleMinutes = gEnigmailSvc.getMaxIdleMinutes();
  var checkMsg = (maxIdleMinutes>0) ? EnigGetString("rememberPass",maxIdleMinutes) : "";

  var success;

  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  success = promptService.promptPassword(domWindow,
                                         EnigGetString("enigPrompt"),
                                         promptMsg,
                                         passwdObj,
                                         checkMsg,
                                         checkObj);

  if (!success)
    return false;

  DEBUG_LOG("enigmail.js: GetPassphrase: got passphrase\n");

  // Remember passphrase only if necessary
  if (checkObj.value && (maxIdleMinutes > 0))
    gEnigmailSvc.setCachedPassphrase(passwdObj.value);

  return true;
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
Enigmail.prototype.composeSecure = false;

Enigmail.prototype.logFileStream = null;

Enigmail.prototype.isUnix    = false;
Enigmail.prototype.isWin32   = false;
Enigmail.prototype.isOs2     = false;
Enigmail.prototype.isDosLike = false;

Enigmail.prototype.ipcService = null;
Enigmail.prototype.prefBranch = null;
Enigmail.prototype.console = null;
Enigmail.prototype.keygenProcess = null;
Enigmail.prototype.keygenConsole = null;

Enigmail.prototype.quoteSign = "";
Enigmail.prototype.agentType = "";
Enigmail.prototype.agentPath = "";
Enigmail.prototype.agentVersion = "";
Enigmail.prototype.userIdList = null;
Enigmail.prototype.rulesList = null;

Enigmail.prototype._lastActiveTime = 0;

Enigmail.prototype._messageIdList = {};

Enigmail.prototype.QueryInterface =
function (iid) {

  //DEBUG_LOG("Enigmail.QueryInterface:\n");
  if (!iid.equals(nsIEnigmail) &&
      !iid.equals(nsIObserver) &&
      !iid.equals(nsISupports))
  throw Components.results.NS_ERROR_NO_INTERFACE;

  return this;
}

Enigmail.prototype.observe =
function (aSubject, aTopic, aData) {
  DEBUG_LOG("enigmail.js: Enigmail.observe: topic='"+aTopic+"' \n");

  if (aTopic == "timer-callback") {
    // Cause cached password to expire, if need be
    if (!this.haveCachedPassphrase()) {
      // No cached password; cancel repeating timer
      if (gCacheTimer)
        gCacheTimer.cancel();
    }

  } else if (aTopic == NS_XPCOM_SHUTDOWN_OBSERVER_ID) {
    // Reset mail.show_headers pref
    try {
      var prefSvc = Components.classes[NS_PREFS_SERVICE_CID]
                     .getService(Components.interfaces.nsIPrefService);
      var prefRoot = prefSvc.getBranch(null);

      var prefValue = 1;
      try {
        prefValue = this.prefBranch.getIntPref("show_headers");
      } catch (ex) {
        ERROR_LOG("enigmail.js: Enigmail.observe: could not obtain 'show_headers'\n");
      }

      prefRoot.setIntPref("mail.show_headers", prefValue);
      prefSvc.savePrefFile(null);
      DEBUG_LOG("enigmail.js: Enigmail.observe: changed preferences saved\n");
    } catch (ex) {
      ERROR_LOG("enigmail.js: Enigmail.observe: could not save preferences\n");
    }

    // XPCOM shutdown
    this.finalize();

  }
  else {
    DEBUG_LOG("enigmail.js: Enigmail.observe: no handler for '"+aTopic+"'\n");
  }
}

Enigmail.prototype.alertMsg =
function (domWindow, mesg) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  return promptService.alert(domWindow, EnigGetString("enigAlert"), mesg);
}

Enigmail.prototype.confirmMsg =
function (domWindow, mesg) {
  var dummy={};
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  var buttonPressed = promptService.confirmEx(domWindow,
                        EnigGetString("enigConfirm"),
                        mesg,
                        (promptService.BUTTON_TITLE_YES * BUTTON_POS_0) +
                        (promptService.BUTTON_TITLE_NO * BUTTON_POS_1),
                        null, null, null,
                        null, dummy);
  return (buttonPressed==0); // promptService.confirm(domWindow, EnigGetString("enigConfirm"), mesg);
}

Enigmail.prototype.promptValue =
function (domWindow, mesg, valueObj) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  var checkObj = new Object();
  return promptService.prompt(domWindow, EnigGetString("enigPrompt"),
                               mesg, valueObj, "", checkObj);
}

Enigmail.prototype.errorMsg =
function (domWindow, mesg) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  return promptService.alert(domWindow, EnigGetString("enigError"), mesg);
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

Enigmail.prototype.getLogDirectoryPrefix =
function () {
  var logDirectory = "";
  try {
    logDirectory = this.prefBranch.getCharPref("logDirectory");
  } catch (ex) {
  }

  if (!logDirectory)
    return "";

  var dirPrefix = logDirectory + (this.isDosLike ? "\\" : "/");

  return dirPrefix;
}

Enigmail.prototype.stillActive =
function () {
  DEBUG_LOG("enigmail.js: Enigmail.stillActive: \n");

  // Update last active time
  var curDate = new Date();
  this._lastActiveTime = curDate.getTime();
//  DEBUG_LOG("enigmail.js: Enigmail.stillActive: _lastActiveTime="+this._lastActiveTime+"\n");
}


Enigmail.prototype.clearCachedPassphrase =
function () {
  DEBUG_LOG("enigmail.js: Enigmail.clearCachedPassphrase: \n");

  gCachedPassphrase = null;
}


Enigmail.prototype.setCachedPassphrase =
function (passphrase) {
  DEBUG_LOG("enigmail.js: Enigmail.setCachedPassphrase: \n");

  gCachedPassphrase = passphrase;
  this.stillActive();

  var maxIdleMinutes = this.getMaxIdleMinutes();

  if (this.haveCachedPassphrase() && (maxIdleMinutes > 0)) {
    // Start timer
    if (gCacheTimer)
      gCacheTimer.cancel();

    var delayMillisec = maxIdleMinutes*60*1000;

    if (Components.interfaces.nsITimer) {
      // Use nsITimer: Post 1.2a mozilla trunk
      const nsITimer = Components.interfaces.nsITimer;
      gCacheTimer = Components.classes[NS_TIMER_CONTRACTID].createInstance(nsITimer);

      if (!gCacheTimer) {
        ERROR_LOG("enigmail.js: Enigmail.setCachedPassphrase: Error - failed to create timer\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

      gCacheTimer.init(this, delayMillisec,
                       nsITimer.TYPE_REPEATING_SLACK);
    } else {
      // Use nsIScriptableTimer: Stable Mozilla 1.0 branch
      const nsIScriptableTimer = Components.interfaces.nsIScriptableTimer;
      gCacheTimer = Components.classes[NS_TIMER_CONTRACTID].createInstance(nsIScriptableTimer);

      if (!gCacheTimer) {
        ERROR_LOG("enigmail.js: Enigmail.setCachedPassphrase: Error - failed to create scriptable timer\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

      gCacheTimer.init(this, delayMillisec,
                       nsIScriptableTimer.PRIORITY_NORMAL,
                       nsIScriptableTimer.TYPE_REPEATING_SLACK);
    }

    DEBUG_LOG("enigmail.js: Enigmail.setCachedPassphrase: gCacheTimer="+gCacheTimer+"\n");
  }
}


Enigmail.prototype.haveCachedPassphrase =
function () {
  DEBUG_LOG("enigmail.js: Enigmail.haveCachedPassphrase: \n");

  var havePassphrase = ((typeof gCachedPassphrase) == "string");

  if (!havePassphrase)
    return false;

  var curDate = new Date();
  var currentTime = curDate.getTime();

  var maxIdleMinutes = this.getMaxIdleMinutes();
  var delayMillisec = maxIdleMinutes*60*1000;

  var expired = ((currentTime - this._lastActiveTime) >= delayMillisec);

//  DEBUG_LOG("enigmail.js: Enigmail.haveCachedPassphrase: ")
//  DEBUG_LOG("currentTime="+currentTime+", _lastActiveTime="+this._lastActiveTime+", expired="+expired+"\n");

  if (expired) {
    // Too much idle time; forget cached password
    gCachedPassphrase = null;
    havePassphrase = false;

    WRITE_LOG("enigmail.js: Enigmail.haveCachedPassphrase: CACHE IDLED OUT\n");
  }

  return havePassphrase;
}


Enigmail.prototype.finalize =
function () {
  DEBUG_LOG("enigmail.js: Enigmail.finalize:\n");
  if (!this.initialized) return;

  if (this.logFileStream) {
    this.logFileStream.close();
    this.logFileStream = null;
  }

  if (this.console) {
    this.console.close();
    this.console = null;
  }

  gLogLevel = 3;
  this.initializationError = "";
  this.initializationAttempted = false;
  this.initialized = false;
}


Enigmail.prototype.mimeInitialized =
function () {
  var enigMimeService = Components.classes[NS_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

  var value = enigMimeService.initialized;
  DEBUG_LOG("enigmail.js: Enigmail.mimeInitialized: "+value+"\n");
  return value;
}

Enigmail.prototype.initialize =
function (domWindow, version, prefBranch) {
  this.initializationAttempted = true;

  this.prefBranch = prefBranch;

  DEBUG_LOG("enigmail.js: Enigmail.initialize: START\n");
  if (this.initialized) return;

  try {
    var enigMsgComposeFactory = Components.classes[NS_ENIGMSGCOMPOSEFACTORY_CONTRACTID].createInstance(Components.interfaces.nsIFactory);

    var compMgr = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);

    compMgr.registerFactory(NS_ENIGMSGCOMPOSE_CID,
                            "Enig Msg Compose",
                            NS_MSGCOMPOSESECURE_CONTRACTID,
                            enigMsgComposeFactory);

    var msgComposeSecureCID = compMgr.contractIDToCID(NS_MSGCOMPOSESECURE_CONTRACTID);

    this.composeSecure = (msgComposeSecureCID.toString() ==
                          NS_ENIGMSGCOMPOSE_CID);
  } catch (ex) {}

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

  if (this.isOs2) {
    this.quoteSign="\\\"";
  }
  else {
    this.quoteSign="'";
  }

  this.isDosLike = (this.isWin32 || this.isOs2);

  var prefix = this.getLogDirectoryPrefix();
  if (prefix) {
    gLogLevel = 5;
    this.logFileStream = CreateFileStream(prefix+"enigdbug.txt");
    DEBUG_LOG("enigmail.js: Logging debug output to "+prefix+"enigdbug.txt\n");
  }

  this.version = version;

  DEBUG_LOG("enigmail.js: Enigmail version "+this.version+"\n");
  DEBUG_LOG("enigmail.js: OS/CPU="+this.oscpu+"\n");
  DEBUG_LOG("enigmail.js: Platform="+this.platform+"\n");
  DEBUG_LOG("enigmail.js: composeSecure="+this.composeSecure+"\n");

  var processInfo;
  try {
    processInfo = Components.classes[NS_PROCESSINFO_CONTRACTID].getService(nsIProcessInfo);

  } catch (ex) {
    this.initializationError = EnigGetString("enigmimeNotAvail");
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

  // Initialize global environment variables list
  var passEnv = [ "PGPPATH", "GNUPGHOME",
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

  try {
    var useAgent=this.prefBranch.getBoolPref("useGpgAgent");
    if (useAgent) {
       passEnv.push("GPG_AGENT_INFO");
    }

  } catch (ex) {}

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

  try {
    // Access IPC Service

    var ipcService = Components.classes[NS_IPCSERVICE_CONTRACTID].getService();
    ipcService = ipcService.QueryInterface(nsIIPCService);

    this.ipcService = ipcService;

    // Create a non-joinable console
    var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(nsIPipeConsole);

    pipeConsole.open(500, 80, false);

    this.console = pipeConsole;

    pipeConsole.write("Initializing Enigmail service ...\n");

  } catch (ex) {
    this.initializationError = EnigGetString("enigmimeNotAvail");
    ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  this.setAgentPath();

  // Register to observe XPCOM shutdown
  var obsServ = Components.classes[NS_OBSERVERSERVICE_CONTRACTID].getService();
  obsServ = obsServ.QueryInterface(Components.interfaces.nsIObserverService);

  obsServ.addObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);

  this.stillActive();
  this.initialized = true;

  DEBUG_LOG("enigmail.js: Enigmail.initialize: END\n");
}

Enigmail.prototype.reinitialize =
function () {
  this.initialized = false;
  this.initializationAttempted = true;

  this.console.write("Reinitializing Enigmail service ...\n");
  this.setAgentPath();
  this.initialized = true;
}

Enigmail.prototype.setAgentPath =
function () {
  var agentPath = "";
  try {
    agentPath = this.prefBranch.getCharPref("agentPath");
  } catch (ex) {}

  var agentType = "gpg";
  var agentName = this.isDosLike ? agentType+".exe" : agentType;

  if (agentPath) {
    // Locate GPG/PGP executable

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
        agentPath = pathDir.target;
      }
      else {
        // absolute path
        pathDir.initWithPath(agentPath);
      }
      if (!pathDir.exists())
        throw Components.results.NS_ERROR_FAILURE;

    } catch (ex) {
      this.initializationError = EnigGetString("gpgNotFound", agentPath);
      ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

  } else {
    // Resolve relative path using PATH environment variable
    var envPath = this.processInfo.getEnv("PATH");

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
        var regPath = enigMimeService.getGpgPathFromRegistry();
        agentPath = ResolvePath(agentName, regPath, this.isDosLike)
      }
      catch (ex) {}
    }

    if (!agentPath) {
      this.initializationError = EnigGetString("gpgNotInPath");
      ERROR_LOG("enigmail.js: Enigmail: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }
  }

  CONSOLE_LOG("EnigmailAgentPath="+agentPath+"\n\n");

  // Escape any backslashes in agent path
  agentPath = agentPath.replace(/\\/g, "\\\\");

  this.agentType = agentType;
  this.agentPath = agentPath;

  var command = this.getAgentPath();
  if (agentType == "gpg") {
     command += " --batch --no-tty --version";
  } else {
     command += " +batchmode -h";
  }

  // This particular command execution seems to be essential on win32
  // (In particular, this should be the first command executed and
  //  *should* use the shell, i.e., command.com)
  var outStrObj = new Object();
  var outLenObj = new Object();
  var errStrObj = new Object();
  var errLenObj = new Object();

  var exitCode = this.ipcService.execPipe(command, false, "", "", 0, [], 0,
                                outStrObj, outLenObj, errStrObj, errLenObj);

  CONSOLE_LOG("enigmail> "+command.replace(/\\\\/g, "\\")+"\n");

  var outStr = outStrObj.value;
  if (errStrObj.value)
    outStr += errStrObj.value;

  CONSOLE_LOG(outStr+"\n");

  var versionParts = outStr.replace(/[\r\n].*/g,"").split(/ /);
  var gpgVersion = versionParts[versionParts.length-1]

  this.agentVersion = gpgVersion;

  // check GnuPG version number
  var evalVersion = this.agentVersion.match(/^\d+\.\d+/)
  if (evalVersion && evalVersion[0]<"1.2") {
    this.alertMsg(domWindow, EnigGetString("oldGpgVersion", gpgVersion));
    throw Components.results.NS_ERROR_FAILURE;
  }
}

Enigmail.prototype.getAgentPath =
function () {
  var p = "";
  try {
    p=this.prefBranch.getCharPref("agentAdditionalParam").replace(/([\\\`])/g, "\\$1");
  }
  catch (ex) {}
  return this.agentPath + " --charset utf8 " + p;
}


Enigmail.prototype.passwdCommand =
function () {

  var command;

  try {
    var  gpgVersion = this.agentVersion.match(/^\d+\.\d+/);
    if (this.prefBranch.getBoolPref("useGpgAgent")) {
       command = " --use-agent "
    }
    else {
      command = " --passphrase-fd 0";
      if (gpgVersion && gpgVersion[0] >= "1.1") {
        command += " --no-use-agent ";
      }
    }
  } catch (ex) {}

  return command;
}

Enigmail.prototype.fixExitCode =
function (exitCode, statusFlags) {
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
}


Enigmail.prototype.simpleExecCmd =
function (command, exitCodeObj, errorMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.simpleExecCmd: command = "+command+"\n");

  var envList = [];
  envList = envList.concat(gEnvList);

  var prefix = this.getLogDirectoryPrefix();
  if (prefix && (gLogLevel >= 4)) {

    WriteFileContents(prefix+"enigcmd.txt", command.replace(/\\\\/g, "\\")+"\n");
    WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

    DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
  }

  var outObj = new Object();
  var errObj = new Object();
  var outLenObj = new Object();
  var errLenObj = new Object();

  CONSOLE_LOG("\nenigmail> "+command.replace(/\\\\/g, "\\")+"\n");

  try {
    var useShell = false;
    exitCodeObj.value = gEnigmailSvc.ipcService.execPipe(command,
                                                       useShell,
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
    DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
  }

  DEBUG_LOG("enigmail.js: Enigmail.execCmd: exitCode = "+exitCodeObj.value+"\n");
  DEBUG_LOG("enigmail.js: Enigmail.execCmd: errOutput = "+errOutput+"\n");

  exitCodeObj.value = exitCodeObj.value;

  this.stillActive();

  return outputData;
}


Enigmail.prototype.execCmd =
function (command, passphrase, input, exitCodeObj, statusFlagsObj,
          statusMsgObj, errorMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.execCmd: command = "+command+"\n");

  if ((typeof input) != "string") input = "";
  var prependPassphrase = ((typeof passphrase) == "string");

  var envList = [];
  envList = envList.concat(gEnvList);

  var preInput;

  if (prependPassphrase) {
    envList.push("PGPPASSFD=0");
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

    WriteFileContents(prefix+"enigcmd.txt", command.replace(/\\\\/g, "\\")+"\n");
    WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

    DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
  }

  var outObj = new Object();
  var errObj = new Object();
  var outLenObj = new Object();
  var errLenObj = new Object();

  CONSOLE_LOG("\nenigmail> "+command.replace(/\\\\/g, "\\")+"\n");

  try {
    var useShell = false;
    exitCodeObj.value = gEnigmailSvc.ipcService.execPipe(command,
                                                       useShell,
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
    DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
  }

  DEBUG_LOG("enigmail.js: Enigmail.execCmd: exitCode = "+exitCodeObj.value+"\n");
  DEBUG_LOG("enigmail.js: Enigmail.execCmd: errOutput = "+errOutput+"\n");


  errorMsgObj.value = this.parseErrorOutput(errOutput, statusFlagsObj, statusMsgObj);
  exitCodeObj.value = this.fixExitCode(exitCodeObj.value, statusFlagsObj.value);

  CONSOLE_LOG(errorMsgObj.value+"\n");

  this.stillActive();

  return outputData;
}


Enigmail.prototype.execStart =
function (command, needPassphrase, domWindow, prompter, listener,
          noProxy, statusFlagsObj) {
  WRITE_LOG("enigmail.js: Enigmail.execStart: command = "+command+", needPassphrase="+needPassphrase+", domWindow="+domWindow+", prompter="+prompter+", listener="+listener+", noProxy="+noProxy+"\n");

  statusFlagsObj.value = 0;

  var envList = [];
  envList = envList.concat(gEnvList);

  var passphrase = null;
  var useAgentObj = {value: false};

  if (needPassphrase) {
    command += this.passwdCommand();

    var passwdObj = new Object();

    if (!GetPassphrase(domWindow, passwdObj, useAgentObj, this.agentVersion)) {
       ERROR_LOG("enigmail.js: Enigmail.execStart: Error - no passphrase supplied\n");

       statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
       return null;
    }

    passphrase = passwdObj.value;
  }

  var prefix = this.getLogDirectoryPrefix();
  if (prefix && (gLogLevel >= 4)) {

    WriteFileContents(prefix+"enigcmd.txt", command.replace(/\\\\/g, "\\")+"\n");
    WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

    DEBUG_LOG("enigmail.js: Enigmail.execStart: copied command line/env to files "+prefix+"enigcmd.txt/enigenv.txt\n");
  }

  CONSOLE_LOG("\nenigmail> "+command.replace(/\\\\/g, "\\")+"\n");

  var pipetrans = Components.classes[NS_PIPETRANSPORT_CONTRACTID].createInstance();

  pipetrans = pipetrans.QueryInterface(Components.interfaces.nsIPipeTransport);
  DEBUG_LOG("enigmail.js: Enigmail.execStart: pipetrans = " + pipetrans + "\n");

  try {
    var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
    ipcBuffer.open(ERROR_BUFFER_SIZE, false);

    var mergeStderr = false;
    pipetrans.initCommand(command, envList, envList.length,
                          0, "", noProxy, mergeStderr,
                          ipcBuffer);

    if (listener) {
      pipetrans.asyncRead(listener, null, 0, -1, 0);
    }

    if (needPassphrase && ! useAgentObj.value) {
      // Write to child STDIN
      // (ignore errors, because child may have exited already, closing STDIN)
      try {
        if (passphrase) {
           pipetrans.writeSync(passphrase, passphrase.length);
        }
        pipetrans.writeSync("\n", 1);
      } catch (ex) {}
    }

    return pipetrans;

  } catch (ex) {
    CONSOLE_LOG("enigmail.js: Enigmail.execStart: Error - Failed to start PipeTransport\n");
    return null;
  }
}


Enigmail.prototype.parseErrorOutput =
function (errOutput, statusFlagsObj, statusMsgObj) {

  WRITE_LOG("enigmail.js: Enigmail.parseErrorOutput:\n");
  var errLines = errOutput.split(/\r?\n/);

  // Discard last null string, if any
  if ((errLines.length > 1) && !errLines[errLines.length-1])
    errLines.pop();

  var errArray    = new Array();
  var statusArray = new Array();
  var errCode = 0;

  var statusPat = /^\[GNUPG:\] /;
  var statusFlags = 0;

  for (var j=0; j<errLines.length; j++) {
    if (errLines[j].search(statusPat) == 0) {
      var statusLine = errLines[j].replace(statusPat,"");
      statusArray.push(statusLine);

      var matches = statusLine.match(/^(\w+)\b/);

      if (matches && (matches.length > 1)) {
        var flag = gStatusFlags[matches[1]];

        if (flag == nsIEnigmail.NODATA) {
          // Recognize only "NODATA 1"
          if (statusLine.search(/NODATA 1\b/) < 0)
            flag = 0;
        }
        else if (flag == nsIEnigmail.NO_SC_AVAILABLE) {
          var a = statusLine.split(/ +/);
          errCode = Number(a[1]);
        }

        if (flag)
          statusFlags |= flag;

        //DEBUG_LOG("enigmail.js: Enigmail.parseErrorOutput: status match '+matches[1]+"\n");
      }

    } else {
      errArray.push(errLines[j]);
    }
  }

  statusFlagsObj.value = statusFlags;
  statusMsgObj.value   = statusArray.join("\n");
  var errorMsg         = errArray.join("\n");

  if ((statusFlags & nsIEnigmail.NO_SC_AVAILABLE) && errCode >0) {
    switch (errCode) {
    case 4:
      errorMsg = EnigGetString("sc.noCardAvailable");
      break;
    case 5:
      errorMsg = EnigGetString("sc.noReaderAvailable");
      break;
    }
  }


  DEBUG_LOG("enigmail.js: Enigmail.parseErrorOutput: statusFlags = "+bytesToHex(pack(statusFlags,4))+"\n");
  //DEBUG_LOG("enigmail.js: Enigmail.parseErrorOutput: statusMsg = "+statusMsgObj.value+"\n");

  return errorMsg;
}

Enigmail.prototype.execEnd =
function (pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj) {

  WRITE_LOG("enigmail.js: Enigmail.execEnd: \n");

  // Extract command line
  try {
    var request = pipeTransport.QueryInterface(Components.interfaces.nsIRequest);

    cmdLineObj.value = request.name;
  } catch (ex) {
    cmdLineObj.value = "unknown-command";
  }

  // Extract exit code and error output from pipeTransport
  var exitCode = pipeTransport.exitCode();

  var errListener = pipeTransport.console;

  var errOutput = errListener.getData();

  // Terminate pipeTransport
  errListener.shutdown();

  pipeTransport.terminate();

  var prefix = this.getLogDirectoryPrefix();
  if (prefix && (gLogLevel >= 4)) {
    WriteFileContents(prefix+"enigerr.txt", errOutput);
    DEBUG_LOG("enigmail.js: Enigmail.execEnd: copied command err output to file "+prefix+"enigerr.txt\n");
  }

  DEBUG_LOG("enigmail.js: Enigmail.execEnd: exitCode = "+exitCode+"\n");
  DEBUG_LOG("enigmail.js: Enigmail.execEnd: errOutput = "+errOutput+"\n");

/*
  var errLines = errOutput.split(/\r?\n/);

  // Discard last null string, if any
  if ((errLines.length > 1) && !errLines[errLines.length-1])
    errLines.pop();

  var errArray    = new Array();
  var statusArray = new Array();

  var statusPat = /^\[GNUPG:\] /;
  var statusFlags = 0;

  for (var j=0; j<errLines.length; j++) {
    if (errLines[j].search(statusPat) == 0) {
      var statusLine = errLines[j].replace(statusPat,"");
      statusArray.push(statusLine);

      var matches = statusLine.match(/^(\w+)\b/);

      if (matches && (matches.length > 1)) {
        var flag = gStatusFlags[matches[1]];

        if (flag == nsIEnigmail.NODATA) {
          // Recognize only "NODATA 1"
          if (statusLine.search(/NODATA 1\b/) < 0)
            flag = 0;
        }

        if (flag)
          statusFlags |= flag;

        //DEBUG_LOG("enigmail.js: Enigmail.execEnd: status match '+matches[1]+"\n");
      }

    } else {
      errArray.push(errLines[j]);
    }
  }

  statusFlagsObj.value = statusFlags;
  statusMsgObj.value   = statusArray.join("\n");
  errorMsgObj.value    = errArray.join("\n");

  if (statusFlags & nsIEnigmail.NO_SC_AVAILABLE) {
    errorMsgObj.value = EnigGetString("noCardAvailable");
  }
*/

  errorMsgObj.value = this.parseErrorOutput(errOutput, statusFlagsObj, statusMsgObj);

  if (errOutput.search(/jpeg image of size \d+/)>-1) {
    statusFlagsObj.value |= nsIEnigmail.PHOTO_AVAILABLE;
  }
  CONSOLE_LOG(errorMsgObj.value+"\n");

  //DEBUG_LOG("enigmail.js: Enigmail.execEnd: statusFlags = "+bytesToHex(pack(statusFlags,4))+"\n");
  //DEBUG_LOG("enigmail.js: Enigmail.execEnd: statusMsg = "+statusMsgObj.value+"\n");

  this.stillActive();

  return exitCode;
}


// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email address
function EnigStripEmail(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       ERROR_LOG("enigmail.js: EnigStripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
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


Enigmail.prototype.stripWhitespace = function(sendFlags) {
  var stripThem=false;
  if ((sendFlags & nsIEnigmail.SEND_SIGNED) &&
      (!(sendFlags & nsIEnigmail.SEND_ENCRYPTED))) {
    if (this.agentVersion >= "1.4.0" && this.agentVersion < "1.4.1") {
      stripThem = true;
    }
  }

  return stripThem;
}


Enigmail.prototype.encryptMessage =
function (parent, uiFlags, plainText, fromMailAddr, toMailAddr,
          sendFlags, exitCodeObj, statusFlagsObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: "+plainText.length+" bytes from "+fromMailAddr+" to "+toMailAddr+" ("+sendFlags+")\n");

  exitCodeObj.value    = -1;
  statusFlagsObj.value = 0;
  errorMsgObj.value    = "";
  var hashAlgo = gMimeHashAlgorithms[this.prefBranch.getIntPref("mimeHashAlgorithm")];

  if (!plainText) {
    DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: NO ENCRYPTION!\n");
    exitCodeObj.value = 0;
    return plainText;
  }

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
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
                                           fromMailAddr, toMailAddr,
                                           hashAlgo, sendFlags, ipcBuffer,
                                           noProxy, startErrorMsgObj);

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
  ERROR_LOG("enigmail.js: Enigmail.encryptMessage: Error in command execution\n");

  return "";
}


Enigmail.prototype.encryptMessageEnd =
function (parent, prompter, uiFlags, sendFlags, outputLen, pipeTransport,
          statusFlagsObj, errorMsgObj)
{
  DEBUG_LOG("enigmail.js: Enigmail.encryptMessageEnd: uiFlags="+uiFlags+", sendFlags="+bytesToHex(pack(sendFlags,4))+", outputLen="+outputLen+", pipeTransport="+pipeTransport+"\n");

  var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;

  statusFlagsObj.value = 0;
  errorMsgObj.value    = "";

  if (!this.initialized) {
     errorMsgObj.value = EnigGetString("notInit");
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

  if (exitCode == 0) {
    // Normal return
    errorMsgObj.value = cmdErrorMsgObj.value;
    return 0;
  }

  // Error processing
  ERROR_LOG("enigmail.js: Enigmail.encryptMessageEnd: Error in command execution\n");

  var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
  var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
  var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

  if ( (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) ||
       ((this.agentType == "pgp") && signMsg && (exitCode != 21)) ) {
    // "Unremember" passphrase on error return
    this.clearCachedPassphrase();
  }

  if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
    errorMsgObj.value = EnigGetString("badPhrase");
  }
  else if (statusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) {
   errorMsgObj.value = statusMsg;

  }
  else {
    errorMsgObj.value = EnigGetString("badCommand");
  }

  if (cmdErrorMsgObj.value) {
    errorMsgObj.value += "\n\n" + this.agentType + " "+EnigGetString("cmdLine");
    errorMsgObj.value += "\n" + cmdLineObj.value;
    errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
  }

  if (pgpMime && errorMsgObj.value) {
    if (prompter)
      prompter.alert(EnigGetString("enigAlert"), errorMsgObj.value);
    else
      this.alertMsg(parent, errorMsgObj.value);
  }

  return exitCode;
}

var gPGPHashNum = {md5:1, sha1:2, ripemd160:3, sha256:4, sha384:5, sha512:6};

Enigmail.prototype.getEncryptCommand =
function (fromMailAddr, toMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj) {
  try {
    fromMailAddr = EnigStripEmail(fromMailAddr);
    toMailAddr = EnigStripEmail(toMailAddr);

  } catch (ex) {
    errorMsgObj.value = EnigGetString("invalidEmail");
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
  var k;

  var encryptCommand = this.getAgentPath();

  encryptCommand += GPG_BATCH_OPTS;

  if (!useDefaultComment)
    encryptCommand += " --comment "+this.quoteSign+GPG_COMMENT_OPT.replace(/\%s/, this.vendor)+this.quoteSign;

  var angledFromMailAddr = ((fromMailAddr.search(/^0x/) == 0) || hushMailSupport)
                         ? fromMailAddr : "<" + fromMailAddr + ">";
  angledFromMailAddr = angledFromMailAddr.replace(/([\"\'\`])/g, "\\$1");

  if (signMsg && hashAlgorithm) {
    encryptCommand += " --digest-algo "+hashAlgorithm;
  }

  if (encryptMsg) {
    switch (isAscii) {
    case ENC_TYPE_MSG:
      encryptCommand += " -a -t";
      break;
    case ENC_TYPE_ATTACH_ASCII:
      encryptCommand += " -a";
    }

    encryptCommand +=  " -e";

    if (signMsg)
      encryptCommand += " -s";

    if (sendFlags & nsIEnigmail.SEND_ALWAYS_TRUST) {
      if (this.agentVersion >= "1.4") {
        encryptCommand += " --trust-model always"
      }
      else {
        encryptCommand += " --always-trust";
      }
    }
    if ((sendFlags & nsIEnigmail.SEND_ENCRYPT_TO_SELF) && fromMailAddr)
      encryptCommand += " --encrypt-to " + angledFromMailAddr;

    for (k=0; k<toAddrList.length; k++) {
       toAddrList[k] = toAddrList[k].replace(/\'/g, "\\'");
       encryptCommand += (hushMailSupport || (toAddrList[k].search(/^0x/) == 0)) ? " -r "+ toAddrList[k]
                          :" -r <" + toAddrList[k] + ">";
    }

  } else if (detachedSig) {
    encryptCommand += " -s -b";

    switch (isAscii) {
    case ENC_TYPE_MSG:
      encryptCommand += " -a -t";
      break;
    case ENC_TYPE_ATTACH_ASCII:
      encryptCommand += " -a";
    }

  } else if (signMsg) {
    encryptCommand += " -t --clearsign";
  }

  if (fromMailAddr) {
    encryptCommand += " -u " + angledFromMailAddr;
  }

  return encryptCommand;
}


Enigmail.prototype.encryptMessageStart =
function (parent, prompter, uiFlags, fromMailAddr, toMailAddr,
          hashAlgorithm, sendFlags, listener, noProxy, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: prompter="+prompter+", uiFlags="+uiFlags+", from "+fromMailAddr+" to "+toMailAddr+", hashAlgorithm="+hashAlgorithm+" ("+bytesToHex(pack(sendFlags,4))+")\n");

  var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;

  if (uiFlags & nsIEnigmail.UI_RESTORE_STRICTLY_MIME) {
    try {
      var prefSvc = Components.classes[NS_PREFS_SERVICE_CID]
                     .getService(Components.interfaces.nsIPrefService);
      var prefRoot = prefSvc.getBranch(null);
      prefRoot.setBoolPref("mail.strictly_mime", false);
      DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: disabled quoted-printable\n");
    }
    catch (ex) {}
  }

  errorMsgObj.value = "";

  if (!sendFlags) {
    DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: NO ENCRYPTION!\n");
    errorMsgObj.value = EnigGetString("notRequired");
    return null;
  }

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return null;
  }

  if (this.keygenProcess) {
    errorMsgObj.value = EnigGetString("notComplete");
    return null;
  }

  var encryptCommand = this.getEncryptCommand(fromMailAddr, toMailAddr, hashAlgorithm, sendFlags, ENC_TYPE_MSG, errorMsgObj);
  if (! encryptCommand)
    return null;

  var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;

  var statusFlagsObj = new Object();
  var pipetrans = this.execStart(encryptCommand, signMsg, parent, prompter,
                                 listener, noProxy, statusFlagsObj);

  if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
    ERROR_LOG("enigmail.js: Enigmail.encryptMessageStart: Error - no passphrase supplied\n");

    errorMsgObj.value = null;
  }

  if (pgpMime && errorMsgObj.value) {
    if (prompter)
      prompter.alert(EnigGetString("enigAlert"), errorMsgObj.value);
    else
      this.alertMsg(parent, errorMsgObj.value);
  }

  return pipetrans;
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

// Locates offsets bracketing PGP armored block in text,
// starting from given offset, and returns block type string.
// beginIndex = offset of first character of block
// endIndex = offset of last character of block (newline)
// If block is not found, the null string is returned;

Enigmail.prototype.locateArmoredBlock =
function (text, offset, indentStr, beginIndexObj, endIndexObj,
          indentStrObj) {
  DEBUG_LOG("enigmail.js: Enigmail.locateArmoredBlock: "+offset+", '"+indentStr+"'\n");

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
      DEBUG_LOG("enigmail.js: Enigmail.locateArmoredBlock: blockType="+blockType+"\n");
  }

  if (blockType == "UNVERIFIED MESSAGE") {
    // Skip any unverified message block
    return this.locateArmoredBlock(text, endIndex+1, indentStr,
                                   beginIndexObj, endIndexObj, indentStrObj);
  }

  beginIndexObj.value = beginIndex;
  endIndexObj.value = endIndex;

  return blockType;
}


Enigmail.prototype.extractSignaturePart =
function (signatureBlock, part) {
  DEBUG_LOG("enigmail.js: Enigmail.extractSignaturePart: part="+part+"\n");

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
}


Enigmail.prototype.decryptMessage =
function (parent, uiFlags, cipherText, signatureObj, exitCodeObj,
          statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: "+cipherText.length+" bytes, "+uiFlags+"\n");

  if (! cipherText)
    return "";

  var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
  var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
  var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
  var oldSignature = signatureObj.value;

  DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: oldSignature="+oldSignature+"\n");

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
    errorMsgObj.value = EnigGetString("noPGPblock");
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
      errorMsgObj.value = EnigGetString("decryptToImport");
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
      ERROR_LOG("enigmail.js: Enigmail.decryptMessage: Error - signature mismatch "+newSignature+"\n");
      errorMsgObj.value = EnigGetString("sigMismatch");
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
    errorMsgObj.value = EnigGetString("messageSizeError");
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
                                          ipcBuffer, noProxy, startErrorMsgObj);

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
      WRITE_LOG("enigmail.js: Enigmail.decryptMessage: decrypted text too big for standard buffer, retrying with buffer size="+readBytes+"\n");
    }
    else {
      tryCount = maxTries;
    }

    ipcBuffer.shutdown();
    ipcBuffer = null; // make sure the object gets freed

    var exitCode = this.decryptMessageEnd(uiFlags, plainText.length, pipeTrans,
                                        verifyOnly, noOutput,
                                        statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj,
                                        errorMsgObj);
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
      errorMsgObj.value = EnigGetString("unverifiedReply")+"\n\n"+errorMsgObj.value;
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
        DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: innerKeyBlock found\n");
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
          this.alertMsg(parent, EnigGetString("cantImport")+importErrorMsgObj.value);
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
}


Enigmail.prototype.decryptMessageStart =
function (parent, prompter, verifyOnly, noOutput,
          listener, noProxy, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.decryptMessageStart: prompter="+prompter+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return null;
  }

  if (this.keygenProcess) {
    errorMsgObj.value = EnigGetString("notComplete");
    return null;
  }

  var decryptCommand = this.getAgentPath() + GPG_BATCH_OPTS;

  var keyserver = this.prefBranch.getCharPref("autoKeyRetrieve");
  if (keyserver != "") {
    decryptCommand += " --keyserver-options auto-key-retrieve";
    var srvProxy = this.getHttpProxy(keyserver);
    if (srvProxy && this.agentVersion>="1.4" ) {
      decryptCommand += ",http-proxy="+srvProxy;
    }
    decryptCommand += " --keyserver "+keyserver;
  }

  if (noOutput) {
    decryptCommand += " --verify";

  } else {
    decryptCommand += " -d";
  }

  var statusFlagsObj = new Object();
  var pipetrans = this.execStart(decryptCommand, !verifyOnly, parent, prompter,
                                 listener, noProxy, statusFlagsObj);

  if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
    ERROR_LOG("enigmail.js: Enigmail.decryptMessageStart: Error - no passphrase supplied\n");

    errorMsgObj.value = EnigGetString("noPassphrase");
    return null;
  }

  return pipetrans;
}


Enigmail.prototype.decryptMessageEnd =
function (uiFlags, outputLen, pipeTransport, verifyOnly, noOutput,
          statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.decryptMessageEnd: uiFlags="+uiFlags+", outputLen="+outputLen+", pipeTransport="+pipeTransport+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

  var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
  var pgpMime     = uiFlags & nsIEnigmail.UI_PGP_MIME;
  var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
  var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;

  statusFlagsObj.value = 0;
  errorMsgObj.value    = "";

  if (!this.initialized) {
     errorMsgObj.value = EnigGetString("notInit");
     return -1;
  }

  // Terminate job and parse error output
  var statusMsgObj   = new Object();
  var cmdLineObj     = new Object();
  var cmdErrorMsgObj = new Object();

  var exitCode = this.execEnd(pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, cmdErrorMsgObj);

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
      userId = EnigConvertToUnicode(userId, "UTF-8");
    }

    userIdObj.value = userId;
    keyIdObj.value = keyId;
    sigDetailsObj.value = sigDetails;

    if (signed) {
      var trustPrefix = "";

      if (statusFlagsObj.value & nsIEnigmail.UNTRUSTED_IDENTITY) {
        trustPrefix += EnigGetString("prefUntrusted")+" ";
      }

      if (statusFlagsObj.value & nsIEnigmail.REVOKED_KEY) {
        trustPrefix += EnigGetString("prefRevoked")+" ";
      }

      if (statusFlagsObj.value & nsIEnigmail.EXPIRED_KEY_SIGNATURE) {
        trustPrefix += EnigGetString("prefExpiredKey")+" ";

      } else if (statusFlagsObj.value & nsIEnigmail.EXPIRED_SIGNATURE) {
        trustPrefix += EnigGetString("prefExpired")+" ";
      }

      if (goodSignature) {
        errorMsgObj.value = trustPrefix + EnigGetString("prefGood",userId) /* + ", " +
              EnigGetString("keyId") + " 0x" + keyId.substring(8,16); */

        if (this.agentType != "gpg") {
          // Trust all good signatures, if not GPG
          statusFlagsObj.value |= nsIEnigmail.GOOD_SIGNATURE | nsIEnigmail.TRUSTED_IDENTITY;
        }

      } else {
        errorMsgObj.value = trustPrefix + EnigGetString("prefBad",userId) /*+ ", " +
              EnigGetString("keyId") + " 0x" + keyId.substring(8,16); */
        if (!exitCode)
          exitCode = 1;

        if (this.agentType != "gpg")
          statusFlagsObj.value |= nsIEnigmail.BAD_SIGNATURE;
      }
    }

    if (!verifyOnly && (this.agentType != "gpg")) {
        statusFlagsObj.value |= nsIEnigmail.DECRYPTION_OKAY;
    }

    return exitCode;
  }

  if ( (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) ||
       ((this.agentType == "pgp") && !verifyOnly && (exitCode != 30)) ) {
    // "Unremember" passphrase on decryption failure
    this.clearCachedPassphrase();
  }

  var pubKeyId;

  if (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE) {
    // Unverified signature
    var matchb = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);

    if (matchb && (matchb.length > 3)) {
      pubKeyId = "0x" + matchb[3];
      DEBUG_LOG("enigmail.js: Enigmail.decryptMessageEnd: NO_PUBKEY "+pubKeyId+"\n");
      keyIdObj.value = matchb[2]+matchb[3];
    }
    if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY) {
      exitCode=0;
    }

  }

  if (this.agentType != "gpg") {
    // Not GPG

    if (verifyOnly) {
      // Assume bad signature is reason for failure
      statusFlagsObj.value |= nsIEnigmail.BAD_SIGNATURE;

    } else {
      statusFlagsObj.value |= outputLen ? nsIEnigmail.DECRYPTION_OKAY
                                        : nsIEnigmail.DECRYPTION_FAILED;
    }
  }

  if (exitCode != 0) {
    // Error processing
    ERROR_LOG("enigmail.js: Enigmail.decryptMessageEnd: Error in command execution\n");
  }

  if (cmdErrorMsgObj.value) {
    errorMsgObj.value = this.agentType + " " + EnigGetString("cmdLine");
    errorMsgObj.value += "\n" + cmdLineObj.value;
    errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
  }

  return exitCode;
}


// ExitCode == 0  => success
// ExitCode > 0   => error
// ExitCode == -1 => Cancelled by user
Enigmail.prototype.receiveKey =
function (recvFlags, keyserver, keyId, requestObserver, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.receiveKey: "+keyId+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return null;
  }

  if (this.agentType != "gpg") {
    errorMsgObj.value = EnigGetString("failOnlyGPG");
    return null;
  }

  if (!keyserver) {
    errorMsgObj.value = EnigGetString("failNoServer");
    return null;
  }

  if (!keyId && ! (recvFlags & nsIEnigmail.REFRESH_KEY)) {
    errorMsgObj.value = EnigGetString("failNoID");
    return null;
  }

  var envList = [];
  envList = envList.concat(gEnvList);

  var proxyHost = this.getHttpProxy(keyserver);
  var command = this.getAgentPath();

  if (! (recvFlags & nsIEnigmail.SEARCH_KEY)) command += GPG_BATCH_OPTS;

  if (proxyHost) {
    command += " --keyserver-options honor-http-proxy";
    envList.push("http_proxy="+proxyHost);
  }
  command += " --keyserver " + keyserver;

  if (recvFlags & nsIEnigmail.DOWNLOAD_KEY) {
    command += " --recv-keys " + keyId;
  }
  else if (recvFlags & nsIEnigmail.SEARCH_KEY) {
    command += " --search-keys " + keyId;
  }
  else if (recvFlags & nsIEnigmail.UPLOAD_KEY) {
    command += " --send-keys " + keyId;
  }
  else if (recvFlags & nsIEnigmail.REFRESH_KEY) {
    command += " --refresh-keys";
  }

  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();
  var statusMsgObj   = new Object();
  var cmdLineObj   = new Object();

  CONSOLE_LOG("enigmail> "+command.replace(/\\\\/g, "\\")+"\n");

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);
  // Create joinable console
  pipeConsole.open(20, 80, true);

  var ipcRequest = null;
  try {
    ipcRequest = gEnigmailSvc.ipcService.execAsync(command,
                                                   false,
                                                   "",
                                                   "",
                                                   0,
                                                   envList, envList.length,
                                                   pipeConsole,
                                                   pipeConsole,
                                                   requestObserver);
  } catch (ex) {
    ERROR_LOG("enigmail.js: Enigmail.receiveKey: execAsync failed\n");
  }

  if (!ipcRequest) {
    ERROR_LOG("enigmail.js: Enigmail.receiveKey: execAsync failed somehow\n");
    return null;
  }

  return ipcRequest;
}


function GetPasswdForHost(hostname, userObj, passwdObj) {
  return -1;
  var passwordmanager = Components.classes["@mozilla.org/passwordmanager;1"].getService(Components.interfaces.nsIPasswordManager);
  var enumerator = passwordmanager.enumerator;

  while (enumerator.hasMoreElements()) {
    var nextPassword;
    try {
      nextPassword = enumerator.getNext();
    } catch(e) {
      // user supplied invalid database key
      return -1;
    }
    nextPassword = nextPassword.QueryInterface(Components.interfaces.nsIPassword);
      // try/catch in case decryption fails (invalid signon entry)
    try {
      var passwdHost = nextPassword.host.replace(/^.*:\/\//, "");
      if (passwdHost == hostname) {
        userObj.value = nextPassword.user;
        passwdObj.value = nextPassword.password;
        return 0;
      }
    } catch (e) {
      // password cannot be decrypted
    }
  }
  return 1;
}



Enigmail.prototype.getHttpProxy =
function (hostName) {
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
          if (GetPasswdForHost(proxyHostName, userObj, passwdObj) == 0) {
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
}

Enigmail.prototype.searchKey =
function (recvFlags, protocol, keyserver, port, keyValue, requestObserver, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.searchKey: "+keyValue+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return null;
  }

  if (this.agentType != "gpg") {
    errorMsgObj.value = EnigGetString("failOnlyGPG");
    return null;
  }

  if (!keyserver) {
    errorMsgObj.value = EnigGetString("failNoServer");
    return null;
  }

  if (!keyValue) {
    errorMsgObj.value = EnigGetString("failNoID");
    return null;
  }

  var envList = [];
  envList = envList.concat(gEnvList);

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
    baseDir.initWithPath(this.agentPath);
    var command = null;

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

    command=command.replace(/\\\\/g, "\\").replace(/\\/g, "\\\\");

    // call gpgkeys to check the version number

    var outObj     = new Object();
    var outLenObj  = new Object();
    var errObj     = new Object();
    var errLenObj  = new Object();
    var testCmd = command + " -V"

    CONSOLE_LOG("\nenigmail> "+testCmd.replace(/\\\\/g, "\\")+"\n");

    try {
      var exitCode = this.ipcService.execPipe(testCmd,
                                            false,
                                            "",
                                            "", 0,
                                            envList, envList.length,
                                            outObj, outLenObj,
                                            errObj, errLenObj);
    }
    catch (ex) {
      CONSOLE_LOG(testCmd.replace(/\\\\/g, "\\")+" failed\n");
      return null;
    }

    if (exitCode !=0) {
      CONSOLE_LOG(testCmd.replace(/\\\\/g, "\\")+" not found\n");
      return null;
    }

    CONSOLE_LOG(outObj.value+"\n");

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
    command = this.getAgentPath() + " --command-fd 0 --no-tty --batch --fixed-list --with-colons"
    if (proxyHost) command+=" --keyserver-options http-proxy="+proxyHost
    command +=" --keyserver ";
    if (! protocol) protocol="hkp";
    command += protocol + "://" + keyserver;
    if (port) command += ":"+port;

    if (recvFlags & nsIEnigmail.SEARCH_KEY) {
      command += " --search-keys ";
      inputData = "quit\n";
    }
    else if (recvFlags & nsIEnigmail.DOWNLOAD_KEY) {
      command+=" --status-fd 1 --recv-keys ";
      inputData = "";
    }
    command += keyValue
  }

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);
  // Create joinable console
  pipeConsole.open(5000, 0, true);

  var errorConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);
  errorConsole.open(20, 0, true);

  CONSOLE_LOG("enigmail> "+command.replace(/\\\\/g, "\\")+"\n");


  var ipcRequest = null;
  try {
    ipcRequest = gEnigmailSvc.ipcService.execAsync(command,
                                                   false,
                                                   "",
                                                   inputData,
                                                   inputData.length,
                                                   envList, envList.length,
                                                   pipeConsole,
                                                   errorConsole,
                                                   requestObserver);
  } catch (ex) {
    ERROR_LOG("enigmail.js: Enigmail.searchKey: execAsync failed\n");
  }

  if (!ipcRequest) {
    ERROR_LOG("enigmail.js: Enigmail.searchKey: execAsync failed somehow\n");
    return null;
  }

  return ipcRequest;
}


Enigmail.prototype.extractKey =
function (parent, exportFlags, userId, outputFile, exitCodeObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.extractKey: "+userId+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return "";
  }

  var command = this.getAgentPath();
  command += GPG_BATCH_OPTS + " -a --export ";
  command += userId;

  var statusFlagsObj = new Object();
  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();

  var keyBlock = this.execCmd(command, null, "",
                    exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

  if ((exitCodeObj.value == 0) && !keyBlock)
    exitCodeObj.value = -1;

  if (exitCodeObj.value != 0) {
    errorMsgObj.value = EnigGetString("failKeyExtract");

    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n" + command;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    return "";
  }

  if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
    command = this.getAgentPath();
    command += GPG_BATCH_OPTS + " -a --export-secret-keys ";
    command += userId;

    var secKeyBlock = this.execCmd(command, null, "",
                    exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if ((exitCodeObj.value == 0) && !secKeyBlock)
      exitCodeObj.value = -1;

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = EnigGetString("failKeyExtract");

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
      errorMsgObj.value = EnigGetString("fileWriteFailed", outputFile);
    }
    return "";
  }
  return keyBlock;
}


// ExitCode == 0  => success
// ExitCode > 0   => error
// ExitCode == -1 => Cancelled by user
Enigmail.prototype.importKey =
function (parent, uiFlags, msgText, keyId, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.importKey: id="+keyId+", "+uiFlags+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return 1;
  }

  var beginIndexObj = new Object();
  var endIndexObj   = new Object();
  var indentStrObj   = new Object();
  var blockType = this.locateArmoredBlock(msgText, 0, "",
                                          beginIndexObj, endIndexObj,
                                          indentStrObj);

  if (!blockType) {
    errorMsgObj.value = EnigGetString("noPGPblock");
    return 1;
  }

  if (blockType != "PUBLIC KEY BLOCK") {
    errorMsgObj.value = EnigGetString("notFirstBlock");
    return 1;
  }

  var pgpBlock = msgText.substr(beginIndexObj.value,
                                endIndexObj.value - beginIndexObj.value + 1);

  var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;

  if (interactive) {
    var confirmMsg = EnigGetString("importKeyConfirm");

    if (!this.confirmMsg(parent, confirmMsg)) {
      errorMsgObj.value = EnigGetString("failCancel");
      return -1;
    }
  }

  var command = this.getAgentPath();

  if (this.agentType == "pgp") {
    command += PGP_BATCH_OPTS + " -ft -ka";

  } else {
    command += GPG_BATCH_OPTS + " --import";
  }

  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();
  var statusMsgObj   = new Object();

  var output = this.execCmd(command, null, pgpBlock,
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
        DEBUG_LOG("enigmail.js: Enigmail.importKey: IMPORTED "+pubKeyId+"\n");
      }
    }
  }

  return exitCodeObj.value;
}

Enigmail.prototype.importKeyFromFile =
function (parent, fileName, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.importKeyFromFile: fileName="+fileName+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return 1;
  }

  fileName=fileName.replace(/\\/g, "\\\\");

  var command = this.getAgentPath();

  command += GPG_BATCH_OPTS + " --import '"+fileName+"'";

  var statusFlagsObj = new Object();
  var statusMsgObj   = new Object();
  var exitCodeObj    = new Object();

  var output = this.execCmd(command, null, "",
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
        DEBUG_LOG("enigmail.js: Enigmail.importKey: IMPORTED "+pubKeyId+"\n");
      }
    }
    errorMsgObj.value = EnigConvertGpgToUnicode(errorMsgObj.value);
  }

  return exitCodeObj.value;
}

Enigmail.prototype.generateKey =
function (parent, name, comment, email, expiryDate, keyLength, keyType,
          passphrase, requestObserver) {
  WRITE_LOG("enigmail.js: Enigmail.generateKey: \n");

  if (this.keygenProcess || (this.agentType != "gpg"))
    throw Components.results.NS_ERROR_FAILURE;

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  // Create joinable console
  pipeConsole.open(100, 80, true);

  var command = this.getAgentPath() + GPG_BATCH_OPTS + " --gen-key";

  pipeConsole.write(command.replace(/\\\\/g, "\\")+"\n");
  CONSOLE_LOG(command.replace(/\\\\/g, "\\")+"\n");

  var inputData = "%echo Generating key\nKey-Type: "

  switch (keyType) {
  case KEYTYPE_DSA:
    inputData += "DSA\nKey-Length: 1024\nSubkey-Type: ELG-E\nSubkey-Length: ";
    break;
  case KEYTYPE_RSA:
    inputData += "RSA\nKey-Length: ";
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

  pipeConsole.write(EnigConvertToUnicode(inputData, "utf-8")+"\n");
  CONSOLE_LOG(inputData+" \n");

  if (passphrase.length)
    inputData += "Passphrase: "+passphrase+"\n";

  inputData += "%commit\n%echo done\n";

  var ipcRequest = null;
  try {
    var useShell = false;
    ipcRequest = gEnigmailSvc.ipcService.execAsync(command,
                                                   useShell,
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
    ERROR_LOG("enigmail.js: Enigmail.generateKey: execAsync failed\n");
    return null;
  }

  this.keygenRequest = ipcRequest;

  DEBUG_LOG("enigmail.js: Enigmail.generateKey: ipcRequest = "+ipcRequest+"\n");

  return ipcRequest;
}


Enigmail.prototype.createMessageURI =
function (originalUrl, contentType, contentCharset, contentData, persist) {
  DEBUG_LOG("enigmail.js: Enigmail.createMessageURI: "+originalUrl+
            ", "+contentType+", "+contentCharset+"\n");

  var messageId = "msg" + Math.floor(Math.random()*1.0e9);

  this._messageIdList[messageId] = {originalUrl:originalUrl,
                                    contentType:contentType,
                                    contentCharset:contentCharset,
                                    contentData:contentData,
                                    persist:persist};

  return "enigmail:message?id="+messageId;
}


function ExtractMessageId(uri) {
  var messageId = "";

  var matches = uri.match(/^enigmail:message\?id=(.+)/);

  if (matches && (matches.length > 1)) {
    messageId = matches[1];
  }

  return messageId;
}


Enigmail.prototype.deleteMessageURI =
function (uri) {
  DEBUG_LOG("enigmail.js: Enigmail.deleteMessageURI: "+uri+"\n");

  var messageId = ExtractMessageId(uri);

  if (!messageId)
    return false;

  return (delete this._messageIdList[messageId]);
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

Enigmail.prototype.invalidateUserIdList =
function () {
  // clean the userIdList to force reloading the list at next usage
  this.userIdList= null;
}

// returns the output of -with-colons --list[-secret]-keys
Enigmail.prototype.getUserIdList =
function  (secretOnly, refresh, exitCodeObj, statusFlagsObj, errorMsgObj) {

  if (secretOnly || refresh || this.userIdList == null) {
    var gpgCommand = this.getAgentPath() + GPG_BATCH_OPTS;

    if (secretOnly) {
      gpgCommand += " --with-fingerprint --fixed-list-mode --with-colons --list-secret-keys";  }
    else {
      gpgCommand += " --with-fingerprint --fixed-list-mode --with-colons --list-keys";
    }

    if (!this.initialized) {
      errorMsgObj.value = EnigGetString("notInit");
      return "";
    }

    statusFlagsObj.value = 0;

    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();

    var listText = this.execCmd(gpgCommand, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = EnigGetString("badCommand");
      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + gpgCommand;
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    listText=EnigConvertGpgToUnicode(listText).replace(/(\r\n|\r)/g, "\n");
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
}

// returns the output of -with-colons --list-sig
Enigmail.prototype.getKeySig =
function  (keyId, exitCodeObj, errorMsgObj) {

  var gpgCommand = this.getAgentPath() + GPG_BATCH_OPTS + " --fixed-list-mode --with-colons --with-fingerprint --list-sig "+keyId;

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return "";
  }

  var statusFlagsObj = new Object();
  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();

  var listText = this.execCmd(gpgCommand, null, "",
                    exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

  if (exitCodeObj.value != 0) {
    errorMsgObj.value = EnigGetString("badCommand");
    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n" + gpgCommand;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    return "";
  }
  return listText;
}

// get key details.
// if uidOnly is true, returns just a list of uid's
Enigmail.prototype.getKeyDetails = function (keyId, uidOnly) {
  var gpgCommand = this.getAgentPath() + GPG_BATCH_OPTS
  gpgCommand += " --fixed-list-mode --with-colons --list-keys " + keyId;
  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();
  var statusFlagsObj = new Object();
  var exitCodeObj = new Object();

  var listText = this.execCmd(gpgCommand, null, "",
                    exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);
  if (exitCodeObj.value != 0) {
    return "";
  }
  listText=EnigConvertGpgToUnicode(listText).replace(/(\r\n|\r)/g, "\n");

  if (uidOnly) {
    var userList="";
    var keyArr=listText.split(/\n/);
    for (var i=0; i<keyArr.length; i++) {
      switch (keyArr[i].substr(0,4)) {
      case "uid:" :
        userList += keyArr[i].split(/:/)[9] + "\n";
      }
    }
    return userList;
  }

  return listText;
}

Enigmail.prototype.encryptAttachment =
function (parent, fromMailAddr, toMailAddr, sendFlags, inFile, outFile,
          exitCodeObj, statusFlagsObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.encryptAttachment\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return "";
  }

  statusFlagsObj.value = 0;
  sendFlags |= nsIEnigmail.SEND_ATTACHMENT;

  var asciiArmor = false;
  try {
    asciiArmor = this.prefBranch.getBoolPref("inlineAttachAsciiArmor");
  } catch (ex) {}
  var asciiFlags = (asciiArmor ? ENC_TYPE_ATTACH_ASCII : ENC_TYPE_ATTACH_BINARY);

  var gpgCommand = this.getEncryptCommand(fromMailAddr, toMailAddr, "", sendFlags, asciiFlags, errorMsgObj);

  if (! gpgCommand)
      return null;

  var passphrase = null;
  var signMessage = (sendFlags & nsIEnigmail.SEND_SIGNED);

  if (signMessage ) {
    gpgCommand += this.passwdCommand();

    var passwdObj = new Object();
    var useAgentObj = new Object();

    if (!GetPassphrase(parent, passwdObj, useAgentObj, this.agentVersion)) {
       ERROR_LOG("enigmail.js: Enigmail.encryptAttachment: Error - no passphrase supplied\n");

       statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
       return null;
    }

    passphrase = passwdObj.value;
  }

  // escape the backslashes (mainly for Windows) and the ' character
  inFile = inFile.replace(/([\\\"\'\`])/g, "\\$1");
  outFile = outFile.replace(/([\\\"\'\`])/g, "\\$1");

  gpgCommand += " --yes -o " + this.quoteSign + outFile + this.quoteSign;
  gpgCommand += " "+this.quoteSign + inFile + this.quoteSign;

  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();

  var msg = this.execCmd(gpgCommand, passphrase, "",
                    exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

  if (exitCodeObj.value != 0) {

    if (cmdErrorMsgObj.value) {
      errorMsgObj.value = gpgCommand;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }
    else {
      errorMsgObj.value = "An unknown error has occurred";
    }

    return "";
  }

  return msg;
}


Enigmail.prototype.decryptAttachment =
function (parent, outFileName, displayName, inputBuffer,
          exitCodeObj, statusFlagsObj, errorMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.decryptAttachment: parent="+parent+", outFileName="+outFileName+"\n");

  var dataLength = new Object();
  var byteData = inputBuffer.getByteData(dataLength);
  var attachmentHead = byteData.substr(0,200);
  if (attachmentHead.match(/\-\-\-\-\-BEGIN PGP \w+ KEY BLOCK\-\-\-\-\-/)) {
    // attachment appears to be a PGP key file

    if (this.confirmMsg(parent, EnigGetString("attachmentPgpKey", displayName))) {
      exitCodeObj.value = this.importKey(parent, 0, byteData, "", errorMsgObj);
      statusFlagsObj.value = gStatusFlags.IMPORTED;
    }
    else {
      exitCodeObj.value = 0;
      statusFlagsObj.value = nsIEnigmail.DISPLAY_MESSAGE;
    }
    return true;
  }

  var command = this.getAgentPath();

  outFileName = outFileName.replace(/([\\\"\'\`])/g, "\\$1");
  //replace(/\\/g, "\\\\").replace(/'/g, "\\'");;

  command += GPG_BATCH_OPTS + " -o " + this.quoteSign + outFileName + this.quoteSign;
  command+= " --yes " + this.passwdCommand() + " -d ";


  statusFlagsObj.value = 0;

  var passphrase = null;
  var passwdObj = new Object();
  var useAgentObj = new Object();

  if (!GetPassphrase(parent, passwdObj, useAgentObj, this.agentVersion)) {
    ERROR_LOG("enigmail.js: Enigmail.decryptAttachment: Error - no passphrase supplied\n");

    statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
    return null;
  }

  passphrase = passwdObj.value;

  var noProxy = true;

  var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
  ipcBuffer.open(MSG_BUFFER_SIZE, false);

  var pipeTrans = this.execStart(command, false, parent, 0,
                                 ipcBuffer, noProxy, statusFlagsObj);


  if (!pipeTrans) {
    return false;
  }

  try {
    if (! useAgentObj.value) {
      if (passphrase.length > 0) {
        pipeTrans.writeSync(passphrase, passphrase.length);
      }

      pipeTrans.writeSync("\n", 1);
    }
    pipeTrans.writeSync(byteData, dataLength.value);

  }
  catch (ex) {
    return false;
  }
  // Wait for child STDOUT to close
  pipeTrans.join();

  exitCodeObj.value = pipeTrans.exitCode();

  var statusMsgObj = new Object();
  var cmdLineObj     = new Object();

  try {
    this.execEnd(pipeTrans, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);
  }
  catch (ex) {};

  return true;

}

Enigmail.prototype.getCardStatus =
function(exitCodeObj, errorMsgObj) {
  var command = this.getAgentPath();

  command += " --status-fd 2 --fixed-list-mode --with-colons --card-status";
  var statusMsgObj = new Object();
  var statusFlagsObj = new Object();

  var outputTxt = this.execCmd(command, null, "",
                exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

  if ((exitCodeObj.value == 0) && !outputTxt) {
    exitCodeObj.value = -1;
    return "";
  }

  return outputTxt;
}

Enigmail.prototype.showKeyPhoto =
function(keyId, photoNumber, exitCodeObj, errorMsgObj) {

  var command = this.getAgentPath();

  command += " --no-secmem-warning --batch --no-tty --status-fd 1 --attribute-fd 2";
  command += " --fixed-list-mode --list-keys "+keyId;

  var photoDataObj = new Object();

  var outputTxt = this.simpleExecCmd(command, exitCodeObj, photoDataObj);

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
}


// Methods for handling Per-Recipient Rules

Enigmail.prototype.getRulesFile = function () {
  DEBUG_LOG("enigmail.js: getRulesFile\n");
  var ds = Components.classes[DIR_SERV_CONTRACTID].getService();
  var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
  var rulesFile = dsprops.get("ProfD", Components.interfaces.nsILocalFile);
  rulesFile.append("pgprules.xml");
  return rulesFile;
}

Enigmail.prototype.loadRulesFile = function () {
  DEBUG_LOG("enigmail.js: loadRulesFile\n");
  var flags = NS_RDONLY;
  var rulesFile = this.getRulesFile();

  if (rulesFile.exists()) {

    var ioServ = Components.classes[NS_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
    if (!ioServ)
      throw Components.results.NS_ERROR_FAILURE;

    var fileURI = ioServ.newFileURI(rulesFile);
    var fileChannel = ioServ.newChannel(fileURI.asciiSpec, null, null);

    var rawInStream = fileChannel.open();

    var scriptableInStream = Components.classes[NS_SCRIPTABLEINPUTSTREAM_CONTRACTID].createInstance(Components.interfaces.nsIScriptableInputStream);
    scriptableInStream.init(rawInStream);
    var available = scriptableInStream.available()
    var fileContents = scriptableInStream.read(available);
    scriptableInStream.close();

    if (fileContents.length==0 || fileContents.search(/^\s*$/)==0) {
      return false;
    }

    var domParser=Components.classes[NS_DOMPARSER_CONTRACTID].createInstance(Components.interfaces.nsIDOMParser);
    this.rulesList = domParser.parseFromString(fileContents, "text/xml");

    return true;
  }
  return false;
}

Enigmail.prototype.saveRulesFile = function () {
  DEBUG_LOG("enigmail.js: saveRulesFile\n");

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
}

Enigmail.prototype.getRulesData = function (rulesListObj) {
  DEBUG_LOG("enigmail.js: getRulesData\n");
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
}

Enigmail.prototype.addRule = function (appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags) {
  DEBUG_LOG("enigmail.js: addRule\n");
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

}

Enigmail.prototype.clearRules = function () {
  this.rulesList = null;
}



function KeyEditor(pipeTrans, reqObserver) {
  this._pipeTrans = pipeTrans;
  this._reqObserver = reqObserver;
}

KeyEditor.prototype = {
  _pipeTrans: null,
  _txt: null,
  _req: null,

  nextLine: function() {
    return this._txt;
  },

  writeLine: function (inputData) {
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
    errorMsgObj.value=EnigGetString("undefinedError");

    while (! r.quitNow) {
      while ((txt.indexOf("[GNUPG:] GET_") < 0) && (! r.quitNow)) {
        try {
          txt = this.nextLine();
          DEBUG_LOG(txt+"\n");
          if (txt.indexOf("KEYEXPIRED") > 0) {
            errorMsgObj.value=EnigGetString("noSignKeyExpired");
            r.exitCode=-1;
          }
          if (txt.indexOf("[GNUPG:] BAD_PASSPHRASE")>=0) {
            r.exitCode=-2;
          }
          if (txt.indexOf("[GNUPG:] NO_CARD_AVAILABLE")>=0) {
            errorMsgObj.value=EnigGetString("noCardAvailable");
            r.exitCode=-3;
          }
          if (txt.indexOf("[GNUPG:] ENIGMAIL_FAILURE")==0) {
            r.exitCode = -3;
            r.quitNow = true;
            errorMsgObj.value = txt.substr(26);
          }
          if (txt.indexOf("[GNUPG:] ALREADY_SIGNED")>=0) {
            errorMsgObj.value=EnigGetString("keyAlreadySigned");
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
          DEBUG_LOG(txt+"\n");
        }
        catch(ex) {
          r.quitNow=true;
        }
      }
    }

    try {
      this.writeLine("save");
      txt = this.nextLine();
      DEBUG_LOG(txt+"\n");
    }
    catch (ex) {
      DEBUG_LOG("no more data\n");
    }

    return r.exitCode;
  },

  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsISupports))
         throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
}

Enigmail.prototype.signKey =
function (parent, userId, keyId, signLocally, trustLevel, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.signKey: trustLevel="+trustLevel+", userId="+userId+", keyId="+keyId+"\n");
  var r = this.editKey(parent, true, userId, keyId,
                      (signLocally ? "lsign" : "sign"),
                      { trustLevel: trustLevel},
                      signKeyCallback,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
}

Enigmail.prototype.setKeyTrust =
function (parent, keyId, trustLevel, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.setKeyTrust: trustLevel="+trustLevel+", keyId="+keyId+"\n");

  return this.editKey(parent, false, null, keyId, "trust",
                      { trustLevel: trustLevel},
                      keyTrustCallback,
                      null,
                      errorMsgObj);
}

Enigmail.prototype.genRevokeCert =
function (parent, keyId, outFile, reasonCode, reasonText, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.genRevokeCert: keyId="+keyId+"\n");

  var r= this.editKey(parent, true, null, keyId, "revoke",
                      { outFile: outFile,
                        reasonCode: reasonCode,
                        reasonText: EnigConvertFromUnicode(reasonText) },
                      revokeCertCallback,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
}

Enigmail.prototype.addUid =
function (parent, keyId, name, email, comment, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.addUid: keyId="+keyId+", name="+name+", email="+email+"\n");
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
}

Enigmail.prototype.deleteKey =
function (parent, keyId, deleteSecretKey, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.addUid: keyId="+keyId+", deleteSecretKey="+deleteSecretKey+"\n");

  var cmd = (deleteSecretKey ? "--delete-secret-and-public-key" : "--delete-key");
  var r= this.editKey(parent, false, null, keyId, cmd,
                      {},
                      deleteKeyCallback,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
}

Enigmail.prototype.changePassphrase =
function (parent, keyId, oldPw, newPw, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.addUid: changePassphrase="+keyId+"\n");

  var pwdObserver = new enigChangePasswdObserver();
  var r= this.editKey(parent, false, null, keyId, "passwd",
                      { oldPw: oldPw,
                        newPw: newPw,
                        step: 0,
                        observer: pwdObserver },
                      changePassphraseCallback,
                      pwdObserver,
                      errorMsgObj);
  this.stillActive();

  return r;
}


Enigmail.prototype.revokeSubkey =
function (parent, keyId, subkeys, reasonCode, reasonText, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.revokeSubkey: keyId="+keyId+"\n");

  var r= this.editKey(parent, true, null, keyId, "",
                      { step: 0,
                        subkeys: subkeys.split(/,/),
                        reasonCode: reasonCode,
                        reasonText: EnigConvertFromUnicode(reasonText) },
                      revokeSubkeyCallback,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
}


Enigmail.prototype.enableDisableKey =
function (parent, keyId, disableKey, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.addUid: keyId="+keyId+", disableKey="+disableKey+"\n");

  var cmd = (disableKey ? "disable" : "enable");
  var r= this.editKey(parent, false, null, keyId, cmd,
                      {},
                      null,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
}

Enigmail.prototype.setPrimaryUid =
function (parent, keyId, idNumber, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.setPrimaryUid: keyId="+keyId+", idNumber="+idNumber+"\n");
  var r = this.editKey(parent, true, null, keyId, "",
                      { idNumber: idNumber,
                        step: 0 },
                      setPrimaryUidCallback,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
}


Enigmail.prototype.deleteUid =
function (parent, keyId, idNumber, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.deleteUid: keyId="+keyId+", idNumber="+idNumber+"\n");
  var r = this.editKey(parent, true, null, keyId, "",
                      { idNumber: idNumber,
                        step: 0 },
                      deleteUidCallback,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
}


Enigmail.prototype.revokeUid =
function (parent, keyId, idNumber, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.revokeUid: keyId="+keyId+", idNumber="+idNumber+"\n");
  var r = this.editKey(parent, true, null, keyId, "",
                      { idNumber: idNumber,
                        step: 0 },
                      revokeUidCallback,
                      null,
                      errorMsgObj);
  this.stillActive();

  return r;
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
    DEBUG_LOG("enigmail.js: enigCardAdminObserver.onDataAvailable: data="+data+"\n");
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
    DEBUG_LOG("enigmail.js: enigChangePasswdObserver.onDataAvailable: data="+data+"\n");
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

Enigmail.prototype.genCardKey =
function (parent, name, email, comment, expiry, backupPasswd, requestObserver, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.genCardKey: \n");
  var generateObserver = new enigCardAdminObserver(requestObserver, this.isDosLike);
  var r = this.editKey(parent, false, null, "", "--with-colons --card-edit",
                      { step: 0,
                        name: EnigConvertFromUnicode(name),
                        email: email,
                        comment: EnigConvertFromUnicode(comment),
                        expiry: expiry,
                        backupPasswd: backupPasswd,
                        backupKey: (backupPasswd.length > 0 ? "Y" : "N"),
                        parent: parent },
                      genCardKeyCallback,
                      generateObserver,
                      errorMsgObj);
  return r;
}

Enigmail.prototype.cardAdminData =
function (parent, name, firstname, lang, sex, url, login, forcepin, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.cardAdminData: parent="+parent+", name="+name+", firstname="+firstname+", lang="+lang+", sex="+sex+", url="+url+", login="+login+", forcepin="+forcepin+"\n");
  var adminObserver = new enigCardAdminObserver(null, this.isDosLike);
  var r = this.editKey(parent, false, null, "", "--with-colons --card-edit",
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
}

Enigmail.prototype.cardChangePin =
function (parent, action, oldPin, newPin, adminPin, pinObserver, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.cardChangePin: parent="+parent+", action="+action+"\n");
  var adminObserver = new enigCardAdminObserver(pinObserver, this.isDosLike);
  var r = this.editKey(parent, false, null, "", "--with-colons --card-edit",
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
}


Enigmail.prototype.editKey =
function (parent, needPassphrase, userId, keyId, editCmd, inputData, callbackFunc, requestObserver, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.editKey: parent="+parent+", editCmd="+editCmd+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return -1;
  }

  if (this.agentType != "gpg") {
    errorMsgObj.value = EnigGetString("failOnlyGPG");
    return -1;
  }

  errorMsgObj.value = "";
  var command = this.getAgentPath();

  var statusFlags = new Object();

  var passphrase = "";
  var useAgentObj = new Object();

  if (needPassphrase) {
    command += this.passwdCommand();

    var passwdObj = new Object();

    if (!GetPassphrase(parent, passwdObj, useAgentObj, this.agentVersion)) {
       ERROR_LOG("enigmail.js: Enigmail.execStart: Error - no passphrase supplied\n");

       errorMsgObj.value = EnigGetString("noPassphrase");
       return -1;
    }

    passphrase = passwdObj.value;
  }
  else
  {
    useAgentObj.value = true;
  }

  command += " --no-tty --status-fd 1 --logger-fd 1 --command-fd 0"
  if (userId) command += " -u " + userId;
  if (editCmd == "revoke") {
    // escape backslashes and ' characters
    command += " -a -o "+this.quoteSign;
    command += inputData.outFile.replace(/([\\\"\'\`])/g, "\\$1");
    //replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    command += this.quoteSign+" --gen-revoke " + keyId;
  }
  else if (editCmd.indexOf("--")==0) {
    command += " "+editCmd + " " + keyId;
  }
  else {
    command += " --ask-cert-level --edit-key " + keyId + " " + editCmd;
  }
  command = command.replace(/ *$/, "");
  var pipeTrans = this.execStart(command, false, parent, null, null,
                                 true, statusFlags);
  if (! pipeTrans) return -1;

  if (! useAgentObj.value) {
    try {
      if (passphrase) {
         pipeTrans.writeSync(passphrase, passphrase.length);
      }
      pipeTrans.writeSync("\n", 1);
    } catch (ex) {}
  }


  var returnCode=-1;
  try {
    var keyEdit = new KeyEditor(pipeTrans, requestObserver);
    returnCode = keyEdit.keyEditorMainLoop(callbackFunc, inputData, errorMsgObj);
  } catch (ex) {
    DEBUG_LOG("enigmail.js: Enigmail.editKey: caught exception from writing to pipeTrans\n");
  }

  var mimeSvc = Components.classes[NS_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

  var exitCode = -1;
  switch(returnCode) {
  case 0:
    for (var retryCount = 100; retryCount > 0; retryCount--) {
      if (pipeTrans.isAttached()) {
        DEBUG_LOG("enigmail.js: Enigmail.editKey: sleeping 100 ms\n");
        mimeSvc.sleep(100);
      }
      else {
        retryCount = -1;
      }
    }
    try{
      exitCode = pipeTrans.exitCode();
    } catch (ex) {
      DEBUG_LOG("enigmail.js: Enigmail.editKey: caught exception from pipeTrans\n");
    }
    break;
  case -2:
    errorMsgObj.value=EnigGetString("badPhrase");
    this.clearCachedPassphrase();
  default:
    exitCode = returnCode;
  }

  DEBUG_LOG("enigmail.js: Enigmail.editKey: GnuPG terminated with code="+exitCode+"\n");
  return exitCode;
}


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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keyedit.prompt")) {
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    ret.quitNow = true;
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
    ret.exitCode=-1;
  }
}

function GetPin(domWindow, promptMsg, ret) {
  DEBUG_LOG("enigmail.js: GetPin: \n");

  var passwdObj = {value: ""};
  var dummyObj = {};

  var success = false;

  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  success = promptService.promptPassword(domWindow,
                                         EnigGetString("Enigmail"),
                                         promptMsg,
                                         passwdObj,
                                         null,
                                         dummyObj);

  if (!success) {
    ret.errorMsg = EnigGetString("noPassphrase");
    ret.quitNow=true;
    return false;
  }

  DEBUG_LOG("enigmail.js: GetPin: got pin\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.enter")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.backupPasswd;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.valid")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.expiry;
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
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    GetPin(inputData.parent, EnigGetString("enterAdminPin"), ret);
  }
  else if (keyEdit.doCheck(GET_HIDDEN, "passphrase.pin.ask")) {
    GetPin(inputData.parent, EnigGetString("enterCardPin"), ret);
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.smartcard.surname")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.firstname;
  }
  else if (keyEdit.doCheck(GET_LINE, "keygen.smartcard.givenname")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.name;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_sex")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.sex;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_lang")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.lang;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_url")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.url;
  }
  else if (keyEdit.doCheck(GET_LINE, "cardedit.change_login")) {
    ret.exitCode = 0;
    ret.writeTxt = inputData.login;
  }
  else {
    ret.quitNow=true;
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
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
    ERROR_LOG("Unknown command prompt: "+keyEdit.getText()+"\n");
  }
}

const EnigCmdLineHandler = {
  /* nsISupports */
  QueryInterface: function (iid) {
    if (iid.equals(nsICommandLineHandler) ||
        iid.equals(Components.interfaces.nsIFactory) ||
        iid.equals(nsISupports))
        return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsICommandLineHandler */
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

  /* nsIFactory */

  createInstance: function (outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  lockFactory: function (lock) {}
};
