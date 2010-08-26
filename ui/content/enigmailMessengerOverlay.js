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

// Initialize enigmailCommon
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

Components.utils.import("resource://app/modules/gloda/mimemsg.js");


var gEnigCreatedURIs = [];

var gEnigDecryptedMessage;
var gEnigSecurityInfo = null;
var gEnigLastSaveDir = "";

var gEnigMessagePane = null;
var gEnigNoShowReload = false;
var gEnigLastEncryptedMsgKey = null;
var gEnigDecryptButton = null;
var gEnigIpcRequest = null;

var gEnigRemoveListener = false;

var gEnigHeadersList = ["content-type", "content-transfer-encoding",
                        "x-enigmail-version"];
var gEnigSavedHeaders = null;

var gShowHeadersObj = {"viewallheaders":2,
                       "viewnormalheaders":1,
                       "viewbriefheaders":0};

window.addEventListener("load",   enigMessengerStartup, false);
window.addEventListener("unload", enigMessengerFinish,  false);

var gEnigTreeController = {
  supportsCommand: function(command) {
    // DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: supportsCommand: "+command+"\n");
    switch(command) {
    case "button_enigmail_decrypt":
      return true;
    }
    return false;
  },
  isCommandEnabled: function(command) {
    // DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: isCommandEnabled: "+command+"\n");
    try {
      if (gFolderDisplay.messageDisplay.visible) {
        if (gFolderDisplay.selectedCount != 1) enigStatusBarHide();
        return (gFolderDisplay.selectedCount == 1);
      }
      enigStatusBarHide();
    }
    catch (ex) {}
    return  false;
  },
  doCommand: function(command) {
    //DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: doCommand: "+command+"\n");
    // nothing
  },
  onEvent: function(event) {
    // DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: onEvent: "+command+"\n");
    // nothing
  }
}

function enigMessengerStartup() {

  gEnigMessagePane = document.getElementById("messagepane");

  if (gEnigMessagePane == null) return; // TB 2.0 on Mac OS X calls this twice -- once far too early

  DEBUG_LOG("enigmailMessengerOverlay.js: Startup\n");
  EnigInitCommon("enigmailMessengerOverlay");
  // enigUpdateOptionsDisplay();

  // Override SMIME ui
  var viewSecurityCmd = document.getElementById("cmd_viewSecurityStatus");
  if (viewSecurityCmd) {
    viewSecurityCmd.setAttribute("oncommand", "enigViewSecurityInfo(null, true);");
  }

  // Override print command
  var printElementIds = ["cmd_print", "cmd_printpreview", "key_print", "button-print",
                         "mailContext-print", "mailContext-printpreview"];

  EnigOverrideAttribute( printElementIds, "oncommand",
                         "enigMsgPrint('", "');");

  enigOverrideLayoutChange();

  gEnigSavedHeaders = null;

  gEnigDecryptButton = document.getElementById("button-enigmail-decrypt");

  var toolbarElem = document.getElementById("mail-bar2");
  if (toolbarElem && EnigGetOS() == "Darwin") {
    toolbarElem.setAttribute("platform", "macos");
  }

  enigMessageFrameLoad();

  // Need to add event listener to gEnigMessagePane to make it work
  // Adding to msgFrame doesn't seem to work
  gEnigMessagePane.addEventListener("unload", enigMessageFrameUnload, true);
  gEnigMessagePane.addEventListener("load", enigMessageFrameLoad, true);

  if (EnigGetPref("handleDoubleClick")) {
    // ovveride function for double clicking an attachment
    EnigOverrideAttribute(["attachmentList"], "onclick",
                        "enigAttachmentListClick('", "', event);");
  }

  top.controllers.appendController(gEnigTreeController);
}

function enigMessengerFinish() {
  DEBUG_LOG("enigmailMessengerOverlay.js: Finish\n");
}


function enigViewSecurityInfo(event, displaySmimeMsg) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigViewSecurityInfo\n");

  if (event && event.button != 0)
    return;

  if (gSignatureStatus >= 0 || gEncryptionStatus >= 0) {
    showMessageReadSecurityInfo()
  }
  else {
    if (gEnigSecurityInfo)
      enigViewOpenpgpInfo()
    else
      showMessageReadSecurityInfo();
  }
}

function enigViewOpenpgpInfo() {
  if (gEnigSecurityInfo) {
    EnigLongAlert(EnigGetString("securityInfo")+gEnigSecurityInfo.statusInfo);
  }
}


function enigMessageReload(noShowReload) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageReload: "+noShowReload+"\n");

  gEnigNoShowReload = noShowReload;

  ReloadMessage();
}

function enigmailReloadCompleteMsg() {
  gDBView.reloadMessageWithAllParts();
}


function enigMessageCleanup() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageCleanup\n");

  var enigmailBox = document.getElementById("enigmailBox");

  if (enigmailBox && !enigmailBox.collapsed) {
    enigmailBox.setAttribute("collapsed", "true");

    var statusText = document.getElementById("expandedEnigmailStatusText");

    if (statusText)
      statusText.value="";
  }

  if (gEnigCreatedURIs.length) {
    // Cleanup messages belonging to this window (just in case)
    var enigmailSvc = GetEnigmailSvc();
    if (enigmailSvc) {
      DEBUG_LOG("enigmailMessengerOverlay.js: Cleanup: Deleting messages\n");
      for (var index=0; index < gEnigCreatedURIs.length; index++) {
        enigmailSvc.deleteMessageURI(gEnigCreatedURIs[index]);
      }
      gEnigCreatedURIs = [];
    }
  }

  gEnigDecryptedMessage = null;
  gEnigSecurityInfo = null;
}

function enigMimeInit() {
  DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit\n");

  try {
    const ENIG_ENIGCONTENTHANDLER_CID =
      Components.ID("{847b3a51-7ab1-11d4-8f02-006008948af5}");

    const ENIG_ENIGENCRYPTEDHANDLER_CONTRACTID = "@mozilla.org/mimecth;1?type=multipart/encrypted";

    var compMgr = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);

    var enigContentHandlerCID = compMgr.contractIDToCID(ENIG_ENIGENCRYPTEDHANDLER_CONTRACTID);

    var handlePGPMime = (enigContentHandlerCID.toString() ==
                     ENIG_ENIGCONTENTHANDLER_CID);

    DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: handlePGPMime="+handlePGPMime+"\n");

  } catch (ex) {}



  if (gEnigRemoveListener) {
    gEnigMessagePane.removeEventListener("load", enigMimeInit, true);
    gEnigRemoveListener = false;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
     return;

  if (enigmailSvc.mimeInitialized()) {
    // Reload message ONLY if enigMimeService has been initialized;
    // enigMimeInit is only called if enigMimeService was not initialized;
    // this prevents looping.
    DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: RELOADING MESSAGE\n");

    enigMessageReload(false);

  } else {
    // Error in MIME initialization; forget saved headers (to avoid looping)
    gEnigSavedHeaders = null;
    ERROR_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: Error in MIME initialization\n");
  }
}

function enigMessageFrameLoad() {
  // called before a message is displayed
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageFrameLoad\n");
  // not used anymore (-> gEnigTreeController)
}


function enigMessageFrameUnload() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageFrameUnload\n");

  if (gEnigNoShowReload) {
    gEnigNoShowReload = false;

  } else {
    gEnigSavedHeaders = null;

    enigMessageCleanup();
  }
}

