// enigmailCommon.js: shared JS functions for Enigmail

const NS_IPCSERVICE_CONTRACTID = "@mozilla.org/protozilla/ipc-service;1";
const NS_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";

var gIPCService;
try {
  gIPCService = Components.classes[NS_IPCSERVICE_CONTRACTID].createInstance();
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

var gLogLevel = 3;     // Output only errors/warnings by default

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

  passwdObj.value = "";
  checkObj.value = false;
  var success = window.prompter.promptPassword("Enigmail",
                               "Please type in your PGP/GPG passphrase",
                               passwdObj,
                               "Check box to remember password for this session (INSECURE)",
                               checkObj);
  if (!success)
    return "";

  // Null password is always remembered
  if (checkObj.value || (passwdObj.value.length == 0))
    gEnigmailSvc.setDefaultPassphrase(passwdObj.value);

  dump("enigmailCommon.js: EnigPassphrase: "+passwdObj.value+"\n");

  return passwdObj.value;
}

function EnigEncryptMessage(plainText, toMailAddr) {
  dump("enigmailCommon.js: EnigEncryptMessage: To "+toMailAddr+"\n");

  var passphrase = null;
  if (!gEnigmailSvc.haveDefaultPassphrase)
    passphrase = EnigPassphrase();

  var cipherText = gEnigmailSvc.encryptMessage(plainText, toMailAddr,
	                                       passphrase);

  return cipherText;
}

function EnigDecryptMessage(cipherText) {
  dump("enigmailCommon.js: EnigDecryptMessage: \n");

  var passphrase = null;

  dump("enigmailCommon.js: EnigDecryptMessage: "+gEnigmailSvc.haveDefaultPassphrase+"\n");
  if (!gEnigmailSvc.haveDefaultPassphrase)
    passphrase = EnigPassphrase();

  var plainText = gEnigmailSvc.decryptMessage(cipherText,
                                              passphrase);

  return plainText;
}

function EnigSignClearText(plainText) {
  dump("enigmailCommon.js: EnigSignClearText: \n");

  var signedText;

  signedText = "*** SIGNED ***\n"+plainText;

  return signedText;
}

function EnigGetDeepText(node) {
  if (node.nodeType == Node.TEXT_NODE) {
    //dump(node.data);
    return node.data;
  }

  var text = "";

  if (node.hasChildNodes()) {
    // Loop over the children
    var children = node.childNodes;
    for (var count = 0; count < children.length; count++) {
      dump("<"+node.tagName+">\n");
      text += EnigGetDeepText(children[count]);
      //dump("</"+node.tagName+">\n");
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
        dump("<" + node.tagName)

        // dump the attributes if any
        attributes = node.attributes;
        if (null != attributes) {
            var countAttrs = attributes.length;
            var index = 0
            while(index < countAttrs) {
                att = attributes[index];
                if (null != att) {
                    dump(" " + att.value)
                }
                index++
            }
        }

        // close tag
        dump(">")

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
            dump("</" + node.tagName + ">");
        }


    }
    // if it's a piece of text just dump the text
    else if (type == Node.TEXT_NODE) {
        dump(node.data)
    }

    dump("\n\n")
}


function EnigTest() {
  var plainText = "TEST MESSAGE 123\n";
  var toMailAddr = "r_sarava@yahoo.com";

  var cipherText = EnigEncryptMessage(plainText, toMailAddr);
  dump("enigmailCommon.js: enigTest: cipherText = "+cipherText+"\n");

  var decryptedText = EnigDecryptMessage(cipherText);
  dump("enigmailCommon.js: enigTest: decryptedText = "+decryptedText+"\n");
}
