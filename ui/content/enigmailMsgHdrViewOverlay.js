/*
The contents of this file are subject to the Mozilla Public
License Version 1.1 (the "MPL"); you may not use this file
except in compliance with the MPL. You may obtain a copy of
the MPL at http://www.mozilla.org/MPL/

Software distributed under the MPL is distributed on an "AS
IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
implied. See the MPL for the specific language governing
rights and limitations under the MPL.

The Original Code is Enigmail.

The Initial Developer of the Original Code is Ramalingam Saravanan.
Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.

Contributor(s):
Patrick Brunschwig <patrick.brunschwig@gmx.net>

Alternatively, the contents of this file may be used under the
terms of the GNU General Public License (the "GPL"), in which case
the provisions of the GPL are applicable instead of
those above. If you wish to allow use of your version of this
file only under the terms of the GPL and not to allow
others to use your version of this file under the MPL, indicate
your decision by deleting the provisions above and replace them
with the notice and other provisions required by the GPL.
If you do not delete the provisions above, a recipient
may use your version of this file under either the MPL or the
GPL.
*/

// Uses: chrome://enigmail/content/enigmailCommon.js
// (already loaded by enigmailMessengerOverlay(!))

window.addEventListener("load", enigHdrViewLoad, false);
addEventListener('messagepane-unloaded', enigHdrViewUnload, true);

var gEnigStatusBar;

function enigHdrViewLoad()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigHdrViewLoad\n");

  // Override SMIME ui
  var signedHdrElement = document.getElementById("signedHdrIcon");
  if (signedHdrElement) {
    signedHdrElement.setAttribute("onclick", "enigViewSecurityInfo(event, true);");
    signedHdrElement.setAttribute("context", "enigSecurityContext");
  }

  var encryptedHdrElement = document.getElementById("encryptedHdrIcon");
  if (encryptedHdrElement) {
    encryptedHdrElement.setAttribute("onclick", "enigViewSecurityInfo(event, true);");
    encryptedHdrElement.setAttribute("context", "enigSecurityContext");
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

    msgFrame.addEventListener("unload", enigMessageUnload, true);

    if (EnigGetPref("autoDecrypt"))
      msgFrame.addEventListener("load", enigMessageDecrypt, false);
  }

  enigForgetEncryptedURI();

  if (messageHeaderSink)
    try {
      messageHeaderSink.enigPrepSecurityInfo();
    }
    catch (ex) {}
}


function enigEndHeaders()
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigEndHeaders\n");
  gEnigStatusBar.removeAttribute("signed");
  gEnigStatusBar.removeAttribute("encrypted");
}

function enigBeforeStartHeaders() {
  return true;
}

function enigUpdateHdrIcons(exitCode, statusFlags, keyId, userId, errorMsg) {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigUpdateHdrIcons: exitCode="+exitCode+", statusFlags="+statusFlags+", keyId="+keyId+", userId="+userId+", "+errorMsg+"\n");

  gEnigLastEncryptedURI = GetLoadedMessage();
  userId=EnigConvertGpgToUnicode(userId);
  errorMsg=EnigConvertGpgToUnicode(errorMsg);
  
  var errorLines="";
  var fullStatusInfo=errorMsg;
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

  if ((exitCode == 0 ||
       (statusFlags & nsIEnigmail.DISPLAY_MESSAGE)) &&
        !(statusFlags & (nsIEnigmail.UNVERIFIED_SIGNATURE |
          nsIEnigmail.IMPORTED_KEY))) {
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

  } else if (statusFlags & nsIEnigmail.IMPORTED_KEY) {
    EnigAlert(errorMsg);

  } else {
    statusInfo = EnigGetString("failedDecryptVerify");
    statusLine = statusInfo + EnigGetString("viewInfo");
    statusInfo += "\n\n" + errorMsg;
  }


  if (statusFlags & nsIEnigmail.DECRYPTION_OKAY ||
      (gEnigStatusBar.getAttribute("encrypted")=="ok")) {
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

  if (EnigGetPref("displayPartiallySigned")) {
    if (statusFlags & nsIEnigmail.PARTIALLY_PGP) {
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
  }
  
  gEnigSecurityInfo = { statusFlags: statusFlags,
                        keyId: keyId,
                        userId: userId,
                        statusLine: statusLine,
                        statusInfo: statusInfo,
                        fullStatusInfo: fullStatusInfo };

  var enigmailBox = document.getElementById("expandedEnigmailBox");
  var statusText  = document.getElementById("expandedEnigmailStatusText");

  if (statusLine) {
    statusText.firstChild.data= statusLine +" ";
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
    //  gEnigStatusBar.removeAttribute("signed");
    //  statusText.setAttribute("class", "enigmailHeaderBoxLabelSignatureOk");
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
      // gEnigStatusBar.removeAttribute("encrypted");
    }

  } catch (ex) {}
}

function enigDispSecurityContext() {
  var optList = ["pgpSecurityInfo", "copySecurityInfo", "showPhoto"];
  for (var j=0; j<optList.length; j++) {
    var menuElement = document.getElementById("enigmail_"+optList[j]);
    if (gEnigSecurityInfo) {
      menuElement.removeAttribute("disabled");
    }
    else {
      menuElement.setAttribute("disabled", "true");
    }
  }

  if (gEnigSecurityInfo) {
    if (! (gEnigSecurityInfo.statusFlags & nsIEnigmail.PHOTO_AVAILABLE)) {
      document.getElementById("enigmail_showPhoto").setAttribute("disabled", "true");
    }
  }
}

function enigMsgHdrViewLoad(event)
{
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewLoad\n");

  var listener = {};
  listener.onStartHeaders = enigStartHeaders;
  listener.onEndHeaders = enigEndHeaders;
  listener.beforeStartHeaders = enigBeforeStartHeaders;
  gMessageListeners.push(listener);
}

function enigMessageUnload() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMessageUnload\n");
}

