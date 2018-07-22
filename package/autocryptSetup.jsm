/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*eslint no-loop-func: 0*/

/**
 *  Module for dealing with received Autocrypt headers, level 0
 *  See details at https://github.com/mailencrypt/autocrypt
 */

var EXPORTED_SYMBOLS = ["EnigmailAutocryptSetup"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("chrome://enigmail/content/modules/log.jsm"); /* global EnigmailLog: false*/
Cu.import("chrome://enigmail/content/modules/locale.jsm"); /* global EnigmailLocale: false*/
Cu.import("chrome://enigmail/content/modules/autocrypt.jsm"); /* global EnigmailAutocrypt: false*/
Cu.import("chrome://enigmail/content/modules/windows.jsm"); /* global EnigmailWindows: false*/
Cu.import("chrome://enigmail/content/modules/dialog.jsm"); /* global EnigmailDialog: false*/
Cu.import("chrome://enigmail/content/modules/autocrypt.jsm"); /* global EnigmailAutocrypt: false*/
Cu.import("chrome://enigmail/content/modules/keyRing.jsm"); /* global EnigmailKeyRing: false*/
Cu.import("chrome://enigmail/content/modules/mime.jsm"); /* global EnigmailMime: false*/
Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /* global XPCOMUtils: false*/
Cu.import("resource:///modules/jsmime.jsm"); /*global jsmime: false*/

// Interfaces
const nsIFolderLookupService = Ci.nsIFolderLookupService;
const nsIMsgAccountManager = Ci.nsIMsgAccountManager;
const nsIMsgAccount = Ci.nsIMsgAccount;
const nsIMsgDBHdr = Ci.nsIMsgDBHdr;
const nsIMessenger = Ci.nsIMessenger;
const nsIMsgMessageService = Ci.nsIMsgMessageService;
const nsIMsgFolder = Ci.nsIMsgFolder;

var gFolderURIs = [];

var EnigmailAutocryptSetup = {
  /**
   * Identify which type of setup the user had before Enigmail was (re-)installed
   *
   * @return Promise<Object> with:
   *   - value : For each case assigned value,
   *        1) Autocrypt Setup Message Found
   *        2) Latest Message with Autocrypt or pEp header Found
   *        3) No relevant header found
   *        4) No configured account found
   *   - acSetupMessage {nsIMsgDBHdr}  in case value === 1
   *   - msgHeaders {Object}           in case value === 2
   */
  determinePreviousInstallType: function() {
    return new Promise(async(resolve, reject) => {
      EnigmailLog.DEBUG("autocryptSetup.jsm: determinePreviousInstallType()\n");

      let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(nsIMsgAccountManager);
      let folderService = Cc["@mozilla.org/mail/folder-lookup;1"].getService(nsIFolderLookupService);
      let returnMsgValue = {
        value: 3
      };

      var accounts = msgAccountManager.accounts;

      let msgHeaders = [];
      let autocryptSetupMessage = {};

      // If no account, except Local Folders is configured
      if (accounts.length <= 1) {
        returnMsgValue.value = 4;
        resolve(returnMsgValue);
      }

      // Ierating through each account

      for (var i = 0; i < accounts.length; i++) {
        var account = accounts.queryElementAt(i, nsIMsgAccount);
        var accountMsgServer = account.incomingServer;
        gFolderURIs.push(accountMsgServer.serverURI);

        let rootFolder = folderService.getFolderForURL(gFolderURIs[i]);

        let msgObject = {};

        try {
          msgObject = getMsgFolders(rootFolder);
        }
        catch (e) {
          EnigmailLog.DEBUG("autocryptSetup.jsm: determinePreviousInstallType() Error : " + e + "\n");
        }

        // Iterating through each non empty Folder Database in the Account

        for (var k = 0; k < msgObject.length; k++) {
          let msgDatabase = msgObject[k].msgDatabase;
          let msgFolder = msgObject[k].msgFolder;

          let msgEnumerator = msgDatabase.ReverseEnumerateMessages();

          // Iterating through each message in the Folder
          while (msgEnumerator.hasMoreElements()) {
            let msgHeader = msgEnumerator.getNext().QueryInterface(nsIMsgDBHdr);
            let msgURI = msgFolder.getUriForMsg(msgHeader);

            if (msgFolder.flags == 1074274324) {
              break;
            }

            let msgAuthor = msgHeader.author.substring(msgHeader.author.lastIndexOf("<") + 1, msgHeader.author.lastIndexOf(">"));

            // Listing all the headers in the message

            let messenger = Components.classes["@mozilla.org/messenger;1"].createInstance(nsIMessenger);
            let mms = messenger.messageServiceFromURI(msgURI).QueryInterface(nsIMsgMessageService);

            let headerObj = await getStreamedHeaders(msgURI, mms);

            let checkHeaderValues = await checkHeaders(headerObj, msgHeader, msgAuthor, accountMsgServer, msgFolder, returnMsgValue, msgHeaders);


            msgHeaders = checkHeaderValues.msgHeaders;
            returnMsgValue = checkHeaderValues.returnMsgValue;

            const currDateInSeconds = new Date().getTime() / 1000;
            const diffSecond = currDateInSeconds - msgHeader.dateInSeconds;

            /**
                2592000 = No. of Seconds in a Month.
                This is to ignore 1 month old messages.
            */
            if (diffSecond > 2592000.0) {
              break;
            }
          }

        }

      }

      if (returnMsgValue.acSetupMessage) {
        resolve(returnMsgValue);
      }
      else {

        if (msgHeaders.length > 0) {
          returnMsgValue.value = 2;
          returnMsgValue.msgHeaders = msgHeaders;
        }

        returnMsgValue.userName = msgAccountManager.defaultAccount.defaultIdentity.fullName;
        returnMsgValue.userEmail = msgAccountManager.defaultAccount.defaultIdentity.email;

        resolve(returnMsgValue);
      }
    });

  },

  /**
   * Process the Autocrypt Setup Message
   *
   * @param headerValue: Object - containing header and attachment of an Autocrypt Setup Message
   *
   */

  performAutocryptSetup: function(headerValue, passwordWindow = null, confirmWindow = null) {

    EnigmailLog.DEBUG("autocryptSetup.jsm: performAutocryptSetup()\n");
    if (headerValue.attachment.contentType.search(/^application\/autocrypt-setup$/i) === 0) {
      EnigmailAutocrypt.getSetupMessageData(headerValue.attachment.url).then(res => {
        let passwd = EnigmailWindows.autocryptSetupPasswd(passwordWindow, "input", res.passphraseFormat, res.passphraseHint);

        if ((!passwd) || passwd == "") {
          throw "noPasswd";
        }

        return EnigmailAutocrypt.handleBackupMessage(passwd, res.attachmentData, headerValue.acSetupMessage.author);
      }).
      then(res => {
        EnigmailDialog.info(confirmWindow, EnigmailLocale.getString("autocrypt.importSetupKey.success", headerValue.acSetupMessage.author));
      }).
      catch(err => {
        EnigmailLog.DEBUG("autocryptSetup.jsm: performAutocryptSetup got cancel status=" + err + "\n");

        switch (err) {
          case "getSetupMessageData":
            EnigmailDialog.alert(confirmWindow, EnigmailLocale.getString("autocrypt.importSetupKey.invalidMessage"));
            break;
          case "wrongPasswd":
            if (EnigmailDialog.confirmDlg(confirmWindow, EnigmailLocale.getString("autocrypt.importSetupKey.wrongPasswd"), EnigmailLocale.getString("dlg.button.retry"),
                EnigmailLocale.getString("dlg.button.cancel"))) {
              EnigmailAutocryptSetup.performAutocryptSetup(headerValue);
            }
            break;
          case "keyImportFailed":
            EnigmailDialog.alert(confirmWindow, EnigmailLocale.getString("autocrypt.importSetupKey.invalidKey"));
            break;
        }
      });
    }
  },

  /**
   * Process the Autocrypt Setup Message
   *
   * @param headerValue:      Object - containing distinct Autocrypt headers from all the sent mails
   *
   */

  processAutocryptHeader: function(headerValue, win = null) {
    EnigmailLog.DEBUG("autocryptSetup.jsm: processAutocryptHeader()\n");

    return new Promise(async(resolve, reject) => {
      for (let i = 0; i < headerValue.msgHeaders.length; i++) {
        if (headerValue.msgHeaders[i].msgType === "Autocrypt") {
          // FIXME
          let success = await EnigmailAutocrypt.processAutocryptHeader(headerValue.msgHeaders[i].fromAddr, [headerValue.msgHeaders[i].msgData],
            headerValue.msgHeaders[i].date);
          if (success !== 0) {
            EnigmailDialog.alert(win, EnigmailLocale.getString("acStartup.acHeaderFound.failure"));
            resolve(1);
          }
        }
      }
      EnigmailDialog.alert(win, EnigmailLocale.getString("acStartup.acHeaderFound.success"));
      resolve(0);
    });
  },


  /**
   * Create a new autocrypt-complinant key
   */
  createAutocryptKey: async function(headerValue) {
    return new Promise(async(resolve, reject) => {
      EnigmailLog.DEBUG("autocryptSetup.jsm: createAutocryptKey()\n");
      let userName = headerValue.userName,
        userEmail = headerValue.userEmail,
        expiry = 1825, // 5 years
        keyLength = 4096,
        keyType = "RSA",
        passphrase = "",
        generateObserver = {
          keyId: null,
          backupLocation: null,
          _state: 0,

          onDataAvailable: function(data) {},
          onStopRequest: function(exitCode) {
            resolve(0);
          }
        };

      try {
        let keygenRequest = EnigmailKeyRing.generateKey(userName, "", userEmail, expiry, keyLength, keyType, passphrase, generateObserver);
      }
      catch (ex) {
        EnigmailLog.DEBUG("autocryptSetup.jsm: createAutocryptKey: error: " + ex.message);
        resolve(1);
      }
    });
  }
};


function createStreamListener(k) {
  return {
    _data: "",
    _stream: null,

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

    // nsIRequestObserver
    onStartRequest: function(aRequest, aContext) {},
    onStopRequest: function(aRequest, aContext, aStatusCode) {
      try {
        k(this._data);
      }
      catch (e) {
        EnigmailLog.DEBUG("autocryptSetup.jsm: createStreamListener: error: " + e + "\n");
      }
    },

    // nsIStreamListener
    onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
      if (this._stream === null) {
        this._stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
        this._stream.init(aInputStream);
      }
      this._data += this._stream.read(aCount);
    }
  };
}

