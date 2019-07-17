/*global Components: false, EnigmailWindows: false, EnigmailLocale: false, EnigmailPrefs: false, EnigmailTime: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

/* globals from Thunderbird: */
/* global gFolderDisplay: false, currentAttachments: false, gSMIMEContainer: false, gSignedUINode: false, gEncryptedUINode: false */
/* global gDBView: false, msgWindow: false, messageHeaderSink: false, gMessageListeners: false, findEmailNodeFromPopupNode: true */
/* global gExpandedHeaderView: false, CanDetachAttachments: true, gEncryptedURIService: false */
/* global attachmentList: false, MailOfflineMgr: false, currentHeaderData: false, ContentTypeIsSMIME: false */

var EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
var EnigmailFuncs = ChromeUtils.import("chrome://enigmail/content/modules/funcs.jsm").EnigmailFuncs;
var EnigmailVerify = ChromeUtils.import("chrome://enigmail/content/modules/mimeVerify.jsm").EnigmailVerify;
var EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
var EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailWindows = ChromeUtils.import("chrome://enigmail/content/modules/windows.jsm").EnigmailWindows;
var EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailTime = ChromeUtils.import("chrome://enigmail/content/modules/time.jsm").EnigmailTime;
var EnigmailGpg = ChromeUtils.import("chrome://enigmail/content/modules/gpg.jsm").EnigmailGpg;
var EnigmailKey = ChromeUtils.import("chrome://enigmail/content/modules/key.jsm").EnigmailKey;
var EnigmailKeyRing = ChromeUtils.import("chrome://enigmail/content/modules/keyRing.jsm").EnigmailKeyRing;
var EnigmailURIs = ChromeUtils.import("chrome://enigmail/content/modules/uris.jsm").EnigmailURIs;
var EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
var EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
var EnigmailClipboard = ChromeUtils.import("chrome://enigmail/content/modules/clipboard.jsm").EnigmailClipboard;
var EnigmailStdlib = ChromeUtils.import("chrome://enigmail/content/modules/stdlib.jsm").EnigmailStdlib;
var EnigmailMime = ChromeUtils.import("chrome://enigmail/content/modules/mime.jsm").EnigmailMime;
var EnigmailMsgRead = ChromeUtils.import("chrome://enigmail/content/modules/msgRead.jsm").EnigmailMsgRead;
var EnigmailSingletons = ChromeUtils.import("chrome://enigmail/content/modules/singletons.jsm").EnigmailSingletons;

if (!Enigmail) var Enigmail = {};

