/*global Ci: false, Cc: false, Cu: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

/* globals from Thunderbird: */
/* global ReloadMessage: false, gDBView: false, gSignatureStatus: false, gEncryptionStatus: false, showMessageReadSecurityInfo: false */
/* global gFolderDisplay: false, messenger: false, currentAttachments: false, msgWindow: false, PanelUI: false */
/* global currentHeaderData: false, gViewAllHeaders: false, gExpandedHeaderList: false, goDoCommand: false, HandleSelectedAttachments: false */
/* global statusFeedback: false, global displayAttachmentsForExpandedView: false, global gMessageListeners: false, global gExpandedHeaderView */

var EnigmailTb60Compat = ChromeUtils.import("chrome://autocrypt/content/modules/tb60compat.jsm").EnigmailTb60Compat;
var EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
var EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
var EnigmailMsgRead = ChromeUtils.import("chrome://autocrypt/content/modules/msgRead.jsm").EnigmailMsgRead;
var EnigmailVerify = ChromeUtils.import("chrome://autocrypt/content/modules/mimeVerify.jsm").EnigmailVerify;
var EnigmailFixExchangeMsg = ChromeUtils.import("chrome://autocrypt/content/modules/fixExchangeMsg.jsm").EnigmailFixExchangeMsg;
var EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
var EnigmailPrefs = ChromeUtils.import("chrome://autocrypt/content/modules/prefs.jsm").EnigmailPrefs;
var EnigmailOS = ChromeUtils.import("chrome://autocrypt/content/modules/os.jsm").EnigmailOS;
var EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
var EnigmailFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").EnigmailFiles;
var EnigmailKey = ChromeUtils.import("chrome://autocrypt/content/modules/key.jsm").EnigmailKey;
var EnigmailData = ChromeUtils.import("chrome://autocrypt/content/modules/data.jsm").EnigmailData;
var EnigmailApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").EnigmailApp;
var EnigmailDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").EnigmailTimer;
var EnigmailWindows = ChromeUtils.import("chrome://autocrypt/content/modules/windows.jsm").EnigmailWindows;
var EnigmailTime = ChromeUtils.import("chrome://autocrypt/content/modules/time.jsm").EnigmailTime;
var EnigmailPersistentCrypto = ChromeUtils.import("chrome://autocrypt/content/modules/persistentCrypto.jsm").EnigmailPersistentCrypto;
var EnigmailStreams = ChromeUtils.import("chrome://autocrypt/content/modules/streams.jsm").EnigmailStreams;
var EnigmailEvents = ChromeUtils.import("chrome://autocrypt/content/modules/events.jsm").EnigmailEvents;
var EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
var EnigmailDecryption = ChromeUtils.import("chrome://autocrypt/content/modules/decryption.jsm").EnigmailDecryption;
var EnigmailConstants = ChromeUtils.import("chrome://autocrypt/content/modules/constants.jsm").EnigmailConstants;
var EnigmailURIs = ChromeUtils.import("chrome://autocrypt/content/modules/uris.jsm").EnigmailURIs;
var EnigmailProtocolHandler = ChromeUtils.import("chrome://autocrypt/content/modules/protocolHandler.jsm").EnigmailProtocolHandler;
var EnigmailAutocrypt = ChromeUtils.import("chrome://autocrypt/content/modules/autocrypt.jsm").EnigmailAutocrypt;
var EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
var EnigmailArmor = ChromeUtils.import("chrome://autocrypt/content/modules/armor.jsm").EnigmailArmor;
var EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;
var EnigmailConfigure = ChromeUtils.import("chrome://autocrypt/content/modules/configure.jsm").EnigmailConfigure;
var AutocryptQuickFilter = ChromeUtils.import("chrome://autocrypt/content/modules/quickFilter.jsm").AutocryptQuickFilter;
var jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
var Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

var Enigmail;
if (!Enigmail) {
  Enigmail = {};
}

Enigmail.getEnigmailSvc = function() {
  return EnigmailCore.getService(window);
};

