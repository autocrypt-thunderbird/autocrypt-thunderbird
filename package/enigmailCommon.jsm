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
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org> are
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


var EXPORTED_SYMBOLS = [ "EnigmailCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";
const DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";
const LOCALE_SVC_CONTRACTID = "@mozilla.org/intl/nslocaleservice;1";
const SCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const SEAMONKEY_ID   = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";


const hexTable = "0123456789abcdef";

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const ENIGMAIL_PREFS_ROOT = "extensions.enigmail.";


var gLogLevel = 3;
var gPromptSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);

var gEnigExtensionVersion;

try {
  // Gecko 2.0 only
  Components.utils.import("resource://gre/modules/AddonManager.jsm");
  AddonManager.getAddonByID(ENIG_EXTENSION_GUID,
    function (aAddon) {
      gEnigExtensionVersion = aAddon.version;
    }
  );
}
catch (ex) {}


var gStatusFlags = {GOODSIG:         nsIEnigmail.GOOD_SIGNATURE,
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
                    INV_SGNR:				 0x100000000
};

var EnigmailCommon = {

  // "constants"
  POSSIBLE_PGPMIME: -2081,
  PGP_DESKTOP_ATT : -2082,

  MSG_BUFFER_SIZE:  96000,
  MSG_HEADER_SIZE:  16000,

  APPSHELL_MEDIATOR_CONTRACTID: "@mozilla.org/appshell/window-mediator;1",
  APPSHSVC_CONTRACTID: "@mozilla.org/appshell/appShellService;1",
  ENIGMAIL_CONTRACTID: "@mozdev.org/enigmail/enigmail;1",
  ENIGMIMELISTENER_CONTRACTID: "@mozilla.org/enigmail/mime-listener;1",
  ENIGMIMESERVICE_CONTRACTID: "@mozdev.org/enigmail/enigmimeservice;1",
  ENIGMIMEVERIFY_CONTRACTID: "@mozilla.org/enigmail/mime-verify;1",
  IPCBUFFER_CONTRACTID: "@mozilla.org/ipc/ipc-buffer;1",
  IPCSERVICE_CONTRACTID: "@mozilla.org/process/ipc-service;1",
  IOSERVICE_CONTRACTID: "@mozilla.org/network/io-service;1",
  LOCAL_FILE_CONTRACTID: "@mozilla.org/file/local;1",
  MIME_CONTRACTID: "@mozilla.org/mime;1",
  PIPEFILTERLISTENER_CONTRACTID: "@mozilla.org/process/pipe-filter-listener;1",
  SIMPLEURI_CONTRACTID: "@mozilla.org/network/simple-uri;1",

  // variables
  enigmailSvc: null,
  enigStringBundle: null,
  statusFlags: gStatusFlags,
  prefBranch: null,
  prefRoot: null,
  prefService: null,

  getService: function (win) {
    // Lazy initialization of enigmail JS component (for efficiency)

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

  getVersion: function()
  {
    this.DEBUG_LOG("enigmailCommon.jsm: getVersion\n");

    var addonVersion = "?";
    try {
      // Gecko 1.9.x
      addonVersion = Components.classes["@mozilla.org/extensions/manager;1"].
        getService(Components.interfaces.nsIExtensionManager).
        getItemForID(ENIG_EXTENSION_GUID).version
    }
    catch (ex) {
      // Gecko 2.0
      addonVersion = gEnigExtensionVersion;
    }

    this.DEBUG_LOG("enigmailCommon.jsm: installed version: "+addonVersion+"\n");
    return addonVersion;
  },

  getPromptSvc: function() {
    return gPromptSvc;
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

  setPref: function (prefName, value)
  {
     this.DEBUG_LOG("enigmailCommon.jsm: setPref: "+prefName+", "+value+"\n");

     if (! this.prefBranch)
       this.initPrefService();

     var prefType;
     try {
       prefType = this.prefBranch.getPrefType(prefName);
     }
     catch (ex) {
       switch (typeof value) {
         case "boolean":
           prefType = this.prefBranch.PREF_BOOL;
           break;
         case "integer":
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
              { msgtext: mesg,
                checkboxLabel: checkBoxLabel,
                button1: okLabel,
                button2: labelButton2,
                button3: labelButton3
              },
              result);

    if (checkBoxLabel) {
      checkedObj.value=result.checked
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
      //nsIDOMJSWindow
      domWin.open(spec, winName, "chrome,"+winOptions, optList);
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
    if (dateNum != 0) {
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
      var localFile = Cc[this.LOCAL_FILE_CONTRACTID].createInstance(Ci.nsILocalFile);

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

    var file = filePicker.file.QueryInterface(Ci.nsILocalFile);

    return file;
  },

  getFilePath: function (nsFileObj)
  {
    if (this.getOS() == "WINNT")
      return this.convertToUnicode(nsFileObj.persistentDescriptor, "utf-8");

    return this.convertFromUnicode(nsFileObj.path, "utf-8");
  },


  getTempDir: function ()
  {
    const TEMPDIR_PROP = "TmpD";
    var tmpDir;

    try {
      var ds = Cc[DIRSERVICE_CONTRACTID].getService();
      var dsprops = ds.QueryInterface(Ci.nsIProperties);
      var tmpDirComp = dsprops.get(TEMPDIR_PROP, Ci.nsILocalFile);
      tmpDir=tmpDirComp.path;
    }
    catch (ex) {
      // let's guess ...
      if (this.getOS() == "WINNT") {
        tmpDir="C:\\TEMP";
      } else {
        tmpDir="/tmp";
      }
    }
    return tmpDir;
  },

  newRequestObserver: function (terminateFunc, terminateArg)
  {
    function requestObserver(terminateFunc, terminateArg)
    {
      this._terminateFunc = terminateFunc;
      this._terminateArg = terminateArg;
    }

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
        this._terminateFunc(this._terminateArg, ctxt);
      }
    }

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

    if (this.enigmailSvc && this.enigmailSvc.console)
      this.enigmailSvc.console.write(str);
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

    if (this.enigmailSvc && this.enigmailSvc.console)
      this.enigmailSvc.console.write(str);
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
    this.DEBUG_LOG("enigmailCommon.jsm: convertToUnicode: "+charset+"\n");

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
    this.DEBUG_LOG("enigmailCommon.jsm: convertFromUnicode: "+charset+"\n");

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

  parseErrorOutput: function (errOutput, statusFlagsObj, statusMsgObj, blockSeparationObj)
  {

    this.WRITE_LOG("enigmailCommon.jsm: parseErrorOutput:\n");
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
    statusMsgObj.value = "";

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
            this.DEBUG_LOG("enigmailCommon.jsm: detected invalid sender: "+lineSplit[2]+" / code: "+lineSplit[1]+"\n");
            statusMsgObj.value += this.getString("gnupg.invalidKey.desc", [ lineSplit[2] ]);
          }

          if (flag)
            statusFlags |= flag;

          //this.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: status match '+matches[1]+"\n");
        }

      } else {
        errArray.push(errLines[j]);
      }
    }

    // detect forged message insets

    if (! blockSeparationObj) {
      blockSeparationObj = new Object();
    }
    blockSeparationObj.value = "";

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
            blockSeparationObj.value += (withinCryptoMsg ? "1" : "0") + ":"+matches[2]+" ";
          }
        }
        else {
          // strange: we got PLAINTEXT XX, but not PLAINTEXT_LENGTH XX
          blockSeparationObj.value += (withinCryptoMsg ? "1" : "0") + ":0 ";
        }
      }
    }

    if (plaintextCount > 1) statusFlags |= (Ci.nsIEnigmail.PARTIALLY_PGP | Ci.nsIEnigmail.DECRYPTION_FAILED | Ci.nsIEnigmail.BAD_SIGNATURE);

    blockSeparationObj.value = blockSeparationObj.value.replace(/ $/, "");
    statusFlagsObj.value = statusFlags;
    if (statusMsgObj.value.length == 0) statusMsgObj.value = statusArray.join("\n");
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
  }
};


