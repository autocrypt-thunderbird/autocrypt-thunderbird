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
// (already loaded by enigmailMessengerOverlay(!))

window.addEventListener("load", enigHdrViewLoad, false);
addEventListener('messagepane-unloaded', enigHdrViewUnload, true);

var gEnigStatusBar;
var gEnigmailBox;

function enigHdrViewLoad()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigHdrViewLoad\n");


  // Override SMIME ui
  var signedHdrElement = document.getElementById("signedHdrIcon");
  if (signedHdrElement) {
    signedHdrElement.setAttribute("onclick", "enigViewSecurityInfo(event, true);");
  }

  var encryptedHdrElement = document.getElementById("encryptedHdrIcon");
  if (encryptedHdrElement) {
    encryptedHdrElement.setAttribute("onclick", "enigViewSecurityInfo(event, true);");
  }

  gEnigStatusBar = document.getElementById("enigmail-status-bar");
  gEnigmailBox = document.getElementById("enigmailBox");

}

function enigStatusBarHide() {
  try {
    gEnigStatusBar.removeAttribute("signed");
    gEnigStatusBar.removeAttribute("encrypted");
    gEnigmailBox.setAttribute("collapsed", "true")
  }
  catch (ex) {}
}

function enigStartHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigStartHeaders\n");

  try {

    enigStatusBarHide();

    var statusText = document.getElementById("enigmailStatusText");
    if (statusText) statusText.value="";

    gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");

    var msgFrame = EnigGetFrame(window, "messagepane");

    if (msgFrame) {
      DEBUG_LOG("enigmailMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");

      msgFrame.addEventListener("unload", enigMessageUnload, true);
      msgFrame.addEventListener("load", enigMessageAutoDecrypt, false);
    }

    enigForgetEncryptedMsgKey();

    if (messageHeaderSink) {
      try {
        messageHeaderSink.enigPrepSecurityInfo();
      }
      catch (ex) {}
    }
  }
  catch (ex) {}
}


function enigEndHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigEndHeaders\n");
  try {
    enigStatusBarHide();
    var statusText = document.getElementById("enigmailStatusText");

    gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
  }
  catch (ex) {}
}

function enigBeforeStartHeaders() {
  return true;
}

// Match the userId from gpg to the sender's from address
function enigMatchUidToSender(userId) {
  var fromAddr = gFolderDisplay.selectedMessage.author;
  try {
    fromAddr=EnigStripEmail(fromAddr);
  }
  catch(ex) {}

  var userIdList=userId.split(/\n/);
  try {
    for (var i=0; i<userIdList.length; i++) {
      if (fromAddr.toLowerCase() == EnigStripEmail(userIdList[i]).toLowerCase()) {
        userId = userIdList[i];
        break;
      }
    }
    if (i>=userIdList.length) userId=userIdList[0];
  }
  catch (ex) {
    userId=userIdList[0];
  }
  return userId;
}

