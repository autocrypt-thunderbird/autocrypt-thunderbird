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

var gEnigEditor;
var gEnigDirty, gEnigProcessed, gEnigTimeoutID;
var gEnigSendPGPMime, gEnigMeodifiedAttach, gEnigSendMode;
var gEnigSendModeDirty = 0;
var gEnigNextCommand;
var gEnigIdentity = null;
var gEnigEnableRules = null;

if (typeof(GenericSendMessage)=="function") {
  // replace GenericSendMessage with our own version
  var origGenericSendMessage = GenericSendMessage;
  GenericSendMessage = function (msgType) {
    enigGenericSendMessage(msgType);
  }

  window.addEventListener("load", enigMsgComposeStartup, false);

  // Handle recycled windows
  window.addEventListener('compose-window-close', enigMsgComposeClose, true);
  window.addEventListener('compose-window-reopen', enigMsgComposeReopen, true);

}
else {
  EnigAlert("WARNING:\n\nCannot hook message sending -- you will not be able to send OpenPGP messages!");
}

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

  var composeStateListener = new EnigComposeStateListener();

  gMsgCompose.RegisterStateListener(composeStateListener);

  var msgId = document.getElementById("msgIdentityPopup");
  if (msgId)
    msgId.setAttribute("oncommand", "enigSetIdentityCallback();");

  enigSetIdentityDefaults();
  enigMsgComposeReset();

  enigComposeOpen();
}


function enigHandleClick(event, modifyType) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigHandleClick\n");
  switch (event.button) {
  case 2:
    // do not process the event any futher
    // needed on Windows to prevent displaying the context menu
    event.preventDefault();
    enigDoPgpButton();
    break;
  case 0:
    enigDoPgpButton(modifyType);
    break;
  }
}


function enigSetIdentityCallback(elementId) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSetIdentityCallback: elementId="+elementId+"\n");
  enigSetIdentityDefaults();
}

function enigGetAccDefault(value) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigGetAccDefault: identity="+gEnigIdentity.key+" value="+value+"\n");

  var enabled = gEnigIdentity.getBoolAttribute("enablePgp");
  if (value == "enabled")
    return enabled;
  if (enabled) {
    var r=null;
    switch (value) {
    case 'encrypt':
      r=gEnigIdentity.getIntAttribute("defaultEncryptionPolicy");
      break;
    case 'signPlain':
      r=gEnigIdentity.getBoolAttribute("pgpSignPlain");
      break;
    case 'signEnc':
      r=gEnigIdentity.getBoolAttribute("pgpSignEncrypted");
    }
    DEBUG_LOG("  "+value+"="+r+"\n");
    return r;
  }
  else {
    switch (value) {
    case 'encrypt':
      return 0;
    case 'signPlain':
    case 'signEnc':
      return false;
    }
  }
  return null;
}

function enigSetIdentityDefaults() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSetIdentityDefaults\n");
  gEnigIdentity = getCurrentIdentity();
  if (enigGetAccDefault("enabled")) {
    EnigGetSignMsg(gEnigIdentity);
  }

  if (! gEnigSendModeDirty) {
    enigSetSendDefaultOptions();
    enigDisplayUi();
  }
}


// set the current default for sending a message
// depending on the identity
function enigSetSendDefaultOptions() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSetSendDefaultOptions\n");
  gEnigSendMode = 0;
  if (! enigGetAccDefault("enabled")) {
    return;
  }
  if (enigGetAccDefault("encrypt")>0) {
    gEnigSendMode |= ENIG_ENCRYPT;
    if (enigGetAccDefault("signEnc")) gEnigSendMode |= ENIG_SIGN;
  }
  else {
    if (enigGetAccDefault("signPlain")) gEnigSendMode |= ENIG_SIGN;
  }
}


