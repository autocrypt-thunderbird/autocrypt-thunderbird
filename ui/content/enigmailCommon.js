/*global Components: false, EnigmailFiles: false, EnigmailCore: false, EnigmailApp: false, EnigmailDialog: false, EnigmailWindows: false, EnigmailTime: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * PLEASE NOTE: this module is legacy and must not be used for newe code - it will be removed!
 */


"use strict";

// enigmailCommon.js: shared JS functions for Enigmail

// WARNING: This module functions must not be loaded in overlays to standard functionality!

// Many of these components are not used in this file, but are instead used in other files that are loaded together with EnigmailCommon
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Components.utils.import("resource://enigmail/keyEditor.jsm"); /*global EnigmailKeyEditor: false */
Components.utils.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Components.utils.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Components.utils.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Components.utils.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Components.utils.import("resource://enigmail/app.jsm"); /*global EnigmailApp: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Components.utils.import("resource://enigmail/time.jsm"); /*global EnigmailTime: false */
Components.utils.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/trust.jsm"); /*global EnigmailTrust: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */
Components.utils.import("resource://enigmail/errorHandling.jsm"); /*global EnigmailErrorHandling: false */
Components.utils.import("resource://enigmail/keyserver.jsm"); /*global EnigmailKeyServer: false */
Components.utils.import("resource://enigmail/events.jsm"); /*global EnigmailEvents: false */
Components.utils.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Components.utils.import("resource://enigmail/promise.jsm"); /*global Promise: false */
Components.utils.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */


// The compatible Enigmime version
var gEnigmailSvc;
var gEnigPromptSvc;


// Maximum size of message directly processed by Enigmail
const ENIG_PROCESSINFO_CONTRACTID = "@mozilla.org/xpcom/process-info;1";
const ENIG_ENIGMAIL_CONTRACTID = "@mozdev.org/enigmail/enigmail;1";
const ENIG_STRINGBUNDLE_CONTRACTID = "@mozilla.org/intl/stringbundle;1";
const ENIG_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const ENIG_DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";
const ENIG_MIME_CONTRACTID = "@mozilla.org/mime;1";
const ENIG_WMEDIATOR_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=window-mediator";
const ENIG_ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const ENIG_CLIPBOARD_CONTRACTID = "@mozilla.org/widget/clipboard;1";
const ENIG_CLIPBOARD_HELPER_CONTRACTID = "@mozilla.org/widget/clipboardhelper;1";
const ENIG_TRANSFERABLE_CONTRACTID = "@mozilla.org/widget/transferable;1";
const ENIG_LOCALE_SVC_CONTRACTID = "@mozilla.org/intl/nslocaleservice;1";
const ENIG_DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";
const ENIG_ACCOUNT_MANAGER_CONTRACTID = "@mozilla.org/messenger/account-manager;1";
const ENIG_THREAD_MANAGER_CID = "@mozilla.org/thread-manager;1";
const ENIG_SIMPLEURI_CONTRACTID = "@mozilla.org/network/simple-uri;1";
const ENIG_SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";


const ENIG_STANDARD_URL_CONTRACTID = "@mozilla.org/network/standard-url;1";
const ENIG_SCRIPTABLEINPUTSTREAM_CONTRACTID = "@mozilla.org/scriptableinputstream;1";
const ENIG_BINARYINPUTSTREAM_CONTRACTID = "@mozilla.org/binaryinputstream;1";
const ENIG_SAVEASCHARSET_CONTRACTID = "@mozilla.org/intl/saveascharset;1";

const ENIG_STREAMCONVERTERSERVICE_CID_STR =
  "{892FFEB0-3F80-11d3-A16C-0050041CAF44}";


const ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const ENIG_IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

const ENIG_C = Components.classes;
const ENIG_I = Components.interfaces;

// Key algorithms
const ENIG_KEYTYPE_DSA = 1;
const ENIG_KEYTYPE_RSA = 2;


// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const ENIG_KEY_TRUST = 1;
const ENIG_KEY_ID = 4;
const ENIG_CREATED = 5;
const ENIG_EXPIRY = 6;
const ENIG_UID_ID = 7;
const ENIG_OWNERTRUST = 8;
const ENIG_USER_ID = 9;
const ENIG_SIG_TYPE = 10;
const ENIG_KEY_USE_FOR = 11;

const ENIG_KEY_EXPIRED = "e";
const ENIG_KEY_REVOKED = "r";
const ENIG_KEY_INVALID = "i";
const ENIG_KEY_DISABLED = "d";
const ENIG_KEY_NOT_VALID = ENIG_KEY_EXPIRED + ENIG_KEY_REVOKED + ENIG_KEY_INVALID + ENIG_KEY_DISABLED;


// GUI List: The corresponding image to set the "active" flag / checkbox
const ENIG_IMG_NOT_SELECTED = "chrome://enigmail/content/check0.png";
const ENIG_IMG_SELECTED = "chrome://enigmail/content/check1.png";
const ENIG_IMG_DISABLED = "chrome://enigmail/content/check2.png";


// Interfaces
const nsIEnigmail = ENIG_I.nsIEnigmail;

// Encryption flags
if (nsIEnigmail) {
  const ENIG_SIGN = nsIEnigmail.SEND_SIGNED;
  const ENIG_ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;
  const ENIG_ENCRYPT_OR_SIGN = ENIG_ENCRYPT | ENIG_SIGN;
}

// UsePGPMimeOption values
const PGP_MIME_NEVER = 0;
const PGP_MIME_POSSIBLE = 1;
const PGP_MIME_ALWAYS = 2;

const ENIG_POSSIBLE_PGPMIME = EnigmailConstants.POSSIBLE_PGPMIME;
const ENIG_PGP_DESKTOP_ATT = -2082;

var gUsePGPMimeOptionList = ["usePGPMimeNever",
  "usePGPMimePossible",
  "usePGPMimeAlways"
];

// sending options:
var gEnigEncryptionModel = ["encryptionModelConvenient",
  "encryptionModelManually"
];
var gEnigAcceptedKeys = ["acceptedKeysValid",
  "acceptedKeysAll"
];
var gEnigAutoSendEncrypted = ["autoSendEncryptedNever",
  "autoSendEncryptedIfKeys"
];
var gEnigConfirmBeforeSending = ["confirmBeforeSendingNever",
  "confirmBeforeSendingAlways",
  "confirmBeforeSendingIfEncrypted",
  "confirmBeforeSendingIfNotEncrypted",
  "confirmBeforeSendingIfRules"
];

const ENIG_BUTTON_POS_0 = 1;
const ENIG_BUTTON_POS_1 = 1 << 8;
const ENIG_BUTTON_POS_2 = 1 << 16;
const ENIG_BUTTON_TITLE_IS_STRING = 127;

const ENIG_HEADERMODE_KEYID = 0x01;
const ENIG_HEADERMODE_URL = 0x10;



function EnigGetFrame(win, frameName) {
  return EnigmailWindows.getFrame(win, frameName);
}

// Initializes enigmailCommon
function EnigInitCommon(id) {
  EnigmailLog.DEBUG("enigmailCommon.js: EnigInitCommon: id=" + id + "\n");

  gEnigPromptSvc = enigGetService("@mozilla.org/embedcomp/prompt-service;1", "nsIPromptService");
}


function GetEnigmailSvc() {
  if (!gEnigmailSvc)
    gEnigmailSvc = EnigmailCore.getService(window);
  return gEnigmailSvc;
}