function enigUpdateHdrIcons(exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation) {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigUpdateHdrIcons: exitCode="+exitCode+", statusFlags="+statusFlags+", keyId="+keyId+", userId="+userId+", "+errorMsg+"\n");

  if (gFolderDisplay.selectedMessageUris.length > 0) {
    gEnigLastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
  }
  var bodyElement = document.getElementById("messagepanebox");

  if (!errorMsg) errorMsg="";

  var replaceUid=null;
  if (userId && (userId.indexOf("\n")>=0)) {
    replaceUid = enigMatchUidToSender(userId);
  }
  else {
    replaceUid = userId;
  }

  if (userId && replaceUid) {
    replaceUid = EnigConvertGpgToUnicode(replaceUid).replace(/\\[xe]3a/gi, ":");
    errorMsg = errorMsg.replace(userId, replaceUid);
  }

  var errorLines="";
  var fullStatusInfo="";

  if (exitCode == ENIG_POSSIBLE_PGPMIME) {
    exitCode = 0;
  }
  else {
    if (errorMsg) {
      // don't do EnigConvertGpgToUnicode() here, it might destroy UTF-8 message strings
      errorLines = errorMsg.split(/\r?\n/);
      fullStatusInfo=errorMsg;
    }
  }


  if (errorLines && (errorLines.length > 22) ) {
    // Retain only first twenty lines and last two lines of error message
    var lastLines = errorLines[errorLines.length-2] + "\n" +
                    errorLines[errorLines.length-1] + "\n";

    while (errorLines.length > 20)
      errorLines.pop();

    errorMsg = errorLines.join("\n") + "\n...\n" + lastLines;
  }

  var statusInfo = "";
  var statusLine = "";
  var statusArr = [];

  if (statusFlags & nsIEnigmail.NODATA) {
    if (statusFlags & nsIEnigmail.PGP_MIME_SIGNED)
      statusFlags |= nsIEnigmail.UNVERIFIED_SIGNATURE;

    if (statusFlags & nsIEnigmail.PGP_MIME_ENCRYPTED)
      statusFlags |= nsIEnigmail.DECRYPTION_INCOMPLETE;
  }

  if (! EnigGetPref("displayPartiallySigned")) {
    if ((statusFlags & (nsIEnigmail.PARTIALLY_PGP))
        && (statusFlags & (nsIEnigmail.BAD_SIGNATURE))) {
      statusFlags &= ~(nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.PARTIALLY_PGP);
      if (statusFlags == 0) {
        errorMsg="";
        fullStatusInfo="";
      }
    }
  }

  var msgSigned = (statusFlags & (nsIEnigmail.BAD_SIGNATURE |
            nsIEnigmail.GOOD_SIGNATURE |
            nsIEnigmail.EXPIRED_KEY_SIGNATURE |
            nsIEnigmail.EXPIRED_SIGNATURE |
            nsIEnigmail.UNVERIFIED_SIGNATURE |
            nsIEnigmail.REVOKED_KEY |
            nsIEnigmail.EXPIRED_KEY_SIGNATURE |
            nsIEnigmail.EXPIRED_SIGNATURE));
  var msgEncrypted = (statusFlags & (nsIEnigmail.DECRYPTION_OKAY |
            nsIEnigmail.DECRYPTION_INCOMPLETE |
            nsIEnigmail.DECRYPTION_FAILED));

  if (msgSigned && (statusFlags & nsIEnigmail.IMPORTED_KEY)) {
    statusFlags &= (~nsIEnigmail.IMPORTED_KEY);
  }

  if (((!(statusFlags & (nsIEnigmail.DECRYPTION_INCOMPLETE |
            nsIEnigmail.DECRYPTION_FAILED |
            nsIEnigmail.UNVERIFIED_SIGNATURE |
            nsIEnigmail.BAD_SIGNATURE))) ||
       (statusFlags & nsIEnigmail.DISPLAY_MESSAGE) &&
        !(statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
          !(statusFlags & nsIEnigmail.IMPORTED_KEY)) {
    // Normal exit / display message
    statusLine = errorMsg;
    statusInfo = statusLine;

    if (sigDetails) {
      var detailArr=sigDetails.split(/ /);

      dateTime = EnigGetDateTime(detailArr[2], true, true);
      var txt = EnigGetString("keyAndSigDate", keyId.substr(-8, 8), dateTime);
      statusArr.push(txt);
      statusInfo += "\n" + txt;
      var fpr = "";
      if (detailArr.length >= 10) {
        fpr = EnigFormatFpr(detailArr[9]);
      }
      else {
        EnigFormatFpr(detailArr[0]);
      }
      if (fpr) {
        statusInfo += "\n"+EnigGetString("keyFpr", fpr);
      }
    }
    fullStatusInfo = statusInfo;

  } else {
    if (keyId) {
      statusInfo = EnigGetString("keyNeeded",keyId);

      if (statusFlags & nsIEnigmail.INLINE_KEY) {
        statusLine = statusInfo + EnigGetString("clickDecrypt");
      } else {
        statusLine = statusInfo + EnigGetString("clickPen");
      }

      statusInfo = EnigGetString("unverifiedSig");
      statusLine = statusInfo + EnigGetString("clickPen");
      statusInfo += "\n\n" + errorMsg;

    } else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
      statusInfo = EnigGetString("unverifiedSig");
      statusLine = statusInfo + EnigGetString("clickQueryPenDetails");
      statusInfo += "\n\n" + errorMsg;

    } else if (statusFlags & (nsIEnigmail.BAD_SIGNATURE |
                              nsIEnigmail.UNVERIFIED_SIGNATURE |
                              nsIEnigmail.EXPIRED_SIGNATURE |
                              nsIEnigmail.EXPIRED_KEY_SIGNATURE)) {
      statusInfo = EnigGetString("failedSig");
      statusLine = statusInfo + EnigGetString("clickPenDetails");
      statusInfo += "\n\n" + errorMsg;

    } else if (statusFlags & nsIEnigmail.DECRYPTION_INCOMPLETE) {
      statusInfo = EnigGetString("incompleteDecrypt");
      statusLine = statusInfo + EnigGetString("clickKey");
      statusInfo += "\n\n" + errorMsg;

    } else if (statusFlags & nsIEnigmail.DECRYPTION_FAILED) {
      if (statusFlags & nsIEnigmail.NO_SECKEY) {
        statusInfo = EnigGetString("needKey");
      } else {
        statusInfo = EnigGetString("failedDecrypt");
      }

      statusLine = statusInfo + EnigGetString("clickKeyDetails");
      statusInfo += "\n\n" + errorMsg;

    } else if (statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
      statusInfo = EnigGetString("badPhrase");
      statusLine = statusInfo + EnigGetString("clickDecryptRetry");
      statusInfo += "\n\n" + errorMsg;

    } else if (statusFlags & nsIEnigmail.IMPORTED_KEY) {
      statusLine = "";
      statusInfo = "";
      EnigAlert(errorMsg);

    } else {
      statusInfo = EnigGetString("failedDecryptVerify");
      statusLine = statusInfo + EnigGetString("viewInfo");
      statusInfo += "\n\n" + errorMsg;
    }
  }

  if (statusFlags & nsIEnigmail.DECRYPTION_OKAY ||
      (gEnigStatusBar.getAttribute("encrypted")=="ok")) {
    if (!statusInfo) {
      statusInfo = EnigGetString("decryptedMsg");
    }
    else {
      statusInfo = EnigGetString("decryptedMsg")+"\n"+statusInfo;
    }
    if (!statusLine) {
      statusLine=statusInfo;
    }
    else {
      statusLine=EnigGetString("decryptedMsg")+"; "+statusLine;
    }
  }

  if (EnigGetPref("displayPartiallySigned")) {
    if (statusFlags & nsIEnigmail.PARTIALLY_PGP) {
      if (msgSigned && msgEncrypted) {
        statusLine = EnigGetString("msgPart", EnigGetString("msgSignedAndEnc"));
        statusLine += EnigGetString("clickPenKeyDetails");
      }
      else if (msgEncrypted) {
        statusLine = EnigGetString("msgPart", EnigGetString("msgEncrypted"));
        statusLine += EnigGetString("clickQueryKeyDetails");
      }
      else if (msgSigned) {
        statusLine = EnigGetString("msgPart", EnigGetString("msgSigned"));
        statusLine += EnigGetString("clickQueryPenDetails");
      }
    }
  }

  gEnigSecurityInfo = { statusFlags: statusFlags,
                        keyId: keyId,
                        userId: userId,
                        statusLine: statusLine,
                        msgSigned: msgSigned,
                        statusArr: statusArr,
                        statusInfo: statusInfo,
                        fullStatusInfo: fullStatusInfo,
                        blockSeparation: blockSeparation };

  var statusText  = document.getElementById("enigmailStatusText");
  var expStatusText  = document.getElementById("expandedEnigmailStatusText");
  var icon = document.getElementById("enigToggleHeaderView2");

  if (statusArr.length>0) {
    expStatusText.value = statusArr[0];
    expStatusText.setAttribute("state", "true");
    icon.removeAttribute("collapsed");
  }
  else {
    expStatusText.value = "";
    expStatusText.setAttribute("state", "false");
    icon.setAttribute("collapsed", "true");
  }

  if (statusLine) {
    statusText.value = statusLine +" ";
    gEnigmailBox.removeAttribute("collapsed");
    enigDisplayExtendedStatus(true);
  } else {
    statusText.value = "";
    gEnigmailBox.setAttribute("collapsed", "true");
    enigDisplayExtendedStatus(false);
  }

  if (!gSMIMEContainer)
    return;

  // Update icons and header-box css-class
  try {
    gSMIMEContainer.collapsed = false;
    gSignedUINode.collapsed = false;
    gEncryptedUINode.collapsed = false;

    if (statusFlags & nsIEnigmail.BAD_SIGNATURE) {
      // Display untrusted/bad signature icon
      gSignedUINode.setAttribute("signed", "notok");
      gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
      gEnigStatusBar.setAttribute("signed", "notok");
    }
    else if ((statusFlags & nsIEnigmail.GOOD_SIGNATURE) &&
        (statusFlags & nsIEnigmail.TRUSTED_IDENTITY) &&
        !(statusFlags & (nsIEnigmail.REVOKED_KEY |
                       nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                       nsIEnigmail.EXPIRED_SIGNATURE))) {
      // Display trusted good signature icon
      gSignedUINode.setAttribute("signed", "ok");
      gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
      gEnigStatusBar.setAttribute("signed", "ok");
      bodyElement.setAttribute("enigSigned", "ok");
    }
    else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
      // Display unverified signature icon
      gSignedUINode.setAttribute("signed", "unknown");
      gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
      gEnigStatusBar.setAttribute("signed", "unknown");
    }
    else if (statusFlags & (nsIEnigmail.REVOKED_KEY |
                       nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                       nsIEnigmail.EXPIRED_SIGNATURE |
                       nsIEnigmail.GOOD_SIGNATURE)) {
      // Display unverified signature icon
      gSignedUINode.setAttribute("signed", "unknown");
      gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureVerified");
      gEnigStatusBar.setAttribute("signed", "unknown");
    }
    else if (statusFlags & nsIEnigmail.INLINE_KEY) {
      gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
    }
    else {
      gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelNoSignature");
    }

    if (statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
      var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
      if (enigMimeService)
      {
        enigMimeService.rememberEncrypted(gEnigLastEncryptedMsgKey);
      }

      // Display encrypted icon
      gEncryptedUINode.setAttribute("encrypted", "ok");
      gEnigStatusBar.setAttribute("encrypted", "ok");
    }
    else if (statusFlags &
      (nsIEnigmail.DECRYPTION_INCOMPLETE | nsIEnigmail.DECRYPTION_FAILED) ) {
      // Display un-encrypted icon
      gEncryptedUINode.setAttribute("encrypted", "notok");
      gEnigStatusBar.setAttribute("encrypted", "notok");
      gEnigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
    }
    enigUpdateMsgDb();

  } catch (ex) {}
}

