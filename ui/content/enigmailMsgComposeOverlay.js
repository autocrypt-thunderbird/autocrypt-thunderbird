// enigmailMsgComposeOverlay.js

window.addEventListener("load", enigMsgComposeStartup, false);

var gEditorElement, gEditorShell;

var gEnigProcessed = false;

function enigMsgComposeStartup() {
   dump("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");
   var origSendButton = document.getElementById("button-send");
   origSendButton.setAttribute("collapsed", "true");

   // Get editor shell
   gEditorElement = document.getElementById("content-frame");
   dump("enigmailMsgComposeOverlay.js: gEditorElement = "+gEditorElement+"\n");

   gEditorShell = gEditorElement.editorShell;
   dump("enigmailMsgComposeOverlay.js: gEditorShell = "+gEditorShell+"\n");
}

function enigSend() {
  dump("enigmailMsgComposeOverlay.js: enigSend\n");

  if (!gEnigProcessed) {
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
    dump("enigmailMsgComposeOverlay.js: editorDoc = "+editorDoc+"\n");
    EnigDumpHTML(editorDoc.documentElement);

    // Get plain text
    // (Do we need to set flags to nsIDocumentEncoder::OutputRaw?)
    var encoderFlags = 0;   // nsIDocumentEncode::*
    var plainText = gEditorShell.GetContentsAs("text/plain", encoderFlags)
    dump("enigmailMsgComposeOverlay.js: plainText = '"+plainText+"'\n");

    var statusLineObj = new Object();
    var cipherText = EnigEncryptMessage(plainText, toAddr, statusLineObj);

    gEditorShell.SelectAll();

    var directionFlags = 0;   // see nsIEditor.h

    gEditorShell.DeleteSelection(directionFlags);

    gEditorShell.InsertText(cipherText);

    gEnigProcessed = true;
  }

  goDoCommand('cmd_sendButton');
}


function DocumentStateListener()
{
}

DocumentStateListener.prototype = {

  QueryInterface: function (iid) {
    dump("enigmailMsgComposeOverlay.js: QI\n");

    if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
        !iid.equals(Components.interfaces.nsISupports))
       throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  NotifyDocumentCreated: function ()
  {
    dump("enigmailMsgComposeOverlay.js: NotifyDocumentCreated\n");
  },

  NotifyDocumentWillBeDestroyed: function ()
  {
  },

  NotifyDocumentStateChanged: function (nowDirty)
  {
    dump("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged\n");
  }
}
