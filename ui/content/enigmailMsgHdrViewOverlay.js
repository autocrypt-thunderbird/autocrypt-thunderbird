/*global Components: false, AutocryptWindows: false, AutocryptLocale: false, AutocryptPrefs: false, AutocryptTime: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

/* globals from Thunderbird: */
/* global gFolderDisplay: false, currentAttachments: false, gSMIMEContainer: false, gSignedUINode: false, gEncryptedUINode: false */
/* global gDBView: false, msgWindow: false, messageHeaderSink: false, gMessageListeners: false, findEmailNodeFromPopupNode: true */
/* global gExpandedHeaderView: false, CanDetachAttachments: true, gEncryptedURIService: false, gMessageNotificationBar: false */
/* global attachmentList: false, MailOfflineMgr: false, currentHeaderData: false, ContentTypeIsSMIME: false */

var AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
var AutocryptFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").AutocryptFuncs;
var AutocryptVerify = ChromeUtils.import("chrome://autocrypt/content/modules/mimeVerify.jsm").AutocryptVerify;
var AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
var AutocryptPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").AutocryptPrefs;
var AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
var AutocryptWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").AutocryptWindows;
var AutocryptDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").AutocryptDialog;
var AutocryptTime = ChromeUtils.import("chrome://autocrypt/content/modules/time.jsm").AutocryptTime;
var AutocryptKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").AutocryptKeyRing;
var AutocryptURIs = ChromeUtils.import("chrome://autocrypt/content/modules/uris.jsm").AutocryptURIs;
var AutocryptConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").AutocryptConstants;
var AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;
var AutocryptClipboard = ChromeUtils.import("chrome://autocrypt/content/modules/clipboard.jsm").AutocryptClipboard;
var AutocryptStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").AutocryptStdlib;
var AutocryptMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").AutocryptMime;
var AutocryptMsgRead = ChromeUtils.import("chrome://autocrypt/content/modules/msgRead.jsm").AutocryptMsgRead;
var AutocryptSingletons = ChromeUtils.import("chrome://autocrypt/content/modules/singletons.jsm").AutocryptSingletons;
var AutocryptSetupImport = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSetupImport.jsm").AutocryptSetupImport;

if (!Autocrypt) var Autocrypt = {};

