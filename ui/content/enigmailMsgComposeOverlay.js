/*
The contents of this file are subject to the Mozilla Public
License Version 1.1 (the "MPL"); you may not use this file
except in compliance with the MPL. You may obtain a copy of
the MPL at http://www.mozilla.org/MPL/

Software distributed under the MPL is distributed on an "AS
IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
implied. See the MPL for the specific language governing
rights and limitations under the MPL.

The Original Code is Enigmail.

The Initial Developer of the Original Code is Ramalingam Saravanan.
Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.

Contributor(s):
Patrick Brunschwig <patrick.brunschwig@gmx.net>

Alternatively, the contents of this file may be used under the
terms of the GNU General Public License (the "GPL"), in which case
the provisions of the GPL are applicable instead of
those above. If you wish to allow use of your version of this
file only under the terms of the GPL and not to allow
others to use your version of this file under the MPL, indicate
your decision by deleting the provisions above and replace them
with the notice and other provisions required by the GPL.
If you do not delete the provisions above, a recipient
may use your version of this file under either the MPL or the
GPL.
*/

// Uses: chrome://enigmail/content/enigmailCommon.js

Components.utils.import("resource://app/modules/gloda/mimemsg.js");

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
var gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224"];

var gEnigEditor;
var gEnigDirty, gEnigProcessed, gEnigTimeoutID;
var gEnigSendPGPMime = false;
var gEnigMeodifiedAttach, gEnigSendMode;
var gEnigSendModeDirty = 0;
var gEnigNextCommand;
var gEnigDocStateListener = null;
var gEnigIdentity = null;
var gEnigEnableRules = null;
var gEnigAttachOwnKey = { appendAttachment: false, attachedObj: null, attachedKey: null };
var gEnigModifiedAttach;
var gEnigLastFocusedWindow = null;
var gEnigDetermineSendFlagID = null;

try {
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
  var vc = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);

}
catch (ex) {}
window.addEventListener("load", enigMsgComposeStartup, false);
window.addEventListener("unload", enigMsgComposeUnload, false);

// Handle recycled windows
window.addEventListener('compose-window-close', enigMsgComposeClose, true);
window.addEventListener('compose-window-reopen', enigMsgComposeReopen, true);

// Listen to message sending event
window.addEventListener('compose-send-message', enigSendMessageListener, true);

function enigMsgComposeStartup() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeStartup\n");

  // Relabel/hide SMIME button and menu item
  var smimeButton = document.getElementById("button-security");

  if (smimeButton) {
    smimeButton.setAttribute("label", "S/MIME");
  }

  var enigButton = document.getElementById("button-enigmail-send");

  var msgId = document.getElementById("msgIdentityPopup");
  if (msgId)
    msgId.setAttribute("oncommand", "enigSetIdentityCallback();");

  var subj = document.getElementById("msgSubject");

  subj.setAttribute('onfocus', "enigFireSendFlags()");

  enigSetIdentityDefaults();
  enigMsgComposeReset(false);
  enigComposeOpen();
}

function enigMsgComposeUnload() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeUnload\n");
  if (gMsgCompose)
    gMsgCompose.UnregisterStateListener(gEnigComposeStateListener);

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
      break;
    case 'pgpMimeMode':
    case 'attachPgpKey':
      r=gEnigIdentity.getBoolAttribute(value);
      break;
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
    case 'pgpMimeMode':
    case 'attachPgpKey':
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

  gEnigSendPGPMime = enigGetAccDefault("pgpMimeMode");
  gEnigAttachOwnKey.appendAttachment = enigGetAccDefault("attachPgpKey");
  gEnigAttachOwnKey.attachedObj = null;
  gEnigAttachOwnKey.attachedKey = null;
}

function enigGetMsgProperties(msgUri, draft) {
  var properties = 0;
  try {
    var messenger = Components.classes["@mozilla.org/messenger;1"].getService(Components.interfaces.nsIMessenger);
    var msgHdr = messenger.messageServiceFromURI(msgUri).messageURIToMsgHdr(msgUri);
    if (msgHdr) {
      properties = msgHdr.getUint32Property("enigmail");
      if (draft) {
        try {
          MsgHdrToMimeMessage(msgHdr , null, enigGetMsgPropertiesCb, false);
        }
        catch (ex) {
          DEBUG_LOG("enigmailMessengerOverlay.js: enigGetMsgProperties: cannot use MsgHdrToMimeMessage\n");
        }
      }
    }
  }
  catch (ex) {  }

  var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
  if (enigMimeService && enigMimeService.isEncrypted(msgUri)) {
    properties |= nsIEnigmail.DECRYPTION_OKAY;
  }

  return properties;
}

function enigGetMsgPropertiesCb (msg, mimeMsg) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigGetMsgPropertiesCb\n");

  var flags = 0;
  if (mimeMsg && mimeMsg.headers["x-enigmail-draft-status"])
    flags = Number(mimeMsg.headers["x-enigmail-draft-status"]);

  if (flags & ENIG_SIGN) enigSetSendMode('sign');
}


function enigComposeOpen() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigComposeOpen\n");

  var msgFlags;
  var msgUri = null;
  var msgIsDraft = false;
  gMsgCompose.RegisterStateListener(gEnigComposeStateListener);
  gEnigDetermineSendFlagID = null;

  var toobarElem = document.getElementById("composeToolbar2");
  if (toobarElem && (EnigGetOS() == "Darwin")) {
    toobarElem.setAttribute("platform", "macos");
  }

  if (EnigGetPref("keepSettingsForReply") && (!(gEnigSendMode & ENIG_ENCRYPT))) {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
    if (enigMimeService)
    {
      var draftId = gMsgCompose.compFields.draftId;
      if (typeof(draftId)=="string" && draftId.length>0) {
        msgUri = draftId.replace(/\?.*$/, "");
        msgIsDraft = true;
      }
      else if (typeof(gMsgCompose.originalMsgURI)=="string" && gMsgCompose.originalMsgURI.length>0) {
        msgUri = gMsgCompose.originalMsgURI;
      }

      if (msgUri != null) {
        msgFlags = enigGetMsgProperties(msgUri, msgIsDraft);
        if (msgFlags & nsIEnigmail.DECRYPTION_OKAY) {
          DEBUG_LOG("enigmailMsgComposeOverlay.js: enigComposeOpen: has encrypted originalMsgUri\n");
          DEBUG_LOG("originalMsgURI="+gMsgCompose.originalMsgURI+"\n");
          enigSetSendMode('encrypt');
          enigRemoveAttachedKey();
        }
        else if (msgFlags & (nsIEnigmail.GOOD_SIGNATURE |
            nsIEnigmail.BAD_SIGNATURE |
            nsIEnigmail.UNVERIFIED_SIGNATURE)) {
          enigSetSendMode('sign');
          enigRemoveAttachedKey();
        }
      }
    }
  }

  // check for attached signature files and remove them
  var bucketList = document.getElementById("attachmentBucket");
  if (bucketList.hasChildNodes()) {
    var node = bucketList.firstChild;
    nodeNumber=0;
    while (node) {
      if (node.attachment.contentType == "application/pgp-signature") {
        if (! enigFindRelatedAttachment(bucketList, node)) {
          node = bucketList.removeItemAt(nodeNumber);
          // Let's release the attachment object held by the node else it won't go away until the window is destroyed
          node.attachment = null;
        }
      }
      else {
        ++nodeNumber;
      }
      node = node.nextSibling;
    }
    if (! bucketList.hasChildNodes()) {
      try {
        // TB only
      ChangeAttachmentBucketVisibility(true);
      }
      catch (ex) {}
    }
  }
  enigDisplayUi();
}

