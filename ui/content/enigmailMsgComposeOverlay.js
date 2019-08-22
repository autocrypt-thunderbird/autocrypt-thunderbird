/*global Components: false, AutocryptLocale: false, AutocryptApp: false, Dialog: false, AutocryptTimer: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

/*globally available Thunderbird variables/object/functions: */
/*global gMsgCompose: false, getCurrentIdentity: false */
/*global UpdateAttachmentBucket: false, gContentChanged: true */
/*global AddAttachments: false, AddAttachment: false, ChangeAttachmentBucketVisibility: false, GetResourceFromUri: false */
/*global Recipients2CompFields: false, Attachments2CompFields: false, DetermineConvertibility: false, gWindowLocked: false */
/*global CommandUpdate_MsgCompose: false, gSMFields: false, setSecuritySettings: false, getCurrentAccountKey: false */
/*global Sendlater3Composing: false, MailServices: false */

var AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
var AutocryptFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").AutocryptFuncs;
var AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
var AutocryptPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").AutocryptPrefs;
var AutocryptOS = ChromeUtils.import("chrome://autocrypt/content/modules/os.jsm").AutocryptOS;
var AutocryptArmor = ChromeUtils.import("chrome://autocrypt/content/modules/armor.jsm").AutocryptArmor;
var AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
var AutocryptFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").AutocryptFiles;
var AutocryptData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").AutocryptData;
var AutocryptApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").AutocryptApp;
var AutocryptDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").AutocryptDialog;
var AutocryptTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").AutocryptTimer;
var AutocryptWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").AutocryptWindows;
var AutocryptAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").AutocryptAutocrypt;
var AutocryptURIs = ChromeUtils.import("chrome://autocrypt/content/modules/uris.jsm").AutocryptURIs;
var AutocryptConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").AutocryptConstants;
var AutocryptDecryption = ChromeUtils.import("chrome://autocrypt/content/modules/decryption.jsm").AutocryptDecryption;
var AutocryptEncryption = ChromeUtils.import("chrome://autocrypt/content/modules/encryption.jsm").AutocryptEncryption;
var AutocryptClipboard = ChromeUtils.import("chrome://autocrypt/content/modules/clipboard.jsm").AutocryptClipboard;
var AutocryptWkdLookup = ChromeUtils.import("chrome://autocrypt/content/modules/wkdLookup.jsm").AutocryptWkdLookup;
var AutocryptMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").AutocryptMime;
var AutocryptMsgRead = ChromeUtils.import("chrome://autocrypt/content/modules/msgRead.jsm").AutocryptMsgRead;
var AutocryptMimeEncrypt = ChromeUtils.import("chrome://autocrypt/content/modules/mimeEncrypt.jsm").AutocryptMimeEncrypt;
var AutocryptSync = ChromeUtils.import("chrome://autocrypt/content/modules/sync.jsm").AutocryptSync ;
const AutocryptCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").AutocryptCryptoAPI;
var jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;

const AUTOCRYPT_RECOMMEND = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").AUTOCRYPT_RECOMMEND;


if (!Autocrypt) var Autocrypt = {};

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";
const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

const CRYPTO_MODE = {
  SIGN_ONLY: 'sign-only', // not used?
  NO_CHOICE: 'no-choice',
  CHOICE_ENABLED: 'choice-enabled',
  CHOICE_DISABLED: 'choice-disabled'
};

const ENCRYPT_DISPLAY_STATUS = {
  UNCONFIGURED: {
    encSymbol: "inactiveNone",
    encStr: "Encryption not configured for this address",
    buttonPressed: false
  },
  SIGN_ONLY: {
    encSymbol: "activeNone",
    encStr: "Sign-only mode",
    buttonPressed: false
  },
  UNAVAILABLE: {
    encSymbol: "forceNo",
    encStr: "Encryption is not available",
    buttonPressed: false
  },
  NO_RECIPIENTS: {
    encSymbol: "empty",
    encStr: "No recipients",
    buttonPressed: false
  },
  ENABLED_MANUAL: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled",
    buttonPressed: true
  },
  ENABLED_REPLY: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled (automatic)",
    buttonPressed: true
  },
  ENABLED_MUTUAL: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled (automatic)",
    buttonPressed: true
  },
  ERROR_MISSING_KEYS: {
    encSymbol: "activeConflict",
    encStr: "Missing recipient keys",
    buttonPressed: true
  },
  ENABLED_TRUSTED: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled (trusted)",
    buttonPressed: true
  },
  AVAILABLE: {
    encSymbol: "inactiveNone",
    encStr: "Encryption is available",
    buttonPressed: false
  },
  DISABLE: {
    encSymbol: "forceNo",
    encStr: "Encryption is disabled",
    buttonPressed: false
  },
  SMIME: {
    encSymbol: "forceNo",
    encStr: "Disabled, using S/MIME",
    buttonPressed: false
  },
  ERROR_NEWSGROUPS: {
    encSymbol: "activeConflict",
    encStr: "Disabled, sending to newsgroup",
    buttonPressed: true
  },
  NEWSGROUPS: {
    encSymbol: "forceNo",
    encStr: "Disabled, sending to newsgroup",
    buttonPressed: false
  },
  ERROR_BCC: {
    encSymbol: "activeConflict",
    encStr: "Enabled, but bcc recipients not supported",
    buttonPressed: true
  },
  BCC: {
    encSymbol: "forceNo",
    encStr: "Disabled, bcc recipients not supported",
    buttonPressed: false
  },
  UNKNOWN: {
    encSymbol: "forceNo",
    encStr: "Unknown state (should not happen!)",
    buttonPressed: false
  }
};

function ComposeCryptoState() {
  // This contains up to date Autocrypt recommendations, as determined by
  // AutocryptAutocrypt.determineAutocryptRecommendations
  this.currentAutocryptRecommendation = null;
  this.senderAutocryptSettings = null;

  this.currentCryptoMode = CRYPTO_MODE.NO_CHOICE;
  this.isAnySmimeEnabled = false;
  this.isEnablePgpInline = false;
  this.isReplyToOpenPgpEncryptedMessage = false;
  this.isEnableProtectedHeaders = false;
  this.isEnableSendVerbatim = false;
}

ComposeCryptoState.prototype.isEncryptEnabled = function() {
  // it is *vital* that this is consistent, so we derive this directly from the
  // display status.
  return this.getDisplayStatus().buttonPressed;
};

ComposeCryptoState.prototype.isEnabledAndMissingKeys = function() {
  return this.getDisplayStatus() == ENCRYPT_DISPLAY_STATUS.ERROR_MISSING_KEYS;
};

ComposeCryptoState.prototype.isEncryptError = function() {
  // TODO terrible check, improve!
  return this.getDisplayStatus().encStr == 'activeConflict';
};

ComposeCryptoState.prototype.isAutocryptConfiguredForIdentity = function() {
  return Boolean(this.senderAutocryptSettings);
};

ComposeCryptoState.prototype.isSignOnly = function() {
  return this.currentCryptoMode == CRYPTO_MODE.SIGN_ONLY;
};

ComposeCryptoState.prototype.isWouldEncryptAutomatically = function() {
  let is_mutual_peers = this.currentAutocryptRecommendation.group_recommendation >= AUTOCRYPT_RECOMMEND.MUTUAL;
  let is_encrypt_mutual = is_mutual_peers && this.isAutocryptMutual();
  return is_encrypt_mutual || this.isReplyToOpenPgpEncryptedMessage;
};

ComposeCryptoState.prototype.resetUserChoice = function() {
  this.currentCryptoMode = CRYPTO_MODE.NO_CHOICE;
};

