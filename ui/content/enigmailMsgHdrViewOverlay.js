// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgHdrViewOverlay");

window.addEventListener("load", enigHdrViewLoad, false);

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

}

function enigStartHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigStartHeaders\n");

  var enigmailBox = document.getElementById("expandedEnigmailBox");

  if (enigmailBox && !enigmailBox.collapsed) {
    enigmailBox.setAttribute("collapsed", "true");

    var statusText = document.getElementById("expandedEnigmailStatusText");

    if (statusText)
      statusText.setAttribute("value", "");
  }

  var msgFrame = window.frames["messagepane"];

  if (msgFrame) {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");

    msgFrame.addEventListener("unload", enigMessageUnload, false);

    if (EnigGetPref("autoDecrypt"))
      msgFrame.addEventListener("load", enigMessageDecrypt, false);
  }
}

function enigEndHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigEndHeaders\n");
}

function enigUpdateHdrIcons(statusFlags) {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigUpdateHdrIcons\n");

  if (!gSMIMEContainer)
    return;

  try {
    gSMIMEContainer.collapsed = false;
    gSignedUINode.collapsed = false;
    gEncryptedUINode.collapsed = false;

    if ((statusFlags & nsIEnigmail.GOOD_SIGNATURE) &&
        (statusFlags & nsIEnigmail.TRUSTED_IDENTITY) ) {
      // Display trusted good signature icon
      gSignedUINode.setAttribute("signed", "ok");
      //gStatusBar.setAttribute("signed", "ok");

    } else if (statusFlags & (nsIEnigmail.GOOD_SIGNATURE |
                              nsIEnigmail.BAD_SIGNATURE |
                              nsIEnigmail.UNVERIFIED_SIGNATURE) ) {
      // Display untrusted/bad signature icon
      gSignedUINode.setAttribute("signed", "notok");
      //gStatusBar.setAttribute("signed", "notok");
    }

    if (statusFlags & nsIEnigmail.DECRYPTED_MESSAGE) {
      // Display encrypted icon
      gEncryptedUINode.setAttribute("encrypted", "ok");
      //gStatusBar.setAttribute("encrypted", "ok");

    } else {
      // Display un-encrypted icon
      //gEncryptedUINode.setAttribute("encrypted", "notok");
      //gStatusBar.setAttribute("encrypted", "notok");
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

addEventListener('messagepane-loaded', enigMsgHdrViewLoad, true);

// THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js

var fEnigOpenAttachment;
if (openAttachment) {
  fEnigOpenAttachment = openAttachment;
  openAttachment = function (contentType, url, displayName, messageUri)
    {
      DEBUG_LOG("enigmailMsgHdrViewOverlay.js: openAttachment: "+contentType+"\n");

      if (contentType.search(/^message\/rfc822/i) == 0) {
        // Reset mail.show_headers pref to "original" value
        EnigShowHeadersAll(true);
      }

      fEnigOpenAttachment(contentType, url, displayName, messageUri);
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
      dump("securityInfo="+this.securityInfo+"\n");

      var innerSMIMEHeaderSink = null;
      var enigMimeHeaderSink = null;

      try {
        innerSMIMEHeaderSink = securityInfo.QueryInterface(Components.interfaces.nsIMsgSMIMEHeaderSink);
        dump("innerSMIMEHeaderSink="+innerSMIMEHeaderSink+"\n");

        try {
          enigMimeHeaderSink = innerSMIMEHeaderSink.QueryInterface(Components.interfaces.nsIEnigMimeHeaderSink);
          dump("enigMimeHeaderSink="+enigMimeHeaderSink+"\n");
        } catch (ex) {}
      } catch (ex) {}

      if (!enigMimeHeaderSink) {
        this.securityInfo = new EnigMimeHeaderSink(innerSMIMEHeaderSink);
      }

      dump("securityInfo="+this.securityInfo+"\n");

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
    //DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.QI\n");
    if (iid.equals(Components.interfaces.nsIMsgSMIMEHeaderSink) &&
        this._smimeHeaderSink)
      return this;

    if (iid.equals(Components.interfaces.nsIEnigMimeHeaderSink) ||
        iid.equals(Components.interfaces.nsISupports) )
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  updateSecurityStatus: function(statusFlags, briefStatusMsg, expandedStatusMsg)
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: statusFlags="+statusFlags+", "+briefStatusMsg+"\n");

    enigUpdateHdrIcons(statusFlags);

    return;
  },

  maxWantedNesting: function()
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.maxWantedNesting:\n");
    return _smimeHeaderSink.maxWantedNesting();
  },

  signedStatus: function(aNestingLevel, aSignatureStatus, aSignerCert)
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.signedStatus:\n");
    return _smimeHeaderSink.signedStatus(aNestingLevel, aSignatureStatus, aSignerCert);
  },

  encryptionStatus: function(aNestingLevel, aEncryptionStatus, aRecipientCert)
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.encryptionStatus:\n");
    return _smimeHeaderSink.encryptionStatus(aNestingLevel, aEncryptionStatus, aRecipientCert);
  }

};