function enigComposeOpen() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigComposeOpen\n");
  if (EnigGetPref("keepSettingsForReply") && (!(gEnigSendMode & ENIG_ENCRYPT))) {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
    if (enigMimeService)
    {
      if (typeof(gMsgCompose.originalMsgURI)=="string") {
        if (gMsgCompose.originalMsgURI.length>0 && enigMimeService.isEncrypted(gMsgCompose.originalMsgURI)) {
          DEBUG_LOG("enigmailMsgComposeOverlay.js: enigComposeOpen: has encrypted originalMsgUri\n");
          DEBUG_LOG("originalMsgURI="+gMsgCompose.originalMsgURI+"\n");
          enigSetSendMode('encrypt');
        }
      }
      if (typeof(gMsgCompose.compFields.draftId)=="string") {
        if (gMsgCompose.compFields.draftId.length>0 && enigMimeService.isEncrypted(gMsgCompose.compFields.draftId.replace(/\?.*$/, ""))) {
          DEBUG_LOG("enigmailMsgComposeOverlay.js: enigComposeOpen: has encrypted draftId=");
          DEBUG_LOG(gMsgCompose.compFields.draftId);
          DEBUG_LOG(" encrypted="+enigMimeService.isEncrypted(gMsgCompose.compFields.draftId)+"\n");
          enigSetSendMode('encrypt');
        }
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

  gEnigDirty = 0;
  gEnigProcessed = null;
  gEnigTimeoutID = null;

  gEnigModifiedAttach=null;
  gEnigSendModeDirty = 0;
  gEnigSendMode = 0;
  gEnigEnableRules = true;
  gEnigIdentity = null;

  EnigShowHeadersAll(true);

  gEnigSendPGPMime = !(EnigGetPref("usePGPMimeOption") == PGP_MIME_ALWAYS);
  enigTogglePGPMime();

  enigSetIdentityDefaults();
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
    userIdValue = resultObj.userList.join(" ");
  } catch (ex) {
    // cancel pressed -> do nothing
    return;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();

  var keyBlock = enigmailSvc.extractKey(window, 0, userIdValue, null,
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

function enigUndoEncryption() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUndoEncryption: \n");
  if (gEnigProcessed) {
    enigReplaceEditorText(gEnigProcessed.origText);

    gEnigProcessed = null;

  } else {
    enigDecryptQuote(true);
  }

  var bucketList = document.getElementById("attachmentBucket");
  if ( gEnigModifiedAttach && bucketList && bucketList.hasChildNodes() ) {
    // undo inline encryption of attachments
    for (var i=0; i<gEnigModifiedAttach.length; i++) {
      var node = bucketList.firstChild;
      while (node) {
        if (node.attachment.url == gEnigModifiedAttach[i].newUrl) {
          node.attachment.url = gEnigModifiedAttach[i].origUrl;
          node.attachment.name = gEnigModifiedAttach[i].origName;
          node.attachment.temporary = gEnigModifiedAttach[i].origTemp;
          node.attachment.contentType = gEnigModifiedAttach[i].origCType;
          // delete encrypted file
          try {
            gEnigModifiedAttach[i].newFile.remove(false);
          }
          catch (ex) {}
        }
        node=node.nextSibling;
      }
    }

    gEnigModifiedAttach = null;
  }
}

function enigReplaceEditorText(text) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigReplaceEditorText:\n");
  EnigEditorSelectAll();

  // Overwrite text in clipboard for security
  // (Otherwise plaintext will be available in the clipbaord)
  EnigEditorInsertText("Enigmail");
  EnigEditorSelectAll();

  EnigEditorInsertText(text);
}

function enigGoAccountManager()
{
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigGoAccountManager:\n");
  var server=null;
  try {
      var currentId=getCurrentIdentity();
      var amService=Components.classes["@mozilla.org/messenger/account-manager;1"].getService();
      var servers=amService.GetServersForIdentity(currentId);
      var folderURI=servers.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer).serverURI;
      server=GetMsgFolderFromUri(folderURI, true).server
  } catch (ex) {}
  window.openDialog("chrome://enigmail/content/am-enigprefs-edit.xul", "", "dialog,modal,centerscreen", {identity: currentId, account: server});
}

function enigDoPgpButton(what) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDoPgpButton: what="+what+"\n");
  if (! what)
    what = gEnigNextCommand;
  gEnigNextCommand = "";
  try {
    if (!enigGetAccDefault("enabled")) {
      if (EnigConfirm(EnigGetString("configureNow"))) {
        enigGoAccountManager();
        if (! gEnigIdentity.getBoolAttribute("enablePgp")) return;
      }
      else {
        return;
      }
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

    case 'toggleRules':
      enigToggleRules();
      break;

    default:
      enigDisplaySecuritySettings();
  }
  return;
}

function enigNextCommand(what) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigNextCommand: what="+what+"\n");
  gEnigNextCommand=what;
}