// check if an signature is related to another attachment
function enigFindRelatedAttachment(bucketList, node) {

  // check if filename ends with .sig
  if (node.attachment.name.search(/\.sig$/i) < 0) return null;

  var relatedNode = bucketList.firstChild;
  var findFile = node.attachment.name.toLowerCase();
  var baseAttachment = null;
  while (relatedNode) {
    if (relatedNode.attachment.name.toLowerCase()+".sig" == findFile) baseAttachment = relatedNode.attachment;
    relatedNode = relatedNode.nextSibling;
  }
  return baseAttachment;
}

function enigMsgComposeReopen() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeReopen\n");
  enigMsgComposeReset(false);

  enigComposeOpen();
}

function enigMsgComposeClose() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeClose\n");

  var ioServ;
  try {
    // we should delete the original temporary files of the encrypted or signed
    // inline PGP attachments (the rest is done automatically)
    if (gEnigModifiedAttach) {
      ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
      if (!ioServ)
        return;

      for (var i in gEnigModifiedAttach) {
        if (gEnigModifiedAttach[i].origTemp) {
          DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeClose: deleting "+gEnigModifiedAttach[i].origUrl+"\n");
          var fileUri = ioServ.newURI(gEnigModifiedAttach[i].origUrl, null, null);
          var fileHandle = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
          fileHandle.initWithPath(fileUri.path);
          if (fileHandle.exists()) fileHandle.remove(false);
        }
      }
      gEnigModifiedAttach = null;
    }

  } catch (ex) {
    ERROR_LOG("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: could not delete all files:\n"+ex.toString()+"\n");
  }

  enigMsgComposeReset(true);
}

function enigMsgComposeReset(closing) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMsgComposeReset\n");

  gEnigDirty = 0;
  gEnigProcessed = null;
  gEnigTimeoutID = null;

  gEnigModifiedAttach=null;
  gEnigSendModeDirty = 0;
  gEnigSendMode = 0;
  gEnigEnableRules = true;
  gEnigIdentity = null;

  if (! closing) {
    enigSetIdentityDefaults();
    document.getElementById("enigmail-rules-status").setAttribute("value", "-");
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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigTogglePGPMime\n");

  gEnigSendPGPMime = !gEnigSendPGPMime;
}

function enigToggleAttachOwnKey () {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigToggleAttachOwnKey\n");
  GetEnigmailSvc(); // make sure Enigmail is loaded and working
  gEnigAttachOwnKey.appendAttachment = !gEnigAttachOwnKey.appendAttachment;
}

function enigAttachOwnKey() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigAttachOwnKey:\n");

  var userIdValue;

  if (gEnigIdentity.getIntAttribute("pgpKeyMode")>0) {
    userIdValue = gEnigIdentity.getCharAttribute("pgpkeyId");

    if (gEnigAttachOwnKey.attachedKey && (gEnigAttachOwnKey.attachedKey != userIdValue)) {
      // remove attached key if user ID changed
      enigRemoveAttachedKey();
    }

    if (! gEnigAttachOwnKey.attachedKey) {
      var attachedObj = enigExtractAndAttachKey( [userIdValue] );
      if (attachedObj) {
        gEnigAttachOwnKey.attachedObj = attachedObj;
        gEnigAttachOwnKey.attachedKey = userIdValue;
      }
    }
  }
  else {
     ERROR_LOG("enigmailMsgComposeOverlay.js: enigAttachOwnKey: trying to attach unknown own key!\n");
  }
}

function enigAttachKey() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigAttachKey: \n");

  var resultObj = new Object();
  var inputObj = new Object();
  inputObj.dialogHeader = EnigGetString("keysToExport");
  inputObj.options = "multisel,allowexpired,nosending";
  var userIdValue="";

  window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
  try {
    if (resultObj.cancelled) return;
    enigExtractAndAttachKey(resultObj.userList);
  } catch (ex) {
    // cancel pressed -> do nothing
    return;
  }
}

function enigExtractAndAttachKey(uid) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigAttachKey: \n");
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return null;

  var tmpDir=EnigGetTempDir();

  try {
    var tmpFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
    tmpFile.initWithPath(tmpDir);
    if (!(tmpFile.isDirectory() && tmpFile.isWritable())) {
      EnigAlert(EnigGetString("noTempDir"));
      return null;
    }
  }
  catch (ex) {
    EnigWriteException("enigmailMsgComposeOverlay.js: enigExtractAndAttachKey", ex);
  }
  tmpFile.append("key.asc");
  tmpFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);

  // save file
  var exitCodeObj= {};
  var errorMsgObj = {};

  enigmailSvc.extractKey(window, 0, uid.join(" "), tmpFile /*.path */, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value != 0) {
    EnigAlert(errorMsgObj.value);
    return  null;
  }

  // create attachment
  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
  var tmpFileURI = ioServ.newFileURI(tmpFile);
  var keyAttachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
  keyAttachment.url = tmpFileURI.spec;
  if ((uid.length == 1) && (uid[0].search(/^(0x)?[a-fA-F0-9]+$/)==0)) {
    keyAttachment.name = "0x"+uid[0].substr(-8,8)+".asc";
  }
  else {
    keyAttachment.name = "pgpkeys.asc";
  }
  keyAttachment.temporary = true;
  keyAttachment.contentType = "application/pgp-keys";

  // add attachment to msg
  enigAddAttachment(keyAttachment);

  try {
    // TB only
    ChangeAttachmentBucketVisibility(false);
  }
  catch (ex) {}
  gContentChanged = true;
  return keyAttachment;
}

function enigAddAttachment(attachment) {
  if (typeof(AddAttachment) == "undefined") {
    // TB >= 3.0
    AddUrlAttachment(attachment);
  }
  else {
    // SeaMonkey and TB <= 3.0
    AddAttachment(attachment);
  }
}