function enigDispSecurityContext() {

  if (gEnigSecurityInfo) {
    if (gEnigSecurityInfo.keyId &&
        (gEnigSecurityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) ) {
      document.getElementById("enigmail_importKey").removeAttribute("hidden");
    }
    else {
      document.getElementById("enigmail_importKey").setAttribute("hidden", "true");
    }

    if ( (gEnigSecurityInfo.statusFlags & nsIEnigmail.NODATA) &&
         (gEnigSecurityInfo.statusFlags &
           (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ) {
      document.getElementById("enigmail_reloadMessage").removeAttribute("hidden");
    }
    else {
      document.getElementById("enigmail_reloadMessage").setAttribute("hidden", "true");
    }
  }

  var optList = ["pgpSecurityInfo", "copySecurityInfo"];
  for (var j=0; j<optList.length; j++) {
    var menuElement = document.getElementById("enigmail_"+optList[j]);
    if (gEnigSecurityInfo) {
      menuElement.removeAttribute("disabled");
    }
    else {
      menuElement.setAttribute("disabled", "true");
    }
  }

  enigSetSenderStatus("signSenderKey", "editSenderKeyTrust" , "showPhoto", "dispKeyDetails");
}


function enigUpdateSendersKeyMenu() {
  enigSetSenderStatus("keyMgmtSignKey", "keyMgmtKeyTrust", "keyMgmtShowPhoto", "keyMgmtDispKeyDetails");
}


function enigSetSenderStatus(elemSign, elemTrust, elemPhoto, elemKeyProps) {
  var photo=false;
  var sign=false;
  var trust=false;
  if (gEnigSecurityInfo) {
    if (gEnigSecurityInfo.statusFlags & nsIEnigmail.PHOTO_AVAILABLE) {
      photo=true;
    }
    if (gEnigSecurityInfo.msgSigned ) {
      if (!(gEnigSecurityInfo.statusFlags &
           (nsIEnigmail.REVOKED_KEY | nsIEnigmail.EXPIRED_KEY_SIGNATURE | nsIEnigmail.UNVERIFIED_SIGNATURE))) {
        sign=true;
      }
      if (!(gEnigSecurityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) {
        trust=true;
      }
    }
  }

  if (elemTrust)
    document.getElementById("enigmail_"+elemTrust).setAttribute("disabled", !trust);
  if (elemSign)
    document.getElementById("enigmail_"+elemSign).setAttribute("disabled", !sign);
  if (elemPhoto)
    document.getElementById("enigmail_"+elemPhoto).setAttribute("disabled", !photo);
  if (elemKeyProps)
    document.getElementById("enigmail_"+elemKeyProps).setAttribute("disabled", !sign);

}

function enigEditKeyTrust() {
  EnigEditKeyTrust([gEnigSecurityInfo.userId], [gEnigSecurityInfo.keyId]);
  ReloadWithAllParts();
}

function enigSignKey() {
  EnigSignKey(gEnigSecurityInfo.userId, gEnigSecurityInfo.keyId, null)
  ReloadWithAllParts();
}


function enigMsgHdrViewLoad(event)
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewLoad\n");

  var listener = {};
  listener.onStartHeaders = enigStartHeaders;
  listener.onEndHeaders = enigEndHeaders;
  listener.beforeStartHeaders = enigBeforeStartHeaders;
  gMessageListeners.push(listener);
}

function enigMessageUnload() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMessageUnload\n");
}

function enigHdrViewUnload() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigHdrViewUnLoad\n");
  enigForgetEncryptedMsgKey();
}

