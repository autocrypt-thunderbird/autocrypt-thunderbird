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

var gOrigSendButton, gEnigSendButton;
var gEditorElement, gEditorShell;

function enigMsgComposeStartup() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");

   gOrigSendButton = document.getElementById("button-send");
   gEnigSendButton = document.getElementById("button-enigmail-send");

   // Get editor shell
   gEditorElement = document.getElementById("content-frame");
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorElement = "+gEditorElement+"\n");

   gEditorShell = gEditorElement.editorShell;
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEditorShell = "+gEditorShell+"\n");
   var docStateListener = new DocumentStateListener();
   gEditorShell.RegisterDocumentStateListener(docStateListener);

   enigMsgComposeReset();
}

var gEnigReset, gEnigProcessed, gDecryptTimeoutID;

function enigMsgComposeReset() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeReset\n");

   enigUpdateOptionsDisplay();

   gEnigProcessed = null;
   gDecryptTimeoutID = null;
   gEnigReset = true;
}

function enigUpdateOptionsDisplay() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUpdateOptionsDisplay: \n");
   var optList = ["defaultEncryptMsg", "defaultSignMsg", "confirmBeforeSend"];

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

function enigInsertKey() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigInsertKey: \n");

  var userIdValue = EnigGetPref("userIdValue");

  if (EnigGetPref("userIdSource") == USER_ID_FROMADDR) {
    try {
       var currentId = getCurrentIdentity();
       userIdValue = currentId.email;
    } catch (ex) {
    }
  }

  var text = "User Ids (email addresses) of keys to export";
  var retObj = new Object();
  var checkObj = new Object();

  if (userIdValue)
    retObj.value = userIdValue;

  var proceed = gPromptService.prompt(window, "Enigmail Key Export",
                                      text, retObj, "", checkObj);

  userIdValue = retObj.value;

  if (!proceed || !userIdValue)
    return;

  // Replace commas with spaces
  userIdValue = userIdValue.replace(/,/g, " ");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();

  var uiFlags = nsIEnigmail.UI_INTERACTIVE;
  var keyBlock = enigmailSvc.extractKey(window, uiFlags, userIdValue,
                                        exitCodeObj, errorMsgObj);
  var exitCode = exitCodeObj.value;

  if (!keyBlock || (exitCode != 0)) {
    // Error processing
    var errorMsg = errorMsgObj.value;
    EnigAlert(errorMsg);
    return;
  }

  gEditorShell.InsertText("Public key for "+userIdValue+"\n" + keyBlock);
}

function enigUndoEncryption() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUndoEncryption: \n");

  if (gEnigProcessed) {
    ReplaceEditorText(gEnigProcessed.plainText);

    gEnigProcessed = null;

  } else {
    enigDecryptQuote(true);
  }
}

