// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgComposeOverlay");

window.addEventListener("load", enigMsgComposeStartup, false);

var gEditorElement, gEditorShell;

var gEnigProcessed = false;

var gOrigSendButton, gEnigSendButton;

function enigMsgComposeStartup() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");
   gOrigSendButton = document.getElementById("button-send");
   gEnigSendButton = document.getElementById("button-enigmail-send");

   // Get editor shell
   gEditorElement = document.getElementById("content-frame");
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorElement = "+gEditorElement+"\n");

   gEditorShell = gEditorElement.editorShell;
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorShell = "+gEditorShell+"\n");

   enigUpdateOptionsDisplay();
}

function enigUpdateOptionsDisplay() {
   var optList = ["defaultEncryptMsg", "defaultSignMsg"];

   var signOrEncrypt = false;

   for (var j=0; j<optList.length; j++) {
     var optName = optList[j];
     var optValue = EnigGetPref(optName);

     if (optValue && ((optName == "defaultEncryptMsg") ||
                      (optName == "defaultSignMsg")) )
       signOrEncrypt = true;

     var menuElement = document.getElementById("enigmail_"+optName);

     menuElement.setAttribute("checked", optValue ? "true" : "false");
   }

   if (signOrEncrypt) {
      gEnigSendButton.removeAttribute("collapsed");
      gOrigSendButton.setAttribute("collapsed", "true");

   } else {
      gOrigSendButton.removeAttribute("collapsed");
      gEnigSendButton.setAttribute("collapsed", "true");
   }
}

function enigSend(encryptFlags) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: "+encryptFlags+"\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     if (EnigConfirm("Failed to initialize Enigmail; send unencrypted email?\n"))
        goDoCommand('cmd_sendButton');

     return;
  }

  try {
     var currentId = getCurrentIdentity();
     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: currentId="+currentId+
               ", "+currentId.email+"\n");

     if (encryptFlags == null) {

       encryptFlags = 0;

       if (EnigGetPref("defaultSignMsg"))
         encryptFlags |= SIGN_MESSAGE;

       if (EnigGetPref("defaultEncryptMsg"))
         encryptFlags |= ENCRYPT_MESSAGE;
     }

     if (!gEnigProcessed && encryptFlags) {
    
       var msgCompFields = gMsgCompose.compFields;
       Recipients2CompFields(msgCompFields);

       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: gMsgCompose="+gMsgCompose+"\n");
       var toAddr = msgCompFields.to;
       if (msgCompFields.cc)  toAddr += ", "+msgCompFields.cc;
       if (msgCompFields.bcc) toAddr += ", "+msgCompFields.bcc;
    
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: toAddr="+toAddr+"\n");

       editorDoc = gEditorShell.editorDocument;
       DEBUG_LOG("enigmailMsgComposeOverlay.js: editorDoc = "+editorDoc+"\n");

       ///EnigDumpHTML(editorDoc.documentElement);
    
       // Get plain text
       // (Do we need to set nsIDocumentEncoder::* flags?)
       var encoderFlags = 16;   // OutputPreformatted
       var docText = gEditorShell.GetContentsAs("text/plain", encoderFlags)
       DEBUG_LOG("enigmailMsgComposeOverlay.js: docText["+encoderFlags+"] = '"+docText+"'\n");
    
       // Prevent space stuffing a la RFC 2646 (format=flowed).
       RegExp.multiline = true;
       docText = docText.replace(/^>/g, "|");
       docText = docText.replace(/^ /g, "~ ");
       docText = docText.replace(/^From /g, "~From ");
       RegExp.multiline = false;
    
       DEBUG_LOG("enigmailMsgComposeOverlay.js: docText = '"+docText+"'\n");
       var directionFlags = 0;   // see nsIEditor.h
    
       gEditorShell.SelectAll();
    
       gEditorShell.DeleteSelection(directionFlags);
    
       gEditorShell.InsertText(docText);
    
       encoderFlags = 32;   // OutputWrap
       var plainText = gEditorShell.GetContentsAs("text/plain", encoderFlags)
       DEBUG_LOG("enigmailMsgComposeOverlay.js: plainText["+encoderFlags+"] = '"+plainText+"'\n");
    
       var cipherText;

       var fromAddr = currentId.email;

       var userIdSource = EnigGetPref("userIdSource");
       DEBUG_LOG("enigmailMsgComposeOverlay.js: userIdSource = "+userIdSource+"\n");

       if (userIdSource == USER_ID_DEFAULT) {
         fromAddr = "";

       } else if (userIdSource == USER_ID_SPECIFIED) {
         fromAddr = EnigGetPref("userIdValue");
       }

       if (EnigGetPref("alwaysTrustSend"))
         encryptFlags |= ALWAYS_TRUST_SEND;

       if (EnigGetPref("encryptToSelf")) {
         encryptFlags |= ENCRYPT_TO_SELF;
         fromAddr = currentId.email;
       }

       var exitCodeObj = new Object();
       var errorMsgObj = new Object();
       cipherText = EnigEncryptMessage(plainText, fromAddr, toAddr,
                                       encryptFlags,
                                       exitCodeObj, errorMsgObj);

       var exitCode = exitCodeObj.value;
       var errorMsg = errorMsgObj.value;
    
       if (exitCode != 0) {
         EnigAlert("Error in encrypting and/or signing message. Send operation aborted.\n"+errorMsg);
         return;
       }
    
       gEditorShell.SelectAll();
    
       gEditorShell.DeleteSelection(directionFlags);
    
       gEditorShell.InsertText(cipherText);
    
       //if (!EnigConfirm("enigmailMsgComposeOverlay.js: Sending encrypted/signed message to "+toAddr+"\n")) return;
    
       gEnigProcessed = true;
     }
    
     goDoCommand('cmd_sendButton');

  } catch (ex) {
     if (EnigConfirm("Error in Enigmail; Encryption/signing failed; send unencrypted email?\n"))
        goDoCommand('cmd_sendButton');
  }
}


function enigToggleAttribute(attrName)
{
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigToggleAttribute('"+attrName+"')\n");

  var menuElement = document.getElementById("enigmail_"+attrName);

  var oldValue = EnigGetPref(attrName);
  EnigSetPref(attrName, !oldValue);

  enigUpdateOptionsDisplay();
}

function DocumentStateListener()
{
}

DocumentStateListener.prototype = {

  QueryInterface: function (iid) {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: QI\n");

    if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
        !iid.equals(Components.interfaces.nsISupports))
       throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  NotifyDocumentCreated: function ()
  {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentCreated\n");
  },

  NotifyDocumentWillBeDestroyed: function ()
  {
  },

  NotifyDocumentStateChanged: function (nowDirty)
  {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged\n");
  }
}
