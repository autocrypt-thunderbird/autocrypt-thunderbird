/*global Components: false, EnigmailLocale: false, EnigmailApp: false, Dialog: false, EnigmailTimer: false */
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

var EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
var EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
var EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
var EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
var EnigmailOS = ChromeUtils.import("chrome://autocrypt/content/modules/os.jsm").EnigmailOS;
var EnigmailArmor = ChromeUtils.import("chrome://autocrypt/content/modules/armor.jsm").EnigmailArmor;
var EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
var EnigmailFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").EnigmailFiles;
var EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
var EnigmailApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").EnigmailApp;
var EnigmailDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").EnigmailTimer;
var EnigmailWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").EnigmailWindows;
var EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
var EnigmailURIs = ChromeUtils.import("chrome://autocrypt/content/modules/uris.jsm").EnigmailURIs;
var EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
var EnigmailDecryption = ChromeUtils.import("chrome://autocrypt/content/modules/decryption.jsm").EnigmailDecryption;
var EnigmailEncryption = ChromeUtils.import("chrome://autocrypt/content/modules/encryption.jsm").EnigmailEncryption;
var EnigmailClipboard = ChromeUtils.import("chrome://autocrypt/content/modules/clipboard.jsm").EnigmailClipboard;
var EnigmailWkdLookup = ChromeUtils.import("chrome://autocrypt/content/modules/wkdLookup.jsm").EnigmailWkdLookup;
var EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
var EnigmailMsgRead = ChromeUtils.import("chrome://autocrypt/content/modules/msgRead.jsm").EnigmailMsgRead;
var EnigmailMimeEncrypt = ChromeUtils.import("chrome://autocrypt/content/modules/mimeEncrypt.jsm").EnigmailMimeEncrypt;
var EnigmailSync = ChromeUtils.import("chrome://autocrypt/content/modules/sync.jsm").EnigmailSync ;
const EnigmailCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").EnigmailCryptoAPI;
var jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;

const AUTOCRYPT_RECOMMEND = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").AUTOCRYPT_RECOMMEND;


if (!Enigmail) var Enigmail = {};

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";
const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

const CRYPTO_MODE = {
  SIGN_ONLY: 'sign-only', // not used?
  NO_CHOICE: 'no-choice',
  CHOICE_ENABLED: 'choice-enabled',
  CHOICE_DISABLED: 'choice-disabled'
};

const ENCRYPT_STATUS = {
  UNDEF: -1,
  NO: 0,
  YES: 1,
  FORCENO: 10,
  FORCEYES: 11,
  CONFLICT: 99
};

const ENCRYPT_DISPLAY_STATUS = {
  UNCONFIGURED: {
    encSymbol: "inactiveNone",
    encStr: "Encryption not configured for this address",
    buttonPressed: false,
    buttonEnabled: true
  },
  SIGN_ONLY: {
    encSymbol: "activeNone",
    encStr: "Sign-only mode",
    buttonPressed: false,
    buttonEnabled: true
  },
  UNAVAILABLE: {
    encSymbol: "forceNo",
    encStr: "Encryption is not available",
    buttonPressed: false,
    buttonEnabled: false
  },
  ENABLED_MANUAL: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled",
    buttonPressed: true,
    buttonEnabled: true
  },
  ENABLED_REPLY: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled (automatic)",
    buttonPressed: true,
    buttonEnabled: true
  },
  ENABLED_MUTUAL: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled (automatic)",
    buttonPressed: true,
    buttonEnabled: true
  },
  ENABLED_ERROR: {
    encSymbol: "activeConflict",
    encStr: "Encryption is enabled, but not available!",
    buttonPressed: true,
    buttonEnabled: true
  },
  ENABLED_TRUSTED: {
    encSymbol: "activeNone",
    encStr: "Encryption is enabled (trusted)",
    buttonPressed: true,
    buttonEnabled: true
  },
  AVAILABLE: {
    encSymbol: "inactiveNone",
    encStr: "Encryption is available",
    buttonPressed: false,
    buttonEnabled: true
  },
  DISABLE: {
    encSymbol: "forceNo",
    encStr: "Encryption is disabled",
    buttonPressed: false,
    buttonEnabled: true
  },
  SMIME: {
    encSymbol: "forceNo",
    encStr: "Disabled, using S/MIME",
    buttonPressed: false,
    buttonEnabled: false
  },
  UNKNOWN: {
    encSymbol: "forceNo",
    encStr: "Unknown state (should not happen!)",
    buttonPressed: false,
    buttonEnabled: true
  }
};

