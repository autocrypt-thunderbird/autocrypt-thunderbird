// Uses: chrome://enigmail/content/enigmailCommon.js

// nsIDocumentEncoder.h:
const OutputSelectionOnly = 1;
const OutputFormatted     = 2;
const OutputRaw           = 4;
const OutputPreformatted  = 16;
const OutputWrap          = 32;
const OutputFormatFlowed  = 64;
const OutputCRLineBreak   = 512;
const OutputLFLineBreak   = 1024;

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgComposeOverlay");

window.addEventListener("load", enigMsgComposeStartup, false);

var gDecryptTimeoutID;

var gEditorElement, gEditorShell;

var gEnigProcessed = null;

var gOrigSendButton, gEnigSendButton, gUndoMenuItem;

function enigMsgComposeStartup() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");
   gDecryptTimeoutID = null;

   gOrigSendButton = document.getElementById("button-send");
   gEnigSendButton = document.getElementById("button-enigmail-send");

   gUndoMenuItem = document.getElementById("enigmail_undo_encryption");
   gUndoMenuItem.setAttribute("disabled", "true");

   // Get editor shell
   gEditorElement = document.getElementById("content-frame");
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorElement = "+gEditorElement+"\n");

   gEditorShell = gEditorElement.editorShell;
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorShell = "+gEditorShell+"\n");
   var docStateListener = new DocumentStateListener();
   gEditorShell.RegisterDocumentStateListener(docStateListener);

   enigUpdateOptionsDisplay();
}

function enigUpdateOptionsDisplay() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUpdateOptionsDisplay: \n");
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

function enigUndoEncryption() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUndoEncryption: \n");

  if (gEnigProcessed) {
    
    gEditorShell.SelectAll();
  
    var directionFlags = 0;   // see nsIEditor.h
    gEditorShell.DeleteSelection(directionFlags);
  
    gEditorShell.InsertText(gEnigProcessed.plainText);

    gEnigProcessed = null;

    gUndoMenuItem.setAttribute("disabled", "true");
  }
}

function enigSend(encryptFlags) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: "+encryptFlags+"\n");

  if (gWindowLocked) {
    EnigAlert("Compose window is locked; send cancelled\n");
    return;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     if (EnigConfirm("Failed to initialize Enigmail.\nSend unencrypted email?"))
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
       var encoderFlags = OutputFormatted;
       var docText = gEditorShell.GetContentsAs("text/plain", encoderFlags);
       DEBUG_LOG("enigmailMsgComposeOverlay.js: docText["+encoderFlags+"] = '"+docText+"'\n");

       var sendFlowed;
       try {
         sendFlowed = gPrefMailNews.getBoolPref("send_plaintext_flowed");
       } catch (ex) {
         sendFlowed = true;
       }

       if (sendFlowed) {
         // Prevent space stuffing a la RFC 2646 (format=flowed).

         // MULTILINE MATCHING ON
         RegExp.multiline = true;

         docText = docText.replace(/^>/g, "|");
         docText = docText.replace(/^ /g, "~ ");
         docText = docText.replace(/^From /g, "~From ");

         // MULTILINE MATCHING OFF
         RegExp.multiline = false;
       }
    
       DEBUG_LOG("enigmailMsgComposeOverlay.js: docText = '"+docText+"'\n");
    
       gEditorShell.SelectAll();
    
       var directionFlags = 0;   // see nsIEditor.h
       gEditorShell.DeleteSelection(directionFlags);
    
       gEditorShell.InsertText(docText);
    
       encoderFlags = OutputWrap | OutputCRLineBreak | OutputLFLineBreak;

       var plainText = gEditorShell.GetContentsAs("text/plain", encoderFlags);
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
       var uiFlags = UI_INTERACTIVE;
       cipherText = enigmailSvc.encryptMessage(window, uiFlags, plainText,
                                               fromAddr, toAddr, encryptFlags,
                                               exitCodeObj, errorMsgObj);

       var exitCode = exitCodeObj.value;
       var errorMsg = errorMsgObj.value;
    
       if (exitCode != 0) {
         EnigAlert("Error in encrypting and/or signing message. Send operation aborted.\n"+errorMsg);
         return;
       }
    
       gEditorShell.SelectAll();
    
       gEditorShell.InsertText(cipherText);
    
       gEnigProcessed = {"plainText":plainText};

       gUndoMenuItem.removeAttribute("disabled");
     }
    
     if (EnigGetPref("confirmBeforeSend")) {
       if (!EnigConfirm("Send message to "+toAddr+"?\n"))
         return;
     }
    
     enigGenericSendMessage(gIsOffline ? nsIMsgCompDeliverMode.Later
                                       : nsIMsgCompDeliverMode.Now);

  } catch (ex) {
     if (EnigConfirm("Error in Enigmail; Encryption/signing failed; send unencrypted email?\n"))
       goDoCommand('cmd_sendButton');
  }
}

