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
  "enigmail_encrypt_sign_send": nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED,
  "cmd_saveAsDraft":         nsIEnigmail.SEND_DEFAULT,
  "cmd_saveDefault":         nsIEnigmail.SEND_DEFAULT,
  "cmd_saveAsTemplate":         nsIEnigmail.SEND_DEFAULT,
  };

var gEnigEncryptModeItems = ["plain_send",
                             "encrypt_if_possible",
                             "encrypted_send"];
var gEnigSignModeItems = ["send_not_signed",
                          "signed_send",
                          "sign_if_enc_send"];


var gEnigEditorElement, gEnigEditor;
var gEnigDirty, gEnigProcessed, gEnigTimeoutID;
var gEnigSendPGPMime, gEnigModifiedAttach, gEnigSendMode;
var gEnigSendModeDirty=false;
var gEnigNextCommand;

window.addEventListener("load", enigMsgComposeStartup, false);

// Handle recycled windows
window.addEventListener('compose-window-close', enigMsgComposeClose, true);
window.addEventListener('compose-window-reopen', enigMsgComposeReopen, true);

function enigMsgComposeStartup() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");

  // Relabel/hide SMIME button and menu item
  var smimeButton = document.getElementById("button-security");

  if (smimeButton) {
    smimeButton.setAttribute("label", "S/MIME");
  }

  var enigButton = document.getElementById("button-enigmail-send");
  if (enigButton && smimeButton) {
    if (enigButton.getAttribute("buttontype")=="seamonkey") {
      if (EnigGetPref("disableSMIMEui"))
          smimeButton.setAttribute("collapsed", "true");
    }
  }
  // Override send command
  var sendElementIds = ["cmd_sendButton", "cmd_sendNow", "cmd_sendWithCheck",
                        "cmd_sendLater", "cmd_saveAsDraft", "cmd_saveDefault",
                        "cmd_saveAsTemplate"];

  EnigOverrideAttribute( sendElementIds, "oncommand",
                         "enigSendCommand('", "');");


  EnigOverrideAttribute( ["msgcomposeWindow"], "onclose",
                        "return enigDoCommandClose('", "')");

  // Get editor shell
  gEnigEditorElement = document.getElementById("content-frame");
  DEBUG_LOG("enigmailMsgComposeOverlay.js: gEnigEditorElement = "+gEnigEditorElement+"\n");

  var composeStateListener = new EnigComposeStateListener();

  gMsgCompose.RegisterStateListener(composeStateListener);

  var msgId = document.getElementById("msgIdentityPopup");
  if (msgId) msgId.setAttribute("oncommand", "enigSetIdentityCallback();");


  enigMsgComposeReset();

  enigComposeOpen();
}

function enigDisplayUi() {

  var statusBar = document.getElementById("enigmail-status-bar");

  if (!getCurrentIdentity().getBoolAttribute("enablePgp")) {
    // hide icons if enigmail not enabled
    statusBar.removeAttribute("signed");
    statusBar.removeAttribute("encrypted");
    return;
  }

  var signedIcon = document.getElementById("enigmail-signed-status");
  var encryptedIcon = document.getElementById("enigmail-encrypted-status");

  if (gEnigSendMode & EnigSigned) {
    statusBar.setAttribute("signed", "ok");
    signedIcon.setAttribute("tooltiptext", EnigGetString("signYes"));
  }
  else if (gEnigSendMode & EnigSignIfEncrypted) {
    statusBar.setAttribute("signed", "ifencrypted");
    signedIcon.setAttribute("tooltiptext", EnigGetString("signIfEncrypted"));
  }
  else {
    statusBar.setAttribute("signed", "inactive");
    signedIcon.setAttribute("tooltiptext", EnigGetString("signNo"));
  }

  if (gEnigSendMode & EnigEncrypt) {
    statusBar.setAttribute("encrypted", "ok");
    encryptedIcon.setAttribute("tooltiptext", EnigGetString("encryptYes"));
  }
  else if (gEnigSendMode & EnigEncryptIfPossible) {
    statusBar.setAttribute("encrypted", "unknown");
    encryptedIcon.setAttribute("tooltiptext", EnigGetString("encryptMaybe"));
  }
  else {
    statusBar.setAttribute("encrypted", "inactive");
    encryptedIcon.setAttribute("tooltiptext", EnigGetString("encryptNo"));
  }
}