function enigCopyStatusInfo() {

  if (gEnigSecurityInfo) {
    var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);
    clipHelper.copyString(gEnigSecurityInfo.fullStatusInfo);
  }

}

function enigShowPhoto() {
  if (! gEnigSecurityInfo) return

  EnigShowPhoto(gEnigSecurityInfo.keyId, gEnigSecurityInfo.userId);
}


function enigDispKeyDetails() {
  if (! gEnigSecurityInfo) return

  EnigDisplayKeyDetails(gEnigSecurityInfo.keyId, false);
}

function enigCreateRuleFromAddress(emailAddressNode) {
  if (emailAddressNode)
  {
    if (typeof(findEmailNodeFromPopupNode)=="function") {
      emailAddressNode = findEmailNodeFromPopupNode(emailAddressNode, 'emailAddressPopup');
    }
    EnigNewRule(emailAddressNode.getAttribute("emailAddress"));
  }
}

function enigForgetEncryptedMsgKey()
{
  if (gEnigLastEncryptedMsgKey)
  {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
    if (enigMimeService) {
      enigMimeService.forgetEncrypted(gEnigLastEncryptedMsgKey);
      gEnigLastEncryptedMsgKey = null;
    }
  }
}

function enigMsgHdrViewHide() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewHide\n");
  gEnigmailBox.setAttribute("collapsed", true);

  gEnigSecurityInfo = { statusFlags: 0,
                      keyId: "",
                      userId: "",
                      statusLine: "",
                      statusInfo: "",
                      fullStatusInfo: "" };

}

