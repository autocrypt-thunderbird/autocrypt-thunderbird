// Uses: chrome://enigmail/content/enigmailCommon.js

window.addEventListener("load", enigMsgComposeStartup, false);

var gEditorElement, gEditorShell;

var gEnigProcessed = false;

var gOrigSendButton, gEnigSendButton;

function enigMsgComposeStartup() {
   WRITE_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");
   gOrigSendButton = document.getElementById("button-send");
   gOrigSendButton.setAttribute("collapsed", "true");

   gEnigSendButton = document.getElementById("button-enigmail-send");

   // Get editor shell
   gEditorElement = document.getElementById("content-frame");
   WRITE_LOG("enigmailMsgComposeOverlay.js: gEditorElement = "+gEditorElement+"\n");

   gEditorShell = gEditorElement.editorShell;
   WRITE_LOG("enigmailMsgComposeOverlay.js: gEditorShell = "+gEditorShell+"\n");
}

function enigSend() {
  WRITE_LOG("enigmailMsgComposeOverlay.js: enigSend\n");

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
    WRITE_LOG("enigmailMsgComposeOverlay.js: editorDoc = "+editorDoc+"\n");
    EnigDumpHTML(editorDoc.documentElement);

    // Get plain text
    // (Do we need to set flags to nsIDocumentEncoder::OutputRaw?)
    var encoderFlags = 0;   // nsIDocumentEncode::*
    var plainText = gEditorShell.GetContentsAs("text/plain", encoderFlags)
    WRITE_LOG("enigmailMsgComposeOverlay.js: plainText = '"+plainText+"'\n");

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

    var directionFlags = 0;   // see nsIEditor.h

    gEditorShell.DeleteSelection(directionFlags);

    gEditorShell.InsertText(cipherText);

    gEnigProcessed = true;
  }

  goDoCommand('cmd_sendButton');
}


function enigToggleAttribute(attrName)
{
  WRITE_LOG("enigmailMsgComposeOverlay.js: enigToggleAttribute('"+attrName+"')\n");

  var menuElement = document.getElementById("enigmail_"+attrName);

  if (gEnigmailSvc[attrName]) {
    gEnigmailSvc[attrName] = false;
    menuElement.setAttribute("checked", "false");
  } else {
    gEnigmailSvc[attrName] = true;
    menuElement.setAttribute("checked", "true");
  }

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
    WRITE_LOG("enigmailMsgComposeOverlay.js: QI\n");

    if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
        !iid.equals(Components.interfaces.nsISupports))
       throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  NotifyDocumentCreated: function ()
  {
    WRITE_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentCreated\n");
  },

  NotifyDocumentWillBeDestroyed: function ()
  {
  },

  NotifyDocumentStateChanged: function (nowDirty)
  {
    WRITE_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged\n");
  }
}