/**
 * get a list of all sub-folders, starting with rootFolder.
 *
 * @param {nsIMsgFolder} rootFolder
 *
 * @return Array{Object}:
 *    - msgFolder {nsIMsgFolder}
 *    - msgDatabase {nsIMsgDatabase}
 */
function getMsgFolders(rootFolder) {

  let msgFolders = [];
  msgFolders.push(rootFolder);

  // To list all the Folder in Main Account Folder

  var j = 0;

  while (msgFolders.length > j) {

    let containFolder = msgFolders[j];

    if (containFolder.hasSubFolders) {
      let subFolders = containFolder.subFolders;
      while (subFolders.hasMoreElements()) {
        msgFolders.push(subFolders.getNext().QueryInterface(nsIMsgFolder));
      }
    }
    j++;
  }

  let msgFoldersDatabase = [];

  for (let i = 0; i < msgFolders.length; i++) {
    if (msgFolders[i].getTotalMessages(false)) {
      let msgDatabase = msgFolders[i].msgDatabase.QueryInterface(Ci.nsIMsgDatabase);
      let msgEnumerator = msgDatabase.ReverseEnumerateMessages();
      if (msgEnumerator.hasMoreElements()) {
        let msgObject = {
          'msgFolder': msgFolders[i],
          'msgDatabase': msgDatabase
        };
        msgFoldersDatabase.push(msgObject);
      }
    }
  }

  return msgFoldersDatabase;
}