function enigThreadPaneOnClick() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigThreadPaneOnClick\n");
}

function enigOverrideLayoutChange() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigOverrideLayoutChange\n");
  var viewTypeElementIds = ["messagePaneVertical",
                            "messagePaneClassic",
                            "messagePaneWide"];
  for (var i = 0; i < viewTypeElementIds.length; i++) {
    var elementId = viewTypeElementIds[i];
    var element = document.getElementById(elementId);
    if (element) {
      try {
        var oldValue = element.getAttribute("oncommand").replace(/;/g, "");
        var arg=oldValue.replace(/^(.*)(\(.*\))/, "$2");
        element.setAttribute("oncommand", "enigChangeMailLayout"+arg);
      } catch (ex) {}
    }
  }

  var toggleMsgPaneElementIds = ["cmd_toggleMessagePane"];
  for (var i = 0; i < toggleMsgPaneElementIds.length; i++) {
    var elementId = toggleMsgPaneElementIds[i];
    var element = document.getElementById(elementId);
    if (element) {
      try {
        element.setAttribute("oncommand", "enigToggleMessagePane()");
      } catch (ex) {}
    }
  }

}

function enigChangeMailLayout(viewType) {
  ChangeMailLayout(viewType);

  // This event requires that we re-subscribe to these events!
  gEnigMessagePane.addEventListener("unload", enigMessageFrameUnload, true);
  gEnigMessagePane.addEventListener("load", enigMessageFrameLoad, true);
  enigMessageReload(false);
}

function enigToggleMessagePane() {
  enigStatusBarHide();
  MsgToggleMessagePane(true);

  var button=document.getElementById("button_enigmail_decrypt")
  if (gFolderDisplay.messageDisplay.visible) {
    button.removeAttribute("disabled");
  }
  else {
    button.setAttribute("disabled", "true");
  }
}

function enigGetCurrentMsgUriSpec() {
  try {
    if (gFolderDisplay.selectedMessages.length != 1)
      return "";

    var uriSpec = gFolderDisplay.selectedMessageUris[0];
    //DEBUG_LOG("enigmailMessengerOverlay.js: enigGetCurrentMsgUrl: uriSpec="+uriSpec+"\n");

    return uriSpec;

  } catch (ex) {
    return "";
  }
}

function enigGetCurrentMsgUrl() {
  var uriSpec = enigGetCurrentMsgUriSpec();
  return enigGetUrlFromUriSpec(uriSpec);
}

function enigGetUrlFromUriSpec(uriSpec) {
  try {

    if (!uriSpec)
      return null;

    var msgService = messenger.messageServiceFromURI(uriSpec);

    var urlObj = new Object();
    msgService.GetUrlForUri(uriSpec, urlObj, msgWindow);

    var url = urlObj.value;

    if (url.scheme=="file") {
      return url;
    }
    else {
      return url.QueryInterface(Components.interfaces.nsIMsgMailNewsUrl);
    }

  } catch (ex) {
    return null;
  }


}

function enigUpdateOptionsDisplay() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigUpdateOptionsDisplay: \n");
  var optList = ["autoDecrypt"];

  for (var j=0; j<optList.length; j++) {
    var menuElement = document.getElementById("enigmail_"+optList[j]);
    menuElement.setAttribute("checked", EnigGetPref(optList[j]) ? "true" : "false");
  }

  optList = ["decryptverify", "importpublickey", "savedecrypted"];
  for (j=0; j<optList.length; j++) {
    menuElement = document.getElementById("enigmail_"+optList[j]);
    if (gEnigDecryptButton && gEnigDecryptButton.disabled) {
       menuElement.setAttribute("disabled", "true");
    }
    else {
       menuElement.removeAttribute("disabled");
    }
  }
}


function enigToggleAttribute(attrName)
{
  DEBUG_LOG("enigmailMsgessengerOverlay.js: enigToggleAttribute('"+attrName+"')\n");

  var menuElement = document.getElementById("enigmail_"+attrName);

  var oldValue = EnigGetPref(attrName);
  EnigSetPref(attrName, !oldValue);

  enigUpdateOptionsDisplay();

  if (attrName == "autoDecrypt")
    enigMessageReload(false);
}

function enigMessageImport(event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageImport: "+event+"\n");


  return enigMessageParse(!event, true, "", enigGetCurrentMsgUriSpec());
}

// callback function for automatic decryption
function enigMessageAutoDecrypt(event) {
  enigMessageDecrypt(event, true);
}

// analyse message header and decrypt/verify message
function enigMessageDecrypt(event, isAuto) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: "+event+"\n");

  var cbObj = {
    event: event,
    isAuto: isAuto
  };

  try {
    MsgHdrToMimeMessage(gFolderDisplay.selectedMessage , cbObj, enigMsgDecryptMimeCb, true);
  }
  catch (ex) {
    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: cannot use MsgHdrToMimeMessage\n");
    enigMessageDecryptCb(event, isAuto, null);
  }
}


function enigMsgDecryptMimeCb(msg, mimeMsg) {
  var enigmailSvc=GetEnigmailSvc();
  if (!enigmailSvc) return;

  enigMessageDecryptCb(this.event, this.isAuto, mimeMsg);
}


function enigEnumerateMimeParts(mimePart, resultObj) {
  DEBUG_LOG("enigEnumParts: "+mimePart.partName+" - "+mimePart.headers["content-type"]+"\n");

  // does not work properly because MsgHdrToMimeMessage() cannot [yet] handle inner parts of encrypted messages

  var ct = mimePart.headers["content-type"][0];
  if (typeof(ct) == "string") {
    if (ct.search(/multipart\/signed.*application\/pgp-signature/i) >= 0) {
      resultObj.signed=mimePart.partName;
    }
    else if (ct.search(/application\/pgp-encrypted/i) >= 0)
      resultObj.encrypted=mimePart.partName;
  }

  var i;
  for (i in mimePart.parts) {
    enigEnumerateMimeParts(mimePart.parts[i], resultObj);
  }
}


