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
const MSG_BUFFER_SIZE = 96000;

const ERROR_BUFFER_SIZE = 16000;

const PGP_BATCH_OPTS  = " +batchmode +force";
const GPG_BATCH_OPTS  = " --batch --no-tty --status-fd 2";

const GPG_COMMENT_OPT = " --comment 'Using GnuPG with ";
const PGP_COMMENT_OPT = " +comment='Using PGP with ";

const COMMENT_SUFFIX = " - http://enigmail.mozdev.org'";


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

const WMEDIATOR_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=window-mediator";

const NS_IOSERVICE_CONTRACTID       = "@mozilla.org/network/io-service;1";

const NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const ENIG_STRINGBUNDLE_CONTRACTID = "@mozilla.org/intl/stringbundle;1";

// Interfaces
const nsISupports            = Components.interfaces.nsISupports;
const nsIObserver            = Components.interfaces.nsIObserver;
const nsILocalFile           = Components.interfaces.nsILocalFile;
const nsIProtocolHandler     = Components.interfaces.nsIProtocolHandler;
const nsIIPCService          = Components.interfaces.nsIIPCService;
const nsIPipeConsole         = Components.interfaces.nsIPipeConsole;
const nsIProcessInfo         = Components.interfaces.nsIProcessInfo;
const nsIEnigmail            = Components.interfaces.nsIEnigmail;
const nsIPGPModule           = Components.interfaces.nsIPGPModule;
const nsIPGPMsgBody          = Components.interfaces.nsIPGPMsgBody;
const nsIPGPMsgHeader        = Components.interfaces.nsIPGPMsgHeader;
const nsIEnigStrBundle       = Components.interfaces.nsIStringBundleService;

const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";
///////////////////////////////////////////////////////////////////////////////
// Global variables

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
                    TRUST_ULTIMATE:  nsIEnigmail.TRUSTED_IDENTITY
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
  dump(str);

  if (gEnigmailSvc && gEnigmailSvc.logFileStream) {
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
    WRITE_LOG("enigmail.js: Registered components\n");
  },

  unregisterSelf: function(compRegistrar, moduleFile, registryLocation)
  {
    DEBUG_LOG("enigmail.js: unregisterSelf\n");

  },

  getClassObject: function (compRegistrar, cid, iid) {
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
                                                    contentCharset,
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
  if (aURI.spec == aURI.scheme+":about") {
    // About Enigmail
    winName = "enigmail:about";
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
    winName = "enigmail:about";
    spec = "chrome://enigmail/content/enigmailAbout.xul";
  }

  var windowManager = Components.classes[WMEDIATOR_CONTRACTID].getService(Components.interfaces.nsIWindowMediator);

  var recentWin = windowManager.getMostRecentWindow(winName);

  dump("recentWin="+recentWin+"\n");

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


function GetPassphrase(domWindow, prompter, passwdObj) {
  DEBUG_LOG("enigmail.js: GetPassphrase: \n");

  try {
    var noPassphrase = gEnigmailSvc.prefBranch.getBoolPref("noPassphrase");
    var useAgent = gEnigmailSvc.prefBranch.getBoolPref("useGpgAgent");

    if (noPassphrase || useAgent) {
      passwdObj.value = "";
      return true;
    }

  } catch(ex) {
  }

  if (gEnigmailSvc.haveCachedPassphrase()) {
    passwdObj.value = gCachedPassphrase;
    return true;
  }

  // Obtain password interactively
  var checkObj = new Object();

  var promptMsg = EnigGetString("enterPass",gEnigmailSvc.agentType.toUpperCase());
  passwdObj.value = "";
  checkObj.value = true;

  var maxIdleMinutes = gEnigmailSvc.getMaxIdleMinutes();
  var checkMsg = (maxIdleMinutes>0) ? EnigGetString("rememberPass",maxIdleMinutes) : "";

  var success;

  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  success = promptService.promptPassword(domWindow,
                                         EnigGetString("Enigmail"),
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

Enigmail.prototype.isUnix  = false;
Enigmail.prototype.isWin32 = false;

Enigmail.prototype.ipcService = null;
Enigmail.prototype.prefBranch = null;
Enigmail.prototype.console = null;
Enigmail.prototype.keygenProcess = null;
Enigmail.prototype.keygenConsole = null;

Enigmail.prototype.agentType = "";
Enigmail.prototype.agentPath = "";
Enigmail.prototype.agentVersion = "";

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
    // XPCOM shutdown
    this.finalize();

    // Reset mail.show_headers pref
    try {
      var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefService);

      var prefRoot = prefSvc.getBranch(null);

      var prefValue = 1;
      try {
        prefValue = this.prefBranch.getIntPref("show_headers");
      } catch (ex) {}

      prefRoot.setIntPref("mail.show_headers", prefValue);
      prefSvc.savePrefFile(null);
    } catch (ex) {}
  }
}