// Util Function for Extracting manually added Headers
function streamListener(callback) {
  var newStreamListener = {
    mAttachments: [],
    mHeaders: [],
    mBusy: true,

    onStartRequest: function(aRequest, aContext) {
      this.mAttachments = [];
      this.mHeaders = [];
      this.mBusy = true;

      var channel = aRequest.QueryInterface(Components.interfaces.nsIChannel);
      channel.URI.QueryInterface(Components.interfaces.nsIMsgMailNewsUrl);
      channel.URI.msgHeaderSink = this; // adds this header sink interface to the channel
    },
    onStopRequest: function(aRequest, aContext, aStatusCode) {
      callback();
      this.mBusy = false; // if needed, you can poll this var to see if we are done collecting attachment details
    },
    onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {},
    onStartHeaders: function() {},
    onEndHeaders: function() {},
    processHeaders: function(aHeaderNameEnumerator, aHeaderValueEnumerator, aDontCollectAddress) {
      while (aHeaderNameEnumerator.hasMore())
        this.mHeaders.push({
          name: aHeaderNameEnumerator.getNext().toLowerCase(),
          value: aHeaderValueEnumerator.getNext()
        });
    },
    handleAttachment: function(aContentType, aUrl, aDisplayName, aUri, aIsExternalAttachment) {
      if (aContentType == "text/html") return;
      this.mAttachments.push({
        contentType: aContentType,
        url: aUrl,
        displayName: aDisplayName,
        uri: aUri,
        isExternal: aIsExternalAttachment
      });
    },
    onEndAllAttachments: function() {},
    onEndMsgDownload: function(aUrl) {},
    onEndMsgHeaders: function(aUrl) {},
    onMsgHasRemoteContent: function(aMsgHdr) {},
    getSecurityInfo: function() {},
    setSecurityInfo: function(aSecurityInfo) {},
    getDummyMsgHeader: function() {},

    QueryInterface: function(aIID) {
      if (aIID.equals(Components.interfaces.nsIStreamListener) ||
        aIID.equals(Components.interfaces.nsIMsgHeaderSink) ||
        aIID.equals(Components.interfaces.nsISupports))
        return this;

      throw Components.results.NS_NOINTERFACE;
    }
  };

  return newStreamListener;
}