ComposeCryptoState.prototype.toggleUserChoice = function() {
  if (!this.isAutocryptConfiguredForIdentity()) {
    this.currentCryptoMode = CRYPTO_MODE.NO_CHOICE;
    return;
  }

  if (this.currentCryptoMode == CRYPTO_MODE.NO_CHOICE) {
      if (this.isEncryptEnabled()) {
          // TODO warning dialog if we override, especially from reply!
          this.currentCryptoMode = CRYPTO_MODE.CHOICE_DISABLED;
      } else {
          this.currentCryptoMode = CRYPTO_MODE.CHOICE_ENABLED;
      }
  } else if (this.currentCryptoMode == CRYPTO_MODE.CHOICE_DISABLED) {
    if (this.isWouldEncryptAutomatically()) {
      this.currentCryptoMode = CRYPTO_MODE.NO_CHOICE;
    } else {
      this.currentCryptoMode = CRYPTO_MODE.CHOICE_ENABLED;
    }
  } else if (this.currentCryptoMode == CRYPTO_MODE.CHOICE_ENABLED) {
    if (this.isWouldEncryptAutomatically()) {
      this.currentCryptoMode = CRYPTO_MODE.CHOICE_DISABLED;
    } else {
      this.currentCryptoMode = CRYPTO_MODE.NO_CHOICE;
    }
  }
};

ComposeCryptoState.prototype.isCheckStatusManual = function() {
  return this.currentCryptoMode == CRYPTO_MODE.CHOICE_ENABLED;
};

ComposeCryptoState.prototype.isAutocryptMutual = function() {
  return this.senderAutocryptSettings && this.senderAutocryptSettings.is_mutual;
};

ComposeCryptoState.prototype.isCheckStatusMutual = function() {
  return this.isAutocryptMutual() && (
    this.currentAutocryptRecommendation.group_recommendation == AUTOCRYPT_RECOMMEND.NO_RECIPIENTS ||
    this.currentAutocryptRecommendation.group_recommendation >= AUTOCRYPT_RECOMMEND.MUTUAL
  );
};

ComposeCryptoState.prototype.isCheckStatusReply = function() {
  return this.isReplyToOpenPgpEncryptedMessage;
};

ComposeCryptoState.prototype.getDisplayStatus = function() {
  if (this.isAnySmimeEnabled) {
    return ENCRYPT_DISPLAY_STATUS.SMIME;
  }
  if (!this.isAutocryptConfiguredForIdentity()) {
    return ENCRYPT_DISPLAY_STATUS.UNCONFIGURED;
  }
  let no_recipients = this.currentAutocryptRecommendation.group_recommendation == AUTOCRYPT_RECOMMEND.NO_RECIPIENTS;
  let can_encrypt = no_recipients || this.currentAutocryptRecommendation.group_recommendation >= AUTOCRYPT_RECOMMEND.DISCOURAGED;
  let is_mutual_peers = this.currentAutocryptRecommendation.group_recommendation >= AUTOCRYPT_RECOMMEND.MUTUAL;
  switch(this.currentCryptoMode) {
    case CRYPTO_MODE.NO_CHOICE:
      if (this.isAnyRecipientNewsgroup) {
        return ENCRYPT_DISPLAY_STATUS.NEWSGROUPS;
      }
      if (this.isAnyRecipientBcc) {
        return ENCRYPT_DISPLAY_STATUS.BCC;
      }
      if (this.isReplyToOpenPgpEncryptedMessage) {
        return can_encrypt ? ENCRYPT_DISPLAY_STATUS.ENABLED_REPLY : ENCRYPT_DISPLAY_STATUS.ERROR_MISSING_KEYS;
      }
      if (no_recipients) {
        return this.isAutocryptMutual() ? ENCRYPT_DISPLAY_STATUS.NO_RECIPIENTS : ENCRYPT_DISPLAY_STATUS.DISABLE;
      }
      if (is_mutual_peers && this.isAutocryptMutual()) {
        return ENCRYPT_DISPLAY_STATUS.ENABLED_MUTUAL;
      }
      if (can_encrypt) {
        return ENCRYPT_DISPLAY_STATUS.AVAILABLE;
      }
      return ENCRYPT_DISPLAY_STATUS.UNAVAILABLE;
    case CRYPTO_MODE.CHOICE_ENABLED:
      if (this.isAnyRecipientNewsgroup) {
        return ENCRYPT_DISPLAY_STATUS.ERROR_NEWSGROUPS;
      }
      if (this.isAnyRecipientBcc) {
        return ENCRYPT_DISPLAY_STATUS.ERROR_BCC;
      }
      return can_encrypt ? ENCRYPT_DISPLAY_STATUS.ENABLED_MANUAL : ENCRYPT_DISPLAY_STATUS.ERROR_MISSING_KEYS;
    case CRYPTO_MODE.CHOICE_DISABLED:
      return ENCRYPT_DISPLAY_STATUS.DISABLE;
    case CRYPTO_MODE.SIGN_ONLY:
      return ENCRYPT_DISPLAY_STATUS.SIGN_ONLY;
  }
  return ENCRYPT_DISPLAY_STATUS.UNKNOWN;
};