function enigSetSendMode(sendMode) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigSetSendMode: sendMode="+sendMode+"\n");
  var origSendMode=gEnigSendMode;
  switch (sendMode) {
    case 'toggle-sign':
      enigDisplaySignClickWarn();
      gEnigSendModeDirty=2;
      if (gEnigSendMode & ENIG_SIGN) {
        gEnigSendMode &= ~ENIG_SIGN;
      }
      else {
        gEnigSendMode |= ENIG_SIGN;
      }
      break;
    case 'toggle-encrypt':
      if (gEnigSendMode & ENIG_ENCRYPT) {
        enigSetSendMode('plain');
      }
      else {
        enigSetSendMode('encrypt');
      }
      break;
    case 'encrypt':
      gEnigSendMode |= ENIG_ENCRYPT;
      if (gEnigSendModeDirty<2) {
        if (enigGetAccDefault("signEnc")) {
          gEnigSendMode |= ENIG_SIGN;
        }
        else {
          gEnigSendMode &= ~ENIG_SIGN;
        }
      }
      break;
    case 'plain':
      gEnigSendMode &= ~ENIG_ENCRYPT;
      if (gEnigSendModeDirty<2) {
        if (enigGetAccDefault("signPlain")) {
          gEnigSendMode |= ENIG_SIGN;
        }
        else {
          gEnigSendMode &= ~ENIG_SIGN;
        }
      }
      break;
    default:
      EnigAlert("enigSetSendMode - Strange value: "+sendMode);
      break;
  }
  if (gEnigSendMode != origSendMode && gEnigSendModeDirty<2)
    gEnigSendModeDirty=1;
  enigDisplayUi();
}

function enigDisplayUi() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDisplayUi:\n");
  var statusBar = document.getElementById("enigmail-status-bar");

  if (!enigGetAccDefault("enabled")) {
    // hide icons if enigmail not enabled
    statusBar.removeAttribute("signed");
    statusBar.removeAttribute("encrypted");
    return;
  }

  var signedIcon = document.getElementById("enigmail-signed-status");
  var encryptedIcon = document.getElementById("enigmail-encrypted-status");

  if (gEnigSendMode & ENIG_SIGN) {
    statusBar.setAttribute("signed", "ok");
    signedIcon.setAttribute("tooltiptext", EnigGetString("signYes"));
  }
  else {
    statusBar.setAttribute("signed", "inactive");
    signedIcon.setAttribute("tooltiptext", EnigGetString("signNo"));
  }

  if (gEnigSendMode & ENIG_ENCRYPT) {
    statusBar.setAttribute("encrypted", "ok");
    encryptedIcon.setAttribute("tooltiptext", EnigGetString("encryptYes"));
  }
  else {
    statusBar.setAttribute("encrypted", "inactive");
    encryptedIcon.setAttribute("tooltiptext", EnigGetString("encryptNo"));
  }
}

function enigSetMenuSettings(postfix) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigSetMenuSettings: postfix="+postfix+"\n");
  document.getElementById("enigmail_encrypted_send"+postfix).setAttribute("checked",(gEnigSendMode & ENIG_ENCRYPT) ? true : false);
  document.getElementById("enigmail_signed_send"+postfix).setAttribute("checked",(gEnigSendMode & ENIG_SIGN) ? true : false);

  var menuElement = document.getElementById("enigmail_sendPGPMime"+postfix);
  if (menuElement)
    menuElement.setAttribute("checked", gEnigSendPGPMime ? "true" : "false");

  menuElement = document.getElementById("enigmail_disable_rules"+postfix);
  if (menuElement)
    menuElement.setAttribute("checked", gEnigEnableRules ? "false" : "true");

}

function enigDisplaySecuritySettings() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDisplaySecuritySettings\n");
  var inputObj = { sendFlags: gEnigSendMode,
                   usePgpMime: gEnigSendPGPMime,
                   disableRules: gEnigEnableRules};
  window.openDialog("chrome://enigmail/content/enigmailEncryptionDlg.xul","", "dialog,modal,centerscreen", inputObj);
  if (gEnigSendMode != inputObj.sendFlags) {
    gEnigDirty = 2;
  }
  gEnigSendMode = inputObj.sendFlags;
  gEnigSendPGPMime = inputObj.usePgpMime;
  enigDisplayUi();
}

function enigDisplaySignClickWarn() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDisplaySignClickWarn\n");
  if ((gEnigSendModeDirty<2) &&
      (enigGetAccDefault("signPlain") ||
       enigGetAccDefault("signEnc"))) {
    EnigAlertPref(EnigGetString("signIconClicked"), "displaySignWarn");
  }
}