function enigHandleClick(event, modifyType) {
  switch (event.button) {
  case 2:
    enigDoPgpButton();
    break;
  case 0:
    enigDoPgpButton(modifyType);
    break;
  }
}


function enigSetIdentityCallback(elementId) {
  if (! gEnigSendModeDirty) {
    enigGetSendDefaultOptions();
    enigDisplayUi();
  }
}


// get the current default for sending a message
// depending on the identity
function enigGetSendDefaultOptions() {
  var currentId = getCurrentIdentity();
  gEnigSendMode = 0;
  if (! currentId.getBoolAttribute("enablePgp")) {
    return 0;
  }
  if (currentId.getIntAttribute("defaultEncryptionPolicy")>0) {
    gEnigSendMode |= EnigEncryptIfPossible
  }
  switch (EnigGetSignMsg(currentId)) {
  case 1:
    gEnigSendMode |= EnigSignIfEncrypted;
    break;
  case 2:
    gEnigSendMode |= EnigSigned;
    break;
  }
}


function enigComposeOpen() {
  if (EnigGetPref("keepSettingsForReply") && (!(gEnigSendMode & EnigEncrypt))) {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
    if (enigMimeService)
    {
      if (enigMimeService.isEncrypted(gMsgCompose.originalMsgURI)) {
        enigSetSendMode('encrypt');
      }
    }

  }

  enigDisplayUi();
}


function enigMsgComposeReopen() {
   DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeReopen\n");
   enigMsgComposeReset();
   enigComposeOpen();

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

  gEnigModifiedAttach=null;
  gEnigSendModeDirty=false;

  EnigShowHeadersAll(true);

  gEnigSendPGPMime = !(EnigGetPref("usePGPMimeOption") == PGP_MIME_ALWAYS);
  enigTogglePGPMime();

  enigGetSendDefaultOptions();
  enigInitSendOptionsMenu();
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

  var optList = ["confirmBeforeSend"];

  for (var j=0; j<optList.length; j++) {
    var optName = optList[j];
    var optValue = EnigGetPref(optName);

    var menuElement = document.getElementById("enigmail_"+optName);

    menuElement.setAttribute("checked", optValue ? "true" : "false");
  }

  var currentId = getCurrentIdentity();
  var signDefault = currentId.getBoolAttribute("pgpAlwaysSign");
  document.getElementById("enigmail_pgpAlwaysSign").setAttribute("checked", signDefault);
}


function enigSetAccountOption(name, value) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDefaultEncryptionOption: "+value+"\n");

  var currentId = getCurrentIdentity();
  switch (typeof value) {
    case "boolean":
      currentId.setBoolAttribute(name, value);
      break;
    case "number":
      currentId.setIntAttribute(name, value);
      break;
    case "string":
      currentId.setCharAttribute(name, value);
      break;
  }
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
}

function enigInsertKey() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigInsertKey: \n");

  var resultObj = new Object();
  var inputObj = new Object();
  inputObj.dialogHeader = EnigGetString("keysToExport");
  inputObj.options = "multisel,allowexpired,nosending";
  var userIdValue="";

  window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
  try {
    if (resultObj.cancelled) return;
    var userIdValue = resultObj.userList.join(" ");
  } catch (ex) {
    // cancel pressed -> do nothing
    return;
  }

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