Enigmail.msg = {
  createdURIs: [],
  decryptedMessage: null,
  securityInfo: null,
  lastSaveDir: "",
  messagePane: null,
  noShowReload: false,
  decryptButton: null,
  savedHeaders: null,
  removeListener: false,
  enableExperiments: false,
  headersList: ["content-transfer-encoding",
    "x-enigmail-version", "x-pgp-encoding-format",
    "autocrypt-setup-message"
  ],
  buggyExchangeEmailContent: null, // for HACK for MS-EXCHANGE-Server Problem
  buggyMailType: null,
  changedAttributes: [],
  lastSMimeReloadURI: "",

  messengerStartup: function() {

    let self = this;

    // private function to overwrite attributes
    function overrideAttribute(elementIdList, attrName, prefix, suffix) {
      for (var index = 0; index < elementIdList.length; index++) {
        var elementId = elementIdList[index];
        var element = document.getElementById(elementId);
        if (element) {
          try {
            var oldValue = element.getAttribute(attrName);
            EnigmailLog.DEBUG("enigmailMessengerOverlay.js: overrideAttribute " + attrName + ": oldValue=" + oldValue + "\n");
            var newValue = prefix + elementId + suffix;

            element.setAttribute(attrName, newValue);
            self.changedAttributes.push({
              id: elementId,
              attrib: attrName,
              value: oldValue
            });
          } catch (ex) {}
        } else {
          EnigmailLog.DEBUG("enigmailMessengerOverlay.js: *** UNABLE to override id=" + elementId + "\n");
        }
      }
    }

    // let t = document.getElementById("tabmail");

    // if (t) {
      // TB >= 63
    // t.addEventListener("pageshow", function(e) {
    // if (e.type === "pageshow" && e.target.URL === "about:preferences") {
    // let Overlays = ChromeUtils.import("chrome://autocrypt/content/modules/overlays.jsm", {}).Overlays;
    // Overlays.loadOverlays("Enigmail", e.target.defaultView, ["chrome://autocrypt/content/ui/enigmailPrivacyOverlay.xul"]);
    // }
    // }, false);
    // }

    // let customizeToolbar = document.getElementById("customizeToolbarSheetIFrame");
    // customizeToolbar.addEventListener("pageshow", function(event) {
    // let Overlays = ChromeUtils.import("chrome://autocrypt/content/modules/overlays.jsm", {}).Overlays;
    // Overlays.loadOverlays("Enigmail", event.target.defaultView, ["chrome://autocrypt/content/ui/enigmailCustToolOverlay.xul"]);
    // }, false);

    Enigmail.msg.messagePane = document.getElementById("messagepane");

    if (!window.syncGridColumnWidthsOriginal) {
      window.syncGridColumnWidthsOriginal = window.syncGridColumnWidths;
      window.syncGridColumnWidths = autocryptSyncGridColumnWidths;
    }

    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: Startup\n");

    // Override SMIME ui
    overrideAttribute(["cmd_viewSecurityStatus"], "Enigmail.msg.viewSecurityInfo(null, true);", "", "");

    // Override print command
    var printElementIds = ["cmd_print", "cmd_printpreview", "key_print", "button-print",
      "mailContext-print", "mailContext-printpreview"
    ];

    overrideAttribute(printElementIds, "oncommand",
      "Enigmail.msg.msgPrint('", "');");

    //Enigmail.msg.overrideLayoutChange();
    Enigmail.msg.prepareAppMenu();
    Enigmail.msg.setMainMenuLabel();

    let statusCol = document.getElementById("enigmailStatusCol");
    if (statusCol) {
      statusCol.setAttribute("label", EnigmailLocale.getString("enigmail.msgViewColumn.label"));
    }

    Enigmail.msg.savedHeaders = null;

    Enigmail.msg.decryptButton = document.getElementById("button-enigmail-decrypt");

    // Need to add event listener to Enigmail.msg.messagePane to make it work
    // Adding to msgFrame doesn't seem to work
    Enigmail.boundMessageFrameUnload = Enigmail.msg.messageFrameUnload.bind(Enigmail.msg);
    Enigmail.msg.messagePane.addEventListener("unload", Enigmail.boundMessageFrameUnload, true);

    AutocryptQuickFilter.registerButtonHandler(document);

    this.treeController = {
      supportsCommand: function(command) {
        // EnigmailLog.DEBUG("enigmailMessengerOverlay.js: treeCtrl: supportsCommand: "+command+"\n");
        switch (command) {
          case "button_enigmail_decrypt":
            return true;
        }
        return false;
      },
      isCommandEnabled: function(command) {
        // EnigmailLog.DEBUG("enigmailMessengerOverlay.js: treeCtrl: isCommandEnabled: "+command+"\n");
        try {
          if (gFolderDisplay.messageDisplay.visible) {
            if (gFolderDisplay.selectedCount != 1) {
              Enigmail.hdrView.statusBarHide();
            }
            return (gFolderDisplay.selectedCount == 1);
          }
          Enigmail.hdrView.statusBarHide();
        } catch (ex) {}
        return false;
      },
      doCommand: function(command) {
        //EnigmailLog.DEBUG("enigmailMessengerOverlay.js: treeCtrl: doCommand: "+command+"\n");
        // nothing
      },
      onEvent: function(event) {
        // EnigmailLog.DEBUG("enigmailMessengerOverlay.js: treeCtrl: onEvent: "+command+"\n");
        // nothing
      }
    };

    top.controllers.appendController(this.treeController);

    if (EnigmailPrefs.getPref("configuredVersion") === "") {
      EnigmailConfigure.configureEnigmail(window, false);
    }

    EnigmailMsgRead.ensureExtraAddonHeaders();
    gMessageListeners.push(Enigmail.msg.messageListener);
    Enigmail.msg.messageListener.onEndHeaders();
  },

  messageListener: {
    onStartHeaders: function() {
      Enigmail.msg.mimeParts = null;
      if ("autocrypt" in gExpandedHeaderView) {
        delete gExpandedHeaderView.autocrypt;
      }
      if ("openpgp" in gExpandedHeaderView) {
        delete gExpandedHeaderView.openpgp;
      }
    },
    onEndHeaders: function() {},
    onEndAttachments: function() {}
  },

  viewSecurityInfo: function(event, displaySmimeMsg) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: viewSecurityInfo\n");

    if (event && event.button !== 0) {
      return;
    }

    if (gSignatureStatus >= 0 || gEncryptionStatus >= 0) {
      showMessageReadSecurityInfo();
    } else {
      if (Enigmail.msg.securityInfo) {
        this.viewOpenpgpInfo();
      } else {
        showMessageReadSecurityInfo();
      }
    }
  },

  viewOpenpgpInfo: function() {
    if (Enigmail.msg.securityInfo) {
      EnigmailDialog.info(window, EnigmailLocale.getString("securityInfo") + Enigmail.msg.securityInfo.statusInfo);
    }
  },

  clearLastMessage: function() {
    const {
      EnigmailSingletons
    } = ChromeUtils.import("chrome://autocrypt/content/modules/singletons.jsm");
    EnigmailSingletons.clearLastDecryptedMessage();
  },

  messageReload: function(noShowReload) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: messageReload: " + noShowReload + "\n");

    Enigmail.msg.noShowReload = noShowReload;
    this.clearLastMessage();
    ReloadMessage();
  },

  messengerClose: function() {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: messengerClose()\n");
  },

  reloadCompleteMsg: function() {
    this.clearLastMessage();
    gDBView.reloadMessageWithAllParts();
  },

  messageCleanup: function() {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: messageCleanup\n");

    let exchBox = document.getElementById("enigmailBrokenExchangeBox");
    if (exchBox) {
      exchBox.setAttribute("collapsed", "true");
    }

    if (Enigmail.msg.createdURIs.length) {
      // Cleanup messages belonging to this window (just in case)
      var enigmailSvc = Enigmail.getEnigmailSvc();
      if (enigmailSvc) {
        EnigmailLog.DEBUG("enigmailMessengerOverlay.js: Cleanup: Deleting messages\n");
        for (var index = 0; index < Enigmail.msg.createdURIs.length; index++) {
          EnigmailURIs.deleteMessageURI(Enigmail.msg.createdURIs[index]);
        }
        Enigmail.msg.createdURIs = [];
      }
    }

    Enigmail.msg.decryptedMessage = null;
    Enigmail.msg.securityInfo = null;
  },

  messageFrameUnload: function() {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: messageFrameUnload\n");

    if (Enigmail.msg.noShowReload) {
      Enigmail.msg.noShowReload = false;

    } else {
      Enigmail.msg.savedHeaders = null;

      Enigmail.msg.messageCleanup();
    }
  },

  getCurrentMsgUriSpec: function() {
    try {
      if (gFolderDisplay.selectedMessages.length != 1) {
        return "";
      }

      var uriSpec = gFolderDisplay.selectedMessageUris[0];
      //EnigmailLog.DEBUG("enigmailMessengerOverlay.js: getCurrentMsgUriSpec: uriSpec="+uriSpec+"\n");

      return uriSpec;
    } catch (ex) {
      return "";
    }
  },

  getCurrentMsgUrl: function() {
    var uriSpec = this.getCurrentMsgUriSpec();
    return EnigmailMsgRead.getUrlFromUriSpec(uriSpec);
  },

  updateOptionsDisplay: function() {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: updateOptionsDisplay: \n");
    var optList = ["autoDecrypt"];

    for (let j = 0; j < optList.length; j++) {
      let menuElement = document.getElementById("enigmail_" + optList[j]);
      menuElement.setAttribute("checked", EnigmailPrefs.getPref(optList[j]) ? "true" : "false");

      menuElement = document.getElementById("enigmail_" + optList[j] + "2");
      if (menuElement) {
        menuElement.setAttribute("checked", EnigmailPrefs.getPref(optList[j]) ? "true" : "false");
      }
    }

    optList = ["decryptverify"];
    for (let j = 0; j < optList.length; j++) {
      let menuElement = document.getElementById("enigmail_" + optList[j]);
      if (Enigmail.msg.decryptButton && Enigmail.msg.decryptButton.disabled) {
        menuElement.setAttribute("disabled", "true");
      } else {
        menuElement.removeAttribute("disabled");
      }

      menuElement = document.getElementById("enigmail_" + optList[j] + "2");
      if (menuElement) {
        if (Enigmail.msg.decryptButton && Enigmail.msg.decryptButton.disabled) {
          menuElement.setAttribute("disabled", "true");
        } else {
          menuElement.removeAttribute("disabled");
        }
      }
    }
  },

  setMainMenuLabel: function() {
    /*
    let o = ["menu_Enigmail", "appmenu-Enigmail"];

    let m0 = document.getElementById(o[0]);
    let m1 = document.getElementById(o[1]);

    m1.setAttribute("enigmaillabel", m0.getAttribute("enigmaillabel"));

    for (let menuId of o) {
      let menu = document.getElementById(menuId);

      if (menu) {
        let lbl = menu.getAttribute("enigmaillabel");
        menu.setAttribute("label", lbl);
      }
    }
    */
  },

  prepareAppMenu: function() {
    let menu = document.querySelector("#appMenu-preferencesView > vbox");
    if (!menu) return;

    let tsk = document.getElementById("appmenu_accountmgr");
    let e = document.createXULElement("toolbarbutton");
    e.setAttribute("label", "Autocrypt Settings");
    e.id = "appmenu-Enigmail";
    e.setAttribute("class", "subviewbutton subviewbutton-iconic autocryptIconBw");
    e.setAttribute("closemenu", "none");
    e.setAttribute("oncommand", "EnigmailWindows.openAutocryptSettings(window)");
    menu.insertBefore(e, tsk.nextSibling);
  },

  displayAppmenu: function(targetId, targetObj) {
    let menuElem = document.getElementById("appmenu_enigmailMenuPlaceholder");
    PanelUI.showSubView(targetId, targetObj);
  },

  displayMainMenu: function(menuPopup) {
  },

  toggleAttribute: function(attrName) {
    EnigmailLog.DEBUG("enigmailMsgessengerOverlay.js: toggleAttribute('" + attrName + "')\n");

    var menuElement = document.getElementById("enigmail_" + attrName);

    var oldValue = EnigmailPrefs.getPref(attrName);
    EnigmailPrefs.setPref(attrName, !oldValue);

    this.updateOptionsDisplay();

    if (attrName == "autoDecrypt") {
      this.messageReload(false);
    }
  },

  /***
   * check that handler for multipart/signed is set to Enigmail.
   * if handler is different, change it and reload message
   *
   * @return: - true if handler is OK
   *          - false if handler was changed and message is reloaded
   */
  checkPgpmimeHandler: function() {
    let uriSpec = this.getCurrentMsgUriSpec();
    if (uriSpec !== this.lastSMimeReloadURI) {
      if (EnigmailVerify.currentCtHandler !== EnigmailConstants.MIME_HANDLER_PGPMIME) {
        this.lastSMimeReloadURI = uriSpec;
        EnigmailVerify.registerContentTypeHandler();
        this.messageReload();
        return false;
      }
    }

    return true;
  },

  // callback function for automatic decryption
  messageAutoDecrypt: function() {
    // TODO get rid of this?
    Enigmail.msg.messageDecrypt(null, true);
  },

  // analyse message header and decrypt/verify message
  messageDecrypt: function(event) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: messageDecrypt\n");

    event = event ? true : false;

    this.mimeParts = null;

    let contentType = "text/plain";
    if ('content-type' in currentHeaderData) {
      contentType = currentHeaderData['content-type'].headerValue;
    }

    // don't parse message if we know it's a PGP/MIME message
    if (contentType.search(/^multipart\/encrypted(;|$)/i) === 0 && contentType.search(/application\/pgp-encrypted/i) > 0) {
      return;
    } else if (contentType.search(/^multipart\/signed(;|$)/i) === 0 && contentType.search(/application\/pgp-signature/i) > 0) {
      return;
    }

    this.processAutocryptHeaders();
    this.processAutocryptSetupMessage();
  },

  /***
   * walk through the (sub-) mime tree and determine PGP/MIME encrypted and signed message parts
   *
   * @param mimePart:  parent object to walk through
   * @param resultObj: object containing two arrays. The resultObj must be pre-initialized by the caller
   *                    - encrypted
   *                    - signed
   */
  enumerateMimeParts: function(mimePart, resultObj) {
    EnigmailLog.DEBUG("enumerateMimeParts: partNum=\"" + mimePart.partNum + "\"\n");
    EnigmailLog.DEBUG("                    " + mimePart.fullContentType + "\n");
    EnigmailLog.DEBUG("                    " + mimePart.subParts.length + " subparts\n");

    try {
      var ct = mimePart.fullContentType;
      if (typeof(ct) == "string") {
        ct = ct.replace(/[\r\n]/g, " ");
        if (ct.search(/multipart\/signed.*application\/pgp-signature/i) >= 0) {
          resultObj.signed.push(mimePart.partNum);
        } else if (ct.search(/application\/pgp-encrypted/i) >= 0) {
          resultObj.encrypted.push(mimePart.partNum);
        }
      }
    } catch (ex) {
      // catch exception if no headers or no content-type defined.
    }

    var i;
    for (i in mimePart.subParts) {
      this.enumerateMimeParts(mimePart.subParts[i], resultObj);
    }
  },

  processAutocryptHeaders: function() {
    if (!("autocrypt" in currentHeaderData)) {
      EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptHeaders: no autocrypt header\n");
      return;
    }
    if (!("from" in currentHeaderData)) {
      EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptHeaders: no from\n");
      return;
    }
    if (!("date" in currentHeaderData)) {
      EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptHeaders: no date\n");
      return;
    }

    let effective_date;
    try {
      effective_date = jsmime.headerparser.parseDateHeader(currentHeaderData.date.headerValue);
    } catch (ex) {
      EnigmailLog.ERROR("enigmailMessengerOverlay.js: processAutocryptHeaders: failed parsing date header\n");
      return;
    }

    let autocrypt_headers = [];
    for (let h in currentHeaderData) {
      if (h.search(/^autocrypt\d*$/) === 0) {
        autocrypt_headers.push(currentHeaderData[h].headerValue);
      }
    }

    if (!autocrypt_headers.length) {
      EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptHeaders: no autocrypt headers found\n");
      return;
    }

    EnigmailAutocrypt.processAutocryptHeaders(
      currentHeaderData.from.headerValue,
      autocrypt_headers,
      effective_date
    );

    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptHeaders: ok:\n");
  },

  processAutocryptSetupMessage: function() {
    if (!("autocrypt-setup-message" in currentHeaderData)) {
      return;
    }

    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptSetupMessage: found autocrypt setup message\n");

    if (currentHeaderData["autocrypt-setup-message"].headerValue.toLowerCase() !== "v1") {
      EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptSetupMessage: version is not v1\n");
      return;
    }

    if (!currentAttachments.length || currentAttachments[0].contentType.search(/^application\/autocrypt-setup$/i) !== 0) {
      EnigmailLog.DEBUG("enigmailMessengerOverlay.js: processAutocryptSetupMessage: no setup message attachment\n");
      return;
    }

    Enigmail.hdrView.displayAutoCryptSetupMessage(currentAttachments[0].url);
  },

  // display header about reparing buggy MS-Exchange messages
  buggyMailHeader: function() {
    let uriStr = EnigmailURIs.createMessageURI(this.getCurrentMsgUrl(),
      "message/rfc822",
      "",
      "??",
      false);

    let ph = new EnigmailProtocolHandler();
    let uri = ph.newURI(uriStr, "", "");
    Enigmail.hdrView.headerPane.updateSecurityStatus("", 0, "", "", "", "", "", uri, "", "1");
  },

  hasInlineQuote: function(node) {
    if (node.innerHTML.search(/<blockquote.*-----BEGIN PGP /i) < 0) {
      return false;
    }

    return EnigmailMsgRead.searchQuotedPgp(node);
  },

  getBodyElement: function() {
    let bodyElement = this.messagePane.getElementsByTagName("body")[0];
    return bodyElement;
  },


  importKeyFromMsgBody: function(msgData) {
    let beginIndexObj = {};
    let endIndexObj = {};
    let indentStrObj = {};
    let blockType = EnigmailArmor.locateArmoredBlock(msgData, 0, "", beginIndexObj, endIndexObj, indentStrObj);
    if (!blockType || blockType !== "PUBLIC KEY BLOCK") {
      return;
    }

    let keyData = msgData.substring(beginIndexObj.value, endIndexObj.value);

    let errorMsgObj = {};
    let preview = EnigmailKey.getKeyListFromKeyBlock(keyData, errorMsgObj);
    if (errorMsgObj.value === "") {
      this.importKeyDataWithConfirmation(preview, keyData);
    } else {
      EnigmailDialog.alert(window, EnigmailLocale.getString("previewFailed") + "\n" + errorMsgObj.value);
    }
  },

  importKeyDataWithConfirmation: function(preview, keyData) {
    let exitStatus = -1,
      errorMsgObj = {};
    if (preview.length > 0) {
      if (preview.length == 1) {
        exitStatus = EnigmailDialog.confirmDlg(window, EnigmailLocale.getString("doImportOne", [preview[0].name, preview[0].id]));
      } else {
        exitStatus = EnigmailDialog.confirmDlg(window,
          EnigmailLocale.getString("doImportMultiple", [
            preview.map(function(a) {
              return "\t" + a.name + " (" + a.id + ")";
            }).join("\n")
          ]));
      }

      if (exitStatus) {
        try {
          exitStatus = EnigmailKeyRing.importKey(window, false, keyData, "", errorMsgObj);
        } catch (ex) {}

        if (exitStatus === 0) {
          var keyList = preview.map(function(a) {
            return a.id;
          });
          EnigmailDialog.keyImportDlg(window, keyList);
        } else {
          EnigmailDialog.alert(window, EnigmailLocale.getString("failKeyImport") + "\n" + errorMsgObj.value);
        }
      }
    } else {
      EnigmailDialog.alert(window, EnigmailLocale.getString("noKeyFound"));
    }
  },

  /**
   * Fix broken PGP/MIME messages from MS-Exchange by replacing the broken original
   * message with a fixed copy.
   *
   * no return
   */
  fixBuggyExchangeMail: function() {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: fixBuggyExchangeMail:\n");

    function hideAndResetExchangePane() {
      document.getElementById("enigmailBrokenExchangeBox").setAttribute("collapsed", "true");
      document.getElementById("enigmailFixBrokenMessageProgress").setAttribute("collapsed", "true");
      document.getElementById("enigmailFixBrokenMessageButton").removeAttribute("collapsed");
    }

    document.getElementById("enigmailFixBrokenMessageButton").setAttribute("collapsed", "true");
    document.getElementById("enigmailFixBrokenMessageProgress").removeAttribute("collapsed");

    let msg = gFolderDisplay.messageDisplay.displayedMessage;

    let p = EnigmailFixExchangeMsg.fixExchangeMessage(msg, this.buggyMailType);
    p.then(
      function _success(msgKey) {
        // display message with given msgKey

        EnigmailLog.DEBUG("enigmailMessengerOverlay.js: fixBuggyExchangeMail: _success: msgKey=" + msgKey + "\n");

        if (msgKey) {
          let index = gFolderDisplay.view.dbView.findIndexFromKey(msgKey, true);
          EnigmailLog.DEBUG("  ** index = " + index + "\n");

          EnigmailTimer.setTimeout(function() {
            gFolderDisplay.view.dbView.selectMsgByKey(msgKey);
          }, 750);
        }

        hideAndResetExchangePane();
      }
    );
    p.catch(function _rejected() {
      EnigmailDialog.alert(window, EnigmailLocale.getString("fixBrokenExchangeMsg.failed"));
      hideAndResetExchangePane();
    });
  },

  /**
   * Hide attachments containing OpenPGP keys
   */
  hidePgpKeys: function() {
    let keys = [];
    for (let i = 0; i < currentAttachments.length; i++) {
      if (currentAttachments[i].contentType.search(/^application\/pgp-keys/i) === 0) {
        keys.push(i);
      }
    }

    if (keys.length > 0) {
      let attachmentList = document.getElementById("attachmentList");

      for (let i = keys.length; i > 0; i--) {
        currentAttachments.splice(keys[i - 1], 1);
      }

      if (attachmentList) {
        // delete all keys from attachment list
        while (attachmentList.firstChild) {
          attachmentList.removeChild(attachmentList.firstChild);
        }

        // build new attachment list

        /* global gBuildAttachmentsForCurrentMsg: true */
        let orig = gBuildAttachmentsForCurrentMsg;
        gBuildAttachmentsForCurrentMsg = false;
        displayAttachmentsForExpandedView();
        gBuildAttachmentsForCurrentMsg = orig;
      }
    }

  },

  /**
   * Attempt to work around bug with headers of MS-Exchange message.
   * Reload message content
   *
   * @return: true:  message displayed
   *          false: could not handle message
   */
  displayBuggyExchangeMail: function() {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: displayBuggyExchangeMail\n");
    let hdrs = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    hdrs.initialize(this.buggyExchangeEmailContent);
    let ct = hdrs.extractHeader("content-type", true);

    if (ct && ct.search(/^text\/plain/i) === 0) {
      let bi = this.buggyExchangeEmailContent.search(/\r?\n/);
      let boundary = this.buggyExchangeEmailContent.substr(2, bi - 2);
      let startMsg = this.buggyExchangeEmailContent.search(/\r?\n\r?\n/);
      let msgText;

      if (this.buggyMailType == "exchange") {
        msgText = 'Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="' + boundary + '"\r\n' +
          this.buggyExchangeEmailContent.substr(startMsg);
      } else {
        msgText = 'Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="' + boundary + '"\r\n' +
          "\r\n" + boundary + "\r\n" +
          "Content-Type: application/pgp-encrypted\r\n" +
          "Content-Description: PGP/MIME version identification\r\n\r\n" +
          "Version: 1\r\n\r\n" +
          this.buggyExchangeEmailContent.substr(startMsg).replace(/^Content-Type: +application\/pgp-encrypted/im,
            "Content-Type: application/octet-stream");

      }

      let enigmailSvc = Enigmail.getEnigmailSvc();
      if (!enigmailSvc) {
        return false;
      }

      let uri = EnigmailURIs.createMessageURI(this.getCurrentMsgUrl(),
        "message/rfc822",
        "",
        msgText,
        false);

      EnigmailVerify.setMsgWindow(msgWindow, null);
      messenger.loadURL(window, uri);

      // Thunderbird
      let atv = document.getElementById("attachmentView");
      if (atv) {
        atv.setAttribute("collapsed", "true");
      }

      // SeaMonkey
      let eab = document.getElementById("expandedAttachmentBox");
      if (eab) {
        eab.setAttribute("collapsed", "true");
      }

      return true;
    }

    return false;
  },

  getDecryptedMessage: function(contentType, includeHeaders) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: getDecryptedMessage: " + contentType + ", " + includeHeaders + "\n");

    if (!Enigmail.msg.decryptedMessage) {
      return "No decrypted message found!\n";
    }

    var enigmailSvc = Enigmail.getEnigmailSvc();
    if (!enigmailSvc) {
      return "";
    }

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
            let msgHdr = {
              "From": msg.author,
              "Subject": msg.subject,
              "To": msg.recipients,
              "Cc": msg.ccList,
              "Date": EnigmailTime.getDateTime(msg.dateInSeconds, true, true)
            };


            if (gFolderDisplay.selectedMessageIsNews) {
              if (currentHeaderData.newsgroups) {
                msgHdr.Newsgroups = currentHeaderData.newsgroups.headerValue;
              }
            }

            for (let headerName in msgHdr) {
              if (msgHdr[headerName] && msgHdr[headerName].length > 0) {
                contentData += headerName + ": " + msgHdr[headerName] + "\r\n";
              }
            }

          }
        } catch (ex) {
          // the above seems to fail every now and then
          // so, here is the fallback
          for (let headerName in headerList) {
            let headerValue = headerList[headerName];
            contentData += headerName + ": " + headerValue + "\r\n";
          }
        }

        contentData += "Content-Type: text/plain";

        if (Enigmail.msg.decryptedMessage.charset) {
          contentData += "; charset=" + Enigmail.msg.decryptedMessage.charset;
        }

        contentData += "\r\n";
      }

      contentData += "\r\n";

      if (Enigmail.msg.decryptedMessage.hasAttachments && (!Enigmail.msg.decryptedMessage.attachmentsEncrypted)) {
        contentData += EnigmailData.convertFromUnicode(EnigmailLocale.getString("enigContentNote"), Enigmail.msg.decryptedMessage.charset);
      }

      contentData += Enigmail.msg.decryptedMessage.plainText;
    } else {
      // text/html or text/plain

      if (contentType == "text/html") {
        contentData += "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=" + Enigmail.msg.decryptedMessage.charset + "\">\r\n";
        contentData += "<html><head></head><body>\r\n";
      }

      if (statusLine) {
        if (contentType == "text/html") {
          contentData += "<b>" + EnigmailLocale.getString("enigHeader") + "</b> " +
            EnigmailMsgRead.escapeTextForHTML(statusLine, false) + "<br>\r\n<hr>\r\n";
        } else {
          contentData += EnigmailLocale.getString("enigHeader") + " " + statusLine + "\r\n\r\n";
        }
      }

      if (includeHeaders) {
        for (headerName in headerList) {
          let headerValue = headerList[headerName];

          if (headerValue) {
            if (contentType == "text/html") {
              contentData += "<b>" + EnigmailMsgRead.escapeTextForHTML(headerName, false) + ":</b> " +
                EnigmailMsgRead.escapeTextForHTML(headerValue, false) + "<br>\r\n";
            } else {
              contentData += headerName + ": " + headerValue + "\r\n";
            }
          }
        }
      }

      if (contentType == "text/html") {
        contentData += "<pre>" + EnigmailMsgRead.escapeTextForHTML(Enigmail.msg.decryptedMessage.plainText, false) + "</pre>\r\n";

        contentData += "</body></html>\r\n";
      } else {
        contentData += "\r\n" + Enigmail.msg.decryptedMessage.plainText;
      }

      if (!(EnigmailOS.isDosLike)) {
        contentData = contentData.replace(/\r\n/g, "\n");
      }
    }

    return contentData;
  },


  msgDefaultPrint: function(elementId) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: this.msgDefaultPrint: " + elementId + "\n");

    goDoCommand(elementId.indexOf("printpreview") >= 0 ? "cmd_printpreview" : "cmd_print");
  },

  msgPrint: function(elementId) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: msgPrint: " + elementId + "\n");

    var contextMenu = (elementId.search("Context") > -1);

    if (!Enigmail.msg.decryptedMessage || typeof(Enigmail.msg.decryptedMessage) == "undefined") {
      this.msgDefaultPrint(elementId);
      return;
    }

    var mailNewsUrl = this.getCurrentMsgUrl();

    if (!mailNewsUrl) {
      this.msgDefaultPrint(elementId);
      return;
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

    var uri = EnigmailURIs.createMessageURI(Enigmail.msg.decryptedMessage.url,
      "message/rfc822",
      "",
      msgContent,
      false);
    Enigmail.msg.createdURIs.push(uri);

    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: msgPrint: uri=" + uri + "\n");

    var messageList = [uri];
    var printPreview = (elementId.indexOf("printpreview") >= 0);

    window.openDialog("chrome://messenger/content/msgPrintEngine.xul",
      "",
      "chrome,dialog=no,all,centerscreen",
      1, messageList, statusFeedback,
      printPreview, Ci.nsIMsgPrintEngine.MNAB_PRINTPREVIEW_MSG,
      window);

    return;
  },

  msgDirectDecrypt: function(interactive, importOnly, contentEncoding, charset, signature,
    bufferSize, head, tail, msgUriSpec, callbackFunction) {
    EnigmailLog.WRITE("enigmailMessengerOverlay.js: msgDirectDecrypt: contentEncoding=" + contentEncoding + ", signature=" + signature + "\n");
    var mailNewsUrl = this.getCurrentMsgUrl();
    if (!mailNewsUrl) {
      return;
    }

    var callbackArg = {
      interactive: interactive,
      importOnly: importOnly,
      contentEncoding: contentEncoding,
      charset: charset,
      messageUrl: mailNewsUrl.spec,
      msgUriSpec: msgUriSpec,
      signature: signature,
      data: "",
      head: head,
      tail: tail,
      callbackFunction: callbackFunction
    };

    var msgSvc = messenger.messageServiceFromURI(msgUriSpec);

    var listener = {
      QueryInterface: EnigmailTb60Compat.generateQI(["nsIStreamListener"]),
      onStartRequest: function() {
        this.data = "";
        this.inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);

      },
      onStopRequest: function() {
        var start = this.data.indexOf("-----BEGIN PGP");
        var end = this.data.indexOf("-----END PGP");

        if (start >= 0 && end > start) {
          var tStr = this.data.substr(end);
          var n = tStr.indexOf("\n");
          var r = tStr.indexOf("\r");
          var lEnd = -1;
          if (n >= 0 && r >= 0) {
            lEnd = Math.min(r, n);
          } else if (r >= 0) {
            lEnd = r;
          } else if (n >= 0) {
            lEnd = n;
          }

          if (lEnd >= 0) {
            end += lEnd;
          }

          callbackArg.data = this.data.substring(start, end + 1);
          EnigmailLog.DEBUG("enigmailMessengerOverlay.js: data: >" + callbackArg.data + "<\n");
          Enigmail.msg.msgDirectCallback(callbackArg);
        }
      }
    };

    if (EnigmailTb60Compat.isMessageUriInPgpMime()) {
      // TB >= 67
      listener.onDataAvailable = function(req, stream, offset, count) {
        this.inStream.init(stream);
        this.data += this.inStream.read(count);
      };
    } else {
      listener.onDataAvailable = function(req, ctxt, stream, offset, count) {
        this.inStream.init(stream);
        this.data += this.inStream.read(count);
      };
    }


    msgSvc.streamMessage(msgUriSpec,
      listener,
      msgWindow,
      null,
      false,
      null,
      false);

  },


  msgDirectCallback: function(callbackArg) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: msgDirectCallback: \n");

    var mailNewsUrl = Enigmail.msg.getCurrentMsgUrl();
    var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";
    var newBufferSize = 0;

    var l = urlSpec.length;

    if (urlSpec.substr(0, l) != callbackArg.messageUrl.substr(0, l)) {
      EnigmailLog.ERROR("enigmailMessengerOverlay.js: msgDirectCallback: Message URL mismatch " + mailNewsUrl.spec + " vs. " + callbackArg.messageUrl + "\n");
      return;
    }

    var msgText = callbackArg.data;
    msgText = EnigmailData.convertFromUnicode(msgText, "UTF-8");

    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: msgDirectCallback: msgText='" + msgText + "'\n");

    var f = function(argList) {
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
    };

    EnigmailEvents.dispatchEvent(f, 0, [msgText, callbackArg]);
  },

  setAttachmentName: function(attachment, newLabel, index) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: setAttachmentName (" + newLabel + "):\n");

    var attList = document.getElementById("attachmentList");
    if (attList) {
      var attNode = attList.firstChild;
      while (attNode) {
        if (attNode.getAttribute("name") == attachment.name) {
          attNode.setAttribute("name", newLabel);
        }
        attNode = attNode.nextSibling;
      }
    }

    if (typeof(attachment.displayName) == "undefined") {
      attachment.name = newLabel;
    } else {
      attachment.displayName = newLabel;
    }

    if (index && index.length > 0) {
      this.revealAttachments(parseInt(index, 10) + 1);
    }
  },

  loadExternalURL: function(url) {
    if (EnigmailApp.isSuite()) {
      Enigmail.msg.loadURLInNavigatorWindow(url, true);
    } else {
      messenger.launchExternalURL(url);
    }
  },

  // retrieves the most recent navigator window (opens one if need be)
  loadURLInNavigatorWindow: function(url, aOpenFlag) {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: loadURLInNavigatorWindow: " + url + ", " + aOpenFlag + "\n");

    var navWindow;

    // if this is a browser window, just use it
    if ("document" in top) {
      var possibleNavigator = top.document.getElementById("main-window");
      if (possibleNavigator &&
        possibleNavigator.getAttribute("windowtype") == "navigator:browser") {
        navWindow = top;
      }
    }

    // if not, get the most recently used browser window
    if (!navWindow) {
      var wm;
      wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(
        Ci.nsIWindowMediator);
      navWindow = wm.getMostRecentWindow("navigator:browser");
    }

    if (navWindow) {

      if ("loadURI" in navWindow) {
        navWindow.loadURI(url);
      } else {
        navWindow._content.location.href = url;
      }

    } else if (aOpenFlag) {
      // if no browser window available and it's ok to open a new one, do so
      navWindow = window.open(url, "Enigmail");
    }

    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: loadURLInNavigatorWindow: navWindow=" + navWindow + "\n");

    return navWindow;
  },

  // create a decrypted copy of all selected messages in a target folder

  decryptToFolder: function(destFolder) {
    let msgHdrs = gFolderDisplay ? gFolderDisplay.selectedMessages : null;
    if (!msgHdrs || msgHdrs.length === 0) {
      return;
    }

    EnigmailPersistentCrypto.dispatchMessages(msgHdrs, destFolder.URI, false, false);
  },

  onUnloadEnigmail: function() {
    EnigmailLog.DEBUG("enigmailMessengerOverlay.js: onUnloadEnigmail()\n");

    window.removeEventListener("unload", Enigmail.boundMessengerClose, false);
    window.removeEventListener("unload-autocrypt", Enigmail.boundOnUnloadEnigmail, false);
    window.removeEventListener("load-autocrypt", Enigmail.boundMessengerStartup, false);

    if (window.originalSyncGridColumnWidths) {
      window.syncGridColumnWidths = window.originalSyncGridColumnWidths;
      window.originalSyncGridColumnWidths = undefined;
    }

    this.messageCleanup();

    if (this.messagePane) {
      this.messagePane.removeEventListener("unload", Enigmail.boundMessageFrameUnload, true);
    }

    for (let c of this.changedAttributes) {
      let elem = document.getElementById(c.id);
      if (elem) {
        elem.setAttribute(c.attrib, c.value);
      }
    }

    let menu = document.querySelector("#appMenu-preferencesView > vbox");
    let appMenu = document.getElementById("appmenu-Enigmail");
    menu.removeChild(appMenu);

    if (this.treeController) {
      top.controllers.removeController(this.treeController);
    }

    for (let i = 0; i < gMessageListeners.length; i++) {
      if (gMessageListeners[i] === Enigmail.msg.messageListener) {
        gMessageListeners.splice(i, 1);
        break;
      }
    }
    this.messengerClose();

    if (Enigmail.columnHandler) {
      Enigmail.columnHandler.onUnloadEnigmail();
    }
    if (Enigmail.hdrView) {
      Enigmail.hdrView.onUnloadEnigmail();
    }

    Enigmail = undefined;
  }
};