function enigConfirmBeforeSend(toAddr, gpgKeys, sendFlags, isOffline, msgSendType) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigConfirmBeforeSend: sendFlags="+sendFlags+"\n");
  // get confirmation before sending message
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
          ? EnigGetString("offlineSave",msgStatus,EnigStripEmail(toAddr).replace(/,/g, ", "))
          : EnigGetString("onlineSend",msgStatus,EnigStripEmail(toAddr).replace(/,/g, ", "));
  if (sendFlags & ENIG_ENCRYPT)
    msgConfirm += "\n\n"+EnigGetString("encryptKeysNote", gpgKeys);

  return EnigConfirm(msgConfirm);
}

function enigAddRecipients(toAddrList, recList) {
  for (var i=0; i<recList.count; i++) {
    toAddrList.push(EnigStripEmail(recList.StringAt(i).replace(/[\",]/g, "")));
  }
}

function enigEncryptMsg(msgSendType) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: msgType="+msgSendType+", gEnigSendMode="+gEnigSendMode+"\n");

  var gotSendFlags = gEnigSendMode;
  var sendFlags=0;
  window.enigmailSendFlags=0;
  switch (msgSendType) {
  case nsIMsgCompDeliverMode.Later:          
    sendFlags |= nsIEnigmail.SEND_LATER;
    break;
  case nsIMsgCompDeliverMode.SaveAsDraft:   
    sendFlags |=  nsIEnigmail.SAVE_MESSAGE;
    break;
  case nsIMsgCompDeliverMode.SaveAsTemplate: 
    sendFlags |= nsIEnigmail.SAVE_MESSAGE;
    break;
  }
    
  if (gotSendFlags & ENIG_SIGN)
      sendFlags |= ENIG_SIGN;
  if (gotSendFlags & ENIG_ENCRYPT) {
    sendFlags |= ENIG_ENCRYPT;
  }
  var encryptIfPossible = false;
  if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
    if (!((sendFlags & ENIG_ENCRYPT) && EnigConfirmPref(EnigGetString("savingMessage"), "saveEncrypted"))) {
      sendFlags &= ~ENIG_ENCRYPT;
      return;
    }
  }

  if (gWindowLocked) {
    EnigAlert(EnigGetString("windowLocked"));
    window.cancelSendMessage=true;
    return;
  }


  if (gEnigDirty) {
    // make sure the sendFlags are reset before the message is processed
    // (it may have been set by a previously cancelled send operation!)
    try {
      if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIEnigMsgCompFields) {
        if (!gEnigSendPGPMime) {
          gMsgCompose.compFields.securityInfo=null;
        }
        else {
          gMsgCompose.compFields.securityInfo.sendFlags=0;
        }
      }
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
     var msg=EnigGetString("sendUnencrypted");
     if (gEnigmailSvc && gEnigmailSvc.initializationError) {
        msg = gEnigmailSvc.initializationError +"\n\n"+msg;
     }

     if (!EnigConfirm(msg))
        window.cancelSendMessage=true;
     return;
  }


  try {
     var exitCodeObj    = new Object();
     var statusFlagsObj = new Object();
     var errorMsgObj    = new Object();
     gEnigModifiedAttach = null;

     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: currentId="+gEnigIdentity+
              ", "+gEnigIdentity.email+"\n");
     var fromAddr = gEnigIdentity.email;

     var pgpEnabled = enigGetAccDefault("enabled");

     if (! pgpEnabled) {
        if (sendFlags & ENIG_ENCRYPT_OR_SIGN) {
          if (!EnigConfirm(EnigGetString("acctNotConfigured")))
              window.cancelSendMessage=true;
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

     if (gEnigIdentity.getIntAttribute("pgpKeyMode")>0) {
       var userIdValue = gEnigIdentity.getCharAttribute("pgpkeyId");

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
         gEnigIdentity.setCharAttribute("pgpkeyId", userIdValue);

       } else {
         gEnigIdentity.setIntAttribute("pgpKeyMode", 0);
       }
     }

     var msgCompFields = gMsgCompose.compFields;

     // Check if sending to any newsgroups
     var newsgroups = msgCompFields.newsgroups;

     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg:gMsgCompose="+gMsgCompose+"\n");

     var toAddrList = [];
     if (msgCompFields.to) {
       var recList = msgCompFields.SplitRecipients(msgCompFields.to, true)
       enigAddRecipients(toAddrList, recList);
     }

     if (msgCompFields.cc) {
       recList = msgCompFields.SplitRecipients(msgCompFields.cc, true)
       enigAddRecipients(toAddrList, recList);
     }

     if (msgCompFields.bcc) {
       recList = msgCompFields.SplitRecipients(msgCompFields.bcc, true)
       enigAddRecipients(toAddrList, recList);

       var bccLC = EnigStripEmail(msgCompFields.bcc).toLowerCase()
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: BCC: "+bccLC+"\n");

       var selfBCC = gEnigIdentity.email && (gEnigIdentity.email.toLowerCase() == bccLC);

       if (selfBCC) {
         DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: Self BCC\n");

       } else if (sendFlags & ENIG_ENCRYPT) {
         // BCC and encryption

         if (encryptIfPossible) {
           sendFlags &= ~ENIG_ENCRYPT;
           DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: No default encryption because of BCC\n");

         } else {
           if (!EnigConfirm(EnigGetString("sendingBCC"))) {
             window.cancelSendMessage=true;
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
           window.cancelSendMessage=true;
           return;
         }

         sendFlags &= ~ENIG_ENCRYPT;
         DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: No default encryption because of newsgroups\n");

       }
     }

     var usePGPMimeOption = EnigGetPref("usePGPMimeOption");

     if (gEnigSendPGPMime) {
       // Use PGP/MIME
       sendFlags |= nsIEnigmail.SEND_PGP_MIME;
     }

     var toAddr = toAddrList.join(", ");
     var testCipher = null;

     var notSignedIfNotEnc= (gEnigSendModeDirty<2 && (! enigGetAccDefault("signPlain")));

     if (toAddr.length>=1) {

        DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: toAddr="+toAddr+"\n");
        var perRecipientRules=EnigGetPref("perRecipientRules");
        var repeatSelection=0;
        while (repeatSelection<2) {
          if (perRecipientRules>0 && gEnigEnableRules) {
            var matchedKeysObj = new Object;
            var flagsObj=new Object;
            if (!getRecipientsKeys(toAddr, 
                                  (repeatSelection==1),
                                  matchedKeysObj, 
                                  flagsObj)) {
              window.cancelSendMessage=true;
              return;
            }
           
            if (matchedKeysObj.value) toAddr=matchedKeysObj.value;
            if (flagsObj.value) {
              switch (flagsObj.sign) {
               case 0:
                 sendFlags &= ~ENIG_SIGN;
                 break;
               case 2:
                 sendFlags |= ENIG_SIGN;
                 break;
              }
    
              switch (flagsObj.encrypt) {
               case 0:
                 sendFlags &= ~ENIG_ENCRYPT;
                 break;
               case 2:
                 sendFlags |= ENIG_ENCRYPT;
                 break;
              }
    
              switch (flagsObj.pgpMime) {
               case 0:
                 sendFlags &= ~nsIEnigmail.SEND_PGP_MIME;
                 break;
               case 2:
                 sendFlags |= nsIEnigmail.SEND_PGP_MIME;
                 break;
              }
            }
          }
          repeatSelection++;
          
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
  
  
            if ((recipientsSelectionOption==2) ||
                ((testStatusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) &&
                 (recipientsSelectionOption>0))) {
  
                var resultObj = new Object();
                var inputObj = new Object();
                inputObj.toAddr = toAddr;
                inputObj.options = "multisel";
                if (perRecipientRules<2)
                  inputObj.options += ",rulesOption"
                if (notSignedIfNotEnc)
                  inputObj.options += ",notsigned";
                if (recipientsSelectionOption<2)
                  inputObj.options += ",noforcedisp";
                inputObj.dialogHeader = EnigGetString("recipientsSelectionHdr");
  
                window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
                try {
                  if (resultObj.cancelled) {
                    window.cancelSendMessage=true;
                    return;
                  }
                  if (resultObj.perRecipientRules && gEnigEnableRules) {
                    // do an extra round because the user want to set a PGP rule
                    continue;
                  }
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
                  window.cancelSendMessage=true;
                  return;
                }
            }
            if ((!testCipher || (testExitCodeObj.value != 0)) && recipientsSelectionOption==0) {
                // Test encryption failed; turn off default encryption
                sendFlags &= ~ENIG_ENCRYPT;
                DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: No default encryption because test failed\n");
            }
          }
          repeatSelection=2;
        }

        if ((gotSendFlags & ENIG_ENCRYPT) &&
            !(sendFlags & ENIG_ENCRYPT)) {
          // Default encryption turned off; turn off signing as well
          if (gEnigSendModeDirty<2 && (! enigGetAccDefault("signPlain"))) {
            sendFlags  &= ~ENIG_SIGN;
          }
        }
     }

     var bucketList = document.getElementById("attachmentBucket");
     var hasAttachments = bucketList && bucketList.hasChildNodes();

     DEBUG_LOG("enigmailMsgComposeOverlay.js: hasAttachments = "+hasAttachments+"\n");

     if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
       // always enable PGP/MIME if message is saved
       sendFlags |= nsIEnigmail.SEND_PGP_MIME;
     }
     
     if ( hasAttachments &&
        (sendFlags & ENIG_ENCRYPT_OR_SIGN) &&
        !(sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
        enigmailSvc.composeSecure) {

        inputObj = new Object();
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
          resultObj = new Object();
          resultObj.selected = -1;
          window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
          if (resultObj.selected < 0) {
            // dialog cancelled
            window.cancelSendMessage=true;
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
              window.cancelSendMessage=true;
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

     if ((sendFlags & ENIG_ENCRYPT_OR_SIGN) && usingPGPMime) {
       // Use EnigMime
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: Using EnigMime, flags="+sendFlags+"\n");

       var oldSecurityInfo = gMsgCompose.compFields.securityInfo;

       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: oldSecurityInfo = "+oldSecurityInfo+"\n");

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

       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: securityInfo = "+newSecurityInfo+"\n");

     } else if (!gEnigProcessed && (sendFlags & ENIG_ENCRYPT_OR_SIGN)) {

       if (gMsgCompose.composeHTML) {
         var errMsg = EnigGetString("hasHTML");

         EnigAlertCount("composeHtmlAlertCount", errMsg);
       }

       try {
         var convert = DetermineConvertibility();
         if (convert == nsIMsgCompConvertible.No) {
           if (!EnigConfirm(EnigGetString("strippingHTML"))) {
             window.cancelSendMessage=true;
             return;
           }
         }
       } catch (ex) {
       }

       try {
          if (gEnigPrefRoot.getBoolPref("mail.strictly_mime")) {
              if (EnigConfirmPref(EnigGetString("quotedPrintableWarn"), "quotedPrintableWarn")) {
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
             window.cancelSendMessage=true;
             return;
           }
         }

         if (inlineEncAttach) {
            // encrypt attachments
            gEnigModifiedAttach = new Array();
            exitCode = enigEncryptAttachments(bucketList, gEnigModifiedAttach,
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
                enigUndoEncryption();
              window.cancelSendMessage=true;
              return;
            }
         }
       }
     }

     // EnigSend: Handle both plain and encrypted messages below
     var isOffline = (gIOService && gIOService.offline);
     window.enigmailSendFlags=sendFlags;

     
     if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
       // update the list of attachments
       Attachments2CompFields(msgCompFields);
     }
     else if (EnigGetPref("confirmBeforeSend")) {
       if (!enigConfirmBeforeSend(toAddrList.join(", "), toAddr, sendFlags, isOffline)) {
         if (gEnigProcessed)
           enigUndoEncryption();
           
         window.cancelSendMessage=true;
         return;
       }
     } 
     else if ( (sendFlags & nsIEnigmail.SEND_WITH_CHECK) &&
                 !enigMessageSendCheck() ) {
       // Abort send
       if (gEnigProcessed)
         enigUndoEncryption();

       window.cancelSendMessage=true;
       return;
     }
     
     if ((uiFlags & nsIEnigmail.UI_PGP_MIME)  &&
         (sendFlags & ENIG_SIGN) && !(sendFlags & ENIG_ENCRYPT)) {
        if (! gEnigPrefRoot.getBoolPref("mail.strictly_mime")) {
          try {
            if (newSecurityInfo) {
              // enable quoted-printable to be RFC 3156 compliant
              gEnigPrefRoot.setBoolPref("mail.strictly_mime", true);
              newSecurityInfo.UIFlags |= nsIEnigmail.UI_MOD_STRICTLY_MIME;
            }
          }
          catch (ex) {}
        }
     }

  } catch (ex) {
     msg=EnigGetString("signFailed");
     if (gEnigmailSvc && gEnigmailSvc.initializationError) {
        msg += "\n"+gEnigmailSvc.initializationError;
     }
     if (!EnigConfirm(msg))
       window.cancelSendMessage=true;
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

  if (EnigGetPref("addHeaders")) {
    var enigmailHeaders = "X-Enigmail-Version: "+gEnigmailVersion+"\r\n"+
                          "X-Enigmail-Supports: pgp-inline, pgp-mime\r\n";

    msgCompFields.otherRandomHeaders += enigmailHeaders;

    DEBUG_LOG("enigmailMsgComposeOverlay.js: enigModifyCompFields: otherRandomHeaders = "+
             msgCompFields.otherRandomHeaders+"\n");
  }
  else {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: enigModifyCompFields: no headers added\n");
  }
}


// Modified version of GenericSendMessage from the file MsgComposeCommands.js
function enigGenericSendMessage( msgType )
{
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigGenericSendMessage: msgType="+msgType+"\n");
  DEBUG_LOG("  Identity = " + gEnigIdentity + "\n");

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
        if (sPrefs.getBoolPref("mail.SpellCheckBeforeSend")){
        //We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
        //therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
          window.content.focus();
          window.cancelSendMessage = false;
          try {
            window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank",
                    "chrome,close,titlebar,modal", true, true, false);
          }
          catch(ex){}
          if(window.cancelSendMessage)
            return;
        }            

        //Check if we have a subject, else ask user for confirmation
        
        if (subject == "" && (! EnigGetPref("allowEmptySubject")))
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
        default: 
          ERROR_LOG("\###SendMessage Error: invalid action value\n");
          return;
        }
      }

      // hook for extra compose pre-processing
      var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
      observerService.notifyObservers(window, "mail:composeOnSend", null);
/*
/////////////////////////////////////////////////////////////////////////
// MODIFICATION
// Set the charset from the original text
// (after setting observerService)
/////////////////////////////////////////////////////////////////////////
      if (gEnigProcessed) {
        // Ensure that original charset is preserved for encrypted messages
        gMsgCompose.SetDocumentCharset(gEnigProcessed.charset);

      } else {
/////////////////////////////////////////////////////////////////////////
// END OF MODIFICATION
/////////////////////////////////////////////////////////////////////////
*/
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
            fallbackCharset.value = "UTF-8";
          }
          if (fallbackCharset &&
              fallbackCharset.value && fallbackCharset.value != "")
            gMsgCompose.SetDocumentCharset(fallbackCharset.value);
        }
