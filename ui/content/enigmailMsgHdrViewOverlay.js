// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgHdrViewOverlay");

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

if (messageHeaderSink) {
    // Modify the onStartHeaders method of the object
    // messageHeaderSink in msgHdrViewOverlay.js to use the pref
    // "extensions.enigmail.show_headers" instead of "mail.show_headers"

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

      DEBUG_LOG("enigmailMsgHdrViewOverlay.js: messageHeaderSink.onStartHeaders: END\n");
    }

}