function enigMsgHdrViewUnhide() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewUnhide\n");
  if (gEnigSecurityInfo.statusFlags != 0) {
    gEnigmailBox.removeAttribute("collapsed");
  }
}

function enigDisplayExtendedStatus(displayMe) {
  var expStatusText  = document.getElementById("expandedEnigmailStatusText");
  if (displayMe && expStatusText.getAttribute("state") == "true") {
    if (expStatusText.getAttribute("display") == "true") {
      expStatusText.removeAttribute("collapsed");
    }
    else {
      expStatusText.setAttribute("collapsed", "true");
    }
  }
  else {
    expStatusText.setAttribute("collapsed", "true");
  }
}

function enigToggleHeaderView() {
  var viewToggle = document.getElementById("enigToggleHeaderView2");
  var expandedText = document.getElementById("expandedEnigmailStatusText");
  var state = viewToggle.getAttribute("state");

  if (state=="true") {
    viewToggle.setAttribute("state", "false");
    viewToggle.setAttribute("class", "enigmailExpandViewButton");
    expandedText.setAttribute("display", "false");
    enigDisplayExtendedStatus(false);
  }
  else {
    viewToggle.setAttribute("state", "true");
    viewToggle.setAttribute("class", "enigmailCollapseViewButton");
    expandedText.setAttribute("display", "true");
    enigDisplayExtendedStatus(true);
  }
}

