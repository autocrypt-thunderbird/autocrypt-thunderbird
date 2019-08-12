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
/* global gExpandedHeaderView: false, CanDetachAttachments: true, gEncryptedURIService: false, gMessageNotificationBar: false */
/* global attachmentList: false, MailOfflineMgr: false, currentHeaderData: false, ContentTypeIsSMIME: false */

var EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
var EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
var EnigmailVerify = ChromeUtils.import("chrome://autocrypt/content/modules/mimeVerify.jsm").EnigmailVerify;
var EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
var EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
var EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
var EnigmailWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").EnigmailWindows;
var EnigmailDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailTime = ChromeUtils.import("chrome://autocrypt/content/modules/time.jsm").EnigmailTime;
var EnigmailKey = ChromeUtils.import("chrome://autocrypt/content/modules/key.jsm").EnigmailKey;
var EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
var EnigmailURIs = ChromeUtils.import("chrome://autocrypt/content/modules/uris.jsm").EnigmailURIs;
var EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
var EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
var EnigmailClipboard = ChromeUtils.import("chrome://autocrypt/content/modules/clipboard.jsm").EnigmailClipboard;
var EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
var EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
var EnigmailMsgRead = ChromeUtils.import("chrome://autocrypt/content/modules/msgRead.jsm").EnigmailMsgRead;
var EnigmailSingletons = ChromeUtils.import("chrome://autocrypt/content/modules/singletons.jsm").EnigmailSingletons;
var AutocryptSetupImport = ChromeUtils.import("chrome://autocrypt/content/modules/autocryptSetupImport.jsm").AutocryptSetupImport;

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
  },

  statusBarHide: function() {
    try {
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

  showLoading: function() {
    let enigmailBox = document.getElementById("enigmailBox");

    if (this.firstTimeOk) {
      this.setStatusText("Processing OpenPGP...");
    } else {
      this.firstTimeOk = true;
      this.setStatusText("Processing OpenPGP (first time might take a few seconds)");
    }
    enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLoading");
  },

  updateHdrIcons: function(verify_status, encMimePartNumber) {
    EnigmailLog.DEBUG(`enigmailMsgHdrViewOverlay.js: this.updateHdrIcons: verify_status=${verify_status}\n`);

    if (gFolderDisplay.selectedMessageUris && gFolderDisplay.selectedMessageUris.length > 0) {
      this.lastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
    }

    if (verify_status.wasEncrypted() && this.lastEncryptedMsgKey) {
      EnigmailURIs.rememberEncryptedUri(this.lastEncryptedMsgKey);
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

    this.updateMsgDb();
  },

  displayAutoCryptSetupMessage: function(url) {
    Enigmail.msg.securityInfo = {
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
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: displayAutoCryptSetupMsgHeader(): click!\n");
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

    if (Enigmail.msg.securityInfo && Enigmail.msg.securityInfo.is_autocrypt_setup) {
      this.setStatusText("Message is encrypted with a password");
      enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxSetupMessage");
      return;
    }

    if (!Enigmail.msg.securityInfo || !Enigmail.msg.securityInfo.verify_status) {
      this.setStatusText("Message is not encrypted ");
      enigmailBox.setAttribute("class", "expandedEnigmailBox");
      return;
    }

    let message_status = Enigmail.msg.securityInfo.verify_status;

    let statusLine;
    let style;
    if (message_status.wasEncrypted()) {
      if (!message_status.isDecryptOk()) {
        statusLine = `Message failed to decrypt :(`;
        style = "EncryptError";
      } else if (!message_status.wasSigned()) {
        statusLine = "Message is transport encrypted";
        style = "EncryptTransportOk";
      } else if (message_status.isSignOk()) {
        statusLine = `Message is end-to-end encrypted`;
        style = "EncryptE2eOk";
      } else if (!message_status.isSignKeyKnown()) {
        statusLine = "Message is transport encrypted (end-to-end check failed)";
        style = "EncryptTransportOk"; // EncryptE2eUnknown
      } else {
        statusLine = "Message is encrypted";
        style = "EncryptE2eError";
      }
    } else if (message_status.wasSigned()) {
      if (message_status.isSignOk()) {
        statusLine = `Message is signed`;
        style = "ClearsignOk";
      } else {
        statusLine = "Message is not encrypted";
      }
    }

    if (statusLine) {
      this.setStatusText(statusLine + " ");
      enigmailBox.setAttribute("class", style ? `expandedEnigmailBox enigmailHeaderBoxLabel${style}` : 'expandedEnigmailBox');
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
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewLoad\n");

    this.messageListener = {
      enigmailBox: document.getElementById("enigmailBox"),
      onStartHeaders: function _listener_onStartHeaders() {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onStartHeaders\n");

        try {
          Enigmail.hdrView.statusBarHide();
          EnigmailVerify.setMsgWindow(msgWindow, Enigmail.msg.getCurrentMsgUriSpec());
          // Enigmail.hdrView.setStatusText("");
          // this.enigmailBox.setAttribute("class", "expandedEnigmailBox");

          let msgFrame = Enigmail.msg.messagePane;
          // let msgFrame = EnigmailWindows.getFrame(window, "messagepane");
          EnigmailLog.DEBUG(`enigmailMsgHdrViewOverlay.js: current frame: ${msgFrame}\n`);

          if (msgFrame) {
            msgFrame.addEventListener("unload", Enigmail.hdrView.messageUnload, true);
            msgFrame.addEventListener("DOMContentLoaded", Enigmail.hdrView.messageLoad, false);
          }

          Enigmail.hdrView.forgetEncryptedMsgKey();
          Enigmail.hdrView.setWindowCallback();
        } catch (ex) {
          EnigmailLog.writeException("enigmailMsgHdrViewOverlay.js", ex);
        }
      },

      onEndHeaders: function _listener_onEndHeaders() {
        EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: _listener_onEndHeaders\n");

        try {
          Enigmail.hdrView.statusBarHide();
          // this.enigmailBox.setAttribute("class", "expandedEnigmailBox");
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
    Enigmail.hdrView.forgetEncryptedMsgKey();
  },

  messageLoad: function() {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: this.messageLoad\n");
    // TODO rework - this used to be used for pgp inline. now it parses
    // autocrypt headers, but doesn't actually "auto decrypt" anything!
    Enigmail.msg.messageAutoDecrypt();

    Enigmail.msg.handleAttchmentEvent();
    Enigmail.hdrView.displayStatusBar();
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
    // var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
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

    showLoading: function() {
      Enigmail.hdrView.showLoading();
    },

    updateSecurityStatus: function(verify_status, uri, mimePartNumber) {
      EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: updateSecurityStatus: mimePart=" + mimePartNumber + "\n");


      let uriSpec = (uri ? uri.spec : null);

      if (this.isCurrentMessage(uri)) {

        if (verify_status.wasEncrypted()) {
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
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: onUnloadEnigmail()\n");
    window.removeEventListener("load-enigmail", Enigmail.boundHdrViewLoad, false);
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

    let msgFrame = Enigmail.msg.messagePane;
    // let msgFrame = EnigmailWindows.getFrame(window, "messagepane");
    if (msgFrame) {
      msgFrame.removeEventListener("unload", Enigmail.hdrView.messageUnload, true);
      msgFrame.removeEventListener("DOMContentLoaded", Enigmail.hdrView.messageLoad, false);
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


Enigmail.boundHdrViewLoad = Enigmail.hdrView.hdrViewLoad.bind(Enigmail.hdrView);
window.addEventListener("load-enigmail", Enigmail.boundHdrViewLoad, false);