function enigUndoEncryption() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigUndoEncryption: \n");
  if (gEnigProcessed) {
    enigReplaceEditorText(gEnigProcessed.origText);

    gEnigProcessed = null;

  } else {
    enigDecryptQuote(true);
  }

  var node;
  var nodeNumber;
  var bucketList = document.getElementById("attachmentBucket");
  if ( gEnigModifiedAttach && bucketList && bucketList.hasChildNodes() ) {
    // undo inline encryption of attachments
    for (var i=0; i<gEnigModifiedAttach.length; i++) {
      node = bucketList.firstChild;
      nodeNumber=-1;
      while (node) {
        ++nodeNumber;
        if (node.attachment.url == gEnigModifiedAttach[i].newUrl) {
          if (gEnigModifiedAttach[i].encrypted) {
            node.attachment.url = gEnigModifiedAttach[i].origUrl;
            node.attachment.name = gEnigModifiedAttach[i].origName;
            node.attachment.temporary = gEnigModifiedAttach[i].origTemp;
            node.attachment.contentType = gEnigModifiedAttach[i].origCType;
          }
          else {
            node = bucketList.removeItemAt(nodeNumber);
            // Let's release the attachment object held by the node else it won't go away until the window is destroyed
            node.attachment = null;
          }
          // delete encrypted file
          try {
            gEnigModifiedAttach[i].newFile.remove(false);
          }
          catch (ex) {}

          node = null; // next attachment please
        }
        else {
          node=node.nextSibling;
        }
      }
    }
  }

  enigRemoveAttachedKey();
}

function enigRemoveAttachedKey() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigRemoveAttachedKey: \n");

  var bucketList = document.getElementById("attachmentBucket");
  var node = bucketList.firstChild;

  if (bucketList && bucketList.hasChildNodes() && gEnigAttachOwnKey.attachedObj) {
    // undo attaching own key
    var nodeNumber=-1;
    while (node) {
      ++nodeNumber;
      if (node.attachment.url == gEnigAttachOwnKey.attachedObj.url) {
        node = bucketList.removeItemAt(nodeNumber);
        // Let's release the attachment object held by the node else it won't go away until the window is destroyed
        node.attachment = null;
        gEnigAttachOwnKey.attachedObj = null;
        gEnigAttachOwnKey.attachedKey = null;
        node = null; // exit loop
      }
      else {
        node=node.nextSibling;
      }
    }
    if (! bucketList.hasChildNodes()) {
      try {
        // TB only
        ChangeAttachmentBucketVisibility(true);
      }
      catch(ex) {}
    }
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
  GetEnigmailSvc();
  var server=null;
  try {
      var currentId=getCurrentIdentity();
      var amService=Components.classes["@mozilla.org/messenger/account-manager;1"].getService();
      var servers=amService.GetServersForIdentity(currentId);
      var folderURI=servers.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer).serverURI;
      server=GetMsgFolderFromUri(folderURI, true).server
  } catch (ex) {}
  window.openDialog("chrome://enigmail/content/am-enigprefs-edit.xul", "", "dialog,modal,centerscreen", {identity: currentId, account: server});
  enigSetIdentityDefaults();
}

function enigDoPgpButton(what) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDoPgpButton: what="+what+"\n");
  if (! what)
    what = gEnigNextCommand;
  gEnigNextCommand = "";
  GetEnigmailSvc(); // try to access Enigmail to launch the wizard if needed

  try {
    if (!enigGetAccDefault("enabled")) {
      if (EnigConfirm(EnigGetString("configureNow"), EnigGetString("msgCompose.button.configure"))) {
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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSetSendMode: sendMode="+sendMode+"\n");
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
    case 'sign':
      gEnigSendMode |= ENIG_SIGN;
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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDisplayUi:\n");
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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSetMenuSettings: postfix="+postfix+"\n");
  document.getElementById("enigmail_encrypted_send"+postfix).setAttribute("checked", gEnigSendMode & ENIG_ENCRYPT ? "true": "false");
  document.getElementById("enigmail_signed_send"+postfix).setAttribute("checked", gEnigSendMode & ENIG_SIGN ? "true" : "false");

  var menuElement = document.getElementById("enigmail_sendPGPMime"+postfix);
  if (menuElement)
    menuElement.setAttribute("checked", gEnigSendPGPMime.toString());

  menuElement = document.getElementById("enigmail_disable_rules"+postfix);
  if (menuElement)
    menuElement.setAttribute("checked", (!gEnigEnableRules).toString());

  menuElement = document.getElementById("enigmail_insert_own_key");
  if (menuElement) {
    if (gEnigIdentity.getIntAttribute("pgpKeyMode")>0) {
      menuElement.setAttribute("checked", gEnigAttachOwnKey.appendAttachment.toString());
      menuElement.removeAttribute("disabled");
    }
    else {
      menuElement.setAttribute("disabled", "true");
    }
  }
}

function enigDisplaySecuritySettings() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDisplaySecuritySettings\n");
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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDisplaySignClickWarn\n");
  if ((gEnigSendModeDirty<2) &&
      (enigGetAccDefault("signPlain") ||
       enigGetAccDefault("signEnc"))) {
    EnigAlertPref(EnigGetString("signIconClicked"), "displaySignWarn");
  }
}

function enigConfirmBeforeSend(toAddr, gpgKeys, sendFlags, isOffline, msgSendType) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigConfirmBeforeSend: sendFlags="+sendFlags+"\n");
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

  gpgKeys=gpgKeys.replace(/^, /, "").replace(/, $/,"");

  var msgConfirm = (isOffline || sendFlags & nsIEnigmail.SEND_LATER)
          ? EnigGetString("offlineSave",msgStatus,EnigStripEmail(toAddr).replace(/,/g, ", "))
          : EnigGetString("onlineSend",msgStatus,EnigStripEmail(toAddr).replace(/,/g, ", "));
  if (sendFlags & ENIG_ENCRYPT)
    msgConfirm += "\n\n"+EnigGetString("encryptKeysNote", gpgKeys);

  return EnigConfirm(msgConfirm,
      EnigGetString((isOffline || sendFlags & nsIEnigmail.SEND_LATER) ? "msgCompose.button.save" :"msgCompose.button.send"));
}


