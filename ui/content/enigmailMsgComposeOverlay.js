// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon();

window.addEventListener("load", enigMsgComposeStartup, false);

var gEditorElement, gEditorShell;

var gEnigProcessed = false;

var gOrigSendButton, gEnigSendButton;

function enigMsgComposeStartup() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");
   gOrigSendButton = document.getElementById("button-send");
   gOrigSendButton.setAttribute("collapsed", "true");

   gEnigSendButton = document.getElementById("button-enigmail-send");

   // Get editor shell
   gEditorElement = document.getElementById("content-frame");
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorElement = "+gEditorElement+"\n");

   gEditorShell = gEditorElement.editorShell;
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorShell = "+gEditorShell+"\n");

   enigUpdateOptionsDisplay();
}

function enigUpdateOptionsDisplay() {
  if (!InitEnigmailSvc())
     return "";

   var optList = ["encryptMsg", "signMsg"];

   for (var j=0; j<optList.length; j++) {
     var optName = optList[j];
     var menuElement = document.getElementById("enigmail_"+optName);

     if (gEnigmailSvc[optName]) {
       menuElement.setAttribute("checked", "true");
     } else {
       menuElement.setAttribute("checked", "false");
     }
   }
}

function enigSend() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend\n");

  if (!InitEnigmailSvc()) {
     if (EnigConfirm("Failed to initialize Enigmail; send unencrypted email?\n"))
        goDoCommand('cmd_sendButton');

     EnigAlert("Please uninstall Enigmail using the Edit->Preferences->Privacy&Security->Enigmail menu to avoid this alert in the future");

     return;
  }

  var currentId = getCurrentIdentity();
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: currentId="+currentId+
            ", "+currentId.email+"\n");

  if (!gEnigProcessed && (gEnigmailSvc.encryptMsg || gEnigmailSvc.signMsg)) {
    var msgCompFields = msgCompose.compFields;
    Recipients2CompFields(msgCompFields);

    var toAddr = msgCompFields.to;
    if (msgCompFields.cc)  toAddr += ", "+msgCompFields.cc;
    if (msgCompFields.bcc) toAddr += ", "+msgCompFields.bcc;

    // Remove all quoted strings from to addresses
    var qStart, qEnd;
    while ((qStart = toAddr.indexOf('"')) != -1) {
       qEnd = toAddr.indexOf('"', qStart+1);
       if (qEnd == -1) {
         ERROR_LOG("enigmailMsgComposeOverlay.js: Unmatched quote in To address\n");
       throw Components.results.NS_ERROR_FAILURE;
       }

       toAddr = toAddr.substring(0,qStart) + toAddr.substring(qEnd+1);
    }

    // Eliminate all whitespace, just to be safe
    toAddr = toAddr.replace(/\s+/g,"");

    // Extract pure e-mail address list (stripping out angle brackets)
    toAddr = toAddr.replace(/(^|,)[^,]*<([^>]+)>[^,]*(,|$)/g,"$1$2$3");

    editorDoc = gEditorShell.editorDocument;
    DEBUG_LOG("enigmailMsgComposeOverlay.js: editorDoc = "+editorDoc+"\n");
    EnigDumpHTML(editorDoc.documentElement);

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

    var statusCodeObj = new Object();
    var statusMsgObj = new Object();
    var cipherText;

    cipherText = EnigEncryptMessage(plainText, toAddr,
                                    statusCodeObj, statusMsgObj);

    var statusCode = statusCodeObj.value;
    var statusMsg  = statusMsgObj.value;

    if (statusCode != 0) {
      EnigAlert("Error in encrypting and/or signing message. Send operation aborted.\n"+statusMsg);
      return;
    }

    gEditorShell.SelectAll();

    gEditorShell.DeleteSelection(directionFlags);

    gEditorShell.InsertText(cipherText);

    //if (!EnigConfirm("enigmailMsgComposeOverlay.js: Sending encrypted/signed message to "+toAddr+"\n")) return;

    gEnigProcessed = true;
  }

  goDoCommand('cmd_sendButton');
}


function enigToggleAttribute(attrName)
{
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigToggleAttribute('"+attrName+"')\n");

  if (!InitEnigmailSvc())
     return "";

  var menuElement = document.getElementById("enigmail_"+attrName);

  gEnigmailSvc[attrName] = !gEnigmailSvc[attrName];

  enigUpdateOptionsDisplay();

  if (gEnigmailSvc.encryptMsg || gEnigmailSvc.signMsg) {
    gEnigSendButton.removeAttribute("collapsed");
    gOrigSendButton.setAttribute("collapsed", "true");

  } else {
    gOrigSendButton.removeAttribute("collapsed");
    gEnigSendButton.setAttribute("collapsed", "true");
  }

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
