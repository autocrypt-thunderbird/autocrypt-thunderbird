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
var gEnigEditorElement, gEnigEditorShell, gEnigEditor;
var gEnigDirty, gEnigProcessed, gEnigTimeoutID;
var gEnigSendPGPMime;
var gEnigModifiedAttach;

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

  enigSetImmediateSendMenu();

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

  if (gEnigEditorShell) {
   // Mozilla 1.2.1 and earlier
    var docStateListener = new EnigDocStateListener();

    gEnigEditorShell.RegisterDocumentStateListener(docStateListener);

  } else {
   // Mozilla 1.3a and later
    var composeStateListener = new EnigComposeStateListener();

    gMsgCompose.RegisterStateListener(composeStateListener);
  }

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


function enigSetImmediateSendMenu() {
  // initialize send now/later
  var immediate = (EnigGetPref("sendImmediately") ? 1 : 0);

  var menuItem = document.getElementById("enigmail_"+gEnigImmediateSendOptions[immediate]);
  if (menuItem)
    menuItem.setAttribute("checked", "true");
}

function enigInitSendOptionsMenu() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigInitSendOptionsMenu\n");

  enigInitRadioMenu('defaultEncryptionOption', gEnigDefaultEncryptionOptions);

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

function engiSendImmediately(value) {
  DEBUG_LOG("enigmailMessengerOverlay.js: engiSendImmediately: "+value+"\n");

  EnigSetPref("sendImmediately", value);

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

  var text = EnigGetString("keysToExport");
  var retObj = new Object();
  var checkObj = new Object();

  if (userIdValue)
    retObj.value = userIdValue;

  var proceed = gEnigPromptSvc.prompt(window, EnigGetString("exportPrompt"),
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

  EnigEditorInsertText(EnigGetString("pubKey",userIdValue) + keyBlock);
}

function enigUndoEncryption( bucketList, modifiedAttachments ) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUndoEncryption: \n");

  if (gEnigProcessed) {
    enigReplaceEditorText(gEnigProcessed.origText);

    gEnigProcessed = null;

  } else {
    enigDecryptQuote(true);
  }

  if ( modifiedAttachments && bucketList && bucketList.hasChildNodes() ) {
    // undo inline encryption of attachments
    var node = bucketList.firstChild;
    while (node) {
      for (var i in modifiedAttachments) {
        if (node.attachment.url == modifiedAttachments[i].newUrl) {
          node.attachment.url = modifiedAttachments[i].origUrl;
          node.attachment.name = modifiedAttachments[i].origName;
          node.attachment.temporary = modifiedAttachments[i].origTemp;
          node.attachment.contentType = modifiedAttachments[i].origCType;

          // delete encrypted file
          try {
            modifiedAttachments[i].newFile.remove(false);
          }
          catch (ex) {}
        }
      }
      node=node.nextSibling;
    }

    modifiedAttachments = null;
  }
}

function enigReplaceEditorText(text) {
  EnigEditorSelectAll();

  // Overwrite text in clipboard for security
  // (Otherwise plaintext will be available in the clipbaord)
  EnigEditorInsertText("Enigmail");
  EnigEditorSelectAll();

  EnigEditorInsertText(text);
}

function enigGetUserList(window, sendFlags, exitCodeObj, statusFlagsObj, errorMsgObj) {

  var aUserList = new Array();
  try {
    var enigmailSvc = GetEnigmailSvc();
    var userText = enigmailSvc.getUserIdList(window, sendFlags,
                                            exitCodeObj,
                                            statusFlagsObj,
                                            errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(errorMsgObj.value);
      return null;
    }

    userText.replace(/\r\n/g, "\n");
    userText.replace(/\r/g, "\n");
    var removeIndex=userText.indexOf("----\n");
    userText = userText.substring(removeIndex + 5);

    while (userText.length >0) {
        var theLine=userText.substring(0,userText.indexOf("\n"));
        theLine.replace(/\n/, "");
        if (theLine.length>0) {
          aUserList.push(theLine.split(/\:/)); ///
        }
        userText=userText.substring(theLine.length+1);
    }
  } catch (ex) {}
   
  return aUserList;
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

  enigSend(sendFlags, elementId);
}