function ReplaceEditorText(text) {
  gEditorShell.SelectAll();
    
  //var directionFlags = 0;   // see nsIEditor.h
  //gEditorShell.DeleteSelection(directionFlags);
    
  gEditorShell.InsertText(text);
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

     var defaultSend = encryptFlags & nsIEnigmail.DEFAULT_SEND;
     if (defaultSend) {

       if (EnigGetPref("defaultSignMsg"))
         encryptFlags |= nsIEnigmail.SIGN_MESSAGE;

       if (EnigGetPref("defaultEncryptMsg"))
         encryptFlags |= nsIEnigmail.ENCRYPT_MESSAGE;
     }

     var signMsg    = encryptFlags & nsIEnigmail.SIGN_MESSAGE;
     var encryptMsg = encryptFlags & nsIEnigmail.ENCRYPT_MESSAGE;

     var msgCompFields = gMsgCompose.compFields;
     Recipients2CompFields(msgCompFields);

     // Check if sending to any newsgroups    
     var newsgroups = msgCompFields.newsgroups;

     if (newsgroups && defaultSend) {
       // Do not encrypt by default if sending to newsgroups
       encryptFlags &= ~nsIEnigmail.ENCRYPT_MESSAGE;
       encryptMsg = false;

       if (!EnigGetPref("defaultSignNewsMsg")) {
         // Do not sign by default if sending to any newsgroup
         encryptFlags &= ~nsIEnigmail.SIGN_MESSAGE;
         signMsg = false;
       }
     }

     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: gMsgCompose="+gMsgCompose+"\n");

     var toAddrList = [];

     if (msgCompFields.to)  toAddrList.push(msgCompFields.to);

     if (msgCompFields.cc)  toAddrList.push(msgCompFields.cc);
     if (msgCompFields.bcc) toAddrList.push(msgCompFields.bcc);

     var toAddr = toAddrList.join(", ");

     if (newsgroups) toAddrList.push(newsgroups);

     var toAddrAll = toAddrList.join(", ");;

     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: toAddrAll="+toAddrAll+"\n");

     if (!gEnigProcessed && (signMsg || encryptMsg)) {

       var fromAddr = currentId.email;

       var userIdSource = EnigGetPref("userIdSource");
       DEBUG_LOG("enigmailMsgComposeOverlay.js: userIdSource = "+userIdSource+"\n");

       if (userIdSource == USER_ID_DEFAULT) {
         fromAddr = "";

       } else if (userIdSource == USER_ID_SPECIFIED) {
         fromAddr = EnigGetPref("userIdValue");
       }

       if (EnigGetPref("alwaysTrustSend"))
         encryptFlags |= nsIEnigmail.ALWAYS_TRUST_SEND;

       if (EnigGetPref("encryptToSelf")) {
         encryptFlags |= nsIEnigmail.ENCRYPT_TO_SELF;
       }

       ///var editorDoc = gEditorShell.editorDocument;
       ///DEBUG_LOG("enigmailMsgComposeOverlay.js: Doc = "+editorDoc+"\n");
       ///EnigDumpHTML(editorDoc.documentElement);

       if (gMsgCompose.composeHTML) {
         var errMsg = "HTML mail warning:\nThis message may contain HTML, which could cause signing/encryption to fail. To avoid this in the future, you should press the SHIFT key when clicking on the Compose/Reply button to send signed mail.\nIf you sign mail by default, you should uncheck the 'Compose Messages in HTML' preference box to permanently disable HTML mail for this mail account."

         EnigAlertCount("composeHtmlAlertCount", errMsg);
       }

       try {    
         var convert = DetermineConvertibility();
         if (convert == nsIMsgCompConvertible.No) {
           if (!EnigConfirm("Message contains HTML formatting information that will be lost when converting to plain text for signing/encryption. Do you wish to proceed?\n"))
             return;
         }
       } catch (ex) {
       }

       var sendFlowed;
       try {
         sendFlowed = gPrefMailNews.getBoolPref("send_plaintext_flowed");
       } catch (ex) {
         sendFlowed = true;
       }

       if (sendFlowed) {
         // Prevent space stuffing a la RFC 2646 (format=flowed).

         // (Do we need to set nsIDocumentEncoder::* flags?)
         var encoderFlags = OutputFormatted | OutputCRLineBreak |
                            OutputLFLineBreak;
         var docText = gEditorShell.GetContentsAs("text/plain", encoderFlags);
         //DEBUG_LOG("enigmailMsgComposeOverlay.js: docText["+encoderFlags+"] = '"+docText+"'\n");

         // MULTILINE MATCHING ON
         RegExp.multiline = true;

         docText = docText.replace(/^From /g, "~From ");
         docText = docText.replace(/^>/g, "|");
         docText = docText.replace(/^[ \t]+$/g, "");
         docText = docText.replace(/^ /g, "~ ");

         // MULTILINE MATCHING OFF
         RegExp.multiline = false;

         //DEBUG_LOG("enigmailMsgComposeOverlay.js: docText = '"+docText+"'\n");
         ReplaceEditorText(docText);
       }
    

       // Get plain text

       var encoderFlags = OutputFormatted | OutputCRLineBreak |
                          OutputLFLineBreak;

       var plainText = gEditorShell.GetContentsAs("text/plain", encoderFlags);

       // Replace plain text and get it again (to avoid linewrapping problems)
       ReplaceEditorText(plainText);

       plainText = gEditorShell.GetContentsAs("text/plain", encoderFlags);

       //DEBUG_LOG("enigmailMsgComposeOverlay.js: plainText["+encoderFlags+"] = '"+plainText+"'\n");

       if (!plainText) {
         encryptFlags = 0;
         signMsg = false;
         encryptMsg = false;

       } else {
         // Encrypt plaintext
         var exitCodeObj = new Object();
         var errorMsgObj = new Object();
         var uiFlags = nsIEnigmail.UI_INTERACTIVE;

         var cipherText = enigmailSvc.encryptMessage(window,uiFlags, plainText,
                                                fromAddr, toAddr, encryptFlags,
                                               exitCodeObj, errorMsgObj);

         var exitCode = exitCodeObj.value;
    
         if ((exitCode != 0) && defaultSend && encryptMsg) {
           // Default send error; turn off encryption
           encryptFlags &= ~nsIEnigmail.ENCRYPT_MESSAGE;
           encryptMsg = false;

           if (signMsg) {
             // Try signing only, to see if it removes the error condition
             cipherText = enigmailSvc.encryptMessage(window,uiFlags, plainText,
                                                fromAddr, toAddr, encryptFlags,
                                                exitCodeObj, errorMsgObj);

             exitCode = exitCodeObj.value;
           }
         }

         if (cipherText && (exitCode == 0)) {
           // Encryption/signing succeeded; overwrite plaintext
           ReplaceEditorText(cipherText);

           gEnigProcessed = {"plainText":plainText};

         } else if (signMsg || encryptMsg) {
           // Encryption/signing failed
           var errorMsg = errorMsgObj.value;
           EnigAlert("Error in encrypting and/or signing message. Send operation aborted.\n"+errorMsg);
           return;
         }
       }
     }

     // EnigSend: Handle both plain and encrypted messages below
     if (gIsOffline) {
       if (!EnigConfirm("You are currently offline. Do you wish to save the message in the Unsent Messages folder?\n")) {

         if (gEnigProcessed)
           enigUndoEncryption();

         return;
       }

       enigGenericSendMessage(nsIMsgCompDeliverMode.Later);
       return;
     }

     if (EnigGetPref("confirmBeforeSend")) {
       var msgStatus = "";

       if (signMsg)
         msgStatus += "SIGNED ";

       if (encryptMsg)
         msgStatus += "ENCRYPTED ";

       if (!msgStatus)
         msgStatus = "PLAINTEXT ";

       if (!EnigConfirm("Send "+msgStatus+"message to "+toAddrAll+"?\n")) {
         if (gEnigProcessed)
           enigUndoEncryption();

         return;
       }
     }
    
     enigGenericSendMessage(nsIMsgCompDeliverMode.Now);

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


// Modified version of GenericSendMessage from the file MsgComposeCommands.js
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
        if (sPrefs.getBoolPref("mail.SpellCheckBeforeSend")){
        //We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
        //therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
          editorShell.contentWindow.focus();
          goDoCommand('cmd_spelling');
        }

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

function enigDecryptQuote(interactive) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: "+interactive+"\n");

  if (gWindowLocked || gEnigProcessed)
    return;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var encoderFlags = OutputFormatted | OutputLFLineBreak;

  var docText = gEditorShell.GetContentsAs("text/plain", encoderFlags);

  // START TEMPORARY DEBUG CODE
  var matches = docText.match(/(^|\n).*-----BEGIN.*\n/);

  if (matches) {
    WRITE_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: TEMPORARY matches[0]='"+matches[0]+"'\n");
  }
  // END TEMPORARY DEBUG CODE

  if (docText.indexOf("-----BEGIN PGP ") < 0)
    return;

  // Determine indentation string
  var matches = docText.match(/(^|\n)([ \t]*>?[ \t]*)-----BEGIN PGP /);

  var indentStr= "";
  if (matches && (matches.length > 2)) {
    indentStr = matches[2];
  }

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: indentStr='"+indentStr+"'\n");

  var beginIndexObj = new Object();
  var endIndexObj = new Object();
  var blockType = enigmailSvc.locateArmoredBlock(docText, 0, indentStr,
                                          beginIndexObj, endIndexObj);

  if ((blockType != "MESSAGE") && (blockType != "SIGNED MESSAGE"))
    return;

  var beginIndex = beginIndexObj.value;
  var endIndex   = endIndexObj.value;

  var head = docText.substr(0, beginIndex);
  var tail = docText.substr(endIndex+1);

  var pgpBlock = docText.substr(beginIndex, endIndex-beginIndex+1);

  if (indentStr) {
    // MULTILINE MATCHING ON
    RegExp.multiline = true;

    // Delete indentation
    var indentRegexp = new RegExp("^"+indentStr, "g");

    pgpBlock = pgpBlock.replace(indentRegexp, "");
    tail     =     tail.replace(indentRegexp, "");

    // Handle blank indented lines
    pgpBlock = pgpBlock.replace(/^[ \t]*>[ \t]*)$/, "");
    tail     =     tail.replace(/^[ \t]*>[ \t]*)$/, "");

    // Trim leading space in tail
    tail = tail.replace(/^\s*\n/, "\r\n");

    // MULTILINE MATCHING OFF
    RegExp.multiline = false;
  }

  if (tail.search(/\S/) < 0) {
    // No non-space characters in tail; delete it
    tail = ""
  }

  //DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: pgpBlock='"+pgpBlock+"'\n");

  // Decrypt message
  var exitCodeObj = new Object();
  var errorMsgObj = new Object();
  var signStatusObj = new Object();
  signStatusObj.value = "";

  var uiFlags = nsIEnigmail.UI_INTERACTIVE | nsIEnigmail.UNVERIFIED_ENC_OK;
  var plainText = enigmailSvc.decryptMessage(window, uiFlags, pgpBlock,
                                     exitCodeObj, errorMsgObj, signStatusObj);
  var exitCode = exitCodeObj.value;

  if (exitCode != 0) {
    // Error processing
    var errorMsg = errorMsgObj.value;

    var statusLines = errorMsg.split(/\r?\n/);

    var displayMsg;
    if (statusLines && statusLines.length) {
      // Display only first ten lines of error message
      while (statusLines.length > 10)
        statusLines.pop();

      displayMsg = statusLines.join("\n");

      if (interactive)
        EnigAlert(displayMsg);
    }
  }

  if (!plainText) {
    if (blockType != "SIGNED MESSAGE")
      return;

    // Extract text portion of clearsign block
    plainText = enigmailSvc.extractSignaturePart(pgpBlock,
                                                  nsIEnigmail.SIGNATURE_TEXT);
  }

  // Replace encrypted quote with decrypted quote
  gEditorShell.SelectAll();
  //var directionFlags = 0;   // see nsIEditor.h
  //gEditorShell.DeleteSelection(directionFlags);

  //DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: plainText='"+plainText+"'\n");

  if (head)
    gEditorShell.InsertText(head);

  var quoteElement;

  if (indentStr) {
    var nodeObj = new Object();
    gEditorShell.InsertAsQuotation(plainText, nodeObj);
    if (nodeObj.value) {
      quoteElement = nodeObj.value;
    }

  } else {
    gEditorShell.InsertText(plainText);
  }

  if (tail)
    gEditorShell.InsertText(tail);

  if (interactive)
    return;

  // Position cursor
  var replyOnTop = 1;
  try {
    replyOnTop = gPrefMailNews.getIntPref("reply_on_top");
  } catch (ex) {}

  if (!indentStr || !quoteElement)
    replyOnTop = 1;

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: replyOnTop="+replyOnTop+", quoteElement="+quoteElement+"\n");

  var nsISelectionController = Components.interfaces.nsISelectionController;

  var selCon = gEditorShell.selectionController;

  var selection;
  if (selCon)
      selection = selCon.getSelection(nsISelectionController.SELECTION_NORMAL)

  try {
    var quoteOffset = 0;
    if (quoteElement)
      quoteOffset = GetChildOffset(quoteElement.parentNode, quoteElement);

    DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: quoteOffset="+quoteOffset+", selection="+selection+"\n");

    switch (replyOnTop) {
    case 0:
      // Position after quote
      if (selection && quoteOffset) {
          selection.collapse(quoteElement.parentNode, quoteOffset);
      }
      break;

    case 2:
      // Select quote

      if (selection && quoteOffset) {
        selection.collapse(quoteElement.parentNode, quoteOffset-1);
        selection.extend(quoteElement.parentNode, quoteOffset);

      } else {
        gEditorShell.SelectAll();
      }
      break;

    default:
    // Position at beginning of document
    if (gEditorShell.editor)
      gEditorShell.editor.BeginningOfDocument();

    }
  } catch (ex) {}

  if (selCon)
      selCon.scrollSelectionIntoView(nsISelectionController.SELECTION_NORMAL,
                                     nsISelectionController.SELECTION_ANCHOR_REGION);
}

// Returns offset of child (> 0), or 0, if child not found
function GetChildOffset(parentNode, childNode) {
  if (!parentNode || !childNode)
    return 0;

  var children = parentNode.childNodes;
  var length = children.length;
  var count = 0;
  while(count < length) {
      var node = children[count]
      count++
      if (node == childNode)
        return count;
  }
  return 0;
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
    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged: "+nowDirty+", editable="+gMsgCompose.editor.documentEditable+"\n");

    if (!gMsgCompose.editor.documentEditable ||
        !gMsgCompose.editor.documentLength) {

      if (!gEnigReset)
        enigMsgComposeReset();

      return;
    }

    var docLength = gMsgCompose.editor.documentLength;

    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged: docLength="+gMsgCompose.editor.documentLength+"\n");

    gEnigReset = false;

    if (!gDecryptTimeoutID)
      gDecryptTimeoutID = window.setTimeout(enigDecryptQuote, 10, false);
  }

}