function enigHdrViewUnload() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigHdrViewUnLoad\n");
  enigForgetEncryptedURI();
}

function enigCopyStatusInfo() {

  if (gEnigSecurityInfo) {
    var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);
    clipHelper.copyString(gEnigSecurityInfo.fullStatusInfo);
  }

}

function enigShowPhoto() {

  if (! gEnigSecurityInfo)
    return

  var enigmailSvc = GetEnigmailSvc();
  if (enigmailSvc) {
    var exitCodeObj = new Object();
    var errorMsgObj = new Object();
    var photoPath = enigmailSvc.showKeyPhoto("0x"+gEnigSecurityInfo.keyId, exitCodeObj, errorMsgObj);
    if (photoPath && exitCodeObj.value==0) {
      var photoFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
      photoFile.initWithPath(photoPath);
      if (! (photoFile.isFile() && photoFile.isReadable())) {
        EnigAlert("Photo path '"+photoPath+"' is not readable");
      }
      else {
        var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        var photoUri = ioServ.newFileURI(photoFile).spec;
        var argsObj = {
          photoUri: photoUri,
          userId: gEnigSecurityInfo.userId,
          keyId: gEnigSecurityInfo.keyId
        };
        window.openDialog("chrome://enigmail/content/enigmailDispPhoto.xul",photoUri, "chrome,modal=1,resizable=1,dialog=1,centerscreen", argsObj);
        try {
          // delete the photo file
          photoFile.remove(false);
        }
        catch (ex) {}
     }
    }
    else {
      EnigAlert("No Photo available");
    }
  }
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

function enigMsgHdrViewHide() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewHide\n");
  var enigmailBox = document.getElementById("expandedEnigmailBox");
  enigmailBox.collapsed=true;
  gEnigSecurityInfo = { statusFlags: 0,
                      keyId: "",
                      userId: "",
                      statusLine: "",
                      statusInfo: "",
                      fullStatusInfo: "" };


}

function enigMsgHdrViewUnhide() {
  DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigMsgHdrViewUnhide\n");
  if (gEnigSecurityInfo.statusFlags != 0) {
    var enigmailBox = document.getElementById("expandedEnigmailBox");
    enigmailBox.collapsed=false;
  }
}


addEventListener('messagepane-loaded', enigMsgHdrViewLoad, true);
addEventListener('messagepane-hide', enigMsgHdrViewHide, true);
addEventListener('messagepane-unhide', enigMsgHdrViewUnhide, true);

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

    if (this.enigDetermineHeadersPref())
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

  }

  messageHeaderSink.enigDetermineHeadersPref = function ()
  {
    var headersPref = 1;
    if (EnigGetPref("parseAllHeaders")) {
      headersPref = EnigGetPref("show_headers");
    } else try {
      headersPref = gEnigPrefRoot.getIntPref("mail.show_headers");
    } catch (ex) {}

    return (headersPref == 2);
  }

  messageHeaderSink.enigPrepSecurityInfo = function ()
  {
    DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigPrepSecurityInfo\n");
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