////////////////////////////////////////////////////////////////////////
// Local (not exported) functions
////////////////////////////////////////////////////////////////////////

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

function upgradeHeadersView() {
  // all headers hack removed -> make sure view is correct
  var hdrMode = null;
  try {
    var hdrMode = EnigmailCommon.getPref("show_headers");
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
    EnigmailCommon.prefRoot.setCharPref("mailnews.headers.extraExpandedHeaders", extraHdrs)
  }
  catch(ex) {}
}

function upgradePgpMime() {
  var pgpMimeMode = false;
  try {
    var pgpMimeMode = (EnigmailCommon.getPref("usePGPMimeOption") == 2);
  }
  catch (ex) {
    return;
  }

  try {
    if (pgpMimeMode) {
      var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
      for (var i=0; i < accountManager.allIdentities.Count(); i++) {
        var id = accountManager.allIdentities.QueryElementAt(i, Ci.nsIMsgIdentity);
        if (id.getBoolAttribute("enablePgp")) {
          id.setBoolAttribute("pgpMimeMode", true);
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
    else if (oldVer < "0.95") {
      try {
        upgradeHeadersView();
        upgradePgpMime();
        upgradeRecipientsSelection();
      }
      catch (ex) {}
    }
    else if (vc.compare(oldVer, "1.0") < 0) upgradeCustomHeaders();
  }
  catch(ex) {};
  EnigmailCommon.setPref("configuredVersion", EnigmailCommon.getVersion());
  EnigmailCommon.savePrefs();
}