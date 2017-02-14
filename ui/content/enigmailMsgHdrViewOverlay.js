/*global Components: false, EnigmailWindows: false, EnigmailLocale: false, EnigmailPrefs: false, EnigmailTime: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

/* globals from Thunderbird: */
/* global gFolderDisplay: false, currentAttachments: false, gSMIMEContainer: false, gSignedUINode: false, gEncryptedUINode: false */
/* global gDBView: false, msgWindow: false, messageHeaderSink: false: gMessageListeners: false, findEmailNodeFromPopupNode: true */
/* global gExpandedHeaderView: false, gMessageListeners: false, onShowAttachmentItemContextMenu: false, onShowAttachmentContextMenu: false */
/* global attachmentList: false, MailOfflineMgr: false, currentHeaderData: false, ContentTypeIsSMIME: false */

Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Components.utils.import("resource://enigmail/mimeVerify.jsm"); /*global EnigmailVerify: false */
Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Components.utils.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Components.utils.import("resource://enigmail/time.jsm"); /*global EnigmailTime: false */
Components.utils.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Components.utils.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/uris.jsm"); /*global EnigmailURIs: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/clipboard.jsm"); /*global EnigmailClipboard: false */
Components.utils.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Components.utils.import("resource://enigmail/stdlib.jsm"); /* global EnigmailStdlib: false */

if (!Enigmail) var Enigmail = {};

const EC = EnigmailCore;

