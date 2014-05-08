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
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *   Ramalingam Saravanan <svn@xmlterm.org>
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


/*
 * Import into a JS component using
 * 'Components.utils.import("resource://enigmail/enigmailCommon.jsm");'
 */

Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");
Components.utils.import("resource://enigmail/pipeConsole.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";
const DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";
const LOCALE_SVC_CONTRACTID = "@mozilla.org/intl/nslocaleservice;1";
const SCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";
const NS_PREFS_SERVICE_CID = "@mozilla.org/preferences-service;1";
const NS_STRING_INPUT_STREAM_CONTRACTID = "@mozilla.org/io/string-input-stream;1";
const NS_INPUT_STREAM_CHNL_CONTRACTID = "@mozilla.org/network/input-stream-channel;1";
const NS_PROMPTSERVICE_CONTRACTID = "@mozilla.org/embedcomp/prompt-service;1";
const NS_TIMER_CONTRACTID       = "@mozilla.org/timer;1";


const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const SEAMONKEY_ID   = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";


const hexTable = "0123456789abcdef";

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const ENIGMAIL_PREFS_ROOT = "extensions.enigmail.";

const GPG_BATCH_OPT_LIST = [ "--batch", "--no-tty", "--status-fd", "2" ];

const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

const ENC_TYPE_MSG = 0;
const ENC_TYPE_ATTACH_BINARY = 1;
const ENC_TYPE_ATTACH_ASCII = 2;

var gLogLevel = 3;
var gPromptSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
var gDispatchThread = null;


var gEnigExtensionVersion;
var gEnigInstallLocation;
var gCachedPassphrase = null;
var gCacheTimer = null;

var _passwdAccessTimes = 0;
var _lastActiveTime = 0;

var gEncryptedUris = [];

var gKeyAlgorithms = [];



var gStatusFlags = {
  GOODSIG:         nsIEnigmail.GOOD_SIGNATURE,
  BADSIG:          nsIEnigmail.BAD_SIGNATURE,
  ERRSIG:          nsIEnigmail.UNVERIFIED_SIGNATURE,
  EXPSIG:          nsIEnigmail.EXPIRED_SIGNATURE,
  REVKEYSIG:       nsIEnigmail.GOOD_SIGNATURE,
  EXPKEYSIG:       nsIEnigmail.EXPIRED_KEY_SIGNATURE,
  KEYEXPIRED:      nsIEnigmail.EXPIRED_KEY,
  KEYREVOKED:      nsIEnigmail.REVOKED_KEY,
  NO_PUBKEY:       nsIEnigmail.NO_PUBKEY,
  NO_SECKEY:       nsIEnigmail.NO_SECKEY,
  IMPORTED:        nsIEnigmail.IMPORTED_KEY,
  INV_RECP:        nsIEnigmail.INVALID_RECIPIENT,
  MISSING_PASSPHRASE: nsIEnigmail.MISSING_PASSPHRASE,
  BAD_PASSPHRASE:  nsIEnigmail.BAD_PASSPHRASE,
  BADARMOR:        nsIEnigmail.BAD_ARMOR,
  NODATA:          nsIEnigmail.NODATA,
  ERROR:           nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.DECRYPTION_FAILED,
  DECRYPTION_FAILED: nsIEnigmail.DECRYPTION_FAILED,
  DECRYPTION_OKAY: nsIEnigmail.DECRYPTION_OKAY,
  TRUST_UNDEFINED: nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_NEVER:     nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_MARGINAL:  nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_FULLY:     nsIEnigmail.TRUSTED_IDENTITY,
  TRUST_ULTIMATE:  nsIEnigmail.TRUSTED_IDENTITY,
  CARDCTRL:        nsIEnigmail.CARDCTRL,
  SC_OP_FAILURE:   nsIEnigmail.SC_OP_FAILURE,
  UNKNOWN_ALGO:    nsIEnigmail.UNKNOWN_ALGO,
  SIG_CREATED:     nsIEnigmail.SIG_CREATED,
  END_ENCRYPTION : nsIEnigmail.END_ENCRYPTION,
  INV_SGNR:        0x100000000
};

const gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5" ];

const GPG_COMMENT_OPT = "Using GnuPG with %s - http://www.enigmail.net/";


// various global variables
var gKeygenProcess = null;

var EnigmailCommon = {

  // "constants"
  POSSIBLE_PGPMIME: -2081,
  PGP_DESKTOP_ATT : -2082,

  MSG_BUFFER_SIZE:  96000,
  MSG_HEADER_SIZE:  16000,

  APPSHELL_MEDIATOR_CONTRACTID: "@mozilla.org/appshell/window-mediator;1",
  APPSHSVC_CONTRACTID: "@mozilla.org/appshell/appShellService;1",
  ENIGMAIL_CONTRACTID: "@mozdev.org/enigmail/enigmail;1",
  IOSERVICE_CONTRACTID: "@mozilla.org/network/io-service;1",
  LOCAL_FILE_CONTRACTID: "@mozilla.org/file/local;1",
  MIME_CONTRACTID: "@mozilla.org/mime;1",
  SIMPLEURI_CONTRACTID: "@mozilla.org/network/simple-uri;1",

  // variables
  enigmailSvc: null,
  enigStringBundle: null,
  statusFlags: gStatusFlags,
  prefBranch: null,
  prefRoot: null,
  prefService: null,
  envList: null, // currently filled from enigmailCommon.jsm
  gpgAgentIsOptional: true,

  // methods
  getService: function (win) {
    // Lazy initialization of Enigmail JS component (for efficiency)

    if (this.enigmailSvc) {
      return this.enigmailSvc.initialized ? this.enigmailSvc : null;
    }

    try {
      this.enigmailSvc = Cc[this.ENIGMAIL_CONTRACTID].createInstance(Ci.nsIEnigmail);
    }
    catch (ex) {
      this.ERROR_LOG("enigmailCommon.js: Error in instantiating EnigmailService\n");
      return null;
    }

    this.DEBUG_LOG("enigmailCommon.js: this.enigmailSvc = "+this.enigmailSvc+"\n");

    if (!this.enigmailSvc.initialized) {
      // Initialize enigmail

      var firstInitialization = !this.enigmailSvc.initializationAttempted;

      if (! this.prefBranch)
        this.initPrefService();

      try {
        // Initialize enigmail
        this.enigmailSvc.initialize(win, this.getVersion(), this.prefBranch);

        try {
          // Reset alert count to default value
          this.prefBranch.clearUserPref("initAlert");
        }
        catch(ex) { }

      }
      catch (ex) {

        if (firstInitialization) {
          // Display initialization error alert
          var errMsg = this.enigmailSvc.initializationError ? this.enigmailSvc.initializationError : this.getString("accessError");

          errMsg += "\n\n"+this.getString("avoidInitErr");


          var checkedObj = {value: false};
          if (this.getPref("initAlert")) {
            var r = this.longAlert(win, "Enigmail: "+errMsg,
                                   this.getString("dlgNoPrompt"),
                                   null, ":help",
                                   null, checkedObj);
            if (r >= 0 && checkedObj.value) {
              this.setPref("initAlert", false);
            }
            if (r == 1) {
              this.helpWindow("initError");
            }
          }
          if (this.getPref("initAlert")) {
            this.enigmailSvc.initializationAttempted = false;
            this.enigmailSvc = null;
          }
        }

        return null;
      }

      var configuredVersion = this.getPref("configuredVersion");

      this.DEBUG_LOG("enigmailCommon.js: getService: "+configuredVersion+"\n");

      if (firstInitialization && this.enigmailSvc.initialized &&
          this.enigmailSvc.agentType && this.enigmailSvc.agentType == "pgp") {
        this.alert(win, this.getString("pgpNotSupported"));
      }

      if (this.enigmailSvc.initialized && (this.getVersion() != configuredVersion)) {
        ConfigureEnigmail();
      }
    }

    if (this.enigmailSvc.logFileStream) {
      gLogLevel = 5;
    }

    return this.enigmailSvc.initialized ? this.enigmailSvc : null;
  },

  getAppName: function() {
    var xulAppinfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);

    return xulAppinfo.name;
  },

  getVersion: function()
  {
    this.DEBUG_LOG("enigmailCommon.jsm: getVersion\n");

    var addonVersion = gEnigExtensionVersion;

    this.DEBUG_LOG("enigmailCommon.jsm: installed version: "+addonVersion+"\n");
    return addonVersion;
  },

  getPromptSvc: function() {
    return gPromptSvc;
  },

  getEnvList: function() {
    return this.envList;
  },

  savePrefs: function ()
  {
    this.DEBUG_LOG("enigmailCommon.js: savePrefs\n");
    try {
      this.prefService.savePrefFile(null);
    }
    catch (ex) {
    }
  },

  initPrefService: function() {
    if (this.prefBranch) return;

    try {
      this.prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

      this.prefRoot        = this.prefService.getBranch(null);
      this.prefBranch      = this.prefService.getBranch(ENIGMAIL_PREFS_ROOT);

      if (this.prefBranch.getCharPref("logDirectory"))
        gLogLevel = 5;

    }
    catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: Error in instantiating PrefService\n");
      this.ERROR_LOG(ex.toString());
    }
  },

  getPref: function (prefName)
  {
    if (! this.prefBranch)
      this.initPrefService();

    var prefValue = null;
    try {
      var prefType = this.prefBranch.getPrefType(prefName);
      // Get pref value
      switch (prefType) {
      case this.prefBranch.PREF_BOOL:
         prefValue = this.prefBranch.getBoolPref(prefName);
         break;

      case this.prefBranch.PREF_INT:
         prefValue = this.prefBranch.getIntPref(prefName);
         break;

      case this.prefBranch.PREF_STRING:
         prefValue = this.prefBranch.getCharPref(prefName);
         break;

      default:
         prefValue = undefined;
         break;
     }

   } catch (ex) {
      // Failed to get pref value
      this.ERROR_LOG("enigmailCommon.jsm: getPref: unknown prefName:"+prefName+" \n");
   }

   return prefValue;
  },

  /**
   * Store a user preference.
   *
   * @param  String  prefName  An identifier.
   * @param  any     value     The value to be stored. Allowed types: Boolean OR Integer OR String.
   *
   * @return Boolean Was the value stored successfully?
   */
  setPref: function (prefName, value)
  {
     this.DEBUG_LOG("enigmailCommon.jsm: setPref: "+prefName+", "+value+"\n");

     if (! this.prefBranch) {
       this.initPrefService();
     }

     // Discover the type of the preference, as stored in the user preferences.
     // If the preference identifier doesn't exist yet, it returns 0. In that
     // case the type depends on the argument "value".
     var prefType;
     prefType = this.prefBranch.getPrefType(prefName);
     if (prefType === 0) {
       switch (typeof value) {
         case "boolean":
           prefType = this.prefBranch.PREF_BOOL;
           break;
         case "number":
           prefType = this.prefBranch.PREF_INT;
           break;
         case "string":
           prefType = this.prefBranch.PREF_STRING;
           break;
         default:
           prefType = 0;
           break;
       }
     }
     var retVal = false;

     // Save the preference only and if only the type is bool, int or string.
     switch (prefType) {
        case this.prefBranch.PREF_BOOL:
           this.prefBranch.setBoolPref(prefName, value);
           retVal = true;
           break;

        case this.prefBranch.PREF_INT:
           this.prefBranch.setIntPref(prefName, value);
           retVal = true;
           break;

        case this.prefBranch.PREF_STRING:
           this.prefBranch.setCharPref(prefName, value);
           retVal = true;
           break;

        default:
           break;
     }

     return retVal;
  },

  alert: function (win, mesg)
  {
    gPromptSvc.alert(win, this.getString("enigAlert"), mesg);
  },

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
  longAlert: function (win, mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj)
  {
    var result = {
      value: -1,
      checked: false
    };

    win.openDialog("chrome://enigmail/content/enigmailAlertDlg.xul", "",
              "chrome,dialog,modal,centerscreen",
              {
                msgtext: mesg,
                checkboxLabel: checkBoxLabel,
                button1: okLabel,
                button2: labelButton2,
                button3: labelButton3
              },
              result);

    if (checkBoxLabel) {
      checkedObj.value=result.checked;
    }
    return result.value;
  },

  // Confirmation dialog with OK / Cancel buttons (both customizable)
  confirmDlg: function (win, mesg, okLabel, cancelLabel)
  {
    var dummy=new Object();

    var buttonTitles = 0;
    if (okLabel == null && cancelLabel == null) {
      buttonTitles = (gPromptSvc.BUTTON_TITLE_YES * BUTTON_POS_0) +
                     (gPromptSvc.BUTTON_TITLE_NO * BUTTON_POS_1);
    }
    else {
      if (okLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_0);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0;
      }

      if (cancelLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_1);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_CANCEL * BUTTON_POS_1;
      }
    }

    var buttonPressed = gPromptSvc.confirmEx(win,
                          this.getString("enigConfirm"),
                          mesg,
                          buttonTitles,
                          okLabel, cancelLabel, null,
                          null, dummy);

    return (buttonPressed == 0);
  },

  confirmPref: function (win, mesg, prefText, okLabel, cancelLabel)
  {
    const notSet = 0;
    const yes = 1;
    const no = 2;
    const display = true;
    const dontDisplay = false;

    var buttonTitles = 0;
    if (okLabel == null && cancelLabel == null) {
      buttonTitles = (gPromptSvc.BUTTON_TITLE_YES * BUTTON_POS_0) +
                     (gPromptSvc.BUTTON_TITLE_NO * BUTTON_POS_1);
    }
    else {
      if (okLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_0);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0;
      }

      if (cancelLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_1);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_CANCEL * BUTTON_POS_1;
      }
    }

    var prefValue = this.getPref(prefText);

    if (typeof(prefValue) != "boolean") {
      // number: remember user's choice
      switch (prefValue) {
      case notSet:
        var checkBoxObj = { value: false} ;
        var buttonPressed = gPromptSvc.confirmEx(win,
                              this.getString("enigConfirm"),
                              mesg,
                              buttonTitles,
                              okLabel, cancelLabel, null,
                              this.getString("dlgKeepSetting"), checkBoxObj);
        if (checkBoxObj.value) {
          this.setPref(prefText, (buttonPressed==0 ? yes : no));
        }
        return (buttonPressed==0 ? 1 : 0);

      case yes:
        return 1;

      case no:
        return 0;

      default:
        return -1;
      }
    }
    else {
      // boolean: "do not show this dialog anymore" (and return default)
      switch (prefValue) {
      case display:
        var checkBoxObj = { value: false} ;
        var buttonPressed = gPromptSvc.confirmEx(win,
                              this.getString("enigConfirm"),
                              mesg,
                              buttonTitles,
                              okLabel, cancelLabel, null,
                              this.getString("dlgNoPrompt"), checkBoxObj);
        if (checkBoxObj.value) {
          this.setPref(prefText, false);
        }
        return (buttonPressed==0 ? 1 : 0);

      case dontDisplay:
        return 1;

      default:
        return -1;
      }

    }
  },


  promptValue: function (win, mesg, valueObj)
  {
    var checkObj = new Object();
    return gPromptSvc.prompt(win, this.getString("enigPrompt"),
                                 mesg, valueObj, "", checkObj);
  },

  alertPref: function (win, mesg, prefText) {
    const display = true;
    const dontDisplay = false;

    var prefValue = this.getPref(prefText);
    if (prefValue == display) {
      var checkBoxObj = { value: false } ;
      var buttonPressed = gPromptSvc.confirmEx(win,
                            this.getString("enigAlert"),
                            mesg,
                            (gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0),
                            null, null, null,
                            this.getString("dlgNoPrompt"), checkBoxObj);
      if (checkBoxObj.value && buttonPressed==0) {
        this.setPref(prefText, dontDisplay);
      }
    }
  },

  alertCount: function (win, countPrefName, mesg)
  {
    var alertCount = this.getPref(countPrefName);

    if (alertCount <= 0)
      return;

    alertCount--;
    this.setPref(countPrefName, alertCount);

    if (alertCount > 0) {
      mesg += this.getString("repeatPrefix", [ alertCount ]) + " ";
      mesg += (alertCount == 1) ? this.getString("repeatSuffixSingular") : this.getString("repeatSuffixPlural");
    } else {
      mesg += this.getString("noRepeat");
    }

    this.alert(win, mesg);
  },

  openWin: function (winName, spec, winOptions, optList)
  {
    var windowManager = Cc[this.APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

    var winEnum=windowManager.getEnumerator(null);
    var recentWin=null;
    while (winEnum.hasMoreElements() && ! recentWin) {
      var thisWin = winEnum.getNext();
      if (thisWin.location.href==spec) {
        recentWin = thisWin;
      }
    }

    if (recentWin) {
      recentWin.focus();
    } else {
      var appShellSvc = Cc[this.APPSHSVC_CONTRACTID].getService(Ci.nsIAppShellService);
      var domWin = appShellSvc.hiddenDOMWindow;
      try {
        domWin.open(spec, winName, "chrome,"+winOptions, optList);
      }
      catch (ex) {
        domWin = windowManager.getMostRecentWindow(null);
        domWin.open(spec, winName, "chrome,"+winOptions, optList);
      }
    }
  },

  getFrame: function(win, frameName)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: getFrame: name="+frameName+"\n");
    for (var j=0; j<win.frames.length; j++) {
      if (win.frames[j].name == frameName) {
        return win.frames[j];
      }
    }
    return null;
  },


  convertGpgToUnicode: function (text)
  {
    if (typeof(text)=="string") {
      text = text.replace(/\\x3a/ig, "\\e3A");
      var a=text.search(/\\x[0-9a-fA-F]{2}/);
      while (a>=0) {
          var ch = unescape('%'+text.substr(a+2,2));
          var r = new RegExp("\\"+text.substr(a,4));
          text=text.replace(r, ch);

          a=text.search(/\\x[0-9a-fA-F]{2}/);
      }

      text = this.convertToUnicode(text, "utf-8").replace(/\\e3A/g, ":");
    }

    return text;
  },

  getDateTime: function (dateNum, withDate, withTime)
  {
    if (dateNum && dateNum != 0) {
      var dat=new Date(dateNum * 1000);
      var appLocale = Cc[LOCALE_SVC_CONTRACTID].getService(Ci.nsILocaleService).getApplicationLocale();
      var dateTimeFormat = Cc[DATE_FORMAT_CONTRACTID].getService(Ci.nsIScriptableDateFormat);

      var dateFormat = (withDate ? dateTimeFormat.dateFormatShort : dateTimeFormat.dateFormatNone);
      var timeFormat = (withTime ? dateTimeFormat.timeFormatNoSeconds : dateTimeFormat.timeFormatNone);
      return dateTimeFormat.FormatDateTime(appLocale.getCategory("NSILOCALE_TIME"),
                dateFormat,
                timeFormat,
                dat.getFullYear(), dat.getMonth()+1, dat.getDate(),
                dat.getHours(), dat.getMinutes(), 0);
    }
    else {
      return "";
    }
  },

  filePicker: function (win, title, displayDir, save, defaultExtension, defaultName, filterPairs)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: filePicker: "+save+"\n");

    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance();
    filePicker = filePicker.QueryInterface(Ci.nsIFilePicker);

    var mode = save ? Ci.nsIFilePicker.modeSave : Ci.nsIFilePicker.modeOpen;

    filePicker.init(win, title, mode);

    if (displayDir) {
      var localFile = Cc[this.LOCAL_FILE_CONTRACTID].createInstance(this.getLocalFileApi());

      try {
        localFile.initWithPath(displayDir);
        filePicker.displayDirectory = localFile;
      } catch (ex) {
      }
    }

    if (defaultExtension)
      filePicker.defaultExtension = defaultExtension;

    if (defaultName)
      filePicker.defaultString=defaultName;

    var nfilters = 0;
    if (filterPairs && filterPairs.length)
      nfilters = filterPairs.length / 2;

    for (var index=0; index < nfilters; index++) {
      filePicker.appendFilter(filterPairs[2*index], filterPairs[2*index+1]);
    }

    filePicker.appendFilters(Ci.nsIFilePicker.filterAll);

    if (filePicker.show() == Ci.nsIFilePicker.returnCancel)
      return null;

    var file = filePicker.file.QueryInterface(this.getLocalFileApi());

    return file;
  },

  getFilePath: function (nsFileObj)
  {
    if (this.getOS() == "WINNT")
      return this.convertToUnicode(nsFileObj.persistentDescriptor, "utf-8");

    return this.convertFromUnicode(nsFileObj.path, "utf-8");
  },

  isDosLike: function() {
    if (this.isDosLikeVal === undefined) {
      this.isDosLikeVal = (this.getOS() == "WINNT" || this.getOS() == "OS2");
    }
    return this.isDosLikeVal;
  },

  getEscapedFilename: function (fileNameStr) {
    if (this.isDosLike()) {
      // escape the backslashes and the " character (for Windows and OS/2)
      fileNameStr = fileNameStr.replace(/([\\\"])/g, "\\$1");
    }

    if (this.getOS() == "WINNT") {
      // replace leading "\\" with "//"
      fileNameStr = fileNameStr.replace(/^\\\\*/, "//");
    }
    return fileNameStr;
  },

  /**
   *  Get the temp directory as nsIFile Object
   *  @return nsIFile object to the temporary directory
   */
  getTempDirObj: function ()
  {
    const TEMPDIR_PROP = "TmpD";
    var tmpDirObj;

    try {
      var ds = Cc[DIRSERVICE_CONTRACTID].getService();
      var dsprops = ds.QueryInterface(Ci.nsIProperties);
      var tmpDirObj = dsprops.get(TEMPDIR_PROP, this.getLocalFileApi());
    }
    catch (ex) {
      // let's guess ...
      tmpDirObj = Cc[this.LOCAL_FILE_CONTRACTID].createInstance(this.getLocalFileApi());
      if (this.getOS() == "WINNT") {
        tmpDirObj.initWithPath("C:/TEMP");
      } else {
        tmpDirObj.initWithPath("/tmp");
      }
    }
    return tmpDirObj;
  },

  /**
   *  Get the temp directory as string
   *  @return |String| containing the temporary directory name
   */

  getTempDir: function ()
  {
    let tmpDir = this.getTempDirObj();
    return tmpDir.path;
  },

  newStringStreamListener: function (onStopCallback)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: newStreamListener\n");

    var simpleStreamListener = {
      data: "",
      inStream: Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream),
      _onStopCallback: onStopCallback,
      QueryInterface: XPCOMUtils.generateQI([ Ci.nsIStreamListener, Ci.nsIRequestObserver ]),

      onStartRequest: function (channel, ctxt)
      {
        // EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: stringListener.onStartRequest\n");
      },

      onStopRequest: function (channel, ctxt, status)
      {
        // EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: stringListener.onStopRequest: "+ctxt+"\n");
        this.inStream = null;
        var cbFunc = this._onStopCallback;
        var cbData = this.data;

        EnigmailCommon.setTimeout(function _cb() {
          cbFunc(cbData);
        });
      },

      onDataAvailable: function(req, sup, stream, offset, count)
      {
        // get data from stream
        // EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: stringListener.onDataAvailable: "+count+"\n");
        this.inStream.setInputStream(stream);
        this.data += this.inStream.readBytes(count);
      }
    };

    return simpleStreamListener;
  },

  newRequestObserver: function (terminateFunc, terminateArg)
  {
    var requestObserver = function (terminateFunc, terminateArg)
    {
      this._terminateFunc = terminateFunc;
      this._terminateArg = terminateArg;
    };

    requestObserver.prototype = {

      _terminateFunc: null,
      _terminateArg: null,

      QueryInterface: function (iid) {
        if (!iid.equals(Ci.nsIRequestObserver) &&
            !iid.equals(Ci.nsISupports))
          throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
      },

      onStartRequest: function (channel, ctxt)
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: requestObserver.onStartRequest\n");
      },

      onStopRequest: function (channel, ctxt, status)
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: requestObserver.onStopRequest: "+ctxt+"\n");
        EnigmailCommon.dispatchEvent(this._terminateFunc, 0, [ this._terminateArg ]);
      }
    };

    return new requestObserver(terminateFunc, terminateArg);
  },

  writeException: function (referenceInfo, ex)
  {
    this.ERROR_LOG(referenceInfo+": caught exception: "
              +ex.name+"\n"
              +"Message: '"+ex.message+"'\n"
              +"File:    "+ex.fileName+"\n"
              +"Line:    "+ex.lineNumber+"\n"
              +"Stack:   "+ex.stack+"\n");
  },


  WRITE_LOG: function (str)
  {
    function f00(val, digits) {
      return ("0000"+val.toString()).substr(-digits);
    }

    var d = new Date();
    var datStr=d.getFullYear()+"-"+f00(d.getMonth()+1, 2)+"-"+f00(d.getDate(),2)+" "+f00(d.getHours(),2)+":"+f00(d.getMinutes(),2)+":"+f00(d.getSeconds(),2)+"."+f00(d.getMilliseconds(),3)+" ";
    if (gLogLevel >= 4)
      dump(datStr+str);

    if (this.enigmailSvc && this.enigmailSvc.logFileStream) {
      this.enigmailSvc.logFileStream.write(datStr, datStr.length);
      this.enigmailSvc.logFileStream.write(str, str.length);
    }
  },

  DEBUG_LOG: function (str)
  {
    if ((gLogLevel >= 4) || (this.enigmailSvc && this.enigmailSvc.logFileStream))
      this.WRITE_LOG("[DEBUG] "+str);
  },

  WARNING_LOG: function (str)
  {
    if (gLogLevel >= 3)
      this.WRITE_LOG("[WARN] "+str);

      EnigmailConsole.write(str);
  },

  ERROR_LOG: function (str)
  {
    try {
      var consoleSvc = Cc["@mozilla.org/consoleservice;1"].
          getService(Ci.nsIConsoleService);

      var scriptError = Cc["@mozilla.org/scripterror;1"]
                                  .createInstance(Ci.nsIScriptError);
      scriptError.init(str, null, null, 0,
                       0, scriptError.errorFlag, "Enigmail");
      consoleSvc.logMessage(scriptError);

    }
    catch (ex) {}

    if (gLogLevel >= 2)
      this.WRITE_LOG("[ERROR] "+str);
  },

  CONSOLE_LOG: function (str)
  {
    if (gLogLevel >= 3)
      this.WRITE_LOG("[CONSOLE] "+str);

    EnigmailConsole.write(str);
  },

  // retrieves a localized string from the enigmail.properties stringbundle
  getString: function (aStr, subPhrases)
  {

    if (!this.enigStringBundle) {
      try {
        var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"].getService();
        strBundleService = strBundleService.QueryInterface(Ci.nsIStringBundleService);
        this.enigStringBundle = strBundleService.createBundle("chrome://enigmail/locale/enigmail.properties");
      }
      catch (ex) {
        this.ERROR_LOG("enigmailCommon.jsm: Error in instantiating stringBundleService\n");
      }
    }

    if (this.enigStringBundle) {
      try {
        if (subPhrases) {
          if (typeof(subPhrases) == "string") {
            return this.enigStringBundle.formatStringFromName(aStr, [ subPhrases ], 1);
          }
          else
            return this.enigStringBundle.formatStringFromName(aStr, subPhrases, subPhrases.length);
        }
        else {
          return this.enigStringBundle.GetStringFromName(aStr);
        }
      }
      catch (ex) {
        this.ERROR_LOG("enigmailCommon.jsm: Error in querying stringBundleService for string '"+aStr+"'\n");
      }
    }
    return aStr;
  },

  getOS: function () {
    var xulRuntime = Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime);
    return xulRuntime.OS;
  },

  isSuite: function () {
    // return true if Seamonkey, false otherwise
    var xulAppinfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);
    return (xulAppinfo.ID == SEAMONKEY_ID);
  },

  convertToUnicode: function (text, charset)
  {
    //this.DEBUG_LOG("enigmailCommon.jsm: convertToUnicode: "+charset+"\n");

    if (!text || (charset && (charset.toLowerCase() == "iso-8859-1")))
      return text;

    if (! charset) charset = "utf-8";

    // Encode plaintext
    try {
      var unicodeConv = Cc[SCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Ci.nsIScriptableUnicodeConverter);

      unicodeConv.charset = charset;
      return unicodeConv.ConvertToUnicode(text);

    } catch (ex) {
      return text;
    }
  },

  convertFromUnicode: function (text, charset) {
    //this.DEBUG_LOG("enigmailCommon.jsm: convertFromUnicode: "+charset+"\n");

    if (!text)
      return "";

    if (! charset) charset="utf-8";

    // Encode plaintext
    try {
      var unicodeConv = Cc[SCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Ci.nsIScriptableUnicodeConverter);

      unicodeConv.charset = charset;
      return unicodeConv.ConvertFromUnicode(text);

    } catch (ex) {
      this.DEBUG_LOG("enigmailCommon.jsm: convertFromUnicode: caught an exception\n");

      return text;
    }
  },

  convertFromGpg: function (text)
  {
    if (typeof(text)=="string") {
      text = text.replace(/\\x3a/ig, "\\e3A");
      var a=text.search(/\\x[0-9a-fA-F]{2}/);
      while (a>=0) {
          var ch=unescape('%'+text.substr(a+2,2));
          var r= new RegExp("\\"+text.substr(a,4));
          text=text.replace(r, ch);

          a=text.search(/\\x[0-9a-fA-F]{2}/);
      }

      text = this.convertToUnicode(text, "utf-8").replace(/\\e3A/g, ":");
    }

    return text;
  },

  parseErrorOutput: function (errOutput, retStatusObj)
  {

    this.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: status message: "+errOutput+"\n");

    var errLines = errOutput.split(/\r?\n/);

    // Discard last null string, if any
    if ((errLines.length > 1) && !errLines[errLines.length-1])
      errLines.pop();

    var errArray    = new Array();
    var statusArray = new Array();
    var lineSplit = null;
    var errCode = 0;
    var detectedCard = null;
    var requestedCard = null;
    var errorMsg = "";
    retStatusObj.statusMsg = "";

    var statusPat = /^\[GNUPG:\] /;
    var statusFlags = 0;

    for (var j=0; j<errLines.length; j++) {
      if (errLines[j].search(statusPat) == 0) {
        var statusLine = errLines[j].replace(statusPat,"");
        statusArray.push(statusLine);

        var matches = statusLine.match(/^(\w+)\b/);

        if (matches && (matches.length > 1)) {
          var flag = gStatusFlags[matches[1]];

          if (flag == Ci.nsIEnigmail.NODATA) {
            // Recognize only "NODATA 1"
            if (statusLine.search(/NODATA 1\b/) < 0)
              flag = 0;
          }
          else if (flag == Ci.nsIEnigmail.CARDCTRL) {
            lineSplit = statusLine.split(/ +/);
            if (lineSplit[1] == "3") {
              detectedCard=lineSplit[2];
            }
            else {
              errCode = Number(lineSplit[1]);
              if (errCode == 1) requestedCard = lineSplit[2];
            }
          }
          else if (flag == Ci.nsIEnigmail.UNVERIFIED_SIGNATURE) {
            lineSplit = statusLine.split(/ +/);
            if (lineSplit.length > 7 && lineSplit[7] == "4") {
              flag = Ci.nsIEnigmail.UNKNOWN_ALGO;
            }
          }
          else if (flag == gStatusFlags["INV_SGNR"]) {
            lineSplit = statusLine.split(/ +/);
            statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
            flag = 0;
            this.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: detected invalid sender: "+lineSplit[2]+" / code: "+lineSplit[1]+"\n");
            retStatusObj.statusMsg += this.getString("gnupg.invalidKey.desc", [ lineSplit[2] ]);
          }

          if (flag)
            statusFlags |= flag;

        }

      } else {
        errArray.push(errLines[j]);
      }
    }

    // detect forged message insets

    retStatusObj.blockSeparation = "";

    var plaintextCount=0;
    var withinCryptoMsg = false;
    var cryptoStartPat = /^BEGIN_DECRYPTION/;
    var cryptoEndPat = /^END_DECRYPTION/;
    var plaintextPat = /^PLAINTEXT /;
    var plaintextLengthPat = /^PLAINTEXT_LENGTH /;
    for (j=0; j<statusArray.length; j++) {
      if (statusArray[j].search(cryptoStartPat) == 0) {
        withinCryptoMsg = true;
      }
      else if (withinCryptoMsg && statusArray[j].search(cryptoEndPat) == 0) {
        withinCryptoMsg = false;
      }
      else if (statusArray[j].search(plaintextPat) == 0) {
        ++plaintextCount;
        if ((statusArray.length > j+1) && (statusArray[j+1].search(plaintextLengthPat) == 0)) {
          matches = statusArray[j+1].match(/(\w+) (\d+)/);
          if (matches.length>=3) {
            retStatusObj.blockSeparation += (withinCryptoMsg ? "1" : "0") + ":"+matches[2]+" ";
          }
        }
        else {
          // strange: we got PLAINTEXT XX, but not PLAINTEXT_LENGTH XX
          retStatusObj.blockSeparation += (withinCryptoMsg ? "1" : "0") + ":0 ";
        }
      }
    }

    if (plaintextCount > 1) statusFlags |= (Ci.nsIEnigmail.PARTIALLY_PGP | Ci.nsIEnigmail.DECRYPTION_FAILED | Ci.nsIEnigmail.BAD_SIGNATURE);

    retStatusObj.blockSeparation = retStatusObj.blockSeparation.replace(/ $/, "");
    retStatusObj.statusFlags = statusFlags;
    if (retStatusObj.statusMsg.length == 0) retStatusObj.statusMsg = statusArray.join("\n");
    if (errorMsg.length == 0)
      errorMsg = errArray.map(this.convertFromGpg, this).join("\n");


    if ((statusFlags & Ci.nsIEnigmail.CARDCTRL) && errCode >0) {
      switch (errCode) {
      case 1:
        if (detectedCard) {
          errorMsg = this.getString("sc.wrongCardAvailable", [ detectedCard, requestedCard ]);
        }
        else
          errorMsg = this.getString("sc.insertCard", [ requestedCard ]);
        break;
      case 2:
        errorMsg = this.getString("sc.removeCard");
      case 4:
        errorMsg = this.getString("sc.noCardAvailable");
        break;
      case 5:
        errorMsg = this.getString("sc.noReaderAvailable");
        break;
      }
      statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
    }


    this.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: statusFlags = "+this.bytesToHex(this.pack(statusFlags,4))+"\n");

    return errorMsg;
  },

  // pack/unpack: Network (big-endian) byte order

  pack: function (value, bytes)
  {
    var str = '';
    var mask = 0xff;
    for (var j=0; j < bytes; j++) {
      str = String.fromCharCode( (value & mask) >> j*8 ) + str;
      mask <<= 8;
    }

    return str;
  },

  unpack: function (str)
  {
    var len = str.length;
    var value = 0;

    for (var j=0; j < len; j++) {
      value <<= 8;
      value  |= str.charCodeAt(j);
    }

    return value;
  },



  bytesToHex: function (str)
  {
    var len = str.length;

    var hex = '';
    for (var j=0; j < len; j++) {
      var charCode = str.charCodeAt(j);
      hex += hexTable.charAt((charCode & 0xf0) >> 4) +
             hexTable.charAt((charCode & 0x0f));
    }

    return hex;
  },

  getLogLevel: function()
  {
    return gLogLevel;
  },

  initialize: function (enigmailSvc, logLevel)
  {
    this.enigmailSvc = enigmailSvc;
    gLogLevel = logLevel;
  },


  setTimeout: function( callbackFunction, sleepTimeMs ) {
    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback(callbackFunction, sleepTimeMs, Ci.nsITimer.TYPE_ONE_SHOT);
    return timer;
  },

  dispatchEvent: function (callbackFunction, sleepTimeMs, arrayOfArgs)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: dispatchEvent f="+callbackFunction.name+"\n");

    // object for dispatching callback back to main thread
    var mainEvent = function(cbFunc, arrayOfArgs) {
      this.cbFunc = cbFunc;
      this.args   = arrayOfArgs;
    };

    mainEvent.prototype = {
      QueryInterface: function(iid) {
        if (iid.equals(Ci.nsIRunnable) ||
            iid.equals(Ci.nsISupports)) {
                return this;
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
      },

      run: function()
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: dispatchEvent running mainEvent\n");
        this.cbFunc(this.args);
      },

      notify: function()
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: dispatchEvent got notified\n");
        this.cbFunc(this.args);
      }

    };

    var event = new mainEvent(callbackFunction, arrayOfArgs);
    if (sleepTimeMs > 0) {
      return this.setTimeout(event, sleepTimeMs);
    }
    else {
      var tm = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager);

      // dispatch the event to the main thread
      tm.mainThread.dispatch(event, Ci.nsIThread.DISPATCH_NORMAL);
    }

    return event;
  },

  /*
   * remember the fact a URI is encrypted
   *
   * @param String msgUri
   *
   * @return null
   */

  rememberEncryptedUri: function (uri) {
    this.DEBUG_LOG("enigmailCommon.jsm: rememberEncryptedUri: uri="+uri+"\n");
    if (gEncryptedUris.indexOf(uri) < 0)
      gEncryptedUris.push(uri);
  },

  /*
   * unremember the fact a URI is encrypted
   *
   * @param String msgUri
   *
   * @return null
   */

  forgetEncryptedUri: function (uri) {
    this.DEBUG_LOG("enigmailCommon.jsm: forgetEncryptedUri: uri="+uri+"\n");
    var pos = gEncryptedUris.indexOf(uri);
    if (pos >= 0) {
      gEncryptedUris.splice(pos, 1);
    }
  },

  /*
   * determine if a URI was remebered as encrypted
   *
   * @param String msgUri
   *
   * @return: Boolean true if yes, false otherwise
   */

  isEncryptedUri: function (uri) {
    this.DEBUG_LOG("enigmailCommon.jsm: isEncryptedUri: uri="+uri+"\n");
    return gEncryptedUris.indexOf(uri) >= 0;
  },

  /*
   * Get GnuPG command line options for receiving the password depending
   * on the various user and system settings (gpg-agent/no passphrase)
   *
   * @return: Array the GnuPG command line options
   */

  passwdCommand: function () {
    var commandArgs = [];

    if (this.enigmailSvc.useGpgAgent()) {
       commandArgs.push("--use-agent");
    }
    else {
      if (! this.getPref("noPassphrase")) {
        commandArgs = commandArgs.concat([ "--passphrase-fd", "0", "--no-use-agent"]);
      }
    }

    return commandArgs;
  },

  requirePassword: function () {
    if (this.enigmailSvc.useGpgAgent()) {
      return false;
    }

    return (! this.getPref("noPassphrase"));
  },

  getAgentArgs: function (withBatchOpts) {
    // return the arguments to pass to every GnuPG subprocess

    function pushTrimmedStr(arr, str, splitStr) {
      // Helper function for pushing a string without leading/trailing spaces
      // to an array
      str = str.replace(/^ */, "").replace(/ *$/, "");
      if (str.length > 0) {
        if (splitStr) {
          var tmpArr = str.split(/[\t ]+/);
          for (var i=0; i< tmpArr.length; i++) {
            arr.push(tmpArr[i]);
          }
        }
        else {
          arr.push(str);
        }
      }
      return (str.length > 0);
    }

    var r = [ "--charset", "utf-8", "--display-charset", "utf-8" ]; // mandatory parameter to add in all cases

    try {
      var p = "";
      p = this.getPref("agentAdditionalParam").replace(/\\\\/g, "\\");

      var i = 0;
      var last = 0;
      var foundSign="";
      var startQuote=-1;

      while ((i=p.substr(last).search(/['"]/)) >= 0) {
        if (startQuote==-1) {
          startQuote = i;
          foundSign=p.substr(last).charAt(i);
          last = i +1;
        }
        else if (p.substr(last).charAt(i) == foundSign) {
          // found enquoted part
          if (startQuote > 1) pushTrimmedStr(r, p.substr(0, startQuote), true);

          pushTrimmedStr(r, p.substr(startQuote + 1, last + i - startQuote -1), false);
          p = p.substr(last + i + 1);
          last = 0;
          startQuote = -1;
          foundSign = "";
        }
        else {
          last = last + i + 1;
        }
      }

      pushTrimmedStr(r, p, true);
    }
    catch (ex) {}


    if (withBatchOpts) {
      r = r.concat(GPG_BATCH_OPT_LIST);
    }

    return r;
  },

  getFilePathDesc: function (nsFileObj) {
    if (this.getOS() == "WINNT")
      return nsFileObj.persistentDescriptor;
    else
      return nsFileObj.path;
  },

  printCmdLine: function (command, args) {

    function getQuoted(str) {
      let i = str.indexOf(" ");
      if (i>=0) {
        return '"' + str +'"'
      }
      else
        return str;
    }

    var rStr = getQuoted(this.getFilePathDesc(command)) +" ";

    let i;
    rStr += [getQuoted(args[i]) for (i in args)].join(" ").replace(/\\\\/g, '\\');

    return rStr;
  },

  fixExitCode: function (exitCode, statusFlags) {
    if (exitCode != 0) {
      if ((statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
          (statusFlags & nsIEnigmail.DECRYPTION_OKAY )) {
        this.DEBUG_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode for decrypted msg "+exitCode+"->0\n");
        exitCode = 0;
      }
    }

    if ((this.enigmailSvc.agentType == "gpg") && (exitCode == 256) && (this.getOS() == "WINNT")) {
      this.WARNING_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
      if (statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
        this.WARNING_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->2\n");
        exitCode = 2;
      } else {
        this.WARNING_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->0\n");
        exitCode = 0;
      }
    }
    if ((this.enigmailSvc.agentVersion < "1.4.1") && this.isDosLike()) {
        if ((exitCode == 2) && (!(statusFlags & (nsIEnigmail.BAD_PASSPHRASE |
                                nsIEnigmail.UNVERIFIED_SIGNATURE |
                                nsIEnigmail.MISSING_PASSPHRASE |
                                nsIEnigmail.BAD_ARMOR |
                                nsIEnigmail.DECRYPTION_INCOMPLETE |
                                nsIEnigmail.DECRYPTION_FAILED |
                                nsIEnigmail.NO_PUBKEY |
                                nsIEnigmail.NO_SECKEY)))) {
        this.WARNING_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Using gpg version "+this.enigmailSvc.agentVersion+", activating countermeasures for file renaming bug.\n");
        exitCode = 0;
      }
    }
    return exitCode;
  },

  generateKey: function (parent, name, comment, email, expiryDate, keyLength, keyType,
            passphrase, listener) {
    this.WRITE_LOG("enigmailCommon.jsm: generateKey:\n");

    if (gKeygenProcess)
      throw Components.results.NS_ERROR_FAILURE;

    var args = this.getAgentArgs(true);
    args.push("--gen-key");

    this.CONSOLE_LOG(this.printCmdLine(this.enigmailSvc.agentPath, args));

    var inputData = "%echo Generating key\nKey-Type: ";

    switch (keyType) {
    case KEYTYPE_DSA:
      inputData += "DSA\nKey-Length: "+keyLength+"\nSubkey-Type: 16\nSubkey-Length: ";
      break;
    case KEYTYPE_RSA:
      inputData += "RSA\nKey-Usage: sign,auth\nKey-Length: "+keyLength;
      inputData += "\nSubkey-Type: RSA\nSubkey-Usage: encrypt\nSubkey-Length: ";
      break;
    default:
      return null;
    }

    inputData += keyLength+"\n";
    if (name.replace(/ /g, "").length)
      inputData += "Name-Real: "+name+"\n";
    if (comment && comment.replace(/ /g, "").length)
      inputData += "Name-Comment: "+comment+"\n";
    inputData += "Name-Email: "+email+"\n";
    inputData += "Expire-Date: "+String(expiryDate)+"\n";

    this.CONSOLE_LOG(inputData+" \n");

    if (passphrase.length)
      inputData += "Passphrase: "+passphrase+"\n";

    inputData += "%commit\n%echo done\n";

    var proc = null;

    try {
      proc = subprocess.call({
        command:     this.enigmailSvc.agentPath,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        stdin: function (pipe) {
          pipe.write(inputData);
          pipe.close();
        },
        stderr: function(data) {
          listener.onDataAvailable(data);
        },
        done: function(result) {
          gKeygenProcess = null;
          try {
            listener.onStopRequest(result.exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    } catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: generateKey: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    gKeygenProcess = proc;

    this.DEBUG_LOG("enigmailCommon.jsm: generateKey: subprocess = "+proc+"\n");

    return proc;
  },

  getIoService: function() {
    var ioServ = Cc[this.IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
    return ioServ;
  },

  newStringChannel: function(uri, contentType, contentCharset, data)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: newStringChannel\n");

    var inputStream = Cc[NS_STRING_INPUT_STREAM_CONTRACTID].createInstance(Ci.nsIStringInputStream);
    inputStream.setData(data,-1);

    if (! contentCharset || contentCharset.length==0) {
      var ioServ = this.getIoService();
      var netUtil = ioServ.QueryInterface(Ci.nsINetUtil);
      var newCharset = {};
      var hadCharset = {};
      var mimeType = netUtil.parseContentType(contentType, newCharset, hadCharset);
      contentCharset = newCharset.value;

    }

    var isc = Cc[NS_INPUT_STREAM_CHNL_CONTRACTID].createInstance(Ci.nsIInputStreamChannel);
    isc.setURI(uri);
    isc.contentStream = inputStream;

    var chan  = isc.QueryInterface(Ci.nsIChannel);
    if (contentType && contentType.length) chan.contentType = contentType;
    if (contentCharset && contentCharset.length) chan.contentCharset = contentCharset;

    this.DEBUG_LOG("enigmailCommon.jsm: newStringChannel - done\n");

    return chan;
  },

  getHttpProxy: function (hostName) {

    function GetPasswdForHost(hostname, userObj, passwdObj) {
      var loginmgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

      // search HTTP password 1st
      var logins = loginmgr.findLogins({}, "http://"+hostname, "", "");
      if (logins.length > 0) {
        userObj.value = logins[0].username;
        passwdObj.value = logins[0].password;
        return true;
      }

      // look for any other password for same host
      logins = loginmgr.getAllLogins({});
      for (var i=0; i < logins.lenth; i++) {
        if (hostname == logins[i].hostname.replace(/^.*:\/\//, "")) {
          userObj.value = logins[i].username;
          passwdObj.value = logins[i].password;
          return true;
        }
      }
      return false;
    }

    var proxyHost = null;
    if (this.prefBranch.getBoolPref("respectHttpProxy")) {
      // determine proxy host
      var prefsSvc = Cc[NS_PREFS_SERVICE_CID].getService(Ci.nsIPrefService);
      var prefRoot = prefsSvc.getBranch(null);
      var useProxy = prefRoot.getIntPref("network.proxy.type");
      if (useProxy==1) {
        var proxyHostName = prefRoot.getCharPref("network.proxy.http");
        var proxyHostPort = prefRoot.getIntPref("network.proxy.http_port");
        var noProxy = prefRoot.getCharPref("network.proxy.no_proxies_on").split(/[ ,]/);
        for (var i=0; i<noProxy.length; i++) {
          var proxySearch=new RegExp(noProxy[i].replace(/\./, "\\.")+"$", "i");
          if (noProxy[i] && hostName.search(proxySearch)>=0) {
            i=noProxy.length+1;
            proxyHostName=null;
          }
        }

        if (proxyHostName) {
          var userObj = new Object();
          var passwdObj = new Object();
          if (GetPasswdForHost(proxyHostName, userObj, passwdObj)) {
            proxyHostName = userObj.value+":"+passwdObj.value+"@"+proxyHostName;
          }
        }
        if (proxyHostName && proxyHostPort) {
          proxyHost="http://"+proxyHostName+":"+proxyHostPort;
        }
      }
    }

    return proxyHost;
  },

  getSecretKeys: function (win) {
    // return a sorted array containing objects of (valid, usable) secret keys.
    // @return: [ {name: <userId>, id: 0x1234ABCD, created: YYYY-MM-DD },  { ... } ]
    var enigmailSvc = this.getService(win);
    if (!enigmailSvc) {
      return null;
    }
    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj = new Object();
    var keyList=enigmailSvc.getUserIdList(true, false, exitCodeObj, statusFlagsObj, errorMsgObj);

    if (exitCodeObj.value != 0) {
      this.alert(errorMsgObj.value);
      return null;
    }

    var userList=keyList.split(/\n/);
    var secretKeyList = new Array();
    var secretKeyCreated = new Array();
    var i;

    var keyId = null;
    var keys = [];
    for (i=0; i < userList.length; i++) {
      if (userList[i].substr(0,4) == "sec:") {
        var aLine=userList[i].split(/:/);
        keyId = aLine[4];
        secretKeyCreated[keyId] = this.getDateTime(aLine[5], true, false);
        secretKeyList.push(keyId);
      }
    }

    keyList = enigmailSvc.getKeyDetails(secretKeyList.join(" "), false);
    userList=keyList.split(/\n/);

    for (i=0; i < userList.length; i++) {
      var aLine = userList[i].split(/:/);
      switch (aLine[0]) {
      case "pub":
        if (aLine[1] == "u") keyId = aLine[4]; // public key is ultimately trusted
        break;
      case "uid":
        if ((keyId != null) && (aLine[1] == 'u')) {
          // UID is valid and ultimately trusted
          keys.push({ name: this.convertGpgToUnicode(aLine[9]),
                      id: keyId,
                      created: secretKeyCreated[keyId]});
          keyId = null;
        }
      }
    }

    keys.sort(function(a,b) { return a.name == b.name ? (a.id < b.id ? -1 : 1) : (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1); });
    return keys;
  },

  receiveKey: function (recvFlags, keyserver, keyId, listener, errorMsgObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: receiveKey: "+keyId+"\n");

    if (! (this.enigmailSvc && this.enigmailSvc.initialized)) {
      this.ERROR_LOG("enigmailCommon.jsm: receiveKey: not yet initialized\n");
      errorMsgObj.value = this.getString("notInit");
      return null;
    }

    if (!keyserver) {
      errorMsgObj.value = this.getString("failNoServer");
      return null;
    }

    if (!keyId && ! (recvFlags & nsIEnigmail.REFRESH_KEY)) {
      errorMsgObj.value = this.getString("failNoID");
      return null;
    }

    var proxyHost = this.getHttpProxy(keyserver);
    var args = this.getAgentArgs(false);

    if (! (recvFlags & nsIEnigmail.SEARCH_KEY)) args = this.getAgentArgs(true);

    if (proxyHost) {
      args = args.concat(["--keyserver-options", "http-proxy="+proxyHost]);
    }
    args = args.concat(["--keyserver", keyserver]);

    var keyIdList = keyId.split(" ");

    if (recvFlags & nsIEnigmail.DOWNLOAD_KEY) {
      args.push("--recv-keys");
      args = args.concat(keyIdList);
    }
    else if (recvFlags & nsIEnigmail.SEARCH_KEY) {
      args.push("--search-keys");
      args = args.concat(keyIdList);
    }
    else if (recvFlags & nsIEnigmail.UPLOAD_KEY) {
      args.push("--send-keys");
      args = args.concat(keyIdList);
    }
    else if (recvFlags & nsIEnigmail.REFRESH_KEY) {
      args.push("--refresh-keys");
    }


    this.CONSOLE_LOG("enigmail> "+this.printCmdLine(this.enigmailSvc.agentPath, args)+"\n");

    var proc = null;

    try {
      proc = subprocess.call({
        command:     this.enigmailSvc.agentPath,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        stdout: function(data) {
          listener.onStdoutData(data);
        },
        stderr: function(data) {
          listener.onErrorData(data);
        },
        done: function(result) {
          gKeygenProcess = null;
          try {
            listener.onStopRequest(result.exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    }
    catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: receiveKey: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    if (!proc) {
      this.ERROR_LOG("enigmailCommon.jsm: receiveKey: subprocess failed due to unknown reasons\n");
      return null;
    }

    return proc;
  },

  searchKey: function (recvFlags, protocol, keyserver, port, keyValue, listener, errorMsgObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: Enigmail.searchKey: "+keyValue+"\n");

    if (! (this.enigmailSvc && this.enigmailSvc.initialized)) {
      this.ERROR_LOG("enigmailCommon.jsm: searchKey: not yet initialized\n");
      errorMsgObj.value = this.getString("notInit");
      return null;
    }

    if (!keyserver) {
      errorMsgObj.value = this.getString("failNoServer");
      return null;
    }

    if (!keyValue) {
      errorMsgObj.value = this.getString("failNoID");
      return null;
    }

    var args;
    var command = null;

    var proxyHost = null;
    if (protocol=="hkp") {
      proxyHost = this.getHttpProxy(keyserver);
    }

    command = this.agentPath;
    args= this.getAgentArgs(false);
    args = args.concat(["--command-fd", "0", "--no-tty", "--batch", "--fixed-list", "--with-colons"]);
    if (proxyHost) args = args.concat(["--keyserver-options", "http-proxy="+proxyHost]);
    args.push("--keyserver");
    if (! protocol) protocol="hkp";
    if (port) {
      args.push(protocol + "://" + keyserver + ":"+port);
    }
    else {
      args.push(protocol + "://" + keyserver);
    }

    var inputData = null;
    if (recvFlags & nsIEnigmail.SEARCH_KEY) {
      args.push("--search-keys");
      inputData = "quit\n";
    }
    else if (recvFlags & nsIEnigmail.DOWNLOAD_KEY) {
      args = args.concat(["--status-fd", "1", "--recv-keys"]);
    }
    args.push(keyValue);

    this.CONSOLE_LOG("enigmail> "+this.printCmdLine(this.enigmailSvc.agentPath, args)+"\n");

    var proc = null;

    try {
      proc = subprocess.call({
        command:     this.enigmailSvc.agentPath,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        stdin: inputData,
        stdout: function(data) {
          listener.onStdoutData(data);
        },
        stderr: function(data) {
          listener.onErrorData(data);
        },
        done: function(result) {
          gKeygenProcess = null;
          try {
            listener.onStopRequest(result.exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    }
    catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: searchKey: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    if (!proc) {
      this.ERROR_LOG("enigmailCommon.jsm: searchKey: subprocess failed due to unknown reasons\n");
      return null;
    }

    return proc;
  },


  //////////////// Passphrase Mangagement /////////

  getMaxIdleMinutes: function () {
    var maxIdleMinutes = 5;
    try {
      maxIdleMinutes = this.getPref("maxIdleMinutes");
    } catch (ex) {}

    return maxIdleMinutes;
  },

  haveCachedPassphrase: function () {
    this.DEBUG_LOG("enigmailCommon.jsm: haveCachedPassphrase: \n");

    var havePassphrase = ((typeof gCachedPassphrase) == "string");

    if (!havePassphrase)
      return false;

    var curDate = new Date();
    var currentTime = curDate.getTime();

    var maxIdleMinutes = this.getMaxIdleMinutes();
    var delayMillisec = maxIdleMinutes*60*1000;

    var expired = ((currentTime - _lastActiveTime) >= delayMillisec);

  //  this.DEBUG_LOG("enigmailCommon.jsm: haveCachedPassphrase: ")
  //  this.DEBUG_LOG("currentTime="+currentTime+", _lastActiveTime="+this._lastActiveTime+", expired="+expired+"\n");

    if (expired && (_passwdAccessTimes <= 0)) {
      // Too much idle time; forget cached password
      gCachedPassphrase = null;
      havePassphrase = false;

      this.WRITE_LOG("enigmailCommon.jsm: haveCachedPassphrase: CACHE IDLED OUT\n");
    }

    return havePassphrase;
  },

  stillActive: function () {
    this.DEBUG_LOG("enigmailCommon.jsm: stillActive: \n");

    // Update last active time
    var curDate = new Date();
    _lastActiveTime = curDate.getTime();
    // this.DEBUG_LOG("enigmailCommon.jsm: stillActive: _lastActiveTime="+this._lastActiveTime+"\n");
  },

  clearCachedPassphrase: function () {
    this.DEBUG_LOG("enigmailCommon.jsm: clearCachedPassphrase: \n");

    gCachedPassphrase = null;
  },

  setCachedPassphrase: function (passphrase) {
    this.DEBUG_LOG("enigmailCommon.jsm: setCachedPassphrase: \n");

    gCachedPassphrase = passphrase;
    this.stillActive();

    var maxIdleMinutes = this.getMaxIdleMinutes();

    var createTimerType = null;
    const nsITimer = Ci.nsITimer;

    if (this.haveCachedPassphrase() && (_passwdAccessTimes > 0) && (maxIdleMinutes <= 0)) {
      // we remember the passphrase for at most 1 minute
      createTimerType = nsITimer.TYPE_ONE_SHOT;
      maxIdleMinutes = 1;
    }
    else if (this.haveCachedPassphrase() && (maxIdleMinutes > 0)) {
      createTimerType = nsITimer.TYPE_REPEATING_SLACK;
    }

    if (createTimerType != null) {
      // Start timer
      if (gCacheTimer)
        gCacheTimer.cancel();

      var delayMillisec = maxIdleMinutes*60*1000;

      gCacheTimer = Cc[NS_TIMER_CONTRACTID].createInstance(nsITimer);

      if (!gCacheTimer) {
        this.ERROR_LOG("enigmailCommon.jsm: setCachedPassphrase: Error - failed to create timer\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

      gCacheTimer.init(this, delayMillisec,
                        createTimerType);

      this.DEBUG_LOG("enigmailCommon.jsm: setCachedPassphrase: gCacheTimer="+gCacheTimer+"\n");
    }
  },

  getPassphrase: function (domWindow, passwdObj, useAgentObj, rememberXTimes) {

    this.DEBUG_LOG("enigmailCommon.jsm: getPassphrase:\n");

    useAgentObj.value = false;
    try {
      var noPassphrase = this.getPref("noPassphrase");
      useAgentObj.value = this.enigmailSvc.useGpgAgent();

      if (noPassphrase || useAgentObj.value) {
        passwdObj.value = "";
        return true;
      }

    }
    catch(ex) {}

    var maxIdleMinutes = this.getMaxIdleMinutes();

    if (this.haveCachedPassphrase()) {
      passwdObj.value = gCachedPassphrase;

      if (_passwdAccessTimes > 0) {
        --_passwdAccessTimes;

        if (_passwdAccessTimes <= 0 && maxIdleMinutes <= 0) {
          this.clearCachedPassphrase();
        }
      }
      return true;
    }

    // Obtain password interactively
    var checkObj = new Object();

    var promptMsg = this.getString("enterPassOrPin");
    passwdObj.value = "";
    checkObj.value = true;

    var checkMsg = (maxIdleMinutes>0) ? this.getString("rememberPass", [ maxIdleMinutes ]) : "";

    var success;

    var promptService = Cc[NS_PROMPTSERVICE_CONTRACTID].getService(Ci.nsIPromptService);

    try {
      success = promptService.promptPassword(domWindow,
                                           this.getString("enigPrompt"),
                                           promptMsg,
                                           passwdObj,
                                           checkMsg,
                                           checkObj);
    }
    catch(ex) {
      // domWindow is not always available
      success = promptService.promptPassword(null,
                                           this.getString("enigPrompt"),
                                           promptMsg,
                                           passwdObj,
                                           checkMsg,
                                           checkObj);

    }

    if (!success)
      return false;

    this.DEBUG_LOG("enigmailCommon.jsm:: GetPassphrase: got passphrase\n");

    // remember the passphrase for accessing serveral times in a sequence

    if (rememberXTimes) _passwdAccessTimes = rememberXTimes;

    // Remember passphrase only if necessary
    if ((checkObj.value && (maxIdleMinutes > 0)) || rememberXTimes)
      this.setCachedPassphrase(passwdObj.value, rememberXTimes);

    return true;
  },

  clearPassphrase: function (win) {
    this.DEBUG_LOG("enigmailCommon.jsm: clearPassphrase:\n");

    var enigmailSvc = this.getService(win);
    if (!enigmailSvc)
      return;

    if (enigmailSvc.useGpgAgent(win)) {
      this.alert(win, this.getString("passphraseCannotBeCleared"));
    }
    else {
      this.clearCachedPassphrase();
      this.alertPref(win, this.getString("passphraseCleared"), "warnClearPassphrase");
    }
  },

  getLocalFileApi: function () {
    return Ci.nsIFile;
  },


  // Extract public key from Status Message
  extractPubkey: function (statusMsg) {
    var keyId = null;
    var matchb = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);

    if (matchb && (matchb.length > 3)) {
      this.DEBUG_LOG("enigmailCommon.jsm:: Enigmail.extractPubkey: NO_PUBKEY 0x"+matchb[3]+"\n");
      keyId = matchb[2]+matchb[3];
    }

    return keyId;
  },


  /* listener object:
      stdin(pipe),
      stdout(data),
      stderr(data),
      done(exitCode) */

  execStart: function (command, args, needPassphrase, domWindow, listener, statusFlagsObj) {
    this.WRITE_LOG("enigmailCommon.jsm: execStart: command = "+this.printCmdLine(command, args)+", needPassphrase="+needPassphrase+", domWindow="+domWindow+", listener="+listener+"\n");

    if (! listener) listener = {};

    statusFlagsObj.value = 0;

    var passphrase = null;
    var proc = null;
    var useAgentObj = {value: false};

    if (needPassphrase) {
      args = args.concat(this.passwdCommand());

      var passwdObj = new Object();

      if (!this.getPassphrase(domWindow, passwdObj, useAgentObj, 0)) {
         this.ERROR_LOG("enigmailCommon.jsm: execStart: Error - no passphrase supplied\n");

         statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
         return null;
      }

      passphrase = passwdObj.value;
    }

    listener.command = command;

    this.CONSOLE_LOG("enigmail> "+this.printCmdLine(command, args)+"\n");

    try {
      proc = subprocess.call({
        command:     command,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        bufferedOutput: true,
        stdin: function (pipe) {
          if (needPassphrase) {
            // Write to child STDIN
            // (ignore errors, because child may have exited already, closing STDIN)
            try {
              if (EnigmailCommon.requirePassword()) {
                 pipe.write(passphrase+"\n");
              }
            } catch (ex) {}
          }

          if (listener.stdin) listener.stdin(pipe);
        },
        stdout: function(data) { listener.stdout(data); },
        stderr: function(data) { listener.stderr(data); },
        done: function(result) {
          try {
            listener.done(result.exitCode);
          }
          catch (ex) {
            EnigmailCommon.writeException("enigmailCommon.jsm", ex);
          }
        },
        mergeStderr: false
      });
    } catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: execStart: subprocess.call failed with '"+ex.toString()+"'\n");
      return null;
    }

    return proc;
  },

  /*
     requirements for listener object:
      exitCode
      stderrData
    */
  execEnd: function (listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj, blockSeparationObj) {

    this.DEBUG_LOG("enigmailCommon.jsm: execEnd:\n");

    cmdLineObj.value = listener.command;

    var exitCode = listener.exitCode;
    var errOutput = listener.stderrData;


    this.DEBUG_LOG("enigmailCommon.jsm: execEnd: exitCode = "+exitCode+"\n");
    this.DEBUG_LOG("enigmailCommon.jsm: execEnd: errOutput = "+errOutput+"\n");

    var retObj = {};
    errorMsgObj.value = this.parseErrorOutput(errOutput, retObj);
    statusFlagsObj.value = retObj.statusFlags;
    statusMsgObj.value = retObj.statusMsg;
    if (! blockSeparationObj) blockSeparationObj = {};
    blockSeparationObj.value = retObj.blockSeparation;

    if (errOutput.search(/jpeg image of size \d+/)>-1) {
      statusFlagsObj.value |= nsIEnigmail.PHOTO_AVAILABLE;
    }
    if (blockSeparationObj && blockSeparationObj.value.indexOf(" ") > 0) {
      exitCode = 2;
    }

    this.CONSOLE_LOG(this.convertFromUnicode(errorMsgObj.value)+"\n");

    this.stillActive();

    return exitCode;
  },


  /***
   * Start decryption by launching gpg
   * win:               window object for password prompt
   * verifyOnly:        Boolean: true if message is to be verified; false if message is
   *                    decrypted and result is returned
   * listener:          listener object for getting results from process (see execStart)
   * statusFlagsObj:    object for getting status flags in .value property
   * errorMsgObj:       object for getting error message text in .value property
   * mimeSignatureFile: file name for separate signature file
   * maxOutputLength:   maximum output length for GnuPG; 0 for infinite
   */

  decryptMessageStart: function (win, verifyOnly, noOutput, listener,
                                 statusFlagsObj, errorMsgObj, mimeSignatureFile,
                                 maxOutputLength) {
    this.DEBUG_LOG("enigmailCommon.jsm: decryptMessageStart: verifyOnly="+verifyOnly+"\n");

    this.getService(win);
    if (! (this.enigmailSvc)) {
      this.ERROR_LOG("enigmailCommon.jsm: decryptMessageStart: not yet initialized\n");
      errorMsgObj.value = this.getString("notInit");
      return null;
    }

    if (gKeygenProcess) {
      errorMsgObj.value = this.getString("notComplete");
      return null;
    }

    var args = this.getAgentArgs(true);

    var keyserver = this.getPref("autoKeyRetrieve");
    if (keyserver && keyserver != "") {
      args.push("--keyserver-options");
      var keySrvArgs="auto-key-retrieve";
      var srvProxy = this.getHttpProxy(keyserver);
      if (srvProxy) {
        keySrvArgs += ",http-proxy="+srvProxy;
      }
      args.push(keySrvArgs);
      args.push("--keyserver");
      args.push(keyserver);
    }

    if (noOutput) {
      args.push("--verify");

      if (mimeSignatureFile) {
        args.push(mimeSignatureFile);
        args.push("-");
      }

    } else {
      if (maxOutputLength) {
        args.push("--max-output");
        args.push(String(maxOutputLength));
      }

      args.push("--decrypt");
    }

    var proc = this.execStart(this.enigmailSvc.agentPath, args, !verifyOnly, win,
                              listener, statusFlagsObj);

    if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
      this.ERROR_LOG("enigmailCommon.jsm: decryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = this.getString("noPassphrase");
      return null;
    }

    return proc;
  },

  decryptMessageEnd: function (stderrStr, exitCode, outputLen, verifyOnly, noOutput, uiFlags, retStatusObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: decryptMessageEnd: uiFlags="+uiFlags+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

    this.DEBUG_LOG("enigmailCommon.jsm: decryptMessageEnd: stderrStr="+stderrStr+"\n");
    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
    var pgpMime     = uiFlags & nsIEnigmail.UI_PGP_MIME;
    var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
    var j;

    retStatusObj.statusFlags = 0;
    retStatusObj.errorMsg    = "";
    retStatusObj.blockSeparation  = "";

    var errorMsg = this.parseErrorOutput(stderrStr, retStatusObj);

    if (pgpMime) {
      retStatusObj.statusFlags |= verifyOnly ? nsIEnigmail.PGP_MIME_SIGNED
                                         : nsIEnigmail.PGP_MIME_ENCRYPTED;
    }

    var statusMsg = retStatusObj.statusMsg;
    exitCode = this.fixExitCode(exitCode, retStatusObj.statusFlags);
    if ((exitCode == 0) && !noOutput && !outputLen &&
        ((retStatusObj.statusFlags & (gStatusFlags.DECRYPTION_OKAY | gStatusFlags.GOODSIG)) == 0)) {
      exitCode = -1;
    }

    var errLines;
    var goodSignPat =   /GOODSIG (\w{16}) (.*)$/i;
    var badSignPat  =    /BADSIG (\w{16}) (.*)$/i;
    var keyExpPat   = /EXPKEYSIG (\w{16}) (.*)$/i;
    var revKeyPat   = /REVKEYSIG (\w{16}) (.*)$/i;
    var validSigPat =  /VALIDSIG (\w+) (.*) (\d+) (.*)/i;

    if (statusMsg) {
      errLines = statusMsg.split(/\r?\n/);
    }
    else {
      // should not really happen ...
      errLines = stderrStr.split(/\r?\n/);
    }

    retStatusObj.errorMsg = "";

    var matches;

    var signed = false;
    var goodSignature;

    var userId = "";
    var keyId = "";
    var sigDetails = "";

    for (j=0; j<errLines.length; j++) {
      matches = errLines[j].match(badSignPat);

      if (matches && (matches.length > 2)) {
        signed = true;
        goodSignature = false;
        userId = matches[2];
        keyId = matches[1];
        break;
      }

      matches = errLines[j].match(revKeyPat);

      if (matches && (matches.length > 2)) {
        signed = true;
        goodSignature = true;
        userId = matches[2];
        keyId = matches[1];
        break;
      }

      matches = errLines[j].match(goodSignPat);

      if (matches && (matches.length > 2)) {
        signed = true;
        goodSignature = true;
        userId = matches[2];
        keyId = matches[1];
        break;
      }

      matches = errLines[j].match(keyExpPat);

      if (matches && (matches.length > 2)) {
        signed = true;
        goodSignature = true;
        userId = matches[2];
        keyId = matches[1];

        break;
      }
    }

    if (goodSignature) {
      for (j=0; j<errLines.length; j++) {
        matches = errLines[j].match(validSigPat);
        if (matches && (matches.length > 4)) {
          if (matches[4].length==40)
            // in case of several subkeys refer to the main key ID.
            // Only works with PGP V4 keys (Fingerprint length ==40)
            keyId = matches[4].substr(-16);
        }
        if (matches && (matches.length > 2)) {
          sigDetails = errLines[j].substr(9);
          break;
        }
      }
    }

    if (userId && keyId && this.prefBranch.getBoolPref("displaySecondaryUid")) {
      let uids = this.enigmailSvc.getKeyDetails(keyId, true, true);
      if (uids) {
        userId = uids;
      }
      if (uids.indexOf("uat:jpegPhoto:") >= 0) {
        retStatusObj.statusFlags |= nsIEnigmail.PHOTO_AVAILABLE;
      }
    }

    if (userId) {
      userId = this.convertToUnicode(userId, "UTF-8");
    }

    retStatusObj.userId = userId;
    retStatusObj.keyId = keyId;
    retStatusObj.sigDetails = sigDetails;

    if (signed) {
      var trustPrefix = "";

      if (retStatusObj.statusFlags & nsIEnigmail.UNTRUSTED_IDENTITY) {
        trustPrefix += this.getString("prefUntrusted")+" ";
      }

      if (retStatusObj.statusFlags & nsIEnigmail.REVOKED_KEY) {
        trustPrefix += this.getString("prefRevoked")+" ";
      }

      if (retStatusObj.statusFlags & nsIEnigmail.EXPIRED_KEY_SIGNATURE) {
        trustPrefix += this.getString("prefExpiredKey")+" ";

      } else if (retStatusObj.statusFlags & nsIEnigmail.EXPIRED_SIGNATURE) {
        trustPrefix += this.getString("prefExpired")+" ";
      }

      if (goodSignature) {
        retStatusObj.errorMsg = trustPrefix + this.getString("prefGood", [userId]); /* + ", " +
              this.getString("keyId") + " 0x" + keyId.substring(8,16); */
      } else {
        retStatusObj.errorMsg = trustPrefix + this.getString("prefBad", [userId]); /*+ ", " +
              this.getString("keyId") + " 0x" + keyId.substring(8,16); */
        if (!exitCode)
          exitCode = 1;
      }
    }

    if (retStatusObj.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
      retStatusObj.keyId = this.extractPubkey(statusMsg);

      if (retStatusObj.statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
        exitCode=0;
      }
    }

    if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
      // "Unremember" passphrase on decryption failure
      this.clearCachedPassphrase();
    }

    if (exitCode != 0) {
      // Error processing
      this.DEBUG_LOG("enigmailCommon.jsm: decryptMessageEnd: command execution exit code: "+exitCode+"\n");
    }

    return exitCode;
  },

  getEncryptCommand: function (fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: getEncryptCommand: hashAlgorithm="+hashAlgorithm+"\n");

    try {
      fromMailAddr = stripEmailAdr(fromMailAddr);
      toMailAddr = stripEmailAdr(toMailAddr);
      bccMailAddr = stripEmailAdr(bccMailAddr);

    } catch (ex) {
      errorMsgObj.value = this.getString("invalidEmail");
      return null;
    }

    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;
    var usePgpMime =  sendFlags & nsIEnigmail.SEND_PGP_MIME;

    var useDefaultComment = false;
    try {
       useDefaultComment = this.prefBranch.getBoolPref("useDefaultComment");
    } catch(ex) { }

    var hushMailSupport = false;
    try {
       hushMailSupport = this.prefBranch.getBoolPref("hushMailSupport");
    } catch(ex) { }

    var detachedSig = (usePgpMime || (sendFlags & nsIEnigmail.SEND_ATTACHMENT)) && signMsg && !encryptMsg;

    var toAddrList = toMailAddr.split(/\s*,\s*/);
    var bccAddrList = bccMailAddr.split(/\s*,\s*/);
    var k;

    var encryptArgs = this.getAgentArgs(true);

    if (!useDefaultComment)
      encryptArgs = encryptArgs.concat(["--comment", GPG_COMMENT_OPT.replace(/\%s/, this.getAppName())]);

    var angledFromMailAddr = ((fromMailAddr.search(/^0x/) == 0) || hushMailSupport)
                           ? fromMailAddr : "<" + fromMailAddr + ">";
    angledFromMailAddr = angledFromMailAddr.replace(/([\"\'\`])/g, "\\$1");

    if (signMsg && hashAlgorithm) {
      encryptArgs = encryptArgs.concat(["--digest-algo", hashAlgorithm]);
    }

    if (encryptMsg) {
      switch (isAscii) {
      case ENC_TYPE_MSG:
        encryptArgs.push("-a");
        encryptArgs.push("-t");
        break;
      case ENC_TYPE_ATTACH_ASCII:
        encryptArgs.push("-a");
      }

      encryptArgs.push("--encrypt");

      if (signMsg)
        encryptArgs.push("--sign");

      if (sendFlags & nsIEnigmail.SEND_ALWAYS_TRUST) {
        if (this.enigmailSvc.agentVersion >= "1.4") {
          encryptArgs.push("--trust-model");
          encryptArgs.push("always");
        }
        else {
          encryptArgs.push("--always-trust");
        }
      }
      if ((sendFlags & nsIEnigmail.SEND_ENCRYPT_TO_SELF) && fromMailAddr)
        encryptArgs = encryptArgs.concat(["--encrypt-to", angledFromMailAddr]);

      for (k=0; k<toAddrList.length; k++) {
        toAddrList[k] = toAddrList[k].replace(/\'/g, "\\'");
        if (toAddrList[k].length > 0) {
           encryptArgs.push("-r");
           if (toAddrList[k].search(/^GROUP:/) == 0) {
             // groups from gpg.conf file
             encryptArgs.push(toAddrList[k].substr(6));
           }
           else {
             encryptArgs.push((hushMailSupport || (toAddrList[k].search(/^0x/) == 0)) ? toAddrList[k]
                            :"<" + toAddrList[k] + ">");
           }
        }
      }

      for (k=0; k<bccAddrList.length; k++) {
        bccAddrList[k] = bccAddrList[k].replace(/\'/g, "\\'");
        if (bccAddrList[k].length > 0) {
          encryptArgs.push("--hidden-recipient");
          encryptArgs.push((hushMailSupport || (bccAddrList[k].search(/^0x/) == 0)) ? bccAddrList[k]
                    :"<" + bccAddrList[k] + ">");
        }
      }

    } else if (detachedSig) {
      encryptArgs = encryptArgs.concat(["-s", "-b"]);

      switch (isAscii) {
      case ENC_TYPE_MSG:
        encryptArgs = encryptArgs.concat(["-a", "-t"]);
        break;
      case ENC_TYPE_ATTACH_ASCII:
        encryptArgs.push("-a");
      }

    } else if (signMsg) {
      encryptArgs = encryptArgs.concat(["-t", "--clearsign"]);
    }

    if (fromMailAddr) {
      encryptArgs = encryptArgs.concat(["-u", angledFromMailAddr]);
    }

    return encryptArgs;
  },

  determineHashAlgorithm: function (win, uiFlags, fromMailAddr, hashAlgoObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm\n");

    if (! win) {
      var windowManager = Cc[this.APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      win = windowManager.getMostRecentWindow(null);
    }

    this.getService(win);
    if (! (this.enigmailSvc)) {
      this.ERROR_LOG("enigmailCommon.jsm: determineHashAlgorithm: not yet initialized\n");
      errorMsgObj.value = this.getString("notInit");
      return 2;
    }

    var sendFlags = nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED;

    var hashAlgo = gMimeHashAlgorithms[this.getPref("mimeHashAlgorithm")];

    if (typeof(gKeyAlgorithms[fromMailAddr]) != "string") {
      // hash algorithm not yet known
      var passwdObj   = new Object();
      var useAgentObj = new Object();
      // Get the passphrase and remember it for the next 2 subsequent calls to gpg
      if (!this.getPassphrase(null, passwdObj, useAgentObj, 2)) {
        this.ERROR_LOG("enigmailCommon.jsm: determineHashAlgorithm: Error - no passphrase supplied\n");

        return 3;
      }

      var testUiFlags = nsIEnigmail.UI_TEST;

      var listener = {
        stdoutData: "",
        stderrData: "",
        exitCode: -1,
        stdin: function(pipe) {
            pipe.write("Dummy Test");
            pipe.close();
        },
        stdout: function(data) {
          this.stdoutData += data;
        },
        stderr: function (data) {
          this.stderrData += data;
        },
        done: function(exitCode) {
          this.exitCode = exitCode;
        }
      };

      var statusFlagsObj = {};
      var errorMsgObj = {};
      var proc = this.encryptMessageStart(win, testUiFlags, fromMailAddr, "",
                              "", hashAlgo, sendFlags,
                              listener, statusFlagsObj, errorMsgObj);

      if (!proc) {
        return 1;
      }

      proc.wait();

      var msgText = listener.stdoutData;
      var exitCode = listener.exitCode;

      var retStatusObj = {};
      exitCode = this.encryptMessageEnd(listener.stderrData, exitCode,
                                        testUiFlags, sendFlags, 10,
                                        retStatusObj);

      if ((exitCode == 0) && !msgText) exitCode = 1;
      // if (exitCode > 0) exitCode = -exitCode;

      if (exitCode != 0) {
        // Abormal return
        if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
          // "Unremember" passphrase on error return
          this.clearCachedPassphrase();
          retStatusObj.errorMsg = this.getString("badPhrase");
        }
        this.alert(win, retStatusObj.errorMsg);
        return exitCode;
      }

      var hashAlgorithm = "md5"; // default as defined in RFC 4880, section 7

      var m = msgText.match(/^(Hash: )(.*)$/m);
      if (m && (m.length > 2) && (m[1] == "Hash: ")) {
        hashAlgorithm = m[2].toLowerCase();
      }
      else
        this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm: no hashAlgorithm specified - using MD5\n");

      for (var i=1; i < gMimeHashAlgorithms.length; i++) {
        if (gMimeHashAlgorithms[i] == hashAlgorithm) {
          this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm: found hashAlgorithm "+hashAlgorithm+"\n");
          gKeyAlgorithms[fromMailAddr] = hashAlgorithm;
          hashAlgoObj.value = hashAlgorithm;
          return 0;
        }
      }

      this.ERROR_LOG("enigmailCommon.jsm: determineHashAlgorithm: no hashAlgorithm found\n");
      return 2;
    }
    else {
      this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm: hashAlgorithm "+gKeyAlgorithms[fromMailAddr]+" is cached\n");
      hashAlgoObj.value = gKeyAlgorithms[fromMailAddr];
    }

    return 0;
  },

  // returns subprocess object
  encryptMessageStart: function (win, uiFlags, fromMailAddr, toMailAddr, bccMailAddr,
            hashAlgorithm, sendFlags, listener, statusFlagsObj, errorMsgObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: encryptMessageStart: uiFlags="+uiFlags+", from "+fromMailAddr+" to "+toMailAddr+", hashAlgorithm="+hashAlgorithm+" ("+this.bytesToHex(this.pack(sendFlags,4))+")\n");

    var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;

    var hashAlgo = gMimeHashAlgorithms[this.prefBranch.getIntPref("mimeHashAlgorithm")];

    if (hashAlgorithm) {
      hashAlgo = hashAlgorithm;
    }

    errorMsgObj.value = "";

    if (!sendFlags) {
      this.DEBUG_LOG("enigmailCommon.jsm: encryptMessageStart: NO ENCRYPTION!\n");
      errorMsgObj.value = this.getString("notRequired");
      return null;
    }

    this.getService(win);
    if (! (this.enigmailSvc)) {
      this.ERROR_LOG("enigmailCommon.jsm: encryptMessageStart: not yet initialized\n");
      errorMsgObj.value = this.getString("notInit");
      return null;
    }

    if (this.keygenProcess) {
      errorMsgObj.value = this.getString("notComplete");
      return null;
    }

    var encryptArgs = this.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, hashAlgo, sendFlags, ENC_TYPE_MSG, errorMsgObj);
    if (! encryptArgs)
      return null;

    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;

    var proc = this.execStart(this.enigmailSvc.agentPath, encryptArgs, signMsg, win, listener, statusFlagsObj);

    if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
      this.ERROR_LOG("enigmailCommon.jsm: encryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = "";
    }

    if (pgpMime && errorMsgObj.value) {
        this.alert(win, errorMsgObj.value);
    }

    return proc;
  },

  // returns exitCode
  encryptMessageEnd: function (stderrStr, exitCode, uiFlags, sendFlags, outputLen,
            retStatusObj)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: encryptMessageEnd: uiFlags="+uiFlags+", sendFlags="+this.bytesToHex(this.pack(sendFlags,4))+", outputLen="+outputLen+"\n");

    var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;
    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

    retStatusObj.statusFlags = 0;
    retStatusObj.errorMsg    = "";
    retStatusObj.blockSeparation  = "";

    if (!this.enigmailSvc.initialized) {
       this.ERROR_LOG("enigmailCommon.jsm: encryptMessageEnd: not yet initialized\n");
       retStatusObj.errorMsg = this.getString("notInit");
       return -1;
    }

    this.parseErrorOutput(stderrStr, retStatusObj);

    exitCode = this.fixExitCode(exitCode, retStatusObj.statusFlags);
    if ((exitCode == 0) && !outputLen) {
      exitCode = -1;
    }

    if (exitCode != 0 && (signMsg || encryptMsg)) {
      // GnuPG might return a non-zero exit code, even though the message was correctly
      // signed or encryped -> try to fix the exit code

      var correctedExitCode = 0;
      if (signMsg) {
        if (! (retStatusObj.statusFlags & nsIEnigmail.SIG_CREATED)) correctedExitCode = exitCode;
      }
      if (encryptMsg) {
        if (! (retStatusObj.statusFlags & nsIEnigmail.END_ENCRYPTION)) correctedExitCode = exitCode;
      }
      exitCode = correctedExitCode;
    }

    if (exitCode == 0) {
      // Normal return
      return 0;
    }

    // Error processing
    this.DEBUG_LOG("enigmailCommon.jsm: encryptMessageEnd: command execution exit code: "+exitCode+"\n");

    if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
      // "Unremember" passphrase on error return
      this.clearCachedPassphrase();
    }

    if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
      retStatusObj.errorMsg = this.getString("badPhrase");
    }
    else if (retStatusObj.statusFlags & nsIEnigmail.INVALID_RECIPIENT) {
      retStatusObj.errorMsg = retStatusObj.statusMsg;
    }
    else if (retStatusObj.statusFlags & nsIEnigmail.DISPLAY_MESSAGE) {
      retStatusObj.errorMsg = retStatusObj.statusMsg;
    }
    else {
      retStatusObj.errorMsg = this.getString("badCommand");
    }

    return exitCode;
  },


  // simple listener for using with execStart
  newSimpleListener: function(stdinFunc) {
    var simpleListener = {
      stdoutData: "",
      stderrData: "",
      exitCode: -1,
      stdin: function(pipe) {
          pipe.close();
      },
      stdout: function(data) {
        this.stdoutData += data;
      },
      stderr: function (data) {
        this.stderrData += data;
      },
      done: function(exitCode) {
        this.exitCode = exitCode;
      }
    };

    if (stdinFunc) simpleListener.stdin = stdinFunc;
    return simpleListener;
  },


  getAttachmentFileName: function (parent, byteData) {
    this.DEBUG_LOG("enigmailCommon.jsm: getAttachmentFileName\n");

    var args = this.getAgentArgs(true);
    args = args.concat(this.passwdCommand());
    args.push("--list-packets");

    var passphrase = null;
    var passwdObj = new Object();
    var useAgentObj = new Object();

    if (!this.getPassphrase(parent, passwdObj, useAgentObj, 0)) {
      this.ERROR_LOG("enigmailCommon.jsm: getAttachmentFileName: Error - no passphrase supplied\n");
      return null;
    }

    passphrase = passwdObj.value;

    var listener = this.newSimpleListener(
      function _stdin (pipe) {
          EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: getAttachmentFileName: _stdin\n");
          if (EnigmailCommon.requirePassword()) {
            pipe.write(passphrase+"\n");
          }
          pipe.write(byteData);
          pipe.write("\n");
          pipe.close();
      });

    var statusFlagsObj = {};
    var proc = this.execStart(this.enigmailSvc.agentPath, args, false, parent,
                              listener, statusFlagsObj);

    if (!proc) {
      return null;
    }

    proc.wait();

    var matches = listener.stdoutData.match(/:literal data packet:\r?\n.*name="(.*)",/m);
    if (matches && (matches.length > 1)) {
      var filename = escape(matches[1]).replace(/%5Cx/g, "%");
      return this.convertToUnicode(unescape(filename), "utf-8");
    }
    else
      return null;
  },

  getInstallLocation: function() {
    return gEnigInstallLocation;
  }

};


////////////////////////////////////////////////////////////////////////
// Local (not exported) functions & objects
////////////////////////////////////////////////////////////////////////
var timerObserver = {

  QueryInterface: XPCOMUtils.generateQI([ Ci.nsIObserver, Ci.nsISupports ]),

  observe: function (aSubject, aTopic, aData) {
    EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: timerObserver.observe: topic='"+aTopic+"' \n");

    if (aTopic == "timer-callback") {
      // Cause cached password to expire, if need be
      if (!EnigmailCommon.haveCachedPassphrase()) {
        // No cached password; cancel repeating timer
        if (gCacheTimer)
          gCacheTimer.cancel();
      }

    }
    else {
      EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: timerObserver.observe: no handler for '"+aTopic+"'\n");
    }
  }
};


function upgradeRecipientsSelection () {
  // Upgrade perRecipientRules and recipientsSelectionOption to
  // new recipientsSelection

  var  keySel = EnigmailCommon.getPref("recipientsSelectionOption");
  var  perRecipientRules = EnigmailCommon.getPref("perRecipientRules");

  var setVal = 2;

  /*
  1: rules only
  2: rules & email addresses (normal)
  3: email address only (no rules)
  4: manually (always prompt, no rules)
  5: no rules, no key selection
  */

  switch (perRecipientRules) {
  case 0:
    switch (keySel) {
    case 0:
      setVal = 5;
      break;
    case 1:
      setVal = 3;
      break;
    case 2:
      setVal = 4;
      break;
    default:
      setVal = 2;
    }
    break;
  case 1:
    setVal = 2;
    break;
  case 2:
    setVal = 1;
    break;
  default:
    setVal = 2;
  }

  // set new pref
  EnigmailCommon.setPref("recipientsSelection", setVal);

  // clear old prefs
  EnigmailCommon.prefBranch.clearUserPref("perRecipientRules");
  EnigmailCommon.prefBranch.clearUserPref("recipientsSelectionOption");
}


function upgradePrefsSending ()
{
  DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending()\n");

  var  cbs = EnigmailCommon.getPref("confirmBeforeSend");
  var  ats = EnigmailCommon.getPref("alwaysTrustSend");
  var  ksfr = EnigmailCommon.getPref("keepSettingsForReply");
  DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending cbs="+cbs+" ats="+ats+" ksfr="+ksfr+"\n");

  // Upgrade confirmBeforeSend (bool) to confirmBeforeSending (int)
  switch (cbs) {
    case false:
      EnigmailCommon.setPref("confirmBeforeSending", 0); // never
      break;
    case true:
      EnigmailCommon.setPref("confirmBeforeSending", 1); // always
      break;
  }

  // Upgrade alwaysTrustSend (bool)   to acceptedKeys (int)
  switch (ats) {
    case false:
      EnigmailCommon.setPref("acceptedKeys", 0); // valid
      break;
    case true:
      EnigmailCommon.setPref("acceptedKeys", 1); // all
      break;
  }

  // if all settings are default settings, use convenient encryption
  if (cbs==false && ats==true && ksfr==true) {
    EnigmailCommon.setPref("encryptionModel", 0); // convenient
    DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending() encryptionModel=0 (convenient)\n");
  }
  else {
    EnigmailCommon.setPref("encryptionModel", 1); // manually
    DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending() encryptionModel=1 (manually)\n");
  }

  // clear old prefs
  EnigmailCommon.prefBranch.clearUserPref("confirmBeforeSend");
  EnigmailCommon.prefBranch.clearUserPref("alwaysTrustSend");
}


// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email address
function stripEmailAdr(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       this.ERROR_LOG("enigmailCommon.jsm:: stripEmailAdr: Unmatched quote in mail address: "+mailAddrs+"\n");
       mailAddrs=mailAddrs.replace(/\"/g, "");
       break;
     }

     mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
  }

  // Eliminate all whitespace, just to be safe
  mailAddrs = mailAddrs.replace(/\s+/g,"");

  // Extract pure e-mail address list (stripping out angle brackets)
  mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

  return mailAddrs;
}


function upgradeHeadersView() {
  // all headers hack removed -> make sure view is correct
  var hdrMode = null;
  try {
    hdrMode = EnigmailCommon.getPref("show_headers");
  }
  catch (ex) {}

  if (hdrMode == null) hdrMode = 1;
  try {
    EnigmailCommon.prefBranch.clearUserPref("show_headers");
  }
  catch (ex) {}

  EnigmailCommon.prefRoot.setIntPref("mail.show_headers", hdrMode);
}

function upgradeCustomHeaders() {
  try {
    var extraHdrs = " " + EnigmailCommon.prefRoot.getCharPref("mailnews.headers.extraExpandedHeaders").toLowerCase() + " ";

    var extraHdrList = [
      "x-enigmail-version",
      "content-transfer-encoding",
      "openpgp",
      "x-mimeole",
      "x-bugzilla-reason",
      "x-php-bug" ];

    for (hdr in extraHdrList) {
      extraHdrs = extraHdrs.replace(" "+extraHdrList[hdr]+" ", " ");
    }

    extraHdrs = extraHdrs.replace(/^ */, "").replace(/ *$/, "");
    EnigmailCommon.prefRoot.setCharPref("mailnews.headers.extraExpandedHeaders", extraHdrs);
  }
  catch(ex) {}
}

function upgradePgpMime() {
  var pgpMimeMode = false;
  try {
    pgpMimeMode = (EnigmailCommon.getPref("usePGPMimeOption") == 2);
  }
  catch (ex) {
    return;
  }

  try {
    if (pgpMimeMode) {
      var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
      try {
        // Gecko >= 20
        for (var i=0; i < accountManager.allIdentities.length; i++) {
          var id = accountManager.allIdentities.queryElementAt(i, Ci.nsIMsgIdentity);
          if (id.getBoolAttribute("enablePgp")) {
            id.setBoolAttribute("pgpMimeMode", true);
          }
        }
      }
      catch(ex) {
        // Gecko < 20
        for (var i=0; i < accountManager.allIdentities.Count(); i++) {
          var id = accountManager.allIdentities.QueryElementAt(i, Ci.nsIMsgIdentity);
          if (id.getBoolAttribute("enablePgp")) {
            id.setBoolAttribute("pgpMimeMode", true);
          }
        }
      }
    }
    EnigmailCommon.prefBranch.clearUserPref("usePGPMimeOption");
  }
  catch (ex) {}
}

function ConfigureEnigmail() {
  var oldVer=EnigmailCommon.getPref("configuredVersion");

  try {
    EnigmailCommon.initPrefService();
    var vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
    if (oldVer == "") {
      EnigmailCommon.openSetupWizard();
    }
    else {
      if (oldVer < "0.95") {
        try {
          upgradeHeadersView();
          upgradePgpMime();
          upgradeRecipientsSelection();
        }
        catch (ex) {}
      }
      if (vc.compare(oldVer, "1.0") < 0) {
        upgradeCustomHeaders();
      }
      if (vc.compare(oldVer, "1.7a1pre") < 0) {
        upgradePrefsSending();
      }
    }
  }
  catch(ex) {};
  EnigmailCommon.setPref("configuredVersion", EnigmailCommon.getVersion());
  EnigmailCommon.savePrefs();
}


function initSubrocess(aFile) {
  var xulRuntime = Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime);
  var dllSuffix = xulRuntime.OS == "Darwin" ? ".dylib" : ".so";

  var installLocation = aFile.clone();
  installLocation.append("platform");
  installLocation.append(xulRuntime.OS+"_"+xulRuntime.XPCOMABI);
  installLocation.append("lib");
  installLocation.append("libsubprocess-"+xulRuntime.XPCOMABI+dllSuffix);
  subprocess.registerLibcWrapper(installLocation.path);
}

try {
  AddonManager.getAddonByID(ENIG_EXTENSION_GUID,
    function (addon) {
      gEnigExtensionVersion = addon.version;
      gEnigInstallLocation = addon.getResourceURI("").QueryInterface(Ci.nsIFileURL).file;
      initSubrocess(gEnigInstallLocation);
    }
  );

}
catch (ex) {
  dump("enigmailCommon.jsm: init error: "+ex+"\n");
}