Enigmail.prototype.alertMsg =
function (domWindow, mesg) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  return promptService.alert(domWindow, EnigGetString("enigAlert"), mesg);
}

Enigmail.prototype.confirmMsg =
function (domWindow, mesg) {
  var promptService = Components.classes[NS_PROMPTSERVICE_CONTRACTID].getService(Components.interfaces.nsIPromptService);
  return promptService.confirm(domWindow, EnigGetString("enigConfirm"), mesg);
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

  var dirPrefix = logDirectory + (this.isWin32 ? "\\" : "/");

  return dirPrefix;
}

Enigmail.prototype.stillActive =
function () {
  DEBUG_LOG("enigmail.js: Enigmail.stillActive: \n");

  // Update last active time
  var curDate = new Date();
  this._lastActiveTime = curDate.getTime();
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

  var httpHandler = ioServ.getProtocolHandler("http");
  httpHandler = httpHandler.QueryInterface(Components.interfaces.nsIHttpProtocolHandler);

  this.oscpu = httpHandler.oscpu;

  this.platform = httpHandler.platform;

  if (httpHandler.vendor) {
    this.vendor = httpHandler.vendor;
  } else {
    this.vendor = "Mozilla";
  }

  this.isUnix  = (this.platform.search(/X11/i) == 0);
  this.isWin32 = (this.platform.search(/Win/i) == 0);

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

  try {
    useAgent = this.prefBranch.getBoolPref("useGpgAgent");
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

    // Append default .exe extension for Win32, if needed
    if (this.isWin32 && (agentPath.search(/\.\w+$/) < 0))
      agentPath += ".exe";

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

    for (var index=0; index<agentList.length; index++) {
      agentType = agentList[index];
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
      this.initializationError = "Unable to locate GPG executable in the path";
      ERROR_LOG("enigmail.js: Enigmail: Error - "+this.initializationError+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }
  }

  CONSOLE_LOG("EnigmailAgentPath="+agentPath+"\n\n");

  // Escape any backslashes in agent path
  agentPath = agentPath.replace(/\\/g, "\\\\");

  this.agentType = agentType;
  this.agentPath = agentPath;

  var command = agentPath;
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

  var versionParts = outStr.replace(/\n.*/g,"").split(/ /);
  var gpgVersion = versionParts[versionParts.length-1]

  this.agentVersion = gpgVersion;

  // Register to observe XPCOM shutdown
  var obsServ = Components.classes[NS_OBSERVERSERVICE_CONTRACTID].getService();
  obsServ = obsServ.QueryInterface(Components.interfaces.nsIObserverService);

  obsServ.addObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);

  this.stillActive();

  this.initialized = true;

  DEBUG_LOG("enigmail.js: Enigmail.initialize: END\n");
}

