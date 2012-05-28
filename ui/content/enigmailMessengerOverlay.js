/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 *   Patrick Brunschwig <patrick@mozilla-enigmail.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

try {
  // TB with omnijar
  Components.utils.import("resource:///modules/gloda/mimemsg.js");
}
catch (ex) {
  // "old style" TB
  Components.utils.import("resource://app/modules/gloda/mimemsg.js");
}

Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");

if (! Enigmail) var Enigmail = {};

Enigmail.getEnigmailSvc = function ()
{
  return EnigmailCommon.getService(window);
};


Enigmail.msg = {
  createdURIs:      [],
  decryptedMessage: null,
  securityInfo:     null,
  lastSaveDir:      "",
  messagePane:      null,
  noShowReload:     false,
  decryptButton:    null,
  savedHeaders:     null,
  removeListener:   false,
  enableExperiments: false,
  headersList:      ["content-type", "content-transfer-encoding",
                     "x-enigmail-version", "x-pgp-encoding-format" ],

  messengerStartup: function ()
  {

    // private function to overwrite attributes
    function overrideAttribute (elementIdList, attrName, prefix, suffix)
    {
      for (var index = 0; index < elementIdList.length; index++) {
        var elementId = elementIdList[index];
        var element = document.getElementById(elementId);
        if (element) {
          try {
            var oldValue = element.getAttribute(attrName);
            EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: overrideAttribute "+attrName+": oldValue="+oldValue+"\n");
            var newValue = prefix+elementId+suffix;

            element.setAttribute(attrName, newValue);
          } catch (ex) {}
        }
        else {
          EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: *** UNABLE to override id="+ elementId+"\n");
        }
      }
    }

    Enigmail.msg.messagePane = document.getElementById("messagepane");

    if (Enigmail.msg.messagePane == null) return; // TB on Mac OS X calls this twice -- once far too early

    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: Startup\n");

    // Override SMIME ui
    var viewSecurityCmd = document.getElementById("cmd_viewSecurityStatus");
    if (viewSecurityCmd) {
      viewSecurityCmd.setAttribute("oncommand", "Enigmail.msg.viewSecurityInfo(null, true);");
    }

    // Override print command
    var printElementIds = ["cmd_print", "cmd_printpreview", "key_print", "button-print",
                           "mailContext-print", "mailContext-printpreview"];

    overrideAttribute( printElementIds, "oncommand",
                       "Enigmail.msg.msgPrint('", "');");

    Enigmail.msg.overrideLayoutChange();

    Enigmail.msg.savedHeaders = null;

    Enigmail.msg.decryptButton = document.getElementById("button-enigmail-decrypt");

    var toolbarElem = document.getElementById("mail-bar2");
    if (toolbarElem && EnigmailCommon.getOS() == "Darwin") {
      toolbarElem.setAttribute("platform", "macos");
    }

    // Need to add event listener to Enigmail.msg.messagePane to make it work
    // Adding to msgFrame doesn't seem to work
    Enigmail.msg.messagePane.addEventListener("unload", Enigmail.msg.messageFrameUnload, true);

    if (EnigmailCommon.getPref("handleDoubleClick")) {
      // ovveride function for double clicking an attachment
      overrideAttribute(["attachmentList"], "onclick",
                        "Enigmail.msg.enigAttachmentListClick('", "', event);");
    }

    var treeController = {
      supportsCommand: function(command) {
        // EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: supportsCommand: "+command+"\n");
        switch(command) {
        case "button_enigmail_decrypt":
          return true;
        }
        return false;
      },
      isCommandEnabled: function(command) {
        // EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: isCommandEnabled: "+command+"\n");
        try {
          if (gFolderDisplay.messageDisplay.visible) {
            if (gFolderDisplay.selectedCount != 1) Enigmail.hdrView.statusBarHide();
            return (gFolderDisplay.selectedCount == 1);
          }
          Enigmail.hdrView.statusBarHide();
        }
        catch (ex) {}
        return  false;
      },
      doCommand: function(command) {
        //EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: doCommand: "+command+"\n");
        // nothing
      },
      onEvent: function(event) {
        // EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: treeCtrl: onEvent: "+command+"\n");
        // nothing
      }
    };

    top.controllers.appendController(treeController);
  },

  viewSecurityInfo: function (event, displaySmimeMsg)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: viewSecurityInfo\n");

    if (event && event.button != 0)
      return;

    if (gSignatureStatus >= 0 || gEncryptionStatus >= 0) {
      showMessageReadSecurityInfo()
    }
    else {
      if (Enigmail.msg.securityInfo)
        this.viewOpenpgpInfo()
      else
        showMessageReadSecurityInfo();
    }
  },

  viewOpenpgpInfo: function ()
  {
    if (Enigmail.msg.securityInfo) {
      EnigmailCommon.longAlert(window, EnigmailCommon.getString("securityInfo")+Enigmail.msg.securityInfo.statusInfo);
    }
  },


  messageReload: function (noShowReload)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: this.messageReload: "+noShowReload+"\n");

    Enigmail.msg.noShowReload = noShowReload;

    ReloadMessage();
  },


  reloadCompleteMsg: function ()
  {
    gDBView.reloadMessageWithAllParts();
  },


  setAttachmentReveal: function (attachmentList)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: setAttachmentReveal\n");

    var revealBox = document.getElementById("enigmailRevealAttachments");
    revealBox.setAttribute("hidden", attachmentList == null ? "true" : "false");
  },


  messageCleanup: function () {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageCleanup\n");

    var enigmailBox = document.getElementById("enigmailBox");

    if (enigmailBox && !enigmailBox.collapsed) {
      enigmailBox.setAttribute("collapsed", "true");

      var statusText = document.getElementById("expandedEnigmailStatusText");

      if (statusText)
        statusText.value="";
    }

    this.setAttachmentReveal(null);

    if (Enigmail.msg.createdURIs.length) {
      // Cleanup messages belonging to this window (just in case)
      var enigmailSvc = Enigmail.getEnigmailSvc();
      if (enigmailSvc) {
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: Cleanup: Deleting messages\n");
        for (var index=0; index < Enigmail.msg.createdURIs.length; index++) {
          enigmailSvc.deleteMessageURI(Enigmail.msg.createdURIs[index]);
        }
        Enigmail.msg.createdURIs = [];
      }
    }

    Enigmail.msg.decryptedMessage = null;
    Enigmail.msg.securityInfo = null;
  },

  enigMimeInit: function()
  {
    // "this" is not Enigmail.msg here
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit\n");

    try {
      const enigContenthanderCid =
        Components.ID("{847b3a51-7ab1-11d4-8f02-006008948af5}");

      const enigEncryptedHanderContract = "@mozilla.org/mimecth;1?type=multipart/encrypted";

      var compMgr = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);

      var enigContentHandlerCID = compMgr.contractIDToCID(enigEncryptedHanderContract);

      var handlePGPMime = (enigContentHandlerCID.toString() ==
                       enigContenthanderCid);

      EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: handlePGPMime="+handlePGPMime+"\n");

    } catch (ex) {}



    if (Enigmail.msg.removeListener) {
      Enigmail.msg.messagePane.removeEventListener("load", Enigmail.msg.enigMimeInit, true);
      Enigmail.msg.removeListener = false;
    }

    var enigmailSvc = Enigmail.getEnigmailSvc();
    if (!enigmailSvc)
       return;

    if (enigmailSvc.mimeInitialized()) {
      // Reload message ONLY if enigMimeService has been initialized;
      // enigMimeInit is only called if enigMimeService was not initialized;
      // this prevents looping.
      EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: RELOADING MESSAGE\n");

      Enigmail.msg.messageReload(false);

    } else {
      // Error in MIME initialization; forget saved headers (to avoid looping)
      Enigmail.msg.savedHeaders = null;
      EnigmailCommon.ERROR_LOG("enigmailMessengerOverlay.js: *****enigMimeInit: Error in MIME initialization\n");
    }
  },

  messageFrameUnload: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageFrameUnload\n");

    if (Enigmail.msg.noShowReload) {
      Enigmail.msg.noShowReload = false;

    } else {
      Enigmail.msg.savedHeaders = null;

      Enigmail.msg.messageCleanup();
    }
  },

  overrideLayoutChange: function ()
  {
    // Enigmail needs to listen to some layout changes in order to decrypt
    // messages in case the user changes the layout
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: overrideLayoutChange\n");
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
          element.setAttribute("oncommand", "Enigmail.msg.changeMailLayout"+arg);
        } catch (ex) {}
      }
    }

    var toggleMsgPaneElementIds = ["cmd_toggleMessagePane"];
    for (var i = 0; i < toggleMsgPaneElementIds.length; i++) {
      var elementId = toggleMsgPaneElementIds[i];
      var element = document.getElementById(elementId);
      if (element) {
        try {
          element.setAttribute("oncommand", "Enigmail.msg.toggleMessagePane()");
        } catch (ex) {}
      }
    }
  },

  changeMailLayout: function (viewType)
  {
    // call the original layout change 1st
    ChangeMailLayout(viewType);

    // This event requires that we re-subscribe to these events!
    Enigmail.msg.messagePane.addEventListener("unload", Enigmail.msg.messageFrameUnload, true);
    this.messageReload(false);
  },

  toggleMessagePane: function () {
    Enigmail.hdrView.statusBarHide();
    MsgToggleMessagePane(true);

    var button=document.getElementById("button_enigmail_decrypt")
    if (gFolderDisplay.messageDisplay.visible) {
      button.removeAttribute("disabled");
    }
    else {
      button.setAttribute("disabled", "true");
    }
  },

  getCurrentMsgUriSpec: function ()
  {
    try {
      if (gFolderDisplay.selectedMessages.length != 1)
        return "";

      var uriSpec = gFolderDisplay.selectedMessageUris[0];
      //EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: getCurrentMsgUriSpec: uriSpec="+uriSpec+"\n");

      return uriSpec;

    }
    catch (ex) {
      return "";
    }
  },

  getCurrentMsgUrl: function ()
  {
    var uriSpec = this.getCurrentMsgUriSpec();
    return this.getUrlFromUriSpec(uriSpec);
  },

  getUrlFromUriSpec: function (uriSpec)
  {
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

    }
    catch (ex) {
      return null;
    }
  },

  updateOptionsDisplay: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: updateOptionsDisplay: \n");
    var optList = ["autoDecrypt"];

    for (var j=0; j<optList.length; j++) {
      var menuElement = document.getElementById("enigmail_"+optList[j]);
      menuElement.setAttribute("checked", EnigmailCommon.getPref(optList[j]) ? "true" : "false");
    }

    optList = ["decryptverify", "importpublickey", "savedecrypted"];
    for (j=0; j<optList.length; j++) {
      menuElement = document.getElementById("enigmail_"+optList[j]);
      if (Enigmail.msg.decryptButton && Enigmail.msg.decryptButton.disabled) {
         menuElement.setAttribute("disabled", "true");
      }
      else {
         menuElement.removeAttribute("disabled");
      }
    }
  },


  toggleAttribute: function (attrName)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgessengerOverlay.js: toggleAttribute('"+attrName+"')\n");

    var menuElement = document.getElementById("enigmail_"+attrName);

    var oldValue = EnigmailCommon.getPref(attrName);
    EnigmailCommon.setPref(attrName, !oldValue);

    this.updateOptionsDisplay();

    if (attrName == "autoDecrypt")
      this.messageReload(false);
  },

  messageImport: function (event)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageImport: "+event+"\n");

    return this.messageParse(!event, true, "", this.getCurrentMsgUriSpec());
  },

  // callback function for automatic decryption
  messageAutoDecrypt: function (event)
  {
    Enigmail.msg.messageDecrypt(event, true);
  },

  // analyse message header and decrypt/verify message
  messageDecrypt: function (event, isAuto)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageDecrypt: "+event+"\n");

    var cbObj = {
      event: event,
      isAuto: isAuto
    };

    try {
      if (gFolderDisplay.selectedMessageIsNews) throw "dummy"; // workaround for broken NNTP support in Gloda
      MsgHdrToMimeMessage(gFolderDisplay.selectedMessage , cbObj, Enigmail.msg.msgDecryptMimeCb, true);
    }
    catch (ex) {
      EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: enigMessageDecrypt: cannot use MsgHdrToMimeMessage\n");
      this.messageDecryptCb(event, isAuto, null);
    }
  },


  msgDecryptMimeCb: function (msg, mimeMsg)
  {
    // MsgHdrToMimeMessage is not on the main thread which may lead to problems with
    // accessing DOM and debugging

    EnigmailCommon.dispatchEvent(
      function(argList) {
        var enigmailSvc=Enigmail.getEnigmailSvc();
        if (!enigmailSvc) return;

        var event = argList[0];
        var isAuto = argList[1];
        var mimeMsg = argList[2];
        Enigmail.msg.messageDecryptCb(event, isAuto, mimeMsg);
      }, 0, [this.event, this.isAuto, mimeMsg])
  },


  enigMimeInitialize: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: enigMimeInitialize() - loading enigmail:dummy ...\n");

    // Need to add event listener to Enigmail.msg.messagePane to make it work
    // Adding to msgFrame doesn't seem to work
    Enigmail.msg.messagePane.addEventListener("load", Enigmail.msg.enigMimeInit, true);
    Enigmail.msg.removeListener = true;

    Enigmail.msg.noShowReload = true;

    var msgFrame = EnigmailCommon.getFrame(window, "messagepane");
    messenger.loadURL(msgFrame, "enigmail:dummy");

    return;
  },

  enumerateMimeParts: function (mimePart, resultObj)
  {
    EnigmailCommon.DEBUG_LOG("enumerateMimeParts: "+mimePart.partName+" - "+mimePart.headers["content-type"]+"\n");

    try {
      var ct = mimePart.headers["content-type"][0];
      if (typeof(ct) == "string") {
        if (ct.search(/multipart\/signed.*application\/pgp-signature/i) >= 0) {
          resultObj.signed=mimePart.partName;
        }
        else if (ct.search(/application\/pgp-encrypted/i) >= 0)
          resultObj.encrypted=mimePart.partName;
      }
    }
    catch (ex) {
      // catch exception if no headers or no content-type defined.
    }

    var i;
    for (i in mimePart.parts) {
      this.enumerateMimeParts(mimePart.parts[i], resultObj);
    }
  },


  messageDecryptCb: function (event, isAuto, mimeMsg)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageDecryptCb:\n");

    var enigmailSvc;
    try {
      var showHeaders = 0;
      var contentType = "";

      if (mimeMsg == null) {
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageDecryptCb: mimeMsg is null\n");
        try {
          contentType=currentHeaderData['content-type'].headerValue;
        }
        catch (ex) {
          contentType = "text/plain";
        }
        mimeMsg = {
          headers: {'content-type': contentType },
          contentType: contentType,
          parts: null
        }
      }

      // Copy selected headers
      Enigmail.msg.savedHeaders = {};

      for (var index=0; index < Enigmail.msg.headersList.length; index++) {
        var headerName = Enigmail.msg.headersList[index];
        var headerValue = "";

        if (mimeMsg.headers[headerName] != undefined) {
          headerValue = mimeMsg.headers[headerName].toString();
        }

        Enigmail.msg.savedHeaders[headerName] = headerValue;
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: header "+headerName+": "+headerValue+"\n");
      }

      var embeddedSigned = null;
      var embeddedEncrypted = null;

      if (mimeMsg.parts != null) {
        // TB >= 8.0
        var resultObj={ encrypted: "", signed: "" };
        this.enumerateMimeParts(mimeMsg, resultObj);
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: embedded objects: "+resultObj.encrypted+" / "+resultObj.signed+"\n");

        // ignore mime parts on top level (regular messages)
        if (resultObj.signed.indexOf(".") < 0) resultObj.signed = null;
        if (resultObj.encrypted.indexOf(".") < 0) resultObj.encrypted = null;

        if (resultObj.encrypted || resultObj.signed) {
          let mailUrl = this.getCurrentMsgUrl();
          if (mailUrl) {
              if (resultObj.signed) embeddedSigned = mailUrl.spec+"&part="+resultObj.signed.replace(/\.\d+$/, "");
              if (resultObj.encrypted) embeddedEncrypted = mailUrl.spec+"&part="+resultObj.encrypted.replace(/\.\d+$/, "");
          }
        }
      }

      if (! (embeddedSigned || embeddedEncrypted)) {
        // TB <= 7.x
        if (Enigmail.msg.savedHeaders["content-type"] &&
            ((Enigmail.msg.savedHeaders["content-type"].search(/^multipart\/mixed/i) == 0) ||
             (Enigmail.msg.savedHeaders["content-type"].search(/^multipart\/encrypted/i) == 0))) {
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
              EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: mimePart "+indexb+": "+attachment.contentType+"\n");
            }
          }
        }
      }

      var contentEncoding = "";
      var xEnigmailVersion = "";
      var msgUriSpec = this.getCurrentMsgUriSpec();

      if (Enigmail.msg.savedHeaders) {
        contentType      = Enigmail.msg.savedHeaders["content-type"];
        contentEncoding  = Enigmail.msg.savedHeaders["content-transfer-encoding"];
        xEnigmailVersion = Enigmail.msg.savedHeaders["x-enigmail-version"];
      }

      if (isAuto && (! EnigmailCommon.getPref("autoDecrypt"))) {
        var signedMsg = ((contentType.search(/^multipart\/signed(;|$)/i) == 0) && (contentType.search(/application\/pgp-signature/i)>0));
        var encrypedMsg = ((contentType.search(/^multipart\/encrypted(;|$)/i) == 0) && (contentType.search(/application\/pgp-encrypted/i)>0));
        if (embeddedSigned || embeddedEncrypted ||
            encrypedMsg || signedMsg) {
          enigmailSvc = Enigmail.getEnigmailSvc();
          if (!enigmailSvc)
            return;

          if ((!enigmailSvc.mimeInitialized() && encrypedMsg) || signedMsg ||
              ((!encrypedMsg) && (embeddedSigned || embeddedEncrypted))) {
            Enigmail.hdrView.updateHdrIcons(EnigmailCommon.POSSIBLE_PGPMIME, 0, "", "", "", EnigmailCommon.getString("possiblyPgpMime"));
          }
        }
        return;
      }

      if (contentType.search(/^multipart\/encrypted(;|$)/i) == 0) {
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: multipart/encrypted\n");

        enigmailSvc = Enigmail.getEnigmailSvc();
        if (!enigmailSvc)
          return;

        if (!enigmailSvc.mimeInitialized()) {
          // Display enigmail:dummy URL in message pane to initialize
          this.enigMimeInitialize();
          return;
        }
      }

      if (((contentType.search(/^multipart\/encrypted(;|$)/i) == 0) ||
          (embeddedEncrypted && contentType.search(/^multipart\/mixed(;|$)/i) == 0))
           && (!embeddedSigned)) {

        enigmailSvc = Enigmail.getEnigmailSvc();
        if (!enigmailSvc)
          return;

        if (!enigmailSvc.mimeInitialized()) {
          this.enigMimeInitialize();
          return;
        }
        else if (! isAuto) {
          Enigmail.msg.messageReload(false);
        }
        else if (embeddedEncrypted && (! encrypedMsg)) {
          var mailNewsUrl = this.getCurrentMsgUrl();
          if (mailNewsUrl) {
            mailNewsUrl.spec = embeddedEncrypted;
            Enigmail.msg.verifyEmbeddedMsg(window, mailNewsUrl, msgWindow, msgUriSpec, contentEncoding, event);
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
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageDecryptCb: multipart/signed\n");

        var mailNewsUrl = this.getCurrentMsgUrl();
        if (mailNewsUrl) {
            EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageDecryptCb: mailNewsUrl:"+mailNewsUrl+"\n");
            EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageDecryptCb: msgUriSpec:"+msgUriSpec+"\n");
          if (embeddedSigned) {
            mailNewsUrl.spec = embeddedSigned;
            Enigmail.msg.verifyEmbeddedMsg(window, mailNewsUrl, msgWindow, msgUriSpec, contentEncoding, event);
          }
          else {

            var verifier = Components.classes[EnigmailCommon.ENIGMIMEVERIFY_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeVerify);

            verifier.init(window, mailNewsUrl, msgWindow, msgUriSpec,
                          true, enableSubpartTreatment);

          }
          return;
        }
      }

      this.messageParse(!event, false, contentEncoding, msgUriSpec);
    }
    catch (ex) {
      EnigmailCommon.writeException("enigmailMessengerOverlay.js: messageDecryptCb", ex);
    }
  },


  messageParse: function (interactive, importOnly, contentEncoding, msgUriSpec)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageParse: "+interactive+"\n");
    var msgFrame = EnigmailCommon.getFrame(window, "messagepane");
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: msgFrame="+msgFrame+"\n");

    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: bodyElement="+bodyElement+"\n");

    var findStr = /* interactive ? null : */ "-----BEGIN PGP";
    var msgText = null;
    var foundIndex = -1;


    if (bodyElement.firstChild) {
      let node = bodyElement.firstChild
      while (node) {
        if (node.nodeName == "DIV") {
          foundIndex = node.textContent.indexOf(findStr);

          if (foundIndex >= 0) {
            if (node.textContent.indexOf(findStr+" LICENSE AUTHORIZATION") == foundIndex)
              foundIndex = -1;
          }
          if (foundIndex >= 0) {
            bodyElement = node;
            break;
          }
        }
        node = node.nextSibling;
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
    msgText = EnigmailCommon.convertFromUnicode(msgText, charset);

    var mozPlainText = bodyElement.innerHTML.search(/class=\"moz-text-plain\"/);

    if ((mozPlainText >= 0) && (mozPlainText < 40)) {
      // workaround for too much expanded emoticons in plaintext msg
      var r = new RegExp(/( )(;-\)|:-\)|;\)|:\)|:-\(|:\(|:-\\|:-P|:-D|:-\[|:-\*|\>:o|8-\)|:-\$|:-X|\=-O|:-\!|O:-\)|:\'\()( )/g);
      if (msgText.search(r) >= 0) {
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageParse: performing emoticons fixing\n");
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

    //EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: msgText='"+msgText+"'\n");

    var mailNewsUrl = this.getUrlFromUriSpec(msgUriSpec);

    var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

    let retry = (charset != "UTF-8" ? 1 : 2);

    Enigmail.msg.messageParseCallback(msgText, contentEncoding, charset, interactive,
                                      importOnly, urlSpec, "", retry, head, tail,
                                      msgUriSpec);
  },


  messageParseCallback: function (msgText, contentEncoding, charset, interactive,
                                  importOnly, messageUrl, signature, retry,
                                  head, tail, msgUriSpec)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageParseCallback: "+interactive+", "+interactive+", importOnly="+importOnly+", charset="+charset+", msgUrl="+messageUrl+", retry="+retry+", signature='"+signature+"'\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    if (!msgText)
      return;

    var enigmailSvc = Enigmail.getEnigmailSvc();
    if (!enigmailSvc)
      return;

    var plainText;
    var exitCode;
    var newSignature = "";
    var statusFlags = 0;

    var errorMsgObj = new Object();
    var keyIdObj    = new Object();
    var blockSeparationObj = { value: "" };


    if (importOnly) {
      // Import public key
      var importFlags = nsIEnigmail.UI_INTERACTIVE;
      exitCode = enigmailSvc.importKey(window, importFlags, msgText, "",
                                       errorMsgObj);

    }
    else {

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
              EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageParseCallback: OVERRIDING charset="+charset+"\n");
            }
          }
        }
      }

      var exitCodeObj    = new Object();
      var statusFlagsObj = new Object();
      var userIdObj      = new Object();
      var sigDetailsObj  = new Object();

      var signatureObj = new Object();
      signatureObj.value = signature;

      var uiFlags = interactive ? (nsIEnigmail.UI_INTERACTIVE |
                                   nsIEnigmail.UI_ALLOW_KEY_IMPORT |
                                   nsIEnigmail.UI_UNVERIFIED_ENC_OK) : 0;


      plainText = enigmailSvc.decryptMessage(window, uiFlags, msgText,
                                   signatureObj, exitCodeObj, statusFlagsObj,
                                   keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj);

      //EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageParseCallback: plainText='"+plainText+"'\n");

      exitCode = exitCodeObj.value;
      newSignature = signatureObj.value;

      if (plainText == "" && exitCode == 0) {
        plainText = " ";
      }

      statusFlags = statusFlagsObj.value;

      EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageParseCallback: newSignature='"+newSignature+"'\n");
    }

    var errorMsg = errorMsgObj.value;

    if (importOnly) {
       if (interactive && errorMsg)
         EnigmailCommon.longAlert(window, errorMsg);
       return;
    }

    var displayedUriSpec = Enigmail.msg.getCurrentMsgUriSpec();
    if (!msgUriSpec || (displayedUriSpec == msgUriSpec)) {
      Enigmail.hdrView.updateHdrIcons(exitCode, statusFlags, keyIdObj.value, userIdObj.value, sigDetailsObj.value, errorMsg, null);
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
        msgText = EnigmailCommon.convertFromUnicode(msgText, "UTF-8");
        Enigmail.msg.messageParseCallback(msgText, contentEncoding, charset,
                                          interactive, importOnly, messageUrl,
                                          signature, retry + 1,
                                          head, tail, msgUriSpec);
        return;
      }
      else if (retry == 2) {
        // Try to verify signature by accessing raw message text directly
        // (avoid recursion by setting retry parameter to false on callback)
        newSignature = "";
        Enigmail.msg.msgDirectDecrypt(interactive, importOnly, contentEncoding, charset,
                                      newSignature, 0, head, tail, msgUriSpec,
                                      Enigmail.msg.messageParseCallback);
        return;
      }
      else if (retry == 3) {
        msgText = EnigmailCommon.convertToUnicode(msgText, "UTF-8");
        Enigmail.msg.messageParseCallback(msgText, contentEncoding, charset, interactive,
                                          importOnly, messageUrl, null, retry + 1,
                                          head, tail, msgUriSpec)
        return;
      }
    }

    if (!plainText) {
       if (interactive && Enigmail.msg.securityInfo && Enigmail.msg.securityInfo.statusInfo)
         EnigmailCommon.longAlert(window, Enigmail.msg.securityInfo.statusInfo);
       return;
    }

    if (retry >= 2) {
      plainText = EnigmailCommon.convertFromUnicode(EnigmailCommon.convertToUnicode(plainText, "UTF-8"), charset);
    }

    if (blockSeparationObj.value.indexOf(" ")>=0) {
      var blocks = blockSeparationObj.value.split(/ /);
      var blockInfo = blocks[0].split(/:/);
      plainText = EnigmailCommon.convertFromUnicode(EnigmailCommon.getString("notePartEncrypted"), charset)
          + "\n\n" + plainText.substr(0, blockInfo[1]) + "\n\n" + EnigmailCommon.getString("noteCutMessage");
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
      if (! Enigmail.msg.checkEncryptedAttach(currentAttachments[index])) {
        if (!Enigmail.msg.checkSignedAttachment(currentAttachments, index)) attachmentsEncrypted=false;
      }
    }

    var msgRfc822Text = "";
    if (head || tail) {
      if (head) {
        // print a warning if the signed or encrypted part doesn't start
        // quite early in the message
        matches=head.match(/(\n)/g);
        if (matches && matches.length >10) {
          msgRfc822Text=EnigmailCommon.convertFromUnicode(EnigmailCommon.getString("notePartEncrypted"), charset)+"\n\n";
        }
        msgRfc822Text+=head+"\n\n";
      }
      msgRfc822Text += EnigmailCommon.convertFromUnicode(EnigmailCommon.getString("beginPgpPart"), charset)+"\n\n";
    }
    msgRfc822Text+=plainText;
    if (head || tail) {
      msgRfc822Text+="\n\n"+ EnigmailCommon.convertFromUnicode(EnigmailCommon.getString("endPgpPart"), charset)+"\n\n"+tail;
    }

    Enigmail.msg.decryptedMessage = {url:messageUrl,
                             uri:msgUriSpec,
                             headerList:headerList,
                             hasAttachments:hasAttachments,
                             attachmentsEncrypted:attachmentsEncrypted,
                             charset:charset,
                             plainText:msgRfc822Text};

    var msgFrame = EnigmailCommon.getFrame(window, "messagepane");
    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];

    // don't display decrypted message if message selection has changed
    displayedUriSpec = Enigmail.msg.getCurrentMsgUriSpec();
    if (msgUriSpec && displayedUriSpec && (displayedUriSpec != msgUriSpec)) return;


    // Create and load one-time message URI
    var messageContent = Enigmail.msg.getDecryptedMessage("message/rfc822", false);

    Enigmail.msg.noShowReload = true;

    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
    if (bodyElement.firstChild) {
      var node = bodyElement.firstChild;
      var foundIndex = -1;
      var findStr = "-----BEGIN PGP";

      while (node) {
        if (node.nodeName == "DIV") {
          foundIndex = node.textContent.indexOf(findStr);

          if (foundIndex >= 0) {
            if (node.textContent.indexOf(findStr+" LICENSE AUTHORIZATION") == foundIndex)
              foundIndex = -1;
          }
          if (foundIndex >= 0) {
            node.innerHTML = EnigmailFuncs.formatPlaintextMsg(EnigmailCommon.convertToUnicode(messageContent, charset));
            return;
          }
        }
        node = node.nextSibling;
      }

      // if no <DIV> node is found, try with <PRE> (bug 24762)
      node = bodyElement.firstChild;
      foundIndex = -1;
      while (node) {
        if (node.nodeName == "PRE") {
          foundIndex = node.textContent.indexOf(findStr);

          if (foundIndex >= 0) {
            if (node.textContent.indexOf(findStr+" LICENSE AUTHORIZATION") == foundIndex)
              foundIndex = -1;
          }
          if (foundIndex >= 0) {
            node.innerHTML = EnigmailFuncs.formatPlaintextMsg(EnigmailCommon.convertToUnicode(messageContent, charset));
            return;
          }
        }
        node = node.nextSibling;
      }

    }

    EnigmailCommon.ERROR_LOG("enigmailMessengerOverlay.js: no node found to replace message display\n");

    return;
  },


  // check if an attachment could be signed
  checkSignedAttachment: function (attachmentObj, index)
  {
    var attachmentList;
    if (index != null) {
      attachmentList = attachmentObj;
    }
    else {
      attachmentList=currentAttachments;
      for (var i=0; i < attachmentList.length; i++) {
        if (attachmentList[i].url == attachmentObj.url) {
          index = i;
          break;
        }
      }
      if (index == null) return false;
    }

    var signed = false;
    var findFile;

    var attName = this.getAttachmentName(attachmentList[index]).toLowerCase().replace(/\+/g, "\\+");

    // check if filename is a signature
    if ((this.getAttachmentName(attachmentList[index]).search(/\.(sig|asc)$/i) > 0) ||
       (attachmentList[index].contentType.match(/^application\/pgp\-signature/i))) {
      findFile = new RegExp(attName.replace(/\.(sig|asc)$/, ""));
    }
    else
      findFile = new RegExp(attName+".(sig|asc)$");

    var i;
    for (i in attachmentList) {
      if ((i != index) &&
          (this.getAttachmentName(attachmentList[i]).toLowerCase().search(findFile) == 0))
        signed=true;
    }

    return signed;
  },

  // check if the attachment could be encrypted
  checkEncryptedAttach: function (attachment)
  {
    return (this.getAttachmentName(attachment).match(/\.(gpg|pgp|asc)$/i) ||
      (attachment.contentType.match(/^application\/pgp(\-.*)?$/i)) &&
       (attachment.contentType.search(/^application\/pgp\-signature/i) < 0));
  },

  getAttachmentName: function (attachment) {
    if (typeof(attachment.displayName) == "undefined") {
      // TB >=  7.0
      return attachment.name;
    }
    else
      // TB <= 6.0
      return attachment.displayName;
  },

  escapeTextForHTML: function (text, hyperlink)
  {
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
  },

  getDecryptedMessage: function (contentType, includeHeaders)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: getDecryptedMessage: "+contentType+", "+includeHeaders+"\n");

    if (!Enigmail.msg.decryptedMessage)
      return "No decrypted message found!\n";

    var enigmailSvc = Enigmail.getEnigmailSvc();
    if (!enigmailSvc)
      return "";

    var headerList = Enigmail.msg.decryptedMessage.headerList;

    var statusLine = Enigmail.msg.securityInfo ? Enigmail.msg.securityInfo.statusLine : "";

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
                       "Date": EnigmailCommon.getDateTime(msg.dateInSeconds, true, true) };


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

        if (Enigmail.msg.decryptedMessage.charset) {
          contentData += "; charset="+Enigmail.msg.decryptedMessage.charset;
        }

        contentData += "\r\n";
      }

      contentData += "\r\n";

      if (Enigmail.msg.decryptedMessage.hasAttachments && (! Enigmail.msg.decryptedMessage.attachmentsEncrypted)) {
        contentData += EnigmailCommon.convertFromUnicode(EnigmailCommon.getString("enigContentNote"), Enigmail.msg.decryptedMessage.charset);
      }

      contentData += Enigmail.msg.decryptedMessage.plainText;

    } else {
      // text/html or text/plain

      if (contentType == "text/html") {
        contentData += "<meta http-equiv=\"Content-Type\" content=\"text/html; charset="+Enigmail.msg.decryptedMessage.charset+"\">\r\n";

        contentData += "<html><head></head><body>\r\n";
      }

      if (statusLine) {
        if (contentType == "text/html") {
          contentData += "<b>"+EnigmailCommon.getString("enigHeader")+"</b> " +
                         this.escapeTextForHTML(statusLine, false) + "<br>\r\n<hr>\r\n";
        } else{
          contentData += EnigmailCommon.getString("enigHeader")+" " + statusLine + "\r\n\r\n";
        }
      }

      if (includeHeaders) {
        for (headerName in headerList) {
          headerValue = headerList[headerName];

          if (headerValue) {
            if (contentType == "text/html") {
              contentData += "<b>"+this.escapeTextForHTML(headerName, false)+":</b> "+
                                   this.escapeTextForHTML(headerValue, false)+"<br>\r\n";
            } else {
              contentData += headerName + ": " + headerValue + "\r\n";
            }
          }
        }
      }

      if (contentType == "text/html") {
        contentData += "<pre>"+this.escapeTextForHTML(Enigmail.msg.decryptedMessage.plainText, false)+"</pre>\r\n";

        contentData += "</body></html>\r\n";

      } else {

        contentData += "\r\n"+Enigmail.msg.decryptedMessage.plainText;
      }

      if (!(enigmailSvc.isDosLike)) {
        contentData = contentData.replace(/\r\n/g, "\n");
      }
    }

    return contentData;
  },


  msgDefaultPrint: function (elementId)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: this.msgDefaultPrint: "+elementId+"\n");

    goDoCommand(elementId.indexOf("printpreview")>=0 ? "cmd_printpreview" : "cmd_print");
  },

  msgPrint: function (elementId)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: msgPrint: "+elementId+"\n");

    var contextMenu = (elementId.search("Context") > -1);

    if (!Enigmail.msg.decryptedMessage || typeof(Enigmail.msg.decryptedMessage) == "undefined") {
      this.msgDefaultPrint(elementId);
      return;
    }

    var mailNewsUrl = this.getCurrentMsgUrl();

    if (!mailNewsUrl) {
      this.msgDefaultPrint(elementId);
      return
    }

    if (Enigmail.msg.decryptedMessage.url != mailNewsUrl.spec) {
      Enigmail.msg.decryptedMessage = null;
      this.msgDefaultPrint(elementId);
      return;
    }

    var enigmailSvc = Enigmail.getEnigmailSvc();
    if (!enigmailSvc) {
      this.msgDefaultPrint(elementId);
      return;
    }

    // Note: Trying to print text/html content does not seem to work with
    //       non-ASCII chars
    var msgContent = this.getDecryptedMessage("message/rfc822", true);

    var uri = enigmailSvc.createMessageURI(Enigmail.msg.decryptedMessage.url,
                                           "message/rfc822",
                                           "",
                                           msgContent,
                                           false);

    Enigmail.msg.createdURIs.push(uri);

    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: msgPrint: uri="+uri+"\n");

    var messageList = [uri];

    var printPreview = (elementId.indexOf("printpreview")>=0);

    window.openDialog("chrome://messenger/content/msgPrintEngine.xul",
                      "",
                      "chrome,dialog=no,all,centerscreen",
                      1, messageList, statusFeedback,
                      printPreview, Components.interfaces.nsIMsgPrintEngine.MNAB_PRINTPREVIEW_MSG,
                      window);

    return true;
  },

  messageSave: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageSave: \n");

    if (!Enigmail.msg.decryptedMessage) {
      EnigmailCommon.alert(window, EnigmailCommon.getString("noDecrypted"));
      return;
    }

    var mailNewsUrl = this.getCurrentMsgUrl();

    if (!mailNewsUrl) {
      EnigmailCommon.alert(window, EnigmailCommon.getString("noMessage"));
      return;
    }

    if (Enigmail.msg.decryptedMessage.url != mailNewsUrl.spec) {
      Enigmail.msg.decryptedMessage = null;
      EnigmailCommon.alert(window, EnigmailCommon.getString("useButton"));
      return;
    }

    var saveFile = EnigmailCommon.filePicker(window, EnigmailCommon.getString("saveHeader"),
                                  Enigmail.msg.lastSaveDir, true, "txt",
                                  null, ["Text files", "*.txt"]);
    if (!saveFile) return;

    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: messageSave: path="+saveFile.path+"\n");

    if (saveFile.parent)
      Enigmail.msg.lastSaveDir = EnigmailCommon.getFilePath(saveFile.parent);

    var textContent = this.getDecryptedMessage("text/plain", true);

    if (!Enigmail.msg.writeFileContents(saveFile.path, textContent, null)) {
      EnigmailCommon.alert(window, "Error in saving to file "+saveFile.path);
      return;
    }

    return;
  },

  msgDirectDecrypt: function (interactive, importOnly, contentEncoding, charset, signature,
                           bufferSize, head, tail, msgUriSpec, callbackFunction)
  {
    EnigmailCommon.WRITE_LOG("enigmailMessengerOverlay.js: msgDirectDecrypt: contentEncoding="+contentEncoding+", signature="+signature+"\n");
    var mailNewsUrl = this.getCurrentMsgUrl();
    if (!mailNewsUrl)
      return;

    var ipcBuffer = Components.classes[EnigmailCommon.IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
    var mimeListener = Components.classes[EnigmailCommon.ENIGMIMELISTENER_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeListener);

    if (bufferSize > 0) {
      ipcBuffer.open(bufferSize, false);
    }
    else {
      ipcBuffer.open(EnigmailCommon.MSG_BUFFER_SIZE, false);
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

    var requestObserver = EnigmailCommon.newRequestObserver(Enigmail.msg.msgDirectCallback,
                                                            callbackArg);

    ipcBuffer.observe(requestObserver, mailNewsUrl);

    var ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

    var channel = ioServ.newChannelFromURI(mailNewsUrl);

    var pipeFilter = Components.classes[EnigmailCommon.PIPEFILTERLISTENER_CONTRACTID].createInstance(Components.interfaces.nsIPipeFilterListener);
    pipeFilter.init(ipcBuffer, null,
                  "-----BEGIN PGP",
                  "-----END PGP",
                  0, true, false, null);

    var listener;

    try {

      mimeListener.init(pipeFilter, null, EnigmailCommon.MSG_HEADER_SIZE, true, false, true);

      listener = mimeListener;

    } catch (ex) {
      listener = pipeFilter;
    }

    channel.asyncOpen(pipeFilter, mailNewsUrl);
  },


  msgDirectCallback: function (cbArray)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: msgDirectCallback: \n");

    var callbackArg = cbArray[0];
    var mailNewsUrl = Enigmail.msg.getCurrentMsgUrl();
    var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";
    var newBufferSize = 0;

    var l = urlSpec.length;

    if (urlSpec.substr(0, l) != callbackArg.messageUrl.substr(0, l)) {
      EnigmailCommon.ERROR_LOG("enigmailMessengerOverlay.js: msgDirectCallback: Message URL mismatch "+mailNewsUrl.spec+" vs. "+callbackArg.messageUrl+"\n");
      return;
    }

    if (callbackArg.ipcBuffer.overflowed) {
      WARNING_LOG("enigmailMessengerOverlay.js: msgDirectCallback: MESSAGE BUFFER OVERFLOW\n");
      if (! callbackArg.expectedBufferSize) {
        // set correct buffer size
        newBufferSize=((callbackArg.ipcBuffer.totalBytes+1500)/1024).toFixed(0)*1024;
      }
    }

    var msgText = callbackArg.ipcBuffer.getData();
    msgText = EnigmailCommon.convertFromUnicode(msgText, "UTF-8");

    callbackArg.ipcBuffer.shutdown();

    if (newBufferSize > 0) {
      // retry with correct buffer size
      Enigmail.msg.msgDirectDecrypt(callbackArg.interactive,
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
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: msgDirectCallback: msgText='"+msgText+"'\n");

    var f = function (argList) {
      var msgText = argList[0];
      var cb = argList[1];
      cb.callbackFunction(msgText, cb.contentEncoding,
                           cb.charset,
                           cb.interactive,
                           cb.importOnly,
                           cb.messageUrl,
                           cb.signature,
                           3,
                           cb.head,
                           cb.tail,
                           cb.msgUriSpec);
    }

    EnigmailCommon.dispatchEvent(f, 0, [msgText, callbackArg ]);
  },


  verifyEmbeddedMsg: function (window, msgUrl, msgWindow, msgUriSpec, contentEncoding, event)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: verifyEmbeddedMsg: msgUrl"+msgUrl+"\n");

    var ipcBuffer = Components.classes[EnigmailCommon.IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
    ipcBuffer.open(-1, false);

    var callbackArg = { ipcBuffer: ipcBuffer,
                        window: window,
                        msgUrl: msgUrl,
                        msgWindow: msgWindow,
                        msgUriSpec: msgUriSpec,
                        contentEncoding: contentEncoding,
                        event: event };

    var requestObserver = EnigmailCommon.newRequestObserver(Enigmail.msg.verifyEmbeddedCallback,
                                                            callbackArg);

    ipcBuffer.observe(requestObserver, msgUrl);

    var ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

    var channel = ioServ.newChannelFromURI(msgUrl);

    channel.asyncOpen(ipcBuffer, msgUrl);
  },

  verifyEmbeddedCallback: function (cbArray)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: verifyEmbeddedCallback: \n");

    var callbackArg = cbArray[0];
    var txt = callbackArg.ipcBuffer.getData();
    callbackArg.ipcBuffer.shutdown();

    if (txt.length > 0) {
      msigned=txt.search(/content\-type:[ \t]*multipart\/signed/i);
      if(msigned >= 0) {
        // Real multipart/signed message; let's try to verify it
        EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: verifyEmbeddedCallback: detected multipart/signed. msigned: "+msigned+"\n");

        callbackArg.enableSubpartTreatment=(msigned > 0);

        var uri = Components.classes[EnigmailCommon.SIMPLEURI_CONTRACTID].createInstance(Components.interfaces.nsIURI);
        uri.spec = "enigmail:dummy";

        var channel = EnigmailCommon.newStringChannel(uri, "", "", txt);
        var verifier = Components.classes[EnigmailCommon.ENIGMIMEVERIFY_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeVerify);

        verifier.initWithChannel(callbackArg.window, channel, callbackArg.msgWindow, callbackArg.msgUriSpec,
                        true, callbackArg.enableSubpartTreatment);
        return;
      }
    }

    // try inline PGP
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: verifyEmbeddedCallback: try inline PGP\n");

    Enigmail.msg.messageParse(!callbackArg.event, false, callbackArg.contentEncoding, callbackArg.msgUriSpec);
  },


  revealAttachments: function (index)
  {
    if (!index) index = 0;

    if (index < currentAttachments.length) {
      this.handleAttachment("revealName/"+index.toString(), currentAttachments[index]);
    }
  },


  // handle a selected attachment (decrypt & open or save)
  handleAttachmentSel: function (actionType)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: handleAttachmentSel: actionType="+actionType+"\n");

    // Thunderbird
    var contextMenu = document.getElementById('attachmentItemContext');
    var selectedAttachments = contextMenu.attachments;

    if (! contextMenu) {
      // SeaMonkey
      contextMenu = document.getElementById('attachmentListContext');
      selectedAttachments = attachmentList.selectedItems;
    }
    var anAttachment = selectedAttachments[0];

    switch (actionType) {
    case "saveAttachment":
    case "openAttachment":
    case "importKey":
    case "revealName":
      this.handleAttachment(actionType, anAttachment);
      break;
    case "verifySig":
      this.verifyDetachedSignature(anAttachment);
      break;
    }
  },

  /**
   * save the original file plus the signature file to disk and then verify the signature
   */
  verifyDetachedSignature: function (anAttachment)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: verifyDetachedSignature: url="+anAttachment.url+"\n");

    var enigmailSvc = Enigmail.getEnigmailSvc();
    if (! enigmailSvc) return;

    var origAtt, signatureAtt;

    if ((this.getAttachmentName(anAttachment).search(/\.sig$/i) > 0) ||
        (anAttachment.contentType.search(/^application\/pgp\-signature/i) == 0)) {
      // we have the .sig file; need to know the original file;

      signatureAtt = anAttachment;
      var origName = this.getAttachmentName(anAttachment).replace(/\.sig$/i, "");

      for (let i=0; i < currentAttachments.length; i++) {
        if (origName == this.getAttachmentName(currentAttachments[i])) {
          origAtt = currentAttachments[i];
          break;
        }
      }
    }
    else {
      // we have a supposedly original file; need to know the .sig file;

      origAtt = anAttachment;
      var sigName = this.getAttachmentName(anAttachment)+".sig";

      for (let i=0; i < currentAttachments.length; i++) {
        if (sigName == this.getAttachmentName(currentAttachments[i])) {
          signatureAtt = currentAttachments[i];
          break;
        }
      }
    }

    if (! signatureAtt) {
      EnigmailCommon.alert(window, EnigmailCommon.getString("attachment.noMatchToSignature", [ this.getAttachmentName(origAtt) ]));
      return;
    }
    if (! origAtt) {
      EnigmailCommon.alert(window, EnigmailCommon.getString("attachment.noMatchFromSignature", [ this.getAttachmentName(signatureAtt) ]));
      return;
    }

    // open
    var tmpDir = EnigmailCommon.getTempDir();
    var outFile1, outFile2;
    outFile1 = Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].
      createInstance(EnigmailCommon.getLocalFileApi());
    outFile1.initWithPath(tmpDir);
    if (!(outFile1.isDirectory() && outFile1.isWritable())) {
      EnigmailCommon.alert(window, EnigmailCommon.getString("noTempDir"));
      return;
    }
    outFile1.append(this.getAttachmentName(origAtt));
    outFile1.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
    this.writeUrlToFile(origAtt.url, outFile1);

    outFile2 = Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].
      createInstance(EnigmailCommon.getLocalFileApi());
    outFile2.initWithPath(tmpDir);
    outFile2.append(this.getAttachmentName(signatureAtt));
    outFile2.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
    this.writeUrlToFile(signatureAtt.url, outFile2);

    var statusFlagsObj = {};
    var errorMsgObj = {};
    var r = enigmailSvc.verifyAttachment(window, outFile1, outFile2, statusFlagsObj, errorMsgObj);

    if (r == 0)
      EnigmailCommon.alert(window, EnigmailCommon.getString("signature.verifiedOK", [ this.getAttachmentName(origAtt) ]));
    else
      EnigmailCommon.alert(window, EnigmailCommon.getString("signature.verifyFailed", [ this.getAttachmentName(origAtt) ])+"\n\n"+
        errorMsgObj.value);

    outFile1.remove(false);
    outFile2.remove(false);
  },

  writeUrlToFile: function(srcUrl, outFile) {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: writeUrlToFile: outFile="+outFile.path+"\n");
     var ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].
      getService(Components.interfaces.nsIIOService);
    var msgUri = ioServ.newURI(srcUrl, null, null);
    var channel = ioServ.newChannelFromURI(msgUri);
    var istream = channel.open();

    var fstream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"]
                          .createInstance(Components.interfaces.nsIFileOutputStream);
    var buffer  = Components.classes["@mozilla.org/network/buffered-output-stream;1"]
                            .createInstance(Components.interfaces.nsIBufferedOutputStream);
    fstream.init(outFile, 0x04 | 0x08 | 0x20, 0600, 0); // write, create, truncate
    buffer.init(fstream, 8192);

    buffer.writeFrom(istream, istream.available());

    // Close the output streams
    if (buffer instanceof Components.interfaces.nsISafeOutputStream)
      buffer.finish();
    else
      buffer.close();

    if (fstream instanceof Components.interfaces.nsISafeOutputStream)
      fstream.finish();
    else
      fstream.close();

    // Close the input stream
    istream.close()
  },

  handleAttachment: function (actionType, anAttachment)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: handleAttachment: actionType="+actionType+", anAttachment(url)="+anAttachment.url+"\n");

    var ipcBuffer = Components.classes[EnigmailCommon.IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

    var argumentsObj = { actionType: actionType,
                         attachment: anAttachment,
                         forceBrowser: false,
                         ipcBuffer: ipcBuffer
                       };

    var requestObserver = EnigmailCommon.newRequestObserver(Enigmail.msg.decryptAttachmentCallback,
                                                            argumentsObj);

    var ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

    ipcBuffer.open(-1, false);
    var msgUri = ioServ.newURI(argumentsObj.attachment.url, null, null);

    ipcBuffer.observe(requestObserver, msgUri);
    var channel = ioServ.newChannelFromURI(msgUri);
    channel.asyncOpen(ipcBuffer, msgUri);
  },

  setAttachmentName: function (attachment, newLabel, index)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: setAttachmentName ("+newLabel+"):\n");

    var attList=document.getElementById("attachmentList");
    if (attList) {
      var attNode = attList.firstChild;
      while (attNode) {
        // TB <= 9
        if (attNode.getAttribute("attachmentUrl") == attachment.url)
          attNode.setAttribute("label", newLabel);
        // TB >= 10
        if (attNode.getAttribute("name") == attachment.name)
          attNode.setAttribute("name", newLabel);
        attNode=attNode.nextSibling;
      }
    }

    if (typeof(attachment.displayName) == "undefined") {
      attachment.name = newLabel;
    }
    else
      attachment.displayName = newLabel;

    if (index && index.length > 0) {
      this.revealAttachments(parseInt(index)+1);
    }
  },

  decryptAttachmentCallback: function (cbArray)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: decryptAttachmentCallback:\n");

    var callbackArg = cbArray[0];
    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    if (callbackArg.ipcBuffer.overflowed) {
      WARNING_LOG("enigmailMessengerOverlay.js: decryptAttachmentCallback: MESSAGE BUFFER OVERFLOW\n");
    }

    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj= new Object();
    var exitStatus = -1;

    var enigmailSvc =  Enigmail.getEnigmailSvc();
    var outFile;
    var origFilename;
    var rawFileName=Enigmail.msg.getAttachmentName(callbackArg.attachment).replace(/\.(asc|pgp|gpg)$/i,"");

    if (callbackArg.actionType != "importKey") {
      origFilename = enigmailSvc.getAttachmentFileName(window, callbackArg.ipcBuffer);
      if (origFilename && origFilename.length > rawFileName.length) rawFileName = origFilename;
    }

    if (callbackArg.actionType == "saveAttachment") {
      outFile = EnigmailCommon.filePicker(window, EnigmailCommon.getString("saveAttachmentHeader"),
                                  Enigmail.msg.lastSaveDir, true, "",
                                  rawFileName, null);
      if (! outFile) return;
    }
    else if (callbackArg.actionType.substr(0,10) == "revealName") {
      if (origFilename && origFilename.length > 0) {
        Enigmail.msg.setAttachmentName(callbackArg.attachment, origFilename+".pgp", callbackArg.actionType.substr(11,10));
      }
      Enigmail.msg.setAttachmentReveal(null);
      return;
    }
    else {
      // open
      var tmpDir = EnigmailCommon.getTempDir();
      try {
        outFile = Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].createInstance(EnigmailCommon.getLocalFileApi());
        outFile.initWithPath(tmpDir);
        if (!(outFile.isDirectory() && outFile.isWritable())) {
          errorMsgObj.value=EnigmailCommon.getString("noTempDir");
          return;
        }
        outFile.append(rawFileName);
        outFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
      }
      catch (ex) {
        errorMsgObj.value=EnigmailCommon.getString("noTempDir");
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
        EnigmailCommon.longAlert(window, EnigmailCommon.getString("successKeyImport")+"\n\n"+errorMsgObj.value);
      }
      else {
        EnigmailCommon.alert(window, EnigmailCommon.getString("failKeyImport")+"\n"+errorMsgObj.value);
      }

      return;
    }

    exitStatus=enigmailSvc.decryptAttachment(window, outFile,
                                  Enigmail.msg.getAttachmentName(callbackArg.attachment),
                                  callbackArg.ipcBuffer,
                                  exitCodeObj, statusFlagsObj,
                                  errorMsgObj);

    callbackArg.ipcBuffer.shutdown();
    if ((! exitStatus) || exitCodeObj.value != 0) {
      exitStatus=false;
      if (statusFlagsObj.value &
          (nsIEnigmail.DECRYPTION_OKAY | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
        if (callbackArg.actionType == "openAttachment") {
          exitStatus = EnigmailCommon.confirmDlg(window, EnigmailCommon.getString("decryptOkNoSig"), EnigmailCommon.getString("msgOvl.button.contAnyway"));
        }
        else {
          EnigmailCommon.alert(window, EnigmailCommon.getString("decryptOkNoSig"));
        }
      }
      else {
        EnigmailCommon.alert(window, EnigmailCommon.getString("failedDecrypt")+"\n\n"+errorMsgObj.value);
        exitStatus=false;
      }
    }
    if (exitStatus) {
      if (statusFlagsObj.value & nsIEnigmail.IMPORTED_KEY) {
        EnigmailCommon.longAlert(window, EnigmailCommon.getString("successKeyImport")+"\n\n"+errorMsgObj.value);
      }
      else if (statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) {
        HandleSelectedAttachments('open');
      }
      else if ((statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) ||
               (callbackArg.actionType == "openAttachment")) {
        var ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        var outFileUri = ioServ.newFileURI(outFile);
        var fileExt = outFile.leafName.replace(/(.*\.)(\w+)$/, "$2")
        if (fileExt && ! callbackArg.forceBrowser) {
          var extAppLauncher = Components.classes[EnigmailCommon.MIME_CONTRACTID].getService(Components.interfaces.nsPIExternalAppLauncher);
          extAppLauncher.deleteTemporaryFileOnExit(outFile);

          try {
            var mimeService = Components.classes[EnigmailCommon.MIME_CONTRACTID].getService(Components.interfaces.nsIMIMEService);
            var fileMimeType = mimeService.getTypeFromFile(outFile);
            var fileMimeInfo = mimeService.getFromTypeAndExtension(fileMimeType, fileExt);

            fileMimeInfo.launchWithFile(outFile);
          }
          catch (ex) {
            // if the attachment file type is unknown, an exception is thrown,
            // so let it be handled by a browser window
            Enigmail.msg.loadExternalURL(outFileUri.asciiSpec);
          }
        }

        // open the attachment using an external application
        Enigmail.msg.loadExternalURL(outFileUri.asciiSpec);
      }
    }
  },

  loadExternalURL: function (url) {
    if (EnigmailCommon.isSuite()) {
      Enigmail.msg.loadURLInNavigatorWindow(url, true);
    }
    else {
      messenger.launchExternalURL(url);
    }
  },

  // retrieves the most recent navigator window (opens one if need be)
  loadURLInNavigatorWindow: function (url, aOpenFlag)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: loadURLInNavigatorWindow: "+url+", "+aOpenFlag+"\n");

    var navWindow;

    // if this is a browser window, just use it
    if ("document" in top) {
      var possibleNavigator = top.document.getElementById("main-window");
      if (possibleNavigator &&
          possibleNavigator.getAttribute("windowtype") == "navigator:browser")
        navWindow = top;
    }

    // if not, get the most recently used browser window
    if (!navWindow) {
      var wm;
      wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(
            Components.interfaces.nsIWindowMediator);
      navWindow = wm.getMostRecentWindow("navigator:browser");
    }

    if (navWindow) {

      if ("loadURI" in navWindow)
        navWindow.loadURI(url);
      else
        navWindow._content.location.href = url;

    } else if (aOpenFlag) {
      // if no browser window available and it's ok to open a new one, do so
      navWindow = window.open(url, "Enigmail");
    }

    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: loadURLInNavigatorWindow: navWindow="+navWindow+"\n");

    return navWindow;
  },

  // handle double click events on Attachments
  enigAttachmentListClick: function (elementId, event)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: enigAttachmentListClick: event="+event+"\n");

    var attachment=event.target.attachment;
    if (this.checkEncryptedAttach(attachment)) {
      if (event.button != 0) return;

      if (event.detail == 2) { // double click
        this.handleAttachment("openAttachment", attachment);
        event.stopPropagation();
      }
    }
  },

  // download keys
  handleUnknownKey: function ()
  {
    var pubKeyId = "0x" + Enigmail.msg.securityInfo.keyId.substr(8, 8);

    var mesg =  EnigmailCommon.getString("pubKeyNeeded") + EnigmailCommon.getString("keyImport", [pubKeyId]);

    if (EnigmailCommon.confirmDlg(window, mesg, EnigmailCommon.getString("keyMan.button.import"))) {
      var inputObj = {
        searchList : [ pubKeyId ]
      };
      var resultObj = new Object();

      EnigmailFuncs.downloadKeys(window, inputObj, resultObj);

      if (resultObj.importedKeys > 0) {
        this.messageReload(false);
      }
    }
  },

  createFileStream: function (filePath, permissions)
  {
    const DEFAULT_FILE_PERMS = 0600;
    const WRONLY             = 0x02;
    const CREATE_FILE        = 0x08;
    const TRUNCATE           = 0x20;

    try {
      var localFile = Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].
        createInstance(EnigmailCommon.getLocalFileApi());

      localFile.initWithPath(filePath);

      if (localFile.exists()) {

        if (localFile.isDirectory() || !localFile.isWritable())
           throw Components.results.NS_ERROR_FAILURE;

        if (!permissions)
          permissions = localFile.permissions;
      }

      if (!permissions)
        permissions = DEFAULT_FILE_PERMS;

      var flags = WRONLY | CREATE_FILE | TRUNCATE;

      var fileStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
                        createInstance(Components.interfaces.nsIFileOutputStream);

      fileStream.init(localFile, flags, permissions, 0);

      return fileStream;

    } catch (ex) {
      EnigmailCommon.ERROR_LOG("enigmailMessengerOverlay.js: createFileStream: Failed to create "+filePath+"\n");
      return null;
    }
  },

  writeFileContents: function (filePath, data, permissions)
  {

    try {
      var fileOutStream = this.createFileStream(filePath, permissions);

      if (data.length) {
        if (fileOutStream.write(data, data.length) != data.length)
          throw Components.results.NS_ERROR_FAILURE;

        fileOutStream.flush();
      }
      fileOutStream.close();

    } catch (ex) {
      EnigmailCommon.ERROR_LOG("enigmailMessengerOverlay.js: writeFileContents: Failed to write to "+filePath+"\n");
      return false;
    }

    return true;
  }
};

window.addEventListener("load",   Enigmail.msg.messengerStartup, false);