function enigGoAccountManager(selectPage)
{
    var server=null;
    try {
        var currentId=getCurrentIdentity();
        var amService=Components.classes["@mozilla.org/messenger/account-manager;1"].getService();
        var servers=amService.GetServersForIdentity(currentId);
        var folderURI=servers.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer).serverURI;
        server=GetMsgFolderFromUri(folderURI, true).server
    } catch (ex) {}

    window.openDialog("chrome://messenger/content/AccountManager.xul",
                      "AccountManager", "chrome,modal,titlebar,resizable",
                      { server: server, selectPage: selectPage });
}

function enigDoPgpButton(what) {
  if (! what)
    what = gEnigNextCommand;
  gEnigNextCommand = "";
  try {
    if (!getCurrentIdentity().getBoolAttribute("enablePgp")) {
      if (EnigConfirm(EnigGetString("configureNow"))) {
          enigGoAccountManager('am-enigprefs.xul');
      }
      return;
    }
  }
  catch (ex) {}
  switch (what) {
    case 'plain':
    case 'sign':
    case 'dont-sign':
    case 'sign-if-enc':
    case 'encrypt':
    case 'enc-ifpossible':
    case 'toggle-sign':
    case 'toggle-encrypt':
      enigSetSendMode(what);
      break;

    case 'togglePGPMime':
      enigTogglePGPMime();
      break;

    default:
      enigDisplaySecuritySettings();
  }
  return;
}

function enigNextCommand(what) {
  gEnigNextCommand=what;
}

function enigSetSendMode(sendMode) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigSetSendMode\n");
  var origSendMode=gEnigSendMode;
  switch (sendMode) {
    case 'dont-sign':
      gEnigSendMode = gEnigSendMode &~ EnigSignIfEncrypted &~ EnigSigned;
      break;
    case 'sign':
      gEnigSendMode = gEnigSendMode &~ EnigSignIfEncrypted;
      gEnigSendMode |= EnigSigned;
      break;
    case 'sign-if-enc':
      gEnigSendMode = gEnigSendMode &~ EnigSigned;
      gEnigSendMode |= EnigSignIfEncrypted;
      break;
    case 'toggle-sign':
      if (gEnigSendMode & EnigSignIfEncrypted) {
        enigSetSendMode('dont-sign');
      }
      else if (gEnigSendMode & EnigSigned) {
        enigSetSendMode('sign-if-enc');
      }
      else {
        enigSetSendMode('sign');
      }
      break;
    case 'plain':
      gEnigSendMode = gEnigSendMode &~ EnigEncryptIfPossible &~ EnigEncrypt;
      break;
    case 'encrypt':
      gEnigSendMode = gEnigSendMode &~ EnigEncryptIfPossible;
      gEnigSendMode |= EnigEncrypt;
      break;
    case 'enc-ifpossible':
      gEnigSendMode = gEnigSendMode &~ EnigEncrypt;
      gEnigSendMode |= EnigEncryptIfPossible;
      break;
    case 'toggle-encrypt':
      if (gEnigSendMode & EnigEncryptIfPossible) {
        enigSetSendMode('encrypt');
      }
      else if (gEnigSendMode & EnigEncrypt) {
        enigSetSendMode('plain');
      }
      else {
        enigSetSendMode('enc-ifpossible');
      }
      break;
    default:
      break;
  }
  if (gEnigSendMode != origSendMode)
    gEnigSendModeDirty=true;
  enigDisplayUi();
}