function enigOnShowAttachmentContextMenu() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigOnShowAttachmentContextMenu\n");
  // first, call the original function ...
  onShowAttachmentContextMenu();

  // then, do our own additional stuff ...
  var attachmentList = document.getElementById('attachmentList');
  var selectedAttachments = attachmentList.selectedItems;
  var decryptOpenMenu = document.getElementById('enigmail_ctxDecryptOpen');
  var decryptSaveMenu = document.getElementById('enigmail_ctxDecryptSave');
  var importMenu = document.getElementById('enigmail_ctxImportKey');

  if (selectedAttachments.length > 0)
  {
    if (selectedAttachments[0].attachment.contentType.search(/^application\/pgp-keys/i) == 0) {
      importMenu.removeAttribute('disabled');
      decryptOpenMenu.setAttribute('disabled', true);
      decryptSaveMenu.setAttribute('disabled', true);
    }
    else if (enigCheckEncryptedAttach(selectedAttachments[0].attachment)) {
      importMenu.setAttribute('disabled', true);
      decryptOpenMenu.removeAttribute('disabled');
      decryptSaveMenu.removeAttribute('disabled');
      if (! selectedAttachments[0].attachment.displayName) {
        selectedAttachments[0].attachment.displayName="message.pgp"
      }
    }
    else {
      importMenu.setAttribute('disabled', true);
      decryptOpenMenu.setAttribute('disabled', true);
      decryptSaveMenu.setAttribute('disabled', true);
    }
  }
  else
  {
    openMenu.setAttribute('disabled', true);
    saveMenu.setAttribute('disabled', true);
    decryptOpenMenu.setAttribute('disabled', true);
    decryptSaveMenu.setAttribute('disabled', true);
    importMenu.setAttribute('disabled', true);
  }
}

function enigUpdateMsgDb() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigUpdateMsgDb\n");
  var msg = gFolderDisplay.selectedMessage;
  var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
  if (gEnigStatusBar.getAttribute("encrypted") == "ok")
    gEnigSecurityInfo.statusFlags |= nsIEnigmail.DECRYPTION_OKAY;
  msgHdr.setUint32Property("enigmail", gEnigSecurityInfo.statusFlags);
}