Enigmail.prototype.passwdCommand =
function () {

  var command;

  try {
    var  gpgVersion = this.agentVersion.match(/^\d+\.\d+/);
    if (this.prefBranch.getBoolPref("useGpgAgent")) {
       command = " --use-agent ";
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

        //DEBUG_LOG("enigmail.js: Enigmail.execCmd: status match "+matches[1]+"\n");
      }

    } else {
      errArray.push(errLines[j]);
    }
  }

  if ((this.agentType == "gpg") && (exitCodeObj.value == 256)) {
    WARNING_LOG("enigmail.js: Enigmail.execCmd: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
    if (statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
      WARNING_LOG("enigmail.js: Enigmail.execCmd: Changing exitCode 256->2\n");
      exitCodeObj.value = 2;
    } else {
      WARNING_LOG("enigmail.js: Enigmail.execCmd: Changing exitCode 256->0\n");
      exitCodeObj.value = 0;
    }
  }

  statusFlagsObj.value = statusFlags;
  statusMsgObj.value   = statusArray.join("\n");
  errorMsgObj.value    = errArray.join("\n");

  CONSOLE_LOG(errorMsgObj.value+"\n");

  DEBUG_LOG("enigmail.js: Enigmail.execCmd: statusFlags = "+bytesToHex(pack(statusFlags,4))+"\n");
  //DEBUG_LOG("enigmail.js: Enigmail.execCmd: statusMsg = "+statusMsgObj.value+"\n");

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


  if (needPassphrase) {
    command += this.passwdCommand();

    var passwdObj = new Object();

    if (!GetPassphrase(domWindow, prompter, passwdObj)) {
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

    if (needPassphrase) {
      // Write to child STDIN
      // (ignore errors, because child may have exited already, closing STDIN)
      try {
        if (passphrase)
           pipetrans.writeSync(passphrase, passphrase.length);
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

  WRITE_LOG("enigmail.js: Enigmail.parseErrorOutput: \n");
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

        //DEBUG_LOG("enigmail.js: Enigmail.parseErrorOutput: status match '+matches[1]+"\n");
      }

    } else {
      errArray.push(errLines[j]);
    }
  }

  statusFlagsObj.value = statusFlags;
  statusMsgObj.value   = statusArray.join("\n");
  var errorMsg         = errArray.join("\n");

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

  CONSOLE_LOG(errorMsgObj.value+"\n");

  DEBUG_LOG("enigmail.js: Enigmail.execEnd: statusFlags = "+bytesToHex(pack(statusFlags,4))+"\n");
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
    

Enigmail.prototype.encryptMessage =
function (parent, uiFlags, plainText, fromMailAddr, toMailAddr,
          sendFlags, exitCodeObj, statusFlagsObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: "+plainText.length+" bytes from "+fromMailAddr+" to "+toMailAddr+" ("+sendFlags+")\n");

  exitCodeObj.value    = -1;
  statusFlagsObj.value = 0;
  errorMsgObj.value    = "";

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
  ipcBuffer.open(MSG_BUFFER_SIZE, false);

  var pipeTrans = this.encryptMessageStart(parent, null, uiFlags,
                                           fromMailAddr, toMailAddr,
                                           "", sendFlags, ipcBuffer,
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

  if ((this.agentType == "gpg") && (exitCode == 256)) {
    WARNING_LOG("enigmail.js: Enigmail.encryptMessageEnd: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
    if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
      WARNING_LOG("enigmail.js: Enigmail.encryptMessageEnd: Changing exitCode 256->2\n");
      exitCode = 2;
    } else {
      WARNING_LOG("enigmail.js: Enigmail.encryptMessageEnd: Changing exitCode 256->0\n");
      exitCode = 0;
    }
  }

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
  } else {
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

var gPGPHashNum = {md5:1, sha1:2, ripemd160:3};

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

  var detachedSig = usePgpMime && signMsg && !encryptMsg;

  var toAddrList = toMailAddr.split(/\s*,\s*/);
  var k;

  var encryptCommand = this.agentPath;

  if (this.agentType == "pgp") {
    encryptCommand += PGP_BATCH_OPTS + " -fta "

    if (!useDefaultComment)
      encryptCommand += PGP_COMMENT_OPT + this.vendor + COMMENT_SUFFIX;

    if (encryptMsg) {
      encryptCommand += " -e";

      if (signMsg)
        encryptCommand += " -s";

      if ((sendFlags & nsIEnigmail.SEND_ENCRYPT_TO_SELF) && fromMailAddr)
        encryptCommand += " +encrypttoself=on";

      for (k=0; k<toAddrList.length; k++)
         encryptCommand += " "+toAddrList[k];

    } else if (detachedSig) {
      encryptCommand += " -sb";

      if (hashAlgorithm && gPGPHashNum[hashAlgorithm.toLowerCase()])
        encryptCommand += " +hashnum=" + gPGPHashNum[hashAlgorithm];

    } else if (signMsg) {
      encryptCommand += " -s";
    }

    if (fromMailAddr) {
      encryptCommand += " +myname=" + fromMailAddr;
    }

  } else {
    encryptCommand += GPG_BATCH_OPTS;

    if (!useDefaultComment)
      encryptCommand += GPG_COMMENT_OPT + this.vendor + COMMENT_SUFFIX;


    var angledFromMailAddr = ((fromMailAddr.search(/^0x/) == 0) || hushMailSupport)
	                         ? fromMailAddr : "<" + fromMailAddr + ">";
    angledFromMailAddr = angledFromMailAddr.replace(/([\'\`])/g, "\\$1");

    if (encryptMsg) {
      if (isAscii)
        encryptCommand += " -a";

      encryptCommand +=  " -e";

      if (signMsg)
        encryptCommand += " -s";

      if (sendFlags & nsIEnigmail.SEND_ALWAYS_TRUST)
        encryptCommand += " --always-trust";

      if ((sendFlags & nsIEnigmail.SEND_ENCRYPT_TO_SELF) && fromMailAddr)
        encryptCommand += " --encrypt-to " + angledFromMailAddr;

      for (k=0; k<toAddrList.length; k++) {
         toAddrList[k] = toAddrList[k].replace(/\'/g, "\\'");
         encryptCommand += (hushMailSupport || (toAddrList[k].search(/^0x/) == 0)) ? " -r "+ toAddrList[k]
                            :" -r <" + toAddrList[k] + ">";
      }

    } else if (detachedSig) {
      encryptCommand += " -s -b -t";
      if (isAscii)
        encryptCommand += " -a";

      if (hashAlgorithm) {
        encryptCommand += " --digest-algo "+hashAlgorithm;
      }

    } else if (signMsg) {
      encryptCommand += " --clearsign";
      if (hashAlgorithm) {
        encryptCommand += " --digest-algo "+hashAlgorithm;
      }
    }

    if (fromMailAddr) {
      encryptCommand += " -u " + angledFromMailAddr;
    }
  }

  return encryptCommand;
}


Enigmail.prototype.encryptMessageStart =
function (parent, prompter, uiFlags, fromMailAddr, toMailAddr,
          hashAlgorithm, sendFlags, listener, noProxy, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: prompter="+prompter+", uiFlags="+uiFlags+", from "+fromMailAddr+" to "+toMailAddr+", hashAlgorithm="+hashAlgorithm+" ("+bytesToHex(pack(sendFlags,4))+")\n");

  var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;

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

  var encryptCommand = this.getEncryptCommand(fromMailAddr, toMailAddr, hashAlgorithm, sendFlags, true, errorMsgObj);
  if (! encryptCommand)
    return null;

  var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;

  var statusFlagsObj = new Object();
  var pipetrans = this.execStart(encryptCommand, signMsg, parent, prompter,
                                 listener, noProxy, statusFlagsObj);

  if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
    ERROR_LOG("enigmail.js: Enigmail.encryptMessageStart: Error - no passphrase supplied\n");

    errorMsgObj.value = EnigGetString("noPassphrase");
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
function (text, offset, indentStr, beginIndexObj, endIndexObj) {
  DEBUG_LOG("enigmail.js: Enigmail.locateArmoredBlock: "+offset+", '"+indentStr+"'\n");

  beginIndexObj.value = -1;
  endIndexObj.value = -1;

  var beginIndex = IndexOfArmorDelimiter(text, indentStr+"-----BEGIN PGP ", offset);

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
                                   beginIndexObj, endIndexObj);
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
function (parent, uiFlags, cipherText, signatureObj,
          exitCodeObj, statusFlagsObj, keyIdObj, userIdObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: "+cipherText.length+" bytes, "+uiFlags+"\n");

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
  var blockType = this.locateArmoredBlock(cipherText, 0, "",
                                          beginIndexObj, endIndexObj);

  if (!blockType) {
    errorMsgObj.value = EnigGetString("noPGPblock");
    statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
    return "";
  }

  var publicKey = (blockType == "PUBLIC KEY BLOCK");

  var verifyOnly = (blockType == "SIGNED MESSAGE");

  var pgpBlock = cipherText.substr(beginIndexObj.value,
                          endIndexObj.value - beginIndexObj.value + 1);

  var head = cipherText.substr(0, beginIndexObj.value);
  var tail = cipherText.substr(endIndexObj.value+1,
                               cipherText.length - endIndexObj.value - 1);

  if (publicKey) {
    if (!allowImport) {
      errorMsgObj.value = EnigGetString("decryptToImport");
      statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

      return "";
    }

    // Import public key
    var importFlags = nsIEnigmail.UI_INTERACTIVE;
    exitCodeObj.value = this.importKey(parent, importFlags, pgpBlock, "",
                                       errorMsgObj);
    return "";
  }

  /*
   // not needed anymore. Nicer solution is to display the text anyway and mark the 
   // verified text accordingly!   
  if (!interactive && verifyOnly && !oldSignature && (head.search(/\S/) >= 0)) {
    errorMsgObj.value = EnigGetString("extraText");
    if (verifyOnly)
      errorMsgObj.value += " "+EnigGetString("toVerify");

    statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
    return "";
  }
  */

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

  var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
  ipcBuffer.open(MSG_BUFFER_SIZE, false);

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

  var plainText = ipcBuffer.getData();
  ipcBuffer.shutdown();

  var exitCode = this.decryptMessageEnd(uiFlags, plainText.length, pipeTrans,
                                        verifyOnly, noOutput,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        errorMsgObj);

  exitCodeObj.value = exitCode;

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

    return plainText;
  }

  var pubKeyId = keyIdObj.value;

  if (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE) {
    // Return bad signature (for checking later)
    signatureObj.value = newSignature;

  } else if (pubKeyId &&
             (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE)) {

    var innerKeyBlock;
    if (verifyOnly) {
      // Search for indented public key block in signed message
      var innerBlockType = this.locateArmoredBlock(pgpBlock, 0, "- ",
                                                   beginIndexObj, endIndexObj);

      if (innerBlockType == "PUBLIC KEY BLOCK") {

        innerKeyBlock = pgpBlock.substr(beginIndexObj.value,
                                   endIndexObj.value - beginIndexObj.value + 1);

        innerKeyBlock = innerKeyBlock.replace(/- -----/g, "-----");

        statusFlagsObj.value |= nsIEnigmail.INLINE_KEY;
        DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: innerKeyBlock found\n");
      }
    }

    var keyserver;
    try {
      keyserver = this.prefBranch.getCharPref("keyserver");
    } catch (ex) {
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

      if (!importedKey && keyserver && (this.agentType == "gpg")) {
        var recvErrorMsgObj = new Object();
        var recvFlags = nsIEnigmail.UI_INTERACTIVE;
        var exitStatus2 = this.receiveKey(parent, recvFlags, pubKeyId,
                                       recvErrorMsgObj);

        importedKey = (exitStatus2 == 0);

        if (exitStatus2 > 0) {
          this.alertMsg(parent, EnigGetString("keyImportError")+recvErrorMsgObj.value);
        }
      }

      if (importedKey) {
        // Recursive call; note that nsIEnigmail.UI_ALLOW_KEY_IMPORT is unset
        // to break the recursion
        var uiFlagsDeep = interactive ? nsIEnigmail.UI_INTERACTIVE : 0;
        signatureObj.value = "";
        return this.decryptMessage(parent, uiFlagsDeep, pgpBlock,
                                    signatureObj, exitCodeObj, statusFlagsObj,
                                    keyIdObj, userIdObj, errorMsgObj);
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

  var decryptCommand = this.agentPath;

  if (this.agentType == "pgp") {
    decryptCommand += PGP_BATCH_OPTS + " -ft";

  } else if (noOutput) {
    decryptCommand += GPG_BATCH_OPTS + " --verify";

  } else {
    decryptCommand += GPG_BATCH_OPTS + " -d";
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
          statusFlagsObj, keyIdObj, userIdObj, errorMsgObj) {
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

  if ((this.agentType == "gpg") && (exitCode == 256)) {
    WARNING_LOG("enigmail.js: Enigmail.decryptMessageEnd: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
    if ((statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) || (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE)) {
      WARNING_LOG("enigmail.js: Enigmail.decryptMessageEnd: Changing exitCode 256->2\n");
      exitCode = 2;
    } else {
      WARNING_LOG("enigmail.js: Enigmail.decryptMessageEnd: Changing exitCode 256->0\n");
      exitCode = 0;
    }
  }

  if ((exitCode == 0) && !noOutput && !outputLen) {
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
        

    } else { 
        errLines = cmdErrorMsgObj.value.split(/\r?\n/);

        goodSignPat = /Good signature from (user )?"(.*)"\.?/i;
        badSignPat  =  /BAD signature from (user )?"(.*)"\.?/i;
        keyExpPat   = /This key has expired/i;
    }

    errorMsgObj.value = "";

    var matches;

    var signed = false;
    var goodSignature;

    var userId = "";
    var keyId = "";
    for (var j=0; j<errLines.length; j++) {
      matches = errLines[j].match(badSignPat);

      if (matches && (matches.length > 2)) {
        signed = true;
        goodSignature = false;
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

    if (userId) {
      userId = EnigConvertToUnicode(userId, "UTF-8");
    }
    userIdObj.value = userId;
    keyIdObj.value = keyId;

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
        errorMsgObj.value = trustPrefix + EnigGetString("prefGood",userId) + ", " + 
              EnigGetString("keyId") + " 0x" + keyId.substring(8,16);

        if (this.agentType != "gpg") {
          // Trust all good signatures, if not GPG
          statusFlagsObj.value |= nsIEnigmail.GOOD_SIGNATURE | nsIEnigmail.TRUSTED_IDENTITY;
        }

      } else {
        errorMsgObj.value = trustPrefix + EnigGetString("prefBad",userId) + ", " + 
              EnigGetString("keyId") + " 0x" + keyId.substring(8,16);
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

  // Error processing
  ERROR_LOG("enigmail.js: Enigmail.decryptMessageEnd: Error in command execution\n");

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

  if (cmdErrorMsgObj.value) {
    errorMsgObj.value = this.agentType + " " + EnigGetString("cmdLine");
    errorMsgObj.value += "\n" + cmdLineObj.value;
    errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
  }

  return exitCode;
}


Enigmail.prototype.extractFingerprint = 
function (email, secret, exitCodeObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.extractFingerprint: "+email+"\n");

  exitCodeObj.value = -1;
  statusMsgObj.value = "";

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return "";
  }

  var email_addr = "<"+email+">";

  var command = this.agentPath;

  if (this.agentType == "pgp") {
    command += PGP_BATCH_OPTS + " -kvc "+email_addr;
    if (secret)
      command += " secring.pkr";

  } else {
    command += GPG_BATCH_OPTS + " --fingerprint ";
    command += secret ? " --list-secret-keys" : " --list-keys";
    command += " "+email_addr;
  }

  var statusFlagsObj = new Object();    
  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();

  var keyText = gEnigmailSvc.execCmd(command, null, "",
                    exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

  if ((exitCodeObj.value == 0) && !keyText)
    exitCodeObj.value = -1;

  if (exitCodeObj.value != 0) {
    errorMsgObj.value = EnigGetString("failFingerprint");

    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n" + command;
      errorMsgObj.value += "\n"+cmdErrorMsgObj.value;
    }

    return "";
  }

  var outputLines = keyText.split(/\r?\n/);

  var fingerprintPat = /^\s*Key\s+fingerprint\s*=\s*/i;

  var fingerprint;
  for (var j=0; j<outputLines.length; j++) {
    if (outputLines[j].search(fingerprintPat) == 0) {
      if (fingerprint) {
        errorMsgObj.value = EnigGetString("failMultiple",email_addr);
        return "";
      }

      fingerprint = outputLines[j].replace(fingerprintPat,"");
    }
  }

  if (!fingerprint) {
    errorMsgObj.value = EnigGetString("failNoKey",email_addr);
    return "";
  }

  // Canonicalize fingerprint (remove spaces, lowercase)
  fingerprint = fingerprint.replace(/\s+/g, "");
  fingerprint = fingerprint.toLowerCase();

  DEBUG_LOG("enigmail.js: Enigmail.extractFingerprint: fprint="+fingerprint+"\n");
  return fingerprint;
}


// ExitCode == 0  => success
// ExitCode > 0   => error
// ExitCode == -1 => Cancelled by user
Enigmail.prototype.receiveKey = 
function (parent, uiFlags, keyId, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.receiveKey: "+keyId+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return 1;
  }

  if (this.agentType != "gpg") {
    errorMsgObj.value = EnigGetString("failOnlyGPG");
    return 1;
  }

  var interactive  = uiFlags & nsIEnigmail.UI_INTERACTIVE;

  var keyserver;
  try {
    keyserver = this.prefBranch.getCharPref("keyserver");
  } catch (ex) {}

  if (keyId && keyserver && (this.agentType == "gpg")) {
    var prompt = EnigGetString("importKey",keyId);

    var valueObj = new Object();
    valueObj.value = keyserver;

    if (!this.promptValue(parent, prompt, valueObj)) {
      errorMsgObj.value = EnigGetString("failCancel");
      return -1;
    }

    keyserver = valueObj.value;
  }

  if (!keyserver) {
    errorMsgObj.value = EnigGetString("failNoServer");
    return 1;
  }

  if (!keyId) {
    errorMsgObj.value = EnigGetString("failNoID");
    return 1;
  }

  var command = this.agentPath;

  command += GPG_BATCH_OPTS + " --keyserver " + keyserver + " --recv-keys ";
  command += keyId;

  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();    
  var statusMsgObj   = new Object();

  var output = gEnigmailSvc.execCmd(command, null, "",
                       exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

  return exitCodeObj.value;
}


Enigmail.prototype.extractKey = 
function (parent, uiFlags, userId, exitCodeObj, errorMsgObj) {
  DEBUG_LOG("enigmail.js: Enigmail.extractKey: "+userId+"\n");

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return "";
  }

  var command = this.agentPath;

  if (this.agentType == "pgp") {
    command += PGP_BATCH_OPTS + " -f -kx ";

  } else {
    command += GPG_BATCH_OPTS + " -a --export ";
  }

  command += userId;

  var statusFlagsObj = new Object();
  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();

  var keyBlock = gEnigmailSvc.execCmd(command, null, "",
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
  var blockType = this.locateArmoredBlock(msgText, 0, "",
                                          beginIndexObj, endIndexObj);

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

  var command = this.agentPath;

  if (this.agentType == "pgp") {
    command += PGP_BATCH_OPTS + " -ft -ka";

  } else {
    command += GPG_BATCH_OPTS + " --import";
  }

  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();    
  var statusMsgObj   = new Object();

  var output = gEnigmailSvc.execCmd(command, null, pgpBlock,
                      exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

  var statusMsg = statusMsgObj.value;

  var pubKeyId;

  if (exitCodeObj.value == 0) {
    // Normal return
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


Enigmail.prototype.generateKey = 
function (parent, name, comment, email, expiryDate, passphrase,
          requestObserver) {
  WRITE_LOG("enigmail.js: Enigmail.generateKey: \n");

  if (this.keygenProcess || (this.agentType != "gpg"))
    throw Components.results.NS_ERROR_FAILURE;

  var pipeConsole = Components.classes[NS_PIPECONSOLE_CONTRACTID].createInstance(Components.interfaces.nsIPipeConsole);

  // Create joinable console
  pipeConsole.open(100, 80, true);

  var command = this.agentPath + " --batch --no-tty --gen-key";

  pipeConsole.write(command.replace(/\\\\/g, "\\")+"\n");
  CONSOLE_LOG(command.replace(/\\\\/g, "\\")+"\n");

  var inputData =
"%echo Generating a standard key\nKey-Type: DSA\nKey-Length: 1024\nSubkey-Type: ELG-E\nSubkey-Length: 1024\n";

  inputData += "Name-Real: "+name+"\n";
  inputData += "Name-Comment: "+comment+"\n";
  inputData += "Name-Email: "+email+"\n";
  inputData += "Expire-Date: "+expiryDate+"\n";

  pipeConsole.write(inputData+"\n");
  CONSOLE_LOG(inputData+"\n");

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


Enigmail.prototype.getUserIdList =
function  (parent, secretOnly, exitCodeObj, statusFlagsObj, errorMsgObj) {

  var gpgCommand = this.agentPath + GPG_BATCH_OPTS

  if (secretOnly) {
    gpgCommand += " --list-secret-keys --with-colons";  }
  else {
    gpgCommand += " --list-keys --with-colons";
  }

  if (!this.initialized) {
    errorMsgObj.value = EnigGetString("notInit");
    return "";
  }

  statusFlagsObj.value = 0;

  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();

  var userList = gEnigmailSvc.execCmd(gpgCommand, null, "",
                    exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

  if (exitCodeObj.value != 0) {
    errorMsgObj.value = EnigGetString("badCommand");
    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n" + gpgCommand;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    return "";
  }

  return userList;


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
  var asciiArmor = false;
  try {
    asciiArmor = this.prefBranch.getBoolPref("inlineAttachAsciiArmor");
  } catch (ex) {}
  var gpgCommand = this.getEncryptCommand(fromMailAddr, toMailAddr, "", sendFlags, asciiArmor, errorMsgObj);

  if (! gpgCommand)
      return null;

  var passphrase = null;
  var signMessage = (sendFlags & nsIEnigmail.SEND_SIGNED);

  if (signMessage ) {
    gpgCommand += this.passwdCommand();

    var passwdObj = new Object();

    if (!GetPassphrase(parent, sendFlags, passwdObj)) {
       ERROR_LOG("enigmail.js: Enigmail.encryptAttachment: Error - no passphrase supplied\n");

       statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
       return null;
    }

    passphrase = passwdObj.value;
  }

  // escape the backslashes (mainly for Windows)
  inFile = inFile.replace(/\\/g, "\\\\");
  outFile = outFile.replace(/\\/g, "\\\\");

  gpgCommand += " --yes -o '" + outFile + "' '" + inFile + "'";


  var statusMsgObj   = new Object();
  var cmdErrorMsgObj = new Object();

  var msg = gEnigmailSvc.execCmd(gpgCommand, passphrase, "",
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
function (parent, outFileName, inputBuffer,
          exitCodeObj, statusFlagsObj, errorMsgObj) {
  WRITE_LOG("enigmail.js: Enigmail.decryptAttachment: parent="+parent+", outFileName="+outFileName+"\n");

  var command = this.agentPath;

  outFileName = outFileName.replace(/\\/g, "\\\\");

  command += GPG_BATCH_OPTS + " -o '"+outFileName+"' --yes " + this.passwdCommand() + " -d ";


  statusFlagsObj.value = 0;

  var passphrase = null;
  var passwdObj = new Object();

  if (!GetPassphrase(parent, 0, passwdObj)) {
    ERROR_LOG("enigmail.js: Enigmail.decryptAttachment: Error - no passphrase supplied\n");

    statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
    return null;
  }

  passphrase = passwdObj.value;

  var statusFlagsObj = new Object();
  var noProxy = true;

  var ipcBuffer = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
  ipcBuffer.open(MSG_BUFFER_SIZE, false);

  var pipeTrans = this.execStart(command, false, parent, 0,
                                 ipcBuffer, noProxy, statusFlagsObj);


  if (!pipeTrans) {
    return false;
  }

  var inStream;
  try {
    pipeTrans.writeSync(passphrase, passphrase.length);
    pipeTrans.writeSync("\n", 1);
    var dataLength = inputBuffer.totalBytes;

    //pipeTrans.writeSync(inputBuffer.getByteData(wroteLength), dataLength);
    inStream=inputBuffer.openInputStream();
    pipeTrans.writeAsync(inStream, dataLength, true);
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