// maxBytes == -1 => read everything
function EnigReadURLContents(url, maxBytes) {
  EnigmailLog.DEBUG("enigmailCommon.js: EnigReadURLContents: url=" + url +
    ", " + maxBytes + "\n");

  var ioServ = enigGetService(ENIG_IOSERVICE_CONTRACTID, "nsIIOService");
  if (!ioServ)
    throw Components.results.NS_ERROR_FAILURE;

  var fileChannel = ioServ.newChannel(url, null, null);

  var rawInStream = fileChannel.open();

  var inStream = ENIG_C[ENIG_BINARYINPUTSTREAM_CONTRACTID].createInstance(ENIG_I.nsIBinaryInputStream);
  inStream.setInputStream(rawInStream);

  var available = inStream.available();
  if ((maxBytes < 0) || (maxBytes > available))
    maxBytes = available;

  var data = inStream.readBytes(maxBytes);

  inStream.close();

  return data;
}

// maxBytes == -1 => read whole file
function EnigReadFileContents(localFile, maxBytes) {

  EnigmailLog.DEBUG("enigmailCommon.js: EnigReadFileContents: file=" + localFile.leafName +
    ", " + maxBytes + "\n");

  if (!localFile.exists() || !localFile.isReadable())
    throw Components.results.NS_ERROR_FAILURE;

  var ioServ = enigGetService(ENIG_IOSERVICE_CONTRACTID, "nsIIOService");
  if (!ioServ)
    throw Components.results.NS_ERROR_FAILURE;

  var fileURI = ioServ.newFileURI(localFile);
  return EnigReadURLContents(fileURI.asciiSpec, maxBytes);

}

///////////////////////////////////////////////////////////////////////////////


// write exception information
function EnigWriteException(referenceInfo, ex) {
  EnigmailLog.writeException(referenceInfo, ex);
}

///////////////////////////////////////////////////////////////////////////////

function EnigAlert(mesg) {
  return EnigmailDialog.alert(window, mesg);
}

/**
 * Displays an alert dialog with 3-4 optional buttons.
 * checkBoxLabel: if not null, display checkbox with text; the checkbox state is returned in checkedObj
 * button-Labels: use "&" to indicate access key
 *     use "buttonType:label" or ":buttonType" to indicate special button types
 *        (buttonType is one of cancel, help, extra1, extra2)
 * return: 0-2: button Number pressed
 *          -1: ESC or close window button pressed
 *
 */
function EnigLongAlert(mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj) {
  return EnigmailDialog.longAlert(window, mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj);
}

function EnigAlertPref(mesg, prefText) {
  return EnigmailDialog.alertPref(window, mesg, prefText);
}

// Confirmation dialog with OK / Cancel buttons (both customizable)
function EnigConfirm(mesg, okLabel, cancelLabel) {
  return EnigmailDialog.confirmDlg(window, mesg, okLabel, cancelLabel);
}


function EnigConfirmPref(mesg, prefText, okLabel, cancelLabel) {
  return EnigmailDialog.confirmPref(window, mesg, prefText, okLabel, cancelLabel);
}

function EnigError(mesg) {
  return gEnigPromptSvc.alert(window, EnigGetString("enigError"), mesg);
}

function EnigPrefWindow(showBasic, clientType, selectTab) {
  EnigmailLog.DEBUG("enigmailCommon.js: EnigPrefWindow\n");
  EnigmailWindows.openPrefWindow(window, showBasic, selectTab);
}


function EnigHelpWindow(source) {
  EnigmailWindows.openHelpWindow(source);
}


function EnigDisplayRadioPref(prefName, prefValue, optionElementIds) {
  EnigmailLog.DEBUG("enigmailCommon.js: EnigDisplayRadioPref: " + prefName + ", " + prefValue + "\n");

  if (prefValue >= optionElementIds.length)
    return;

  var groupElement = document.getElementById("enigmail_" + prefName);
  var optionElement = document.getElementById(optionElementIds[prefValue]);

  if (groupElement && optionElement) {
    groupElement.selectedItem = optionElement;
    groupElement.value = prefValue;
  }
}