function ComposeCryptoState() {
  // This contains up to date Autocrypt recommendations, as determined by
  // EnigmailAutocrypt.determineAutocryptRecommendations
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

ComposeCryptoState.prototype.isEncryptError = function() {
  // it is *vital* that this is consistent, so we derive this directly from the
  // display status.
  return this.getDisplayStatus() == ENCRYPT_DISPLAY_STATUS.ENABLED_ERROR;
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
  return this.isAutocryptMutual() && this.currentAutocryptRecommendation.group_recommendation >= AUTOCRYPT_RECOMMEND.MUTUAL;
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
  let can_encrypt = this.currentAutocryptRecommendation.group_recommendation >= AUTOCRYPT_RECOMMEND.DISCOURAGED;
  let is_mutual_peers = this.currentAutocryptRecommendation.group_recommendation >= AUTOCRYPT_RECOMMEND.MUTUAL;
  switch(this.currentCryptoMode) {
    case CRYPTO_MODE.NO_CHOICE:
      if (this.isReplyToOpenPgpEncryptedMessage) {
        return can_encrypt ? ENCRYPT_DISPLAY_STATUS.ENABLED_REPLY : ENCRYPT_DISPLAY_STATUS.ENABLED_ERROR;
      }
      if (is_mutual_peers && this.isAutocryptMutual()) {
        return can_encrypt ? ENCRYPT_DISPLAY_STATUS.ENABLED_MUTUAL : ENCRYPT_DISPLAY_STATUS.ENABLED_ERROR;
      }
      if (can_encrypt) {
        return ENCRYPT_DISPLAY_STATUS.AVAILABLE;
      }
      return ENCRYPT_DISPLAY_STATUS.UNAVAILABLE;
    case CRYPTO_MODE.CHOICE_ENABLED:
      return can_encrypt ? ENCRYPT_DISPLAY_STATUS.ENABLED_MANUAL : ENCRYPT_DISPLAY_STATUS.ENABLED_ERROR;
    case CRYPTO_MODE.CHOICE_DISABLED:
      return ENCRYPT_DISPLAY_STATUS.DISABLE;
    case CRYPTO_MODE.SIGN_ONLY:
      return ENCRYPT_DISPLAY_STATUS.SIGN_ONLY;
  }
  return ENCRYPT_DISPLAY_STATUS.UNKNOWN;
};

Enigmail.msg = {
  editor: null,
  dirty: null,
  processed: null,
  timeoutId: null,

  composeCryptoState: new ComposeCryptoState(),

  sendProcess: false,
  composeBodyReady: false,
  identity: null,
  modifiedAttach: null,
  lastFocusedWindow: null,
  determineSendFlagId: null,
  protectHeaders: false,
  draftSubjectEncrypted: false,

  saveDraftError: 0,
  addrOnChangeTimeout: 250,
  /* timeout when entering something into the address field */

  composeStartup: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeStartup\n");

    function loadOverlay(targetWindow, srcUrl) {
      let {
        Overlays
      } = ChromeUtils.import("chrome://autocrypt/content/modules/overlays.jsm", {});

      Overlays.loadOverlays("Enigmail", targetWindow, [srcUrl]);
    }

    function addSecurityListener(itemId, func) {
      let s = document.getElementById(itemId);
      if (s) {
        s.addEventListener("command", func.bind(Enigmail.msg), false);
      } else {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: addSecurityListener - cannot find element " + itemId + "\n");
      }
    }

    // manually load overlay for contacts sidebar
    // wait 2 seconds because loading of the sidebar is slightly delayed
    // let sb = document.getElementById("sidebar");
    // if (sb) {
    // EnigmailLog.DEBUG("enigmailMsgComposeOverlay: contentDocument=" + sb.contentDocument + "\n");
    // EnigmailTimer.setTimeout(function _f() {
    // loadOverlay(sb.contentDocument.defaultView, "chrome://autocrypt/content/ui/enigmailAbContactsPanel.xul");
    // }, 2000);
    // }

    // let customizeToolbar = document.getElementById("customizeToolbarSheetIFrame");
    // customizeToolbar.addEventListener("pageshow", function(event) {
    // loadOverlay(event.target.defaultView, "chrome://autocrypt/content/ui/enigmailCustToolOverlay.xul");
    // }, false);

    gMsgCompose.RegisterStateListener(Enigmail.composeStateListener);
    Enigmail.msg.composeBodyReady = false;

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
      msgId.addEventListener("command", Enigmail.msg.setIdentityCallback, false);
    }

    var subj = document.getElementById("msgSubject");
    subj.addEventListener('focus', Enigmail.msg.fireSendFlags, false);

    // listen to S/MIME changes to potentially display "conflict" message
    addSecurityListener("menu_securitySign1", this.onUpdateSmimeState);
    addSecurityListener("menu_securitySign2", this.onUpdateSmimeState);
    addSecurityListener("menu_securityEncryptRequire1", this.onUpdateSmimeState);
    addSecurityListener("menu_securityEncryptRequire2", this.onUpdateSmimeState);

    let numCerts = EnigmailFuncs.getNumOfX509Certs();
    this.addrOnChangeTimeout = Math.max((numCerts - 250) * 2, 250);
    EnigmailLog.DEBUG(`enigmailMsgComposeOverlay.js: composeStartup: numCerts=${numCerts}; setting timeout to ${this.addrOnChangeTimeout}\n`);

    this.msgComposeReset(false); // false => not closing => call setIdentityDefaults()
    this.composeOpen();
    this.updateStatusBar();
    this.initialSendFlags();
  },

  delayedUpdateStatusBar: function() {
    let composeCryptoState = this.composeCryptoState;
    EnigmailTimer.setTimeout(function _f() {
      Enigmail.msg.updateStatusBar();
    }, 100);
  },

  refreshSmimeComposeCryptoState: function() {
    let si = Enigmail.msg.getSecurityParams(null, true);
    let isSmime = !EnigmailMimeEncrypt.isEnigmailCompField(si);
    EnigmailLog.DEBUG(`enigmailMsgComposeOverlay.js: refreshSmimeComposeCryptoState: isSmime=${isSmime}, requireEncryptMessage=${si.requireEncryptMessage}, signMessage=${si.signMessage}\n`);
    this.composeCryptoState.isAnySmimeEnabled = isSmime && (si.requireEncryptMessage || si.signMessage);
  },

  onUpdateSmimeState: function(event) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.onUpdateSmimeState\n");
    this.delayedUpdateStatusBar();
  },

  setIdentityCallback: function(elementId) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setIdentityCallback: elementId=" + elementId + "\n");

    EnigmailTimer.setTimeout(function _f() {
        Enigmail.msg.setIdentityDefaults();
      },
      100);
  },

  setIdentityDefaults: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setIdentityDefaults\n");

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
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.getMsgProperties:\n");

    let msgUri = this.getOriginalMsgUri();
    let self = this;
    let properties = 0;
    try {
      let msgHdr = this.getMsgHdr(msgUri);
      if (msgHdr) {
        let msgUrl = EnigmailMsgRead.getUrlFromUriSpec(msgUri);
        properties = msgHdr.getUint32Property("enigmail");
        try {
          EnigmailMime.getMimeTreeFromUrl(msgUrl.spec, false, function _cb(mimeMsg) {
            if (draft) {
              self.setDraftOptions(mimeMsg);
              if (self.draftSubjectEncrypted) self.setOriginalSubject(msgHdr.subject, false);
            } else {
              if (EnigmailURIs.isEncryptedUri(msgUri)) self.setOriginalSubject(msgHdr.subject, false);
            }
          });
        } catch (ex) {
          EnigmailLog.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.getMsgProperties: excetion in getMimeTreeFromUrl\n");
        }
      }
    } catch (ex) {
      EnigmailLog.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.getMsgProperties: got exception '" + ex.toString() + "'\n");
    }

    if (EnigmailURIs.isEncryptedUri(msgUri)) {
      properties |= EnigmailConstants.DECRYPTION_OKAY;
    }

    return properties;
  },

  setDraftOptions: function(mimeMsg) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setDraftOptions\n");

    let stat;
    if (mimeMsg && mimeMsg.headers.has("autocrypt-draft-state")) {
      stat = String(mimeMsg.headers.get("autocrypt-draft-state").join(""));
    } else {
      return;
    }

    // TODO implement according to https://github.com/autocrypt/autocrypt/pull/376

    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setDraftOptions: draftStatus: " + stat + "\n");
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
      subject = EnigmailData.convertToUnicode(subject, "UTF-8");
      subject = jsmime.headerparser.decodeRFC2047Words(subject, "utf-8");

      if (subjElem.value == "Re: " + subject) return;

      gMsgCompose.compFields.subject = prefix + subject;
      subjElem.value = prefix + subject;
      if (typeof subjElem.oninput === "function") subjElem.oninput();
    }
  },

  setupMenuAndToolbar: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setupMenuAndToolbar\n");
    let toolbarTxt = document.getElementById("enigmail-toolbar-text");
    let encBroadcaster = document.getElementById("enigmail-bc-encrypt");

    encBroadcaster.removeAttribute("hidden");
    if (toolbarTxt) {
      toolbarTxt.removeAttribute("hidden");
    }
  },

  composeOpen: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeOpen\n");

    this.setupMenuAndToolbar();

    this.determineSendFlagId = null;
    this.disableSmime = false;
    this.saveDraftError = 0;
    this.protectHeaders = (EnigmailPrefs.getPref("protectedHeaders") === 2);

    var toobarElem = document.getElementById("composeToolbar2");
    if (toobarElem && (EnigmailOS.getOS() == "Darwin")) {
      toobarElem.setAttribute("platform", "macos");
    }

    // remove overlay_source from enigmail-bc-sendprocess, which will be inherited to
    // addressCol2 and addressCol1 (those would be removed if Enigmail is uninstalled)
    let bc = document.getElementById("enigmail-bc-sendprocess");
    bc.removeAttribute("overlay_source");

    // check rules for status bar icons on each change of the recipients
    var adrCol = document.getElementById("addressCol2#1"); // recipients field
    if (adrCol) {
      let attr = adrCol.getAttribute("oninput");
      adrCol.setAttribute("oninput", attr + "; Enigmail.msg.addressOnChange(this);");
      attr = adrCol.getAttribute("onchange");
      adrCol.setAttribute("onchange", attr + "; Enigmail.msg.addressOnChange(this);");
      adrCol.setAttribute("observes", "enigmail-bc-sendprocess");
    }
    adrCol = document.getElementById("addressCol1#1"); // to/cc/bcc/... field
    if (adrCol) {
      let attr = adrCol.getAttribute("oncommand");
      adrCol.setAttribute("oncommand", attr + "; Enigmail.msg.addressOnChange(this);");
      adrCol.setAttribute("observes", "enigmail-bc-sendprocess");
    }

    let draftId = gMsgCompose.compFields.draftId;
    let msgIsDraft = typeof(draftId) == "string" && draftId.length > 0;

    let selectedElement = document.activeElement;

    const SIGN = EnigmailConstants.SEND_SIGNED;
    const ENCRYPT = EnigmailConstants.SEND_ENCRYPTED;

    /* global gEncryptedURIService: false */
    if (gEncryptedURIService && gEncryptedURIService.isEncrypted(gMsgCompose.originalMsgURI)) {
      // TODO I think this means the original msg was SMIME encrypted?
      this.composeCryptoState.isReplyToSmimeEncryptedMessage = true;
    }

    let msgUri = this.getOriginalMsgUri();
    if (msgUri) {
      let msgFlags = this.getMsgProperties(msgIsDraft);
      if (!msgIsDraft) {
        if (msgFlags & EnigmailConstants.DECRYPTION_OKAY) {
          EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeOpen: has encrypted originalMsgUri\n");
          EnigmailLog.DEBUG("originalMsgURI=" + gMsgCompose.originalMsgURI + "\n");
          this.composeCryptoState.isReplyToOpenPgpEncryptedMessage = true;
          let si = Enigmail.msg.getSecurityParams(null, true);
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
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.initialSendFlags\n");
    this.fireSendFlags();

    EnigmailTimer.setTimeout(function _f() {
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay: re-determine send flags\n");
      try {
        this.determineSendFlags();
      } catch (ex) {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay: re-determine send flags - ERROR: " + ex.toString() + "\n");
      }
    }.bind(Enigmail.msg), 1500);
  },


  msgComposeClose: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeClose\n");

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
            EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeClose: deleting " + this.modifiedAttach[i].origUrl + "\n");
            var fileUri = ioServ.newURI(this.modifiedAttach[i].origUrl, null, null);
            var fileHandle = Components.classes[LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsIFile);
            fileHandle.initWithPath(fileUri.path);
            if (fileHandle.exists()) fileHandle.remove(false);
          }
        }
        this.modifiedAttach = null;
      }
    } catch (ex) {
      EnigmailLog.ERROR("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: could not delete all files:\n" + ex.toString() + "\n");
    }

    this.msgComposeReset(true); // true => closing => don't call setIdentityDefaults()
  },


  msgComposeReset: function(closing) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeReset\n");

    this.dirty = 0;
    this.processed = null;
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

  /**
   *  undo the encryption or signing; get back the original (unsigned/unencrypted) text
   *
   * useEditorUndo |Number|:   > 0  use undo function of editor |n| times
   *                           0: replace text with original text
   */
  undoEncryption: function(useEditorUndo) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.undoEncryption:\n");
    if (this.processed) {
      if (useEditorUndo) {
        EnigmailTimer.setTimeout(function _f() {
          Enigmail.msg.editor.undo(useEditorUndo);
        }, 10);
      } else {
        this.replaceEditorText(this.processed.origText);
      }
      this.processed = null;

    } else {
      this.decryptQuote(true);
    }

    var node;
    var nodeNumber;
    var bucketList = document.getElementById("attachmentBucket");
    if (this.modifiedAttach && bucketList && bucketList.hasChildNodes()) {
      // undo inline encryption of attachments
      for (var i = 0; i < this.modifiedAttach.length; i++) {
        node = bucketList.firstChild;
        nodeNumber = -1;
        while (node) {
          ++nodeNumber;
          if (node.attachment.url == this.modifiedAttach[i].newUrl) {
            if (this.modifiedAttach[i].encrypted) {
              node.attachment.url = this.modifiedAttach[i].origUrl;
              node.attachment.name = this.modifiedAttach[i].origName;
              node.attachment.temporary = this.modifiedAttach[i].origTemp;
              node.attachment.contentType = this.modifiedAttach[i].origCType;
            } else {
              node = bucketList.removeChild(node);
              // Let's release the attachment object held by the node else it won't go away until the window is destroyed
              node.attachment = null;
            }
            // delete encrypted file
            try {
              this.modifiedAttach[i].newFile.remove(false);
            } catch (ex) {}

            node = null; // next attachment please
          } else {
            node = node.nextSibling;
          }
        }
      }
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
    if (EnigmailMimeEncrypt.isEnigmailCompField(Enigmail.msg.getSecurityParams())) {
      let si = Enigmail.msg.getSecurityParams().wrappedJSObject;
      if (si.originalSubject) {
        gMsgCompose.compFields.subject = si.originalSubject;
      }
    }
  },


  replaceEditorText: function(text) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.replaceEditorText:\n");

    this.editorSelectAll();
    // Overwrite text in clipboard for security
    // (Otherwise plaintext will be available in the clipbaord)

    if (this.editor.textLength > 0) {
      this.editorInsertText("Enigmail");
    } else {
      this.editorInsertText(" ");
    }

    this.editorSelectAll();
    this.editorInsertText(text);
  },

  goAccountManager: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.goAccountManager:\n");
    EnigmailCore.getService(window);
    let currentId = null;
    let account = null;
    try {
      currentId = getCurrentIdentity();
      account = EnigmailFuncs.getAccountForIdentity(currentId);
    } catch (ex) {}
    window.openDialog("chrome://autocrypt/content/ui/editSingleAccount.xul", "", "dialog,modal,centerscreen", {
      identity: currentId,
      account: account
    });
    this.setIdentityDefaults();
  },

  onPressKeyToggleEncrypt: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.onPressKeyToggleEncrypt()\n");
    this.onButtonToggleEncrypt();
  },

  onButtonToggleEncrypt: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.onButtonToggleEncrypt()\n");
    if (!this.composeCryptoState.isAutocryptConfiguredForIdentity()) {
      EnigmailWindows.openAutocryptSettings(window, this.identity.email);
      this.fireSendFlags();
      return;
    }
    if (!this.composeCryptoState.isEncryptError()) {
      this.composeCryptoState.toggleUserChoice();
    }
    this.delayedUpdateStatusBar();
    if (this.composeCryptoState.isEncryptError()) {
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
    EnigmailLog.DEBUG(`enigmailMsgComposeOverlay.js: showMissingRecipientsDialog(): choice ${result.choice}\n`);
    return result.choice;
  },

  /**
    key function to process the final encrypt/sign/pgpmime state from all settings
    @param sendFlags: contains the sendFlags if the message is really processed. Optional, can be null
      - uses as INPUT:
         - this.sendMode
         - this.encryptByRules, this.signByRules, pgpmimeByRules
         - this.encryptForced, this.encryptSigned
      - uses as OUTPUT:
         - this.statusEncrypt, this.statusSign

    no return value
  */
  /* TODO carry over S/MIME semantics
  processFinalState: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.processFinalState()\n");

    // ------ 2. Process S/MIME status  ------
    if (gSMFields) {

      let r = this.tryEnablingSMime(encFinally, signFinally);
      if (this.statusPGPMime === ENCRYPT_STATUS.SMIME &&
        r.encFinally === ENCRYPT_STATUS.NO &&
        (this.identity.getIntAttribute("encryptionpolicy") > 0)) {

        r.encFinally = ENCRYPT_STATUS.YES;
      }

      encFinally = r.encFinally;
      signFinally = r.signFinally;

      // FIXME: check if bug 776 can be fixed here

      if (encFinally === ENCRYPT_STATUS.NO &&
        signFinally !== ENCRYPT_STATUS.FORCEYES &&
        signFinally !== ENCRYPT_STATUS.FORCENO) {

        if (this.isEnigmailEnabled() &&
          !this.identity.getBoolAttribute("sign_mail") &&
          (this.getAccDefault("signIfNotEnc") || this.identity.getIntAttribute("defaultSigningPolicy") > 0)) {
          signFinally = ENCRYPT_STATUS.YES;
          this.statusPGPMime = ENCRYPT_STATUS.UNDEF;
        } else if (this.isSmimeEnabled() &&
          this.identity.getIntAttribute("defaultSigningPolicy") === 0 &&
          this.identity.getBoolAttribute("sign_mail")) {
          signFinally = ENCRYPT_STATUS.YES;
          this.statusPGPMime = ENCRYPT_STATUS.SMIME;
        }
      }

      // update the S/MIME GUI elements
      try {
        setSecuritySettings("1");
      } catch (ex) {}

      try {
        setSecuritySettings("2");
      } catch (ex) {}
    }
  },
  */

  // process icon/strings of status bar buttons and menu entries according to final encrypt/sign/pgpmime status
  // - uses as INPUT:
  //   - this.statusEncrypt, this.statusSign
  // - uses as OUTPUT:
  //   - resulting icon symbols
  //   - this.statusEncryptStr, this.statusSignStr, this.statusPGPMimeStr, this.statusInlinePGPStr
  //   - this.statusSMimeStr
  updateStatusBar: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.updateStatusBar()\n");

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
    EnigmailLog.DEBUG(`enigmailMsgComposeOverlay.js: status: ${JSON.stringify(display_status)}\n`);

    // update encrypt icon and tooltip/menu-text
    encBroadcaster.setAttribute("encrypted", display_status.encSymbol);
    var encIcon = document.getElementById("button-enigmail-encrypt");
    if (encIcon) {
      // encIcon.setAttribute("tooltiptext", encReasonStr);
    }
    // this.setChecked("enigmail-bc-encrypt", display_status.buttonPressed);
    // this.setEnabled("menuitem-autocrypt-toggle", display_status.buttonEnabled);

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

      if (Enigmail.msg.getSecurityParams()) {
        let si = Enigmail.msg.getSecurityParams(null, true);
        let isSmime = !EnigmailMimeEncrypt.isEnigmailCompField(si);

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
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.focusChange: Enigmail.msg.determineSendFlags\n");

    if (!this.identity) {
      this.identity = getCurrentIdentity();
    }

    let fromAddr = this.identity.email;

    const autocrypt_settings = EnigmailSync.sync(EnigmailAutocrypt.getAutocryptSettingsForIdentity(fromAddr));
    if (autocrypt_settings && autocrypt_settings.is_secret) {
      EnigmailLog.DEBUG(`enigmailMsgComposeOverlay.js: determineSendFlags(): sender autocrypt settings: ${JSON.stringify(this.composeCryptoState.senderAutocryptSettings)}\n`);
      this.composeCryptoState.senderAutocryptSettings = autocrypt_settings;
    } else {
      EnigmailLog.DEBUG(`enigmailMsgComposeOverlay.js: determineSendFlags(): sender autocrypt settings: none\n`);
      this.composeCryptoState.senderAutocryptSettings = null;
    }

    let toAddrList = this.findAllRecipients();

    this.composeCryptoState.currentAutocryptRecommendation =
      EnigmailSync.sync(EnigmailAutocrypt.determineAutocryptRecommendations(toAddrList));

    // process and signal new resulting state
    this.updateStatusBar();
  },

  findAllRecipients: function() {
    var compFields = gMsgCompose.compFields;

    if (!Enigmail.msg.composeBodyReady) {
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
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setDraftStatus - enabling draft mode\n");

    // TODO
    // this.setAdditionalHeader("Autocrypt-Draft-State", draftStatus);
  },

  getSenderUserId: function() {
    var userIdValue = null;

    if (this.identity.getIntAttribute("pgpKeyMode") > 0) {
      userIdValue = this.identity.getCharAttribute("pgpkeyId");

      if (!userIdValue) {

        var mesg = EnigmailLocale.getString("composeSpecifyEmail");

        var valueObj = {
          value: userIdValue
        };

        if (EnigmailDialog.promptValue(window, mesg, valueObj)) {
          userIdValue = valueObj.value;
        }
      }

      if (userIdValue) {
        this.identity.setCharAttribute("pgpkeyId", userIdValue);

      } else {
        this.identity.setIntAttribute("pgpKeyMode", 0);
      }
    }

    if (typeof(userIdValue) != "string") {
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.getSenderUserId: type of userIdValue=" + typeof(userIdValue) + "\n");
      userIdValue = this.identity.email;
    }

    return userIdValue;
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
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: saveDraftMessage()\n");


    let doEncrypt = this.identity.getBoolAttribute("autoEncryptDrafts");

    this.setDraftStatus(doEncrypt);

    if (!doEncrypt) {
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: drafts disabled\n");

      try {
        if (EnigmailMimeEncrypt.isEnigmailCompField(Enigmail.msg.getSecurityParams())) {
          Enigmail.msg.getSecurityParams().wrappedJSObject.sendFlags = 0;
        }
      } catch (ex) {}

      return true;
    }

    let sendFlags = EnigmailConstants.SEND_PGP_MIME | EnigmailConstants.SEND_ENCRYPTED | EnigmailConstants.SAVE_MESSAGE | EnigmailConstants.SEND_ALWAYS_TRUST;

    if (this.protectHeaders) {
      sendFlags |= EnigmailConstants.ENCRYPT_HEADERS;
    }

    let fromAddr = this.identity.email;
    let userIdValue = this.getSenderUserId();
    if (userIdValue) {
      fromAddr = userIdValue;
    }

    let enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc) return true;

    if (this.isSendAsSmimeEnabled(sendFlags)) return true; // use S/MIME

    // this.notifyUser(3, EnigmailLocale.getString("msgCompose.cannotSaveDraft"), "saveDraftFailed", testErrorMsgObj.value);

    let secInfo;

    if (EnigmailMimeEncrypt.isEnigmailCompField(Enigmail.msg.getSecurityParams())) {
      secInfo = Enigmail.msg.getSecurityParams().wrappedJSObject;
    } else {
      try {
        secInfo = EnigmailMimeEncrypt.createMimeEncrypt(Enigmail.msg.getSecurityParams());
        if (secInfo) {
          Enigmail.msg.setSecurityParams(secInfo);
        }
      } catch (ex) {
        EnigmailLog.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.saveDraftMessage", ex);
        return false;
      }
    }

    secInfo.sendFlags = sendFlags;
    secInfo.UIFlags = 0;
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

  createEnigmailSecurityFields: function(oldSecurityInfo) {
    let newSecurityInfo = EnigmailMimeEncrypt.createMimeEncrypt(Enigmail.msg.getSecurityParams());

    if (!newSecurityInfo)
      throw Components.results.NS_ERROR_FAILURE;

    Enigmail.msg.setSecurityParams(newSecurityInfo);
  },

  isSendConfirmationRequired: function(sendFlags) {
    // TODO?
    return false;
  },

  compileFromAndTo: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.compileFromAndTo\n");
    let compFields = gMsgCompose.compFields;
    let toAddrList = [];
    let recList;
    let arrLen = {};

    if (!Enigmail.msg.composeBodyReady) {
      compFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
    }
    Recipients2CompFields(compFields);
    gMsgCompose.expandMailingLists();

    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: to='" + compFields.to + "'\n");
    if (compFields.to.length > 0) {
      toAddrList = EnigmailFuncs.parseEmails(compFields.to, false);
    }

    if (compFields.cc.length > 0) {
      toAddrList = toAddrList.concat(EnigmailFuncs.parseEmails(compFields.cc, false));
    }

    if (compFields.bcc.length > 0) {
      toAddrList = toAddrList.concat(EnigmailFuncs.parseEmails(compFields.bcc, false));
    }

    for (let addr of toAddrList) {
      // determine incomplete addresses --> do not attempt pEp encryption
      if (addr.email.search(/.@./) < 0) return null;
    }

    this.identity = getCurrentIdentity();
    let from = {
      email: this.identity.email,
      name: this.identity.fullName
    };
    return {
      from: from,
      toAddrList: toAddrList
    };
  },

  resetDirty: function() {
    let newSecurityInfo = null;

    if (this.dirty) {
      // make sure the sendFlags are reset before the message is processed
      // (it may have been set by a previously cancelled send operation!)

      let si = Enigmail.msg.getSecurityParams();

      if (EnigmailMimeEncrypt.isEnigmailCompField(si)) {
        si.sendFlags = 0;
        si.originalSubject = gMsgCompose.compFields.subject;
      } else {
        try {
          newSecurityInfo = EnigmailMimeEncrypt.createMimeEncrypt(si);
          if (newSecurityInfo) {
            newSecurityInfo.sendFlags = 0;
            newSecurityInfo.originalSubject = gMsgCompose.compFields.subject;

            Enigmail.msg.setSecurityParams(newSecurityInfo);
          }
        } catch (ex) {
          EnigmailLog.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.resetDirty", ex);
        }
      }
    }

    return newSecurityInfo;
  },

  determineMsgRecipients: function(is_encrypted) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.determineMsgRecipients: currentId=" + this.identity +
      ", " + this.identity.email + "\n");

    let promptSvc = EnigmailDialog.getPromptSvc();
    let fromAddr = this.identity.email;
    let toAddrList = [];
    let recList;
    let bccAddrList = [];
    let arrLen = {};
    let splitRecipients;

    let msgCompFields = gMsgCompose.compFields;

    if (msgCompFields.newsgroups) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("sendingNews"));
      return false;
    }

    var userIdValue = this.getSenderUserId();
    if (userIdValue) {
      fromAddr = userIdValue;
    }

    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.determineMsgRecipients:gMsgCompose=" + gMsgCompose + "\n");

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
        bccLC = EnigmailFuncs.stripEmail(msgCompFields.bcc).toLowerCase();
      } catch (ex) {}
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.determineMsgRecipients: BCC: " + bccLC + "\n");

      var selfBCC = this.identity.email && (this.identity.email.toLowerCase() == bccLC);

      if (selfBCC) {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.determineMsgRecipients: Self BCC\n");
        addRecipients(toAddrList, recList);

      } else if (is_encrypted) {
        // BCC and encryption

        var dummy = {
          value: null
        };

        var hideBccUsers = promptSvc.confirmEx(window,
          EnigmailLocale.getString("enigConfirm"),
          EnigmailLocale.getString("sendingHiddenRcpt"), (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_0) +
          (promptSvc.BUTTON_TITLE_CANCEL * promptSvc.BUTTON_POS_1) +
          (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_2),
          EnigmailLocale.getString("sendWithShownBcc"),
          null,
          EnigmailLocale.getString("sendWithHiddenBcc"),
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

  prepareSecurityInfo: function(sendFlags, uiFlags, rcpt, newSecurityInfo, keyMap = {}) {
    return newSecurityInfo;
  },

  encryptMsg: async function(msgSendType) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: msgSendType=" + msgSendType + "\n");

    const DeliverMode = Components.interfaces.nsIMsgCompDeliverMode;
    let promptSvc = EnigmailDialog.getPromptSvc();

    var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    // EnigSend: Handle both plain and encrypted messages below
    var isOffline = (ioService && ioService.offline);

    switch (msgSendType) {
      case DeliverMode.SaveAsDraft:
      case DeliverMode.SaveAsTemplate:
      case DeliverMode.AutoSaveAsDraft:
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: detected save draft\n");

        // saving drafts is simpler and works differently than the rest of Enigmail.
        // All rules except account-settings are ignored.
        return this.saveDraftMessage();
    }

    this.unsetAdditionalHeader("x-enigmail-draft-status");

    let msgCompFields = gMsgCompose.compFields;
    let newsgroups = msgCompFields.newsgroups; // Check if sending to any newsgroups

    if (!msgCompFields.to && !msgCompFields.cc && !msgCompFields.bcc && !newsgroups) {
      // don't attempt to send message if no recipient specified
      var bundle = document.getElementById("bundle_composeMsgs");
      EnigmailDialog.alert(window, bundle.getString("12511"));
      return false;
    }

    if (this.composeCryptoState.isEncryptError()) {
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: encrypt error on send - asking user\n");
      let result = this.showMissingRecipientsDialog('send-unencrypted');
      if (result == 'send-unencrypted') {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: user requested to send unencrypted\n");
        this.fireSendFlags();
        return true;
      } else if (result == 'send-encrypted') {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: user requested to send encrypted\n");
        this.determineSendFlags();
      } else {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: user requested to abort\n");
        this.fireSendFlags();
        return false;
      }
    }

    this.identity = getCurrentIdentity();

    if (gWindowLocked) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("windowLocked"));
      return false;
    }

    let newSecurityInfo = this.resetDirty();
    this.dirty = 1;

    let enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc) {
      var msg = EnigmailLocale.getString("sendUnencrypted");
      if (EnigmailCore.getEnigmailService() && EnigmailCore.getEnigmailService().initializationError) {
        msg = EnigmailCore.getEnigmailService().initializationError + "\n\n" + msg;
      }

      return EnigmailDialog.confirmDlg(window, msg, EnigmailLocale.getString("msgCompose.button.send"));
    }

    try {

      this.modifiedAttach = null;

      // fill fromAddr, toAddrList, bcc etc
      let rcpt = this.determineMsgRecipients(true);
      if (!rcpt) {
        return false;
      }

      // if (this.preferPgpOverSmime(sendFlags) === 0) {
        // use S/MIME
      // Attachments2CompFields(gMsgCompose.compFields); // update list of attachments
      // sendFlags = 0;
      // return true;
      // }

      // if (!this.checkProtectHeaders(this.composeCryptoState.isEncryptEnabled(), this.isEnablePgpInline)) {
      // return false;
      // }

      // ----------------------- Rewrapping code, taken from function "encryptInline"

      if (this.composeCryptoState.isEncryptEnabled()) {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: encryption enabled\n");
        if (this.composeCryptoState.enablePgpInline && !this.processed) {
          // use inline PGP
          EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: encrypting as inline\n");

          let sendInfo = {
            // sendFlags
            fromAddr: rcpt.fromAddr,
            toAddrs: rcpt.toAddrList,
            bccAddrs: rcpt.bccAddrList,
            // uiFlags
            bucketList: document.getElementById("attachmentBucket")
          };

          if (!this.encryptInline(sendInfo)) {
            return false;
          }
        }

        // Use PGP/MIME
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: encrypting as PGP/MIME\n");

        let oldSecurityInfo = Enigmail.msg.getSecurityParams();
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.prepareSecurityInfo: oldSecurityInfo = " + oldSecurityInfo + "\n");

        if (!newSecurityInfo) {
          this.createEnigmailSecurityFields(Enigmail.msg.getSecurityParams());
          newSecurityInfo = Enigmail.msg.getSecurityParams().wrappedJSObject;
        }

        newSecurityInfo.originalSubject = gMsgCompose.compFields.subject;
        newSecurityInfo.originalReferences = gMsgCompose.compFields.references;

        if (this.composeCryptoState.isEnableProtectedHeaders) {
          if (this.composeCryptoState.isEncryptEnabled()) {
            gMsgCompose.compFields.subject = "";

            if (EnigmailPrefs.getPref("protectReferencesHdr")) {
              gMsgCompose.compFields.references = "";
            }
          }

        }
        newSecurityInfo.composeCryptoState = this.composeCryptoState;
        newSecurityInfo.fromAddr = rcpt.fromAddr;

        EnigmailLog.DEBUG(`enigmailMsgComposeOverlay.js: Enigmail.msg.prepareSecurityInfo\n`);

        newSecurityInfo.fromAddr = rcpt.fromAddr;
        newSecurityInfo.toAddrs = rcpt.toAddrList;
        newSecurityInfo.bccAddrs = rcpt.bccAddrList;
      } else {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: encryption not enabled\n");
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
              EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: enabled forceMsgEncoding\n");
            }
          } catch (ex) {}
        }
      }
    } catch (ex) {
      EnigmailLog.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg", ex);
      let msg = EnigmailLocale.getString("signFailed");
      if (EnigmailCore.getEnigmailService() && EnigmailCore.getEnigmailService().initializationError) {
        msg += "\n" + EnigmailCore.getEnigmailService().initializationError;
      }
      return EnigmailDialog.confirmDlg(window, msg, EnigmailLocale.getString("msgCompose.button.sendUnencrypted"));
    }

    // The encryption process for PGP/MIME messages follows "here". It's
    // called automatically from nsMsgCompose->sendMsg().
    // registration for this is done in core.jsm: startup()

    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: deferring to pgp/mime encryption\n");
    return true;
  },

  checkProtectHeaders: function(isEncryptEnabled, isPgpInline) {
    if (isPgpInline) return true;
    if (isEncryptEnabled) {
      if ((!this.protectHeaders) && EnigmailPrefs.getPref("protectedHeaders") === 1) {
        let enableProtection = EnigmailDialog.msgBox(window, {
          dialogTitle: EnigmailLocale.getString("msgCompose.protectSubject.dialogTitle"),
          msgtext: EnigmailLocale.getString("msgCompose.protectSubject.question"),
          iconType: EnigmailConstants.ICONTYPE_QUESTION,
          button1: EnigmailLocale.getString("msgCompose.protectSubject.yesButton"),
          button2: "extra1:" + EnigmailLocale.getString("msgCompose.protectSubject.noButton")
        });

        if (enableProtection === -1) return false;

        EnigmailPrefs.setPref("protectedHeaders", enableProtection === 0 ? 2 : 0);
        this.protectHeaders = (enableProtection === 0);
      }
    }

    return true;
  },

  encryptInline: function(sendInfo) {
    // sign/encrypt message using inline-PGP

    const dce = Components.interfaces.nsIDocumentEncoder;

    var enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc) return false;

    if (gMsgCompose.composeHTML) {
      var errMsg = EnigmailLocale.getString("hasHTML");
      EnigmailDialog.alertCount(window, "composeHtmlAlertCount", errMsg);
    }

    try {
      var convert = DetermineConvertibility();
      if (convert == Components.interfaces.nsIMsgCompConvertible.No) {
        if (!EnigmailDialog.confirmDlg(window,
            EnigmailLocale.getString("strippingHTML"),
            EnigmailLocale.getString("msgCompose.button.sendAnyway"))) {
          return false;
        }
      }
    } catch (ex) {
      EnigmailLog.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptInline", ex);
    }

    try {
      if (this.getMailPref("mail.strictly_mime")) {
        if (EnigmailDialog.confirmPref(window,
            EnigmailLocale.getString("quotedPrintableWarn"), "quotedPrintableWarn")) {
          EnigmailPrefs.getPrefRoot().setBoolPref("mail.strictly_mime", false);
        }
      }
    } catch (ex) {}


    var sendFlowed;
    try {
      sendFlowed = this.getMailPref("mailnews.send_plaintext_flowed");
    } catch (ex) {
      sendFlowed = true;
    }
    var encoderFlags = dce.OutputFormatted | dce.OutputLFLineBreak;

    var wrapper = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
    var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
    var wrapWidth = 72;

    if (this.composeCryptoState.isEncryptEnabled()) {
      // signed messages only
      if (gMsgCompose.composeHTML) {
        // enforce line wrapping here
        // otherwise the message isn't signed correctly
        try {
          wrapWidth = this.getMailPref("editor.htmlWrapColumn");

          if (wrapWidth > 0 && wrapWidth < 68 && gMsgCompose.wrapLength > 0) {
            if (EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("minimalLineWrapping", [wrapWidth]))) {
              EnigmailPrefs.getPrefRoot().setIntPref("editor.htmlWrapColumn", 68);
            }
          }
          if (EnigmailPrefs.getPref("wrapHtmlBeforeSend")) {
            if (wrapWidth) {
              editor.wrapWidth = wrapWidth - 2; // prepare for the worst case: a 72 char's long line starting with '-'
              wrapper.rewrap(false);
            }
          }
        } catch (ex) {}
      } else {
        // plaintext: Wrapping code has been moved to superordinate function encryptMsg to enable interactive format switch
      }
    }

    var exitCodeObj = {};
    var statusFlagsObj = {};
    var errorMsgObj = {};
    var exitCode;

    // Get plain text
    // (Do we need to set the nsIDocumentEncoder.* flags?)
    var origText = this.editorGetContentAs("text/plain",
      encoderFlags);
    if (!origText)
      origText = "";

    if (origText.length > 0) {
      // Sign/encrypt body text

      var escText = origText; // Copy plain text for possible escaping

      if (sendFlowed && this.composeCryptoState.isSignOnly()) {
        // Prevent space stuffing a la RFC 2646 (format=flowed).

        //EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

        escText = escText.replace(/^From /gm, "~From ");
        escText = escText.replace(/^>/gm, "|");
        escText = escText.replace(/^[ \t]+$/gm, "");
        escText = escText.replace(/^ /gm, "~ ");

        //EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: escText = '"+escText+"'\n");
        // Replace plain text and get it again
        this.replaceEditorText(escText);

        escText = this.editorGetContentAs("text/plain", encoderFlags);
      }

      // Replace plain text and get it again (to avoid linewrapping problems)
      this.replaceEditorText(escText);

      escText = this.editorGetContentAs("text/plain", encoderFlags);

      //EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

      // Encrypt plaintext
      var charset = this.editorGetCharset();
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: charset=" + charset + "\n");

      // Encode plaintext to charset from unicode
      var plainText = this.composeCryptoState.isEncryptEnabled() ?
        EnigmailData.convertFromUnicode(origText, charset) :
        EnigmailData.convertFromUnicode(escText, charset);

      var cipherText = EnigmailEncryption.encryptMessage(plainText, sendInfo.encodedPrivKey, sendInfo.encodedPubKeys);

      exitCode = exitCodeObj.value;

      //EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: cipherText = '"+cipherText+"'\n");
      if (cipherText && (exitCode === 0)) {
        // Encryption/signing succeeded; overwrite plaintext

        if (gMsgCompose.composeHTML) {
          // workaround for Thunderbird bug (TB adds an extra space in front of the text)
          cipherText = "\n" + cipherText;
        } else
          cipherText = cipherText.replace(/\r\n/g, "\n");

        if ((sendInfo.sendFlags & ENCRYPT) && charset &&
          (charset.search(/^us-ascii$/i) !== 0)) {
          // Add Charset armor header for encrypted blocks
          cipherText = cipherText.replace(/(-----BEGIN PGP MESSAGE----- *)(\r?\n)/, "$1$2Charset: " + charset + "$2");
        }

        // Decode ciphertext from charset to unicode and overwrite
        this.replaceEditorText(EnigmailData.convertToUnicode(cipherText, charset));

        // Save original text (for undo)
        this.processed = {
          "origText": origText,
          "charset": charset
        };

      } else {
        // Restore original text
        this.replaceEditorText(origText);

        if (this.composeCryptoState.isEncryptEnabled()) {
          // Encryption/signing failed

          /*if (statusFlagsObj.statusMsg) {
            // check if own key is invalid
            let s = new RegExp("^(\\[GNUPG:\\] )?INV_(RECP|SGNR) [0-9]+ \\<?" + sendInfo.fromAddr + "\\>?", "m");
            if (statusFlagsObj.statusMsg.search(s) >= 0) {
              errorMsgObj.value += "\n\n" + EnigmailLocale.getString("keyError.resolutionAction");
            }
          }*/

          this.sendAborted(window, errorMsgObj);
          return false;
        }
      }
    }
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
            errorMsg += EnigmailLocale.getString("keyNotTrusted", [key]) + "\n";
          } else if (reason == "1") {
            errorMsg += EnigmailLocale.getString("keyNotFound", [key]) + "\n";
          } else if (reason == "4") {
            errorMsg += EnigmailLocale.getString("keyRevoked", [key]) + "\n";
          } else if (reason == "5") {
            errorMsg += EnigmailLocale.getString("keyExpired", [key]) + "\n";
          }
        }
      }
      if (errorMsg !== "") {
        txt = errorMsg + "\n" + txt;
      }
      EnigmailDialog.info(window, EnigmailLocale.getString("sendAborted") + txt);
    } else {
      EnigmailDialog.info(window, EnigmailLocale.getString("sendAborted") + "\n" +
        EnigmailLocale.getString("msgCompose.internalError"));
    }
  },


  getMailPref: function(prefName) {
    let prefRoot = EnigmailPrefs.getPrefRoot();

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
      EnigmailLog.ERROR("enigmailMsgComposeOverlay.js: Enigmail.msg.getMailPref: unknown prefName:" + prefName + " \n");
    }

    return prefValue;
  },

  messageSendCheck: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.messageSendCheck\n");

    try {
      var warn = this.getMailPref("mail.warn_on_send_accel_key");

      if (warn) {
        var checkValue = {
          value: false
        };
        var bundle = document.getElementById("bundle_composeMsgs");
        var buttonPressed = EnigmailDialog.getPromptSvc().confirmEx(window,
          bundle.getString('sendMessageCheckWindowTitle'),
          bundle.getString('sendMessageCheckLabel'), (EnigmailDialog.getPromptSvc().BUTTON_TITLE_IS_STRING * EnigmailDialog.getPromptSvc().BUTTON_POS_0) +
          (EnigmailDialog.getPromptSvc().BUTTON_TITLE_CANCEL * EnigmailDialog.getPromptSvc().BUTTON_POS_1),
          bundle.getString('sendMessageCheckSendButtonLabel'),
          null, null,
          bundle.getString('CheckMsg'),
          checkValue);
        if (buttonPressed !== 0) {
          return false;
        }
        if (checkValue.value) {
          EnigmailPrefs.getPrefRoot().setBoolPref("mail.warn_on_send_accel_key", false);
        }
      }
    } catch (ex) {}

    return true;
  },


  /**
   * set non-standard message Header
   * (depending on TB version)
   *
   * hdr: String: header type (e.g. X-Enigmail-Version)
   * val: String: header data (e.g. 1.2.3.4)
   */
  setAdditionalHeader: function(hdr, val) {
    if ("otherRandomHeaders" in gMsgCompose.compFields) {
      // TB <= 36
      gMsgCompose.compFields.otherRandomHeaders += hdr + ": " + val + "\r\n";
    } else {
      gMsgCompose.compFields.setHeader(hdr, val);
    }
  },

  unsetAdditionalHeader: function(hdr) {
    if ("otherRandomHeaders" in gMsgCompose.compFields) {
      // TB <= 36
      let h = gMsgCompose.compFields.otherRandomHeaders;
      let r = new RegExp("^(" + hdr + ":)(.*)$", "im");
      let m = h.replace(r, "").replace(/(\r\n)+/, "\r\n");
      gMsgCompose.compFields.otherRandomHeaders = m;
    } else {
      gMsgCompose.compFields.deleteHeader(hdr);
    }
  },

  modifyCompFields: async function() {
    try {
      if (!this.identity) {
        this.identity = getCurrentIdentity();
      }

      await this.setAutocryptHeader();
    } catch (ex) {
      EnigmailLog.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.modifyCompFields", ex);
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
      fromMail = EnigmailFuncs.stripEmail(gMsgCompose.compFields.from);
    } catch (ex) {}

    let autocrypt_header_content = await EnigmailAutocrypt.getAutocryptHeaderContentFor(fromMail, true);
    if (autocrypt_header_content) {
      this.setAdditionalHeader('Autocrypt', autocrypt_header_content);
    }
  },

  /**
   * Handle the 'compose-send-message' event from TB
   */
  sendMessageListener: async function(event) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.sendMessageListener\n");

    // Do nothing if a compatible version of the "SendLater" addon is installed.
    // SendLater will call te quickfix -buffer-name=list
    // handleSendMessageEvent when needed.

    try {
      if (typeof(Sendlater3Composing.callEnigmail) === "function") {
        return;
      }
    } catch (ex) {}

    await Enigmail.msg.handleSendMessageEvent(event);
  },

  /**
   * Perform handling of the compose-send-message' event from TB (or SendLater)
   */
  handleSendMessageEvent: function(event) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.handleSendMessageEvent\n");
    let msgcomposeWindow = document.getElementById("msgcomposeWindow");
    let sendMsgType = Number(msgcomposeWindow.getAttribute("msgtype"));

    if (!(this.sendProcess && sendMsgType == Components.interfaces.nsIMsgCompDeliverMode.AutoSaveAsDraft)) {
      this.sendProcess = true;
      let bc = document.getElementById("enigmail-bc-sendprocess");

      try {
        const cApi = EnigmailCryptoAPI();
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
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.sendMessageListener: sending in progress - autosave aborted\n");
      event.preventDefault();
      event.stopPropagation();
    }
    this.sendProcess = false;
  },

  toggleAccountAttr: function(attrName) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleAccountAttr('" + attrName + "')\n");

    var oldValue = this.identity.getBoolAttribute(attrName);
    this.identity.setBoolAttribute(attrName, !oldValue);

  },

  decryptQuote: function(interactive) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: " + interactive + "\n");

    if (gWindowLocked || this.processed)
      return;

    var enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc)
      return;

    const dce = Components.interfaces.nsIDocumentEncoder;
    var encoderFlags = dce.OutputFormatted | dce.OutputLFLineBreak;

    var docText = this.editorGetContentAs("text/plain", encoderFlags);

    var blockBegin = docText.indexOf("-----BEGIN PGP ");
    if (blockBegin < 0)
      return;

    // Determine indentation string
    var indentBegin = docText.substr(0, blockBegin).lastIndexOf("\n");
    var indentStr = docText.substring(indentBegin + 1, blockBegin);

    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: indentStr='" + indentStr + "'\n");

    var beginIndexObj = {};
    var endIndexObj = {};
    var indentStrObj = {};
    var blockType = EnigmailArmor.locateArmoredBlock(docText, 0, indentStr, beginIndexObj, endIndexObj, indentStrObj);
    if ((blockType != "MESSAGE") && (blockType != "SIGNED MESSAGE"))
      return;

    var beginIndex = beginIndexObj.value;
    var endIndex = endIndexObj.value;

    var head = docText.substr(0, beginIndex);
    var tail = docText.substr(endIndex + 1);

    var pgpBlock = docText.substr(beginIndex, endIndex - beginIndex + 1);
    var indentRegexp;

    if (indentStr) {
      if (indentStr == "> ") {
        // replace ">> " with "> > " to allow correct quoting
        pgpBlock = pgpBlock.replace(/^>>/gm, "> >");
      }

      // Delete indentation
      indentRegexp = new RegExp("^" + indentStr, "gm");

      pgpBlock = pgpBlock.replace(indentRegexp, "");
      //tail     =     tail.replace(indentRegexp, "");

      if (indentStr.match(/[ \t]*$/)) {
        indentStr = indentStr.replace(/[ \t]*$/gm, "");
        indentRegexp = new RegExp("^" + indentStr + "$", "gm");

        pgpBlock = pgpBlock.replace(indentRegexp, "");
      }


      // Handle blank indented lines
      pgpBlock = pgpBlock.replace(/^[ \t]*>[ \t]*$/gm, "");
      //tail     =     tail.replace(/^[ \t]*>[ \t]*$/g, "");

      // Trim leading space in tail
      tail = tail.replace(/^\s*\n/m, "\n");
    }

    if (tail.search(/\S/) < 0) {
      // No non-space characters in tail; delete it
      tail = "";
    }

    //EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: pgpBlock='"+pgpBlock+"'\n");

    var charset = this.editorGetCharset();
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: charset=" + charset + "\n");

    // Encode ciphertext from unicode to charset
    var cipherText = EnigmailData.convertFromUnicode(pgpBlock, charset);

    if ((!this.getMailPref("mailnews.reply_in_default_charset")) && (blockType == "MESSAGE")) {
      // set charset according to PGP block, if available (encrypted messages only)
      let armorHeaders = EnigmailArmor.getArmorHeaders(cipherText);

      if ("charset" in armorHeaders) {
        charset = armorHeaders.charset;
        gMsgCompose.SetDocumentCharset(charset);
      }
    }

    // Decrypt message
    var signatureObj = {};
    signatureObj.value = "";
    var exitCodeObj = {};
    var statusFlagsObj = {};
    var userIdObj = {};
    var keyIdObj = {};
    var sigDetailsObj = {};
    var errorMsgObj = {};
    var blockSeparationObj = {};
    var encToDetailsObj = {};

    var uiFlags = EnigmailConstants.UI_UNVERIFIED_ENC_OK;

    var plainText = EnigmailDecryption.decryptMessage(window, uiFlags, cipherText,
      signatureObj, exitCodeObj, statusFlagsObj,
      keyIdObj, userIdObj, sigDetailsObj,
      errorMsgObj, blockSeparationObj, encToDetailsObj);
    // Decode plaintext from charset to unicode
    plainText = EnigmailData.convertToUnicode(plainText, charset).replace(/\r\n/g, "\n");
    if (EnigmailPrefs.getPref("keepSettingsForReply")) {
      this.composeCryptoState.isReplyToOpenPgpEncryptedMessage = true;
    }

    var exitCode = exitCodeObj.value;

    if (exitCode !== 0) {
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
          EnigmailDialog.info(window, displayMsg);
      }
    }

    if (blockType == "MESSAGE" && exitCode === 0 && plainText.length === 0) {
      plainText = " ";
    }

    if (!plainText) {
      if (blockType != "SIGNED MESSAGE")
        return;

      // Extract text portion of clearsign block
      plainText = EnigmailArmor.extractSignaturePart(pgpBlock, EnigmailConstants.SIGNATURE_TEXT);
    }

    const nsIMsgCompType = Components.interfaces.nsIMsgCompType;
    var doubleDashSeparator = EnigmailPrefs.getPref("doubleDashSeparator");
    if (gMsgCompose.type != nsIMsgCompType.Template &&
      gMsgCompose.type != nsIMsgCompType.Draft &&
      doubleDashSeparator) {
      var signOffset = plainText.search(/[\r\n]-- +[\r\n]/);

      if (signOffset < 0 && blockType == "SIGNED MESSAGE") {
        signOffset = plainText.search(/[\r\n]--[\r\n]/);
      }

      if (signOffset > 0) {
        // Strip signature portion of quoted message
        plainText = plainText.substr(0, signOffset + 1);
      }
    }

    var clipBoard = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
    var data;
    if (clipBoard.supportsSelectionClipboard()) {
      // get the clipboard contents for selected text (X11)
      data = EnigmailClipboard.getClipboardContent(window, Components.interfaces.nsIClipboard.kSelectionClipboard);
    }

    // Replace encrypted quote with decrypted quote (destroys selection clipboard on X11)
    this.editorSelectAll();

    //EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: plainText='"+plainText+"'\n");

    if (head)
      this.editorInsertText(head);

    var quoteElement;

    if (indentStr) {
      quoteElement = this.editorInsertAsQuotation(plainText);

    } else {
      this.editorInsertText(plainText);
    }

    if (tail)
      this.editorInsertText(tail);

    if (statusFlagsObj.value & EnigmailConstants.DECRYPTION_OKAY) {
      this.checkInlinePgpReply(head, tail);
    }

    if (clipBoard.supportsSelectionClipboard()) {
      // restore the clipboard contents for selected text (X11)
      EnigmailClipboard.setClipboardContent(data, clipBoard.kSelectionClipboard);
    }

    if (interactive)
      return;

    // Position cursor
    var replyOnTop = 1;
    try {
      replyOnTop = this.identity.replyOnTop;
    } catch (ex) {}

    if (!indentStr || !quoteElement)
      replyOnTop = 1;

    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: replyOnTop=" + replyOnTop + ", quoteElement=" + quoteElement + "\n");

    var nsISelectionController = Components.interfaces.nsISelectionController;

    if (this.editor.selectionController) {
      var selection = this.editor.selectionController;
      selection.completeMove(false, false); // go to start;

      switch (replyOnTop) {
        case 0:
          // Position after quote
          this.editor.endOfDocument();
          if (tail) {
            for (let cPos = 0; cPos < tail.length; cPos++) {
              selection.characterMove(false, false); // move backwards
            }
          }
          break;

        case 2:
          // Select quote

          if (head) {
            for (let cPos = 0; cPos < head.length; cPos++) {
              selection.characterMove(true, false);
            }
          }
          selection.completeMove(true, true);
          if (tail) {
            for (let cPos = 0; cPos < tail.length; cPos++) {
              selection.characterMove(false, true); // move backwards
            }
          }
          break;

        default:
          // Position at beginning of document

          if (this.editor) {
            this.editor.beginningOfDocument();
          }
      }

      this.editor.selectionController.scrollSelectionIntoView(nsISelectionController.SELECTION_NORMAL,
        nsISelectionController.SELECTION_ANCHOR_REGION,
        true);
    }

    this.updateStatusBar();
  },

  checkInlinePgpReply: function(head, tail) {
    const CT = Components.interfaces.nsIMsgCompType;
    if (!this.identity) return;

    let hLines = (head.search(/[^\s>]/) < 0 ? 0 : 1);

    if (hLines > 0) {
      switch (gMsgCompose.type) {
        case CT.Reply:
        case CT.ReplyAll:
        case CT.ReplyToSender:
        case CT.ReplyToGroup:
        case CT.ReplyToSenderAndGroup:
        case CT.ReplyToList:
          {
            // if head contains at only a few line of text, we assume it's the
            // header above the quote (e.g. XYZ wrote:) and the user's signature

            let h = head.split(/\r?\n/);
            hLines = -1;

            for (let i = 0; i < h.length; i++) {
              if (h[i].search(/[^\s>]/) >= 0) hLines++;
            }
          }
      }
    }

    if (hLines > 0 && (!this.identity.sigOnReply || this.identity.sigBottom)) {
      // display warning if no signature on top of message
      this.displayPartialEncryptedWarning();
    } else if (hLines > 10) {
      this.displayPartialEncryptedWarning();
    } else if (tail.search(/[^\s>]/) >= 0 && !(this.identity.sigOnReply && this.identity.sigBottom)) {
      // display warning if no signature below message
      this.displayPartialEncryptedWarning();
    }
  },

  editorInsertText: function(plainText) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertText\n");
    if (this.editor) {
      var mailEditor;
      try {
        mailEditor = this.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
        mailEditor.insertTextWithQuotations(plainText);
      } catch (ex) {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertText: no mail editor\n");
        this.editor.insertText(plainText);
      }
    }
  },

  editorInsertAsQuotation: function(plainText) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertAsQuotation\n");
    if (this.editor) {
      var mailEditor;
      try {
        mailEditor = this.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
      } catch (ex) {}

      if (!mailEditor)
        return 0;

      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertAsQuotation: mailEditor=" + mailEditor + "\n");

      mailEditor.insertAsCitedQuotation(plainText, "", false);

      return 1;
    }
    return 0;
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
        accessKey: EnigmailLocale.getString("msgCompose.detailsButton.accessKey"),
        label: EnigmailLocale.getString("msgCompose.detailsButton.label"),
        callback: function(aNotificationBar, aButton) {
          EnigmailDialog.info(window, detailsText);
        }
      });
    }
    notif.appendNotification(msgText, messageId, null, prio, buttonArr);
  },

  /**
   * Display a warning message if we are replying to or forwarding
   * a partially decrypted inline-PGP email
   */
  displayPartialEncryptedWarning: function() {
    let msgLong = EnigmailLocale.getString("msgCompose.partiallyEncrypted.inlinePGP");

    this.notifyUser(1, EnigmailLocale.getString("msgCompose.partiallyEncrypted.short"), "notifyPartialDecrypt", msgLong);
  },

  editorSelectAll: function() {
    if (this.editor) {
      this.editor.selectAll();
    }
  },

  editorGetCharset: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorGetCharset\n");
    return this.editor.documentCharacterSet;
  },

  editorGetContentAs: function(mimeType, flags) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorGetContentAs\n");
    if (this.editor) {
      return this.editor.outputToString(mimeType, flags);
    }

    return null;
  },

  addrOnChangeTimer: null,

  addressOnChange: function(element) {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.addressOnChange\n");
    if (!this.addrOnChangeTimer) {
      var self = this;
      this.addrOnChangeTimer = EnigmailTimer.setTimeout(function _f() {
        self.fireSendFlags();
        self.addrOnChangeTimer = null;
      }, Enigmail.msg.addrOnChangeTimeout);
    }
  },

  focusChange: function() {
    // call original TB function
    CommandUpdate_MsgCompose();

    var focusedWindow = top.document.commandDispatcher.focusedWindow;

    // we're just setting focus to where it was before
    if (focusedWindow == Enigmail.msg.lastFocusedWindow) {
      // skip
      return;
    }

    Enigmail.msg.lastFocusedWindow = focusedWindow;

    Enigmail.msg.fireSendFlags();
  },

  fireSendFlags: function() {
    try {
      EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.fireSendFlags\n");
      if (!this.determineSendFlagId) {
        let self = this;
        this.determineSendFlagId = EnigmailTimer.setTimeout(
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


Enigmail.composeStateListener = {
  NotifyComposeFieldsReady: function() {
    // Note: NotifyComposeFieldsReady is only called when a new window is created (i.e. not in case a window object is reused).
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.NotifyComposeFieldsReady\n");

    try {
      Enigmail.msg.editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditor);
    } catch (ex) {}

    if (!Enigmail.msg.editor)
      return;

    Enigmail.msg.fixMessageSubject();

    function enigDocStateListener() {}

    enigDocStateListener.prototype = {
      QueryInterface: function(iid) {
        if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
          !iid.equals(Components.interfaces.nsISupports))
          throw Components.results.NS_ERROR_NO_INTERFACE;

        return this;
      },

      NotifyDocumentCreated: function() {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentCreated\n");
      },

      NotifyDocumentWillBeDestroyed: function() {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: EDSL.enigDocStateListener.NotifyDocumentWillBeDestroyed\n");
      },

      NotifyDocumentStateChanged: function(nowDirty) {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: EDSL.enigDocStateListener.NotifyDocumentStateChanged\n");
      }
    };

    var docStateListener = new enigDocStateListener();

    Enigmail.msg.editor.addDocumentStateListener(docStateListener);
  },

  ComposeProcessDone: function(aResult) {
    // Note: called after a mail was sent (or saved)
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: " + aResult + "\n");

    if (aResult != Components.results.NS_OK) {
      if (Enigmail.msg.processed) {
        Enigmail.msg.undoEncryption(4);
      }
    }

    // ensure that securityInfo is set back to S/MIME flags (especially required if draft was saved)
    if (gSMFields) Enigmail.msg.setSecurityParams(gSMFields);
  },

  NotifyComposeBodyReady: function() {
    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady\n");

    var isEmpty,
      isEditable;

    isEmpty = Enigmail.msg.editor.documentIsEmpty;
    isEditable = Enigmail.msg.editor.isDocumentEditable;
    Enigmail.msg.composeBodyReady = true;

    EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady: isEmpty=" + isEmpty + ", isEditable=" + isEditable + "\n");

    // TODO still needed?
    if (Enigmail.msg.disableSmime) {
      if (gMsgCompose && gMsgCompose.compFields && Enigmail.msg.getSecurityParams()) {
        let si = Enigmail.msg.getSecurityParams(null, true);
        si.signMessage = false;
        si.requireEncryptMessage = false;
      } else {
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady: could not disable S/MIME\n");
      }
    }

    if (!isEditable || isEmpty)
      return;

    let msgHdr = Enigmail.msg.getMsgHdr();
    if (msgHdr) {
      Enigmail.msg.setOriginalSubject(msgHdr.subject, true);
    }
    Enigmail.msg.fixMessageSubject();

    if (!Enigmail.msg.timeoutId && !Enigmail.msg.dirty) {
      Enigmail.msg.timeoutId = EnigmailTimer.setTimeout(function() {
          Enigmail.msg.decryptQuote(false);
        },
        0);
    }

  },

  SaveInFolderDone: function(folderURI) {
    //EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: ECSL.SaveInFolderDone\n");
  }
};


/**
 * Unload Enigmail for update or uninstallation
 */
Enigmail.composeUnload = function _unload_Enigmail() {
  window.removeEventListener("unload-autocrypt", Enigmail.boundComposeUnload, false);
  window.removeEventListener("load-autocrypt", Enigmail.boundComposeStartup, false);
  window.removeEventListener("compose-window-unload", Enigmail.boundMsgComposeClose, true);
  window.removeEventListener('compose-send-message', Enigmail.boundSendMessageListener, true);

  gMsgCompose.UnregisterStateListener(Enigmail.composeStateListener);

  let msgId = document.getElementById("msgIdentityPopup");
  if (msgId) {
    msgId.removeEventListener("command", Enigmail.msg.setIdentityCallback, false);
  }

  let subj = document.getElementById("msgSubject");
  subj.removeEventListener('focus', Enigmail.msg.fireSendFlags, false);

  // check rules for status bar icons on each change of the recipients
  let rep = new RegExp("; Enigmail.msg.addressOnChange\\(this\\);");
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

  // finally unload Enigmail entirely
  Enigmail = undefined;
};

function addRecipients(toAddrList, recList) {
  for (var i = 0; i < recList.length; i++) {
    try {
      toAddrList.push(EnigmailFuncs.stripEmail(recList[i].replace(/[",]/g, "")));
    } catch (ex) {}
  }
  return toAddrList;
}

Enigmail.boundComposeStartup = Enigmail.msg.composeStartup.bind(Enigmail.msg);
Enigmail.boundComposeUnload = Enigmail.composeUnload.bind(Enigmail.msg);
Enigmail.boundMsgComposeClose = Enigmail.msg.msgComposeClose.bind(Enigmail.msg);
Enigmail.boundSendMessageListener = Enigmail.msg.sendMessageListener.bind(Enigmail.msg);

window.addEventListener("load-autocrypt", Enigmail.boundComposeStartup, false);
window.addEventListener("unload-autocrypt", Enigmail.boundComposeUnload, false);
window.addEventListener('compose-window-unload', Enigmail.boundMsgComposeClose, true);
window.addEventListener('compose-send-message', Enigmail.boundSendMessageListener, true);