Autocrypt.msg = {
  editor: null,
  dirty: null,
  timeoutId: null,

  composeCryptoState: new ComposeCryptoState(),

  sendProcess: false,
  composeBodyReady: false,
  identity: null,
  modifiedAttach: null,
  lastFocusedWindow: null,
  determineSendFlagId: null,
  protectHeaders: false,

  addrOnChangeTimeout: 250,
  /* timeout when entering something into the address field */

  composeStartup: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.composeStartup\n");

    function loadOverlay(targetWindow, srcUrl) {
      let {
        Overlays
      } = ChromeUtils.import("chrome://autocrypt/content/modules/overlays.jsm", {});

      Overlays.loadOverlays("Autocrypt", targetWindow, [srcUrl]);
    }

    function addSecurityListener(itemId, func) {
      let s = document.getElementById(itemId);
      if (s) {
        s.addEventListener("command", func.bind(Autocrypt.msg), false);
      } else {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: addSecurityListener - cannot find element " + itemId + "\n");
      }
    }

    gMsgCompose.RegisterStateListener(Autocrypt.composeStateListener);
    Autocrypt.msg.composeBodyReady = false;

    // Relabel SMIME button and menu item
    var smimeButton = document.getElementById("button-security");
    let toolbar = document.getElementById("composeToolbar2");

    if (smimeButton) {
      smimeButton.setAttribute("label", "S/MIME");
      // if (toolbar && toolbar.getAttribute("currentset").length === 0) {
        // remove S/MIME button if the toolbar is displaying the default set
      // toolbar.removeChild(smimeButton);
      // }
    }

    var msgId = document.getElementById("msgIdentityPopup");
    if (msgId) {
      msgId.addEventListener("command", Autocrypt.msg.setIdentityCallback, false);
    }

    var subj = document.getElementById("msgSubject");
    subj.addEventListener('focus', Autocrypt.msg.fireSendFlags, false);

    // listen to S/MIME changes to potentially display "conflict" message
    addSecurityListener("menu_securitySign1", this.onUpdateSmimeState);
    addSecurityListener("menu_securitySign2", this.onUpdateSmimeState);
    addSecurityListener("menu_securityEncryptRequire1", this.onUpdateSmimeState);
    addSecurityListener("menu_securityEncryptRequire2", this.onUpdateSmimeState);

    let numCerts = AutocryptFuncs.getNumOfX509Certs();
    this.addrOnChangeTimeout = Math.max((numCerts - 250) * 2, 250);
    AutocryptLog.DEBUG(`enigmailMsgComposeOverlay.js: composeStartup: numCerts=${numCerts}; setting timeout to ${this.addrOnChangeTimeout}\n`);

    this.msgComposeReset(false); // false => not closing => call setIdentityDefaults()
    this.composeOpen();
    this.updateStatusBar();
    this.initialSendFlags();
  },

  delayedUpdateStatusBar: function() {
    let composeCryptoState = this.composeCryptoState;
    AutocryptTimer.setTimeout(function _f() {
      Autocrypt.msg.updateStatusBar();
    }, 100);
  },

  refreshSmimeComposeCryptoState: function() {
    let si = Autocrypt.msg.getSecurityParams(null, true);
    let isSmime = !AutocryptMimeEncrypt.isAutocryptCompField(si);
    AutocryptLog.DEBUG(`enigmailMsgComposeOverlay.js: refreshSmimeComposeCryptoState: isSmime=${isSmime}, requireEncryptMessage=${si.requireEncryptMessage}, signMessage=${si.signMessage}\n`);
    this.composeCryptoState.isAnySmimeEnabled = isSmime && (si.requireEncryptMessage || si.signMessage);
  },

  onUpdateSmimeState: function(event) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.onUpdateSmimeState\n");
    this.delayedUpdateStatusBar();
  },

  setIdentityCallback: function(elementId) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.setIdentityCallback: elementId=" + elementId + "\n");

    AutocryptTimer.setTimeout(function _f() {
        Autocrypt.msg.setIdentityDefaults();
      },
      100);
  },

  setIdentityDefaults: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.setIdentityDefaults\n");

    this.identity = getCurrentIdentity();

    // reset default send settings, unless we have changed them already
    this.determineSendFlags();
  },

  getOriginalMsgUri: function() {
    let draftId = gMsgCompose.compFields.draftId;
    let msgUri = null;

    if (typeof(draftId) == "string" && draftId.length > 0) {
      // original message is draft
      msgUri = draftId.replace(/\?.*$/, "");
    } else if (typeof(gMsgCompose.originalMsgURI) == "string" && gMsgCompose.originalMsgURI.length > 0) {
      // original message is a "true" mail
      msgUri = gMsgCompose.originalMsgURI;
    }

    return msgUri;
  },

  getMsgHdr: function(msgUri) {
    if (!msgUri) {
      msgUri = this.getOriginalMsgUri();
    }
    if (msgUri) {
      let messenger = Components.classes["@mozilla.org/messenger;1"].getService(Components.interfaces.nsIMessenger);
      return messenger.messageServiceFromURI(msgUri).messageURIToMsgHdr(msgUri);
    } else return null;
  },

  // TODO rewrite
  getMsgProperties: function(draft) {
    AutocryptLog.DEBUG("enigmailMessengerOverlay.js: Autocrypt.msg.getMsgProperties:\n");

    let msgUri = this.getOriginalMsgUri();
    let self = this;
    let properties = 0;
    try {
      let msgHdr = this.getMsgHdr(msgUri);
      if (msgHdr) {
        let msgUrl = AutocryptMsgRead.getUrlFromUriSpec(msgUri);
        properties = msgHdr.getUint32Property("enigmail");
        try {
          AutocryptMime.getMimeTreeFromUrl(msgUrl.spec, false, function _cb(mimeMsg) {
            if (draft) {
              self.setDraftOptions(mimeMsg);
            } else {
              if (AutocryptURIs.isEncryptedUri(msgUri)) self.setOriginalSubject(msgHdr.subject, false);
            }
          });
        } catch (ex) {
          AutocryptLog.DEBUG("enigmailMessengerOverlay.js: Autocrypt.msg.getMsgProperties: excetion in getMimeTreeFromUrl\n");
        }
      }
    } catch (ex) {
      AutocryptLog.DEBUG("enigmailMessengerOverlay.js: Autocrypt.msg.getMsgProperties: got exception '" + ex.toString() + "'\n");
    }

    if (AutocryptURIs.isEncryptedUri(msgUri)) {
      properties |= AutocryptConstants.DECRYPTION_OKAY;
    }

    return properties;
  },

  setDraftOptions: function(mimeMsg) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.setDraftOptions\n");

    let stat;
    if (mimeMsg && mimeMsg.headers.has("autocrypt-draft-state")) {
      stat = String(mimeMsg.headers.get("autocrypt-draft-state").join(""));
    } else {
      return;
    }

    // TODO implement according to https://github.com/autocrypt/autocrypt/pull/376

    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.setDraftOptions: draftStatus: " + stat + "\n");
  },

  setOriginalSubject: function(subject, forceSetting) {
    const CT = Components.interfaces.nsIMsgCompType;
    let subjElem = document.getElementById("msgSubject");
    let prefix = "";

    if (!subjElem) return;

    switch (gMsgCompose.type) {
      case CT.ForwardInline:
      case CT.ForwardAsAttachment:
        prefix = this.getMailPref("mail.forward_subject_prefix") + ": ";
        break;
      case CT.Reply:
      case CT.ReplyAll:
      case CT.ReplyToSender:
      case CT.ReplyToGroup:
      case CT.ReplyToSenderAndGroup:
      case CT.ReplyToList:
        if (!subject.startsWith("Re: "))
          prefix = "Re: ";
    }

    let doSetSubject = forceSetting;
    switch (gMsgCompose.type) {
      case CT.Draft:
      case CT.Template:
      case CT.EditTemplate:
      case CT.ForwardInline:
      case CT.ForwardAsAttachment:
      case CT.EditAsNew:
        doSetSubject = true;
        break;
    }

    if (doSetSubject) {
      subject = AutocryptData.convertToUnicode(subject, "UTF-8");
      subject = jsmime.headerparser.decodeRFC2047Words(subject, "utf-8");

      if (subjElem.value == "Re: " + subject) return;

      gMsgCompose.compFields.subject = prefix + subject;
      subjElem.value = prefix + subject;
      if (typeof subjElem.oninput === "function") subjElem.oninput();
    }
  },

  setupMenuAndToolbar: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.setupMenuAndToolbar\n");
    let toolbarTxt = document.getElementById("enigmail-toolbar-text");
    let encBroadcaster = document.getElementById("enigmail-bc-encrypt");

    encBroadcaster.removeAttribute("hidden");
    if (toolbarTxt) {
      toolbarTxt.removeAttribute("hidden");
    }
  },

  composeOpen: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.composeOpen\n");

    this.setupMenuAndToolbar();

    this.determineSendFlagId = null;
    this.disableSmime = false;
    this.protectHeaders = (AutocryptPrefs.getPref("protectedHeaders") === 2);

    var toobarElem = document.getElementById("composeToolbar2");
    if (toobarElem && (AutocryptOS.getOS() == "Darwin")) {
      toobarElem.setAttribute("platform", "macos");
    }

    // remove overlay_source from enigmail-bc-sendprocess, which will be inherited to
    // addressCol2 and addressCol1 (those would be removed if Autocrypt is uninstalled)
    let bc = document.getElementById("enigmail-bc-sendprocess");
    bc.removeAttribute("overlay_source");

    // check rules for status bar icons on each change of the recipients
    var adrCol = document.getElementById("addressCol2#1"); // recipients field
    if (adrCol) {
      let attr = adrCol.getAttribute("oninput");
      adrCol.setAttribute("oninput", attr + "; Autocrypt.msg.addressOnChange(this);");
      attr = adrCol.getAttribute("onchange");
      adrCol.setAttribute("onchange", attr + "; Autocrypt.msg.addressOnChange(this);");
      adrCol.setAttribute("observes", "enigmail-bc-sendprocess");
    }
    adrCol = document.getElementById("addressCol1#1"); // to/cc/bcc/... field
    if (adrCol) {
      let attr = adrCol.getAttribute("oncommand");
      adrCol.setAttribute("oncommand", attr + "; Autocrypt.msg.addressOnChange(this);");
      adrCol.setAttribute("observes", "enigmail-bc-sendprocess");
    }

    let draftId = gMsgCompose.compFields.draftId;
    let msgIsDraft = typeof(draftId) == "string" && draftId.length > 0;

    let selectedElement = document.activeElement;

    /* global gEncryptedURIService: false */
    if (gEncryptedURIService && gEncryptedURIService.isEncrypted(gMsgCompose.originalMsgURI)) {
      // TODO I think this means the original msg was SMIME encrypted?
      this.composeCryptoState.isReplyToSmimeEncryptedMessage = true;
    }

    let msgUri = this.getOriginalMsgUri();
    if (msgUri) {
      let msgFlags = this.getMsgProperties(msgIsDraft);
      if (!msgIsDraft) {
        if (msgFlags & AutocryptConstants.DECRYPTION_OKAY) {
          AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.composeOpen: has encrypted originalMsgUri\n");
          AutocryptLog.DEBUG("originalMsgURI=" + gMsgCompose.originalMsgURI + "\n");
          this.composeCryptoState.isReplyToOpenPgpEncryptedMessage = true;
          let si = Autocrypt.msg.getSecurityParams(null, true);
          si.signMessage = false;
          si.requireEncryptMessage = false;
        }
      }
    }

    this.removeAttachedSignatureFiles();

    this.updateStatusBar();
    if (selectedElement) selectedElement.focus();
  },

  removeAttachedSignatureFiles: function() {
    // check for attached signature files and remove them
    var bucketList = document.getElementById("attachmentBucket");
    if (bucketList.hasChildNodes()) {
      var node = bucketList.firstChild;
      let nodeNumber = 0;
      while (node) {
        if (node.attachment.contentType == "application/pgp-signature") {
          if (!this.findRelatedAttachment(bucketList, node)) {
            // Let's release the attachment object held by the node else it won't go away until the window is destroyed
            node.attachment = null;
            node = bucketList.removeChild(node);
          }
        } else {
          ++nodeNumber;
        }
        node = node.nextSibling;
      }
    }

    try {
      // TB only
      UpdateAttachmentBucket(bucketList.hasChildNodes());
    } catch (ex) {}
  },

  // check if an signature is related to another attachment
  findRelatedAttachment: function(bucketList, node) {

    // check if filename ends with .sig
    if (node.attachment.name.search(/\.sig$/i) < 0) return null;

    var relatedNode = bucketList.firstChild;
    var findFile = node.attachment.name.toLowerCase();
    var baseAttachment = null;
    while (relatedNode) {
      if (relatedNode.attachment.name.toLowerCase() + ".sig" == findFile)
        baseAttachment = relatedNode.attachment;
      relatedNode = relatedNode.nextSibling;
    }
    return baseAttachment;
  },

  initialSendFlags: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.initialSendFlags\n");
    this.fireSendFlags();

    AutocryptTimer.setTimeout(function _f() {
      AutocryptLog.DEBUG("enigmailMsgComposeOverlay: re-determine send flags\n");
      try {
        this.determineSendFlags();
      } catch (ex) {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay: re-determine send flags - ERROR: " + ex.toString() + "\n");
      }
    }.bind(Autocrypt.msg), 1500);
  },


  msgComposeClose: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.msgComposeClose\n");

    var ioServ;
    try {
      // we should delete the original temporary files of the encrypted or signed
      // inline PGP attachments (the rest is done automatically)
      if (this.modifiedAttach) {
        ioServ = Components.classes[IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        if (!ioServ)
          return;

        for (var i in this.modifiedAttach) {
          if (this.modifiedAttach[i].origTemp) {
            AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.msgComposeClose: deleting " + this.modifiedAttach[i].origUrl + "\n");
            var fileUri = ioServ.newURI(this.modifiedAttach[i].origUrl, null, null);
            var fileHandle = Components.classes[LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsIFile);
            fileHandle.initWithPath(fileUri.path);
            if (fileHandle.exists()) fileHandle.remove(false);
          }
        }
        this.modifiedAttach = null;
      }
    } catch (ex) {
      AutocryptLog.ERROR("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: could not delete all files:\n" + ex.toString() + "\n");
    }

    this.msgComposeReset(true); // true => closing => don't call setIdentityDefaults()
  },


  msgComposeReset: function(closing) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.msgComposeReset\n");

    this.dirty = 0;
    this.timeoutId = null;

    this.modifiedAttach = null;
    this.identity = null;
    this.sendProcess = false;

    if (!closing) {
      this.setIdentityDefaults();
    }
  },

  addAttachment: function(attachment) {
    if (typeof(AddAttachment) == "undefined") {
      // TB >= 24
      AddAttachments([attachment]);
    } else {
      // SeaMonkey
      AddAttachment(attachment);
    }
  },

  getSecurityParams: function(compFields = null, doQueryInterface = false) {
    if (!compFields)
      compFields = gMsgCompose.compFields;

    if ("securityInfo" in compFields) {
      if (doQueryInterface) {
        return compFields.securityInfo.QueryInterface(Components.interfaces.nsIMsgSMIMECompFields);
      } else {
        return compFields.securityInfo;
      }
    } else {
      return compFields.composeSecure;
    }
  },

  setSecurityParams: function(newSecurityParams) {
    if ("securityInfo" in gMsgCompose.compFields) {
      // TB < 64
      gMsgCompose.compFields.securityInfo = newSecurityParams;
    } else {
      gMsgCompose.compFields.composeSecure = newSecurityParams;
    }
  },


  resetUpdatedFields: function() {
    // reset subject
    if (AutocryptMimeEncrypt.isAutocryptCompField(Autocrypt.msg.getSecurityParams())) {
      let si = Autocrypt.msg.getSecurityParams().wrappedJSObject;
      if (si.originalSubject) {
        gMsgCompose.compFields.subject = si.originalSubject;
      }
    }
  },


  goAccountManager: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.goAccountManager:\n");
    AutocryptCore.getService(window);
    let currentId = null;
    let account = null;
    try {
      currentId = getCurrentIdentity();
      account = AutocryptFuncs.getAccountForIdentity(currentId);
    } catch (ex) {}
    window.openDialog("chrome://autocrypt/content/ui/editSingleAccount.xul", "", "dialog,modal,centerscreen", {
      identity: currentId,
      account: account
    });
    this.setIdentityDefaults();
  },

  showDialogOnErrorState: function() {
    if (!this.composeCryptoState.isAutocryptConfiguredForIdentity()) {
      AutocryptWindows.openAutocryptSettings(window, this.identity.email);
      return true;
    }
    if (this.composeCryptoState.isAnyRecipientNewsgroup) {
      AutocryptDialog.alert(window, "Encryption to Newsgroups is not supported!");
      return true;
    }
    if (this.composeCryptoState.isAnyRecipientBcc) {
      AutocryptDialog.alert(window, "Encryption to Bcc recipients is not yet supported, sorry.");
      return true;
    }
    return false;
  },

  onPressKeyToggleEncrypt: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.onPressKeyToggleEncrypt()\n");
    this.onButtonToggleEncrypt();
  },

  onButtonToggleEncrypt: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.onButtonToggleEncrypt()\n");
    if (this.showDialogOnErrorState()) {
      this.composeCryptoState.resetUserChoice();
      this.fireSendFlags();
      return;
    }
    if (!this.composeCryptoState.isEnabledAndMissingKeys()) {
      this.composeCryptoState.toggleUserChoice();
    }
    this.delayedUpdateStatusBar();
    if (this.composeCryptoState.isEnabledAndMissingKeys()) {
      let self = this;
      setTimeout(function() {
        let choice = self.showMissingRecipientsDialog('keep-disabled');
        if (choice == 'disable') {
          self.composeCryptoState.toggleUserChoice();
        }
        self.fireSendFlags();
      }, 100);
    }
  },

  showMissingRecipientsDialog: function(choiceType) {
    const args = {
      recipients: this.findAllRecipients(),
      choiceType: choiceType
    };
    const result = {
      choice: null
    };
    window.openDialog("chrome://autocrypt/content/ui/dialogMissingKeys.xul", "",
      "chrome,dialog,modal,centerscreen,resizable,titlebar", args, result);
    AutocryptLog.DEBUG(`enigmailMsgComposeOverlay.js: showMissingRecipientsDialog(): choice ${result.choice}\n`);
    return result.choice;
  },

  // process icon/strings of status bar buttons and menu entries according to final encrypt/sign/pgpmime status
  // - uses as INPUT:
  //   - this.statusEncrypt, this.statusSign
  // - uses as OUTPUT:
  //   - resulting icon symbols
  //   - this.statusEncryptStr, this.statusSignStr, this.statusPGPMimeStr, this.statusInlinePGPStr
  //   - this.statusSMimeStr
  updateStatusBar: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.updateStatusBar()\n");

    this.refreshSmimeComposeCryptoState();

    if (!this.identity) {
      this.identity = getCurrentIdentity();
    }

    var toolbarTxt = document.getElementById("enigmail-toolbar-text");
    var encBroadcaster = document.getElementById("enigmail-bc-encrypt");
    var labelAutocryptStatus = document.getElementById("label-autocrypt-status");

    // enigmail disabled for this identity?:
    encBroadcaster.removeAttribute("disabled");

    let display_status = this.composeCryptoState.getDisplayStatus();

    // process resulting icon symbol and status strings for encrypt mode
    AutocryptLog.DEBUG(`enigmailMsgComposeOverlay.js: status: ${JSON.stringify(display_status)}\n`);

    // update encrypt icon and tooltip/menu-text
    encBroadcaster.setAttribute("encrypted", display_status.encSymbol);
    var encIcon = document.getElementById("button-enigmail-encrypt");
    if (encIcon) {
      // encIcon.setAttribute("tooltiptext", encReasonStr);
    }
    // this.setChecked("enigmail-bc-encrypt", display_status.buttonPressed);

    this.setChecked("check-autocrypt-status-manual", this.composeCryptoState.isCheckStatusManual());
    this.setChecked("check-autocrypt-status-reply", this.composeCryptoState.isCheckStatusReply());
    this.setChecked("check-autocrypt-status-mutual", this.composeCryptoState.isCheckStatusMutual());

    if (labelAutocryptStatus) {
      labelAutocryptStatus.label = "Status: " + display_status.encStr;
      labelAutocryptStatus.setAttribute("class", "menuitem-non-iconic");
    }

    // process resulting toolbar message
    if (toolbarTxt) {
      toolbarTxt.value = display_status.encStr;

      if (Autocrypt.msg.getSecurityParams()) {
        let si = Autocrypt.msg.getSecurityParams(null, true);
        let isSmime = !AutocryptMimeEncrypt.isAutocryptCompField(si);

        // if (!isEncrypt && !isSign && !isSmime && (si.signMessage || si.requireEncryptMessage)) {
        // toolbarTxt.setAttribute("class", "enigmailStrong");
        // } else {
          toolbarTxt.removeAttribute("class");
        // }
      } else {
        toolbarTxt.removeAttribute("class");
      }
    }
  },


  /* compute whether to sign/encrypt according to current rules and sendMode
   * - without any interaction, just to process resulting status bar icons
   */
  determineSendFlags: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.focusChange: Autocrypt.msg.determineSendFlags\n");

    if (!this.identity) {
      this.identity = getCurrentIdentity();
    }

    let fromAddr = this.identity.email;

    const autocrypt_settings = AutocryptSync.sync(AutocryptAutocrypt.getAutocryptSettingsForIdentity(fromAddr));
    if (autocrypt_settings && autocrypt_settings.is_secret) {
      AutocryptLog.DEBUG(`enigmailMsgComposeOverlay.js: determineSendFlags(): sender autocrypt settings: ${JSON.stringify(this.composeCryptoState.senderAutocryptSettings)}\n`);
      this.composeCryptoState.senderAutocryptSettings = autocrypt_settings;
    } else {
      AutocryptLog.DEBUG(`enigmailMsgComposeOverlay.js: determineSendFlags(): sender autocrypt settings: none\n`);
      this.composeCryptoState.senderAutocryptSettings = null;
    }

    let toAddrList = this.findAllRecipients();

    this.composeCryptoState.currentAutocryptRecommendation =
      AutocryptSync.sync(AutocryptAutocrypt.determineAutocryptRecommendations(toAddrList));

    this.composeCryptoState.isAnyRecipientNewsgroup = Boolean(gMsgCompose.compFields.newsgroups);
    this.composeCryptoState.isAnyRecipientBcc = Boolean(gMsgCompose.compFields.bcc.length);

    // process and signal new resulting state
    this.updateStatusBar();
  },

  findAllRecipients: function() {
    var compFields = gMsgCompose.compFields;

    if (!Autocrypt.msg.composeBodyReady) {
      compFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
    }
    Recipients2CompFields(compFields);
    gMsgCompose.expandMailingLists();

    // process list of to/cc email addresses
    // - bcc email addresses are ignored, when processing whether to sign/encrypt
    var toAddrList = [];
    var arrLen = {};
    if (compFields.to.length > 0) {
      let recList = compFields.splitRecipients(compFields.to, true, arrLen);
      toAddrList = addRecipients(toAddrList, recList);
    }
    if (compFields.cc.length > 0) {
      let recList = compFields.splitRecipients(compFields.cc, true, arrLen);
      toAddrList = addRecipients(toAddrList, recList);
    }

    return toAddrList;
  },

  setChecked: function(elementId, checked) {
    let elem = document.getElementById(elementId);
    if (elem) {
      if (checked) {
        elem.setAttribute("checked", "true");
      } else
        elem.removeAttribute("checked");
    }
  },

  setEnabled: function(elementId, enabled) {
    let elem = document.getElementById(elementId);
    if (elem) {
      if (!enabled) {
        elem.setAttribute("disabled", "true");
      } else
        elem.removeAttribute("disabled");
    }
  },

  setDraftStatus: function(doEncrypt) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.setDraftStatus - enabling draft mode\n");

    // TODO
    // this.setAdditionalHeader("Autocrypt-Draft-State", draftStatus);
  },

  getSenderUserId: function() {
    return this.identity.email;
  },

  /**
   * check if S/MIME encryption can be enabled
   *
   * @return: Boolean - true: keys for all recipients are available
   */
  isSmimeEncryptionPossible: function() {
    let id = getCurrentIdentity();

    if (id.getUnicharAttribute("encryption_cert_name") === "") return false;

    // enable encryption if keys for all recipients are available

    let missingCount = {};
    let emailAddresses = {};

    try {
      if (!gMsgCompose.compFields.hasRecipients) return false;
      Components.classes["@mozilla.org/messenger-smime/smimejshelper;1"]
        .createInstance(Components.interfaces.nsISMimeJSHelper)
        .getNoCertAddresses(gMsgCompose.compFields,
          missingCount,
          emailAddresses);
    } catch (e) {
      return false;
    }

    if (missingCount.value === 0) {
      return true;
    }

    return false;
  },

  // Save draft message. We do not want most of the other processing for encrypted mails here...
  saveDraftMessage: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: saveDraftMessage()\n");

    let doEncrypt = this.identity.getBoolAttribute("autoEncryptDrafts");

    this.setDraftStatus(doEncrypt);

    if (!doEncrypt) {
      AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: drafts disabled\n");
      return true;
    }

    let fromAddr = this.identity.email;
    let userIdValue = this.getSenderUserId();
    if (userIdValue) {
      fromAddr = userIdValue;
    }

    let enigmailSvc = AutocryptCore.getService(window);
    if (!enigmailSvc) return true;

    let secInfo;

    if (AutocryptMimeEncrypt.isAutocryptCompField(Autocrypt.msg.getSecurityParams())) {
      secInfo = Autocrypt.msg.getSecurityParams().wrappedJSObject;
    } else {
      try {
        secInfo = AutocryptMimeEncrypt.createMimeEncrypt(Autocrypt.msg.getSecurityParams());
        if (secInfo) {
          Autocrypt.msg.setSecurityParams(secInfo);
        }
      } catch (ex) {
        AutocryptLog.writeException("enigmailMsgComposeOverlay.js: Autocrypt.msg.saveDraftMessage", ex);
        return false;
      }
    }

    secInfo.senderEmailAddr = fromAddr;
    secInfo.recipients = fromAddr;
    secInfo.bccRecipients = "";
    secInfo.originalSubject = gMsgCompose.compFields.subject;
    this.dirty = true;

    if (this.protectHeaders) {
      gMsgCompose.compFields.subject = "";
    }

    return true;
  },

  createAutocryptSecurityFields: function(oldSecurityInfo) {
    let newSecurityInfo = AutocryptMimeEncrypt.createMimeEncrypt(Autocrypt.msg.getSecurityParams());

    if (!newSecurityInfo)
      throw Components.results.NS_ERROR_FAILURE;

    Autocrypt.msg.setSecurityParams(newSecurityInfo);
  },

  resetDirty: function() {
    let newSecurityInfo = null;

    if (this.dirty) {
      // make sure the sendFlags are reset before the message is processed
      // (it may have been set by a previously cancelled send operation!)

      let si = Autocrypt.msg.getSecurityParams();

      if (AutocryptMimeEncrypt.isAutocryptCompField(si)) {
        si.sendFlags = 0;
        si.originalSubject = gMsgCompose.compFields.subject;
      } else {
        try {
          newSecurityInfo = AutocryptMimeEncrypt.createMimeEncrypt(si);
          if (newSecurityInfo) {
            newSecurityInfo.sendFlags = 0;
            newSecurityInfo.originalSubject = gMsgCompose.compFields.subject;

            Autocrypt.msg.setSecurityParams(newSecurityInfo);
          }
        } catch (ex) {
          AutocryptLog.writeException("enigmailMsgComposeOverlay.js: Autocrypt.msg.resetDirty", ex);
        }
      }
    }

    return newSecurityInfo;
  },

  determineMsgRecipients: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.determineMsgRecipients: currentId=" + this.identity +
      ", " + this.identity.email + "\n");

    let promptSvc = AutocryptDialog.getPromptSvc();
    let fromAddr = this.identity.email;
    let toAddrList = [];
    let recList;
    let bccAddrList = [];
    let arrLen = {};
    let splitRecipients;

    let msgCompFields = gMsgCompose.compFields;

    if (msgCompFields.newsgroups) {
      AutocryptDialog.alert(window, AutocryptLocale.getString("sendingNews"));
      return false;
    }

    var userIdValue = this.getSenderUserId();
    if (userIdValue) {
      fromAddr = userIdValue;
    }

    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.determineMsgRecipients:gMsgCompose=" + gMsgCompose + "\n");

    splitRecipients = msgCompFields.splitRecipients;

    if (msgCompFields.to.length > 0) {
      recList = splitRecipients(msgCompFields.to, true, arrLen);
      addRecipients(toAddrList, recList);
    }

    if (msgCompFields.cc.length > 0) {
      recList = splitRecipients(msgCompFields.cc, true, arrLen);
      addRecipients(toAddrList, recList);
    }

    // special handling of bcc:
    // - note: bcc and encryption is a problem
    // - but bcc to the sender is fine
    if (msgCompFields.bcc.length > 0) {
      recList = splitRecipients(msgCompFields.bcc, true, arrLen);

      var bccLC = "";
      try {
        bccLC = AutocryptFuncs.stripEmail(msgCompFields.bcc).toLowerCase();
      } catch (ex) {}
      AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.determineMsgRecipients: BCC: " + bccLC + "\n");

      var selfBCC = this.identity.email && (this.identity.email.toLowerCase() == bccLC);

      if (selfBCC) {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.determineMsgRecipients: Self BCC\n");
        addRecipients(toAddrList, recList);

      } else {
        // BCC and encryption

        var dummy = {
          value: null
        };

        var hideBccUsers = promptSvc.confirmEx(window,
          AutocryptLocale.getString("enigConfirm"),
          AutocryptLocale.getString("sendingHiddenRcpt"), (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_0) +
          (promptSvc.BUTTON_TITLE_CANCEL * promptSvc.BUTTON_POS_1) +
          (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_2),
          AutocryptLocale.getString("sendWithShownBcc"),
          null,
          AutocryptLocale.getString("sendWithHiddenBcc"),
          null,
          dummy);
        switch (hideBccUsers) {
          case 2:
            addRecipients(bccAddrList, recList);
            addRecipients(toAddrList, recList);
            break;
          case 0:
            addRecipients(toAddrList, recList);
            break;
          case 1:
            return false;
        }
      }
    }

    return {
      fromAddr: fromAddr,
      toAddrList: toAddrList,
      bccAddrList: bccAddrList
    };
  },

  encryptMsg: async function(msgSendType) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: msgSendType=" + msgSendType + "\n");

    const DeliverMode = Components.interfaces.nsIMsgCompDeliverMode;
    let promptSvc = AutocryptDialog.getPromptSvc();

    var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    // EnigSend: Handle both plain and encrypted messages below
    var isOffline = (ioService && ioService.offline);

    switch (msgSendType) {
      case DeliverMode.SaveAsDraft:
      case DeliverMode.SaveAsTemplate:
      case DeliverMode.AutoSaveAsDraft:
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: detected save draft\n");

        // saving drafts is simpler and works differently than the rest of Autocrypt.
        // All rules except account-settings are ignored.
        return this.saveDraftMessage();
    }

    this.unsetAdditionalHeader("x-enigmail-draft-status");
    this.unsetAdditionalHeader("autocrypt-draft-state");

    let msgCompFields = gMsgCompose.compFields;
    let newsgroups = msgCompFields.newsgroups; // Check if sending to any newsgroups

    if (!msgCompFields.to && !msgCompFields.cc && !msgCompFields.bcc && !newsgroups) {
      // don't attempt to send message if no recipient specified
      var bundle = document.getElementById("bundle_composeMsgs");
      AutocryptDialog.alert(window, bundle.getString("12511"));
      return false;
    }

    if (this.composeCryptoState.isEncryptEnabled() && this.showDialogOnErrorState()) {
      AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: some encryption error on send - reporting\n");
      return false;
    }

    if (this.composeCryptoState.isEnabledAndMissingKeys()) {
      AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: encrypt error on send - asking user\n");
      let result = this.showMissingRecipientsDialog('send-unencrypted');
      if (result == 'send-unencrypted') {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: user requested to send unencrypted\n");
        this.fireSendFlags();
        return true;
      } else if (result == 'send-encrypted') {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: user requested to send encrypted\n");
        this.determineSendFlags();
      } else {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: user requested to abort\n");
        this.fireSendFlags();
        return false;
      }
    }

    this.identity = getCurrentIdentity();

    if (gWindowLocked) {
      AutocryptDialog.alert(window, AutocryptLocale.getString("windowLocked"));
      return false;
    }

    let newSecurityInfo = this.resetDirty();
    this.dirty = 1;

    let enigmailSvc = AutocryptCore.getService(window);
    if (!enigmailSvc) {
      var msg = AutocryptLocale.getString("sendUnencrypted");
      if (AutocryptCore.getAutocryptService() && AutocryptCore.getAutocryptService().initializationError) {
        msg = AutocryptCore.getAutocryptService().initializationError + "\n\n" + msg;
      }

      return AutocryptDialog.confirmDlg(window, msg, AutocryptLocale.getString("msgCompose.button.send"));
    }

    try {

      this.modifiedAttach = null;

      // fill fromAddr, toAddrList, bcc etc
      let rcpt = this.determineMsgRecipients();
      if (!rcpt) {
        return false;
      }

      // ----------------------- Rewrapping code, taken from function "encryptInline"

      if (this.composeCryptoState.isEncryptEnabled()) {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: encryption enabled\n");

        // Use PGP/MIME
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: encrypting as PGP/MIME\n");

        let oldSecurityInfo = Autocrypt.msg.getSecurityParams();
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.prepareSecurityInfo: oldSecurityInfo = " + oldSecurityInfo + "\n");

        if (!newSecurityInfo) {
          this.createAutocryptSecurityFields(Autocrypt.msg.getSecurityParams());
          newSecurityInfo = Autocrypt.msg.getSecurityParams().wrappedJSObject;
        }

        newSecurityInfo.originalSubject = gMsgCompose.compFields.subject;
        newSecurityInfo.originalReferences = gMsgCompose.compFields.references;

        if (this.composeCryptoState.isEnableProtectedHeaders) {
          if (this.composeCryptoState.isEncryptEnabled()) {
            gMsgCompose.compFields.subject = "";

            if (AutocryptPrefs.getPref("protectReferencesHdr")) {
              gMsgCompose.compFields.references = "";
            }
          }

        }
        newSecurityInfo.composeCryptoState = this.composeCryptoState;
        newSecurityInfo.fromAddr = rcpt.fromAddr;

        AutocryptLog.DEBUG(`enigmailMsgComposeOverlay.js: Autocrypt.msg.prepareSecurityInfo\n`);

        newSecurityInfo.fromAddr = rcpt.fromAddr;
        newSecurityInfo.toAddrs = rcpt.toAddrList;
        newSecurityInfo.bccAddrs = rcpt.bccAddrList;
      } else {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: encryption not enabled\n");
      }

      // update the list of attachments
      Attachments2CompFields(msgCompFields);

      //if (!this.prepareSending(sendFlags,
      //  rcpt.toAddrList.join(", "),
      //  toAddrStr + ", " + bccAddrStr,
      //  isOffline
      //  )) return false;

      if (msgCompFields.characterSet != "ISO-2022-JP") {
        // when we encrypt, or sign pgp/mime
        if (this.composeCryptoState.isEncryptEnabled()) {
          try {
            // make sure plaintext is not changed to 7bit
            if (typeof(msgCompFields.forceMsgEncoding) == "boolean") {
              msgCompFields.forceMsgEncoding = true;
              AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: enabled forceMsgEncoding\n");
            }
          } catch (ex) {}
        }
      }
    } catch (ex) {
      AutocryptLog.writeException("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg", ex);
      let msg = AutocryptLocale.getString("signFailed");
      if (AutocryptCore.getAutocryptService() && AutocryptCore.getAutocryptService().initializationError) {
        msg += "\n" + AutocryptCore.getAutocryptService().initializationError;
      }
      return AutocryptDialog.confirmDlg(window, msg, AutocryptLocale.getString("msgCompose.button.sendUnencrypted"));
    }

    // The encryption process for PGP/MIME messages follows "here". It's
    // called automatically from nsMsgCompose->sendMsg().
    // registration for this is done in core.jsm: startup()

    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.encryptMsg: deferring to pgp/mime encryption\n");
    return true;
  },

  sendAborted: function(window, errorMsgObj) {
    if (errorMsgObj && errorMsgObj.value) {
      var txt = errorMsgObj.value;
      var txtLines = txt.split(/\r?\n/);
      var errorMsg = "";
      for (var i = 0; i < txtLines.length; ++i) {
        var line = txtLines[i];
        var tokens = line.split(/ /);
        // process most important business reasons for invalid recipient (and sender) errors:
        if (tokens.length == 3 && (tokens[0] == "INV_RECP" || tokens[0] == "INV_SGNR")) {
          var reason = tokens[1];
          var key = tokens[2];
          if (reason == "10") {
            errorMsg += AutocryptLocale.getString("keyNotTrusted", [key]) + "\n";
          } else if (reason == "1") {
            errorMsg += AutocryptLocale.getString("keyNotFound", [key]) + "\n";
          } else if (reason == "4") {
            errorMsg += AutocryptLocale.getString("keyRevoked", [key]) + "\n";
          } else if (reason == "5") {
            errorMsg += AutocryptLocale.getString("keyExpired", [key]) + "\n";
          }
        }
      }
      if (errorMsg !== "") {
        txt = errorMsg + "\n" + txt;
      }
      AutocryptDialog.info(window, AutocryptLocale.getString("sendAborted") + txt);
    } else {
      AutocryptDialog.info(window, AutocryptLocale.getString("sendAborted") + "\n" +
        AutocryptLocale.getString("msgCompose.internalError"));
    }
  },


  getMailPref: function(prefName) {
    let prefRoot = AutocryptPrefs.getPrefRoot();

    var prefValue = null;
    try {
      var prefType = prefRoot.getPrefType(prefName);
      // Get pref value
      switch (prefType) {
        case prefRoot.PREF_BOOL:
          prefValue = prefRoot.getBoolPref(prefName);
          break;

        case prefRoot.PREF_INT:
          prefValue = prefRoot.getIntPref(prefName);
          break;

        case prefRoot.PREF_STRING:
          prefValue = prefRoot.getCharPref(prefName);
          break;

        default:
          prefValue = undefined;
          break;
      }
    } catch (ex) {
      // Failed to get pref value
      AutocryptLog.ERROR("enigmailMsgComposeOverlay.js: Autocrypt.msg.getMailPref: unknown prefName:" + prefName + " \n");
    }

    return prefValue;
  },

  /**
   * set non-standard message Header
   * (depending on TB version)
   *
   * hdr: String: header type (e.g. X-Autocrypt-Version)
   * val: String: header data (e.g. 1.2.3.4)
   */
  setAdditionalHeader: function(hdr, val) {
    gMsgCompose.compFields.setHeader(hdr, val);
  },

  unsetAdditionalHeader: function(hdr) {
    gMsgCompose.compFields.deleteHeader(hdr);
  },

  modifyCompFields: async function() {
    try {
      if (!this.identity) {
        this.identity = getCurrentIdentity();
      }

      await this.setAutocryptHeader();
    } catch (ex) {
      AutocryptLog.writeException("enigmailMsgComposeOverlay.js: Autocrypt.msg.modifyCompFields", ex);
    }
  },

  getCurrentIncomingServer: function() {
    let currentAccountKey = getCurrentAccountKey();
    let account = MailServices.accounts.getAccount(currentAccountKey);

    return account.incomingServer; /* returns nsIMsgIncomingServer */
  },

  setAutocryptHeader: async function() {
    this.identity = getCurrentIdentity();
    let fromMail = this.identity.email;

    try {
      fromMail = AutocryptFuncs.stripEmail(gMsgCompose.compFields.from);
    } catch (ex) {}

    let autocrypt_header_content = await AutocryptAutocrypt.getAutocryptHeaderContentFor(fromMail, true);
    if (autocrypt_header_content) {
      this.setAdditionalHeader('Autocrypt', autocrypt_header_content);
    }
  },

  /**
   * Handle the 'compose-send-message' event from TB
   */
  sendMessageListener: async function(event) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.sendMessageListener\n");

    // Do nothing if a compatible version of the "SendLater" addon is installed.
    // SendLater will call te quickfix -buffer-name=list
    // handleSendMessageEvent when needed.

    try {
      if (typeof(Sendlater3Composing.callAutocrypt) === "function") {
        return;
      }
    } catch (ex) {}

    await Autocrypt.msg.handleSendMessageEvent(event);
  },

  /**
   * Perform handling of the compose-send-message' event from TB (or SendLater)
   */
  handleSendMessageEvent: function(event) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.handleSendMessageEvent\n");
    let msgcomposeWindow = document.getElementById("msgcomposeWindow");
    let sendMsgType = Number(msgcomposeWindow.getAttribute("msgtype"));

    if (!(this.sendProcess && sendMsgType == Components.interfaces.nsIMsgCompDeliverMode.AutoSaveAsDraft)) {
      this.sendProcess = true;
      let bc = document.getElementById("enigmail-bc-sendprocess");

      try {
        const cApi = AutocryptCryptoAPI();
        cApi.sync(this.modifyCompFields());
        bc.setAttribute("disabled", "true");
        let encryptResult = cApi.sync(this.encryptMsg(sendMsgType));
        if (!encryptResult) {
          this.resetUpdatedFields();
          event.preventDefault();
          event.stopPropagation();
        }
      } catch (ex) {}
      bc.removeAttribute("disabled");
    } else {
      AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.sendMessageListener: sending in progress - autosave aborted\n");
      event.preventDefault();
      event.stopPropagation();
    }
    this.sendProcess = false;
  },

  /**
   * Display a notification to the user at the bottom of the window
   *
   * @param priority: Number    - Priority of the message [1 = high (error) ... 3 = low (info)]
   * @param msgText: String     - Text to be displayed in notification bar
   * @param messageId: String   - Unique message type identification
   * @param detailsText: String - optional text to be displayed by clicking on "Details" button.
   *                              if null or "", then the Detail button will no be displayed.
   */
  notifyUser: function(priority, msgText, messageId, detailsText) {
    let notif = document.getElementById("attachmentNotificationBox");
    let prio;

    switch (priority) {
      case 1:
        prio = notif.PRIORITY_CRITICAL_MEDIUM;
        break;
      case 3:
        prio = notif.PRIORITY_INFO_MEDIUM;
        break;
      default:
        prio = notif.PRIORITY_WARNING_MEDIUM;
    }

    let buttonArr = [];

    if (detailsText && detailsText.length > 0) {
      buttonArr.push({
        accessKey: AutocryptLocale.getString("msgCompose.detailsButton.accessKey"),
        label: AutocryptLocale.getString("msgCompose.detailsButton.label"),
        callback: function(aNotificationBar, aButton) {
          AutocryptDialog.info(window, detailsText);
        }
      });
    }
    notif.appendNotification(msgText, messageId, null, prio, buttonArr);
  },

  addrOnChangeTimer: null,

  addressOnChange: function(element) {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.addressOnChange\n");
    if (!this.addrOnChangeTimer) {
      var self = this;
      this.addrOnChangeTimer = AutocryptTimer.setTimeout(function _f() {
        self.fireSendFlags();
        self.addrOnChangeTimer = null;
      }, Autocrypt.msg.addrOnChangeTimeout);
    }
  },

  focusChange: function() {
    // call original TB function
    CommandUpdate_MsgCompose();

    var focusedWindow = top.document.commandDispatcher.focusedWindow;

    // we're just setting focus to where it was before
    if (focusedWindow == Autocrypt.msg.lastFocusedWindow) {
      // skip
      return;
    }

    Autocrypt.msg.lastFocusedWindow = focusedWindow;

    Autocrypt.msg.fireSendFlags();
  },

  fireSendFlags: function() {
    try {
      AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: Autocrypt.msg.fireSendFlags\n");
      if (!this.determineSendFlagId) {
        let self = this;
        this.determineSendFlagId = AutocryptTimer.setTimeout(
          function _sendFlagWrapper() {
            try {
              self.determineSendFlags();
            } catch (x) {}
            self.determineSendFlagId = null;
          },
          0);
      }
    } catch (ex) {}
  },

  /**
   * Merge multiple  Re: Re: into one Re: in message subject
   */
  fixMessageSubject: function() {
    let subjElem = document.getElementById("msgSubject");
    if (subjElem) {
      let r = subjElem.value.replace(/^(Re: )+(.*)/, "Re: $2");
      if (r !== subjElem.value) {
        subjElem.value = r;
        if (typeof subjElem.oninput === "function") subjElem.oninput();
      }
    }
  }
};


