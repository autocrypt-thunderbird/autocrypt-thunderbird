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

// Handle recycled windows
window.addEventListener('compose-window-close', enigMsgComposeClose, true);
window.addEventListener('compose-window-reopen', enigMsgComposeReopen, true);

var gEnigOrigSendButton, gEnigSendButton;
var gEnigEditorElement, gEnigEditorShell;
var gEnigDirty, gEnigProcessed, gEnigTimeoutID;

function enigMsgComposeStartup() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");

  gEnigOrigSendButton = document.getElementById("button-send");
  gEnigSendButton = document.getElementById("button-enigmail-send");

  // Relabel/hide SMIME button and menu item
  var smimeButton = document.getElementById("button-security");

  if (smimeButton) {
    smimeButton.setAttribute("label", "S/MIME");
    if (EnigGetPref("disableSMIMEui"))
        smimeButton.setAttribute("collapsed", "true");
  }

  // Override send command
  var sendElementIds = ["cmd_sendButton", "cmd_sendNow", "cmd_sendWithCheck",
                        "cmd_sendLater"];

  for (var index = 0; index < sendElementIds.length; index++) {
    var elementId = sendElementIds[index];
    var element = document.getElementById(elementId);
    if (element)
      element.setAttribute("oncommand", "enigSendCommand('"+elementId+"');");
  }

   // Get editor shell
   gEnigEditorElement = document.getElementById("content-frame");
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEnigEditorElement = "+gEnigEditorElement+"\n");

   gEnigEditorShell = gEnigEditorElement.editorShell;
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEnigEditorShell = "+gEnigEditorShell+"\n");
   var docStateListener = new DocumentStateListener();
   gEnigEditorShell.RegisterDocumentStateListener(docStateListener);

   enigMsgComposeReset();
}

function enigMsgComposeReopen() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeReopen\n");
   enigMsgComposeReset();
}

function enigMsgComposeClose() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeClose\n");
   enigMsgComposeReset();
}

function enigMsgComposeReset() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeReset\n");

   gEnigDirty = false;
   gEnigProcessed = null;
   gEnigTimeoutID = null;
}

function enigInitDefaultOptionsMenu() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigInitDefaultOptionsMenu\n");

  var encryptId;

  var defaultEncryptionOption = EnigGetPref("defaultEncryptionOption");

  switch (defaultEncryptionOption) {
  case 2:
    encryptId = "enigmail_defaultEncryptionSign";
    break;
  case 1:	
    encryptId = "enigmail_defaultEncryptionOnly";
    break;
  default:
    encryptId = "enigmail_defaultEncryptionNone";
    break;
  }

  var encryptItem = document.getElementById(encryptId);
  if (encryptItem)
    encryptItem.setAttribute("checked", "true");

  if (!defaultEncryptionOption) {
     gEnigSendButton.removeAttribute("collapsed");
     gEnigOrigSendButton.setAttribute("collapsed", "true");

  } else {
     gEnigOrigSendButton.removeAttribute("collapsed");
     gEnigSendButton.setAttribute("collapsed", "true");
  }

  var optList = ["defaultSignMsg", "confirmBeforeSend"];

  for (var j=0; j<optList.length; j++) {
    var optName = optList[j];
    var optValue = EnigGetPref(optName);

    var menuElement = document.getElementById("enigmail_"+optName);

    menuElement.setAttribute("checked", optValue ? "true" : "false");
  }
}

function enigDefaultEncryption(value) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDefaultEncryption: "+value+"\n");

  EnigSetPref("defaultEncryptionOption", value);
  return true;
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

  gEnigEditorShell.InsertText("Public key for "+userIdValue+"\n" + keyBlock);
}

function enigUndoEncryption() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUndoEncryption: \n");

  if (gEnigProcessed) {
    ReplaceEditorText(gEnigProcessed.docText);

    gEnigProcessed = null;

  } else {
    enigDecryptQuote(true);
  }
}

function ReplaceEditorText(text) {
  gEnigEditorShell.SelectAll();
    
  //var directionFlags = 0;   // see nsIEditor.h
  //gEnigEditorShell.DeleteSelection(directionFlags);
    
  gEnigEditorShell.InsertText(text);
}

