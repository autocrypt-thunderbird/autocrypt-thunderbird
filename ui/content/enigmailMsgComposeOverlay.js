// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgComposeOverlay");

// nsIDocumentEncoder.h:
const EnigOutputSelectionOnly = 1;
const EnigOutputFormatted     = 2;
const EnigOutputRaw           = 4;
const EnigOutputPreformatted  = 16;
const EnigOutputWrap          = 32;
const EnigOutputFormatFlowed  = 64;
const EnigOutputCRLineBreak   = 512;
const EnigOutputLFLineBreak   = 1024;

const ENIG_ENIGMSGCOMPFIELDS_CONTRACTID = "@mozdev.org/enigmail/composefields;1";

// List of hash algorithms for PGP/MIME signatures
var gMimeHashAlgorithms = ["md5", "sha1", "ripemd160"];

var gSendFlagsObj = {
  "cmd_sendButton":          nsIEnigmail.SEND_DEFAULT,
  "cmd_send":                nsIEnigmail.SEND_DEFAULT,
  "cmd_sendNow":             nsIEnigmail.SEND_DEFAULT,

  "cmd_sendWithCheck":  nsIEnigmail.SEND_DEFAULT | nsIEnigmail.SEND_WITH_CHECK,

  "cmd_sendLater":           nsIEnigmail.SEND_DEFAULT | nsIEnigmail.SEND_LATER,
  "enigmail_default_send":   nsIEnigmail.SEND_DEFAULT,
  "enigmail_signed_send":    nsIEnigmail.SEND_SIGNED,
  "enigmail_encrypted_send": nsIEnigmail.SEND_ENCRYPTED,
  "enigmail_encrypt_sign_send": nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED
  };

var gEnigOrigSendButton, gEnigSendButton;
var gEnigEditorElement, gEnigEditorShell;
var gEnigDirty, gEnigProcessed, gEnigTimeoutID;
var gEnigSendPGPMime;

window.addEventListener("load", enigMsgComposeStartup, false);

// Handle recycled windows
window.addEventListener('compose-window-close', enigMsgComposeClose, true);
window.addEventListener('compose-window-reopen', enigMsgComposeReopen, true);

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

  EnigOverrideAttribute( sendElementIds, "oncommand",
                         "enigSendCommand('", "');");

   // Get editor shell
   gEnigEditorElement = document.getElementById("content-frame");
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEnigEditorElement = "+gEnigEditorElement+"\n");

   gEnigEditorShell = gEnigEditorElement.editorShell;
   DEBUG_LOG("enigmailMsgComposeOverlay.js: gEnigEditorShell = "+gEnigEditorShell+"\n");
   var docStateListener = new EnigDocStateListener();
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

  EnigShowHeadersAll(true);

  enigDisplaySendButton();

  gEnigSendPGPMime = !(EnigGetPref("usePGPMimeOption") == PGP_MIME_ALWAYS);

  enigTogglePGPMime();
}

function enigDisplaySendButton() {

  if (EnigGetPref("defaultEncryptionOption")) {
     gEnigSendButton.removeAttribute("collapsed");
     gEnigOrigSendButton.setAttribute("collapsed", "true");

  } else {
     gEnigOrigSendButton.removeAttribute("collapsed");
     gEnigSendButton.setAttribute("collapsed", "true");
  }
}

function enigInitRadioMenu(prefName, optionIds) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigInitRadioMenu: "+prefName+"\n");

  var encryptId;

  var prefValue = EnigGetPref(prefName);

  if (prefValue >= optionIds.length)
    return;

  var menuItem = document.getElementById("enigmail_"+optionIds[prefValue]);
  if (menuItem)
    menuItem.setAttribute("checked", "true");
}


function enigInitSendOptionsMenu() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigInitSendOptionsMenu\n");

  enigInitRadioMenu('defaultEncryptionOption', gDefaultEncryptionOptionList);

  var optList = ["defaultSignMsg", "confirmBeforeSend"];

  for (var j=0; j<optList.length; j++) {
    var optName = optList[j];
    var optValue = EnigGetPref(optName);

    var menuElement = document.getElementById("enigmail_"+optName);

    menuElement.setAttribute("checked", optValue ? "true" : "false");
  }
}


function enigDefaultEncryptionOption(value) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDefaultEncryptionOption: "+value+"\n");

  EnigSetPref("defaultEncryptionOption", value);

  enigDisplaySendButton();

  return true;
}

function enigUsePGPMimeOption(value) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigUsePGPMimeOption: "+value+"\n");

  EnigSetPref("usePGPMimeOption", value);

  return true;
}

function enigTogglePGPMime() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigTogglePGPMime: \n");

  gEnigSendPGPMime = !gEnigSendPGPMime;

  var menuElement = document.getElementById("enigmail_sendPGPMime");
  if (menuElement)
    menuElement.setAttribute("checked", gEnigSendPGPMime ? "true" : "false");
}