function enigSend(sendFlags, elementId) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: "+sendFlags+"\n");

  if (gWindowLocked) {
    EnigAlert(EnigGetString("windowLocked"));
    return;
  }

  if (gEnigDirty) {
    // make sure the sendFlags are reset before the message is processed
    // (it may have been set by a previously aborted send operation!)
    try {
      gMsgCompose.compFields.securityInfo.sendFlags=0;
    }
    catch (ex){
      try {
        var newSecurityInfo = Components.classes[ENIG_ENIGMSGCOMPFIELDS_CONTRACTID].createInstance(Components.interfaces.nsIEnigMsgCompFields);
        if (newSecurityInfo) {
          newSecurityInfo.sendFlags=0;
          gMsgCompose.compFields.securityInfo = newSecurityInfo;
        }
      }
      catch (ex) {}
    }
  }
  gEnigDirty = true;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     if (EnigConfirm(EnigGetString("sendUnencrypted")))
        goDoCommand('cmd_sendButton');

     return;
  }

  try {
     var exitCodeObj    = new Object();
     var statusFlagsObj = new Object();
     var errorMsgObj    = new Object();
     gEnigModifiedAttach = null;

     var defaultEncryptionOption = EnigGetPref("defaultEncryptionOption");
     var recipientsSelectionOption = EnigGetPref("recipientsSelectionOption");

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

     var optSendFlags = 0;
     var inlineEncAttach=false;

     if (EnigGetPref("alwaysTrustSend")) {
       optSendFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;
     }

     if (EnigGetPref("encryptToSelf")) {
       optSendFlags |= nsIEnigmail.SEND_ENCRYPT_TO_SELF;
     }

     sendFlags |= optSendFlags;

     if (elementId && (elementId=="cmd_sendNow" || elementId=="cmd_sendLater")) {
       // sending was triggered by standard send now / later menu
       if (elementId=="cmd_sendLater")
            sendFlags |= nsIEnigmail.SEND_LATER;
     }
     else {
       if (!EnigGetPref("sendImmediately"))
           sendFlags |= nsIEnigmail.SEND_LATER;
     }
     var currentId = getCurrentIdentity();
     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: currentId="+currentId+
               ", "+currentId.email+"\n");

     var fromAddr = currentId.email;

     if (!EnigGetPref("userIdFromAddr")) {
       var userIdValue = EnigGetPref("userIdValue");

       if (!userIdValue) {

         var mesg = EnigGetString("composeSpecifyEmail");

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

     if (msgCompFields.bcc) {
       toAddrList.push(msgCompFields.bcc);

       var bccLC = enigStripEmail(msgCompFields.bcc).toLowerCase()
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: BCC: "+bccLC+"\n");

       var selfBCC = fromAddr && (fromAddr.toLowerCase() == bccLC);

       if (selfBCC) {
         DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: Self BCC\n");

       } else if (sendFlags & ENIG_ENCRYPT) {
         // BCC and encryption

         if (defaultSend) {
           sendFlags &= ~ENIG_ENCRYPT;
           DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: No default encryption because of BCC\n");

         } else {
           if (!EnigConfirm(EnigGetString("sendingBCC"))) {
             return;
           }
         }
       }
     }

     if (newsgroups) {
       toAddrList.push(newsgroups);

       if (sendFlags & ENIG_ENCRYPT) {

         if (!defaultSend) {
           EnigAlert(EnigGetString("sendingNews"));
           return;
         }

         sendFlags &= ~ENIG_ENCRYPT;
         DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: No default encryption because of newsgroups\n");

       }
     }

     var toAddr = toAddrList.join(", ");

     if (toAddr.length>=1) {
    
        DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: toAddr="+toAddr+"\n");

        if ((defaultSend || recipientsSelectionOption>0) && (sendFlags & ENIG_ENCRYPT) ) {
          // Encrypt test message for default encryption
          var testExitCodeObj    = new Object();
          var testStatusFlagsObj = new Object();    
          var testErrorMsgObj    = new Object();

          var testPlain = "Test Message";
          var testUiFlags   = nsIEnigmail.UI_TEST;
          var testSendFlags = nsIEnigmail.SEND_ENCRYPTED |
                              nsIEnigmail.SEND_TEST |
                              optSendFlags;

          if (defaultSend  || recipientsSelectionOption==1) {
            // test recipients
            var testCipher = enigmailSvc.encryptMessage(window, testUiFlags,
                                                          testPlain,
                                                          fromAddr, toAddr,
                                                          testSendFlags,
                                                          testExitCodeObj,
                                                          testStatusFlagsObj,
                                                          testErrorMsgObj);

          }

          if ((recipientsSelectionOption==2 ) || ((testStatusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) && (recipientsSelectionOption>0))) {

              var aUserList = enigGetUserList(window, testSendFlags,
                                                        testExitCodeObj,
                                                        testStatusFlagsObj,
                                                        testErrorMsgObj);

              if (!aUserList) return;
              var resultObj = new Object();
              var inputObj = new Object();
              inputObj.userList = aUserList;
              inputObj.toAddr = toAddr;

              window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
              try {
                toAddr = resultObj.userList.join(", ");
                testCipher="ok";
                testExitCodeObj.value = 0;
                if (! resultObj.encrypt) {
                  // encryption explicitely turned off
                  sendFlags &= ~ENIG_ENCRYPT;
                }
              } catch (ex) {
                // cancel pressed -> don't send mail
                return;
              }
          }
          if ((!testCipher || (testExitCodeObj.value != 0)) && recipientsSelectionOption==0) {
              // Test encryption failed; turn off default encryption
              sendFlags &= ~ENIG_ENCRYPT;
              DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: No default encryption because test failed\n");
          }
        }

        if (defaultSend && (sendFlags & ENIG_SIGN) &&
                            !(sendFlags & ENIG_ENCRYPT) &&
                            !EnigGetPref("defaultSignMsg") ) {
          // Default encryption turned off; turn off signing as well
          sendFlags &= ~ENIG_SIGN;
        }
     }

     if (!gEnigProcessed) {
/////////////////////////////////////////////////////////////////////////
// The following spellcheck logic is from the function
// GenericSendMessage from the file MsgComposeCommands.js
/////////////////////////////////////////////////////////////////////////
       if (gEnigPrefRoot.getBoolPref("mail.SpellCheckBeforeSend")) {
        // We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
        // therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
         if (gEnigEditorShell) {

           gEnigEditorShell.contentWindow.focus();
         } else {

            window.content.focus();
         }

         window.cancelSendMessage = false;
         try {
           window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank", "chrome,close,titlebar,modal", true);
         } catch(ex){}

         if(window.cancelSendMessage)
           return;
       }
     }

     var usePGPMimeOption = EnigGetPref("usePGPMimeOption");

     if (gEnigSendPGPMime) {
       // Use PGP/MIME
       sendFlags |= nsIEnigmail.SEND_PGP_MIME;
     }

     var bucketList = document.getElementById("attachmentBucket");
     var hasAttachments = bucketList && bucketList.hasChildNodes();

     DEBUG_LOG("enigmailMsgComposeOverlay.js: hasAttachments = "+hasAttachments+"\n");

     if ( hasAttachments &&
        (sendFlags & ENIG_ENCRYPT_OR_SIGN) &&
        !(sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
        enigmailSvc.composeSecure) {

        var inputObj = new Object();
        inputObj.pgpMimePossible = (usePGPMimeOption >= PGP_MIME_POSSIBLE);
        inputObj.inlinePossible = (sendFlags & ENIG_ENCRYPT); // makes no sense for sign only!

        // determine if attachments are all local (currently the only
        // supported kind of attachments)
        var node = bucketList.firstChild;
        while (node) {
          if (node.attachment.url.substring(0,7) != "file://") {
             inputObj.inlinePossible = false;
          }
          node = node.nextSibling;
        }

        if (inputObj.pgpMimePossible || inputObj.inlinePossible) {
          var resultObj = new Object();
          resultObj.selected = -1;
          window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
          if (resultObj.selected < 0) {
            // dialog cancelled
            return;
          }
          else if (resultObj.selected == 1) {
            // encrypt attachments
            inlineEncAttach=true;
          }
          else if (resultObj.selected == 2) {
            // send as PGP/MIME
            sendFlags |= nsIEnigmail.SEND_PGP_MIME;
          }
        }
        else {
          if (sendFlags & ENIG_ENCRYPT) {
            if (!EnigConfirm(EnigGetString("attachWarning")))
              return;
          }
        }
     }

     var usingPGPMime = (sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
                        (sendFlags & ENIG_ENCRYPT_OR_SIGN);

     if (usingPGPMime && !enigmailSvc.composeSecure) {
       if (!EnigConfirm(EnigGetString("noPGPMIME"))) {
          throw Components.results.NS_ERROR_FAILURE;

       }

       usingPGPMime = false;
     }

     var uiFlags = nsIEnigmail.UI_INTERACTIVE;

     if (usingPGPMime)
       uiFlags |= nsIEnigmail.UI_PGP_MIME;

     if ( usingPGPMime ||
          (!hasAttachments && EnigGetPref("useMimeExperimental"))) {
       // Use EnigMime
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: Using EnigMime, flags="+sendFlags+"\n");

       var oldSecurityInfo = gMsgCompose.compFields.securityInfo;

       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: oldSecurityInfo = "+oldSecurityInfo+"\n");

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

       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: securityInfo = "+newSecurityInfo+"\n");

     } else if (!gEnigProcessed && (sendFlags & ENIG_ENCRYPT_OR_SIGN)) {

       if (gMsgCompose.composeHTML) {
         var errMsg = EnigGetString("hasHTML");

         EnigAlertCount("composeHtmlAlertCount", errMsg);
       }

       try {
         var convert = DetermineConvertibility();
         if (convert == nsIMsgCompConvertible.No) {
           if (!EnigConfirm(EnigGetString("strippingHTML")))
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

       // Get plain text
       // (Do we need to set the nsIDocumentEncoder::* flags?)
       var origText = EnigEditorGetContentsAs("text/plain",
                                                     encoderFlags);

       // Copy plain text for possible escaping
       var escText = origText;

       if (sendFlowed) {
         // Prevent space stuffing a la RFC 2646 (format=flowed).

         //DEBUG_LOG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

         // MULTILINE MATCHING ON
         RegExp.multiline = true;

         escText = escText.replace(/^From /g, "~From ");
         escText = escText.replace(/^>/g, "|");
         escText = escText.replace(/^[ \t]+$/g, "");
         escText = escText.replace(/^ /g, "~ ");

         // MULTILINE MATCHING OFF
         RegExp.multiline = false;

         //DEBUG_LOG("enigmailMsgComposeOverlay.js: escText = '"+escText+"'\n");
         // Replace plain text and get it again
         enigReplaceEditorText(escText);

         escText = EnigEditorGetContentsAs("text/plain", encoderFlags);
       }

       // Replace plain text and get it again (to avoid linewrapping problems)
       enigReplaceEditorText(escText);

       escText = EnigEditorGetContentsAs("text/plain", encoderFlags);

       //DEBUG_LOG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

       if (!escText) {
         // No encryption or signing for null text
         sendFlags &= ~ENIG_ENCRYPT_OR_SIGN;

       } else {
         // Encrypt plaintext
         var charset = EnigEditorGetCharset();
         DEBUG_LOG("enigmailMsgComposeOverlay.js: charset="+charset+"\n");

         // Encode plaintext to charset from unicode
         var plainText = (sendFlags & ENIG_ENCRYPT)
                         ? EnigConvertFromUnicode(origText, charset)
                         : EnigConvertFromUnicode(escText, charset);

         exitCodeObj    = new Object();
         statusFlagsObj = new Object();
         errorMsgObj    = new Object();

         var cipherText = enigmailSvc.encryptMessage(window,uiFlags, plainText,
                                                fromAddr, toAddr, sendFlags,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);

         var exitCode = exitCodeObj.value;

         //DEBUG_LOG("enigmailMsgComposeOverlay.js: cipherText = '"+cipherText+"'\n");
         if (cipherText && (exitCode == 0)) {
           // Encryption/signing succeeded; overwrite plaintext

           if ( (sendFlags & ENIG_ENCRYPT) && charset &&
                (charset.search(/^us-ascii$/i) != 0) ) {
             // Add Charset armor header for encrypted blocks
             cipherText = cipherText.replace(/(-----BEGIN PGP MESSAGE----- *)(\r?\n)/, "$1$2Charset: "+charset+"$2");

           }

           // Decode ciphertext from charset to unicode and overwrite
           enigReplaceEditorText( EnigConvertToUnicode(cipherText, charset) );

           // Save original text (for undo)
           gEnigProcessed = {"origText":origText, "charset":charset};

         } else {
           // Restore original text
           enigReplaceEditorText(origText);

           if (sendFlags & ENIG_ENCRYPT_OR_SIGN) {
             // Encryption/signing failed
             EnigAlert(EnigGetString("sendAborted")+errorMsgObj.value);
             return;
           }
         }

         if (inlineEncAttach) {
            // encrypt attachments
            gEnigModifiedAttach = new Array();
            var exitCode = enigEncryptAttachments(bucketList, gEnigModifiedAttach,
                                    window, uiFlags, fromAddr, toAddr, sendFlags,
                                    errorMsgObj);
            if (exitCode != 0) {
              gEnigModifiedAttach = null;
              if (errorMsgObj.value) {
                EnigAlert(EnigGetString("sendAborted")+errorMsgObj.value);
              }
              else {
                EnigAlert(EnigGetString("sendAborted")+"an internal error has occurred");
              }
              if (gEnigProcessed)
                enigUndoEncryption(bucketList, gEnigModifiedAttach);
              return;
            }
         }
       }
     }

     // EnigSend: Handle both plain and encrypted messages below
     var isOffline = (gIOService && gIOService.offline);

     if (EnigGetPref("confirmBeforeSend")) {
       var msgStatus = "";

       if (sendFlags & ENIG_ENCRYPT_OR_SIGN) {
         if (sendFlags & nsIEnigmail.SEND_PGP_MIME)
           msgStatus += EnigGetString("statPGPMIME")+" ";

         if (sendFlags & ENIG_SIGN)
           msgStatus += EnigGetString("statSigned")+" ";

         if (sendFlags & ENIG_ENCRYPT)
           msgStatus += EnigGetString("statEncrypted")+" ";

       } else {
         msgStatus += EnigGetString("statPlain")+" ";
       }

       var msgConfirm = isOffline ? EnigGetString("offlineSave",msgStatus,toAddr)
                                  :EnigGetString("onlineSend",msgStatus,toAddr);

       if (!EnigConfirm(msgConfirm)) {
         if (gEnigProcessed)
           enigUndoEncryption(bucketList, gEnigModifiedAttach);

         return;
       }

     } else if (isOffline &&
                !EnigConfirm(EnigGetString("offlineNote")) ) {
       // Abort send
       if (gEnigProcessed)
         enigUndoEncryption(bucketList, gEnigModifiedAttach);

       return;

     } else if ( (sendFlags & nsIEnigmail.SEND_WITH_CHECK) &&
                 !enigMessageSendCheck() ) {
       // Abort send
       if (gEnigProcessed)
         enigUndoEncryption(bucketList, gEnigModifiedAttach);

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
     if (EnigConfirm(EnigGetString("signFailed")))
       goDoCommand('cmd_sendButton');
  }
}

function enigMessageSendCheck() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMessageSendCheck\n");

  try {
    var warn = sPrefs.getBoolPref("mail.warn_on_send_accel_key");

    if (warn) {
        var checkValue = {value:false};
        var buttonPressed = gEnigPromptSvc.confirmEx(window,
              sComposeMsgsBundle.getString('sendMessageCheckWindowTitle'),
              sComposeMsgsBundle.getString('sendMessageCheckLabel'),
              (gEnigPromptSvc.BUTTON_TITLE_IS_STRING * gEnigPromptSvc.BUTTON_POS_0) +
              (gEnigPromptSvc.BUTTON_TITLE_CANCEL * gEnigPromptSvc.BUTTON_POS_1),
              sComposeMsgsBundle.getString('sendMessageCheckSendButtonLabel'),
              null, null,
              sComposeMsgsBundle.getString('CheckMsg'), 
              checkValue);
        if (buttonPressed != 0) {
            return false;
        }
        if (checkValue.value) {
            sPrefs.setBoolPref("mail.warn_on_send_accel_key", false);
        }
    }
  } catch (ex) {}

  return true;
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

      var event = document.createEvent('Events');
      event.initEvent('compose-send-message', false, true);
      document.getElementById("msgcomposeWindow").dispatchEvent(event);

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
          if (gEnigPromptSvc)
          {
            var result = {value:sComposeMsgsBundle.getString("defaultSubject")};
            if (gEnigPromptSvc.prompt(
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

      // hook for extra compose pre-processing
      var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
      observerService.notifyObservers(window, "mail:composeOnSend", null);

      if (gEnigProcessed) {
        // Ensure that original charset is preserved for encrypted messages
        gMsgCompose.SetDocumentCharset(gEnigProcessed.charset);

      } else {
        // Check if the headers of composing mail can be converted to a mail charset.
        if (msgType == nsIMsgCompDeliverMode.Now || 
          msgType == nsIMsgCompDeliverMode.Later ||
          msgType == nsIMsgCompDeliverMode.Save || 
          msgType == nsIMsgCompDeliverMode.SaveAsDraft || 
          msgType == nsIMsgCompDeliverMode.SaveAsTemplate) 
        {
          var fallbackCharset = new Object;
          if (gPromptService && 
              !gMsgCompose.checkCharsetConversion(getCurrentIdentity(), fallbackCharset)) 
          {
            var dlgTitle = sComposeMsgsBundle.getString("initErrorDlogTitle");
            var dlgText = sComposeMsgsBundle.getString("12553");  // NS_ERROR_MSG_MULTILINGUAL_SEND
            if (!gPromptService.confirm(window, dlgTitle, dlgText))
              return;
          }
          if (fallbackCharset &&
              fallbackCharset.value && fallbackCharset.value != "")
            gMsgCompose.SetDocumentCharset(fallbackCharset.value);
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

// encrypt attachments when sending inline PGP mails
// It's quite a hack: the attachments are stored locally
// and the attachments list is modified to pick up the
// encrypted file(s) instead of the original ones.
function enigEncryptAttachments(bucketList, newAttachments, window, uiFlags,
                                fromAddr, toAddr, sendFlags,
                                errorMsgObj) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptAttachments\n");
  var ioServ;
  var fileTemplate;
  errorMsgObj.value="";

  try {
    ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
    if (!ioServ)
        return -1;

  } catch (ex) {
    return -1;
  }

  var tmpDir=EnigGetTempDir();
  var extAppLauncher = Components.classes[ENIG_MIME_CONTRACTID].getService(Components.interfaces.nsPIExternalAppLauncher);

  try {
    fileTemplate = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
    fileTemplate.initWithPath(tmpDir);
    if (!(fileTemplate.isDirectory() && fileTemplate.isWritable())) {
      errorMsgObj.value=EnigGetString("noTempDir");
      return -1;
    }
    fileTemplate.append("encfile");
  }
  catch (ex) {
    errorMsgObj.value=EnigGetString("noTempDir");
    return -1;
  }
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptAttachments tmpDir=" + tmpDir+"\n");
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return null;

  var exitCodeObj = new Object();
  var statusFlagsObj = new Object();

  var node = bucketList.firstChild;
  while (node) {
    var origUrl = node.attachment.url;
    if (origUrl.substring(0,7) != "file://") {
      // this should actually never happen since it is pre-checked!
      errorMsgObj.value="The attachment '"+node.attachment.name+"' is not a local file";
      return -1;
    }

    // transform attachment URL to platform-specific file name
    var origUri = ioServ.newURI(origUrl, null, null);
    var origFile=origUri.QueryInterface(Components.interfaces.nsIFileURL);
    if (node.attachment.temporary) {
      try {
        var origLocalFile=Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
        origLocalFile.initWithPath(origFile.file.path);
        extAppLauncher.deleteTemporaryFileOnExit(origLocalFile);
      }
      catch (ex) {}
    }

    var newFile = fileTemplate.clone();
    var txtMessgae;
    try {
      newFile.createUnique(Components.interfaces.NORMAL_FILE_TYPE, 0600);
      txtMessage = enigmailSvc.encryptAttachment(window, fromAddr, toAddr, sendFlags,
                                origFile.file.path, newFile.path,
                                exitCodeObj, statusFlagsObj,
                                errorMsgObj);
    } catch (ex) {}

    if (exitCodeObj.value != 0 || statusFlagsObj.value != 0) {
      return -1;
    }

    var fileInfo = new Object();
    fileInfo.origFile  = origFile;
    fileInfo.origUrl   = node.attachment.url;
    fileInfo.origName  = node.attachment.name;
    fileInfo.origTemp  = node.attachment.temporary;
    fileInfo.origCType = node.attachment.contentType;

    // transform platform specific new file name to file:// URL
    var newUri = ioServ.newFileURI(newFile);
    fileInfo.newUrl  = newUri.asciiSpec;
    fileInfo.newFile = newFile;

    newAttachments.push(fileInfo);
    node = node.nextSibling;
  }

  // if we got here, all attachments were encrpted successfully,
  // so we replace their names & urls
  node = bucketList.firstChild;
  var i=0;
  while (node) {
    node.attachment.url = newAttachments[i].newUrl;
    node.attachment.name += EnigGetPref("inlineAttachExt");
    node.attachment.contentType="application/octet-stream";
    node.attachment.temporary=true;

    ++i; node = node.nextSibling;
  }

  return 0;

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

  var docText = EnigEditorGetContentsAs("text/plain", encoderFlags);

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

  var charset = EnigEditorGetCharset();
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

  var doubleDashSeparator = EnigGetPref("doubleDashSeparator")
  if (doubleDashSeparator) {
    var signOffset = plainText.search(/[\r\n]-- +[\r\n]/);

    if (signOffset > 0) {
      // Strip signature portion of quoted message
      plainText = plainText.substr(0, signOffset+1);
    }
  }

  // Replace encrypted quote with decrypted quote
  EnigEditorSelectAll();

  //DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: plainText='"+plainText+"'\n");

  if (head)
    EnigEditorInsertText(head);

  var quoteElement;

  if (indentStr) {
    quoteElement = EnigEditorInsertAsQuotation(plainText);

  } else {
    EnigEditorInsertText(plainText);
  }

  if (tail)
    EnigEditorInsertText(tail);

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

  var selCon = gEnigEditor ? gEnigEditor.selectionController
                           : gEnigEditorShell.selectionController;

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
        EnigEditorSelectAll();
      }
      break;

    default:
      // Position at beginning of document

      if (gEnigEditor) {
        gEnigEditor.beginningOfDocument();

      } else if (gEnigEditorShell.editor) {
        gEnigEditorShell.editor.beginningOfDocument();
      }

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

function EnigEditorInsertText(plainText) {
  if (gEnigEditor) {
    gEnigEditor.insertText(plainText);
  } else {
    gEnigEditorShell.InsertText(plainText);
  }
}

function EnigEditorInsertAsQuotation(plainText) {
  if (gEnigEditor) {
    var mailEditor;
    try {
      mailEditor = gEnigEditor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
    } catch (ex) {};

    if (!mailEditor)
      return null;

    DEBUG_LOG("enigmailMsgComposeOverlay.js: EnigEditorInsertAsQuotation: mailEditor="+mailEditor+"\n");

    return mailEditor.insertAsQuotation(plainText);
    
  } else {
    var nodeObj = new Object();
    gEnigEditorShell.InsertAsQuotation(plainText, nodeObj);
    return nodeObj.value;
  }
}


function EnigEditorSelectAll() {
  if (gEnigEditor) {
    gEnigEditor.selectAll();
  } else {
    gEnigEditorShell.SelectAll();
  }
}

function EnigEditorGetCharset() {
  return gEnigEditor ? gEnigEditor.documentCharacterSet
                     : gEnigEditorShell.GetDocumentCharacterSet();
}

function EnigEditorGetContentsAs(mimeType, flags) {
  if (gEnigEditor) {
    return gEnigEditor.outputToString(mimeType, flags);
  } else {
    return gEnigEditorShell.GetContentsAs(mimeType, flags);
  }
}

function EnigComposeStateListener() {
}

EnigComposeStateListener.prototype = {
  NotifyComposeFieldsReady: function() {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyComposeFieldsReady\n");

    var editor;
    try {
      gEnigEditor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditor);
    } catch (ex) {}

    if (!gEnigEditor)
      return;

    var docStateListener = new EnigDocStateListener();

    gEnigEditor.addDocumentStateListener(docStateListener);
  },

  ComposeProcessDone: function(aResult) {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: ComposeProcessDone\n");

    if (aResult== Components.results.NS_OK) {
    }
   
  },

  SaveInFolderDone: function(folderURI) {
  }
};

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

    var ioServ;
    try {
      // we should delete the original temporary files of the encrypted
      // inline PGP attachments (the rest is done automatically)
      if (this.modifiedAttachments) {
        ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        if (!ioServ)
          return;

        for (var i in modifiedAttachments) {
          if (modifiedAttachments[i].origTemp) {
            var fileUri = ioServ.newURI(modifiedAttachments[i].origUrl, null, null);
            var fileHandle=fileUri.QueryInterface(Components.interfaces.nsIFileURL);
            fileHandle.remove(false);
          }
        }
      }

    } catch (ex) {}
  },

  NotifyDocumentStateChanged: function (nowDirty)
  {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged: "+nowDirty+"\n");

    var isEmpty, isEditable;

    if (gEnigEditorShell) {
      // Mozilla 1.0 branch: gMsgCompose.editor => nsIEditorShell
      isEmpty    = !gEnigEditorShell.documentLength;
      isEditable = gEnigEditorShell.documentEditable;

    } else {
      // Mozilla 1.3a and later: gMsgCompose.editor => nsIEditor
      isEmpty    = gEnigEditor.documentIsEmpty;
      isEditable = gEnigEditor.isDocumentEditable;
    }

    if (gEnigModifiedAttach) {
      this.modifiedAttachments = gEnigModifiedAttach;
    }
      
    DEBUG_LOG("enigmailMsgComposeOverlay.js: NotifyDocumentStateChanged: isEmpty="+isEmpty+", isEditable="+isEditable+"\n");

    if (!isEditable || isEmpty)
      return;

    if (!gEnigTimeoutID && !gEnigDirty)
      gEnigTimeoutID = window.setTimeout(enigDecryptQuote, 10, false);
  }

}