//      }

/////////////////////////////////////////////////////////////////////////
// MODIFICATION
// Call the following function from our version of the function
// GenericSendMessage from the file MsgComposeCommands.js
// (after having determined HTML convertibility)
/////////////////////////////////////////////////////////////////////////
          try {
            window.cancelSendMessage=false;
            enigEncryptMsg(msgType);
            if(window.cancelSendMessage)
              return;
          }
          catch(ex){}
/////////////////////////////////////////////////////////////////////////
// END OF MODIFICATION
/////////////////////////////////////////////////////////////////////////

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
        msgWindow.SetDOMWindow(window);
        
        if (typeof(getCurrentAccountKey)=="function") {
          // Mozilla >= 1.7a
          gMsgCompose.SendMsg(msgType, getCurrentIdentity(), getCurrentAccountKey(), msgWindow, progress);
        }
        else {
          //Mozilla <= 1.6
          gMsgCompose.SendMsg(msgType, getCurrentIdentity(), msgWindow, progress);
        }
        
/////////////////////////////////////////////////////////////////////////
// MODIFICATION
// Call the following function from our version of the function
// GenericSendMessage from the file MsgComposeCommands.js
// (after gMsgCompose.SendMsg)
/////////////////////////////////////////////////////////////////////////
        if (window.enigmailSendFlags & nsIEnigmail.SAVE_MESSAGE) {
          enigUndoEncryption();
        }
      }
      catch (ex) {
        ERROR_LOG("failed to SendMsg: " + ex + "\n");
        gWindowLocked = false;
        enableEditableFields();
        CommandUpdate_MsgCompose();
      }
    }
  }
  else
    ERROR_LOG("###SendMessage Error: composeAppCore is null!\n");
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

  var oldValue = gEnigIdentity.getBoolAttribute(attrName);
  gEnigIdentity.setBoolAttribute(attrName, !oldValue)

}