/////////////////////////////////////////////////////////////////////////
// Call the following function from our version of the function
// GenericSendMessage from the file MsgComposeCommands.js
// (after the calls to Recipients2CompFields and Attachements2CompFields)
/////////////////////////////////////////////////////////////////////////
function enigModifyCompFields(msgCompFields) {
  var enigmailHeaders = "X-Enigmail-Version: "+gEnigmailVersion+"\r\n";
  msgCompFields.otherRandomHeaders += enigmailHeaders;

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigModifyCompFields: otherRandomHeaders = "+
           msgCompFields.otherRandomHeaders+"\n");
}


function enigGenericSendMessage( msgType )
{
  dump("enigGenericSendMessage from XUL\n");

  dump("Identity = " + getCurrentIdentity() + "\n");

  if (gMsgCompose != null)
  {
      var msgCompFields = gMsgCompose.compFields;
      if (msgCompFields)
      {
      Recipients2CompFields(msgCompFields);
      var subject = document.getElementById("msgSubject").value;
      msgCompFields.subject = subject;
      Attachments2CompFields(msgCompFields);

/////////////////////////////////////////////////////////////////////////
// Call the following function from our version of the function
// GenericSendMessage from the file MsgComposeCommands.js
// (after the calls to Recipients2CompFields and Attachements2CompFields)
/////////////////////////////////////////////////////////////////////////
      enigModifyCompFields(msgCompFields);
/////////////////////////////////////////////////////////////////////////

      if (msgType == nsIMsgCompDeliverMode.Now || msgType == nsIMsgCompDeliverMode.Later)
      {
        //Do we need to check the spelling?
        if (sPrefs.getBoolPref("mail.SpellCheckBeforeSend"))
          goDoCommand('cmd_spelling');

        //Check if we have a subject, else ask user for confirmation
        if (subject == "")
        {
          if (gPromptService)
          {
            var result = {value:sComposeMsgsBundle.getString("defaultSubject")};
            if (gPromptService.prompt(
              window,
              sComposeMsgsBundle.getString("subjectDlogTitle"),
              sComposeMsgsBundle.getString("subjectDlogMessage"),
                        result,
              null,
              {value:0}
              ))
              {
                msgCompFields.subject = result.value;
                var subjectInputElem = document.getElementById("msgSubject");
                subjectInputElem.value = result.value;
              }
              else
                return;
            }
          }

        // Before sending the message, check what to do with HTML message, eventually abort.
        var convert = DetermineConvertibility();
        var action = DetermineHTMLAction(convert);
        if (action == nsIMsgCompSendFormat.AskUser)
        {
                    var recommAction = convert == nsIMsgCompConvertible.No
                                   ? nsIMsgCompSendFormat.AskUser
                                   : nsIMsgCompSendFormat.PlainText;
                    var result2 = {action:recommAction,
                                  convertible:convert,
                                  abort:false};
                    window.openDialog("chrome://messenger/content/messengercompose/askSendFormat.xul",
                                      "askSendFormatDialog", "chrome,modal,titlebar,centerscreen",
                                      result2);
          if (result2.abort)
            return;
          action = result2.action;
        }
        switch (action)
        {
          case nsIMsgCompSendFormat.PlainText:
            msgCompFields.forcePlainText = true;
            msgCompFields.useMultipartAlternative = false;
            break;
          case nsIMsgCompSendFormat.HTML:
            msgCompFields.forcePlainText = false;
            msgCompFields.useMultipartAlternative = false;
            break;
          case nsIMsgCompSendFormat.Both:
            msgCompFields.forcePlainText = false;
            msgCompFields.useMultipartAlternative = true;
            break;
           default: dump("\###SendMessage Error: invalid action value\n"); return;
        }
      }
      try {
        gWindowLocked = true;
        CommandUpdate_MsgCompose();
        disableEditableFields();

        var progress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
        if (progress)
        {
          progress.registerListener(progressListener);
          gSendOrSaveOperationInProgress = true;
        }
        gMsgCompose.SendMsg(msgType, getCurrentIdentity(), progress);
      }
      catch (ex) {
        dump("failed to SendMsg: " + ex + "\n");
        gWindowLocked = false;
        enableEditableFields();
        CommandUpdate_MsgCompose();
      }
    }
  }
  else
    dump("###SendMessage Error: composeAppCore is null!\n");
}