function autocryptSyncGridColumnWidths() {
  try {
    let nameColumn = document.getElementById("expandedHeadersNameColumn");
    let nameColumn2 = document.getElementById("expandedHeaders2NameColumn");
    let nameColumn3 = document.getElementById("enigmailStatusTextBox");

    // Reset the minimum widths to 0 so that clientWidth will return the
    // preferred intrinsic width of each column.
    nameColumn.minWidth = nameColumn2.minWidth = nameColumn3.minWidth = 0;

    // Set minWidth on the smaller of the three columns to be the width of the
    // larger of the three.
    if (nameColumn.clientWidth > nameColumn2.clientWidth && nameColumn.clientWidth > nameColumn3.clientWidth) {
      nameColumn2.minWidth = nameColumn.clientWidth;
      nameColumn3.minWidth = nameColumn.clientWidth;
    } else if (nameColumn2.clientWidth > nameColumn.clientWidth && nameColumn2.clientWidth > nameColumn3.clientWidth) {
      nameColumn.minWidth = nameColumn2.clientWidth;
      nameColumn3.minWidth = nameColumn2.clientWidth;
    } else if (nameColumn3.clientWidth > nameColumn.clientWidth && nameColumn3.clientWidth > nameColumn2.clientWidth) {
      nameColumn.minWidth = nameColumn3.clientWidth;
      nameColumn2.minWidth = nameColumn3.clientWidth;
    }
  } catch (ex) {
    EnigmailLog.DEBUG("enigmailMsgHdrViewOverlay.js: something went wrong overriding syncGridColumnWidths! reverting to original..\n");
    window.syncGridColumnWidths = window.syncGridColumnWidthsOriginal;
    window.syncGridColumnWidthsOriginal = undefined;
    window.syncGridColumnWidths();
  }
}

Enigmail.boundMessengerStartup = Enigmail.msg.messengerStartup.bind(Enigmail.msg);
Enigmail.boundMessengerClose = Enigmail.msg.messengerClose.bind(Enigmail.msg);
Enigmail.boundOnUnloadEnigmail = Enigmail.msg.onUnloadEnigmail.bind(Enigmail.msg);
window.addEventListener("load-autocrypt", Enigmail.boundMessengerStartup, false);
window.addEventListener("unload", Enigmail.boundMessengerClose, false);
window.addEventListener("unload-autocrypt", Enigmail.boundOnUnloadEnigmail, false);
