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
 * Copyright (C) 2011 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 * Marius Stübs <marius.stuebs@riseup.net>
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
 * Common Enigmail crypto-related GUI functionality
 *
 * Import into a JS component using
 * 'Components.utils.import("resource://enigmail/commonFuncs.jsm");'
 */

Components.utils.import("resource://enigmail/enigmailCommon.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailFuncs" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_TRUST_ID=1;
const KEY_ID = 4;
const CREATED_ID = 5;
const EXPIRY_ID = 6;
const UID_ID = 7;
const OWNERTRUST_ID = 8;
const USERID_ID = 9;
const SIG_TYPE_ID = 10;
const KEY_USE_FOR_ID = 11;

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

// trust flags according to GPG documentation:
// - http://www.gnupg.org/documentation/manuals/gnupg.pdf
// - sources: doc/DETAILS
// In the order of trustworthy:
//  i = The key is invalid (e.g. due to a missing self-signature)
//  n = The key is not valid / Never trust this key
//  d/D = The key has been disabled
//  r = The key has been revoked
//  e = The key has expired
//  g = group (???)
//  o = Unknown (this key is new to the system)
//  - = Unknown validity (i.e. no value assigned)
//  q = Undefined validity (Not enough information for calculation)
//      '-' and 'q' may safely be treated as the same value for most purposes
//  m = Marginally trusted
//  f = Fully trusted
//  u = Ultimately trusted
const TRUSTLEVEL_SORTED = "indDrego-qmfu";  // see also enigmailMsgComposeHelper.js, enigmailUserSelection.js


var gTxtConverter = null;

var EnigmailFuncs = {

  /**
   * Display the dialog to search and/or download key(s) from a keyserver
   *
   * @win        - |object| holding the parent window for the dialog
   * @inputObj   - |object| with member searchList (|string| containing the keys to search)
   * @resultObj  - |object| with member importedKeys (|number| containing the number of imporeted keys)
   *
   * no return value
   */

  downloadKeys: function (win, inputObj, resultObj)
  {
    EnigmailCommon.DEBUG_LOG("commonFuncs.jsm: downloadKeys: searchList="+inputObj.searchList+"\n");

    resultObj.importedKeys=0;

    var ioService = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
    if (ioService && ioService.offline) {
      EnigmailCommon.alert(win, EnigmailCommon.getString("needOnline"));
      return;
    }

    var valueObj = {};
    if (inputObj.searchList) {
      valueObj = { keyId: "<"+inputObj.searchList.join("> <")+">" };
    }

    var keysrvObj = new Object();

    win.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
          "", "dialog,modal,centerscreen", valueObj, keysrvObj);
    if (! keysrvObj.value) {
      return;
    }

    inputObj.keyserver = keysrvObj.value;
    if (! inputObj.searchList) {
      inputObj.searchList = keysrvObj.email.split(/[,; ]+/);
    }

    win.openDialog("chrome://enigmail/content/enigmailSearchKey.xul",
          "", "dialog,modal,centerscreen", inputObj, resultObj);
  },

  /**
   * Format a key fingerprint
   * @fingerprint |string|  -  unformated OpenPGP fingerprint
   *
   * @return |string| - formatted string
   */
  formatFpr: function (fingerprint)
  {
    // format key fingerprint
    var r="";
    var fpr = fingerprint.match(/(....)(....)(....)(....)(....)(....)(....)(....)(....)?(....)?/);
    if (fpr && fpr.length > 2) {
      fpr.shift();
      r=fpr.join(" ");
    }

    return r;
  },

  /**
   * get a list of plain email addresses without name or surrounding <>
   * @mailAddrs |string| - address-list as specified in RFC 2822, 3.4
   *                       separated by ","
   *
   * @return |string|    - list of pure email addresses separated by ","
   */
  stripEmail: function (mailAddrs)
  {

    var qStart, qEnd;
    while ((qStart = mailAddrs.indexOf('"')) != -1) {
       qEnd = mailAddrs.indexOf('"', qStart+1);
       if (qEnd == -1) {
         EnigmailCommon.ERROR_LOG("commonFuncs.jsm: stripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
         throw Components.results.NS_ERROR_FAILURE;
       }

       mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
    }

    // Eliminate all whitespace, just to be safe
    mailAddrs = mailAddrs.replace(/\s+/g,"");

    // Extract pure e-mail address list (stripping out angle brackets)
    mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

    return mailAddrs;
  },

  /**
   * Hide all menu entries and other XUL elements that are considered for
   * advanced users. The XUL items must contain 'advanced="true"' or
   * 'advanced="reverse"'.
   *
   * @obj:       |object| - XUL tree element
   * @attribute: |string| - attribute to set or remove (i.e. "hidden" or "collapsed")
   * @dummy:     |object| - anything
   *
   * no return value
   */


  collapseAdvanced: function (obj, attribute, dummy)
  {
    EnigmailCommon.DEBUG_LOG("commonFuncs.jsm: collapseAdvanced:\n");

    var advancedUser = EnigmailCommon.getPref("advancedUser");

    obj = obj.firstChild;
    while (obj) {
      if (obj.getAttribute("advanced") == "true") {
        if (advancedUser) {
          obj.removeAttribute(attribute);
        }
        else {
          obj.setAttribute(attribute, "true");
        }
      }
      else if (obj.getAttribute("advanced") == "reverse") {
        if (advancedUser) {
          obj.setAttribute(attribute, "true");
        }
        else {
          obj.removeAttribute(attribute);
        }
      }

      obj = obj.nextSibling;
    }
  },

  /**
   * Display the OpenPGP setup wizard window
   *
   * no return value
   */

  openSetupWizard: function (win)
  {
     win.open("chrome://enigmail/content/enigmailSetupWizard.xul",
                "", "chrome,centerscreen");
  },

  /**
   * Display the key help window
   *
   * @source - |string| containing the name of the file to display
   *
   * no return value
   */

  openHelpWindow: function (source)
  {
    EnigmailCommon.openWin("enigmail:help",
                           "chrome://enigmail/content/enigmailHelp.xul?src="+source,
                           "centerscreen,resizable");
  },

  /**
   * Display the "About Enigmail" window
   *
   * no return value
   */

  openAboutWindow: function ()
  {
    EnigmailCommon.openWin("about:enigmail",
                           "chrome://enigmail/content/enigmailAbout.xul",
                           "resizable,centerscreen");
  },

  /**
   * Display the Per-Recipient Rules editor window
   *
   * no return value
   */

  openRulesEditor: function ()
  {
    EnigmailCommon.openWin("enigmail:rulesEditor",
                           "chrome://enigmail/content/enigmailRulesEditor.xul",
                           "dialog,centerscreen,resizable");
  },


  /**
   * Display the OpenPGP key manager window
   *
   * no return value
   */

  openKeyManager: function (win)
  {
    EnigmailCommon.getService(win);

    EnigmailCommon.openWin("enigmail:KeyManager",
                           "chrome://enigmail/content/enigmailKeyManager.xul",
                           "resizable");
  },

  /**
   * Display the key creation window
   *
   * no return value
   */

  openKeyGen: function ()
  {
    EnigmailCommon.openWin("enigmail:generateKey",
                           "chrome://enigmail/content/enigmailKeygen.xul",
                           "chrome,modal,resizable=yes");
  },

  /**
   * Display the card details window
   *
   * no return value
   */

  openCardDetails: function ()
  {
    EnigmailCommon.openWin("enigmail:cardDetails",
                           "chrome://enigmail/content/enigmailCardDetails.xul",
                           "centerscreen");
  },

  /**
   * Display the console log window
   *
   * @win       - |object| holding the parent window for the dialog
   *
   * no return value
   */
  openConsoleWindow: function ()
  {
     EnigmailCommon.openWin("enigmail:console",
                            "chrome://enigmail/content/enigmailConsole.xul",
                            "resizable,centerscreen");
  },

  /**
   * Display the window for the debug log file
   *
   * @win       - |object| holding the parent window for the dialog
   *
   * no return value
   */
  openDebugLog: function(win)
  {
    var logDirectory = EnigmailCommon.getPref("logDirectory");

    if (!logDirectory) {
      EnigmailCommon.alert(win, EnigmailCommon.getString("noLogDir"));
      return;
    }

    var svc = EnigmailCommon.enigmailSvc;
    if (! svc) {
      EnigmailCommon.alert(win, EnigmailCommon.getString("noLogFile"));
      return;
    }

    if (! svc.logFileStream) {
      EnigmailCommon.alert(win, EnigmailCommon.getString("restartForLog"));
      return;
    }

    svc.logFileStream.flush();

    logDirectory = logDirectory.replace(/\\/g, "/");

    var logFileURL = "file:///" + logDirectory + "/enigdbug.txt";
    var opts="fileUrl=" + escape(logFileURL) + "&title=" +
          escape(EnigmailCommon.getString("debugLog.title"));

    EnigmailCommon.openWin("enigmail:logFile",
                           "chrome://enigmail/content/enigmailViewFile.xul?"+opts,
                           "resizable,centerscreen");
  },

  /**
   * Display the preferences dialog
   *
   * @win       - |object| holding the parent window for the dialog
   * @showBasic - |boolean| true if only the 1st page of the preferences window
   *              should be displayed / false otherwise
   * @selectTab - |string| ID of the tab element (in XUL) to display when opening
   *
   * no return value
   */
  openPrefWindow: function (win, showBasic, selectTab)
  {
    EnigmailCommon.DEBUG_LOG("enigmailCommon.js: prefWindow\n");

    EnigmailCommon.getService(win);

    win.openDialog("chrome://enigmail/content/pref-enigmail.xul",
                   "_blank", "chrome,resizable=yes",
                   {'showBasic': showBasic,
                   'clientType': 'thunderbird',
                   'selectTab': selectTab});
  },

  /**
   * Display the dialog for creating a new per-recipient rule
   *
   * @win          - |object| holding the parent window for the dialog
   * @emailAddress - |string| containing the email address for the rule
   *
   * @return       - always true
   */

  createNewRule: function (win, emailAddress)
  {
    // make sure the rules database is loaded
    var enigmailSvc = EnigmailCommon.getService(win);
    if (!enigmailSvc) return false;

    var rulesListObj= new Object;

    // open rule dialog
    enigmailSvc.getRulesData(rulesListObj);
    var inputObj=new Object;
    var resultObj=new Object;
    inputObj.toAddress="{"+emailAddress+"}";
    inputObj.options="";
    inputObj.command = "add";
    win.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","",
                   "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    return true;
  },

  /**
   * Display the dialog for changing the expiry date of one or several keys
   *
   * @win        - |object| holding the parent window for the dialog
   * @userIdArr  - |array| of |strings| containing the User IDs
   * @keyIdArr   - |array| of |strings| containing the key IDs (eg. "0x12345678") to change
   * no return value
   */

  editKeyExpiry: function (win, userIdArr, keyIdArr)
  {
    var inputObj = {
      keyId: keyIdArr,
      userId: userIdArr
    };
    var resultObj = { refresh: false };
    win.openDialog("chrome://enigmail/content/enigmailEditKeyExpiryDlg.xul","",
                   "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    return resultObj.refresh;
  },

  /**
   * Display the dialog for changing key trust of one or several keys
   *
   * @win        - |object| holding the parent window for the dialog
   * @userIdArr  - |array| of |strings| containing the User IDs
   * @keyIdArr   - |array| of |strings| containing the key IDs (eg. "0x12345678") to change
   * no return value
   */

  editKeyTrust: function (win, userIdArr, keyIdArr)
  {
    var inputObj = {
      keyId: keyIdArr,
      userId: userIdArr
    };
    var resultObj = { refresh: false };
    win.openDialog("chrome://enigmail/content/enigmailEditKeyTrustDlg.xul","",
                   "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    return resultObj.refresh;
  },

  /**
   * Display the dialog for signing a key
   *
   * @win        - |object| holding the parent window for the dialog
   * @userId     - |string| containing the User ID (for displaing in the dialog only)
   * @keyId      - |string| containing the key ID (eg. "0x12345678")
   * no return value
   */

  signKey: function (win, userId, keyId)
  {
    var inputObj = {
      keyId: keyId,
      userId: userId
    };
    var resultObj = { refresh: false };
    win.openDialog("chrome://enigmail/content/enigmailSignKeyDlg.xul","",
                   "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    return resultObj.refresh;
  },

  /**
   * Display the photo ID associated with a key
   *
   * @win        - |object| holding the parent window for the dialog
   * @keyId      - |string| containing the key ID (eg. "0x12345678")
   * @userId     - |string| containing the User ID (for displaing in the dialog only)
   * @photoNumber - |number| UAT entry in the squence of appearance in the key listing, starting with 0
   * no return value
   */

  showPhoto: function (win, keyId, userId, photoNumber)
  {
    var enigmailSvc = EnigmailCommon.getService(win);
    if (enigmailSvc) {

      if (photoNumber==null) photoNumber=0;

      var exitCodeObj = new Object();
      var errorMsgObj = new Object();
      var photoPath = enigmailSvc.showKeyPhoto("0x"+keyId, photoNumber, exitCodeObj, errorMsgObj);

      if (photoPath && exitCodeObj.value==0) {

        var photoFile = Cc[EnigmailCommon.LOCAL_FILE_CONTRACTID].
          createInstance(Ci.nsIFile);
        photoFile.initWithPath(photoPath);
        if (! (photoFile.isFile() && photoFile.isReadable())) {
          EnigmailCommon.alert(win, EnigmailCommon.getString("error.photoPathNotReadable", photoPath));
        }
        else {
          var ioServ = Cc[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
          var photoUri = ioServ.newFileURI(photoFile).spec;
          var argsObj = {
            photoUri: photoUri,
            userId: userId,
            keyId: keyId
          };

          win.openDialog("chrome://enigmail/content/enigmailDispPhoto.xul",
                         photoUri,
                         "chrome,modal,resizable,dialog,centerscreen",
                         argsObj);
          try {
            // delete the photo file
            photoFile.remove(false);
          }
          catch (ex) {}
       }
      }
      else {
        EnigmailCommon.alert(win, EnigmailCommon.getString("noPhotoAvailable"));
      }
    }
  },

  /**
   * Display the OpenPGP Key Details window
   *
   * @win        - |object| holding the parent window for the dialog
   * @keyId      - |string| containing the key ID (eg. "0x12345678")
   * @refresh    - |boolean| if true, cache is cleared and the key data is loaded from GnuPG
   *
   * no return value
   */

  openKeyDetails: function (win, keyId, refresh)
  {
    var keyListObj = {};

    this.loadKeyList(win, refresh, keyListObj);

    var inputObj = {
      keyId:  keyId,
      keyListArr: keyListObj.keyList,
      secKey: keyListObj.keyList[ keyId ].secretAvailable
    };
    var resultObj = { refresh: false };
    win.openDialog("chrome://enigmail/content/enigmailKeyDetailsDlg.xul", "",
                   "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    if (resultObj.refresh) {
      enigmailRefreshKeys();
    }
  },

  /**
   * Load the key list into memory and return it sorted by a specified column
   *
   * @win        - |object|  holding the parent window for displaying error messages
   * @refresh    - |boolean| if true, cache is cleared and all keys are loaded from GnuPG
   * @keyListObj - |object|  holding the resulting key list
   * @sortColumn - |string|  containing the column name for sorting. One of:
   *                         userid, keyid, keyidshort, fpr, keytype, validity, trust, expiry
   * @sortDirection - |number| 1 = ascending / -1 = descending
   *
   * no return value
   */
  loadKeyList: function (win, refresh, keyListObj, sortColumn, sortDirection)
  {
    EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: loadKeyList\n");

    if (! sortColumn) sortColumn = "userid";
    if (! sortDirection) sortDirection = 1;

    var sortByKeyId = function (a, b) {
      return (a.keyId < b.keyId) ? -sortDirection : sortDirection;
    };

    var sortByKeyIdShort = function (a, b) {
      return (a.keyId.substr(-8,8) < b.keyId.substr(-8 ,8)) ? -sortDirection : sortDirection;
    };

    var sortByUserId = function (a, b) {
      return (a.userId < b.userId) ? -sortDirection : sortDirection;
    };

    var sortByFpr = function (a, b) {
      return (keyListObj.keyList[a.keyId].fpr < keyListObj.keyList[b.keyId].fpr) ? -sortDirection : sortDirection;
    };

    var sortByKeyType = function (a, b) {
      return (keyListObj.keyList[a.keyId].secretAvailable < keyListObj.keyList[b.keyId].secretAvailable) ? -sortDirection : sortDirection;
    };


    var sortByValidity = function (a, b) {
      return (TRUSTLEVEL_SORTED.indexOf(EnigmailFuncs.getTrustCode(keyListObj.keyList[a.keyId])) < TRUSTLEVEL_SORTED.indexOf(EnigmailFuncs.getTrustCode(keyListObj.keyList[b.keyId]))) ? -sortDirection : sortDirection;
    };

    var sortByTrust = function (a, b) {
      return (TRUSTLEVEL_SORTED.indexOf(keyListObj.keyList[a.keyId].ownerTrust) < TRUSTLEVEL_SORTED.indexOf(keyListObj.keyList[b.keyId].ownerTrust)) ? -sortDirection : sortDirection;
    };

    var sortByExpiry = function (a, b) {
      return (keyListObj.keyList[a.keyId].expiryTime < keyListObj.keyList[b.keyId].expiryTime) ? -sortDirection : sortDirection;
    };

    var aGpgUserList = this.obtainKeyList(win, false, refresh);
    if (!aGpgUserList) return;

    var aGpgSecretsList = this.obtainKeyList(win, true, refresh);
    if (!aGpgSecretsList && !refresh) {
      if (EnigmailCommon.confirmDlg(EnigmailCommon.getString("noSecretKeys"),
            EnigmailCommon.getString("keyMan.button.generateKey"),
            EnigmailCommon.getString("keyMan.button.skip"))) {
        this.openKeyGen();
        this.loadKeyList(true, keyListObj);
      }
    }

    keyListObj.keyList = new Array();
    keyListObj.keySortList = new Array();

    var keyObj = new Object();
    var i;
    var uatNum=0; // counter for photos (counts per key)

    for (i=0; i<aGpgUserList.length; i++) {
      var listRow=aGpgUserList[i].split(/:/);
      if (listRow.length>=0) {
        switch (listRow[0]) {
        case "pub":
          keyObj = new Object();
          uatNum = 0;
          keyObj.expiry=EnigmailCommon.getDateTime(listRow[EXPIRY_ID], true, false);
          keyObj.expiryTime = Number(listRow[EXPIRY_ID]);
          keyObj.created=EnigmailCommon.getDateTime(listRow[CREATED_ID], true, false);
          keyObj.keyId=listRow[KEY_ID];
          keyObj.keyTrust=listRow[KEY_TRUST_ID];
          keyObj.keyUseFor=listRow[KEY_USE_FOR_ID];
          keyObj.ownerTrust=listRow[OWNERTRUST_ID];
          keyObj.SubUserIds=new Array();
          keyObj.fpr="";
          keyObj.photoAvailable=false;
          keyObj.secretAvailable=false;
          keyListObj.keyList[listRow[KEY_ID]] = keyObj;
          break;
        case "fpr":
          // only take first fpr line, this is the fingerprint of the primary key and what we want
          if (keyObj.fpr=="") {
            keyObj.fpr=listRow[USERID_ID];
          }
          break;
        case "uid":
          if (listRow[USERID_ID].length == 0) {
            listRow[USERID_ID] = "-";
          }
          if (typeof(keyObj.userId) != "string") {
            keyObj.userId=EnigmailCommon.convertGpgToUnicode(listRow[USERID_ID]);
            keyListObj.keySortList.push({
              userId: keyObj.userId.toLowerCase(),
              keyId: keyObj.keyId
            });
            if (TRUSTLEVEL_SORTED.indexOf(listRow[KEY_TRUST_ID]) < TRUSTLEVEL_SORTED.indexOf(keyObj.keyTrust)) {
              // reduce key trust if primary UID is less trusted than public key
              keyObj.keyTrust = listRow[KEY_TRUST_ID];
            }
          }
          else {
            var subUserId = {
              userId: EnigmailCommon.convertGpgToUnicode(listRow[USERID_ID]),
              keyTrust: listRow[KEY_TRUST_ID],
              type: "uid"
            };
            keyObj.SubUserIds.push(subUserId);
          }
          break;
        case "uat":
          if (listRow[USERID_ID].indexOf("1 ")==0) {
            var userId=EnigmailCommon.getString("userAtt.photo");
            keyObj.SubUserIds.push({userId: userId,
                                    keyTrust:listRow[KEY_TRUST_ID],
                                    type: "uat",
                                    uatNum: uatNum});
            keyObj.photoAvailable=true;
            ++uatNum;
          }
        }
      }
    }

    // search and mark keys that have secret keys
    for (i=0; i<aGpgSecretsList.length; i++) {
       listRow=aGpgSecretsList[i].split(/:/);
       if (listRow.length>=0) {
         if (listRow[0] == "sec") {
           if (typeof(keyListObj.keyList[listRow[KEY_ID]]) == "object") {
             keyListObj.keyList[listRow[KEY_ID]].secretAvailable=true;
           }
         }
       }
    }

    switch (sortColumn.toLowerCase()) {
    case "keyid":
      keyListObj.keySortList.sort(sortByKeyId);
      break;
    case "keyidshort":
      keyListObj.keySortList.sort(sortByKeyIdShort);
      break;
    case "fpr":
      keyListObj.keySortList.sort(sortByFpr);
      break;
    case "keytype":
      keyListObj.keySortList.sort(sortByKeyType);
      break;
    case "validity":
      keyListObj.keySortList.sort(sortByValidity);
      break;
    case "trust":
      keyListObj.keySortList.sort(sortByTrust);
      break;
    case "expiry":
      keyListObj.keySortList.sort(sortByExpiry);
      break;
    default:
      keyListObj.keySortList.sort(sortByUserId);
    }
  },

  /**
   * return a merged value of trust level "key disabled"
   *
   * @keyObj - |object| containing the key data
   *
   * @return - |string| containing the trust value or "D" for disabled keys
   */

  getTrustCode: function (keyObj)
  {
    if (keyObj.keyUseFor.indexOf("D")>=0)
      return "D";
    else
      return keyObj.keyTrust;
  },


  /**
   * Get key list from GnuPG. If the keys may be pre-cached already
   *
   * @win        - |object| parent window for displaying error messages
   * @secretOnly - |boolean| true: get secret keys / false: get public keys
   * @refresh    - |boolean| if true, cache is cleared and all keys are loaded from GnuPG
   *
   * @return - |array| of : separated key list entries as specified in GnuPG doc/DETAILS
   */
  obtainKeyList: function (win, secretOnly, refresh)
  {
    EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: obtainKeyList\n");

    var userList = null;
    try {
      var exitCodeObj = new Object();
      var statusFlagsObj = new Object();
      var errorMsgObj = new Object();

      var enigmailSvc = EnigmailCommon.getService(win);
      if (! enigmailSvc) return null;

      userList = enigmailSvc.getUserIdList(secretOnly,
                                           refresh,
                                           exitCodeObj,
                                           statusFlagsObj,
                                           errorMsgObj);
      if (exitCodeObj.value != 0) {
        EnigmailCommon.alert(win, errorMsgObj.value);
        return null;
      }
    } catch (ex) {
      EnigmailCommon.ERROR_LOG("ERROR in enigmailFuncs: obtainKeyList"+ex.toString()+"\n");
    }

    if (typeof(userList) == "string") {
      return userList.split(/\n/);
    }
    else {
      return [];
    }
  },

  /**
   * determine default values for signing and encryption. Translates "old-style"
   * defaults (pre-Enigmail v1.0) to "current" defaults
   *
   * @identiy - nsIMsgIdentity object
   *
   * no return values
   */
  getSignMsg: function (identity)
  {
    EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: getSignMsg: identity.key="+identity.key+"\n");
    var sign = null;

    EnigmailCommon.getPref("configuredVersion"); // dummy call to getPref to ensure initialization

    var prefRoot = EnigmailCommon.prefRoot;

    if (prefRoot.getPrefType("mail.identity."+identity.key+".pgpSignPlain")==0) {
      if (prefRoot.getPrefType("mail.identity."+identity.key+".pgpSignMsg")==0) {
        sign=identity.getBoolAttribute("pgpAlwaysSign");
        identity.setBoolAttribute("pgpSignEncrypted", sign);
        identity.setBoolAttribute("pgpSignPlain", sign);
      }
      else {
        sign = identity.getIntAttribute("pgpSignMsg");
        identity.setBoolAttribute("pgpSignEncrypted", sign==1);
        identity.setBoolAttribute("pgpSignPlain", sign>0);
      }
      prefRoot.deleteBranch("mail.identity."+identity.key+".pgpSignMsg");
      prefRoot.deleteBranch("mail.identity."+identity.key+".pgpAlwaysSign");
    }
  },


  /**
   * this function tries to mimic the Thunderbird plaintext viewer
   *
   * @plainTxt - |string| containing the plain text data
   *
   * @ return HTML markup to display mssage
   */

  formatPlaintextMsg: function (plainTxt)
  {
    if (! gTxtConverter)
      gTxtConverter = Cc["@mozilla.org/txttohtmlconv;1"].createInstance(Ci.mozITXTToHTMLConv);

    if (! EnigmailCommon.prefRoot)
      EnigmailCommon.getPref("configuredVersion");

    var prefRoot = EnigmailCommon.prefRoot;
    var fontStyle = "";

    // set the style stuff according to perferences

    switch (prefRoot.getIntPref("mail.quoted_style")) {
      case 1:
        fontStyle="font-weight: bold; "; break;
      case 2:
        fontStyle="font-style: italic; "; break;
      case 3:
        fontStyle="font-weight: bold; font-style: italic; "; break;
    }

    switch (prefRoot.getIntPref("mail.quoted_size")) {
    case 1:
      fontStyle += "font-size: large; "; break;
    case 2:
      fontStyle += "font-size: small; "; break;
    }

    fontStyle += "color: "+prefRoot.getCharPref("mail.citation_color")+";";

    var convFlags = Ci.mozITXTToHTMLConv.kURLs;
    if (prefRoot.getBoolPref("mail.display_glyph"))
        convFlags |= Ci.mozITXTToHTMLConv.kGlyphSubstitution;
    if (prefRoot.getBoolPref("mail.display_struct"))
        convFlags |= Ci.mozITXTToHTMLConv.kStructPhrase;

    // start processing the message

    plainTxt = plainTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = plainTxt.split(/\n/);
    var oldCiteLevel = 0;
    var citeLevel = 0;
    var preface = "";
    var logLineStart = { value: 0 };
    var isSignature = false;

    for (var i=0; i < lines.length; i++) {
      preface = "";
      oldCiteLevel = citeLevel;
      if (lines[i].search(/^[\> \t]*\>$/) == 0)
        lines[i]+=" ";

      citeLevel = gTxtConverter.citeLevelTXT(lines[i], logLineStart);

      if (citeLevel > oldCiteLevel) {

        preface='</pre>';
        for (let j=0; j < citeLevel - oldCiteLevel; j++) {
          preface += '<blockquote type="cite" style="'+fontStyle+'">';
        }
        preface += '<pre wrap="">\n';
      }
      else if (citeLevel < oldCiteLevel) {
        preface='</pre>';
        for (let j = 0; j < oldCiteLevel - citeLevel; j++)
          preface += "</blockquote>";

        preface += '<pre wrap="">\n';
      }

      if (logLineStart.value > 0) {
        preface += '<span class="moz-txt-citetags">' +
            gTxtConverter.scanTXT(lines[i].substr(0, logLineStart.value), convFlags) +
            '</span>';
      }
      else if (lines[i] == "-- ") {
        preface+='<div class=\"moz-txt-sig\">';
        isSignature = true;
      }
      lines[i] = preface + gTxtConverter.scanTXT(lines[i].substr(logLineStart.value), convFlags);

    }

    var r='<pre wrap="">' + lines.join("\n") + (isSignature ? '</div>': '') + '</pre>';
    //EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: r='"+r+"'\n");
    return r;
  },


  /**
   * extract the data fields following a header.
   * e.g. ContentType: xyz; Aa=b; cc=d
   * @data: |string| containing a single header
   *
   * @return |array| of |arrays| containing pairs of aa/b and cc/d
   */
  getHeaderData: function (data) {
    EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: getHeaderData: "+data.substr(0, 100)+"\n");
    var a = data.split(/\n/);
    var res = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i].length == 0) break;
      let b = a[i].split(/;/);

      // extract "abc = xyz" tuples
      for (let j=0; j < b.length; j++) {
        let m = b[j].match(/^(\s*)([^=\s;]+)(\s*)(=)(\s*)(.*)(\s*)$/);
        if (m) {
          // m[2]: identifier / m[6]: data
          res[m[2].toLowerCase()] = m[6].replace(/\s*$/, "");
          EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: getHeaderData: "+m[2].toLowerCase()+" = "+res[m[2].toLowerCase()] +"\n");
        }
      }
      if (i == 0 && a[i].indexOf(";") < 0) break;
      if (i > 0 && a[i].search(/^\s/) < 0) break;
    }
    return res;
  },

  /**
   *  Write data to a file
   *  @filePath |string| or |nsIFile| object - the file to be created
   *  @data     |string|       - the data to write to the file
   *  @permissions  |number|   - file permissions according to Unix spec (0600 by default)
   *
   *  @return true if data was written successfully, false otherwise
   */

  writeFileContents: function(filePath, data, permissions) {

    // EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: WriteFileContents: file="+filePath.toString()+"\n");

    try {
      var fileOutStream = this.createFileStream(filePath, permissions);

      if (data.length) {
        if (fileOutStream.write(data, data.length) != data.length)
          throw Components.results.NS_ERROR_FAILURE;

        fileOutStream.flush();
      }
      fileOutStream.close();

    } catch (ex) {
      EnigmailCommon.ERROR_LOG("enigmailFuncs.jsm: writeFileContents: Failed to write to "+filePath+"\n");
      return false;
    }

    return true;
  },

  /**
   *  Create an nsIFileOutputStream object associated with a file to
   *  allow for writing data via the stream to the file
   *  @filePath |string| or |nsIFile| object - the file to be written
   *  @permissions  |number|                 - file permissions according to Unix spec (0600 by default)
   *
   *  @return nsIFileOutputStream object or null if creation failed
   */

  createFileStream: function(filePath, permissions) {
    //EnigmailCommon.DEBUG_LOG("enigmailFuncs.jsm: createFileStream: file="+filePath+"\n");

    try {
      var localFile;
      if (typeof filePath == "string") {
        localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
        initPath(localFile, filePath);
      }
      else {
        localFile = filePath.QueryInterface(Ci.nsIFile);
      }

      if (localFile.exists()) {

        if (localFile.isDirectory() || !localFile.isWritable())
           throw Components.results.NS_ERROR_FAILURE;

        if (!permissions)
          permissions = localFile.permissions;
      }

      if (!permissions)
        permissions = DEFAULT_FILE_PERMS;

      var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

      var fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);

      fileStream.init(localFile, flags, permissions, 0);

      return fileStream;

    } catch (ex) {
      EnigmailCommon.ERROR_LOG("enigmailFuncs.jsm: CreateFileStream: Failed to create "+filePath+"\n");
      return null;
    }
  }

};


function initPath(localFileObj, pathStr) {
  localFileObj.initWithPath(pathStr);

  if (! localFileObj.exists()) {
    localFileObj.persistentDescriptor = pathStr;
  }
}




