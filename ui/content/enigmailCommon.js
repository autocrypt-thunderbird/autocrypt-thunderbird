// enigmailCommon.js: shared JS functions for Enigmail

const NS_IPCSERVICE_CONTRACTID = "@mozilla.org/process/ipc-service;1";
const NS_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";
const ENIGMAIL_PREFS_ROOT      = "extensions.enigmail.";

var gIPCService;
try {
  gIPCService = Components.classes[NS_IPCSERVICE_CONTRACTID].getService();
  gIPCService = gIPCService.QueryInterface(Components.interfaces.nsIIPCService);

} catch (ex) {
}

var gEnigmailSvc;
try {
  gEnigmailSvc = Components.classes[NS_ENIGMAIL_CONTRACTID].createInstance();
  gEnigmailSvc = gEnigmailSvc.QueryInterface(Components.interfaces.nsIEnigmail);

} catch (ex) {
}

dump("enigmailCommon.js: gIPCService = "+gIPCService+"\n");
dump("enigmailCommon.js: gEnigmailSvc = "+gEnigmailSvc+"\n");

var gLogLevel = 5;     // Output only errors/warnings by default
var gLogFileStream = null;

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

  WRITE_LOG("enigmailCommon.js: WriteFileContents: file="+filePath+"\n");

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

if (gLogLevel >= 4)
  gLogFileStream = CreateFileStream("enigdbg2.txt");

function EnigAlert(mesg) {
  return window.prompter.alert("Enigmail Alert", mesg);
}

function EnigConfirm(mesg) {
  return window.prompter.confirm("Enigmail Confirm", mesg);
}

function EnigError(mesg) {
  return window.prompter.alert("Enigmail Error", mesg);
}

function EnigPassphrase() {
  var passwdObj = new Object();
  var checkObj = new Object();

  var promptMsg = "Please type in your "+gEnigmailSvc.agentType.toUpperCase()+" passphrase";
  passwdObj.value = "";
  checkObj.value = false;
  var success = window.prompter.promptPassword("Enigmail",
                               promptMsg,
                               passwdObj,
                               "Check box to remember passphrase for this session (INSECURE)",
                               checkObj);
  if (!success)
    return "";

  // Null string password is always remembered
  if (checkObj.value || (passwdObj.value.length == 0))
    gEnigmailSvc.setDefaultPassphrase(passwdObj.value);

  WRITE_LOG("enigmailCommon.js: EnigPassphrase: "+passwdObj.value+"\n");

  return passwdObj.value;
}

function EnigEncryptMessage(plainText, toMailAddr, statusCodeObj, statusMsgObj) {
  WRITE_LOG("enigmailCommon.js: EnigEncryptMessage: To "+toMailAddr+"\n");

  var passphrase = null;
  if (!gEnigmailSvc.haveDefaultPassphrase)
    passphrase = EnigPassphrase();

  var cipherText = gEnigmailSvc.encryptMessage(plainText, toMailAddr,
	                                       passphrase,
                                               statusCodeObj, statusMsgObj);

  return cipherText;
}

function EnigDecryptMessage(cipherText, statusCodeObj, statusMsgObj) {
  WRITE_LOG("enigmailCommon.js: EnigDecryptMessage: \n");

  var passphrase = null;
  if (!gEnigmailSvc.haveDefaultPassphrase)
    passphrase = EnigPassphrase();

  var plainText = gEnigmailSvc.decryptMessage(cipherText, passphrase,
                                              statusCodeObj, statusMsgObj);

  return plainText;
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
    WRITE_LOG("enigmailCommon.js: RequestObserver.onStartRequest\n");
  },

  onStopRequest: function (channel, ctxt, status)
  {
    WRITE_LOG("enigmailCommon.js: RequestObserver.onStopRequest\n");
    this._terminateFunc(this._terminateArg);
  }
}

function EnigGetDeepText(node) {
  if (node.nodeType == Node.TEXT_NODE) {
    //WRITE_LOG(node.data);
    return node.data;
  }

  var text = "";

  if (node.hasChildNodes()) {
    // Loop over the children
    var children = node.childNodes;
    for (var count = 0; count < children.length; count++) {
      WRITE_LOG("<"+node.tagName+">\n");
      text += EnigGetDeepText(children[count]);
      //WRITE_LOG("</"+node.tagName+">\n");
    }
  }

  return text;
}

// Dump HTML content as plain text
function EnigDumpHTML(node)
{
    var type = node.nodeType;
    if (type == Node.ELEMENT_NODE) {

        // open tag
        WRITE_LOG("<" + node.tagName)

        // dump the attributes if any
        attributes = node.attributes;
        if (null != attributes) {
            var countAttrs = attributes.length;
            var index = 0
            while(index < countAttrs) {
                att = attributes[index];
                if (null != att) {
                    WRITE_LOG(" "+att.name+"='"+att.value+"'")
                }
                index++
            }
        }

        // close tag
        WRITE_LOG(">")

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
            WRITE_LOG("</" + node.tagName + ">");
        }


    }
    // if it's a piece of text just dump the text
    else if (type == Node.TEXT_NODE) {
        WRITE_LOG(node.data)
    }

    WRITE_LOG("\n\n")
}


function EnigTest() {
  var plainText = "TEST MESSAGE 123\n";
  var toMailAddr = "r_sarava@yahoo.com";

  var statusCodeObj = new Object();
  var statusMsgObj = new Object();

  var cipherText = EnigEncryptMessage(plainText, toMailAddr,
                                      statusCodeObj, statusMsgObj);
  WRITE_LOG("enigmailCommon.js: enigTest: cipherText = "+cipherText+"\n");
  WRITE_LOG("enigmailCommon.js: enigTest: statusCode = "+statusCodeObj.value+"\n");
  WRITE_LOG("enigmailCommon.js: enigTest: statusMsg = "+statusMsgObj.value+"\n");

  var statusCodeObj = new Object();
  var statusMsgObj = new Object();

  var decryptedText = EnigDecryptMessage(cipherText,
                                         statusCodeObj, statusMsgObj);
  WRITE_LOG("enigmailCommon.js: enigTest: decryptedText = "+decryptedText+"\n");
  WRITE_LOG("enigmailCommon.js: enigTest: statusCode = "+statusCodeObj.value+"\n");
  WRITE_LOG("enigmailCommon.js: enigTest: statusMsg = "+statusMsgObj.value+"\n");
}