Autocrypt.composeStateListener = {
  NotifyComposeFieldsReady: function() {
    // Note: NotifyComposeFieldsReady is only called when a new window is created (i.e. not in case a window object is reused).
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.NotifyComposeFieldsReady\n");

    try {
      Autocrypt.msg.editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditor);
    } catch (ex) {}

    if (!Autocrypt.msg.editor)
      return;

    Autocrypt.msg.fixMessageSubject();

    function enigDocStateListener() {}

    enigDocStateListener.prototype = {
      QueryInterface: function(iid) {
        if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
          !iid.equals(Components.interfaces.nsISupports))
          throw Components.results.NS_ERROR_NO_INTERFACE;

        return this;
      },

      NotifyDocumentCreated: function() {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentCreated\n");
      },

      NotifyDocumentWillBeDestroyed: function() {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: EDSL.enigDocStateListener.NotifyDocumentWillBeDestroyed\n");
      },

      NotifyDocumentStateChanged: function(nowDirty) {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: EDSL.enigDocStateListener.NotifyDocumentStateChanged\n");
      }
    };

    var docStateListener = new enigDocStateListener();

    Autocrypt.msg.editor.addDocumentStateListener(docStateListener);
  },

  ComposeProcessDone: function(aResult) {
    // Note: called after a mail was sent (or saved)
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: " + aResult + "\n");

    // ensure that securityInfo is set back to S/MIME flags (especially required if draft was saved)
    if (gSMFields) Autocrypt.msg.setSecurityParams(gSMFields);
  },

  NotifyComposeBodyReady: function() {
    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady\n");

    var isEmpty,
      isEditable;

    isEmpty = Autocrypt.msg.editor.documentIsEmpty;
    isEditable = Autocrypt.msg.editor.isDocumentEditable;
    Autocrypt.msg.composeBodyReady = true;

    AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady: isEmpty=" + isEmpty + ", isEditable=" + isEditable + "\n");

    // TODO still needed?
    if (Autocrypt.msg.disableSmime) {
      if (gMsgCompose && gMsgCompose.compFields && Autocrypt.msg.getSecurityParams()) {
        let si = Autocrypt.msg.getSecurityParams(null, true);
        si.signMessage = false;
        si.requireEncryptMessage = false;
      } else {
        AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady: could not disable S/MIME\n");
      }
    }

    if (!isEditable || isEmpty)
      return;

    let msgHdr = Autocrypt.msg.getMsgHdr();
    if (msgHdr) {
      Autocrypt.msg.setOriginalSubject(msgHdr.subject, true);
    }
    Autocrypt.msg.fixMessageSubject();
  },

  SaveInFolderDone: function(folderURI) {
    //AutocryptLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.SaveInFolderDone\n");
  }
};