function getStreamedMessage(msgFolder, msgHeader) {
  return new Promise((resolve, reject) => {
    let msgURI = msgFolder.getUriForMsg(msgHeader);
    var listener = streamListener(() => {
      resolve(listener.mAttachments[0]);
    });
    let messenger = Components.classes["@mozilla.org/messenger;1"].createInstance(nsIMessenger);
    let mms = messenger.messageServiceFromURI(msgURI).QueryInterface(nsIMsgMessageService);
    mms.streamMessage(msgURI, listener, null, null, true, "filter");
  });
}

function checkHeaders(headerObj, msgHeader, msgAuthor, accountMsgServer, msgFolder, returnMsgValue, msgHeaders) {
  return new Promise(async(resolve, reject) => {
    if (headerObj['autocrypt-setup-message'] && msgHeader.author == msgHeader.recipients) {

      // To extract Attachement for Autocrypt Setup Message

      returnMsgValue.attachment = await getStreamedMessage(msgFolder, msgHeader);

      if (!returnMsgValue.acSetupMessage) {
        returnMsgValue.value = 1;
        returnMsgValue.acSetupMessage = msgHeader;
      }
      else if (returnMsgValue.acSetupMessage.date < msgHeader.date) {
        returnMsgValue.acSetupMessage = msgHeader;
      }

    }
    else if (msgAuthor == accountMsgServer.username &&
      (("autocrypt" in headerObj) ||
        ("x-pep-version" in headerObj))) {

      let msgType = ("x-pep-version" in headerObj) ? "pEp" : "Autocrypt";

      let fromHeaderExist = null;
      for (let j = 0; j < msgHeaders.length; j++) {
        if (msgHeaders[j].fromAddr == msgAuthor) {
          fromHeaderExist = msgHeaders[j];
          break;
        }
      }
      if (fromHeaderExist === null) {
        let dateTime = new Date(0);
        try {
          dateTime = jsmime.headerparser.parseDateHeader(headerObj.date);
        }
        catch (x) {}

        let addHeader = {
          fromAddr: msgAuthor,
          msgType: msgType,
          msgData: headerObj.autocrypt,
          date: headerObj.date,
          dateTime: dateTime
        };
        msgHeaders.push(addHeader);
      }
      else {
        let dateTime = new Date(0);
        try {
          dateTime = jsmime.headerparser.parseDateHeader(headerObj.date);
        }
        catch (x) {}
        if (dateTime > fromHeaderExist.dateTime) {
          fromHeaderExist.msgData = headerObj.autocrypt;
          fromHeaderExist.date = headerObj.date;
          fromHeaderExist.msgType = msgType;
          fromHeaderExist.dateTime = dateTime;
        }
      }
    }

    resolve({
      'returnMsgValue': returnMsgValue,
      'msgHeaders': msgHeaders
    });
  });
}

function getStreamedHeaders(msgURI, mms) {

  return new Promise((resolve, reject) => {
    let headers = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    let headerObj = {};
    try {
      mms.streamHeaders(msgURI, createStreamListener(aRawString => {
        try {
          headers.initialize(aRawString);

          let i = headers.headerNames;
          while (i.hasMore()) {
            let hdrName = i.getNext().toLowerCase();

            let hdrValue = headers.extractHeader(hdrName, true);
            headerObj[hdrName] = hdrValue;
          }

          if ("autocrypt" in headerObj) {
            let acHeader = headers.extractHeader("autocrypt", false);
            acHeader = acHeader.replace(/keydata=/i, 'keydata="') + '"';

            let paramArr = EnigmailMime.getAllParameters(acHeader);
            paramArr.keydata = paramArr.keydata.replace(/[\r\n\t ]/g, "");

            headerObj.autocrypt = "";
            for (i in paramArr) {
              if (headerObj.autocrypt.length > 0) headerObj.autocrypt += "; ";
              headerObj.autocrypt += `${i}="${paramArr[i]}"`;
            }
          }
        }
        catch (e) {
          reject({});
          EnigmailLog.DEBUG("autocryptSetup.jsm: getStreamedHeaders: Error: " + e + "\n");
        }
        resolve(headerObj);
      }), null, false);
    }
    catch (e) {
      reject({});
      EnigmailLog.DEBUG("autocryptSetup.jsm: getStreamedHeaders: Error: " + e + "\n");
    }
  });
}
