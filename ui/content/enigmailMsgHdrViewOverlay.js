// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgHdrViewOverlay");

window.addEventListener("load", enigHdrViewLoad, false);
addEventListener('messagepane-unloaded', enigHdrViewUnload, true);

var gEnigStatusBar;

function enigHdrViewLoad()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigHdrViewLoad\n");

  // Override SMIME ui
  var signedHdrElement = document.getElementById("signedHdrIcon");
  if (signedHdrElement) {
    signedHdrElement.setAttribute("onclick", "enigViewSecurityInfo();");
  }

  var encryptedHdrElement = document.getElementById("encryptedHdrIcon");
  if (encryptedHdrElement) {
    encryptedHdrElement.setAttribute("onclick", "enigViewSecurityInfo();");
  }

  gEnigStatusBar = document.getElementById("enigmail-status-bar");
}

function enigStartHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigStartHeaders\n");

  gEnigStatusBar.removeAttribute("signed");
  gEnigStatusBar.removeAttribute("encrypted");

  var enigmailBox = document.getElementById("expandedEnigmailBox");

  if (enigmailBox && !enigmailBox.collapsed) {
    enigmailBox.setAttribute("collapsed", "true");

    var statusText = document.getElementById("expandedEnigmailStatusText");

    if (statusText)
      statusText.firstChild.data="*";
  }

  var msgFrame = EnigGetFrame(window, "messagepane");

  if (msgFrame) {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");

    msgFrame.addEventListener("unload", enigMessageUnload, false);

    if (EnigGetPref("autoDecrypt"))
      msgFrame.addEventListener("load", enigMessageDecrypt, false);
  }

  enigForgetEncryptedURI();
}


function enigEndHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigEndHeaders\n");
  gEnigStatusBar.removeAttribute("signed");
  gEnigStatusBar.removeAttribute("encrypted");
}