function enigMessageDecryptCb(event, isAuto, mimeMsg){
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCb:\n");

  try {
    var showHeaders = 0;
    var contentType = "";

    if (mimeMsg == null) {
      DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCb: mimeMsg is null\n");
      contentType=currentHeaderData['content-type'].headerValue;
      mimeMsg = {
        headers: {'content-type': contentType },
        contentType: contentType,
        parts: null
      }
    }

    // Copy selected headers
    gEnigSavedHeaders = {};

    for (var index=0; index < gEnigHeadersList.length; index++) {
      var headerName = gEnigHeadersList[index];
      var headerValue = "";

      if (mimeMsg.headers[headerName] != undefined) {
        headerValue = mimeMsg.headers[headerName].toString();
      }

      gEnigSavedHeaders[headerName] = headerValue;
      DEBUG_LOG("enigmailMessengerOverlay.js: header "+headerName+": "+headerValue+"\n");
    }

    var embeddedSigned = null;
    var embeddedEncrypted = null;

    /*
    if (mimeMsg.parts != null) {
      var resultObj={ encrypted: "", signed: "" };
      enigEnumerateMimeParts(mimeMsg, resultObj);
      DEBUG_LOG("embedded: "+resultObj.encrypted+" / "+resultObj.signed+"\n");
    }
    */
    if (gEnigSavedHeaders["content-type"] &&
        ((gEnigSavedHeaders["content-type"].search(/^multipart\/mixed/i) == 0) ||
         (gEnigSavedHeaders["content-type"].search(/^multipart\/encrypted/i) == 0))) {
      for (var indexb in currentAttachments) {
        var attachment = currentAttachments[indexb];

        if (attachment) {
          if (attachment.contentType.search(/^application\/pgp-signature/i) == 0) {
            if (! attachment.isExternalAttachment)
              embeddedSigned = attachment.url.replace(/\&filename=.*$/,"").replace(/\.\d+\.\d+$/, "");
          }
          if (attachment.contentType.search(/^application\/pgp-encrypted/i) == 0) {
            if (! attachment.isExternalAttachment)
              embeddedEncrypted = attachment.url.replace(/\&filename=.*$/,"").replace(/\.\d+\.\d+$/, "");
          }
          DEBUG_LOG("enigmailMessengerOverlay.js: mimePart "+indexb+": "+attachment.contentType+"\n");
        }
      }
    }

    DEBUG_LOG("Got here\n");

    var contentEncoding = "";
    var xEnigmailVersion = "";
    var msgUriSpec = enigGetCurrentMsgUriSpec();

    if (gEnigSavedHeaders) {
      contentType      = gEnigSavedHeaders["content-type"];
      contentEncoding  = gEnigSavedHeaders["content-transfer-encoding"];
      xEnigmailVersion = gEnigSavedHeaders["x-enigmail-version"];
    }

    if (isAuto && (! EnigGetPref("autoDecrypt"))) {
      var signedMsg = ((contentType.search(/^multipart\/signed(;|$)/i) == 0) && (contentType.search(/application\/pgp-signature/i)>0));
      var encrypedMsg = ((contentType.search(/^multipart\/encrypted(;|$)/i) == 0) && (contentType.search(/application\/pgp-encrypted/i)>0));
      if (embeddedSigned || embeddedEncrypted ||
          encrypedMsg || signedMsg) {
        enigmailSvc = GetEnigmailSvc();
        if (!enigmailSvc)
          return;

        if ((!enigmailSvc.mimeInitialized() && encrypedMsg) || signedMsg ||
            ((!encrypedMsg) && (embeddedSigned || embeddedEncrypted))) {
          enigUpdateHdrIcons(ENIG_POSSIBLE_PGPMIME, 0, "", "", "", EnigGetString("possiblyPgpMime"));
        }
      }
      return;
    }

    if (((contentType.search(/^multipart\/encrypted(;|$)/i) == 0) ||
        (embeddedEncrypted && contentType.search(/^multipart\/mixed(;|$)/i) == 0))
         && (!embeddedSigned)) {
      // multipart/encrypted
      DEBUG_LOG("enigmailMessengerOverlay.js: multipart/encrypted\n");
      enigmailSvc = GetEnigmailSvc();
      if (!enigmailSvc)
        return;

      if (!enigmailSvc.mimeInitialized()) {
        // Display enigmail:dummy URL in message pane to initialize

        // Need to add event listener to gEnigMessagePane to make it work
        // Adding to msgFrame doesn't seem to work
        gEnigMessagePane.addEventListener("load", enigMimeInit, true);
        gEnigRemoveListener = true;

        DEBUG_LOG("enigmailMessengerOverlay.js: loading enigmail:dummy ...\n");
        gEnigNoShowReload = true;

        var msgFrame = EnigGetFrame(window, "messagepane");
        messenger.loadURL(msgFrame, "enigmail:dummy");

      }
      else if (! isAuto) {
        enigMessageReload(false);
      }
      else if (embeddedEncrypted && (! encrypedMsg)) {
        var mailNewsUrl = enigGetCurrentMsgUrl();
        if (mailNewsUrl) {
          mailNewsUrl.spec = embeddedEncrypted;
          enigVerifyEmbeddedMsg(window, mailNewsUrl, msgWindow, msgUriSpec, contentEncoding, event);
        }
      }

      return;
    }

    var tryVerify = false;
    var enableSubpartTreatment = false;
    // special treatment for embedded signed messages
    if (embeddedSigned) {
      if (contentType.search(/^multipart\/encrypted(;|$)/i) == 0) {
        tryVerify = true;
      }
      if (contentType.search(/^multipart\/mixed(;|$)/i) == 0) {
        tryVerify = true;
        enableSubpartTreatment = true;
      }
    }

    if ((contentType.search(/^multipart\/signed(;|$)/i) == 0) &&
         (contentType.search(/application\/pgp-signature/i) >= 0)) {
      tryVerify=true;
    }
    if (tryVerify) {
      // multipart/signed
      DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCb: multipart/signed\n");

      enigmailSvc = GetEnigmailSvc();
      if (!enigmailSvc)
        return;

      var mailNewsUrl = enigGetCurrentMsgUrl();
      if (mailNewsUrl) {
          DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCb: mailNewsUrl:"+mailNewsUrl+"\n");
          DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecryptCb: msgUriSpec:"+msgUriSpec+"\n");
        if (embeddedSigned) {
          mailNewsUrl.spec = embeddedSigned;
          enigVerifyEmbeddedMsg(window, mailNewsUrl, msgWindow, msgUriSpec, contentEncoding, event);
        }
        else {

          var verifier = Components.classes[ENIG_ENIGMIMEVERIFY_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeVerify);

          verifier.init(window, mailNewsUrl, msgWindow, msgUriSpec,
                        true, enableSubpartTreatment);

        }
        return;
      }
    }

    enigMessageParse(!event, false, contentEncoding, msgUriSpec);
  }
  catch (ex) {
    EnigWriteException("enigmailMessengerOverlay.js: enigMessageDecryptCb", ex);
  }
}


function enigMessageParse(interactive, importOnly, contentEncoding, msgUriSpec) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParse: "+interactive+"\n");
  var msgFrame = EnigGetFrame(window, "messagepane");
  DEBUG_LOG("enigmailMessengerOverlay.js: msgFrame="+msgFrame+"\n");


  ///EnigDumpHTML(msgFrame.document.documentElement);

  var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
  DEBUG_LOG("enigmailMessengerOverlay.js: bodyElement="+bodyElement+"\n");

  var findStr = /* interactive ? null : */ "-----BEGIN PGP";
  var msgText = null;
  var foundIndex = -1;

  if (findStr) {
    foundIndex = bodyElement.textContent.indexOf(findStr);
    if (foundIndex >= 0) {
      if (bodyElement.textContent.indexOf(findStr+" LICENSE AUTHORIZATION") == foundIndex)
        foundIndex = -1;
    }
  }
  if (foundIndex >= 0) {
    msgText = bodyElement.textContent;
  }

  if (!msgText) {
    // No PGP content
    return;
  }

  var charset = msgWindow ? msgWindow.mailCharacterSet : "";

  // Encode ciphertext to charset from unicode
  msgText = EnigConvertFromUnicode(msgText, charset);

  var mozPlainText = bodyElement.innerHTML.search(/class=\"moz-text-plain\"/);

  if ((mozPlainText >= 0) && (mozPlainText < 40)) {
    // workaround for too much expanded emoticons in plaintext msg
    var r = new RegExp(/( )(;-\)|:-\)|;\)|:\)|:-\(|:\(|:-\\|:-P|:-D|:-\[|:-\*|\>:o|8-\)|:-\$|:-X|\=-O|:-\!|O:-\)|:\'\()( )/g);
    if (msgText.search(r) >= 0) {
      DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParse: performing emoticons fixing\n");
      msgText = msgText.replace(r, "$2");
    }
  }

  // extract text preceeding and/or following armored block
  var head="";
  var tail="";
  if (findStr) {
    head=msgText.substring(0,msgText.indexOf(findStr)).replace(/^[\n\r\s]*/,"");
    head=head.replace(/[\n\r\s]*$/,"");
    var endStart=msgText.indexOf("-----END PGP");
    var nextLine=msgText.substring(endStart).search(/[\n\r]/);
    if (nextLine>0) {
      tail=msgText.substring(endStart+nextLine).replace(/^[\n\r\s]*/,"");
    }
  }

  //DEBUG_LOG("enigmailMessengerOverlay.js: msgText='"+msgText+"'\n");

  var mailNewsUrl = enigGetUrlFromUriSpec(msgUriSpec);

  var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

  retry = (charset != "UTF-8" ? 1 : 2);

  enigMessageParseCallback(msgText, contentEncoding, charset, interactive,
                           importOnly, urlSpec, "", retry, head, tail, msgUriSpec);
}


