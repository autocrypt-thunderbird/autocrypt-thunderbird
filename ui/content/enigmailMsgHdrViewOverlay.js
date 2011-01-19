/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@mozilla-enigmail.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://enigmail/enigmailCommon.jsm");

if (! Enigmail) var Enigmail = {};

Enigmail.hdrView = {

  hdrViewLoad: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.hdrViewLoad\n");

    // Override SMIME ui
    var signedHdrElement = document.getElementById("signedHdrIcon");
    if (signedHdrElement) {
      signedHdrElement.setAttribute("onclick", "enigViewSecurityInfo(event, true);");
    }

    var encryptedHdrElement = document.getElementById("encryptedHdrIcon");
    if (encryptedHdrElement) {
      encryptedHdrElement.setAttribute("onclick", "enigViewSecurityInfo(event, true);");
    }

    this.statusBar = document.getElementById("enigmail-status-bar");
    this.enigmailBox = document.getElementById("enigmailBox");

  },

  statusBarHide: function () {
    try {
      this.statusBar.removeAttribute("signed");
      this.statusBar.removeAttribute("encrypted");
      this.enigmailBox.setAttribute("collapsed", "true")
    }
    catch (ex) {}
  },

  startHeaders: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.startHeaders\n");

    Enigmail.hdrView.statusBar = document.getElementById("enigmail-status-bar");
    Enigmail.hdrView.enigmailBox = document.getElementById("enigmailBox");

    try {

      Enigmail.hdrView.statusBarHide();

      var statusText = document.getElementById("enigmailStatusText");
      if (statusText) statusText.value="";

      Enigmail.hdrView.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");

      var msgFrame = EnigGetFrame(window, "messagepane");

      if (msgFrame) {
        DEBUG_LOG("enigmailMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");

        msgFrame.addEventListener("unload", Enigmail.hdrView.messageUnload, true);
        msgFrame.addEventListener("load", enigMessageAutoDecrypt, false);
      }

      Enigmail.hdrView.forgetEncryptedMsgKey();

      if (messageHeaderSink) {
        try {
          messageHeaderSink.enigmailPrepSecurityInfo();
        }
        catch (ex) {}
      }
    }
    catch (ex) {}
  },


  endHeaders: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.endHeaders\n");
    try {
      Enigmail.hdrView.statusBarHide();
      var statusText = document.getElementById("enigmailStatusText");

      Enigmail.hdrView.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
    }
    catch (ex) {}
  },

  beforeStartHeaders: function () {
    return true;
  },

  // Match the userId from gpg to the sender's from address
  matchUidToSender: function (userId) {
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
  },


  updateHdrIcons: function (exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation) {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.updateHdrIcons: exitCode="+exitCode+", statusFlags="+statusFlags+", keyId="+keyId+", userId="+userId+", "+errorMsg+"\n");

    this.statusBar = document.getElementById("enigmail-status-bar");
    this.enigmailBox = document.getElementById("enigmailBox");


    if (gFolderDisplay.selectedMessageUris.length > 0) {
      gEnigLastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
    }
    var bodyElement = document.getElementById("messagepanebox");

    if (!errorMsg) errorMsg="";

    var replaceUid=null;
    if (userId && (userId.indexOf("\n")>=0)) {
      replaceUid = this.matchUidToSender(userId);
    }
    else {
      replaceUid = userId;
    }

    if (gEnigSavedHeaders && (gEnigSavedHeaders["x-pgp-encoding-format"].search(/partitioned/i)==0)) {
      if (currentAttachments && currentAttachments.length) {
        enigSetAttachmentReveal(currentAttachments);
      }
    }

    if (userId && replaceUid) {
      // no EnigConvertGpgToUnicode() here; strings are already UTF-8
      replaceUid = replaceUid.replace(/\\[xe]3a/gi, ":");
      errorMsg = errorMsg.replace(userId, replaceUid);
    }

    var errorLines="";
    var fullStatusInfo="";

    if (exitCode == ENIG_POSSIBLE_PGPMIME) {
      exitCode = 0;
    }
    else {
      if (errorMsg) {
      // no EnigConvertGpgToUnicode() here; strings are already UTF-8
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
        (this.statusBar.getAttribute("encrypted")=="ok")) {
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
      this.enigmailBox.removeAttribute("collapsed");
      this.displayExtendedStatus(true);
    } else {
      statusText.value = "";
      this.enigmailBox.setAttribute("collapsed", "true");
      this.displayExtendedStatus(false);
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
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
        this.statusBar.setAttribute("signed", "notok");
      }
      else if ((statusFlags & nsIEnigmail.GOOD_SIGNATURE) &&
          (statusFlags & nsIEnigmail.TRUSTED_IDENTITY) &&
          !(statusFlags & (nsIEnigmail.REVOKED_KEY |
                         nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                         nsIEnigmail.EXPIRED_SIGNATURE))) {
        // Display trusted good signature icon
        gSignedUINode.setAttribute("signed", "ok");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
        this.statusBar.setAttribute("signed", "ok");
        bodyElement.setAttribute("enigSigned", "ok");
      }
      else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        // Display unverified signature icon
        gSignedUINode.setAttribute("signed", "unknown");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
        this.statusBar.setAttribute("signed", "unknown");
      }
      else if (statusFlags & (nsIEnigmail.REVOKED_KEY |
                         nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                         nsIEnigmail.EXPIRED_SIGNATURE |
                         nsIEnigmail.GOOD_SIGNATURE)) {
        // Display unverified signature icon
        gSignedUINode.setAttribute("signed", "unknown");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureVerified");
        this.statusBar.setAttribute("signed", "unknown");
      }
      else if (statusFlags & nsIEnigmail.INLINE_KEY) {
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
      }
      else {
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelNoSignature");
      }

      if (statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
        var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
        if (enigMimeService)
        {
          enigMimeService.rememberEncrypted(gEnigLastEncryptedMsgKey);
        }

        // Display encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "ok");
        this.statusBar.setAttribute("encrypted", "ok");
      }
      else if (statusFlags &
        (nsIEnigmail.DECRYPTION_INCOMPLETE | nsIEnigmail.DECRYPTION_FAILED) ) {
        // Display un-encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "notok");
        this.statusBar.setAttribute("encrypted", "notok");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
      }
      this.updateMsgDb();

    } catch (ex) {}
  },

  dispSecurityContext: function () {

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

    this.setSenderStatus("signSenderKey", "editSenderKeyTrust" , "showPhoto", "dispKeyDetails");
  },


  updateSendersKeyMenu: function () {
    this.setSenderStatus("keyMgmtSignKey", "keyMgmtKeyTrust", "keyMgmtShowPhoto", "keyMgmtDispKeyDetails");
  },


  setSenderStatus: function (elemSign, elemTrust, elemPhoto, elemKeyProps) {
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

  },

  editKeyTrust: function () {
    EnigEditKeyTrust([gEnigSecurityInfo.userId], [gEnigSecurityInfo.keyId]);
    ReloadWithAllParts();
  },

  signKey: function () {
    EnigSignKey(gEnigSecurityInfo.userId, gEnigSecurityInfo.keyId, null)
    ReloadWithAllParts();
  },


  msgHdrViewLoad: function (event) {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewLoad\n");

    var listener = {};
    listener.onStartHeaders = Enigmail.hdrView.startHeaders;
    listener.onEndHeaders = Enigmail.hdrView.endHeaders;
    listener.beforeStartHeaders = Enigmail.hdrView.beforeStartHeaders;
    gMessageListeners.push(listener);
  },

  messageUnload: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.messageUnload\n");
  },

  hdrViewUnload: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.hdrViewUnLoad\n");
    this.forgetEncryptedMsgKey();
  },

  copyStatusInfo: function () {

    if (gEnigSecurityInfo) {
      var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);
      clipHelper.copyString(gEnigSecurityInfo.fullStatusInfo);
    }

  },

  showPhoto: function () {
    if (! gEnigSecurityInfo) return

    EnigShowPhoto(gEnigSecurityInfo.keyId, gEnigSecurityInfo.userId);
  },


  dispKeyDetails: function () {
    if (! gEnigSecurityInfo) return

    EnigDisplayKeyDetails(gEnigSecurityInfo.keyId, false);
  },

  createRuleFromAddress: function (emailAddressNode) {
    if (emailAddressNode)
    {
      if (typeof(findEmailNodeFromPopupNode)=="function") {
        emailAddressNode = findEmailNodeFromPopupNode(emailAddressNode, 'emailAddressPopup');
      }
      EnigNewRule(emailAddressNode.getAttribute("emailAddress"));
    }
  },

  forgetEncryptedMsgKey: function () {
    if (gEnigLastEncryptedMsgKey)
    {
      var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
      if (enigMimeService) {
        enigMimeService.forgetEncrypted(gEnigLastEncryptedMsgKey);
        gEnigLastEncryptedMsgKey = null;
      }
    }
  },

  msgHdrViewHide: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewHide\n");
    this.enigmailBox.setAttribute("collapsed", true);

    gEnigSecurityInfo = { statusFlags: 0,
                        keyId: "",
                        userId: "",
                        statusLine: "",
                        statusInfo: "",
                        fullStatusInfo: "" };

  },

  msgHdrViewUnide: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewUnide\n");

    if (gEnigSecurityInfo.statusFlags != 0) {
      this.enigmailBox.removeAttribute("collapsed");
    }
  },

  displayExtendedStatus: function (displayMe) {
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
  },

  toggleHeaderView: function () {
    var viewToggle = document.getElementById("enigToggleHeaderView2");
    var expandedText = document.getElementById("expandedEnigmailStatusText");
    var state = viewToggle.getAttribute("state");

    if (state=="true") {
      viewToggle.setAttribute("state", "false");
      viewToggle.setAttribute("class", "enigmailExpandViewButton");
      expandedText.setAttribute("display", "false");
      this.displayExtendedStatus(false);
    }
    else {
      viewToggle.setAttribute("state", "true");
      viewToggle.setAttribute("class", "enigmailCollapseViewButton");
      expandedText.setAttribute("display", "true");
      this.displayExtendedStatus(true);
    }
  },

  enigOnShowAttachmentContextMenu: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.enigOnShowAttachmentContextMenu\n");
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
  },

  updateMsgDb: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.updateMsgDb\n");
    var msg = gFolderDisplay.selectedMessage;
    var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
    if (this.statusBar.getAttribute("encrypted") == "ok")
      gEnigSecurityInfo.statusFlags |= nsIEnigmail.DECRYPTION_OKAY;
    msgHdr.setUint32Property("enigmail", gEnigSecurityInfo.statusFlags);
  },

  enigCanDetachAttachments: function () {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.enigCanDetachAttachments\n");
    var canDetach = true;
    if (gEnigSecurityInfo && (typeof(gEnigSecurityInfo.statusFlags) != "undefined")) {
      canDetach = ((gEnigSecurityInfo.statusFlags &
                   (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ? false : true);
    }
    return canDetach;
  },

  fillAttachmentListPopup: function (item) {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: Enigmail.hdrView.fillAttachmentListPopup\n");
    FillAttachmentListPopup(item);

    if (! this.enigCanDetachAttachments()) {
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
}

window.addEventListener("load", Enigmail.hdrView.hdrViewLoad, false);
addEventListener('messagepane-loaded', Enigmail.hdrView.msgHdrViewLoad, true);
addEventListener('messagepane-unloaded', Enigmail.hdrView.hdrViewUnload, true);
addEventListener('messagepane-hide', Enigmail.hdrView.msgHdrViewHide, true);
addEventListener('messagepane-unhide', Enigmail.hdrView.msgHdrViewUnide, true);

////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

function CanDetachAttachments()
{
  var canDetach = !gFolderDisplay.selectedMessageIsNews &&
                  (!gFolderDisplay.selectedMessageIsImap || MailOfflineMgr.isOnline());

  if (canDetach && ("content-type" in currentHeaderData))
  {
    var contentType = currentHeaderData["content-type"].headerValue;

    canDetach = !ContentTypeIsSMIME(currentHeaderData["content-type"].headerValue);
  }
  return canDetach && Enigmail.hdrView.enigCanDetachAttachments();
}

if (createNewAttachmentInfo.prototype.openAttachment) {
  createNewAttachmentInfo.prototype.origOpenAttachment = createNewAttachmentInfo.prototype.openAttachment;
  createNewAttachmentInfo.prototype.openAttachment = function () {
    this.origOpenAttachment();
  }
}

////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING EXTENDS CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

if (messageHeaderSink) {
  messageHeaderSink.enigmailPrepSecurityInfo = function ()
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigmailPrepSecurityInfo\n");


    /// BEGIN EnigMimeHeaderSink definition
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
          Enigmail.hdrView.updateHdrIcons(exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation);
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
    /// END EnigMimeHeaderSink definition

    var innerSMIMEHeaderSink = null;
    var enigmailHeaderSink = null;

    try {
      innerSMIMEHeaderSink = this.securityInfo.QueryInterface(Components.interfaces.nsIMsgSMIMEHeaderSink);

      try {
        enigmailHeaderSink = innerSMIMEHeaderSink.QueryInterface(Components.interfaces.nsIEnigMimeHeaderSink);
      } catch (ex) {}
    } catch (ex) {}

    if (!enigmailHeaderSink) {
      this.securityInfo = new EnigMimeHeaderSink(innerSMIMEHeaderSink);
    }
  }
}