function enigCanDetachAttachments() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigCanDetachAttachments\n");
  var canDetach = true;
  if (gEnigSecurityInfo && (typeof(gEnigSecurityInfo.statusFlags) != "undefined")) {
    canDetach = ((gEnigSecurityInfo.statusFlags &
                 (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ? false : true);
  }
  return canDetach;
}

function enigFillAttachmentListPopup(item) {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigFillAttachmentListPopup\n");
  FillAttachmentListPopup(item);

  if (! enigCanDetachAttachments()) {
    for (var i=0; i< item.childNodes.length; i++) {
      if (item.childNodes[i].className == "menu-iconic") {
        var mnu = item.childNodes[i].firstChild.firstChild;
        while (mnu) {
          if (mnu.getAttribute("oncommand").search(/(detachAttachment|deleteAttachment)/) >=0) {
            mnu.setAttribute("disabled" , true);
          }
          mnu = mnu.nextSibling;
        }
      }
    }
  }
}

addEventListener('messagepane-loaded', enigMsgHdrViewLoad, true);
addEventListener('messagepane-hide', enigMsgHdrViewHide, true);
addEventListener('messagepane-unhide', enigMsgHdrViewUnhide, true);

// THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js

function CanDetachAttachments()
{
  var canDetach = !gFolderDisplay.selectedMessageIsNews &&
                  (!gFolderDisplay.selectedMessageIsImap || MailOfflineMgr.isOnline());

  if (canDetach && ("content-type" in currentHeaderData))
  {
    var contentType = currentHeaderData["content-type"].headerValue;

    canDetach = !ContentTypeIsSMIME(currentHeaderData["content-type"].headerValue);
  }
  return canDetach && enigCanDetachAttachments();
}

if (createNewAttachmentInfo.prototype.openAttachment) {
  createNewAttachmentInfo.prototype.origOpenAttachment = createNewAttachmentInfo.prototype.openAttachment;
  createNewAttachmentInfo.prototype.openAttachment = function () {
    this.origOpenAttachment();
  }
}

if (messageHeaderSink) {
  messageHeaderSink.enigPrepSecurityInfo = function ()
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigPrepSecurityInfo\n");
    var securityInfo = this.securityInfo;

    var innerSMIMEHeaderSink = null;
    var enigMimeHeaderSink = null;

    try {
      innerSMIMEHeaderSink = securityInfo.QueryInterface(Components.interfaces.nsIMsgSMIMEHeaderSink);

      try {
        enigMimeHeaderSink = innerSMIMEHeaderSink.QueryInterface(Components.interfaces.nsIEnigMimeHeaderSink);
      } catch (ex) {}
    } catch (ex) {}

    if (!enigMimeHeaderSink) {
      this.securityInfo = new EnigMimeHeaderSink(innerSMIMEHeaderSink);
    }
  }
}


function EnigMimeHeaderSink(innerSMIMEHeaderSink) {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.innerSMIMEHeaderSink="+innerSMIMEHeaderSink+"\n");
  this._smimeHeaderSink = innerSMIMEHeaderSink;
}

EnigMimeHeaderSink.prototype =
{
  _smimeHeaderSink: null,

  QueryInterface : function(iid)
  {
    //DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.QI: "+iid+"\n");
    if (iid.equals(Components.interfaces.nsIMsgSMIMEHeaderSink) &&
        this._smimeHeaderSink)
      return this;

    if (iid.equals(Components.interfaces.nsIEnigMimeHeaderSink) ||
        iid.equals(Components.interfaces.nsISupports) )
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  updateSecurityStatus: function(uriSpec, exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation)
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: uriSpec="+uriSpec+"\n");

    var msgUriSpec = enigGetCurrentMsgUriSpec();

    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: msgUriSpec="+msgUriSpec+"\n");

    if (!uriSpec || (uriSpec == msgUriSpec)) {
      enigUpdateHdrIcons(exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation);
    }

    return;
  },

  maxWantedNesting: function()
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.maxWantedNesting:\n");
    return this._smimeHeaderSink.maxWantedNesting();
  },

  signedStatus: function(aNestingLevel, aSignatureStatus, aSignerCert)
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.signedStatus:\n");
    return this._smimeHeaderSink.signedStatus(aNestingLevel, aSignatureStatus, aSignerCert);
  },

  encryptionStatus: function(aNestingLevel, aEncryptionStatus, aRecipientCert)
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.encryptionStatus:\n");
    return this._smimeHeaderSink.encryptionStatus(aNestingLevel, aEncryptionStatus, aRecipientCert);
  }

};