function enigMessageParseCallback(msgText, contentEncoding, charset, interactive,
                                  importOnly, messageUrl, signature, retry,
                                  head, tail, msgUriSpec) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: "+interactive+", "+interactive+", importOnly="+importOnly+", charset="+charset+", msgUrl="+messageUrl+", retry="+retry+", signature='"+signature+"'\n");

  if (!msgText)
    return;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var plainText;
  var exitCode;
  var newSignature = "";
  var statusFlags = 0;

  var errorMsgObj = new Object();
  var keyIdObj    = new Object();

  if (importOnly) {
    // Import public key
    var importFlags = nsIEnigmail.UI_INTERACTIVE;
    exitCode = enigmailSvc.importKey(window, importFlags, msgText, "",
                                     errorMsgObj);

  } else {

    if (msgText.indexOf("\nCharset:") > 0) {
      // Check if character set needs to be overridden
      var startOffset = msgText.indexOf("-----BEGIN PGP ");

      if (startOffset >= 0) {
        var subText = msgText.substr(startOffset);

        subText = subText.replace(/\r\n/g, "\n");
        subText = subText.replace(/\r/g,   "\n");

        var endOffset = subText.search(/\n\n/);
        if (endOffset > 0) {
          subText = subText.substr(0,endOffset) + "\n";

          var matches = subText.match(/\nCharset: *(.*) *\n/i)
          if (matches && (matches.length > 1)) {
            // Override character set
            charset = matches[1];
            DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: OVERRIDING charset="+charset+"\n");
          }
        }
      }
    }

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var userIdObj      = new Object();
    var sigDetailsObj  = new Object();
    var blockSeparationObj = new Object();

    var signatureObj = new Object();
    signatureObj.value = signature;

    var uiFlags = interactive ? (nsIEnigmail.UI_INTERACTIVE |
                                 nsIEnigmail.UI_ALLOW_KEY_IMPORT |
                                 nsIEnigmail.UI_UNVERIFIED_ENC_OK) : 0;


    plainText = enigmailSvc.decryptMessage(window, uiFlags, msgText,
                                 signatureObj, exitCodeObj, statusFlagsObj,
                                 keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj);

    //DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: plainText='"+plainText+"'\n");

    exitCode = exitCodeObj.value;
    newSignature = signatureObj.value;

    if (plainText == "" && exitCode == 0) {
      plainText = " ";
    }

    statusFlags = statusFlagsObj.value;

    DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageParseCallback: newSignature='"+newSignature+"'\n");
  }

  var errorMsg = errorMsgObj.value;

  if (importOnly) {
     if (interactive && errorMsg)
       EnigLongAlert(errorMsg);
     return;
  }

  var displayedUriSpec = enigGetCurrentMsgUriSpec();
  if (!msgUriSpec || (displayedUriSpec == msgUriSpec)) {
    enigUpdateHdrIcons(exitCode, statusFlags, keyIdObj.value, userIdObj.value, sigDetailsObj.value, errorMsg, null);
  }

  var noSecondTry = nsIEnigmail.GOOD_SIGNATURE |
        nsIEnigmail.EXPIRED_SIGNATURE |
        nsIEnigmail.EXPIRED_KEY_SIGNATURE |
        nsIEnigmail.EXPIRED_KEY |
        nsIEnigmail.REVOKED_KEY |
        nsIEnigmail.NO_PUBKEY |
        nsIEnigmail.NO_SECKEY |
        nsIEnigmail.IMPORTED_KEY |
        nsIEnigmail.MISSING_PASSPHRASE |
        nsIEnigmail.BAD_PASSPHRASE |
        nsIEnigmail.UNKNOWN_ALGO |
        nsIEnigmail.DECRYPTION_OKAY |
        nsIEnigmail.OVERFLOWED;

  if ((exitCode !=0) && (! (statusFlags & noSecondTry))) {
    // Bad signature/armor
    if (retry == 1) {
      msgText = EnigConvertFromUnicode(msgText, "UTF-8");
      enigMessageParseCallback(msgText, contentEncoding, charset, interactive,
                               importOnly, messageUrl, signature, retry + 1,
                               head, tail, msgUriSpec);
      return;
    }
    else if (retry == 2) {
      // Try to verify signature by accessing raw message text directly
      // (avoid recursion by setting retry parameter to false on callback)
      newSignature = "";
      enigMsgDirect(interactive, importOnly, contentEncoding, charset, newSignature, 0, head, tail, msgUriSpec, enigMessageParseCallback);
      return;
    }
    else if (retry == 3) {
      msgText = EnigConvertToUnicode(msgText, "UTF-8");
      enigMessageParseCallback(msgText, contentEncoding, charset, interactive,
                               importOnly, messageUrl, null, retry + 1,
                               head, tail, msgUriSpec)
      return;
    }
  }

  if (!plainText) {
     if (interactive && gEnigSecurityInfo && gEnigSecurityInfo.statusInfo)
       EnigLongAlert(gEnigSecurityInfo.statusInfo);
     return;
  }

  if (retry >= 2) {
    plainText = EnigConvertFromUnicode(EnigConvertToUnicode(plainText, "UTF-8"), charset);
  }

  if (blockSeparationObj.value.indexOf(" ")>=0) {
    var blocks = blockSeparationObj.value.split(/ /);
    var blockInfo = blocks[0].split(/:/);
    plainText = EnigGetString("notePartEncrypted") + "\n\n" + plainText.substr(0, blockInfo[1]) + "\n\n" + EnigGetString("noteCutMessage");
  }

  // Save decrypted message status, headers, and content
  var headerList = {"subject":"", "from":"", "date":"", "to":"", "cc":""};

  var index, headerName;

  if (!gViewAllHeaders) {
    for (index = 0; index < headerList.length; index++) {
      headerList[index] = "";
    }

  } else {
    for (index = 0; index < gExpandedHeaderList.length; index++) {
      headerList[gExpandedHeaderList[index].name] = "";
    }

    for (headerName in currentHeaderData) {
      headerList[headerName] = "";
    }
  }

  for (headerName in headerList) {
    if (currentHeaderData[headerName])
      headerList[headerName] = currentHeaderData[headerName].headerValue;
  }

  // WORKAROUND
  if (headerList["cc"] == headerList["to"])
    headerList["cc"] = "";

  var hasAttachments = currentAttachments && currentAttachments.length;
  var attachmentsEncrypted=true;

  for (index in currentAttachments) {
    if (! enigCheckEncryptedAttach(currentAttachments[index])) {
      if (!enigCheckSignedAttachment(currentAttachments, index)) attachmentsEncrypted=false;
    }
  }

  var msgRfc822Text = "";
  if (head || tail) {
    if (head) {
      // print a warning if the signed or encrypted part doesn't start
      // quite early in the message
      matches=head.match(/(\n)/g);
      if (matches && matches.length >10) {
        msgRfc822Text=EnigGetString("notePartEncrypted")+"\n\n";
      }
      msgRfc822Text+=head+"\n\n";
    }
    msgRfc822Text += EnigGetString("beginPgpPart")+"\n\n";
  }
  msgRfc822Text+=plainText;
  if (head || tail) {
    msgRfc822Text+="\n\n"+EnigGetString("endPgpPart")+"\n\n"+tail;
  }

  gEnigDecryptedMessage = {url:messageUrl,
                           uri:msgUriSpec,
                           headerList:headerList,
                           hasAttachments:hasAttachments,
                           attachmentsEncrypted:attachmentsEncrypted,
                           charset:charset,
                           plainText:msgRfc822Text};

  var msgFrame = EnigGetFrame(window, "messagepane");
  var bodyElement = msgFrame.document.getElementsByTagName("body")[0];

  // don't display decrypted message if message selection has changed
  displayedUriSpec = enigGetCurrentMsgUriSpec();
  if (msgUriSpec && displayedUriSpec && (displayedUriSpec != msgUriSpec)) return;

  try {
    // Create and load one-time message URI
    var messageContent = enigGetDecryptedMessage("message/rfc822", false);

    gEnigNoShowReload = true;

    var uri = enigmailSvc.createMessageURI(messageUrl,
                                           "message/rfc822",
                                           "",
                                           messageContent,
                                           false);
    gEnigCreatedURIs.push(uri);

    //msgFrame.location=uri;
    messenger.loadURL(msgFrame, uri);

  } catch (ex) {
    // Display plain text with hyperlinks

    // Get selection range for inserting HTML
    var domSelection = msgFrame._content.getSelection();

    var privateSelection = domSelection.QueryInterface(Components.interfaces.nsISelectionPrivate);
    var selection = privateSelection.QueryInterface(Components.interfaces.nsISelection);

    selection.collapse(bodyElement, 0);
    var selRange = selection.getRangeAt(0);

    // Decode plaintext to unicode
    tail = EnigConvertToUnicode(tail, charset);
    var uniText = EnigConvertToUnicode(plainText, charset);

    var htmlText="";
    if (head) {
       htmlText += "<pre>"+enigEscapeTextForHTML(EnigConvertToUnicode(head, charset),true)+"</pre><p/>\n";
    }
    htmlText += '<table border="0" cellspacing="0" width="100%"><tbody><tr><td bgcolor="#9490FF" width="10"></td>' +
      '<td bgcolor="#9490FF" width="10"><pre>Begin Signed or Encrypted Text</pre></td></tr>\n'+
      '<tr><td bgcolor="#9490FF"></td>'+
      '<td><pre>' +
      enigEscapeTextForHTML(uniText, true) +
      '</pre></td></tr>\n' +
      '<tr><td bgcolor="#9490FF" width="10"></td>' +
      '<td bgcolor="#9490FF" width="10"><pre>End Signed or Encrypted Text</pre></td></tr>' +
      '</tbody></table>\n'

    if (tail) {
       htmlText += "<p/><pre>"+enigEscapeTextForHTML(EnigConvertToUnicode(tail, charset),true)+"</pre>";
    }

    var docFrag = selRange.createContextualFragment(htmlText);

    // Clear HTML body
    while (bodyElement.hasChildNodes())
        bodyElement.removeChild(bodyElement.childNodes[0]);

    if (hasAttachments && (! attachmentsEncrypted)) {
      var newTextNode = msgFrame.document.createTextNode(EnigGetString("enigNote"));

      var newEmElement = msgFrame.document.createElement("em");
      newEmElement.appendChild(newTextNode);

      bodyElement.appendChild(newEmElement);
      bodyElement.appendChild(msgFrame.document.createElement("p"));
    }

    bodyElement.appendChild(docFrag.firstChild);

  }

  return;
}