function enigSendCommand(elementId) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSendCommand: id="+elementId+"\n");

  switch (elementId) {
  case "cmd_send":
    sendFlags = nsIEnigmail.SEND_DEFAULT;
    break;

  case "cmd_sendNow":
    sendFlags = nsIEnigmail.SEND_DEFAULT;
    break;

  case "cmd_sendWithCheck":
    sendFlags = nsIEnigmail.SEND_DEFAULT | nsIEnigmail.SEND_WITH_CHECK;
    break;

  case "cmd_sendLater":
    sendFlags = nsIEnigmail.SEND_DEFAULT | nsIEnigmail.SEND_LATER;
    break;

  case "enigmail_default_send":
    sendFlags = nsIEnigmail.SEND_DEFAULT;
    break;

  case "enigmail_signed_send":
    sendFlags = nsIEnigmail.SEND_SIGNED;
    break;

  case "enigmail_encrypted_send":
    sendFlags = nsIEnigmail.SEND_ENCRYPTED;
    break;

  case "enigmail_encrypt_sign_send":
    sendFlags = nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED;
    break;

  case "enigmail_plain_send":
    sendFlags = 0;
    break;

  default:
    sendFlags = nsIEnigmail.SEND_DEFAULT;
  }

  enigSend(sendFlags);
}