function enigSetMenuSettings(postfix) {
  var encryptMode = gEnigSendMode &~ EnigSigned &~ EnigSignIfEncrypted;
  for (var i=0; i<gEnigEncryptModeItems.length; i++) {
    document.getElementById("enigmail_"+gEnigEncryptModeItems[i]+postfix).setAttribute("checked",(encryptMode == i));
  }

  var signMode = (gEnigSendMode &~ EnigEncryptIfPossible &~ EnigEncrypt) >> 2;
  for (var i=0; i<gEnigSignModeItems.length; i++) {
    document.getElementById("enigmail_"+gEnigSignModeItems[i]+postfix).setAttribute("checked",(signMode == i));
  }

  var menuElement = document.getElementById("enigmail_sendPGPMime"+postfix);
  if (menuElement)
    menuElement.setAttribute("checked", gEnigSendPGPMime ? "true" : "false");

  if (!postfix) {
    var enc=getCurrentIdentity().getIntAttribute("defaultEncryptionPolicy");
    document.getElementById("enigmail_defaultEncryptionNone").setAttribute("checked",(enc == 0));
    document.getElementById("enigmail_defaultEncryptionOnly").setAttribute("checked",(enc == 1));

    var sign=EnigGetSignMsg(getCurrentIdentity());
    document.getElementById("enigmail_defaultNotSigned").setAttribute("checked", (sign==0));
    document.getElementById("enigmail_defaultSignIfEnc").setAttribute("checked", (sign==1));
    document.getElementById("enigmail_pgpAlwaysSign").setAttribute("checked", (sign==2));
  }
}

function enigDisplaySecuritySettings() {

  var inputObj = { sendFlags: gEnigSendMode,
                   usePgpMime: gEnigSendPGPMime};
  window.openDialog("chrome://enigmail/content/enigmailEncryptionDlg.xul","", "dialog,modal,centerscreen", inputObj);
  gEnigSendMode = inputObj.sendFlags;
  gEnigSendPGPMime = inputObj.usePgpMime;
  enigDisplayUi();
}

function enigSendCommand(elementId) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSendCommand: id="+elementId+"\n");

  enigSend(gEnigSendMode, elementId);
}