function enigInsertKey() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigInsertKey: \n");

  var userIdValue = EnigGetPref("userIdValue");

  if (EnigGetPref("userIdFromAddr")) {
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
    enigReplaceEditorText(gEnigProcessed.docText);

    gEnigProcessed = null;

  } else {
    enigDecryptQuote(true);
  }
}

function enigReplaceEditorText(text) {
  gEnigEditorShell.SelectAll();
    
  //var directionFlags = 0;   // see nsIEditor.h
  //gEnigEditorShell.DeleteSelection(directionFlags);
    
  gEnigEditorShell.InsertText(text);
}

function enigSendCommand(elementId) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSendCommand: id="+elementId+"\n");

  var sendFlags = gSendFlagsObj[elementId];

  if (!sendFlags) {
    if (elementId == "enigmail_plain_send") {
      sendFlags = 0;
    } else {
      sendFlags = nsIEnigmail.SEND_DEFAULT;
    }
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
     var defaultEncryptionOption = EnigGetPref("defaultEncryptionOption");

     var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
     if (defaultSend) {

       if (EnigGetPref("defaultSignMsg"))
         sendFlags |= ENIG_SIGN;

       switch (defaultEncryptionOption) {
       case 2:
         sendFlags |= ENIG_ENCRYPT_OR_SIGN;
         break;
       case 1:	
         sendFlags |= ENIG_ENCRYPT;
         break;
       default:
        break;
       }
     }

     if (EnigGetPref("alwaysTrustSend")) {
       sendFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;
     }

     if (EnigGetPref("encryptToSelf")) {
       sendFlags |= nsIEnigmail.SEND_ENCRYPT_TO_SELF;
     }

     var currentId = getCurrentIdentity();
     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: currentId="+currentId+
               ", "+currentId.email+"\n");

     var fromAddr = currentId.email;

     if (!EnigGetPref("userIdFromAddr")) {
       var userIdValue = EnigGetPref("userIdValue");

       if (!userIdValue) {

         var mesg = "Please specify your primary email address, which will be used to choose the signing key for outgoing messages.\n If you leave it blank, the FROM address of the message will be used to choose the signing key.";

         var valueObj = new Object();
         valueObj.value = userIdValue;

         if (EnigPromptValue(mesg, valueObj)) {
           userIdValue = valueObj.value;
         }
       }

       if (userIdValue) {
         fromAddr = userIdValue;
         EnigSetPref("userIdValue", userIdValue);

       } else {
         EnigSetPref("userIdFromAddr", true);
       }
     }

     var msgCompFields = gMsgCompose.compFields;
     Recipients2CompFields(msgCompFields);

     // Check if sending to any newsgroups    
     var newsgroups = msgCompFields.newsgroups;

     if (newsgroups && defaultSend) {
       // Do not encrypt by default if sending to newsgroups
       sendFlags &= ~ENIG_ENCRYPT;

       if (!EnigGetPref("defaultSignNewsMsg")) {
         // Do not sign by default if sending to any newsgroup
         sendFlags &= ~ENIG_SIGN;
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

     var uiFlags = nsIEnigmail.UI_INTERACTIVE;

     var usePGPMimeOption = EnigGetPref("usePGPMimeOption");

     if ( !(defaultSend && (sendFlags & ENIG_ENCRYPT)) ) {

       if (gEnigSendPGPMime) {
         sendFlags |= nsIEnigmail.SEND_PGP_MIME;
       }

       var bucketList = document.getElementById("attachmentBucket");
       var hasAttachments = bucketList && bucketList.hasChildNodes();

       DEBUG_LOG("enigmailMsgComposeOverlay.js: hasAttachments = "+hasAttachments+"\n");

       if ( hasAttachments &&
          (sendFlags & ENIG_ENCRYPT_OR_SIGN) &&
          !(sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
          (usePGPMimeOption >= PGP_MIME_POSSIBLE) &&
          enigmailSvc.composeSecure ) {

         if (EnigConfirm("Attachments to this message will be signed/encrypted only if the recipient's mail reader supports the PGP/MIME format. Enigmail, Evolution, and Mutt are known to support this format.\n Click OK to use PGP/MIME format for this message, or Cancel to use inline PGP.")) {
         sendFlags |= nsIEnigmail.SEND_PGP_MIME;
         }
       }
     }

     var usingPGPMime = (sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
                        (sendFlags & ENIG_ENCRYPT_OR_SIGN);

     if (usingPGPMime && !enigmailSvc.composeSecure) {
       if (!EnigConfirm("PGP/MIME not available!\nUse inline PGP for signing/encryption?")) {
          throw Components.results.NS_ERROR_FAILURE;
          
       }
 
       usingPGPMime = false;
     }

     if (usingPGPMime)
       uiFlags |= nsIEnigmail.UI_PGP_MIME;

     if ( usingPGPMime ||
          (!hasAttachments && EnigGetPref("useMimeExperimental"))) {
       // Use EnigMime
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: Using EnigMime, flags="+sendFlags+"\n");

       var oldSecurityInfo = gMsgCompose.compFields.securityInfo;

       dump("oldSecurityInfo = "+oldSecurityInfo+"\n");

       var newSecurityInfo;

       if (!oldSecurityInfo) {
         try {
           newSecurityInfo = oldSecurityInfo.QueryInterface(Components.interfaces.nsIEnigMsgCompFields);
         } catch (ex) {}
       }

       if (!newSecurityInfo) {
         newSecurityInfo = Components.classes[ENIG_ENIGMSGCOMPFIELDS_CONTRACTID].createInstance(Components.interfaces.nsIEnigMsgCompFields);

         if (!newSecurityInfo)
           throw Components.results.NS_ERROR_FAILURE;

         newSecurityInfo.init(oldSecurityInfo);
         gMsgCompose.compFields.securityInfo = newSecurityInfo;
       }

       newSecurityInfo.sendFlags = sendFlags;
       newSecurityInfo.UIFlags = uiFlags;
       newSecurityInfo.senderEmailAddr = fromAddr;
       newSecurityInfo.recipients = toAddr;
       newSecurityInfo.hashAlgorithm = gMimeHashAlgorithms[EnigGetPref("mimeHashAlgorithm")];

       dump("securityInfo = "+newSecurityInfo+"\n");

     } else if (!gEnigProcessed && (sendFlags & ENIG_ENCRYPT_OR_SIGN)) {

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

       var encoderFlags = EnigOutputFormatted | EnigOutputLFLineBreak;
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
         enigReplaceEditorText(docText);
       }
    
       // Get plain text
       docText = gEnigEditorShell.GetContentsAs("text/plain", encoderFlags);

       // Replace plain text and get it again (to avoid linewrapping problems)
       enigReplaceEditorText(docText);

       docText = gEnigEditorShell.GetContentsAs("text/plain", encoderFlags);

       //DEBUG_LOG("enigmailMsgComposeOverlay.js: docText["+encoderFlags+"] = '"+docText+"'\n");

       if (!docText) {
         // No encryption or signing for null text
         sendFlags &= ~ENIG_ENCRYPT_OR_SIGN;

       } else {
         // Encrypt plaintext
         var charset = gEnigEditorShell.GetDocumentCharacterSet();
         DEBUG_LOG("enigmailMsgComposeOverlay.js: charset="+charset+"\n");

         // Encode plaintext to charset from unicode
         var plainText = EnigConvertFromUnicode(docText, charset);

         var exitCodeObj    = new Object();
         var statusFlagsObj = new Object();    
         var errorMsgObj    = new Object();

         var cipherText = enigmailSvc.encryptMessage(window,uiFlags, plainText,
                                                fromAddr, toAddr, sendFlags,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);

         var exitCode = exitCodeObj.value;
    
         if ((exitCode != 0) && defaultSend && (sendFlags & ENIG_ENCRYPT) &&
             !(statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) ) {
           // Default send error; turn off encryption
           sendFlags &= ~ENIG_ENCRYPT;

           if (!EnigGetPref("defaultSignMsg") &&
               (defaultEncryptionOption < 2) ) {
             // Turn off signing
             sendFlags &= ~ENIG_SIGN;
           }

           if (sendFlags & ENIG_SIGN) {
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
           enigReplaceEditorText( EnigConvertToUnicode(cipherText, charset) );

           // Save original text (for undo)
           gEnigProcessed = {"docText":docText};

         } else if (sendFlags & ENIG_ENCRYPT_OR_SIGN) {
           // Encryption/signing failed
           EnigAlert("Send operation aborted.\n\n"+errorMsgObj.value);
           return;
         }
       }
     }

     // EnigSend: Handle both plain and encrypted messages below
     var isOffline = (gIOService && gIOService.offline);

     if (EnigGetPref("confirmBeforeSend") ||
         (sendFlags & nsIEnigmail.SEND_WITH_CHECK) ) {
       var msgStatus = "";

       if (sendFlags & nsIEnigmail.SEND_PGP_MIME)
         msgStatus += "PGP/MIME ";

       if (sendFlags & ENIG_SIGN)
         msgStatus += "SIGNED ";

       if (sendFlags & ENIG_ENCRYPT)
         msgStatus += "ENCRYPTED ";

       if (!msgStatus)
         msgStatus = "PLAINTEXT ";

       var msgConfirm = isOffline ? "Save "+msgStatus+"message to "+toAddrAll+" in Unsent Messages folder?\n"
                                  :"Send "+msgStatus+"message to "+toAddrAll+"?\n";

       if (!EnigConfirm(msgConfirm)) {
         if (gEnigProcessed)
           enigUndoEncryption();

         return;
       }

     } else if (isOffline &&
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

  var enigmailHeaders = "X-Enigmail-Version: "+gEnigmailVersion+"\r\n"+
                        "X-Enigmail-Supports: pgp-inline, pgp-mime\r\n";

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

  var encoderFlags = EnigOutputFormatted | EnigOutputLFLineBreak;

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
      quoteOffset = enigGetChildOffset(quoteElement.parentNode, quoteElement);

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
function enigGetChildOffset(parentNode, childNode) {
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

function EnigDocStateListener()
{
}

EnigDocStateListener.prototype = {

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