function enigToggleAttribute(attrName)
{
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigToggleAttribute('"+attrName+"')\n");

  var menuElement = document.getElementById("enigmail_"+attrName);

  var oldValue = EnigGetPref(attrName);
  EnigSetPref(attrName, !oldValue);

  enigUpdateOptionsDisplay();
}

function enigDecryptQuote() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote\n");

  if (gWindowLocked || gEnigProcessed)
    return;

  var encoderFlags = OutputPreformatted | OutputLFLineBreak;

  var docText = gEditorShell.GetContentsAs("text/plain", encoderFlags);

  if (docText.indexOf("-----BEGIN PGP MESSAGE-----") < 0)
    return;

  var beginIndex = docText.search(/>\s*-----BEGIN PGP MESSAGE-----/);
  var endIndex   = docText.search(/>\s*-----END PGP MESSAGE-----/)
  if (endIndex > -1)
    endIndex = docText.indexOf("\n", endIndex);

  if ((beginIndex < 0)|| (endIndex < 0) || (beginIndex >= endIndex))
    return;

  var head = docText.substr(0, beginIndex);
  var tail = docText.substr(endIndex+1);

  var pgpBlock = docText.substr(beginIndex, endIndex-beginIndex+1);

  var matches = pgpBlock.match(/(>\s*)-----BEGIN PGP MESSAGE-----/);

  var indentStr = "> ";
  if (matches && (matches.length > 1)) {
    indentStr = matches[1];
  }
  
  pgpBlock = pgpBlock.replace(/>[ \t]*/g, "");

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: pgpBlock='"+pgpBlock+"'\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();
  var signatureObj = new Object();
  signatureObj.value = "";

  var uiFlags = UI_INTERACTIVE;
  var plainText = enigmailSvc.decryptMessage(window, uiFlags, pgpBlock,
                                     exitCodeObj, errorMsgObj, signatureObj);
  var exitCode = exitCodeObj.value;

  if (!plainText || (exitCode != 0)) {
    // Error processing
    var errorMsg = errorMsgObj.value;

    var statusLines = errorMsg.split(/\r?\n/);

    var displayMsg;
    if (statusLines && statusLines.length) {
      // Display only first ten lines of error message
      while (statusLines.length > 10)
        statusLines.pop();

      displayMsg = statusLines.join("\n");
      EnigAlert(displayMsg);
    }

    if (!plainText)
      return;
  }

  // Replace encrypted quote with decrypted quote

  gEditorShell.SelectAll();
  //var directionFlags = 0;   // see nsIEditor.h
  //gEditorShell.DeleteSelection(directionFlags);

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: plainText='"+plainText+"'\n");

  gEditorShell.InsertText(head);
  var nodeObj = new Object();
  gEditorShell.InsertAsQuotation(plainText, nodeObj);
  gEditorShell.InsertText(tail);
}


function DocumentStateListener()
{
}

DocumentStateListener.prototype = {

  QueryInterface: function (iid) {

    if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
        !iid.equals(Components.interfaces.nsISupports))
       throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  NotifyDocumentCreated: function ()
  {
    //DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentCreated\n");
  },

  NotifyDocumentWillBeDestroyed: function ()
  {
    //DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentWillBeDestroyed\n");
  },

  NotifyDocumentStateChanged: function (nowDirty)
  {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged: "+nowDirty+"\n");

    if (!gDecryptTimeoutID &&
        gMsgCompose.editor.documentEditable &&
        gMsgCompose.editor.documentLength) {
      gDecryptTimeoutID = window.setTimeout(enigDecryptQuote, 10);
    }
  }

}