Autocrypt.hdrView = {
  lastEncryptedMsgKey: null,
  lastEncryptedUri: null,


  hdrViewLoad: function() {
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.hdrViewLoad\n");

    // THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js
    // which wouldn't work otherwise

    this.origCanDetachAttachments = CanDetachAttachments;
    CanDetachAttachments = function() {
      return Autocrypt.hdrView.origCanDetachAttachments() && Autocrypt.hdrView.enigCanDetachAttachments();
    };

    this.msgHdrViewLoad();

    // Override SMIME ui
    let signedHdrElement = document.getElementById("signedHdrIcon");
    if (signedHdrElement) {
      signedHdrElement.setAttribute("onclick", "Autocrypt.msg.viewSecurityInfo(event, true);");
    }

    let encryptedHdrElement = document.getElementById("encryptedHdrIcon");
    if (encryptedHdrElement) {
      encryptedHdrElement.setAttribute("onclick", "Autocrypt.msg.viewSecurityInfo(event, true);");
    }

    let addrPopup = document.getElementById("emailAddressPopup");
    if (addrPopup) {
      addrPopup.addEventListener("popupshowing", Autocrypt.hdrView.displayAddressPopup.bind(addrPopup), false);
    }

    let attCtx = document.getElementById("attachmentItemContext");
    if (attCtx) {
      attCtx.addEventListener("popupshowing", this.onShowAttachmentContextMenu.bind(Autocrypt.hdrView), false);
    }
  },

  displayAddressPopup: function(event) {
  },

  statusBarHide: function() {
    try {
      if (Autocrypt.msg.securityInfo) {
        Autocrypt.msg.securityInfo = {};
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

  showLoading: function() {
    let enigmailBox = document.getElementById("enigmailBox");

    if (this.firstTimeOk) {
      this.setStatusText("Processing OpenPGP...");
    } else {
      this.firstTimeOk = true;
      this.setStatusText("Processing OpenPGP (first time might take a few seconds)");
    }
    enigmailBox.setAttribute("class", "expandedAutocryptBox enigmailHeaderBoxLoading");
  },

  updateHdrIcons: function(verify_status, encMimePartNumber) {
    AutocryptLog.DEBUG(`enigmailMsgHdrViewOverlay.js: this.updateHdrIcons: verify_status=${verify_status}\n`);

    if (gFolderDisplay.selectedMessageUris && gFolderDisplay.selectedMessageUris.length > 0) {
      this.lastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
    }

    if (verify_status.wasEncrypted() && this.lastEncryptedMsgKey) {
      AutocryptURIs.rememberEncryptedUri(this.lastEncryptedMsgKey);
    }

    Autocrypt.msg.securityInfo = {
      verify_status: verify_status
    };

    this.updateMsgDb();
  },

  displayAutoCryptSetupMessage: function(url) {
    Autocrypt.msg.securityInfo = {
      verify_status: null,
      is_autocrypt_setup: true
    };
    this.showMessageAutocryptNotification(url);
  },

  showMessageAutocryptNotification: function(url) {
    let buttons = [{
      label: 'Run setup from message',
      accessKey: 's',
      popup: null,
      callback: async function(aNotification, aButton) {
        AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: displayAutoCryptSetupMsgHeader(): click!\n");
        await AutocryptSetupImport.importSetupMessage(window, url);
        return true; // keep notification open
      }
    }];

    let msgNotificationBar = gMessageNotificationBar.msgNotificationBar;
    let notification = msgNotificationBar.appendNotification("This is an Autocrypt Setup Message", "autocryptSetupMsgContent",
      "chrome://autocrypt/content/ui/logo.svg", msgNotificationBar.PRIORITY_WARNING_HIGH, buttons);

  },

  displayStatusBar: function() {
    let bodyElement = document.getElementById("messagepanebox");
    let enigmailBox = document.getElementById("enigmailBox");

    if (Autocrypt.msg.securityInfo && Autocrypt.msg.securityInfo.is_autocrypt_setup) {
      this.setStatusText("Encrypted with a password");
      enigmailBox.setAttribute("class", "expandedAutocryptBox enigmailHeaderBoxSetupMessage");
      return;
    }

    if (!Autocrypt.msg.securityInfo || !Autocrypt.msg.securityInfo.verify_status) {
      this.setStatusText("Not encrypted");
      enigmailBox.setAttribute("class", "expandedAutocryptBox");
      return;
    }

    let message_status = Autocrypt.msg.securityInfo.verify_status;

    let statusLine;
    let style;
    if (message_status.wasEncrypted()) {
      if (!message_status.isDecryptOk()) {
        statusLine = `Message failed to decrypt :(`;
        style = "EncryptError";
      } else if (!message_status.wasSigned()) {
        statusLine = "Transport encrypted";
        style = "EncryptTransportOk";
      } else if (message_status.isSignOk()) {
        statusLine = `End-to-end encrypted`;
        style = "EncryptE2eOk";
      } else {
        statusLine = "Transport encrypted (end-to-end failed)";
        style = "EncryptTransportOk"; // EncryptE2eUnknown
      }
    } else if (message_status.wasSigned()) {
      if (message_status.isSignOk()) {
        statusLine = `Signed`;
        style = "ClearsignOk";
      } else {
        statusLine = "Not encrypted";
      }
    }

    if (statusLine) {
      this.setStatusText(statusLine + " ");
      enigmailBox.setAttribute("class", style ? `expandedAutocryptBox enigmailHeaderBoxLabel${style}` : 'expandedAutocryptBox');
    } else {
      this.setStatusText("");
    }

    if (!gSMIMEContainer)
      return;

    try {
      gSMIMEContainer.collapsed = false;
      gSignedUINode.collapsed = false;
      gEncryptedUINode.collapsed = false;
    } catch (e) { }
  },

  msgHdrViewLoad: function() {
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewLoad\n");

    this.messageListener = {
      enigmailBox: document.getElementById("enigmailBox"),
      onStartHeaders: function _listener_onStartHeaders() {
        AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onStartHeaders\n");

        try {
          Autocrypt.hdrView.statusBarHide();
          AutocryptVerify.setMsgWindow(msgWindow, Autocrypt.msg.getCurrentMsgUriSpec());
          // Autocrypt.hdrView.setStatusText("");
          // this.enigmailBox.setAttribute("class", "expandedAutocryptBox");

          let msgFrame = Autocrypt.msg.messagePane;
          // let msgFrame = AutocryptWindows.getFrame(window, "messagepane");
          AutocryptLog.DEBUG(`enigmailMsgHdrViewOverlay.js: current frame: ${msgFrame}\n`);

          if (msgFrame) {
            msgFrame.addEventListener("unload", Autocrypt.hdrView.messageUnload, true);
            msgFrame.addEventListener("DOMContentLoaded", Autocrypt.hdrView.messageLoad, false);
          }

          Autocrypt.hdrView.forgetEncryptedMsgKey();
          Autocrypt.hdrView.setWindowCallback();
        } catch (ex) {
          AutocryptLog.writeException("enigmailMsgHdrViewOverlay.js", ex);
        }
      },

      onEndHeaders: function _listener_onEndHeaders() {
        AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onEndHeaders\n");

        try {
          Autocrypt.hdrView.statusBarHide();
          // this.enigmailBox.setAttribute("class", "expandedAutocryptBox");
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
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.messageUnload\n");
    if (Autocrypt.msg.securityInfo && Autocrypt.msg.securityInfo.xtraStatus) {
      Autocrypt.msg.securityInfo.xtraStatus = "";
    }
    Autocrypt.hdrView.forgetEncryptedMsgKey();
  },

  messageLoad: function() {
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.messageLoad\n");
    // TODO rework - this used to be used for pgp inline. now it parses
    // autocrypt headers, but doesn't actually "auto decrypt" anything!
    Autocrypt.msg.messageAutoDecrypt();

    Autocrypt.hdrView.displayStatusBar();

    // move some pixels of padding around
    document.getElementById("expandedBoxSpacer").setAttribute("style", "height: 2px;");
    document.getElementById("otherActionsBox").setAttribute("style", "padding-top: 4px;");
  },

  forgetEncryptedMsgKey: function() {
    if (Autocrypt.hdrView.lastEncryptedMsgKey) {
      AutocryptURIs.forgetEncryptedUri(Autocrypt.hdrView.lastEncryptedMsgKey);
      Autocrypt.hdrView.lastEncryptedMsgKey = null;
    }

    if (Autocrypt.hdrView.lastEncryptedUri && gEncryptedURIService) {
      gEncryptedURIService.forgetEncrypted(Autocrypt.hdrView.lastEncryptedUri);
      Autocrypt.hdrView.lastEncryptedUri = null;
    }
  },

  onShowAttachmentContextMenu: function() {
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.onShowAttachmentContextMenu\n");

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
      } else if (Autocrypt.msg.checkEncryptedAttach(selectedAttachments[0])) {
        if ((typeof(selectedAttachments[0].name) !== 'undefined' && selectedAttachments[0].name.match(/\.asc\.(gpg|pgp)$/i)) ||
          (typeof(selectedAttachments[0].displayName) !== 'undefined' && selectedAttachments[0].displayName.match(/\.asc\.(gpg|pgp)$/i))) {
          importMenu.removeAttribute('disabled');
        } else {
          importMenu.setAttribute('disabled', true);
        }
        decryptOpenMenu.removeAttribute('disabled');
        decryptSaveMenu.removeAttribute('disabled');
        if (AutocryptMsgRead.checkSignedAttachment(selectedAttachments[0], null, currentAttachments)) {
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
      } else if (AutocryptMsgRead.checkSignedAttachment(selectedAttachments[0], null, currentAttachments)) {
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
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.updateMsgDb\n");
    var msg = gFolderDisplay.selectedMessage;
    if (!msg || !msg.folder) return;

    if (Autocrypt.msg.securityInfo && Autocrypt.msg.securityInfo.verify_status) {
      var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
      msgHdr.setUint32Property("autocrypt-status", Autocrypt.msg.securityInfo.verify_status.getColumnStatusInt());
    }
  },

  enigCanDetachAttachments: function() {
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.enigCanDetachAttachments\n");

    if (Autocrypt.msg.securityInfo && (typeof(Autocrypt.msg.securityInfo.statusFlags) != "undefined")) {
      let isMimeSignedOrEncrypted = (Autocrypt.msg.securityInfo.statusFlags &
        (AutocryptConstants.PGP_MIME_SIGNED | AutocryptConstants.PGP_MIME_ENCRYPTED));
      return !isMimeSignedOrEncrypted;
    }
    return true;
  },

  fillAttachmentListPopup: function(item) {
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: Autocrypt.hdrView.fillAttachmentListPopup\n");
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
      let subj = AutocryptData.convertFromUnicode(subject, "utf-8");
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
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: setWindowCallback\n");

    AutocryptSingletons.messageReader = this.headerPane;
  },

  headerPane: {

    isCurrentMessage: function(uri) {
      let uriSpec = (uri ? uri.spec : null);

      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: uri.spec=" + uriSpec + "\n");

      if (!uriSpec || uriSpec.search(/^enigmail:/) === 0) {
        // we cannot compare if no URI given or if URI is Autocrypt-internal;
        // therefore assuming it's the current message
        return true;
      }

      let msgUriSpec = Autocrypt.msg.getCurrentMsgUriSpec();

      let currUrl = {};
      try {
        let messenger = Components.classes["@mozilla.org/messenger;1"].getService(Components.interfaces.nsIMessenger);
        let msgSvc = messenger.messageServiceFromURI(msgUriSpec);
        msgSvc.GetUrlForUri(msgUriSpec, currUrl, null);
      } catch (ex) {
        AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: could not determine URL\n");
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

      let currMsgId = AutocryptURIs.msgIdentificationFromUrl(currUrl.value);
      let gotMsgId = AutocryptURIs.msgIdentificationFromUrl(uri);

      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: url=" + currUrl.value.spec + "\n");

      if (uri.host == currUrl.value.host &&
        currMsgId.folder === gotMsgId.folder &&
        currMsgId.msgNum === gotMsgId.msgNum) {
        AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: true\n");
        return true;
      }

      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.isCurrentMessage: false\n");
      return false;
    },

    showLoading: function() {
      Autocrypt.hdrView.showLoading();
    },

    updateSecurityStatus: function(verify_status, uri, mimePartNumber) {
      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: updateSecurityStatus: mimePart=" + mimePartNumber + "\n");


      let uriSpec = (uri ? uri.spec : null);

      if (this.isCurrentMessage(uri)) {

        if (verify_status.wasEncrypted()) {
          if (gEncryptedURIService) {
            // remember encrypted message URI to enable TB prevention against EFAIL attack
            Autocrypt.hdrView.lastEncryptedUri = gFolderDisplay.selectedMessageUris[0];
            gEncryptedURIService.rememberEncrypted(Autocrypt.hdrView.lastEncryptedUri);
          }
        }

        if (!shouldDisplaySubPart(mimePartNumber, uriSpec)) return;
        // TODO
        // if (hasUnauthenticatedParts(mimePartNumber)) {
          // AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: updateSecurityStatus: found unauthenticated part\n");
          // statusFlags |= AutocryptConstants.PARTIALLY_PGP;
        // }

        Autocrypt.hdrView.updateHdrIcons(verify_status, mimePartNumber);
      }

      if (uriSpec && uriSpec.search(/^enigmail:message\//) === 0) {
        // display header for broken MS-Exchange message
        let ebeb = document.getElementById("enigmailBrokenExchangeBox");
        ebeb.removeAttribute("collapsed");
      }

      return;
    },

    processDecryptionResult: function(uri, actionType, processData, mimePartNumber) {
      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.processDecryptionResult:\n");
      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: actionType= " + actionType + ", mimePart=" + mimePartNumber + "\n");

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
      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.modifyMessageHeaders:\n");

      let updateHdrBox = Autocrypt.hdrView.updateHdrBox;
      let uriSpec = (uri ? uri.spec : null);
      let hdr;

      try {
        hdr = JSON.parse(headerData);
      } catch (ex) {
        AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: modifyMessageHeaders: - no headers to display\n");
        return;
      }

      if (typeof(hdr) !== "object") return;
      if (!shouldDisplaySubPart(mimePartNumber, uriSpec)) return;

      let msg = gFolderDisplay.selectedMessage;

      if ("subject" in hdr) {
        Autocrypt.hdrView.setSubject(hdr.subject);
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
              msg.setStringProperty("Autocrypt-From", hdr.from);
            }

            if ("to" in hdr) {
              gExpandedHeaderView.to.outputFunction(gExpandedHeaderView.to, hdr.to);
              msg.setStringProperty("Autocrypt-To", hdr.to);
            }

            if ("cc" in hdr) {
              gExpandedHeaderView.cc.outputFunction(gExpandedHeaderView.cc, hdr.cc);
              msg.setStringProperty("Autocrypt-Cc", hdr.cc);
            }

            if ("reply-to" in hdr) {
              gExpandedHeaderView["reply-to"].outputFunction(gExpandedHeaderView["reply-to"], hdr["reply-to"]);
              msg.setStringProperty("Autocrypt-ReplyTo", hdr["reply-to"]);
            }
      */
    },

    handleSMimeMessage: function(uri) {
      if (this.isCurrentMessage(uri)) {
        AutocryptVerify.unregisterContentTypeHandler();
        Autocrypt.msg.messageReload(false);
      }
    },

    maxWantedNesting: function() {
      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.maxWantedNesting:\n");
      return this._smimeHeaderSink.maxWantedNesting();
    },

    signedStatus: function(aNestingLevel, aSignatureStatus, aSignerCert) {
      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.signedStatus:\n");
      return this._smimeHeaderSink.signedStatus(aNestingLevel, aSignatureStatus, aSignerCert);
    },

    encryptionStatus: function(aNestingLevel, aEncryptionStatus, aRecipientCert) {
      AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.encryptionStatus:\n");
      return this._smimeHeaderSink.encryptionStatus(aNestingLevel, aEncryptionStatus, aRecipientCert);
    }
  },

  onUnloadAutocrypt: function() {
    AutocryptLog.DEBUG("enigmailMsgHdrViewOverlay.js: onUnloadAutocrypt()\n");
    window.removeEventListener("load-autocrypt", Autocrypt.boundHdrViewLoad, false);
    for (let i = 0; i < gMessageListeners.length; i++) {
      if (gMessageListeners[i] === Autocrypt.hdrView.messageListener) {
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
      addrPopup.removeEventListener("popupshowing", Autocrypt.hdrView.displayAddressPopup, false);
    }

    let attCtx = document.getElementById("attachmentItemContext");
    if (attCtx) {
      attCtx.removeEventListener("popupshowing", this.onShowAttachmentContextMenu, false);
    }

    let msgFrame = Autocrypt.msg.messagePane;
    // let msgFrame = AutocryptWindows.getFrame(window, "messagepane");
    if (msgFrame) {
      msgFrame.removeEventListener("unload", Autocrypt.hdrView.messageUnload, true);
      msgFrame.removeEventListener("DOMContentLoaded", Autocrypt.hdrView.messageLoad, false);
    }

    CanDetachAttachments = Autocrypt.hdrView.origCanDetachAttachments;
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
  let part = AutocryptMime.getMimePartNumber(uriSpec);

  if (part.length === 0) {
    // only display header if 1st message part
    if (mimePartNumber.search(/^1(\.1)*$/) < 0) return false;
  } else {
    let r = AutocryptFuncs.compareMimePartLevel(mimePartNumber, part);

    // analyzed mime part is contained in viewed message part
    if (r === 2) {
      if (mimePartNumber.substr(part.length).search(/^\.1(\.1)*$/) < 0) return false;
    } else if (r !== 0) return false;

    if (Autocrypt.msg.mimeParts) {
      if (isMultipartRelated(Autocrypt.msg.mimeParts, mimePartNumber)) return false;
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

  if (mimePartNumber && Autocrypt.msg.mimeParts) {
    if (hasSiblings(Autocrypt.msg.mimeParts, mimePartNumber, parentNum)) return true;
  }

  return false;
}

Autocrypt.boundHdrViewLoad = Autocrypt.hdrView.hdrViewLoad.bind(Autocrypt.hdrView);
window.addEventListener("load-autocrypt", Autocrypt.boundHdrViewLoad, false);