function enigAddRecipients(toAddrList, recList) {
  for (var i=0; i<recList.length; i++) {
    toAddrList.push(EnigStripEmail(recList[i].replace(/[\",]/g, "")));
  }
}

function enigSetDraftStatus(sendFlags) {
  gMsgCompose.compFields.otherRandomHeaders += "X-Enigmail-Draft-Status: "+sendFlags+"\r\n";
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
  case nsIMsgCompDeliverMode.SaveAsTemplate:
  case nsIMsgCompDeliverMode.AutoSaveAsDraft:
    sendFlags |= nsIEnigmail.SAVE_MESSAGE;
    break;
  }

  var msgCompFields = gMsgCompose.compFields;
  var newsgroups = msgCompFields.newsgroups;  // Check if sending to any newsgroups

  if ((! (sendFlags & nsIEnigmail.SAVE_MESSAGE)) &&
      msgCompFields.to == "" &&
      msgCompFields.cc == "" &&
      msgCompFields.bcc == "" &&
      newsgroups == "") {
    // don't attempt to send message if no recipient specified
    var bundle = document.getElementById("bundle_composeMsgs");
    EnigAlert(bundle.getString("12511"));
    // EnigAlert(sComposeMsgsBundle.getString("12511"));
    return false;
  }

  if (gotSendFlags & ENIG_SIGN)
      sendFlags |= ENIG_SIGN;
  if (gotSendFlags & ENIG_ENCRYPT) {
    sendFlags |= ENIG_ENCRYPT;
  }
  var encryptIfPossible = false;
  if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
    if (!((sendFlags & ENIG_ENCRYPT) && EnigConfirmPref(EnigGetString("savingMessage"), "saveEncrypted", EnigGetString("msgCompose.button.encrypt"), EnigGetString("msgCompose.button.dontEncrypt")))) {
      sendFlags &= ~ENIG_ENCRYPT;

      if (gEnigAttachOwnKey.appendAttachment) enigAttachOwnKey();

      if (sendFlags & ENIG_SIGN) enigSetDraftStatus(sendFlags);
      return true;
    }
  }

  if (gWindowLocked) {
    EnigAlert(EnigGetString("windowLocked"));
    return false;
  }

  if (gEnigDirty) {
    // make sure the sendFlags are reset before the message is processed
    // (it may have been set by a previously cancelled send operation!)
    try {
      if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIEnigMsgCompFields) {
        gMsgCompose.compFields.securityInfo.sendFlags=0;
      }
      else if (gMsgCompose.compFields.securityInfo == null) {
        throw "dummy";
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
      catch (ex) {
        EnigWriteException("enigmailMsgComposeOverlay.js: enigAttachKey", ex);
      }
    }
  }
  gEnigDirty = true;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     var msg=EnigGetString("sendUnencrypted");
     if (gEnigmailSvc && gEnigmailSvc.initializationError) {
        msg = gEnigmailSvc.initializationError +"\n\n"+msg;
     }

     return EnigConfirm(msg, EnigGetString("msgCompose.button.send"));
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
        if ((sendFlags & ENIG_ENCRYPT_OR_SIGN) || gEnigAttachOwnKey.appendAttachment) {
          if (!EnigConfirm(EnigGetString("acctNotConfigured"), EnigGetString("msgCompose.button.send")))
              return false;
        }
        return true;
     }

     var recipientsSelection = EnigGetPref("recipientsSelection");

     var optSendFlags = 0;
     var inlineEncAttach=false;

     if (EnigGetPref("alwaysTrustSend")) {
       optSendFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;
     }

     if (EnigGetPref("encryptToSelf") || (sendFlags & nsIEnigmail.SAVE_MESSAGE)) {
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

     if (typeof(userIdValue) != "string") {
       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: type of userIdValue="+typeof(userIdValue)+"\n");
       userIdValue = gEnigIdentity.email;
     }

     DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg:gMsgCompose="+gMsgCompose+"\n");

     var toAddrList = [];
     var bccAddrList = [];
     if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
        if (userIdValue.search(/@/) == -1 ) {
          toAddrList.push(userIdValue);
        }
        else {
          toAddrList.push(EnigStripEmail(userIdValue.replace(/[\",]/g, "")));
        }
     }
     else {
       var splitRecipients;
       var arrLen =  new Object();
       splitRecipients = msgCompFields.splitRecipients;

       //EnigAlert(typeof(msgCompFields.cc));
       if (msgCompFields.to.length > 0) {
         var recList = splitRecipients(msgCompFields.to, true, arrLen)
         enigAddRecipients(toAddrList, recList);
       }

       if (msgCompFields.cc.length > 0) {
         recList = splitRecipients(msgCompFields.cc, true, arrLen)
         enigAddRecipients(toAddrList, recList);
       }

       if (msgCompFields.bcc.length > 0) {
         recList = splitRecipients(msgCompFields.bcc, true, arrLen)

         var bccLC = EnigStripEmail(msgCompFields.bcc).toLowerCase()
         DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: BCC: "+bccLC+"\n");

         var selfBCC = gEnigIdentity.email && (gEnigIdentity.email.toLowerCase() == bccLC);

         if (selfBCC) {
           DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: Self BCC\n");
           enigAddRecipients(toAddrList, recList);

         } else if (sendFlags & ENIG_ENCRYPT) {
           // BCC and encryption

           if (encryptIfPossible) {
             sendFlags &= ~ENIG_ENCRYPT;
             DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: No default encryption because of BCC\n");

           } else {
             var dummy={value: null};

             var hideBccUsers = gEnigPromptSvc.confirmEx(window,
                        EnigGetString("enigConfirm"),
                        EnigGetString("sendingHiddenRcpt"),
                        (gEnigPromptSvc. BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_0) +
                        (gEnigPromptSvc. BUTTON_TITLE_CANCEL * ENIG_BUTTON_POS_1) +
                        (gEnigPromptSvc. BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_2),
                        EnigGetString("sendWithShownBcc"), null, EnigGetString("sendWithHiddenBcc"),
                        null, dummy);
              switch (hideBccUsers) {
              case 2:
                enigAddRecipients(bccAddrList, recList);
                // no break here on purpose!
              case 0:
                enigAddRecipients(toAddrList, recList);
                break;
              case 1:
               return false;
              }
           }
         }
       }

       if (newsgroups) {
         toAddrList.push(newsgroups);

         if (sendFlags & ENIG_ENCRYPT) {

           if (!encryptIfPossible) {
             if (!EnigGetPref("encryptToNews")) {
               EnigAlert(EnigGetString("sendingNews"));
               return false;
             }
             else if (!EnigConfirmPref(EnigGetString("sendToNewsWarning"), "warnOnSendingNewsgroups", EnigGetString("msgCompose.button.send"))) {
               return false;
             }
           }
           else {
             sendFlags &= ~ENIG_ENCRYPT;
             DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: No default encryption because of newsgroups\n");
           }
         }
       }
     }

     var usePGPMimeOption = EnigGetPref("usePGPMimeOption");

     if (gEnigSendPGPMime) {
       // Use PGP/MIME
       sendFlags |= nsIEnigmail.SEND_PGP_MIME;
     }

     var toAddr = toAddrList.join(", ");
     var bccAddr = bccAddrList.join(", ");
     var testCipher = null;

     var notSignedIfNotEnc= (gEnigSendModeDirty<2 && (! enigGetAccDefault("signPlain")));

     if (toAddr.length>=1) {

        DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: toAddr="+toAddr+"\n");
        var repeatSelection=0;
        while (repeatSelection<2) {
          if (recipientsSelection != 3 && recipientsSelection != 4
              && gEnigEnableRules) {
            var matchedKeysObj = new Object;
            var flagsObj=new Object;
            if (!getRecipientsKeys(toAddr,
                                  (repeatSelection==1),
                                  true,
                                  matchedKeysObj,
                                  flagsObj)) {
              return false;
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

            if (!getRecipientsKeys(bccAddr,
                                  (repeatSelection==1),
                                  true,
                                  matchedKeysObj,
                                  flagsObj)) {
              return false;
            }
            if (matchedKeysObj.value) bccAddr=matchedKeysObj.value;
            // bcc recipients are part of "normal" recipients as well; no need to do furter processing of flags etc.
          }
          repeatSelection++;

          if (sendFlags & ENIG_ENCRYPT) {
            // Encrypt test message for default encryption
            var testExitCodeObj    = new Object();
            var testStatusFlagsObj = new Object();
            var testErrorMsgObj    = new Object();

            var testPlain = "Test Message";
            var testUiFlags   = nsIEnigmail.UI_TEST;
            var testSendFlags = nsIEnigmail.SEND_TEST | ENIG_ENCRYPT |
                                optSendFlags;

            // test recipients
            testCipher = enigmailSvc.encryptMessage(window, testUiFlags, null,
                                                    testPlain,
                                                    fromAddr, toAddr, bccAddr,
                                                    testSendFlags,
                                                    testExitCodeObj,
                                                    testStatusFlagsObj,
                                                    testErrorMsgObj);

            if ((recipientsSelection==4) ||
                ((testStatusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) &&
                 (recipientsSelection==2 || recipientsSelection==3))) {
                var resultObj = new Object();
                var inputObj = new Object();
                inputObj.toAddr = toAddr;
                inputObj.invalidAddr = enigGetInvalidAddress(testErrorMsgObj.value);
                inputObj.options = "multisel";
                if (recipientsSelection==2)
                  inputObj.options += ",rulesOption"
                if (notSignedIfNotEnc)
                  inputObj.options += ",notsigned";
                if (recipientsSelection == 4)
                  inputObj.options += ",noforcedisp";
                inputObj.dialogHeader = EnigGetString("recipientsSelectionHdr");

                window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
                try {
                  if (resultObj.cancelled) {
                    return false;
                  }
                  if (resultObj.perRecipientRules && gEnigEnableRules) {
                    // do an extra round because the user want to set a PGP rule
                    continue;
                  }
                  if (! resultObj.encrypt) {
                    // encryption explicitely turned off
                    sendFlags &= ~ENIG_ENCRYPT;
                    if (notSignedIfNotEnc) sendFlags &= ~ENIG_SIGN;
                  }
                  else {
                    if (bccAddrList.length > 0) {
                      bccAddr=resultObj.userList.join(", ");
                      toAddr="";
                    }
                    else {
                      toAddr = resultObj.userList.join(", ");
                      bccAddr="";
                    }
                  }
                  testCipher="ok";
                  testExitCodeObj.value = 0;
                } catch (ex) {
                  // cancel pressed -> don't send mail
                  return false;
                }
            }
            if ((!testCipher || (testExitCodeObj.value != 0)) && recipientsSelection==5) {
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
            sendFlags &= ~ENIG_SIGN;
          }
        }
     }

     if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
       // always enable PGP/MIME if message is saved
       sendFlags |= nsIEnigmail.SEND_PGP_MIME;
     }

     if (gEnigAttachOwnKey.appendAttachment) enigAttachOwnKey();

     var bucketList = document.getElementById("attachmentBucket");
     var hasAttachments = ((bucketList && bucketList.hasChildNodes()) || gMsgCompose.compFields.attachVCard);

     DEBUG_LOG("enigmailMsgComposeOverlay.js: hasAttachments = "+hasAttachments+"\n");

     if ( hasAttachments &&
        (sendFlags & ENIG_ENCRYPT_OR_SIGN) &&
        !(sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
        enigmailSvc.composeSecure) {

        inputObj = new Object();
        inputObj.pgpMimePossible = true;
        inputObj.inlinePossible = true;
        inputObj.restrictedScenario = false;

        // determine if attachments are all local files (currently the only
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
          resultObj.selected = EnigGetPref("encryptAttachments");

          //skip or not
          var skipCheck=EnigGetPref("encryptAttachmentsSkipDlg");
          if (skipCheck == 1) {
            if ((resultObj.selected == 2 && inputObj.pgpMimePossible == false) || (resultObj.selected == 1 && inputObj.inlinePossible == false)) {
              //add var to disable remember box since we're dealing with restricted scenarios...
              inputObj.restrictedScenario = true;
              resultObj.selected = -1;
              window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
            }
          } else {
            resultObj.selected = -1;
            window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
          }
          if (resultObj.selected < 0) {
            // dialog cancelled
            return false;
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
            if (!EnigConfirm(EnigGetString("attachWarning"), EnigGetString("msgCompose.button.send")))
              return false;
          }
        }
     }

     var usingPGPMime = (sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
                        (sendFlags & ENIG_ENCRYPT_OR_SIGN);

     if (usingPGPMime && !enigmailSvc.composeSecure) {
       if (!EnigConfirm(EnigGetString("noPGPMIME"), EnigGetString("msgCompose.button.useInlinePGP"))) {
          throw Components.results.NS_ERROR_FAILURE;

       }

       usingPGPMime = false;
     }

     // Detect PGP/MIME and S/MIME
     if (usingPGPMime) {
        if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIMsgSMIMECompFields) {

            if (gMsgCompose.compFields.securityInfo.requireEncryptMessage ||
               gMsgCompose.compFields.securityInfo.signMessage) {
               var prefAlgo = EnigGetPref("mimePreferPgp");
               if (prefAlgo == 1) {
                 var checkedObj={ value: null};
                 var prefAlgo = gEnigPromptSvc.confirmEx(window,
                            EnigGetString("enigConfirm"),
                            EnigGetString("pgpMime_sMime.dlg.text"),
                            (gEnigPromptSvc. BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_0) +
                            (gEnigPromptSvc. BUTTON_TITLE_CANCEL * ENIG_BUTTON_POS_1) +
                            (gEnigPromptSvc. BUTTON_TITLE_IS_STRING * ENIG_BUTTON_POS_2),
                            EnigGetString("pgpMime_sMime.dlg.pgpMime.button"), null,
                            EnigGetString("pgpMime_sMime.dlg.sMime.button"),
                            EnigGetString("dlgKeepSetting"), checkedObj);
                 if (checkedObj.value && (prefAlgo==0 || prefAlgo==2)) EnigSetPref("mimePreferPgp", prefAlgo);
               }
               switch (prefAlgo) {
               case 0:
                  gMsgCompose.compFields.securityInfo.requireEncryptMessage = false;
                  gMsgCompose.compFields.securityInfo.signMessage = false;
                  break;
               case 1:
                  return false;
               case 2:
                  return true;
                  break;
               default:
                 return false;
               }
            }
        }
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

       if ((sendFlags & nsIEnigmail.SAVE_MESSAGE) && (sendFlags & ENIG_SIGN)) {
          enigSetDraftStatus(sendFlags);
          sendFlags &= ~ENIG_SIGN;
       }

       newSecurityInfo.sendFlags = sendFlags;
       newSecurityInfo.UIFlags = uiFlags;
       newSecurityInfo.senderEmailAddr = fromAddr;
       newSecurityInfo.recipients = toAddr;
       newSecurityInfo.bccRecipients = bccAddr;
       newSecurityInfo.hashAlgorithm = gMimeHashAlgorithms[EnigGetPref("mimeHashAlgorithm")];

       DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: securityInfo = "+newSecurityInfo+"\n");

     }
     else if (!gEnigProcessed && (sendFlags & ENIG_ENCRYPT_OR_SIGN)) {
       // use inline PGP

       var sendInfo = {
         sendFlags: sendFlags,
         inlineEncAttach: inlineEncAttach,
         fromAddr: fromAddr,
         toAddr: toAddr,
         bccAddr: bccAddr,
         uiFlags: uiFlags,
         bucketList: bucketList
       };

       if (! enigEncryptInline(sendInfo)) {
         return false;
       }
     }

     // EnigSend: Handle both plain and encrypted messages below
     var isOffline = (gIOService && gIOService.offline);
     window.enigmailSendFlags=sendFlags;

     // update the list of attachments
     Attachments2CompFields(msgCompFields);

     if ((!(sendFlags & nsIEnigmail.SAVE_MESSAGE)) && EnigGetPref("confirmBeforeSend")) {
       if (!enigConfirmBeforeSend(toAddrList.join(", "), toAddr+", "+bccAddr, sendFlags, isOffline)) {
         if (gEnigProcessed) {
           enigUndoEncryption();
         }
         else {
           enigRemoveAttachedKey();
         }
         return false;
       }
     }
     else if ( (sendFlags & nsIEnigmail.SEND_WITH_CHECK) &&
                 !enigMessageSendCheck() ) {
       // Abort send
       if (gEnigProcessed) {
          enigUndoEncryption();
       }
       else {
          enigRemoveAttachedKey();
       }

       return false;
     }

     if (msgCompFields.characterSet != "ISO-2022-JP") {
       if ((usingPGPMime &&
           ((sendFlags & ENIG_ENCRYPT_OR_SIGN))) || ((! usingPGPMime) && (sendFlags & ENIG_ENCRYPT))) {
         try {
            // make sure plaintext is not changed to 7bit
            if (typeof(msgCompFields.forceMsgEncoding) == "boolean") {
              msgCompFields.forceMsgEncoding = true;
              DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: enabled forceMsgEncoding\n");
            }
         }
         catch (ex) {}
      }
    }
  } catch (ex) {
     EnigWriteException("enigmailMsgComposeOverlay.js: enigEncryptMsg", ex);
     msg=EnigGetString("signFailed");
     if (gEnigmailSvc && gEnigmailSvc.initializationError) {
        msg += "\n"+gEnigmailSvc.initializationError;
     }
     return EnigConfirm(msg, EnigGetString("msgCompose.button.sendUnencrypted"));
  }

  return true;
}

function enigEncryptInline(sendInfo) {
  // sign/encrpyt message using inline-PGP

  var enigmailSvc = GetEnigmailSvc();
  if (! enigmailSvc) return false;

  if (gMsgCompose.composeHTML) {
    var errMsg = EnigGetString("hasHTML");
    EnigAlertCount("composeHtmlAlertCount", errMsg);
  }

  try {
    var convert = DetermineConvertibility();
    if (convert == nsIMsgCompConvertible.No) {
      if (!EnigConfirm(EnigGetString("strippingHTML"), EnigGetString("msgCompose.button.sendAnyway"))) {
        return false;
      }
    }
  } catch (ex) {
     EnigWriteException("enigmailMsgComposeOverlay.js: enigEncryptInline", ex);
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

      if (wrapWidth > 0 && wrapWidth < 68) {
        if (EnigConfirm(EnigGetString("minimalLineWrapping", wrapWidth))) {
          gEnigPrefRoot.setIntPref("editor.htmlWrapColumn", 68)
        }
      }
      if (!(sendInfo.sendFlags & ENIG_ENCRYPT) && EnigGetPref("wrapHtmlBeforeSend")) {
        if (wrapWidth > 0) {
          var editor = gMsgCompose.editor.QueryInterface(nsIPlaintextEditorMail);
          editor.wrapWidth=wrapWidth-2; // prepare for the worst case: a 72 char's long line starting with '-'
          editor.rewrap(false);
        }
      }
    }
    catch (ex) {}
  }
  else {
    try {
      wrapWidth = gEnigPrefRoot.getIntPref("mailnews.wraplength");
      if (wrapWidth > 0 && wrapWidth < 68) {
        if (EnigConfirm(EnigGetString("minimalLineWrapping", wrapWidth))) {
          gEnigPrefRoot.setIntPref("mailnews.wraplength", 68)
        }
      }
    }
    catch (ex) {}
  }

  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj    = new Object();


  // Get plain text
  // (Do we need to set the nsIDocumentEncoder.* flags?)
  var origText = EnigEditorGetContentsAs("text/plain",
                                         encoderFlags);

  if (origText.length > 0) {
    // Sign/encrypt body text

    var escText = origText; // Copy plain text for possible escaping

    if (sendFlowed && !(sendInfo.sendFlags & ENIG_ENCRYPT)) {
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

    // Encrypt plaintext
    var charset = EnigEditorGetCharset();
    DEBUG_LOG("enigmailMsgComposeOverlay.js: enigEncryptMsg: charset="+charset+"\n");

    // Encode plaintext to charset from unicode
    var plainText = (sendInfo.sendFlags & ENIG_ENCRYPT)
                   ? EnigConvertFromUnicode(origText, charset)
                   : EnigConvertFromUnicode(escText, charset);

    var cipherText = enigmailSvc.encryptMessage(window, sendInfo.uiFlags, null, plainText,
                                          sendInfo.fromAddr, sendInfo.toAddr, sendInfo.bccAddr,
                                          sendInfo.sendFlags,
                                          exitCodeObj, statusFlagsObj,
                                          errorMsgObj);

    var exitCode = exitCodeObj.value;

    //DEBUG_LOG("enigmailMsgComposeOverlay.js: cipherText = '"+cipherText+"'\n");
    if (cipherText && (exitCode == 0)) {
      // Encryption/signing succeeded; overwrite plaintext

      if (gMsgCompose.composeHTML) {
        // workaround for Thunderbird bug (TB adds an extra space in front of the text)
        cipherText = "\n"+cipherText;
      }
      else
        cipherText = cipherText.replace(/\r\n/g, "\n");

      if ( (sendInfo.sendFlags & ENIG_ENCRYPT) && charset &&
        (charset.search(/^us-ascii$/i) != 0) ) {
        // Add Charset armor header for encrypted blocks
        cipherText = cipherText.replace(/(-----BEGIN PGP MESSAGE----- *)(\r?\n)/, "$1$2Charset: "+charset+"$2");
      }

      // Decode ciphertext from charset to unicode and overwrite
      enigReplaceEditorText( EnigConvertToUnicode(cipherText, charset) );

      // Save original text (for undo)
      gEnigProcessed = {"origText":origText, "charset":charset};

    }
    else {
      // Restore original text
      enigReplaceEditorText(origText);

      if (sendInfo.sendFlags & ENIG_ENCRYPT_OR_SIGN) {
        // Encryption/signing failed
        EnigAlert(EnigGetString("sendAborted")+errorMsgObj.value);
        return false;
      }
    }
  }

  if (sendInfo.inlineEncAttach) {
    // encrypt attachments
    gEnigModifiedAttach = new Array();
    exitCode = enigEncryptAttachments(sendInfo.bucketList, gEnigModifiedAttach,
                            window, sendInfo.uiFlags, sendInfo.fromAddr, sendInfo.toAddr, sendInfo.bccAddr,
                            sendInfo.sendFlags, errorMsgObj);
    if (exitCode != 0) {
      gEnigModifiedAttach = null;
      if (errorMsgObj.value) {
        EnigAlert(EnigGetString("sendAborted")+errorMsgObj.value);
      }
      else {
        EnigAlert(EnigGetString("sendAborted")+"an internal error has occurred");
      }
      if (gEnigProcessed) {
        enigUndoEncryption();
      }
      else {
        enigRemoveAttachedKey();
      }
      return false;
    }
  }
  return true;
}

function enigGetMailPref(prefName) {

   var prefValue = null;
   try {
      var prefType = gEnigPrefRoot.getPrefType(prefName);
      // Get pref value
      switch (prefType) {
      case gPrefEnigmail.PREF_BOOL:
         prefValue = gEnigPrefRoot.getBoolPref(prefName);
         break;

      case gPrefEnigmail.PREF_INT:
         prefValue = gEnigPrefRoot.getIntPref(prefName);
         break;

      case gPrefEnigmail.PREF_STRING:
         prefValue = gEnigPrefRoot.getCharPref(prefName);
         break;

      default:
         prefValue = undefined;
         break;
     }

   } catch (ex) {
      // Failed to get pref value
      ERROR_LOG("enigmailMsgComposeOverlay.js: enigGetMailPref: unknown prefName:"+prefName+" \n");
   }

   return prefValue;
}

function enigMessageSendCheck() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigMessageSendCheck\n");

  try {
    var warn = enigGetMailPref("mail.warn_on_send_accel_key");

    if (warn) {
        var checkValue = {value:false};
        var bundle = document.getElementById("bundle_composeMsgs");
        var buttonPressed = gEnigPromptSvc.confirmEx(window,
              bundle.getString('sendMessageCheckWindowTitle'),
              bundle.getString('sendMessageCheckLabel'),
              (gEnigPromptSvc.BUTTON_TITLE_IS_STRING * gEnigPromptSvc.BUTTON_POS_0) +
              (gEnigPromptSvc.BUTTON_TITLE_CANCEL * gEnigPromptSvc.BUTTON_POS_1),
              bundle.getString('sendMessageCheckSendButtonLabel'),
              null, null,
              bundle.getString('CheckMsg'),
              checkValue);
        if (buttonPressed != 0) {
            return false;
        }
        if (checkValue.value) {
          var branch = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);

          branch.setBoolPref("mail.warn_on_send_accel_key", false);
        }
    }
  } catch (ex) {}

  return true;
}

function enigModifyCompFields(msgCompFields) {

  try {
    if (gEnigIdentity.getBoolAttribute("enablePgp")) {
      var enigmailHeaders = "";
      if (EnigGetPref("addHeaders")) {
        enigmailHeaders += "X-Enigmail-Version: "+EnigGetVersion()+"\r\n";
      }
      var pgpHeader="";
      var openPgpHeaderMode = gEnigIdentity.getIntAttribute("openPgpHeaderMode");

      if (openPgpHeaderMode > 0) pgpHeader = "OpenPGP: ";

      if (openPgpHeaderMode & ENIG_HEADERMODE_KEYID) {
          var keyId = gEnigIdentity.getCharAttribute("pgpkeyId");
          if (keyId.substr(0,2).toLowerCase() == "0x") {
            pgpHeader += "id="+keyId.substr(2);
          }
      }
      if (openPgpHeaderMode & ENIG_HEADERMODE_URL) {
        if (pgpHeader.indexOf("=") > 0) pgpHeader += ";\r\n\t";
        pgpHeader += "url="+gEnigIdentity.getCharAttribute("openPgpUrlName");
      }
      if (pgpHeader.length > 0) {
        enigmailHeaders += pgpHeader + "\r\n";
      }
      msgCompFields.otherRandomHeaders += enigmailHeaders;
    }
  }
  catch (ex) {
    EnigWriteException("enigmailMsgComposeOverlay.js: enigModifyCompFields", ex);
  }

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigModifyCompFields: otherRandomHeaders = "+
           msgCompFields.otherRandomHeaders+"\n");
}

function enigSendMessageListener(event) {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigSendMessageListener\n");
  try {
    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
    enigModifyCompFields(gMsgCompose.compFields);
    if (! enigEncryptMsg(Number(msgcomposeWindow.getAttribute("msgtype")))) {
      enigRemoveAttachedKey();
      event.preventDefault();
      event.stopPropagation();
    }
  }
  catch (ex) {}
}

// Replacement for buggy charset conversion detection of Thunderbird

function enigCheckCharsetConversion(msgCompFields) {

  try {
    var encoderFlags = EnigOutputFormatted | EnigOutputLFLineBreak;
    var docText = EnigEditorGetContentsAs("text/plain", encoderFlags);

    if (docText.length > 0) {
      var converter = Components.classes[ENIG_SAVEASCHARSET_CONTRACTID].createInstance(Components.interfaces.nsISaveAsCharset);

      converter.Init(msgCompFields.characterSet, 0, 1);

      return (converter.Convert(docText).length >= docText.length);
    }
  }
  catch (ex) {}

  return true;
}



// encrypt attachments when sending inline PGP mails
// It's quite a hack: the attachments are stored locally
// and the attachments list is modified to pick up the
// encrypted file(s) instead of the original ones.
function enigEncryptAttachments(bucketList, newAttachments, window, uiFlags,
                                fromAddr, toAddr, bccAddr, sendFlags,
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
      txtMessage = enigmailSvc.encryptAttachment(window, fromAddr, toAddr, bccAddr, sendFlags,
                                origFile.file, newFile,
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
    fileInfo.encrypted = (sendFlags & ENIG_ENCRYPT);

    newAttachments.push(fileInfo);
    node = node.nextSibling;
  }

  var i=0;
  if (sendFlags & ENIG_ENCRYPT) {
    // if we got here, all attachments were encrpted successfully,
    // so we replace their names & urls
    node = bucketList.firstChild;

    while (node) {
      node.attachment.url = newAttachments[i].newUrl;
      node.attachment.name += EnigGetPref("inlineAttachExt");
      node.attachment.contentType="application/octet-stream";
      node.attachment.temporary=true;

      ++i; node = node.nextSibling;
    }
  }
  else {
    // for inline signing we need to add new attachments for every
    // signed file
    for (i=0; i<newAttachments.length; i++) {
      // create new attachment
      var fileAttachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
      fileAttachment.temporary = true;
      fileAttachment.url = newAttachments[i].newUrl;
      fileAttachment.name = newAttachments[i].origName + EnigGetPref("inlineSigAttachExt");

      // add attachment to msg
      enigAddAttachment(fileAttachment);
    }

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

  var blockBegin = docText.indexOf("-----BEGIN PGP ");
  if (blockBegin < 0)
    return;

  // Determine indentation string
  var indentBegin = docText.substr(0, blockBegin).lastIndexOf("\n");
  var indentStr = docText.substring(indentBegin+1, blockBegin);

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
  var indentRegexp;

  if (indentStr) {
    // MULTILINE MATCHING ON
    RegExp.multiline = true;

    if (indentStr == "> ") {
      // replace ">> " with "> > " to allow correct quoting
      pgpBlock = pgpBlock.replace(/^>>/g, "> >");
    }

    // Delete indentation
    indentRegexp = new RegExp("^"+indentStr, "g");

    pgpBlock = pgpBlock.replace(indentRegexp, "");
    //tail     =     tail.replace(indentRegexp, "");

    if (indentStr.match(/[ \t]*$/)) {
      indentStr = indentStr.replace(/[ \t]*$/g, "");
      indentRegexp = new RegExp("^"+indentStr+"$", "g");

      pgpBlock = pgpBlock.replace(indentRegexp, "");
    }


    // Handle blank indented lines
    pgpBlock = pgpBlock.replace(/^[ \t]*>[ \t]*$/g, "");
    //tail     =     tail.replace(/^[ \t]*>[ \t]*$/g, "");

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
  var blockSeparationObj  = new Object();

  var uiFlags = nsIEnigmail.UI_UNVERIFIED_ENC_OK;

  var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                 signatureObj, exitCodeObj, statusFlagsObj,
                                 keyIdObj, userIdObj, sigDateObj,
                                 errorMsgObj, blockSeparationObj);

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

  if (blockType == "MESSAGE" && exitCode == 0 && plainText.length==0) {
    plainText = " ";
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

    if (signOffset < 0 && blockType == "SIGNED MESSAGE") {
      signOffset = plainText.search(/[\r\n]--[\r\n]/);
    }

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

  if (!indentStr || !quoteElement) replyOnTop = 1;

  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigDecryptQuote: replyOnTop="+replyOnTop+", quoteElement="+quoteElement+"\n");

  var nsISelectionController = Components.interfaces.nsISelectionController;

  if (gEnigEditor.selectionController) {
    var selection = gEnigEditor.selectionController;
    selection.completeMove(false, false); // go to start;

    switch (replyOnTop) {
    case 0:
      // Position after quote
      gEnigEditor.endOfDocument();
      if (tail) {
        for (cPos = 0; cPos < tail.length; cPos++) {
          selection.characterMove(false, false); // move backwards
        }
      }
      break;

    case 2:
      // Select quote

      if (head) {
        for (cPos = 0; cPos < head.length; cPos++) {
          selection.characterMove(true, false);
        }
      }
      selection.completeMove(true, true);
      if (tail) {
        for (cPos = 0; cPos < tail.length; cPos++) {
          selection.characterMove(false, true); // move backwards
        }
      }
      break;

    default:
      // Position at beginning of document

      if (gEnigEditor) {
        gEnigEditor.beginningOfDocument();
      }
    }

    gEnigEditor.selectionController.scrollSelectionIntoView(nsISelectionController.SELECTION_NORMAL,
                                   nsISelectionController.SELECTION_ANCHOR_REGION,
                                   true);
  }

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
  DEBUG_LOG("enigmailMsgComposeOverlay.js: EnigEditorInsertAsQuotation\n");
  if (gEnigEditor) {
    var mailEditor;
    try {
      mailEditor = gEnigEditor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
    } catch (ex) {}

    if (!mailEditor)
      return 0;

    DEBUG_LOG("enigmailMsgComposeOverlay.js: EnigEditorInsertAsQuotation: mailEditor="+mailEditor+"\n");

    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
    var vc = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);

    mailEditor.insertAsQuotation(plainText);

    return 1;
  }
  return 0;
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


var gEnigComposeStateListener = {
  NotifyComposeFieldsReady: function() {
    // Note: NotifyComposeFieldsReady is only called when a new window is created (i.e. not in case a window object is reused).
    DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.NotifyComposeFieldsReady\n");

    try {
      gEnigEditor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditor);
    } catch (ex) {}

    if (!gEnigEditor)
      return;

    var docStateListener = new EnigDocStateListener();
    gEnigEditor.addDocumentStateListener(docStateListener);
  },

  ComposeProcessDone: function(aResult) {
    // Note: called after a mail was sent (or saved)
    DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: "+aResult+"\n");

    if (aResult != Components.results.NS_OK) {
      if (gEnigProcessed) enigUndoEncryption();
      enigRemoveAttachedKey();
    }

  },

  NotifyComposeBodyReady: function() {
    //DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady\n");
  },

  SaveInFolderDone: function(folderURI) {
    //DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.SaveInFolderDone\n");
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
    // DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentCreated\n");
  },

  NotifyDocumentWillBeDestroyed: function ()
  {
    // DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.EnigDocStateListener.NotifyDocumentWillBeDestroyed\n");
  },

  NotifyDocumentStateChanged: function (nowDirty)
  {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentStateChanged: "+nowDirty+"\n");

    var isEmpty, isEditable;

    isEmpty    = gEnigEditor.documentIsEmpty;
    isEditable = gEnigEditor.isDocumentEditable;


    DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentStateChanged: isEmpty="+isEmpty+", isEditable="+isEditable+"\n");

    if (!isEditable || isEmpty)
      return;

    if (!gEnigTimeoutID && !gEnigDirty)
      gEnigTimeoutID = window.setTimeout(enigDecryptQuote, 10, false);
  }
}

function enigFocusChange() {
  // call original TB function
  CommandUpdate_MsgCompose();

  var focusedWindow = top.document.commandDispatcher.focusedWindow;

  // we're just setting focus to where it was before
  if (focusedWindow == gEnigLastFocusedWindow) {
    // skip
    return;
  }

  gEnigLastFocusedWindow = focusedWindow;

  enigFireSendFlags()
}

function enigFireSendFlags() {
  try {
    DEBUG_LOG("enigmailMsgComposeOverlay.js: enigFireSendFlags\n");
    if (! gEnigDetermineSendFlagID) {
      gEnigDetermineSendFlagID = window.setTimeout(enigDetermineSendFlags, 0);
    }
  }
  catch (ex) {}
}

var gEnigDummyValue = 0;

function enigDetermineSendFlags() {
  DEBUG_LOG("enigmailMsgComposeOverlay.js: enigFocusChange: enigDetermineSendFlags\n");
  if (enigGetAccDefault("enabled")) {
    var compFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
    Recipients2CompFields(compFields);
    var arrLen = new Object();
    var matchedKeysObj = new Object();
    var flagsObj = new Object();
    var toAddrList = new Array();
    var recList;
    if (compFields.to.length > 0) {
      recList = compFields.splitRecipients(compFields.to, true, arrLen)
      enigAddRecipients(toAddrList, recList);
    }

    if (compFields.cc.length > 0) {
      recList = compFields.splitRecipients(compFields.cc, true, arrLen)
      enigAddRecipients(toAddrList, recList);
    }

    if (compFields.bcc.length > 0) {
      recList = compFields.splitRecipients(compFields.bcc, true, arrLen)
      enigAddRecipients(toAddrList, recList);
    }

    if (toAddrList.length > 0) {
      if (getRecipientsKeys(toAddrList.join(", "), false, false, matchedKeysObj, flagsObj)) {
        document.getElementById("enigmail-rules-status").setAttribute("value",
          "sign: "+flagsObj.sign+" encrypt: "+flagsObj.encrypt);
      }
    }
    ++gEnigDummyValue;
    //document.getElementById("enigmail-rules-status").setAttribute("value", "changed: "+gEnigDummyValue);
  }
  gEnigDetermineSendFlagID = null;
}