/**
 * Unload Autocrypt for update or uninstallation
 */
Autocrypt.composeUnload = function _unload_Autocrypt() {
  window.removeEventListener("unload-autocrypt", Autocrypt.boundComposeUnload, false);
  window.removeEventListener("load-autocrypt", Autocrypt.boundComposeStartup, false);
  window.removeEventListener("compose-window-unload", Autocrypt.boundMsgComposeClose, true);
  window.removeEventListener('compose-send-message', Autocrypt.boundSendMessageListener, true);

  gMsgCompose.UnregisterStateListener(Autocrypt.composeStateListener);

  let msgId = document.getElementById("msgIdentityPopup");
  if (msgId) {
    msgId.removeEventListener("command", Autocrypt.msg.setIdentityCallback, false);
  }

  let subj = document.getElementById("msgSubject");
  subj.removeEventListener('focus', Autocrypt.msg.fireSendFlags, false);

  // check rules for status bar icons on each change of the recipients
  let rep = new RegExp("; Autocrypt.msg.addressOnChange\\(this\\);");
  var adrCol = document.getElementById("addressCol2#1"); // recipients field
  if (adrCol) {
    let attr = adrCol.getAttribute("oninput");
    adrCol.setAttribute("oninput", attr.replace(rep, ""));
    attr = adrCol.getAttribute("onchange");
    adrCol.setAttribute("onchange", attr.replace(rep, ""));
  }
  adrCol = document.getElementById("addressCol1#1"); // to/cc/bcc/... field
  if (adrCol) {
    let attr = adrCol.getAttribute("oncommand");
    adrCol.setAttribute("oncommand", attr.replace(rep, ""));
  }

  // finally unload Autocrypt entirely
  Autocrypt = undefined;
};

function addRecipients(toAddrList, recList) {
  for (var i = 0; i < recList.length; i++) {
    try {
      toAddrList.push(AutocryptFuncs.stripEmail(recList[i].replace(/[",]/g, "")));
    } catch (ex) {}
  }
  return toAddrList;
}

Autocrypt.boundComposeStartup = Autocrypt.msg.composeStartup.bind(Autocrypt.msg);
Autocrypt.boundComposeUnload = Autocrypt.composeUnload.bind(Autocrypt.msg);
Autocrypt.boundMsgComposeClose = Autocrypt.msg.msgComposeClose.bind(Autocrypt.msg);
Autocrypt.boundSendMessageListener = Autocrypt.msg.sendMessageListener.bind(Autocrypt.msg);

window.addEventListener("load-autocrypt", Autocrypt.boundComposeStartup, false);
window.addEventListener("unload-autocrypt", Autocrypt.boundComposeUnload, false);
window.addEventListener('compose-window-unload', Autocrypt.boundMsgComposeClose, true);
window.addEventListener('compose-send-message', Autocrypt.boundSendMessageListener, true);