Enigmail.hdrView = {
  lastEncryptedMsgKey: null,
  lastEncryptedUri: null,


  hdrViewLoad: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.hdrViewLoad\n");

    // THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js
    // which wouldn't work otherwise

    this.origCanDetachAttachments = CanDetachAttachments;
    CanDetachAttachments = function() {
      return Enigmail.hdrView.origCanDetachAttachments() && Enigmail.hdrView.enigCanDetachAttachments();
    };

    this.msgHdrViewLoad();

    // Override SMIME ui
    let signedHdrElement = document.getElementById("signedHdrIcon");
    if (signedHdrElement) {
      signedHdrElement.setAttribute("onclick", "Enigmail.msg.viewSecurityInfo(event, true);");
    }

    let encryptedHdrElement = document.getElementById("encryptedHdrIcon");
    if (encryptedHdrElement) {
      encryptedHdrElement.setAttribute("onclick", "Enigmail.msg.viewSecurityInfo(event, true);");
    }

    let addrPopup = document.getElementById("emailAddressPopup");
    if (addrPopup) {
      addrPopup.addEventListener("popupshowing", Enigmail.hdrView.displayAddressPopup.bind(addrPopup), false);
    }

    let attCtx = document.getElementById("attachmentItemContext");
    if (attCtx) {
      attCtx.addEventListener("popupshowing", this.onShowAttachmentContextMenu.bind(Enigmail.hdrView), false);
    }
  },

  displayAddressPopup: function(event) {
    let target = event.target;
    EnigmailFuncs.collapseAdvanced(target, 'hidden');
  },

  statusBarHide: function() {
    try {
      let statusBar = document.getElementById("enigmail-status-bar");
      statusBar.removeAttribute("signed");
      statusBar.removeAttribute("encrypted");

      let enigmailBox = document.getElementById("enigmailBox");
      enigmailBox.setAttribute("collapsed", "true");

      Enigmail.msg.setAttachmentReveal(null);
      if (Enigmail.msg.securityInfo) {
        Enigmail.msg.securityInfo = {};
      }

      let enigMsgPane = document.getElementById("enigmailMsgDisplay");
      let bodyElement = document.getElementById("messagepane");
      enigMsgPane.setAttribute("collapsed", true);
      bodyElement.removeAttribute("collapsed");
    } catch (ex) {}
  },

  setStatusText: function(txt) {
    let s = document.getElementById("enigmailStatusText");
    s.firstChild.data = txt;
  },

  updateHdrIcons: function(verify_status, encMimePartNumber) {
    EnigmailLog.DEBUG(`enigmailMsgHdrViewOverlay.js: this.updateHdrIcons: verify_status=${verify_status}\n`);

    if (gFolderDisplay.selectedMessageUris && gFolderDisplay.selectedMessageUris.length > 0) {
      this.lastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
    }

    if (Enigmail.msg.savedHeaders && "x-pgp-encoding-format" in Enigmail.msg.savedHeaders &&
      (Enigmail.msg.savedHeaders["x-pgp-encoding-format"].search(/partitioned/i) === 0)) {
      if (currentAttachments && currentAttachments.length) {
        Enigmail.msg.setAttachmentReveal(currentAttachments);
      }
    }

    // if (verify_status.isDecrypted() && verify_status.isSigned()) {
    //   statusLine = `Message is end-to-end encrypted (${verify_status.getSignKeyId()})`;
    // } else if (verify_status.isDecrypted()) {
    //   statusLine = "Message is encrypted, but not end-to-end!";
    // } else if (verify_status.isSigned()) {
    //   statusLine = "Message is signed";
    // }

    // if (!statusLine) {
    //   return;
    // }

    Enigmail.msg.securityInfo = {
      verify_status: verify_status
    };

    this.displayStatusBar();
    this.updateMsgDb();

  },

  /**
   * Display the Enigmail status bar and ask for handling the Setup Message
   */
  displayAutoCryptSetupMsgHeader: function() {
    if (!Enigmail.msg.securityInfo) {
      Enigmail.msg.securityInfo = {};
    }
    Enigmail.msg.securityInfo.xtraStatus = "autocrypt-setup";

    let view = Enigmail.hdrView;

    view.setStatusText(EnigmailLocale.getString("autocryptSetupReq"));
    view.enigmailBox.removeAttribute("collapsed");
    let confirm = document.getElementById("enigmail_confirmKey");
    confirm.setAttribute("label", EnigmailLocale.getString("autocryptSetupReq.button.label"));
    confirm.removeAttribute("hidden");

    document.getElementById("enigmail_importKey").setAttribute("hidden", "true");
    view.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
    this.displayAutocryptMessage(true);
  },

  displayAutocryptMessage: function(allowImport) {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: displayAutocryptMessage()\n");

    let enigMsgPane = document.getElementById("enigmailMsgDisplay");
    let bodyElement = document.getElementById("messagepane");
    bodyElement.setAttribute("collapsed", true);

    let txt = EnigmailLocale.getString("autocryptSetupReq.setupMsg.desc") + "\n\n";
    if (allowImport) {
      txt += EnigmailLocale.getString("autocryptSetupReq.message.import");
    } else {
      txt += EnigmailLocale.getString("autocryptSetupReq.message.sent");
    }
    txt += "\n\n" + EnigmailLocale.getString("autocryptSetupReq.setupMsg.backup");

    enigMsgPane.textContent = txt;
    enigMsgPane.removeAttribute("collapsed");

  },

  displayStatusBar: function() {
    let statusText = document.getElementById("enigmailStatusText");
    let expStatusText = document.getElementById("expandedEnigmailStatusText");
    let icon = document.getElementById("enigToggleHeaderView2");
    let bodyElement = document.getElementById("messagepanebox");
    let enigmailBox = document.getElementById("enigmailBox");

    // reset everything
    expStatusText.value = "";
    expStatusText.setAttribute("state", "false");
    icon.setAttribute("collapsed", "true");

    this.setStatusText("");
    enigmailBox.setAttribute("collapsed", "true");
    this.displayExtendedStatus(false);

    if (!Enigmail.msg.securityInfo || !Enigmail.msg.securityInfo.verify_status) {
      return;
    }

    let verify_status = Enigmail.msg.securityInfo.verify_status;

    // if (secInfo.statusArr.length > 0) {
    // expStatusText.value = secInfo.statusArr[0];
    // expStatusText.setAttribute("state", "true");
    // icon.removeAttribute("collapsed");
    // }


    let statusLine;
    if (verify_status.isDecrypted() && verify_status.isSigned()) {
      statusLine = `Message is end-to-end encrypted (${verify_status.getSignKeyId()})`;
    } else if (verify_status.isDecrypted()) {
      statusLine = "Message is encrypted, but not end-to-end!";
    } else if (verify_status.isSigned()) {
      statusLine = "Message is signed";
    }

    if (statusLine) {
      this.setStatusText(statusLine + " ");
      enigmailBox.removeAttribute("collapsed");
      this.displayExtendedStatus(true);

      if (verify_status.isSigned() && !verify_status.isSignKeyKnown()) {
        document.getElementById("enigmail_importKey").removeAttribute("hidden");
      } else {
        document.getElementById("enigmail_importKey").setAttribute("hidden", "true");
      }
      // document.getElementById("enigmail_confirmKey").setAttribute("hidden", "true");

    } else {
      this.setStatusText("");
      enigmailBox.setAttribute("collapsed", "true");
      this.displayExtendedStatus(false);
    }

    if (!gSMIMEContainer)
      return;

    let statusBar = document.getElementById("enigmail-status-bar");
    // Update icons and header-box css-class
    try {
      gSMIMEContainer.collapsed = false;
      gSignedUINode.collapsed = false;
      gEncryptedUINode.collapsed = false;

      if (verify_status.isSignOk()) {
        if (verify_status.isTrusted()) {
          // Display trusted good signature icon
          gSignedUINode.setAttribute("signed", "ok");
          enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
          statusBar.setAttribute("signed", "ok");
          bodyElement.setAttribute("enigSigned", "ok");
        } else {
          // Display untrusted/bad signature icon
          gSignedUINode.setAttribute("signed", "unknown");
          enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
          statusBar.setAttribute("signed", "unknown");
        }
      } else if (verify_status.isSigned()) {
        enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
      } else {
        enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelNoSignature");
      }

        // Display unverified signature icon
        // gSignedUINode.setAttribute("signed", "unknown");
        // enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
        // statusBar.setAttribute("signed", "unknown");

        // Display unverified signature icon
        // gSignedUINode.setAttribute("signed", "unknown");
        // enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureVerified");
        // statusBar.setAttribute("signed", "unknown");

      if (verify_status.isDecrypted()) {
        EnigmailURIs.rememberEncryptedUri(this.lastEncryptedMsgKey);

        // Display encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "ok");
        statusBar.setAttribute("encrypted", "ok");
      } else if (verify_status.isDecryptFailed()) {
        // Display un-encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "notok");
        statusBar.setAttribute("encrypted", "notok");
        enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
      }

      // special handling after trying to fix buggy mail format (see buggyExchangeEmailContent in code)
      // if (secInfo.xtraStatus && secInfo.xtraStatus == "buggyMailFormat") {
      // enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelBuggyMailFormat");
      // }
    } catch (ex) {
      EnigmailLog.writeException("displayStatusBar", ex);
    }
  },

  dispSecurityContext: function() {

    try {
      if (Enigmail.msg.securityInfo) {
        if ((Enigmail.msg.securityInfo.statusFlags & EnigmailConstants.NODATA) &&
          (Enigmail.msg.securityInfo.statusFlags &
            (EnigmailConstants.PGP_MIME_SIGNED | EnigmailConstants.PGP_MIME_ENCRYPTED))) {
          document.getElementById("enigmail_reloadMessage").removeAttribute("hidden");
        } else {
          document.getElementById("enigmail_reloadMessage").setAttribute("hidden", "true");
        }
      }

      var optList = ["pgpSecurityInfo", "copySecurityInfo"];
      for (var j = 0; j < optList.length; j++) {
        var menuElement = document.getElementById("enigmail_" + optList[j]);
        if (Enigmail.msg.securityInfo) {
          menuElement.removeAttribute("disabled");
        } else {
          menuElement.setAttribute("disabled", "true");
        }
      }

      this.setSenderStatus("signSenderKey", "editSenderKeyTrust", "dispKeyDetails");
    } catch (ex) {
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

  setSenderStatus: function(elemSign, elemTrust, elemKeyProps, elemImportKey) {

    function setElemStatus(elemName, disabledValue) {
      document.getElementById("enigmail_" + elemName).setAttribute("disabled", !disabledValue);

      let secondElem = document.getElementById("enigmail_" + elemName + "2");
      if (secondElem) secondElem.setAttribute("disabled", !disabledValue);
    }

    var sign = false;
    var trust = false;
    var unknown = false;
    var signedMsg = false;
    var keyObj = null;

    if (Enigmail.msg.securityInfo) {
      if (Enigmail.msg.securityInfo.keyId) {
        keyObj = EnigmailKeyRing.getKeyById(Enigmail.msg.securityInfo.keyId);
      }
      if (Enigmail.msg.securityInfo.msgSigned) {
        signedMsg = true;
        if (!(Enigmail.msg.securityInfo.statusFlags &
            (EnigmailConstants.REVOKED_KEY | EnigmailConstants.EXPIRED_KEY_SIGNATURE | EnigmailConstants.UNVERIFIED_SIGNATURE))) {
          sign = true;
        }
        if (keyObj && keyObj.isOwnerTrustUseful()) {
          trust = true;
        }

        if (Enigmail.msg.securityInfo.statusFlags & EnigmailConstants.UNVERIFIED_SIGNATURE) {
          unknown = true;
        }
      }
    }

    if (elemTrust) setElemStatus(elemTrust, trust);
    if (elemSign) setElemStatus(elemSign, sign);
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


  msgHdrViewLoad: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewLoad\n");

    this.messageListener = {
      enigmailBox: document.getElementById("enigmailBox"),
      onStartHeaders: function _listener_onStartHeaders() {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onStartHeaders\n");

        try {
          Enigmail.hdrView.statusBarHide();
          EnigmailVerify.setMsgWindow(msgWindow, Enigmail.msg.getCurrentMsgUriSpec());
          Enigmail.hdrView.setStatusText("");
          this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");

          let msgFrame = EnigmailWindows.getFrame(window, "messagepane");
          if (msgFrame) {
            msgFrame.addEventListener("unload", Enigmail.hdrView.messageUnload.bind(Enigmail.hdrView), true);
            msgFrame.addEventListener("load", Enigmail.hdrView.messageLoad.bind(Enigmail.hdrView), false);
          }

          Enigmail.hdrView.forgetEncryptedMsgKey();
          Enigmail.hdrView.setWindowCallback();
        } catch (ex) {}
      },

      onEndHeaders: function _listener_onEndHeaders() {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onEndHeaders\n");

        try {
          Enigmail.hdrView.statusBarHide();

          this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
        } catch (ex) {}
      },

      beforeStartHeaders: function _listener_beforeStartHeaders() {
        return true;
      }
    };

    gMessageListeners.push(this.messageListener);

    // fire the handlers since some windows open directly with a visible message
    this.messageListener.onStartHeaders();
    this.messageListener.onEndHeaders();
  },

  messageUnload: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.messageUnload\n");
    if (Enigmail.msg.securityInfo && Enigmail.msg.securityInfo.xtraStatus) {
      Enigmail.msg.securityInfo.xtraStatus = "";
    }
    this.forgetEncryptedMsgKey();
  },

  messageLoad: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.messageLoad\n");
    Enigmail.msg.messageAutoDecrypt();
    Enigmail.msg.handleAttchmentEvent();
  },

  dispKeyDetails: function() {
    if (!Enigmail.msg.securityInfo) return;

    let enigmailSvc = EnigmailCore.getService();
    let key = EnigmailKeyRing.getKeyById(Enigmail.msg.securityInfo.keyId);

    EnigmailWindows.openKeyDetails(window, key.keyId, false);
  },

  forgetEncryptedMsgKey: function() {
    if (Enigmail.hdrView.lastEncryptedMsgKey) {
      EnigmailURIs.forgetEncryptedUri(Enigmail.hdrView.lastEncryptedMsgKey);
      Enigmail.hdrView.lastEncryptedMsgKey = null;
    }

    if (Enigmail.hdrView.lastEncryptedUri && gEncryptedURIService) {
      gEncryptedURIService.forgetEncrypted(Enigmail.hdrView.lastEncryptedUri);
      Enigmail.hdrView.lastEncryptedUri = null;
    }
  },

  displayExtendedStatus: function(displayOn) {
    var expStatusText = document.getElementById("expandedEnigmailStatusText");
    if (displayOn && expStatusText.getAttribute("state") == "true") {
      if (expStatusText.getAttribute("display") == "true") {
        expStatusText.removeAttribute("collapsed");
      } else {
        expStatusText.setAttribute("collapsed", "true");
      }
    } else {
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
    } else {
      viewToggle.setAttribute("state", "true");
      viewToggle.setAttribute("class", "enigmailCollapseViewButton");
      expandedText.setAttribute("display", "true");
      this.displayExtendedStatus(true);
    }
  },

  onShowAttachmentContextMenu: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.onShowAttachmentContextMenu\n");

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
      } else if (Enigmail.msg.checkEncryptedAttach(selectedAttachments[0])) {
        if ((typeof(selectedAttachments[0].name) !== 'undefined' && selectedAttachments[0].name.match(/\.asc\.(gpg|pgp)$/i)) ||
          (typeof(selectedAttachments[0].displayName) !== 'undefined' && selectedAttachments[0].displayName.match(/\.asc\.(gpg|pgp)$/i))) {
          importMenu.removeAttribute('disabled');
        } else {
          importMenu.setAttribute('disabled', true);
        }
        decryptOpenMenu.removeAttribute('disabled');
        decryptSaveMenu.removeAttribute('disabled');
        if (EnigmailMsgRead.checkSignedAttachment(selectedAttachments[0], null, currentAttachments)) {
          verifyMenu.removeAttribute('disabled');
        } else {
          verifyMenu.setAttribute('disabled', true);
        }
        if (typeof(selectedAttachments[0].displayName) == "undefined") {
          if (!selectedAttachments[0].name) {
            selectedAttachments[0].name = "message.pgp";
          }
        } else if (!selectedAttachments[0].displayName) {
          selectedAttachments[0].displayName = "message.pgp";
        }
      } else if (EnigmailMsgRead.checkSignedAttachment(selectedAttachments[0], null, currentAttachments)) {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.removeAttribute('disabled');
      } else {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.setAttribute('disabled', true);
      }
    } else {
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

    //  TODO?
    // let statusBar = document.getElementById("enigmail-status-bar");
    // var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
    // if (statusBar.getAttribute("encrypted") == "ok")
    // Enigmail.msg.securityInfo.statusFlags |= EnigmailConstants.DECRYPTION_OKAY;
    // msgHdr.setUint32Property("enigmail", Enigmail.msg.securityInfo.statusFlags);
  },

  enigCanDetachAttachments: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.enigCanDetachAttachments\n");

    if (Enigmail.msg.securityInfo && (typeof(Enigmail.msg.securityInfo.statusFlags) != "undefined")) {
      let isMimeSignedOrEncrypted = (Enigmail.msg.securityInfo.statusFlags &
        (EnigmailConstants.PGP_MIME_SIGNED | EnigmailConstants.PGP_MIME_ENCRYPTED));
      return !isMimeSignedOrEncrypted;
    }
    return true;
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
      let subj = EnigmailData.convertFromUnicode(subject, "utf-8");
      if (gFolderDisplay.selectedMessage.flags & Components.interfaces.nsMsgMessageFlags.HasRe) {
        subj = subj.replace(/^(Re: )+(.*)/, "$2");
      }
      gFolderDisplay.selectedMessage.subject = subj;
      this.updateHdrBox("subject", subject); // this needs to be the unmodified subject

      let tt = document.getElementById("threadTree");
      if (tt) {
        tt.invalidate();
      }
    }
  },

  updateHdrBox: function(header, value) {
    let e = document.getElementById("expanded" + header + "Box");
    if (e) {
      e.headerValue = value;
    }
  },

  setWindowCallback: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: setWindowCallback\n");

    EnigmailSingletons.messageReader = this.headerPane;
  },

  headerPane: {

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
      } catch (ex) {
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

      let currMsgId = EnigmailURIs.msgIdentificationFromUrl(currUrl.value);
      let gotMsgId = EnigmailURIs.msgIdentificationFromUrl(uri);

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

    updateSecurityStatus: function(verify_status, uri, mimePartNumber) {
      EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: updateSecurityStatus: mimePart=" + mimePartNumber + "\n");


      let uriSpec = (uri ? uri.spec : null);

      if (this.isCurrentMessage(uri)) {

        if (verify_status.isDecrypted()) {
          if (gEncryptedURIService) {
            // remember encrypted message URI to enable TB prevention against EFAIL attack
            Enigmail.hdrView.lastEncryptedUri = gFolderDisplay.selectedMessageUris[0];
            gEncryptedURIService.rememberEncrypted(Enigmail.hdrView.lastEncryptedUri);
          }
        }

        if (!shouldDisplaySubPart(mimePartNumber, uriSpec)) return;
        // TODO
        // if (hasUnauthenticatedParts(mimePartNumber)) {
          // EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: updateSecurityStatus: found unauthenticated part\n");
          // statusFlags |= EnigmailConstants.PARTIALLY_PGP;
        // }

        Enigmail.hdrView.updateHdrIcons(verify_status, mimePartNumber);
      }

      if (uriSpec && uriSpec.search(/^enigmail:message\//) === 0) {
        // display header for broken MS-Exchange message
        let ebeb = document.getElementById("enigmailBrokenExchangeBox");
        ebeb.removeAttribute("collapsed");
      }

      return;
    },

    processDecryptionResult: function(uri, actionType, processData, mimePartNumber) {
      EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.processDecryptionResult:\n");
      EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: actionType= " + actionType + ", mimePart=" + mimePartNumber + "\n");

      let msg = gFolderDisplay.selectedMessage;
      if (!msg) return;
      if (!this.isCurrentMessage(uri) || gFolderDisplay.selectedMessages.length !== 1) return;

      switch (actionType) {
        case "modifyMessageHeaders":
          this.modifyMessageHeaders(uri, processData, mimePartNumber);
          return;
      }
    },

    modifyMessageHeaders: function(uri, headerData, mimePartNumber) {
      EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.modifyMessageHeaders:\n");

      let updateHdrBox = Enigmail.hdrView.updateHdrBox;
      let uriSpec = (uri ? uri.spec : null);
      let hdr;

      try {
        hdr = JSON.parse(headerData);
      } catch (ex) {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: modifyMessageHeaders: - no headers to display\n");
        return;
      }

      if (typeof(hdr) !== "object") return;
      if (!shouldDisplaySubPart(mimePartNumber, uriSpec)) return;

      let msg = gFolderDisplay.selectedMessage;

      if ("subject" in hdr) {
        Enigmail.hdrView.setSubject(hdr.subject);
      }

      if ("date" in hdr) {
        msg.date = Date.parse(hdr.date) * 1000;
      }
      /*
            if ("newsgroups" in hdr) {
              updateHdrBox("newsgroups", hdr.newsgroups);
            }

            if ("followup-to" in hdr) {
              updateHdrBox("followup-to", hdr["followup-to"]);
            }

            if ("from" in hdr) {
              gExpandedHeaderView.from.outputFunction(gExpandedHeaderView.from, hdr.from);
              msg.setStringProperty("Enigmail-From", hdr.from);
            }

            if ("to" in hdr) {
              gExpandedHeaderView.to.outputFunction(gExpandedHeaderView.to, hdr.to);
              msg.setStringProperty("Enigmail-To", hdr.to);
            }

            if ("cc" in hdr) {
              gExpandedHeaderView.cc.outputFunction(gExpandedHeaderView.cc, hdr.cc);
              msg.setStringProperty("Enigmail-Cc", hdr.cc);
            }

            if ("reply-to" in hdr) {
              gExpandedHeaderView["reply-to"].outputFunction(gExpandedHeaderView["reply-to"], hdr["reply-to"]);
              msg.setStringProperty("Enigmail-ReplyTo", hdr["reply-to"]);
            }
      */
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
  },

  onUnloadEnigmail: function() {
    window.removeEventListener("load-enigmail", Enigmail.hdrView.hdrViewLoad, false);
    for (let i = 0; i < gMessageListeners.length; i++) {
      if (gMessageListeners[i] === Enigmail.hdrView.messageListener) {
        gMessageListeners.splice(i, 1);
        break;
      }
    }

    let signedHdrElement = document.getElementById("signedHdrIcon");
    if (signedHdrElement) {
      signedHdrElement.setAttribute("onclick", "showMessageReadSecurityInfo();");
    }

    let encryptedHdrElement = document.getElementById("encryptedHdrIcon");
    if (encryptedHdrElement) {
      encryptedHdrElement.setAttribute("onclick", "showMessageReadSecurityInfo();");
    }

    let addrPopup = document.getElementById("emailAddressPopup");
    if (addrPopup) {
      addrPopup.removeEventListener("popupshowing", Enigmail.hdrView.displayAddressPopup, false);
    }

    let attCtx = document.getElementById("attachmentItemContext");
    if (attCtx) {
      attCtx.removeEventListener("popupshowing", this.onShowAttachmentContextMenu, false);
    }

    let msgFrame = EnigmailWindows.getFrame(window, "messagepane");
    if (msgFrame) {
      msgFrame.removeEventListener("unload", Enigmail.hdrView.messageUnload, true);
      msgFrame.removeEventListener("load", Enigmail.hdrView.messageLoad, false);
    }

    CanDetachAttachments = Enigmail.hdrView.origCanDetachAttachments;
  }
};

/**
  * Determine if a given MIME part number is a multipart/related message or a child thereof
  *
  * @param mimePart:      Object - The MIME Part object to evaluate from the MIME tree
  * @param searchPartNum: String - The part number to determine
  */
function isMultipartRelated(mimePart, searchPartNum) {
  if (searchPartNum.indexOf(mimePart.partNum) == 0 && mimePart.partNum.length <= searchPartNum.length) {
    if (mimePart.fullContentType.search(/^multipart\/related/i) === 0) return true;

    for (let i in mimePart.subParts) {
      if (isMultipartRelated(mimePart.subParts[i], searchPartNum)) return true;
    }
  }
  return false;
}

/**
  * Determine if a given mime part number should be displayed.
  * Returns true if one of these conditions is true:
  *  - this is the 1st displayed block of the message
  *  - the message part displayed corresonds to the decrypted part
  *
  * @param mimePartNumber: String - the MIME part number that was decrypted/verified
  * @param uriSpec:        String - the URI spec that is being displayed
  */
function shouldDisplaySubPart(mimePartNumber, uriSpec) {
  if ((!mimePartNumber) || (!uriSpec)) return true;
  let part = EnigmailMime.getMimePartNumber(uriSpec);

  if (part.length === 0) {
    // only display header if 1st message part
    if (mimePartNumber.search(/^1(\.1)*$/) < 0) return false;
  } else {
    let r = EnigmailFuncs.compareMimePartLevel(mimePartNumber, part);

    // analyzed mime part is contained in viewed message part
    if (r === 2) {
      if (mimePartNumber.substr(part.length).search(/^\.1(\.1)*$/) < 0) return false;
    } else if (r !== 0) return false;

    if (Enigmail.msg.mimeParts) {
      if (isMultipartRelated(Enigmail.msg.mimeParts, mimePartNumber)) return false;
    }
  }
  return true;
}

/**
  * Determine if there are message parts that are not signed/encrypted
  *
  * @param mimePartNumber String - the MIME part number that was authenticated
  *
  * @return Boolean: true: there are siblings / false: no siblings
  */
function hasUnauthenticatedParts(mimePartNumber) {
  function hasSiblings(mimePart, searchPartNum, parentNum) {
    if (mimePart.partNum === parentNum) {
      // if we're a direct child of a PGP/MIME encrypted message, we know that everything
      // is authenticated on this level
      if (mimePart.fullContentType.search(/^multipart\/encrypted.{1,255}protocol="?application\/pgp-encrypted"?/i) === 0) return false;
    }
    if (mimePart.partNum.indexOf(parentNum) == 0 && mimePart.partNum !== searchPartNum) return true;

    for (let i in mimePart.subParts) {
      if (hasSiblings(mimePart.subParts[i], searchPartNum, parentNum)) return true;
    }

    return false;
  }

  let parentNum = mimePartNumber.replace(/\.\d+$/, "");
  if (mimePartNumber.search(/\./) < 0) {
    parentNum = "";
  }

  if (mimePartNumber && Enigmail.msg.mimeParts) {
    if (hasSiblings(Enigmail.msg.mimeParts, mimePartNumber, parentNum)) return true;
  }

  return false;
}


window.addEventListener("load-enigmail", Enigmail.hdrView.hdrViewLoad.bind(Enigmail.hdrView), false);