function enigUpdateHdrIcons(exitCode, statusFlags, keyId, userId, errorMsg) {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigUpdateHdrIcons: exitCode="+exitCode+", statusFlags="+statusFlags+", keyId="+keyId+", userId="+userId+", "+errorMsg+"\n");

  gEnigLastEncryptedURI = GetLoadedMessage();

  var errorLines="";
  if (errorMsg)
     errorLines = errorMsg.split(/\r?\n/);

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

  if (statusFlags & nsIEnigmail.NODATA) {
    if (statusFlags & nsIEnigmail.PGP_MIME_SIGNED)
      statusFlags |= nsIEnigmail.UNVERIFIED_SIGNATURE;

    if (statusFlags & nsIEnigmail.PGP_MIME_ENCRYPTED)
      statusFlags |= nsIEnigmail.DECRYPTION_INCOMPLETE;
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

  if ((exitCode == 0 &&
        !(statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) ||
       (statusFlags & nsIEnigmail.DISPLAY_MESSAGE)) {
    // Normal exit / display message
    statusInfo = errorMsg;
    statusLine = errorMsg;

  } else if (keyId) {
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

  } else {
    statusInfo = EnigGetString("failedDecryptVerify");
    statusLine = statusInfo + EnigGetString("viewInfo");
    statusInfo += "\n\n" + errorMsg;
  }

  if (statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
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

  var PARTIALLY_PGP = nsIEnigmail.INLINE_KEY << 1;
  if (statusFlags & PARTIALLY_PGP) {
    if  (msgSigned && msgEncrypted) {
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

  gEnigSecurityInfo = { statusFlags: statusFlags,
                        keyId: keyId,
                        userId: userId,
                        statusLine: statusLine,
                        statusInfo: statusInfo };

  var enigmailBox = document.getElementById("expandedEnigmailBox");
  var statusText  = document.getElementById("expandedEnigmailStatusText");

  if (statusLine) {
    statusText.firstChild.data= statusLine;
    enigmailBox.removeAttribute("collapsed");

  } else {
    statusText.firstChild.data= "*";
    enigmailBox.setAttribute("collapsed", "true");
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
      statusText.setAttribute("class", "enigmailHeaderBoxLabelSignatureNotOk");
      gEnigStatusBar.setAttribute("signed", "notok");
    }
    else if ((statusFlags & nsIEnigmail.GOOD_SIGNATURE) &&
        (statusFlags & nsIEnigmail.TRUSTED_IDENTITY) &&
        !(statusFlags & (nsIEnigmail.REVOKED_KEY |
                       nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                       nsIEnigmail.EXPIRED_SIGNATURE))) {
      // Display trusted good signature icon
      gSignedUINode.setAttribute("signed", "ok");
      statusText.setAttribute("class", "enigmailHeaderBoxLabelSignatureOk");
      gEnigStatusBar.setAttribute("signed", "ok");
    }
    else if (statusFlags & (nsIEnigmail.UNVERIFIED_SIGNATURE |
                       nsIEnigmail.REVOKED_KEY |
                       nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                       nsIEnigmail.EXPIRED_SIGNATURE |
                       nsIEnigmail.GOOD_SIGNATURE)) {
      // Display unverified signature icon
      gSignedUINode.setAttribute("signed", "unknown");
      statusText.setAttribute("class", "enigmailHeaderBoxLabelSignatureUnknown");
      gEnigStatusBar.setAttribute("signed", "unknown");
    }
    else {
      gEnigStatusBar.removeAttribute("signed");
    }

    if (statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
      var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
      if (enigMimeService)
      {
        enigMimeService.rememberEncrypted(gEnigLastEncryptedURI);
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
    }
    else {
      gEnigStatusBar.removeAttribute("encrypted");
    }

  } catch (ex) {}
}

function enigMsgHdrViewLoad(event)
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewLoad\n");

  var listener = {};
  listener.onStartHeaders = enigStartHeaders;
  listener.onEndHeaders = enigEndHeaders;
  gMessageListeners.push(listener);
}

function enigMessageUnload() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: MessageUnload\n");
}

function enigHdrViewUnload() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigHdrViewUnLoad\n");
  enigForgetEncryptedURI();
}

function enigForgetEncryptedURI()
{
  if (gEnigLastEncryptedURI)
  {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
    if (enigMimeService) {
      enigMimeService.forgetEncrypted(gEnigLastEncryptedURI);
      gEnigLastEncryptedURI = null;
    }
  }
}

addEventListener('messagepane-loaded', enigMsgHdrViewLoad, true);

// THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js


var fEnigOpenAttachment;
try {
  // Mozilla <= 1.5
  if (openAttachment) {
    fEnigOpenAttachment = openAttachment;
    openAttachment = function (msg) {
      DEBUG_LOG("enigmailMsgHdrViewOverlay.js: openAttachment: "+msg.contentType+"\n");

      if (msg.contentType.search(/^message\/rfc822/i) == 0) {
        // Reset mail.show_headers pref to "original" value
        EnigShowHeadersAll(false);
      }

      fEnigOpenAttachment(msg);
    }
  }
} catch (ex) {
  // Mozilla >= 1.6a
  if (createNewAttachmentInfo.prototype.openAttachment) {
    createNewAttachmentInfo.prototype.origOpenAttachment = createNewAttachmentInfo.prototype.openAttachment;
    createNewAttachmentInfo.prototype.openAttachment = function () {
      if (this.contentType.search(/^message\/rfc822/i) == 0) {
        // Reset mail.show_headers pref to "original" value
        EnigShowHeadersAll(false);
      }
      
      this.origOpenAttachment();
    }

  }
}


if (messageHeaderSink) {
    // Modify the methods onStartHeaders, getSecurityinfo, setSecurityInfo
    // of the object messageHeaderSink in msgHdrViewOverlay.js.
    // Use the pref "extensions.enigmail.show_headers"
    // instead of "mail.show_headers"

    //dump("messageHeaderSink="+messageHeaderSink+"\n");

    messageHeaderSink.onStartHeaders = function()
    {
      DEBUG_LOG("enigmailMsgHdrViewOverlay.js: messageHeaderSink.onStartHeaders: START\n");

      // clear out any pending collected address timers...
      if (gCollectAddressTimer)
      {
        gCollectAddess = "";        
        clearTimeout(gCollectAddressTimer);
        gCollectAddressTimer = null;
      }

      // every time we start to redisplay a message, check the view all headers pref....
      // MODIFIED CODE FOR ENIGMAIL
      var showAllHeadersPref = 1;
      if (EnigGetPref("parseAllHeaders")) {
         showAllHeadersPref = EnigGetPref("show_headers");
      } else try {
         showAllHeadersPref = gEnigPrefRoot.getIntPref("mail.show_headers");
      } catch (ex) {}

      // END OF MODIFIED CODE FOR ENIGMAIL

      if (showAllHeadersPref == 2)
      {
        gViewAllHeaders = true;
      }
      else
      {
        if (gViewAllHeaders) // if we currently are in view all header mode, rebuild our header view so we remove most of the header data
        {
          hideHeaderView(gExpandedHeaderView);
          gExpandedHeaderView = {};
          initializeHeaderViewTables(); 
        }
                
        gViewAllHeaders = false;
      }

      ClearCurrentHeaders();
      gBuiltExpandedView = false;
      gBuiltCollapsedView = false;
      gBuildAttachmentsForCurrentMsg = false;
      gBuildAttachmentPopupForCurrentMsg = true;
      ClearAttachmentList();
      ClearEditMessageButton();

      for (index in gMessageListeners)
        gMessageListeners[index].onStartHeaders();

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

      DEBUG_LOG("enigmailMsgHdrViewOverlay.js: messageHeaderSink.onStartHeaders: END\n");
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

  updateSecurityStatus: function(uriSpec, exitCode, statusFlags, keyId, userId, errorMsg)
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: uriSpec="+uriSpec+"\n");

    var msgUriSpec = enigGetCurrentMsgUriSpec();

    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: msgUriSpec="+msgUriSpec+"\n");

    if (!uriSpec || (uriSpec == msgUriSpec)) {
      enigUpdateHdrIcons(exitCode, statusFlags, keyId, userId, errorMsg);
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