function EnigSetRadioPref(prefName, optionElementIds) {
  EnigmailLog.DEBUG("enigmailCommon.js: EnigSetRadioPref: " + prefName + "\n");

  try {
    var groupElement = document.getElementById("enigmail_" + prefName);
    if (groupElement) {
      var optionElement = groupElement.selectedItem;
      var prefValue = optionElement.value;
      if (prefValue < optionElementIds.length) {
        EnigSetPref(prefName, prefValue);
        groupElement.value = prefValue;
      }
    }
  }
  catch (ex) {}
}

function EnigSavePrefs() {
  return EnigmailPrefs.savePrefs();
}

function EnigGetPref(prefName) {
  return EnigmailPrefs.getPref(prefName);
}

function EnigGetDefaultPref(prefName) {
  EnigmailLog.DEBUG("enigmailCommon.js: EnigGetDefaultPref: prefName=" + prefName + "\n");
  var prefValue = null;
  try {
    EnigmailPrefs.getPrefBranch().lockPref(prefName);
    prefValue = EnigGetPref(prefName);
    EnigmailPrefs.getPrefBranch().unlockPref(prefName);
  }
  catch (ex) {}

  return prefValue;
}

function EnigSetPref(prefName, value) {
  return EnigmailPrefs.setPref(prefName, value);
}

function EnigGetSignMsg(identity) {
  EnigmailFuncs.getSignMsg(identity);
}