// check if an attachment could be signed
function enigCheckSignedAttachment(currentAttachments, index) {

  // check if filename ends with .sig
  if (currentAttachments[index].displayName.search(/\.sig$/i) > 0) return true;

  var signed = false;
  var findFile = currentAttachments[index].displayName.toLowerCase()+".sig";
  var i;
  for (i in currentAttachments) {
    if (currentAttachments[i].displayName.toLowerCase() == findFile) signed=true;
  }
  return signed;
}

// check if the attachment could be encrypted
function enigCheckEncryptedAttach(attachment) {
  return (attachment.displayName.match(/\.(gpg|pgp|asc)$/i) ||
      attachment.contentType.match(/^application\/pgp(\-.*)?$/i));
}

function enigEscapeTextForHTML(text, hyperlink) {
  // Escape special characters
  if (text.indexOf("&") > -1)
    text = text.replace(/&/g, "&amp;")

  if (text.indexOf("<") > -1)
    text = text.replace(/</g, "&lt;")

  if (text.indexOf(">") > -1)
    text = text.replace(/>/g, "&gt;")

  if (text.indexOf("\"") > -1)
    text = text.replace(/"/g, "&quot;")

  if (!hyperlink)
    return text;

  // Hyperlink email addresses
  var addrs = text.match(/\b[A-Za-z0-9_+\-\.]+@[A-Za-z0-9\-\.]+\b/g);

  var newText, offset, loc;
  if (addrs && addrs.length) {
    newText = "";
    offset = 0;

    for (var j=0; j < addrs.length; j++) {
      var addr = addrs[j];

      loc = text.indexOf(addr, offset);
      if (loc < offset)
        break;

      if (loc > offset)
        newText += text.substr(offset, loc-offset);

      // Strip any period off the end of address
      addr = addr.replace(/[\.]$/, "");

      if (!addr.length)
        continue;

      newText += "<a href=\"mailto:"+addr+"\">" + addr + "</a>";

      offset = loc + addr.length;
    }

    newText += text.substr(offset, text.length-offset);

    text = newText;
  }

  // Hyperlink URLs
  var urls = text.match(/\b(http|https|ftp):\S+\s/g);

  if (urls && urls.length) {
    newText = "";
    offset = 0;

    for (var k=0; k < urls.length; k++) {
      var url = urls[k];

      loc = text.indexOf(url, offset);
      if (loc < offset)
        break;

      if (loc > offset)
        newText += text.substr(offset, loc-offset);

      // Strip delimiters off the end of URL
      url = url.replace(/\s$/, "");
      url = url.replace(/([\),\.']|&gt;|&quot;)$/, "");

      if (!url.length)
        continue;

      newText += "<a href=\""+url+"\">" + url + "</a>";

      offset = loc + url.length;
    }

    newText += text.substr(offset, text.length-offset);

    text = newText;
  }

  return text;
}

function enigGetDecryptedMessage(contentType, includeHeaders) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigGetDecryptedMessage: "+contentType+", "+includeHeaders+"\n");

  if (!gEnigDecryptedMessage)
    return "No decrypted message found!\n";

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return "";

  var headerList = gEnigDecryptedMessage.headerList;

  var statusLine = gEnigSecurityInfo ? gEnigSecurityInfo.statusLine : "";

  var contentData = "";

  var headerName;

  if (contentType == "message/rfc822") {
    // message/rfc822

    if (includeHeaders) {
      try {

        var msg = gFolderDisplay.selectedMessage;
        if (msg) {
          msgHdr = { "From": msg.author,
                     "Subject": msg.subject,
                     "To": msg.recipients,
                     "Cc": msg.ccList,
                     "Date": EnigGetDateTime(msg.dateInSeconds, true, true) };


          if(gFolderDisplay.selectedMessageIsNews) {
            if (typeof (currentHeaderData.newsgroups)) {
              msgHdr.Newsgroups = currentHeaderData.newsgroups.headerValue;
            }
          }

          for (headerName in msgHdr) {
            if (msgHdr[headerName] && msgHdr[headerName].length>0)
              contentData += headerName + ": " + msgHdr[headerName] + "\r\n";
          }

        }
      } catch (ex) {
        // the above seems to fail every now and then
        // so, here is the fallback
        for (headerName in headerList) {
          headerValue = headerList[headerName];
          contentData += headerName + ": " + headerValue + "\r\n";
        }
      }

      contentData += "Content-Type: text/plain";

      if (gEnigDecryptedMessage.charset) {
        contentData += "; charset="+gEnigDecryptedMessage.charset;
      }

      contentData += "\r\n";
    }

    contentData += "\r\n";

    if (gEnigDecryptedMessage.hasAttachments && (! gEnigDecryptedMessage.attachmentsEncrypted)) {
      contentData += EnigGetString("enigContentNote");
    }

    contentData += gEnigDecryptedMessage.plainText;

  } else {
    // text/html or text/plain

    if (contentType == "text/html") {
      contentData += "<meta http-equiv=\"Content-Type\" content=\"text/html; charset="+gEnigDecryptedMessage.charset+"\">\r\n";

      contentData += "<html><head></head><body>\r\n";
    }

    if (statusLine) {
      if (contentType == "text/html") {
        contentData += "<b>"+EnigGetString("enigHeader")+"</b> " +
                       enigEscapeTextForHTML(statusLine, false) + "<br>\r\n<hr>\r\n";
      } else{
        contentData += EnigGetString("enigHeader")+" " + statusLine + "\r\n\r\n";
      }
    }

    if (includeHeaders) {
      for (headerName in headerList) {
        headerValue = headerList[headerName];

        if (headerValue) {
          if (contentType == "text/html") {
            contentData += "<b>"+enigEscapeTextForHTML(headerName, false)+":</b> "+
                                 enigEscapeTextForHTML(headerValue, false)+"<br>\r\n";
          } else {
            contentData += headerName + ": " + headerValue + "\r\n";
          }
        }
      }
    }

    if (contentType == "text/html") {
      contentData += "<pre>"+enigEscapeTextForHTML(gEnigDecryptedMessage.plainText, false)+"</pre>\r\n";

      contentData += "</body></html>\r\n";

    } else {

      contentData += "\r\n"+gEnigDecryptedMessage.plainText;
    }

    if (!(enigmailSvc.isDosLike)) {
      contentData = contentData.replace(/\r\n/g, "\n");
    }
  }

  return contentData;
}


function enigMsgDefaultPrint(elementId) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDefaultPrint: "+elementId+"\n");

  goDoCommand(elementId.indexOf("printpreview")>=0 ? "cmd_printpreview" : "cmd_print");
}

function enigMsgPrint(elementId) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgPrint: "+elementId+"\n");

  var contextMenu = (elementId.search("Context") > -1);

  if (!gEnigDecryptedMessage || typeof(gEnigDecryptedMessage) == "undefined") {
    enigMsgDefaultPrint(elementId);
    return;
  }

  var mailNewsUrl = enigGetCurrentMsgUrl();

  if (!mailNewsUrl) {
    enigMsgDefaultPrint(elementId);
    return
  }

  if (gEnigDecryptedMessage.url != mailNewsUrl.spec) {
    gEnigDecryptedMessage = null;
    enigMsgDefaultPrint(elementId);
    return;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    enigMsgDefaultPrint(elementId);
    return;
  }

  // Note: Trying to print text/html content does not seem to work with
  //       non-ASCII chars
  var msgContent = enigGetDecryptedMessage("message/rfc822", true);

  var uri = enigmailSvc.createMessageURI(gEnigDecryptedMessage.url,
                                         "message/rfc822",
                                         "",
                                         msgContent,
                                         false);

  gEnigCreatedURIs.push(uri);

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgPrint: uri="+uri+"\n");

  var messageList = [uri];

  var printPreview = (elementId.indexOf("printpreview")>=0);

  window.openDialog("chrome://messenger/content/msgPrintEngine.xul",
                    "",
                    "chrome,dialog=no,all,centerscreen",
                    1, messageList, statusFeedback,
                    printPreview, Components.interfaces.nsIMsgPrintEngine.MNAB_PRINTPREVIEW_MSG,
                    window);

  return true;

}