function enigSend(sendFlags) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: "+sendFlags+"\n");

  if (gWindowLocked) {
    EnigAlert("Compose window is locked; send cancelled\n");
    return;
  }

  gEnigDirty = true;

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

     var defaultEncryptionOption = EnigGetPref("defaultEncryptionOption");

     var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
     if (defaultSend) {

       if (EnigGetPref("defaultSignMsg"))
         sendFlags |= SIGN_MSG;

       switch (defaultEncryptionOption) {
       case 2:
         sendFlags |= ENCRYPT_OR_SIGN_MSG;
         break;
       case 1:	
         sendFlags |= ENCRYPT_MSG;
         break;
       default:
        break;
       }
     }

     var msgCompFields = gMsgCompose.compFields;
     Recipients2CompFields(msgCompFields);

     // Check if sending to any newsgroups    
     var newsgroups = msgCompFields.newsgroups;

     if (newsgroups && defaultSend) {
       // Do not encrypt by default if sending to newsgroups
       sendFlags &= ~ENCRYPT_MSG;

       if (!EnigGetPref("defaultSignNewsMsg")) {
         // Do not sign by default if sending to any newsgroup
         sendFlags &= ~SIGN_MSG;
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

     if (!gEnigProcessed) {
/////////////////////////////////////////////////////////////////////////
// The following spellcheck logic is from the function
// GenericSendMessage from the file MsgComposeCommands.js
/////////////////////////////////////////////////////////////////////////
       if (gEnigPrefRoot.getBoolPref("mail.SpellCheckBeforeSend")) {
        // We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
        // therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
         gEnigEditorShell.contentWindow.focus();
         goDoCommand('cmd_spelling');
       }
     }

     if (!gEnigProcessed && (sendFlags & ENCRYPT_OR_SIGN_MSG)) {

       ///var editorDoc = gEnigEditorShell.editorDocument;
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
         sendFlowed = gEnigPrefRoot.getBoolPref("mailnews.send_plaintext_flowed");
       } catch (ex) {
         sendFlowed = true;
       }

       var encoderFlags = OutputFormatted | OutputLFLineBreak;
       var docText;

       if (sendFlowed) {
         // Prevent space stuffing a la RFC 2646 (format=flowed).

         // (Do we need to set nsIDocumentEncoder::* flags?)
         docText = gEnigEditorShell.GetContentsAs("text/plain", encoderFlags);
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
       docText = gEnigEditorShell.GetContentsAs("text/plain", encoderFlags);

       // Replace plain text and get it again (to avoid linewrapping problems)
       ReplaceEditorText(docText);

       docText = gEnigEditorShell.GetContentsAs("text/plain", encoderFlags);

       //DEBUG_LOG("enigmailMsgComposeOverlay.js: docText["+encoderFlags+"] = '"+docText+"'\n");

       if (!docText) {
         sendFlags = 0;

       } else {
         // Encrypt plaintext
         var charset = gEnigEditorShell.GetDocumentCharacterSet();
         DEBUG_LOG("enigmailMsgComposeOverlay.js: charset="+charset+"\n");

         // Encode plaintext to charset from unicode
         var plainText = EnigConvertFromUnicode(docText, charset);

         var fromAddr = EnigGetPref("userIdValue");

         var userIdSource = EnigGetPref("userIdSource");
         DEBUG_LOG("enigmailMsgComposeOverlay.js: userIdSource = "+userIdSource+"\n");

         if (!fromAddr || (userIdSource == USER_ID_FROMADDR)) {
           fromAddr = currentId.email;
         }

         if (userIdSource == USER_ID_DEFAULT) {
           sendFlags |= nsIEnigmail.SEND_USER_ID_DEFAULT;
         }

         if (EnigGetPref("alwaysTrustSend"))
           sendFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;

         if (EnigGetPref("encryptToSelf")) {
           sendFlags |= nsIEnigmail.SEND_ENCRYPT_TO_SELF;
         }

         var exitCodeObj    = new Object();
         var statusFlagsObj = new Object();    
         var errorMsgObj    = new Object();
         var uiFlags = nsIEnigmail.UI_INTERACTIVE;

         var cipherText = enigmailSvc.encryptMessage(window,uiFlags, plainText,
                                                fromAddr, toAddr, sendFlags,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);

         var exitCode = exitCodeObj.value;
    
         if ((exitCode != 0) && defaultSend && (sendFlags & ENCRYPT_MSG) &&
             !(statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) ) {
           // Default send error; turn off encryption
           sendFlags &= ~ENCRYPT_MSG;

           if (!EnigGetPref("defaultSignMsg") &&
               (defaultEncryptionOption < 2) ) {
             // Turn off signing
             sendFlags &= ~SIGN_MSG;
           }

           if (sendFlags & SIGN_MSG) {
             // Try signing only, to see if it removes the error condition
             cipherText = enigmailSvc.encryptMessage(window,uiFlags, plainText,
                                                fromAddr, toAddr, sendFlags,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);

             exitCode = exitCodeObj.value;
           }
         }

         if (cipherText && (exitCode == 0)) {
           // Encryption/signing succeeded; overwrite plaintext

           // Decode ciphertext from charset to unicode and overwrite
           ReplaceEditorText( EnigConvertToUnicode(cipherText, charset) );

           // Save original text (for undo)
           gEnigProcessed = {"docText":docText};

         } else if (sendFlags & ENCRYPT_OR_SIGN_MSG) {
           // Encryption/signing failed
           EnigAlert("Send operation aborted.\n\n"+errorMsgObj.value);
           return;
         }
       }
     }

     // EnigSend: Handle both plain and encrypted messages below
     var isOffline = (gIOService && gIOService.offline);

     if (isOffline &&
         !EnigConfirm("You are currently offline. Do you wish to save the message in the Unsent Messages folder?\n") ) {

       if (gEnigProcessed)
         enigUndoEncryption();

       return;
     }

     if (isOffline || (sendFlags & nsIEnigmail.SEND_LATER)) {
       // Send message later
       DEBUG_LOG("enigmailMsgComposeOverlay.js: Sending message later ...\n");

       enigGenericSendMessage(nsIMsgCompDeliverMode.Later);
       return;
     }

     if (EnigGetPref("confirmBeforeSend") ||
         (sendFlags & nsIEnigmail.SEND_WITH_CHECK) ) {
       var msgStatus = "";

       if (sendFlags & SIGN_MSG)
         msgStatus += "SIGNED ";

       if (sendFlags & ENCRYPT_MSG)
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
// MODIFICATION
// Call the following function from our version of the function
// GenericSendMessage from the file MsgComposeCommands.js
// (after the calls to Recipients2CompFields and Attachements2CompFields)
/////////////////////////////////////////////////////////////////////////
      enigModifyCompFields(msgCompFields);
/////////////////////////////////////////////////////////////////////////

      if (msgType == nsIMsgCompDeliverMode.Now || msgType == nsIMsgCompDeliverMode.Later)
      {
        //Do we need to check the spelling?
/////////////////////////////////////////////////////////////////////////
// MODIFICATION
//      Moved spell check logic to enigSend
/////////////////////////////////////////////////////////////////////////

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
}

function enigDecryptQuote(interactive) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: "+interactive+"\n");

  if (gWindowLocked || gEnigProcessed)
    return;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var encoderFlags = OutputFormatted | OutputLFLineBreak;

  var docText = gEnigEditorShell.GetContentsAs("text/plain", encoderFlags);

  // START TEMPORARY DEBUG CODE
  var matchb = docText.match(/(^|\n).*-----BEGIN.*\n/);

  if (matchb && matchb.length) {
    WRITE_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: TEMPORARY matchb[0]='"+matchb[0]+"'\n");
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
    pgpBlock = pgpBlock.replace(/^[ \t]*>[ \t]*)$/g, "");
    tail     =     tail.replace(/^[ \t]*>[ \t]*)$/g, "");

    // Trim leading space in tail
    tail = tail.replace(/^\s*\n/, "\n");

    // MULTILINE MATCHING OFF
    RegExp.multiline = false;
  }

  if (tail.search(/\S/) < 0) {
    // No non-space characters in tail; delete it
    tail = ""
  }

  //DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: pgpBlock='"+pgpBlock+"'\n");

  var charset = gEnigEditorShell.GetDocumentCharacterSet();
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: charset="+charset+"\n");

  // Encode ciphertext from unicode to charset
  var cipherText = EnigConvertFromUnicode(pgpBlock, charset);

  // Decrypt message
  var signatureObj   = new Object();
  signatureObj.value = "";
  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();
  var userIdObj      = new Object();
  var keyIdObj       = new Object();
  var errorMsgObj    = new Object();

  var uiFlags = nsIEnigmail.UI_UNVERIFIED_ENC_OK;

  var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                 signatureObj, exitCodeObj, statusFlagsObj,
                                 keyIdObj, userIdObj, errorMsgObj);

  // Decode plaintext from charset to unicode
  plainText = EnigConvertToUnicode(plainText, charset);

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
  gEnigEditorShell.SelectAll();
  //var directionFlags = 0;   // see nsIEditor.h
  //gEnigEditorShell.DeleteSelection(directionFlags);

  //DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: plainText='"+plainText+"'\n");

  if (head)
    gEnigEditorShell.InsertText(head);

  var quoteElement;

  if (indentStr) {
    var nodeObj = new Object();
    gEnigEditorShell.InsertAsQuotation(plainText, nodeObj);
    if (nodeObj.value) {
      quoteElement = nodeObj.value;
    }

  } else {
    gEnigEditorShell.InsertText(plainText);
  }

  if (tail)
    gEnigEditorShell.InsertText(tail);

  if (interactive)
    return;

  // Position cursor
  var replyOnTop = 1;
  try {
    replyOnTop = gEnigPrefRoot.getIntPref("mailnews.reply_on_top");
  } catch (ex) {}

  if (!indentStr || !quoteElement)
    replyOnTop = 1;

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: replyOnTop="+replyOnTop+", quoteElement="+quoteElement+"\n");

  var nsISelectionController = Components.interfaces.nsISelectionController;

  var selCon = gEnigEditorShell.selectionController;

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
        gEnigEditorShell.SelectAll();
      }
      break;

    default:
    // Position at beginning of document
    if (gEnigEditorShell.editor)
      gEnigEditorShell.editor.BeginningOfDocument();

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
      return;
    }

    var docLength = gMsgCompose.editor.documentLength;

    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged: docLength="+gMsgCompose.editor.documentLength+"\n");

    if (!gEnigTimeoutID && !gEnigDirty)
      gEnigTimeoutID = window.setTimeout(enigDecryptQuote, 10, false);
  }

}