function enigSend(gotSendFlags, elementId) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: "+gotSendFlags+"\n");

  var sendFlags=0;
  if (gotSendFlags & (EnigSigned | EnigSignIfEncrypted))
      sendFlags |= ENIG_SIGN;
  if ((gotSendFlags & EnigEncrypt) ||
      (gotSendFlags & EnigEncryptIfPossible)) {
    sendFlags |= ENIG_ENCRYPT;
  }
  var encryptIfPossible = (gotSendFlags & EnigEncryptIfPossible);
  if (elementId.indexOf("cmd_save")==0) {
    if ((sendFlags & ENIG_ENCRYPT) && EnigConfirm(EnigGetString("savingMessage"))) {
      sendFlags |= nsIEnigmail.SAVE_MESSAGE;
    }
    else {
      goDoCommand(elementId);
      return;
    }
  }

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

     var currentId = getCurrentIdentity();
     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: currentId="+currentId+
              ", "+currentId.email+"\n");
     var fromAddr = currentId.email;

     var pgpEnabled = currentId.getBoolAttribute("enablePgp");

     if (! pgpEnabled) {
        if (sendFlags & ENIG_ENCRYPT_OR_SIGN) {
          if (EnigConfirm(EnigGetString("acctNotConfigured")))
              goDoCommand('cmd_sendButton');
        }
        else {
          goDoCommand('cmd_sendButton');
        }
        return;
     }

     var recipientsSelectionOption = EnigGetPref("recipientsSelectionOption");

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

     if (currentId.getIntAttribute("pgpKeyMode")>0) {
       var userIdValue = currentId.getCharAttribute("pgpkeyId");

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
         currentId.setCharAttribute("pgpkeyId", userIdValue);

       } else {
         currentId.setIntAttribute("pgpKeyMode", 0);
       }
     }

     var msgCompFields = gMsgCompose.compFields;
     Recipients2CompFields(msgCompFields);

     // Check if sending to any newsgroups
     var newsgroups = msgCompFields.newsgroups;

     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: gMsgCompose="+gMsgCompose+"\n");

     var toAddrList = [];

     if (msgCompFields.to)  toAddrList.push(msgCompFields.to);

     if (msgCompFields.cc)  toAddrList.push(msgCompFields.cc);

     if (msgCompFields.bcc) {
       toAddrList.push(msgCompFields.bcc);

       var bccLC = EnigStripEmail(msgCompFields.bcc).toLowerCase()
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: BCC: "+bccLC+"\n");

       var selfBCC = fromAddr && (fromAddr.toLowerCase() == bccLC);

       if (selfBCC) {
         DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: Self BCC\n");

       } else if (sendFlags & ENIG_ENCRYPT) {
         // BCC and encryption

         if (encryptIfPossible) {
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

         if (!encryptIfPossible) {
           EnigAlert(EnigGetString("sendingNews"));
           return;
         }

         sendFlags &= ~ENIG_ENCRYPT;
         DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: No default encryption because of newsgroups\n");

       }
     }

     var toAddr = toAddrList.join(", ");
     var testCipher = null;

     if (toAddr.length>=1) {

        DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSend: toAddr="+toAddr+"\n");

        if (sendFlags & ENIG_ENCRYPT) {
          // Encrypt test message for default encryption
          var testExitCodeObj    = new Object();
          var testStatusFlagsObj = new Object();
          var testErrorMsgObj    = new Object();

          var testPlain = "Test Message";
          var testUiFlags   = nsIEnigmail.UI_TEST;
          var testSendFlags = nsIEnigmail.SEND_ENCRYPTED |
                              nsIEnigmail.SEND_TEST |
                              optSendFlags;

          // test recipients
          testCipher = enigmailSvc.encryptMessage(window, testUiFlags,
                                                        testPlain,
                                                        fromAddr, toAddr,
                                                        testSendFlags,
                                                        testExitCodeObj,
                                                        testStatusFlagsObj,
                                                        testErrorMsgObj);


          if ((recipientsSelectionOption==2 ) ||
              ((testStatusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) &&
               ((recipientsSelectionOption>0) || (! encryptIfPossible)))) {

              var resultObj = new Object();
              var inputObj = new Object();
              inputObj.toAddr = toAddr;
              inputObj.options = "multisel";
              inputObj.dialogHeader = EnigGetString("recipientsSelectionHdr");

              window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
              try {
                if (resultObj.cancelled) return;
                if (! resultObj.encrypt) {
                  // encryption explicitely turned off
                  sendFlags &= ~ENIG_ENCRYPT;
                }
                else {
                  toAddr = resultObj.userList.join(", ");
                }
                testCipher="ok";
                testExitCodeObj.value = 0;
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

        if ((gotSendFlags & EnigSignIfEncrypted) &&
            !(sendFlags & ENIG_ENCRYPT)) {
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
         window.content.focus();

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

     // enable PGP/MIME if message is saved and contains attachments
     if ( hasAttachments && (sendFlags & nsIEnigmail.SAVE_MESSAGE)) {
        sendFlags |= nsIEnigmail.SEND_PGP_MIME;
     }

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

       try {
          if (gEnigPrefRoot.getBoolPref("mail.strictly_mime")) {
              if (EnigConfirm(EnigGetString("quotedPrintableWarn"))) {
                gEnigPrefRoot.setBoolPref("mail.strictly_mime", false);
              }
          }
       } catch (ex) {}


       var sendFlowed;
       try {
         sendFlowed = gEnigPrefRoot.getBoolPref("mailnews.send_plaintext_flowed");
       } catch (ex) {
         sendFlowed = true;
       }
       var encoderFlags = EnigOutputFormatted | EnigOutputLFLineBreak;

       var wrapWidth=72;
       if (gMsgCompose.composeHTML) {
          // enforce line wrapping here
          // otherwise the message isn't signed correctly
          try {
            wrapWidth = gEnigPrefRoot.getIntPref("editor.htmlWrapColumn");

            if (wrapWidth<68) {
              if (EnigConfirm(EnigGetString("minimalLineWrapping", wrapWidth))) {
                gEnigPrefRoot.setIntPref("editor.htmlWrapColumn", 68)
              }
            }
            if (!(sendFlags & ENIG_ENCRYPT) && EnigGetPref("wrapHtmlBeforeSend")) {
              var editor = gMsgCompose.editor.QueryInterface(nsIPlaintextEditorMail);
              editor.wrapWidth=wrapWidth-2; // prepare for the worst case: a 72 char's long line starting with '-'
              editor.rewrap(false);
            }
          }
          catch (ex) {}
       }
       else {
          try {
            wrapWidth = gEnigPrefRoot.getIntPref("mailnews.wraplength");
            if (wrapWidth<68) {
              if (EnigConfirm(EnigGetString("minimalLineWrapping", wrapWidth))) {
                gEnigPrefRoot.setIntPref("mailnews.wraplength", 68)
              }
            }
          }
          catch (ex) {}
      }


       // Get plain text
       // (Do we need to set the nsIDocumentEncoder::* flags?)
       var origText = EnigEditorGetContentsAs("text/plain",
                                                     encoderFlags);

       // Copy plain text for possible escaping
       var escText = origText;

       if (sendFlowed && !(sendFlags & ENIG_ENCRYPT)) {
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

     if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
       goDoCommand(elementId);
       if (! (sendFlags & nsIEnigmail.SEND_PGP_MIME))
          enigUndoEncryption(bucketList, gEnigModifiedAttach);

       return;
     }

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

       var msgConfirm = (isOffline || sendFlags & nsIEnigmail.SEND_LATER)
              ? EnigGetString("offlineSave",msgStatus,toAddr)
              : EnigGetString("onlineSend",msgStatus,toAddr);

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
        try {
          gMsgCompose.SendMsg(msgType, getCurrentIdentity(), progress);
        }
        catch (ex) {
          msgWindow.SetDOMWindow(window);
          gMsgCompose.SendMsg(msgType, getCurrentIdentity(), msgWindow, progress);
        }
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

// Modified version of DoCommandClose() function from MsgComposeCommands.js
function enigDoCommandClose() {
  var retVal;

// MODIFICATION
  if ((retVal = enigComposeCanClose())) {

    // Notify the SendListener that Send has been aborted and Stopped
    if (gMsgCompose)
    {
      var externalListener = gMsgCompose.getExternalSendListener();
      if (externalListener)
      {
        externalListener.onSendNotPerformed(null, Components.results.NS_ERROR_ABORT);
      }
    }

    MsgComposeCloseWindow(true);

    // at this point, we might be caching this window.
    // in which case, we don't want to close it
    if (gMsgComposeService.isCachedWindow(window)) {
      retVal = false;
    }
  }

  return retVal;
}

// modified version of ComposeCanClose from MsgComposeCommands.js
function enigComposeCanClose()
{
  if (gSendOrSaveOperationInProgress)
  {
    var result;

    if (gPromptService)
    {
      var promptTitle = sComposeMsgsBundle.getString("quitComposeWindowTitle");
      var promptMsg = sComposeMsgsBundle.getString("quitComposeWindowMessage");
      var quitButtonLabel = sComposeMsgsBundle.getString("quitComposeWindowQuitButtonLabel");
      var waitButtonLabel = sComposeMsgsBundle.getString("quitComposeWindowWaitButtonLabel");

      result = gPromptService.confirmEx(window, promptTitle, promptMsg,
          (gPromptService.BUTTON_TITLE_IS_STRING*gPromptService.BUTTON_POS_0) +
          (gPromptService.BUTTON_TITLE_IS_STRING*gPromptService.BUTTON_POS_1),
          waitButtonLabel, quitButtonLabel, null, null, {value:0});

      if (result == 1)
      {
        gMsgCompose.abort();
        return true;
      }
      return false;
    }
  }

  dump("XXX changed? " + gContentChanged + "," + gMsgCompose.bodyModified + "\n");
  // Returns FALSE only if user cancels save action
  if (gContentChanged || gMsgCompose.bodyModified)
  {
    // call window.focus, since we need to pop up a dialog
    // and therefore need to be visible (to prevent user confusion)
    window.focus();
    if (gPromptService)
    {
      result = gPromptService.confirmEx(window,
                              sComposeMsgsBundle.getString("saveDlogTitle"),
                              sComposeMsgsBundle.getString("saveDlogMessage"),
                              (gPromptService.BUTTON_TITLE_SAVE * gPromptService.BUTTON_POS_0) +
                              (gPromptService.BUTTON_TITLE_CANCEL * gPromptService.BUTTON_POS_1) +
                              (gPromptService.BUTTON_TITLE_DONT_SAVE * gPromptService.BUTTON_POS_2),
                              null, null, null,
                              null, {value:0});
      switch (result)
      {
        case 0: //Save
          gCloseWindowAfterSave = true;
/// MODIFICATION
          enigSend(gEnigSendMode, "cmd_saveAsDraft");
          return false;
        case 1: //Cancel
          return false;
        case 2: //Don't Save
          break;
      }
    }

    SetContentAndBodyAsUnmodified();
  }

  return true;
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

    if (exitCodeObj.value != 0) {
      return exitCodeObj.value;
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

function enigToggleAccountAttr(attrName)
{
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigToggleAccountAttr('"+attrName+"')\n");

  var currentId = getCurrentIdentity();
  var oldValue = currentId.getBoolAttribute(attrName);
  currentId.setBoolAttribute(attrName, !oldValue)

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

  if (docText.indexOf("-----BEGIN PGP ") < 0)
    return;

  // Determine indentation string
  var matches = docText.match(/(^|\n)([ \t]*>*[ \t]*)-----BEGIN PGP /);

  var indentStr= "";
  if (matches && (matches.length > 2)) {
    indentStr = matches[2];
  }

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: indentStr='"+indentStr+"'\n");

  var beginIndexObj = new Object();
  var endIndexObj = new Object();
  var indentStrObj = new Object();
  var blockType = enigmailSvc.locateArmoredBlock(docText, 0, indentStr,
                                          beginIndexObj, endIndexObj,
                                          indentStrObj);

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

    if (indentStr.match(/[ \t]*$/)) {
      indentStr = indentStr.replace(/[ \t]*$/g, "");
      indentRegexp = new RegExp("^"+indentStr+"$", "g");

      pgpBlock = pgpBlock.replace(indentRegexp, "");
    }


    // Handle blank indented lines
    pgpBlock = pgpBlock.replace(/^[ \t]*>[ \t]*$/g, "");
    tail     =     tail.replace(/^[ \t]*>[ \t]*$/g, "");

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

  var doubleDashSeparator = ("doubleDashSeparator")
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
    replyOnTop = getCurrentIdentity().replyOnTop;
  } catch (ex) {}

  if (!indentStr || !quoteElement)
    replyOnTop = 1;

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: replyOnTop="+replyOnTop+", quoteElement="+quoteElement+"\n");

  var nsISelectionController = Components.interfaces.nsISelectionController;

  var selection;
  if (gEnigEditor.selectionController)
      selection = gEnigEditor.selectionController.getSelection(nsISelectionController.SELECTION_NORMAL)

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

      }

    }
  } catch (ex) {}

  if (gEnigEditor.selectionController)
      gEnigEditor.selectionController.scrollSelectionIntoView(nsISelectionController.SELECTION_NORMAL,
                                     nsISelectionController.SELECTION_ANCHOR_REGION,
                                     true);
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
    
  }
}


function EnigEditorSelectAll() {
  if (gEnigEditor) {
    gEnigEditor.selectAll();
  }
}

function EnigEditorGetCharset() {
  return gEnigEditor.documentCharacterSet;
}

function EnigEditorGetContentsAs(mimeType, flags) {
  if (gEnigEditor) {
    return gEnigEditor.outputToString(mimeType, flags);
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

    isEmpty    = gEnigEditor.documentIsEmpty;
    isEditable = gEnigEditor.isDocumentEditable;

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