function enigMessageSave() {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageSave: \n");

  if (!gEnigDecryptedMessage) {
    EnigAlert(EnigGetString("noDecrypted"));
    return;
  }

  var mailNewsUrl = enigGetCurrentMsgUrl();

  if (!mailNewsUrl) {
    EnigAlert(EnigGetString("noMessage"));
    return;
  }

  if (gEnigDecryptedMessage.url != mailNewsUrl.spec) {
    gEnigDecryptedMessage = null;
    EnigAlert(EnigGetString("useButton"));
    return;
  }

  var saveFile = EnigFilePicker(EnigGetString("saveHeader"),
                                gEnigLastSaveDir, true, "txt",
                                null, ["Text files", "*.txt"]);
  if (!saveFile) return;

  DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageSave: path="+saveFile.path+"\n");

  if (saveFile.parent)
    gEnigLastSaveDir = EnigGetFilePath(saveFile.parent);

  var textContent = enigGetDecryptedMessage("text/plain", true);

//  EnigAlert(textContent);

  if (!EnigWriteFileContents(saveFile.path, textContent, null)) {
    EnigAlert("Error in saving to file "+saveFile.path);
    return;
  }

  return;
}

function enigMsgDirect(interactive, importOnly, contentEncoding, charset, signature, bufferSize, head, tail, msgUriSpec, callbackFunction) {
  WRITE_LOG("enigmailMessengerOverlay.js: enigMsgDirect: contentEncoding="+contentEncoding+", signature="+signature+"\n");
  var mailNewsUrl = enigGetCurrentMsgUrl();
  if (!mailNewsUrl)
    return;

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
  var mimeListener = Components.classes[ENIG_ENIGMIMELISTENER_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeListener);

  if (bufferSize > 0) {
    ipcBuffer.open(bufferSize, false);
  }
  else {
    ipcBuffer.open(ENIG_MSG_BUFFER_SIZE, false);
  }

  var callbackArg = { interactive:interactive,
                      importOnly:importOnly,
                      contentEncoding:contentEncoding,
                      charset:charset,
                      messageUrl:mailNewsUrl.spec,
                      msgUriSpec:msgUriSpec,
                      signature:signature,
                      ipcBuffer:ipcBuffer,
                      expectedBufferSize: bufferSize,
                      head:head,
                      tail:tail,
                      mimeListener: mimeListener,
                      callbackFunction: callbackFunction };

  var requestObserver = new EnigRequestObserver(enigMsgDirectCallback,
                                                callbackArg);

  ipcBuffer.observe(requestObserver, mailNewsUrl);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  var channel = ioServ.newChannelFromURI(mailNewsUrl);

  var pipeFilter = Components.classes[ENIG_PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);
  pipeFilter.init(ipcBuffer, null,
                "-----BEGIN PGP",
                "-----END PGP",
                0, true, false, null);

  var listener;

  try {

    mimeListener.init(pipeFilter, null, ENIG_MSG_HEADER_SIZE, true, false, true);

    listener = mimeListener;

  } catch (ex) {
    listener = pipeFilter;
  }

  channel.asyncOpen(pipeFilter, mailNewsUrl);
}


function enigMsgDirectCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: "+ctxt+"\n");

  var mailNewsUrl = enigGetCurrentMsgUrl();
  var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";
  var newBufferSize = 0;

  var l= urlSpec.length;

  if (urlSpec.substr(0, l) != callbackArg.messageUrl.substr(0, l)) {
    ERROR_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: Message URL mismatch "+mailNewsUrl.spec+" vs. "+callbackArg.messageUrl+"\n");
    return;
  }

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: MESSAGE BUFFER OVERFLOW\n");
    if (! callbackArg.expectedBufferSize) {
      // set correct buffer size
      newBufferSize=((callbackArg.ipcBuffer.totalBytes+1500)/1024).toFixed(0)*1024;
    }
  }

  var msgText = callbackArg.ipcBuffer.getData();
  msgText = EnigConvertFromUnicode(msgText, "UTF-8");

  callbackArg.ipcBuffer.shutdown();

  if (newBufferSize > 0) {
    // retry with correct buffer size
    enigMsgDirect(callbackArg.interactive,
                  callbackArg.importOnly,
                  callbackArg.contentEncoding,
                  callbackArg.charset,
                  callbackArg.signature,
                  newBufferSize,
                  callbackArg.head,
                  callbackArg.tail,
                  callbackArg.msgUriSpec,
                  callbackArg.callbackFunction);

  }
  DEBUG_LOG("enigmailMessengerOverlay.js: enigMsgDirectCallback: msgText='"+msgText+"'\n");

  callbackArg.callbackFunction(msgText, callbackArg.contentEncoding,
                           callbackArg.charset,
                           callbackArg.interactive,
                           callbackArg.importOnly,
                           callbackArg.messageUrl,
                           callbackArg.signature,
                           3,
                           callbackArg.head,
                           callbackArg.tail,
                           callbackArg.msgUriSpec);
}


function enigVerifyEmbeddedMsg(window, msgUrl, msgWindow, msgUriSpec, contentEncoding, event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigVerifyEmbedded: msgUrl"+msgUrl+"\n");

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
  ipcBuffer.open(ENIG_UNLIMITED_BUFFER_SIZE, false);

  var callbackArg = { ipcBuffer: ipcBuffer,
                      window: window,
                      msgUrl: msgUrl,
                      msgWindow: msgWindow,
                      msgUriSpec: msgUriSpec,
                      contentEncoding: contentEncoding,
                      event: event };

  var requestObserver = new EnigRequestObserver(enigVerifyEmbeddedCallback,
                                                callbackArg);

  ipcBuffer.observe(requestObserver, msgUrl);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  var channel = ioServ.newChannelFromURI(msgUrl);

  var pipeFilter = Components.classes[ENIG_PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);

  pipeFilter.init(ipcBuffer, null,
                "",
                "",
                0, false, false, null);

  channel.asyncOpen(pipeFilter, msgUrl);
}

function enigVerifyEmbeddedCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigVerifyEmbeddedCallback: "+ctxt+"\n");

  var txt = callbackArg.ipcBuffer.getData();
  callbackArg.ipcBuffer.shutdown();

  if (txt.length > 0) {
    msigned=txt.search(/content\-type:[ \t]*multipart\/signed/i);
    if(msigned >= 0) {
      // Real multipart/signed message; let's try to verify it
      DEBUG_LOG("enigmailMessengerOverlay.js: enigVerifyEmbeddedCallback: detected multipart/signed\n");

      callbackArg.enableSubpartTreatment=(msigned > 0);

      var uri = Components.classes[ENIG_SIMPLEURI_CONTRACTID].createInstance(Components.interfaces.nsIURI);
      uri.spec = "enigmail:dummy";

      var ipcService = Components.classes[ENIG_IPCSERVICE_CONTRACTID].getService(Components.interfaces.nsIIPCService);
      var channel = ipcService.newStringChannel(uri, "", "", txt);
      var verifier = Components.classes[ENIG_ENIGMIMEVERIFY_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeVerify);

      verifier.initWithChannel(callbackArg.window, channel, callbackArg.msgWindow, callbackArg.msgUriSpec,
                      true, callbackArg.enableSubpartTreatment);
      return;
    }
  }

  // try inline PGP
  DEBUG_LOG("enigmailMessengerOverlay.js: enigVerifyEmbeddedCallback: try inline PGP\n");

  enigMessageParse(!callbackArg.event, false, callbackArg.contentEncoding, callbackArg.msgUriSpec);
}


function enigKeyRequest(interactive, keyId, urlSpec) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequest: keyId="+keyId+", urlSpec="+urlSpec+"\n");

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

  ipcBuffer.open(ENIG_KEY_BUFFER_SIZE, false);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  try {
    var uri = ioServ.newURI(urlSpec, "", null);

    var channel = ioServ.newChannelFromURI(uri);

    var httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);

    // Disable HTTP redirection
    httpChannel.redirectionLimit = 0;

    var callbackArg = { interactive:interactive,
                        keyId:keyId,
                        urlSpec:urlSpec,
                        httpChannel:httpChannel,
                        ipcBuffer:ipcBuffer };

    var requestObserver = new EnigRequestObserver(enigKeyRequestCallback,
                                                  callbackArg);

    ipcBuffer.observe(requestObserver, null);

    DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequest: httpChannel="+httpChannel+", asyncOpen ...\n");

    httpChannel.asyncOpen(ipcBuffer, null);

  } catch (ex) {
    ERROR_LOG("enigmailMessengerOverlay.js: enigKeyRequest: Error - failed to create channel\n");
  }

}


function enigKeyRequestCallback(callbackArg, ctxt) {
  var urlSpec = callbackArg.urlSpec;
  var httpChannel = callbackArg.httpChannel;

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: urlSpec="+urlSpec+"\n");

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: KEY BUFFER OVERFLOW\n");
  }

  var eTag = httpChannel.getResponseHeader("ETag");

  var keyText = callbackArg.ipcBuffer.getData();

  callbackArg.ipcBuffer.shutdown();

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: keyText='"+keyText+"'\n");

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: NoCache='"+httpChannel.isNoCacheResponse()+"'\n");

  DEBUG_LOG("enigmailMessengerOverlay.js: enigKeyRequestCallback: ETag: "+eTag+"\n");

  // NEED TO EXTRACT KEY ETC.
}


// handle a selected attachment (decrypt & open or save)
function enigHandleAttachmentSel(actionType) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigHandleAttachmentSel: actionType="+actionType+"\n");

  var attachmentList = document.getElementById('attachmentList');
  var selectedAttachments = attachmentList.selectedItems;
  var anAttachment = selectedAttachments[0].attachment;

  switch (actionType) {
  case "saveAttachment":
  case "openAttachment":
  case "importKey":
    enigHandleAttachment(actionType, anAttachment);
  }
}