function enigToggleRules() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigToggleRules: gEnigEnableRules="+gEnigEnableRules+"\n");
  gEnigEnableRules = !gEnigEnableRules;
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
    tail = "";
  }

  //DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: pgpBlock='"+pgpBlock+"'\n");

  var charset = EnigEditorGetCharset();
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: charset="+charset+"\n");

  // Encode ciphertext from unicode to charset
  var cipherText = EnigConvertFromUnicode(pgpBlock, charset);
  
  if ((! gEnigPrefRoot.getBoolPref("mailnews.reply_in_default_charset")) && (blockType == "MESSAGE")) {
    // set charset according to PGP block, if available (encrypted messages only)
    cipherText = cipherText.replace(/\r\n/g, "\n");
    cipherText = cipherText.replace(/\r/g,   "\n");
    var cPos = cipherText.search(/\nCharset: .+\n/i);
    if (cPos < cipherText.search(/\n\n/)) {
      var charMatch = cipherText.match(/\n(Charset: )(.+)\n/i);
      if (charMatch && charMatch.length > 2) {
        charset = charMatch[2];
        gMsgCompose.SetDocumentCharset(charset);
      }
    }
  }
  
  // Decrypt message
  var signatureObj   = new Object();
  signatureObj.value = "";
  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();
  var userIdObj      = new Object();
  var keyIdObj       = new Object();
  var sigDateObj     = new Object();
  var errorMsgObj    = new Object();

  var uiFlags = nsIEnigmail.UI_UNVERIFIED_ENC_OK;

  var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                 signatureObj, exitCodeObj, statusFlagsObj,
                                 keyIdObj, userIdObj, sigDateObj, errorMsgObj);

  // Decode plaintext from charset to unicode
  plainText = EnigConvertToUnicode(plainText, charset);
  if (EnigGetPref("keepSettingsForReply")) {
    if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY)
      enigSetSendMode('encrypt');
  }

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
  if (gMsgCompose.type != nsIMsgCompType.Template && 
      gMsgCompose.type != nsIMsgCompType.Draft &&
      doubleDashSeparator) {
    var signOffset = plainText.search(/[\r\n]-- +[\r\n]/);

    if (signOffset > 0) {
      // Strip signature portion of quoted message
      plainText = plainText.substr(0, signOffset+1);
    }
  }
  
  var clipBoard = Components.classes[ENIG_CLIPBOARD_CONTRACTID].getService(Components.interfaces.nsIClipboard);
  if (clipBoard.supportsSelectionClipboard()) {
    // get the clipboard contents for selected text (X11)
    try {
      var transferable = Components.classes[ENIG_TRANSFERABLE_CONTRACTID].createInstance(Components.interfaces.nsITransferable);
      transferable.addDataFlavor("text/unicode");
      clipBoard.getData(transferable, clipBoard.kSelectionClipboard);
      var flavour = {};
      var data = {};
      var length = {};
      transferable.getAnyTransferData(flavour, data, length);
    }
    catch(ex) {}
  }
  
  // Replace encrypted quote with decrypted quote (destroys selection clipboard on X11)
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
    
  if (clipBoard.supportsSelectionClipboard()) {
    try {
      // restore the clipboard contents for selected text (X11)
      var pasteClipboard = Components.classes[ENIG_CLIPBOARD_HELPER_CONTRACTID].getService(Components.interfaces.nsIClipboardHelper);
      data = data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
      pasteClipboard.copyStringToClipboard(data, clipBoard.kSelectionClipboard);
    }
    catch (ex) {}
  }

  if (interactive)
    return;

  // Position cursor
  var replyOnTop = 1;
  try {
    replyOnTop = gEnigIdentity.replyOnTop;
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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: EnigEditorInsertText\n");
  if (gEnigEditor) {
    var mailEditor;
    try {
      mailEditor = gEnigEditor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
      mailEditor.insertTextWithQuotations(plainText);
    } catch (ex) {
      DEBUG_LOG("enigmailMsgComposeOverlay.js: EnigEditorInsertText: no mail editor\n");
      gEnigEditor.insertText(plainText);
    }
  }
}

function EnigEditorInsertAsQuotation(plainText) {
  if (gEnigEditor) {
    var mailEditor;
    try {
      mailEditor = gEnigEditor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
    } catch (ex) {}

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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: EnigEditorGetCharset\n");
  return gEnigEditor.documentCharacterSet;
}

function EnigEditorGetContentsAs(mimeType, flags) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: EnigEditorGetContentsAs\n");
  if (gEnigEditor) {
    return gEnigEditor.outputToString(mimeType, flags);
  }
}

function EnigComposeStateListener() {}

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

function EnigDocStateListener() {}

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