function EnigConvertFromUnicode(text, charset) {
  EnigmailLog.DEBUG("enigmailCommon.js: EnigConvertFromUnicode: " + charset + "\n");

  if (!text)
    return "";

  if (!charset) charset = "utf-8";

  // Encode plaintext
  try {
    var unicodeConv = ENIG_C[ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(ENIG_I.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertFromUnicode(text);

  }
  catch (ex) {
    EnigmailLog.DEBUG("enigmailCommon.js: EnigConvertFromUnicode: caught an exception\n");

    return text;
  }
}


function EnigConvertToUnicode(text, charset) {
  // EnigmailLog.DEBUG("enigmailCommon.js: EnigConvertToUnicode: "+charset+"\n");

  if (!text || !charset /*|| (charset.toLowerCase() == "iso-8859-1")*/ )
    return text;

  // Encode plaintext
  try {
    var unicodeConv = ENIG_C[ENIG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(ENIG_I.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertToUnicode(text);

  }
  catch (ex) {
    EnigmailLog.DEBUG("enigmailCommon.js: EnigConvertToUnicode: caught an exception while converting'" + text + "' to " + charset + "\n");
    return text;
  }
}

function EnigConvertGpgToUnicode(text) {
  return EnigmailData.convertGpgToUnicode(text);
}

function EnigFormatFpr(fingerprint) {
  return EnigmailKey.formatFpr(fingerprint);
}

/////////////////////////
// Console stuff
/////////////////////////


// return the options passed to a window
function EnigGetWindowOptions() {
  var winOptions = [];
  if (window.location.search) {
    var optList = window.location.search.substr(1).split(/\&/);
    for (var i = 0; i < optList.length; i++) {
      var anOption = optList[i].split(/\=/);
      winOptions[anOption[0]] = unescape(anOption[1]);
    }
  }
  return winOptions;
}

function EnigRulesEditor() {
  EnigmailWindows.openRulesEditor();
}

function EngmailCardDetails() {
  EnigmailWindows.openCardDetails();
}

function EnigKeygen() {
  EnigmailWindows.openKeyGen();

}

// retrieves a localized string from the enigmail.properties stringbundle
function EnigGetString(aStr) {
  var argList = [];
  // unfortunately arguments.shift() doesn't work, so we use a workaround

  if (arguments.length > 1)
    for (var i = 1; i < arguments.length; i++) {
      argList.push(arguments[i]);
    }
  return EnigmailLocale.getString(aStr, (arguments.length > 1 ? argList : null));
}

// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email addresses
function EnigStripEmail(mailAddrs) {
  return EnigmailFuncs.stripEmail(mailAddrs);
}


//get path for temporary directory (e.g. /tmp, C:\TEMP)
function EnigGetTempDir() {
  return EnigmailFiles.getTempDir();
}

// get the OS platform
function EnigGetOS() {
  return EnigmailOS.getOS();
}

function EnigGetVersion() {
  return EnigmailApp.getVersion();
}

function EnigFilePicker(title, displayDir, save, defaultExtension, defaultName, filterPairs) {
  return EnigmailDialog.filePicker(window, title, displayDir, save, defaultExtension,
    defaultName, filterPairs);
}

// get keys from keyserver
function EnigDownloadKeys(inputObj, resultObj) {
  return EnigmailWindows.downloadKeys(window, inputObj, resultObj);
}

// create new PGP Rule
function EnigNewRule(emailAddress) {
  return EnigmailWindows.createNewRule(window, emailAddress);
}

function EnigGetTrustCode(keyObj) {
  return EnigmailTrust.getTrustCode(keyObj);
}

function EnigEditKeyTrust(userIdArr, keyIdArr) {
  return EnigmailWindows.editKeyTrust(window, userIdArr, keyIdArr);
}


function EnigEditKeyExpiry(userIdArr, keyIdArr) {
  return EnigmailWindows.editKeyExpiry(window, userIdArr, keyIdArr);
}

function EnigDisplayKeyDetails(keyId, refresh) {
  return EnigmailWindows.openKeyDetails(window, keyId, refresh);
}

function EnigSignKey(userId, keyId) {
  return EnigmailWindows.signKey(window, userId, keyId);
}


function EnigChangeKeyPwd(keyId, userId) {
  // gpg-agent used: gpg-agent will handle everything
  EnigmailKeyEditor.changePassphrase(window, "0x" + keyId, "", "",
    function _changePwdCb(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigAlert(EnigGetString("changePassFailed") + "\n\n" + errorMsg);
      }
    });
}


function EnigRevokeKey(keyId, userId, callbackFunc) {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;

  var userDesc = "0x" + keyId.substr(-8, 8) + " - " + userId;
  if (!EnigConfirm(EnigGetString("revokeKeyQuestion", userDesc), EnigGetString("keyMan.button.revokeKey")))
    return false;

  var tmpDir = EnigGetTempDir();
  var revFile;
  try {
    revFile = ENIG_C[ENIG_LOCAL_FILE_CONTRACTID].createInstance(EnigGetLocalFileApi());
    revFile.initWithPath(tmpDir);
    if (!(revFile.isDirectory() && revFile.isWritable())) {
      EnigAlert(EnigGetString("noTempDir"));
      return false;
    }
  }
  catch (ex) {}
  revFile.append("revkey.asc");

  EnigmailKeyEditor.genRevokeCert(window, "0x" + keyId, revFile, "0", "",
    function _revokeCertCb(exitCode, errorMsg) {
      if (exitCode !== 0) {
        revFile.remove(false);
        EnigAlert(EnigGetString("revokeKeyFailed") + "\n\n" + errorMsg);
        return;
      }
      var errorMsgObj = {};
      var keyList = {};
      var r = EnigmailKeyRing.importKeyFromFile(revFile, errorMsgObj, keyList);
      revFile.remove(false);
      if (r !== 0) {
        EnigAlert(EnigGetString("revokeKeyFailed") + "\n\n" + EnigConvertGpgToUnicode(errorMsgObj.value));
      }
      else {
        EnigAlert(EnigGetString("revokeKeyOk"));
      }
      if (callbackFunc) {
        callbackFunc(r === 0);
      }
    });
  return true;
}

function EnigGetLocalFileApi() {
  return Components.interfaces.nsIFile;
}

function EnigShowPhoto(keyId, userId, photoNumber) {
  EnigmailWindows.showPhoto(window, keyId, userId, photoNumber);
}

function EnigGetFilePath(nsFileObj) {
  return EnigmailFiles.getFilePath(nsFileObj);
}

function EnigCreateRevokeCert(keyId, userId, callbackFunc) {
  var defaultFileName = userId.replace(/[<\>]/g, "");
  defaultFileName += " (0x" + keyId.substr(-8, 8) + ") rev.asc";
  var outFile = EnigFilePicker(EnigGetString("saveRevokeCertAs"),
    "", true, "*.asc",
    defaultFileName, [EnigGetString("asciiArmorFile"), "*.asc"]);
  if (!outFile) return -1;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return -1;

  EnigmailKeyEditor.genRevokeCert(window, "0x" + keyId, outFile, "1", "",
    function _revokeCertCb(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigAlert(EnigGetString("revokeCertFailed") + "\n\n" + errorMsg);
      }
      else {
        EnigAlert(EnigGetString("revokeCertOK"));
      }

      if (callbackFunc) callbackFunc(exitCode === 0);
    });
  return 0;
}


// return the label of trust for a given trust code
function EnigGetTrustLabel(trustCode) {
  return EnigmailTrust.getTrustLabel(trustCode);
}

function EnigGetDateTime(dateNum, withDate, withTime) {
  return EnigmailTime.getDateTime(dateNum, withDate, withTime);
}

function enigCreateInstance(aURL, aInterface) {
  return ENIG_C[aURL].createInstance(ENIG_I[aInterface]);
}

function enigGetService(aURL, aInterface) {
  // determine how 'aInterface' is passed and handle accordingly
  switch (typeof(aInterface)) {
    case "object":
      return ENIG_C[aURL].getService(aInterface);
    case "string":
      return ENIG_C[aURL].getService(ENIG_I[aInterface]);
    default:
      return ENIG_C[aURL].getService();
  }

  return null;
}

function EnigCollapseAdvanced(obj, attribute, dummy) {
  return EnigmailFuncs.collapseAdvanced(obj, attribute, dummy);
}

/**
 * EnigOpenUrlExternally
 *
 * forces a uri to be loaded in an external browser
 *
 * @uri nsIUri object
 */
function EnigOpenUrlExternally(uri) {
  let eps = ENIG_C["@mozilla.org/uriloader/external-protocol-service;1"].
  getService(ENIG_I.nsIExternalProtocolService);

  eps.loadUrl(uri, null);
}

function EnigOpenURL(event, hrefObj) {
  var xulAppinfo = ENIG_C["@mozilla.org/xre/app-info;1"].getService(ENIG_I.nsIXULAppInfo);
  if (xulAppinfo.ID == ENIG_SEAMONKEY_ID) return;



  try {
    var ioservice = ENIG_C["@mozilla.org/network/io-service;1"].
    getService(ENIG_I.nsIIOService);
    var iUri = ioservice.newURI(hrefObj.href, null, null);

    EnigOpenUrlExternally(iUri);
    event.preventDefault();
    event.stopPropagation();
  }
  catch (ex) {}
}

function EnigGetHttpUri(aEvent) {

  function hRefForClickEvent(aEvent, aDontCheckInputElement) {
    var href;
    var isKeyCommand = (aEvent.type == "command");
    var target =
      isKeyCommand ? document.commandDispatcher.focusedElement : aEvent.target;

    if (target instanceof HTMLAnchorElement ||
      target instanceof HTMLAreaElement ||
      target instanceof HTMLLinkElement) {
      if (target.hasAttribute("href"))
        href = target.href;
    }
    else if (!aDontCheckInputElement && target instanceof HTMLInputElement) {
      if (target.form && target.form.action)
        href = target.form.action;
    }
    else {
      // we may be nested inside of a link node
      var linkNode = aEvent.originalTarget;
      while (linkNode && !(linkNode instanceof HTMLAnchorElement))
        linkNode = linkNode.parentNode;

      if (linkNode)
        href = linkNode.href;
    }

    return href;
  }

  // getHttpUri main function

  let href = hRefForClickEvent(aEvent);
  if (!href) return null;

  EnigmailLog.DEBUG("enigmailAbout.js: interpretHtmlClick: href='" + href + "'\n");

  var ioServ = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
  var uri = ioServ.newURI(href, null, null);

  if (Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
    .getService(Components.interfaces.nsIExternalProtocolService)
    .isExposedProtocol(uri.scheme) &&
    (uri.schemeIs("http") || uri.schemeIs("https")))
    return uri;

  return null;
}


/**
 * GUI List: Set the "active" flag and the corresponding image
 */
function EnigSetActive(element, status) {
  if (status >= 0) {
    element.setAttribute("active", status.toString());
  }

  switch (status) {
    case 0:
      element.setAttribute("src", ENIG_IMG_NOT_SELECTED);
      break;
    case 1:
      element.setAttribute("src", ENIG_IMG_SELECTED);
      break;
    case 2:
      element.setAttribute("src", ENIG_IMG_DISABLED);
      break;
    default:
      element.setAttribute("active", -1);
  }
}


/**
 * Receive a GUI List and remove all entries
 *
 * @param  XML-DOM  (it will be changed!)
 */
function EnigCleanGuiList(guiList) {
  while (guiList.firstChild) {
    guiList.removeChild(guiList.firstChild);
  }
}

/**
 * create a new treecell element
 *
 * @param String label of the cell
 *
 * @return treecell node
 */
function createCell(label) {
  var cell = document.createElement("treecell");
  cell.setAttribute("label", label);
  return cell;
}


/**
 * Process the output of GPG and return the key details
 *
 * @param   String  Values separated by colons and linebreaks
 *
 * @return  Object with the following keys:
 *    gUserId: Main user ID
 *    calcTrust,
 *    ownerTrust,
 *    fingerprint,
 *    showPhoto,
 *    uidList: List of Pseudonyms and E-Mail-Addresses,
 *    subkeyList: List of Subkeys
 */
function EnigGetKeyDetails(sigListStr) {
  var gUserId;
  var calcTrust;
  var ownerTrust;
  var fingerprint;
  var creationDate;
  var expiryDate;
  var uidList = [];
  var subkeyList = [];
  var showPhoto = false;

  var sigList = sigListStr.split(/[\n\r]+/);
  for (var i = 0; i < sigList.length; i++) {
    var aLine = sigList[i].split(/:/);
    switch (aLine[0]) {
      case "pub":
        gUserId = EnigConvertGpgToUnicode(aLine[9]);
        calcTrust = aLine[1];
        if (aLine[11].indexOf("D") >= 0) {
          calcTrust = "d";
        }
        ownerTrust = aLine[8];
        creationDate = EnigmailTime.getDateTime(aLine[5], true, false);
        expiryDate = EnigmailTime.getDateTime(aLine[6], true, false);
        subkeyList.push(aLine);
        if (!gUserId) {
          gUserId = EnigConvertGpgToUnicode(aLine[9]);
        }
        else if (uidList !== false) {
          uidList.push(aLine);
        }
        break;
      case "uid":
        if (!gUserId) {
          gUserId = EnigConvertGpgToUnicode(aLine[9]);
        }
        else if (uidList !== false) {
          uidList.push(aLine);
        }
        break;
      case "uat":
        // @TODO document what that means
        if (aLine[9].search("1 ") === 0) {
          showPhoto = true;
        }
        break;
      case "sub":
        subkeyList.push(aLine);
        break;
      case "fpr":
        if (!fingerprint) {
          fingerprint = aLine[9];
        }
        break;
    }
  }

  var keyDetails = {
    gUserId: gUserId,
    calcTrust: calcTrust,
    ownerTrust: ownerTrust,
    fingerprint: fingerprint,
    showPhoto: showPhoto,
    uidList: uidList,
    creationDate: creationDate,
    expiryDate: expiryDate,
    subkeyList: subkeyList
  };
  return keyDetails;
}