function enigHandleAttachment(actionType, anAttachment) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigHandleAttachment: actionType="+actionType+", anAttachment(url)="+anAttachment.url+"\n");

  var ipcBuffer = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

  var argumentsObj = { actionType: actionType,
                       attachment: anAttachment,
                       forceBrowser: false,
                       ipcBuffer: ipcBuffer
                     };

  var requestObserver = new EnigRequestObserver(enigDecryptAttachmentCallback,
                                                argumentsObj);

  var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

  ipcBuffer.open(ENIG_UNLIMITED_BUFFER_SIZE, false);
  var msgUri = ioServ.newURI(argumentsObj.attachment.url, null, null);

  ipcBuffer.observe(requestObserver, msgUri);

  var channel = ioServ.newChannelFromURI(msgUri);

  var pipeFilter = Components.classes[ENIG_PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);

  pipeFilter.init(ipcBuffer, null,
                "",
                "",
                0, false, false, null);

  var listener;
  listener = pipeFilter;

  channel.asyncOpen(listener, msgUri);
}


function enigDecryptAttachmentCallback(callbackArg, ctxt) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigDecryptAttachmentCallback: "+ctxt+"\n");

  if (callbackArg.ipcBuffer.overflowed) {
    WARNING_LOG("enigmailMessengerOverlay.js: enigDecryptAttachmentCallback: MESSAGE BUFFER OVERFLOW\n");
  }

  var exitCodeObj = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj= new Object();
  var exitStatus = -1;

  var enigmailSvc =  GetEnigmailSvc();
  var outFile;
  var rawFileName=callbackArg.attachment.displayName.replace(/\.(asc|pgp|gpg)$/i,"");

  if (callbackArg.actionType == "saveAttachment") {
    outFile = EnigFilePicker(EnigGetString("saveAttachmentHeader"),
                                gEnigLastSaveDir, true, "",
                                rawFileName, null);
    if (! outFile) return;
  }
  else {
    // open
    var tmpDir = EnigGetTempDir();
    try {
      outFile = Components.classes[ENIG_LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
      outFile.initWithPath(tmpDir);
      if (!(outFile.isDirectory() && outFile.isWritable())) {
        errorMsgObj.value=EnigGetString("noTempDir");
        return;
      }
      outFile.append(rawFileName);
      outFile.createUnique(Components.interfaces.NORMAL_FILE_TYPE, 0600);
    }
    catch (ex) {
      errorMsgObj.value=EnigGetString("noTempDir");
      return;
    }
  }

  if (callbackArg.actionType == "importKey") {
    try {
      var dataLength = new Object();
      var byteData = callbackArg.ipcBuffer.getByteData(dataLength);
      exitStatus = enigmailSvc.importKey(parent, 0, byteData, "", errorMsgObj);
    }
    catch (ex) {}
    if (exitStatus == 0) {
      EnigLongAlert(EnigGetString("successKeyImport")+"\n\n"+errorMsgObj.value);
    }
    else {
      EnigAlert(EnigGetString("failKeyImport")+"\n"+errorMsgObj.value);
    }

    return;
  }

  exitStatus=enigmailSvc.decryptAttachment(window, outFile,
                                callbackArg.attachment.displayName,
                                callbackArg.ipcBuffer,
                                exitCodeObj, statusFlagsObj,
                                errorMsgObj);

  callbackArg.ipcBuffer.shutdown();
  if ((! exitStatus) || exitCodeObj.value != 0) {
    exitStatus=false;
    if (statusFlagsObj.value &
        (nsIEnigmail.DECRYPTION_OKAY | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
      if (callbackArg.actionType == "openAttachment") {
        exitStatus = EnigConfirm(EnigGetString("decryptOkNoSig"), EnigGetString("msgOvl.button.contAnyway"));
      }
      else {
        EnigAlert(EnigGetString("decryptOkNoSig"));
      }
    }
    else {
      EnigAlert(EnigGetString("failedDecrypt")+"\n\n"+errorMsgObj.value);
      exitStatus=false;
    }
  }
  if (exitStatus) {
    if (statusFlagsObj.value & nsIEnigmail.IMPORTED_KEY) {
      EnigLongAlert(EnigGetString("successKeyImport")+"\n\n"+errorMsgObj.value);
    }
    else if (statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) {
      HandleSelectedAttachments('open');
    }
    else if ((statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) ||
             (callbackArg.actionType == "openAttachment")) {
      var ioServ = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
      var outFileUri = ioServ.newFileURI(outFile);
      var fileExt = outFile.leafName.replace(/(.*\.)(\w+)$/, "$2")
      if (fileExt && ! callbackArg.forceBrowser) {
        var extAppLauncher = Components.classes[ENIG_MIME_CONTRACTID].getService(Components.interfaces.nsPIExternalAppLauncher);
        extAppLauncher.deleteTemporaryFileOnExit(outFile);

        try {
          var mimeService = Components.classes[ENIG_MIME_CONTRACTID].getService(Components.interfaces.nsIMIMEService);
          var fileMimeType = mimeService.getTypeFromFile(outFile);
          var fileMimeInfo = mimeService.getFromTypeAndExtension(fileMimeType, fileExt);

          fileMimeInfo.launchWithFile(outFile);
        }
        catch (ex) {
          // if the attachment file type is unknown, an exception is thrown,
          // so let it be handled by a browser window
          enigLoadExternalURL(outFileUri.asciiSpec);
        }
      }

      // open the attachment using an external application
      enigLoadExternalURL(outFileUri.asciiSpec);
    }
  }
}

function enigLoadExternalURL(url) {
  if (gEnigDecryptButton && gEnigDecryptButton.getAttribute("buttontype")=="seamonkey") {
    EnigLoadURLInNavigatorWindow(url, true);
  }
  else {
    messenger.launchExternalURL(url);
  }
}


// handle double click events on Attachments
function enigAttachmentListClick (elementId, event) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigAttachmentListClick: event="+event+"\n");

  var attachment=event.target.attachment;
  if (enigCheckEncryptedAttach(attachment)) {
    if (event.button != 0) return;

    if (event.detail == 2) // double click
      enigHandleAttachment("openAttachment", attachment);
  }
  else {
    attachmentListClick(event);
  }
}

// download keys
function enigHandleUnknownKey() {
  var pubKeyId = "0x" + gEnigSecurityInfo.keyId.substr(8, 8);

  var mesg =  EnigGetString("pubKeyNeeded") + EnigGetString("keyImport",pubKeyId);

  if (EnigConfirm(mesg, EnigGetString("keyMan.button.import"))) {
    var inputObj = {
      searchList : [ pubKeyId ]
    };
    var resultObj = new Object();

    EnigDownloadKeys(inputObj, resultObj);

    if (resultObj.importedKeys > 0) {
      enigMessageReload(false);
    }
  }
}

function enigReceiveKeyCancel(progressBar) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigReceiveKeyCancel\n");

  var keyRetrProcess = gEnigIpcRequest.pipeTransport;

  if (keyRetrProcess && !keyRetrProcess.isRunning) {
    keyRetrProcess.terminate();
  }
  gEnigIpcRequest.close(true);

  EnigAlert(EnigGetString("keyImportError")+ EnigGetString("failCancel"));

}


