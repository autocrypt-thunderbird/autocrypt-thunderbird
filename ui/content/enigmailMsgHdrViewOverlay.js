// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailMsgHdrViewOverlay");

function enigStartHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigStartHeaders\n");

  var enigmailBox = document.getElementById("expandedEnigmailBox");
  var statusText  = document.getElementById("expandedEnigmailStatusText");

  statusText.setAttribute("value", "");
  enigmailBox.setAttribute("collapsed", "true");

  if (EnigGetPref("autoDecrypt")) {
    var msgFrame = window.frames["messagepane"];
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");
    msgFrame.addEventListener("load", enigMessageDecrypt, false);
    msgFrame.addEventListener("unload", enigMessengerUnload, false);
  }
}

function enigEndHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigEndHeaders\n");
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

// "Commented out" for future use
if (0 && messageHeaderSink) {
    // Modify the onStartHeaders method of the object
    // messageHeaderSink in msgHdrViewOverlay.js to use the pref
    // "extensions.enigmail.show_headers" instead of "mail.show_headers"

    //dump("messageHeaderSink="+messageHeaderSink+"\n");

    messageHeaderSink.onStartHeaders = function()
    {
      DEBUG_LOG("enigmailMsgHdrViewOverlay.js: messageHeaderSink.onStartHeaders\n");

      // clear out any pending collected address timers...
      if (gCollectAddressTimer)
      {
        gCollectAddess = "";        
        clearTimeout(gCollectAddressTimer);
        gCollectAddressTimer = null;
      }

      // every time we start to redisplay a message, check the view all headers pref....
      var showAllHeadersPref = pref.getIntPref("mail.show_headers");
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
      ClearAttachmentTreeList();
      ClearEditMessageButton();

      for (index in gMessageListeners)
        gMessageListeners[index].onStartHeaders();
    }

}