Enigmail.hdrView = {

  statusBar: null,
  enigmailBox: null,
  lastEncryptedMsgKey: null,
  pEpStatus: null,


  hdrViewLoad: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.hdrViewLoad\n");

    // Override SMIME ui
    var signedHdrElement = document.getElementById("signedHdrIcon");
    if (signedHdrElement) {
      signedHdrElement.setAttribute("onclick", "Enigmail.msg.viewSecurityInfo(event, true);");
    }

    var encryptedHdrElement = document.getElementById("encryptedHdrIcon");
    if (encryptedHdrElement) {
      encryptedHdrElement.setAttribute("onclick", "Enigmail.msg.viewSecurityInfo(event, true);");
    }

    this.statusBar = document.getElementById("enigmail-status-bar");
    this.enigmailBox = document.getElementById("enigmailBox");
    this.pEpBox = document.getElementById("enigmail-pEp-bc");

    var addrPopup = document.getElementById("emailAddressPopup");
    if (addrPopup) {
      var attr = addrPopup.getAttribute("onpopupshowing");
      attr = "Enigmail.hdrView.displayAddressPopup(this); " + attr;
      addrPopup.setAttribute("onpopupshowing", attr);
    }
  },

  displayAddressPopup: function(target) {
    if (EnigmailPEPAdapter.usingPep()) {
      let adr = findEmailNodeFromPopupNode(document.popupNode, 'emailAddressPopup');
      if (adr) {
        Enigmail.hdrView.setPepVerifyFunction(adr);
      }
    }
    EnigmailFuncs.collapseAdvanced(target, 'hidden');
  },

  statusBarHide: function() {
    function resetPepColors(textNode) {
      let nodes = textNode.getElementsByTagName("mail-emailaddress");
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].setAttribute("class", "");
      }
    }

    try {
      this.statusBar.removeAttribute("signed");
      this.statusBar.removeAttribute("encrypted");
      this.enigmailBox.setAttribute("collapsed", "true");
      this.pEpBox.setAttribute("collapsed", "true");
      resetPepColors(gExpandedHeaderView.from.textNode);
      resetPepColors(gExpandedHeaderView.to.textNode);
      resetPepColors(gExpandedHeaderView.cc.textNode);
      resetPepColors(gExpandedHeaderView["reply-to"].textNode);
      Enigmail.msg.setAttachmentReveal(null);
      if (Enigmail.msg.securityInfo) {
        Enigmail.msg.securityInfo.statusFlags = 0;
        Enigmail.msg.securityInfo.msgSigned = 0;
        Enigmail.msg.securityInfo.msgEncrypted = 0;
      }

    }
    catch (ex) {}
  },

  // Match the userId from gpg to the sender's from address
  matchUidToSender: function(userId) {
    if (!gFolderDisplay.selectedMessage) {
      return userId;
    }

    var fromAddr = gFolderDisplay.selectedMessage.author;
    try {
      fromAddr = EnigmailFuncs.stripEmail(fromAddr);
    }
    catch (ex) {}

    var userIdList = userId.split(/\n/);
    try {
      let i;
      for (i = 0; i < userIdList.length; i++) {
        if (fromAddr.toLowerCase() == EnigmailFuncs.stripEmail(userIdList[i]).toLowerCase()) {
          userId = userIdList[i];
          break;
        }
      }
      if (i >= userIdList.length) userId = userIdList[0];
    }
    catch (ex) {
      userId = userIdList[0];
    }
    return userId;
  },


  setStatusText: function(txt) {
    let s = document.getElementById("enigmailStatusText");
    s.firstChild.data = txt;
  },

  updateHdrIcons: function(exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation, encToDetails, xtraStatus, encMimePartNumber) {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.updateHdrIcons: exitCode=" + exitCode + ", statusFlags=" + statusFlags + ", keyId=" + keyId + ", userId=" + userId + ", " + errorMsg +
      "\n");

    if (EnigmailPEPAdapter.usingPep()) return;

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    this.statusBar = document.getElementById("enigmail-status-bar");
    this.enigmailBox = document.getElementById("enigmailBox");

    if (gFolderDisplay.selectedMessageUris && gFolderDisplay.selectedMessageUris.length > 0) {
      this.lastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
    }

    if (!errorMsg) errorMsg = "";

    var replaceUid = null;
    if (userId && (userId.indexOf("\n") >= 0)) {
      replaceUid = this.matchUidToSender(userId);
    }
    else {
      replaceUid = userId;
    }

    if (Enigmail.msg.savedHeaders && (Enigmail.msg.savedHeaders["x-pgp-encoding-format"].search(/partitioned/i) === 0)) {
      if (currentAttachments && currentAttachments.length) {
        Enigmail.msg.setAttachmentReveal(currentAttachments);
      }
    }

    if (userId && replaceUid) {
      // no EnigConvertGpgToUnicode() here; strings are already UTF-8
      replaceUid = replaceUid.replace(/\\[xe]3a/gi, ":");
      errorMsg = errorMsg.replace(userId, replaceUid);
    }

    var errorLines = "";
    var fullStatusInfo = "";

    if (exitCode == EnigmailConstants.POSSIBLE_PGPMIME) {
      exitCode = 0;
    }
    else {
      if (errorMsg) {
        // no EnigConvertGpgToUnicode() here; strings are already UTF-8
        errorLines = errorMsg.split(/\r?\n/);
        fullStatusInfo = errorMsg;
      }
    }

    if (errorLines && (errorLines.length > 22)) {
      // Retain only first twenty lines and last two lines of error message
      var lastLines = errorLines[errorLines.length - 2] + "\n" +
        errorLines[errorLines.length - 1] + "\n";

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

    if (!(statusFlags & nsIEnigmail.PGP_MIME_ENCRYPTED)) {
      encMimePartNumber = "";
    }

    if (!EnigmailPrefs.getPref("displayPartiallySigned")) {
      if ((statusFlags & (nsIEnigmail.PARTIALLY_PGP)) &&
        (statusFlags & (nsIEnigmail.BAD_SIGNATURE))) {
        statusFlags &= ~(nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.PARTIALLY_PGP);
        if (statusFlags === 0) {
          errorMsg = "";
          fullStatusInfo = "";
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

    if (!(statusFlags & nsIEnigmail.DECRYPTION_FAILED) &&
      ((!(statusFlags & (nsIEnigmail.DECRYPTION_INCOMPLETE |
          nsIEnigmail.UNVERIFIED_SIGNATURE |
          nsIEnigmail.DECRYPTION_FAILED |
          nsIEnigmail.BAD_SIGNATURE))) ||
        (statusFlags & nsIEnigmail.DISPLAY_MESSAGE) &&
        !(statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
      !(statusFlags & nsIEnigmail.IMPORTED_KEY)) {
      // normal exit / display message
      statusLine = errorMsg;
      statusInfo = statusLine;

      if (sigDetails) {
        var detailArr = sigDetails.split(/ /);

        let dateTime = EnigmailTime.getDateTime(detailArr[2], true, true);
        var txt = EnigmailLocale.getString("keyAndSigDate", [keyId.substr(-8, 8), dateTime]);
        statusArr.push(txt);
        statusInfo += "\n" + txt;
        var fpr = "";
        if (detailArr.length >= 10) {
          fpr = EnigmailKey.formatFpr(detailArr[9]);
        }
        else {
          fpr = EnigmailKey.formatFpr(detailArr[0]);
        }
        if (fpr) {
          statusInfo += "\n" + EnigmailLocale.getString("keyFpr", [fpr]);
        }
        if (detailArr.length > 7) {
          var signingAlg = EnigmailGpg.signingAlgIdToString(detailArr[6]);
          var hashAlg = EnigmailGpg.hashAlgIdToString(detailArr[7]);

          statusInfo += "\n\n" + EnigmailLocale.getString("usedAlgorithms", [signingAlg, hashAlg]);
        }
      }
      fullStatusInfo = statusInfo;

    }
    else {
      // no normal exit / don't display message
      // - process failed decryptions first because they imply bad signature handling
      if (statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
        statusInfo = EnigmailLocale.getString("badPhrase");
        statusLine = statusInfo + EnigmailLocale.getString("clickDecryptRetry");
      }
      else if (statusFlags & nsIEnigmail.DECRYPTION_FAILED) {
        if (statusFlags & nsIEnigmail.MISSING_PASSPHRASE) {
          statusInfo = EnigmailLocale.getString("missingPassphrase");
          statusLine = statusInfo + EnigmailLocale.getString("clickDecryptRetry");
        }
        else if (statusFlags & nsIEnigmail.NO_SECKEY) {
          statusInfo = EnigmailLocale.getString("needKey");
        }
        else {
          statusInfo = EnigmailLocale.getString("failedDecrypt");
        }
        statusLine = statusInfo + EnigmailLocale.getString("clickDetailsButton");
      }
      else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        statusInfo = EnigmailLocale.getString("unverifiedSig");
        if (keyId) {
          statusLine = statusInfo + EnigmailLocale.getString("clickImportButton");
        }
        else {
          statusLine = statusInfo + EnigmailLocale.getString("keyTypeUnsupported");
        }
      }
      else if (statusFlags & (nsIEnigmail.BAD_SIGNATURE |
          nsIEnigmail.EXPIRED_SIGNATURE |
          nsIEnigmail.EXPIRED_KEY_SIGNATURE)) {
        statusInfo = EnigmailLocale.getString("unverifiedSig");
        statusLine = statusInfo + EnigmailLocale.getString("clickDetailsButton");
      }
      else if (statusFlags & nsIEnigmail.DECRYPTION_INCOMPLETE) {
        statusInfo = EnigmailLocale.getString("incompleteDecrypt");
        statusLine = statusInfo + EnigmailLocale.getString("clickDetailsButton");
      }
      else if (statusFlags & nsIEnigmail.IMPORTED_KEY) {
        statusLine = "";
        statusInfo = "";
        EnigmailDialog.alert(window, errorMsg);
      }
      else {
        statusInfo = EnigmailLocale.getString("failedDecryptVerify");
        statusLine = statusInfo + EnigmailLocale.getString("viewInfo");
      }
      // add key infos if available
      if (keyId) {
        var si = EnigmailLocale.getString("unverifiedSig"); // "Unverified signature"
        if (statusInfo === "") {
          statusInfo += si;
          statusLine = si + EnigmailLocale.getString("clickDetailsButton");
        }
        if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
          statusInfo += "\n" + EnigmailLocale.getString("keyNeeded", [keyId]); // "public key ... needed"
        }
        else {
          statusInfo += "\n" + EnigmailLocale.getString("keyUsed", [keyId]); // "public key ... used"
        }
      }
      statusInfo += "\n\n" + errorMsg;
    }

    if (statusFlags & nsIEnigmail.DECRYPTION_OKAY ||
      (this.statusBar.getAttribute("encrypted") == "ok")) {
      var statusMsg;
      if (xtraStatus && xtraStatus == "buggyMailFormat") {
        statusMsg = EnigmailLocale.getString("decryptedMsgWithFormatError");
      }
      else {
        statusMsg = EnigmailLocale.getString("decryptedMsg");

        // Check whenever this is a Wks confirmation request
        try {
          var msg = gFolderDisplay.selectedMessage;
          if (!(!msg || !msg.folder)) {
            var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
            EnigmailStdlib.msgHdrGetHeaders(msgHdr,function(k) {
              let phase = k.get("wks-phase");

              if (phase === "confirm") {
                let view = Enigmail.hdrView;

                view.setStatusText(EnigmailLocale.getString("wksConfirmationReq"));
                view.enigmailBox.removeAttribute("collapsed");
                document.getElementById("enigmail_confirmKey").removeAttribute("hidden");
                document.getElementById("enigmail_importKey").setAttribute("hidden", "true");
              }
            });
          }
        } catch(e) {
          EnigmailLog.DEBUG(e);
        }

      }
      if (!statusInfo) {
        statusInfo = statusMsg;
      }
      else {
        statusInfo = statusMsg + "\n" + statusInfo;
      }
      if (!statusLine) {
        statusLine = statusInfo;
      }
      else {
        statusLine = statusMsg + "; " + statusLine;
      }
    }

    if (EnigmailPrefs.getPref("displayPartiallySigned")) {
      if (statusFlags & nsIEnigmail.PARTIALLY_PGP) {
        if (msgSigned && msgEncrypted) {
          statusLine = EnigmailLocale.getString("msgPart", [EnigmailLocale.getString("msgSignedAndEnc")]);
          statusLine += EnigmailLocale.getString("clickDetailsButton");
          statusInfo = EnigmailLocale.getString("msgPart", [EnigmailLocale.getString("msgSigned")]) +
            "\n" + statusInfo;
        }
        else if (msgEncrypted) {
          statusLine = EnigmailLocale.getString("msgPart", [EnigmailLocale.getString("msgEncrypted")]);
          statusLine += EnigmailLocale.getString("clickDetailsButton");
          statusInfo = EnigmailLocale.getString("msgPart", [EnigmailLocale.getString("msgEncrypted")]) +
            "\n" + statusInfo;
        }
        else if (msgSigned) {
          if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
            statusLine = EnigmailLocale.getString("msgPart", [EnigmailLocale.getString("msgSignedUnkownKey")]);
            if (keyId) {
              statusLine += EnigmailLocale.getString("clickImportButton");
            }
            else {
              statusLine += EnigmailLocale.getString("keyTypeUnsupported");
            }
          }
          else {
            statusLine = EnigmailLocale.getString("msgPart", [EnigmailLocale.getString("msgSigned")]);
            statusLine += EnigmailLocale.getString("clickDetailsButton");
          }
          statusInfo = EnigmailLocale.getString("msgPart", [EnigmailLocale.getString("msgSigned")]) +
            "\n" + statusInfo;
        }
      }
    }

    // if we have parsed ENC_TO entries, add them as status info
    if (encToDetails && encToDetails.length > 0) {
      statusInfo += "\n\n" + EnigmailLocale.getString("encryptKeysNote", [encToDetails]);
    }

    if (!statusLine) {
      return;
    }

    Enigmail.msg.securityInfo = {
      statusFlags: statusFlags,
      keyId: keyId,
      userId: userId,
      statusLine: statusLine,
      msgSigned: msgSigned,
      statusArr: statusArr,
      statusInfo: statusInfo,
      fullStatusInfo: fullStatusInfo,
      blockSeparation: blockSeparation,
      xtraStatus: xtraStatus,
      encryptedMimePart: encMimePartNumber
    };

    Enigmail.msg.createArtificialAutocryptHeader();

    this.displayStatusBar();
    this.updateMsgDb();

  },

  displayStatusBar: function() {
    const nsIEnigmail = EnigmailConstants.nsIEnigmail;

    let statusText = document.getElementById("enigmailStatusText");
    let expStatusText = document.getElementById("expandedEnigmailStatusText");
    let icon = document.getElementById("enigToggleHeaderView2");
    let bodyElement = document.getElementById("messagepanebox");

    let secInfo = Enigmail.msg.securityInfo;
    let statusFlags = secInfo.statusFlags;

    if (secInfo.statusArr.length > 0) {
      expStatusText.value = secInfo.statusArr[0];
      expStatusText.setAttribute("state", "true");
      icon.removeAttribute("collapsed");
    }
    else {
      expStatusText.value = "";
      expStatusText.setAttribute("state", "false");
      icon.setAttribute("collapsed", "true");
    }

    if (secInfo.statusLine) {
      this.setStatusText(secInfo.statusLine + " ");
      this.enigmailBox.removeAttribute("collapsed");
      this.displayExtendedStatus(true);

      if ((secInfo.keyId && (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) ||
        (statusFlags & nsIEnigmail.INLINE_KEY)) {
        document.getElementById("enigmail_importKey").removeAttribute("hidden");
      }
      else {
        document.getElementById("enigmail_importKey").setAttribute("hidden", "true");
      }
      document.getElementById("enigmail_confirmKey").setAttribute("hidden", "true");

    }
    else {
      this.setStatusText("");
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

      if ((statusFlags & nsIEnigmail.BAD_SIGNATURE) &&
        !(statusFlags & nsIEnigmail.GOOD_SIGNATURE)) {
        // Display untrusted/bad signature icon
        gSignedUINode.setAttribute("signed", "unknown");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
        this.statusBar.setAttribute("signed", "unknown");
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
        EnigmailURIs.rememberEncryptedUri(this.lastEncryptedMsgKey);

        // Display encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "ok");
        this.statusBar.setAttribute("encrypted", "ok");
      }
      else if (statusFlags &
        (nsIEnigmail.DECRYPTION_INCOMPLETE | nsIEnigmail.DECRYPTION_FAILED)) {
        // Display un-encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "notok");
        this.statusBar.setAttribute("encrypted", "notok");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
      }

      // special handling after trying to fix buggy mail format (see buggyExchangeEmailContent in code)
      if (secInfo.xtraStatus && secInfo.xtraStatus == "buggyMailFormat") {
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelBuggyMailFormat");
      }

    }
    catch (ex) {
      EnigmailLog.writeException("displayStatusBar", ex);
    }
  },

  dispSecurityContext: function() {

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    try {
      if (Enigmail.msg.securityInfo) {
        if ((Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.NODATA) &&
          (Enigmail.msg.securityInfo.statusFlags &
            (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED))) {
          document.getElementById("enigmail_reloadMessage").removeAttribute("hidden");
        }
        else {
          document.getElementById("enigmail_reloadMessage").setAttribute("hidden", "true");
        }
      }

      var optList = ["pgpSecurityInfo", "copySecurityInfo"];
      for (var j = 0; j < optList.length; j++) {
        var menuElement = document.getElementById("enigmail_" + optList[j]);
        if (Enigmail.msg.securityInfo) {
          menuElement.removeAttribute("disabled");
        }
        else {
          menuElement.setAttribute("disabled", "true");
        }
      }

      this.setSenderStatus("signSenderKey", "editSenderKeyTrust", "showPhoto", "dispKeyDetails");
    }
    catch (ex) {
      EnigmailLog.ERROR("error on displaying Security menu:\n" + ex.toString() + "\n");
    }
  },


  updateSendersKeyMenu: function() {
    this.setSenderStatus("keyMgmtSignKey",
      "keyMgmtKeyTrust",
      "keyMgmtShowPhoto",
      "keyMgmtDispKeyDetails",
      "importpublickey");
  },

  setSenderStatus: function(elemSign, elemTrust, elemPhoto, elemKeyProps, elemImportKey) {

    function setElemStatus(elemName, disabledValue) {
      document.getElementById("enigmail_" + elemName).setAttribute("disabled", !disabledValue);

      let secondElem = document.getElementById("enigmail_" + elemName + "2");
      if (secondElem) secondElem.setAttribute("disabled", !disabledValue);
    }

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var photo = false;
    var sign = false;
    var trust = false;
    var unknown = false;
    var signedMsg = false;

    if (Enigmail.msg.securityInfo) {
      if (Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.PHOTO_AVAILABLE) {
        photo = true;
      }
      if (Enigmail.msg.securityInfo.msgSigned) {
        signedMsg = true;
        if (!(Enigmail.msg.securityInfo.statusFlags &
            (nsIEnigmail.REVOKED_KEY | nsIEnigmail.EXPIRED_KEY_SIGNATURE | nsIEnigmail.UNVERIFIED_SIGNATURE))) {
          sign = true;
        }
        if (!(Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) {
          trust = true;
        }

        if (Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
          unknown = true;
        }
      }
    }

    if (elemTrust) setElemStatus(elemTrust, trust);
    if (elemSign) setElemStatus(elemSign, sign);
    if (elemPhoto) setElemStatus(elemPhoto, photo);
    if (elemKeyProps) setElemStatus(elemKeyProps, (signedMsg && !unknown));
    if (elemImportKey) setElemStatus(elemImportKey, unknown);
  },

  editKeyExpiry: function() {
    EnigmailWindows.editKeyExpiry(window, [Enigmail.msg.securityInfo.userId], [Enigmail.msg.securityInfo.keyId]);
    gDBView.reloadMessageWithAllParts();
  },

  editKeyTrust: function() {
    let enigmailSvc = EnigmailCore.getService();
    let key = EnigmailKeyRing.getKeyById(Enigmail.msg.securityInfo.keyId);

    EnigmailWindows.editKeyTrust(window, [Enigmail.msg.securityInfo.userId], [key.keyId]);
    gDBView.reloadMessageWithAllParts();
  },

  signKey: function() {
    let enigmailSvc = EnigmailCore.getService();
    let key = EnigmailKeyRing.getKeyById(Enigmail.msg.securityInfo.keyId);

    EnigmailWindows.signKey(window, Enigmail.msg.securityInfo.userId, key.keyId, null);
    gDBView.reloadMessageWithAllParts();
  },


  msgHdrViewLoad: function(event) {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewLoad\n");

    var listener = {
      enigmailBox: document.getElementById("enigmailBox"),
      onStartHeaders: function _listener_onStartHeaders() {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onStartHeaders\n");

        try {

          Enigmail.hdrView.statusBarHide();

          EnigmailVerify.setMsgWindow(msgWindow, Enigmail.msg.getCurrentMsgUriSpec());

          Enigmail.hdrView.setStatusText("");

          this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");

          var msgFrame = EnigmailWindows.getFrame(window, "messagepane");

          if (msgFrame) {
            EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: msgFrame=" + msgFrame + "\n");

            msgFrame.addEventListener("unload", Enigmail.hdrView.messageUnload.bind(Enigmail.hdrView), true);
            msgFrame.addEventListener("load", function _f() {
              Enigmail.hdrView.enablePepMenus();
              Enigmail.msg.messageAutoDecrypt();
              Enigmail.msg.handleAttchmentEvent();
            }, false);
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

      onEndHeaders: function _listener_onEndHeaders() {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onEndHeaders\n");

        try {
          Enigmail.hdrView.statusBarHide();

          this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
        }
        catch (ex) {}
      },

      beforeStartHeaders: function _listener_beforeStartHeaders() {
        return true;
      }
    };

    gMessageListeners.push(listener);
  },

  messageUnload: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.messageUnload\n");
  },

  hdrViewUnload: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.hdrViewUnLoad\n");
    this.forgetEncryptedMsgKey();
  },

  copyStatusInfo: function() {
    if (Enigmail.msg.securityInfo) {
      EnigmailClipboard.setClipboardContent(Enigmail.msg.securityInfo.statusInfo);
    }

  },

  showPhoto: function() {
    if (!Enigmail.msg.securityInfo) return;

    let enigmailSvc = EnigmailCore.getService();
    let key = EnigmailKeyRing.getKeyById(Enigmail.msg.securityInfo.keyId);

    EnigmailWindows.showPhoto(window, key.keyId, Enigmail.msg.securityInfo.userId);
  },


  dispKeyDetails: function() {
    if (!Enigmail.msg.securityInfo) return;

    let enigmailSvc = EnigmailCore.getService();
    let key = EnigmailKeyRing.getKeyById(Enigmail.msg.securityInfo.keyId);

    EnigmailWindows.openKeyDetails(window, key.keyId, false);
  },

  createRuleFromAddress: function(emailAddressNode) {
    if (emailAddressNode) {
      if (typeof(findEmailNodeFromPopupNode) == "function") {
        emailAddressNode = findEmailNodeFromPopupNode(emailAddressNode, 'emailAddressPopup');
      }
      EnigmailWindows.createNewRule(window, emailAddressNode.getAttribute("emailAddress"));
    }
  },

  forgetEncryptedMsgKey: function() {
    if (Enigmail.hdrView.lastEncryptedMsgKey) {
      EnigmailURIs.forgetEncryptedUri(Enigmail.hdrView.lastEncryptedMsgKey);
      Enigmail.hdrView.lastEncryptedMsgKey = null;
    }
  },

  msgHdrViewHide: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewHide\n");
    this.enigmailBox.setAttribute("collapsed", true);

    Enigmail.msg.securityInfo = {
      statusFlags: 0,
      keyId: "",
      userId: "",
      statusLine: "",
      statusInfo: "",
      fullStatusInfo: "",
      encryptedMimePart: ""
    };

  },

  msgHdrViewUnhide: function(event) {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewUnhide:\n");

    if (Enigmail.msg.securityInfo && Enigmail.msg.securityInfo.statusFlags !== 0) {
      this.enigmailBox.removeAttribute("collapsed");
    }
  },

  displayExtendedStatus: function(displayOn) {
    var expStatusText = document.getElementById("expandedEnigmailStatusText");
    if (displayOn && expStatusText.getAttribute("state") == "true") {
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

  toggleHeaderView: function() {
    var viewToggle = document.getElementById("enigToggleHeaderView2");
    var expandedText = document.getElementById("expandedEnigmailStatusText");
    var state = viewToggle.getAttribute("state");

    if (state == "true") {
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

  enigOnShowAttachmentContextMenu: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.enigOnShowAttachmentContextMenu\n");
    // first, call the original function ...

    try {
      // Thunderbird
      onShowAttachmentItemContextMenu();
    }
    catch (ex) {
      // SeaMonkey
      onShowAttachmentContextMenu();
    }

    // then, do our own additional stuff ...

    // Thunderbird
    var contextMenu = document.getElementById('attachmentItemContext');
    var selectedAttachments = contextMenu.attachments;

    if (!contextMenu) {
      // SeaMonkey
      contextMenu = document.getElementById('attachmentListContext');
      selectedAttachments = attachmentList.selectedItems;
    }

    var decryptOpenMenu = document.getElementById('enigmail_ctxDecryptOpen');
    var decryptSaveMenu = document.getElementById('enigmail_ctxDecryptSave');
    var importMenu = document.getElementById('enigmail_ctxImportKey');
    var verifyMenu = document.getElementById('enigmail_ctxVerifyAtt');

    if (selectedAttachments.length > 0) {
      if (selectedAttachments[0].contentType.search(/^application\/pgp-keys/i) === 0) {
        importMenu.removeAttribute('disabled');
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.setAttribute('disabled', true);
      }
      else if (Enigmail.msg.checkSignedAttachment(selectedAttachments[0], null)) {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.removeAttribute('disabled');
      }
      else if (Enigmail.msg.checkEncryptedAttach(selectedAttachments[0])) {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.removeAttribute('disabled');
        decryptSaveMenu.removeAttribute('disabled');
        verifyMenu.setAttribute('disabled', true);
        if (typeof(selectedAttachments[0].displayName) == "undefined") {
          if (!selectedAttachments[0].name) {
            selectedAttachments[0].name = "message.pgp";
          }
        }
        else
        if (!selectedAttachments[0].displayName) {
          selectedAttachments[0].displayName = "message.pgp";
        }
      }
      else {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.setAttribute('disabled', true);
      }
    }
    else {
      openMenu.setAttribute('disabled', true); /* global openMenu: false */
      saveMenu.setAttribute('disabled', true); /* global saveMenu: false */
      decryptOpenMenu.setAttribute('disabled', true);
      decryptSaveMenu.setAttribute('disabled', true);
      importMenu.setAttribute('disabled', true);
      verifyMenu.setAttribute('disabled', true);
    }
  },

  updateMsgDb: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.updateMsgDb\n");
    var msg = gFolderDisplay.selectedMessage;
    if (!msg || !msg.folder) return;

    var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);

    if (EnigmailPEPAdapter.usingPep()) {
      let pepColor = 0;
      switch (this.pEpStatus.messageColor) {
        case "red":
          pepColor = 1;
          break;
        case "yellow":
          pepColor = 2;
          break;
        case "green":
          pepColor = 3;
          break;
      }
      msgHdr.setUint32Property("enigmailPep", pepColor);
    }
    else {
      if (this.statusBar.getAttribute("encrypted") == "ok")
        Enigmail.msg.securityInfo.statusFlags |= Components.interfaces.nsIEnigmail.DECRYPTION_OKAY;
      msgHdr.setUint32Property("enigmail", Enigmail.msg.securityInfo.statusFlags);
    }
  },

  enigCanDetachAttachments: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.enigCanDetachAttachments\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var canDetach = true;
    if (Enigmail.msg.securityInfo && (typeof(Enigmail.msg.securityInfo.statusFlags) != "undefined")) {
      canDetach = ((Enigmail.msg.securityInfo.statusFlags &
        (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ? false : true);
    }
    return canDetach;
  },

  fillAttachmentListPopup: function(item) {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: Enigmail.hdrView.fillAttachmentListPopup\n");
    FillAttachmentListPopup(item); /* global FillAttachmentListPopup: false */

    if (!this.enigCanDetachAttachments()) {
      for (var i = 0; i < item.childNodes.length; i++) {
        if (item.childNodes[i].className == "menu-iconic") {
          var mnu = item.childNodes[i].firstChild.firstChild;
          while (mnu) {
            if (mnu.getAttribute("oncommand").search(/(detachAttachment|deleteAttachment)/) >= 0) {
              mnu.setAttribute("disabled", true);
            }
            mnu = mnu.nextSibling;
          }
        }
      }
    }
  },

  setSubject: function(subject) {
    if (gFolderDisplay.selectedMessages.length === 1 && gFolderDisplay.selectedMessage) {
      gFolderDisplay.selectedMessage.subject = EnigmailData.convertFromUnicode(subject, "utf-8");
      this.updateHdrBox("subject", subject);
    }
  },

  updateHdrBox: function(header, value) {
    let e = document.getElementById("expanded" + header + "Box");
    if (e) {
      e.headerValue = value;
    }
  },

  displayPepStatus: function(rating, keyIDs, uri, persons) {

    if (typeof(keyIDs) === "string") {
      keyIDs = keyIDs.split(/,/);
    }

    this.pEpStatus = {
      rating: rating,
      messageColor: "grey",
      emailRatings: [],
      keyIDs: keyIDs
    };

    this.displayPepMessageRating(rating);
    this.displayPepIdentities(persons);
  },

  displayPepMessageRating: function(rating) {
    /*
    rating:
    undefined = 0,
    cannot_decrypt = 1,
    have_no_key = 2,
    unencrypted = 3,
    unencrypted_for_some = 4,
    unreliable = 5,
    reliable = 6,
    trusted = 7,
    trusted_and_anonymized = 8,
    fully_anonymous = 9,
    mistrust = -1,
    b0rken = -2,
    under_attack = -3
    */

    this.pEpBox.removeAttribute("collapsed");

    if (rating === -2 || rating === 2) {
      this.pEpStatus.messageColor = "grey";
      this.pEpBox.setAttribute("class", "enigmailPepRatingUnknown");
    }
    else if (rating < 0) {
      this.pEpStatus.messageColor = "red";
      this.pEpBox.setAttribute("class", "enigmailPepRatingMistrust");
    }
    else if (rating < 6) {
      this.pEpStatus.messageColor = "grey";
      this.pEpBox.setAttribute("class", "enigmailPepRatingUnknown");
    }
    else if (rating >= 7) {
      this.pEpStatus.messageColor = "green";
      this.pEpBox.setAttribute("class", "enigmailPepRatingTrusted");
    }
    else {
      this.pEpStatus.messageColor = "yellow";
      this.pEpBox.setAttribute("class", "enigmailPepRatingReliable");
    }

    this.updateMsgDb();
  },

  displayPepEmailRating: function(textNode, person) {
    let nodes = textNode.getElementsByTagName("mail-emailaddress");
    let emailAddress = person.address.toLowerCase();

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute("hidden") !== "true" && nodes[i].getAttribute("emailAddress").toLowerCase() === emailAddress) {
        EnigmailPEPAdapter.pep.getIdentityRating(person).
        then(
          function _gotRating(cbObj) {
            if ("result" in cbObj && Array.isArray(cbObj.result) && typeof(cbObj.result[0]) === "object") {
              if ("color" in cbObj.result[0]) {
                let color = EnigmailPEPAdapter.calculateColorFromRating(cbObj.result[0].color);
                let setClass = EnigmailPEPAdapter.getRatingClass(cbObj.result[0].color);

                nodes[i].setAttribute("class", setClass);
                Enigmail.hdrView.pEpStatus.emailRatings[emailAddress] = color;
              }
            }
          }).
        catch(function _err() {});
      }
    }
  },

  displayPepIdentities: function(persons) {

    if ("from" in persons && persons.from) {
      this.displayPepEmailRating(gExpandedHeaderView.from.textNode, persons.from);
    }

    if ("to" in persons && persons.to) {
      for (let p of persons.to) {
        this.displayPepEmailRating(gExpandedHeaderView.to.textNode, p);
      }
    }

    if ("cc" in persons && persons.cc) {
      for (let p of persons.cc) {
        this.displayPepEmailRating(gExpandedHeaderView.cc.textNode, p);
      }
    }

    if ("reply_to" in persons && persons.reply_to) {
      for (let p of persons.reply_to) {
        this.displayPepEmailRating(gExpandedHeaderView["reply-to"].textNode, p);
      }
    }

  },

  pEpIconPopup: function() {
    let rating = this.pEpStatus.rating;
    if (rating > 7) rating = 7;

    let descProp = "pepStatusInfo.info." + (rating < 0 ? "m" : "r") + rating;
    let infoText = EnigmailLocale.getString("pepStatusInfo.text") + "\n\n" +
      EnigmailLocale.getString(descProp);
    EnigmailDialog.alert(window, infoText);
  },

  enablePepMenus: function() {
    if (EnigmailPEPAdapter.usingPep()) {
      document.getElementById("enigmailCreateRuleFromAddr").setAttribute("collapsed", "true");
    }
    else {
      document.getElementById("enigmailCreateRuleFromAddr").removeAttribute("collapsed");
      document.getElementById("enigmailVerifyPepStatus").setAttribute("collapsed", "true");
      document.getElementById("enigmailRevokePepStatus").setAttribute("collapsed", "true");
    }
  },

  setPepVerifyFunction: function(addressNode) {
    let emailAddress = addressNode.getAttribute("emailAddress").toLowerCase();
    if (Enigmail.hdrView.pEpStatus.emailRatings[emailAddress]) {
      let idColor = Enigmail.hdrView.pEpStatus.emailRatings[emailAddress];
      if (idColor === "green") {
        document.getElementById("enigmailRevokePepStatus").removeAttribute("collapsed");
        document.getElementById("enigmailVerifyPepStatus").setAttribute("collapsed", "true");
      }
      else {
        document.getElementById("enigmailVerifyPepStatus").removeAttribute("collapsed");
        document.getElementById("enigmailRevokePepStatus").setAttribute("collapsed", "true");
      }
    }
    else {
      document.getElementById("enigmailVerifyPepStatus").setAttribute("collapsed", "true");
      document.getElementById("enigmailRevokePepStatus").setAttribute("collapsed", "true");
    }
  },

  verifyPepTrustWords: function(emailAddressNode) {
    if (emailAddressNode) {
      if (typeof(findEmailNodeFromPopupNode) == "function") {
        emailAddressNode = findEmailNodeFromPopupNode(emailAddressNode, 'emailAddressPopup');
      }
      let emailAddr = emailAddressNode.getAttribute("emailAddress");

      EnigmailWindows.verifyPepTrustWords(window, emailAddr, currentHeaderData).
      then(function _done() {
        gDBView.reloadMessageWithAllParts();
      }).
      catch(function _err() {});
    }
  },

  revokePepTrust: function(emailAddressNode) {
    if (emailAddressNode) {
      if (typeof(findEmailNodeFromPopupNode) == "function") {
        emailAddressNode = findEmailNodeFromPopupNode(emailAddressNode, 'emailAddressPopup');
      }
      let emailAddr = emailAddressNode.getAttribute("emailAddress");

      if (EnigmailDialog.confirmDlg(window,
          EnigmailLocale.getString("pepRevokeTrust.question", emailAddr),
          EnigmailLocale.getString("pepRevokeTrust.doRevoke"),
          EnigmailLocale.getString("dlg.button.close"))) {
        EnigmailPEPAdapter.resetTrustForEmail(emailAddr).
        then(function _done() {
          gDBView.reloadMessageWithAllParts();
        }).
        catch(function _err() {});
      }
    }
  }

};

window.addEventListener("load", Enigmail.hdrView.hdrViewLoad.bind(Enigmail.hdrView), false);
addEventListener('messagepane-loaded', Enigmail.hdrView.msgHdrViewLoad.bind(Enigmail.hdrView), true);
addEventListener('messagepane-unloaded', Enigmail.hdrView.hdrViewUnload.bind(Enigmail.hdrView), true);
addEventListener('messagepane-hide', Enigmail.hdrView.msgHdrViewHide.bind(Enigmail.hdrView), true);
addEventListener('messagepane-unhide', Enigmail.hdrView.msgHdrViewUnhide.bind(Enigmail.hdrView), true);

////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

// there is unfortunately no other way to add Enigmail to the validator than this

function CanDetachAttachments() {
  var canDetach = !gFolderDisplay.selectedMessageIsNews &&
    (!gFolderDisplay.selectedMessageIsImap || MailOfflineMgr.isOnline());

  if (canDetach && ("content-type" in currentHeaderData)) {
    var contentType = currentHeaderData["content-type"].headerValue;

    canDetach = !ContentTypeIsSMIME(currentHeaderData["content-type"].headerValue);
  }
  return canDetach && Enigmail.hdrView.enigCanDetachAttachments();
}


////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING EXTENDS CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

if (messageHeaderSink) {
  messageHeaderSink.enigmailPrepSecurityInfo = function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: enigmailPrepSecurityInfo\n");


    /// BEGIN EnigMimeHeaderSink definition
    function EnigMimeHeaderSink(innerSMIMEHeaderSink) {
      EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.innerSMIMEHeaderSink=" + innerSMIMEHeaderSink + "\n");
      this._smimeHeaderSink = innerSMIMEHeaderSink;
    }

    EnigMimeHeaderSink.prototype = {
      _smimeHeaderSink: null,

      QueryInterface: function(iid) {
        //EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.QI: "+iid+"\n");
        if (iid.equals(Components.interfaces.nsIMsgSMIMEHeaderSink) &&
          this._smimeHeaderSink)
          return this;

        if (iid.equals(Components.interfaces.nsIEnigMimeHeaderSink) ||
          iid.equals(Components.interfaces.nsISupports))
          return this;

        throw Components.results.NS_NOINTERFACE;
      },

      /**
       * Determine message number and folder from mailnews URI
       *
       * @param url - nsIURI object
       *
       * @return Object:
       *    - msgNum: String - the message number, or "" if no URI Scheme fits
       *    - folder: String - the folder (or newsgroup) name
       */
      msgIdentificationFromUrl: function(url) {

        // sample URLs in Thunderbird
        // Local folder: mailbox:///some/path/to/folder?number=359360
        // IMAP: imap://user@host:port/fetch>some>path>111
        // NNTP: news://some.host/some.service.com?group=some.group.name&key=3510
        // also seen: e.g. mailbox:///som/path/to/folder?number=4455522&part=1.1.2&filename=test.eml
        // mailbox:///...?number=4455522&part=1.1.2&filename=test.eml&type=application/x-message-display&filename=test.eml
        // imap://user@host:port>UID>some>path>10?header=filter&emitter=js&examineEncryptedParts=true

        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: msgIdentificationFromUrl: url.path=" + url.path + "\n");

        let msgNum = "";
        let msgFolder = "";

        if (url.schemeIs("mailbox")) {
          msgNum = url.path.replace(/(.*[?&]number=)([0-9]+)([^0-9].*)?/, "$2");
          msgFolder = url.path.replace(/\?.*/, "");
        }
        else if (url.schemeIs("imap")) {
          let p = unescape(url.path);
          msgNum = p.replace(/(.*>)([0-9]+)([^0-9].*)?/, "$2");
          msgFolder = p.replace(/\?.*$/, "").replace(/>[^>]+$/, "");
        }
        else if (url.schemeIs("news")) {
          msgNum = url.path.replace(/(.*[\?&]key=)([0-9]+)([^0-9].*)?/, "$2");
          msgFolder = url.path.replace(/(.*[\?&]group=)([^&]+)(&.*)?/, "$2");
        }

        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: msgIdentificationFromUrl: msgNum=" + msgNum + " / folder=" + msgFolder + "\n");

        return {
          msgNum: msgNum,
          folder: msgFolder.toLowerCase()
        };
      },


      isCurrentMessage: function(uri) {
        let uriSpec = (uri ? uri.spec : null);

        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: uri.spec=" + uriSpec + "\n");

        if (!uriSpec || uriSpec.search(/^enigmail:/) === 0) {
          // we cannot compare if no URI given or if URI is Enigmail-internal;
          // therefore assuming it's the current message
          return true;
        }

        let msgUriSpec = Enigmail.msg.getCurrentMsgUriSpec();

        let currUrl = {};
        try {
          let messenger = Components.classes["@mozilla.org/messenger;1"].getService(Components.interfaces.nsIMessenger);
          let msgSvc = messenger.messageServiceFromURI(msgUriSpec);
          msgSvc.GetUrlForUri(msgUriSpec, currUrl, null);
        }
        catch (ex) {
          EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: could not determine URL\n");
          currUrl.value = {
            host: "invalid",
            path: "/message",
            scheme: "enigmail",
            spec: "enigmail://invalid/message",
            schemeIs: function(s) {
              return s === this.scheme;
            }
          };
        }

        let currMsgId = this.msgIdentificationFromUrl(currUrl.value);
        let gotMsgId = this.msgIdentificationFromUrl(uri);

        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: url=" + currUrl.value.spec + "\n");

        if (uri.host == currUrl.value.host &&
          currMsgId.folder === gotMsgId.folder &&
          currMsgId.msgNum === gotMsgId.msgNum) {
          EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: true\n");
          return true;
        }

        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: false\n");
        return false;
      },

      /**
       * Determine if a given mime part number should be displayed.
       * Returns true if one of these conditions is true:
       *  - this is the 1st crypto-mime part
       *  - the mime part is earlier in the mime tree
       *  - the mime part is the 1st child of an already displayed mime part
       */
      displaySubPart: function(mimePartNumber) {
        if (!mimePartNumber) return true;

        let securityInfo = Enigmail.msg.securityInfo;
        if (mimePartNumber.length > 0 && securityInfo && securityInfo.encryptedMimePart && securityInfo.encryptedMimePart.length > 0) {
          let c = EnigmailFuncs.compareMimePartLevel(securityInfo.encryptedMimePart, mimePartNumber);

          if (c === -1) {
            EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: displaySubPart: MIME part after already processed part\n");
            return false;
          }
          if (c === -2 && mimePartNumber !== securityInfo.encryptedMimePart + ".1") {
            EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: displaySubPart: MIME part not 1st child of parent\n");
            return false;
          }
        }

        return true;
      },

      updateSecurityStatus: function(unusedUriSpec, exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation, uri, extraDetails, mimePartNumber) {
        // uriSpec is not used for Enigmail anymore. It is here becaue other addons and pEp rely on it

        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: updateSecurityStatus: mimePart=" + mimePartNumber + "\n");


        let uriSpec = (uri ? uri.spec : null);

        if (this.isCurrentMessage(uri)) {

          if (keyId === "enigmail:pEp") {
            let persons = {};
            try {
              persons = JSON.parse(extraDetails);
            }
            catch (ex) {}

            Enigmail.hdrView.displayPepStatus(statusFlags, userId, uri, persons);
          }
          else {

            if (!this.displaySubPart(mimePartNumber)) return;

            let encToDetails = "";
            if (extraDetails && extraDetails.length > 0) {
              try {
                let o = JSON.parse(extraDetails);
                if ("encryptedTo" in o) {
                  encToDetails = o.encryptedTo;
                }
              }
              catch (x) {}
            }

            Enigmail.hdrView.updateHdrIcons(exitCode, statusFlags, keyId, userId, sigDetails,
              errorMsg, blockSeparation, encToDetails,
              null, mimePartNumber);
          }
        }

        if (uriSpec && uriSpec.search(/^enigmail:message\//) === 0) {
          // display header for broken MS-Exchange message
          let ebeb = document.getElementById("enigmailBrokenExchangeBox");
          ebeb.removeAttribute("collapsed");
        }

        return;
      },

      modifyMessageHeaders: function(uri, headerData, mimePartNumber) {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.modifyMessageHeaders:\n");
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: headerData= " + headerData + ", mimePart=" + mimePartNumber + "\n");

        let updateHdrBox = Enigmail.hdrView.updateHdrBox;

        let hdr;
        try {
          hdr = JSON.parse(headerData);
        }
        catch (ex) {
          EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: modifyMessageHeaders: - no headers to display\n");
          return;
        }

        let msg = gFolderDisplay.selectedMessage;

        if (!msg) return;

        if (typeof(hdr) !== "object") return;
        if (!this.isCurrentMessage(uri) || gFolderDisplay.selectedMessages.length !== 1) return;

        if (!this.displaySubPart(mimePartNumber)) return;

        if ("subject" in hdr) {
          Enigmail.hdrView.setSubject(hdr.subject);
        }

        if ("date" in hdr) {
          msg.date = Date.parse(hdr.date) * 1000;
        }

        if ("newsgroups" in hdr) {
          updateHdrBox("newsgroups", hdr.newsgroups);
        }

        if ("followup-to" in hdr) {
          updateHdrBox("followup-to", hdr["followup-to"]);
        }

        if ("from" in hdr) {
          gExpandedHeaderView.from.outputFunction(gExpandedHeaderView.from, EnigmailData.convertFromUnicode(hdr.from, "utf-8"));
          msg.setStringProperty("Enigmail-From", hdr.from);
        }

        if ("to" in hdr) {
          gExpandedHeaderView.to.outputFunction(gExpandedHeaderView.to, EnigmailData.convertFromUnicode(hdr.to, "utf-8"));
          msg.setStringProperty("Enigmail-To", hdr.to);
        }

        if ("cc" in hdr) {
          gExpandedHeaderView.cc.outputFunction(gExpandedHeaderView.cc, EnigmailData.convertFromUnicode(hdr.cc, "utf-8"));
          msg.setStringProperty("Enigmail-Cc", hdr.cc);
        }

        if ("reply-to" in hdr) {
          gExpandedHeaderView["reply-to"].outputFunction(gExpandedHeaderView["reply-to"], EnigmailData.convertFromUnicode(hdr["reply-to"], "utf-8"));
          msg.setStringProperty("Enigmail-ReplyTo", hdr["reply-to"]);
        }

      },

      handleSMimeMessage: function(uri) {
        if (this.isCurrentMessage(uri)) {
          EnigmailVerify.unregisterContentTypeHandler();
          Enigmail.msg.messageReload(false);
        }
      },

      maxWantedNesting: function() {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.maxWantedNesting:\n");
        return this._smimeHeaderSink.maxWantedNesting();
      },

      signedStatus: function(aNestingLevel, aSignatureStatus, aSignerCert) {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.signedStatus:\n");
        return this._smimeHeaderSink.signedStatus(aNestingLevel, aSignatureStatus, aSignerCert);
      },

      encryptionStatus: function(aNestingLevel, aEncryptionStatus, aRecipientCert) {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.encryptionStatus:\n");
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
      }
      catch (ex) {}
    }
    catch (ex) {}

    if (!enigmailHeaderSink) {
      this.securityInfo = new EnigMimeHeaderSink(innerSMIMEHeaderSink);
    }
  };
}
