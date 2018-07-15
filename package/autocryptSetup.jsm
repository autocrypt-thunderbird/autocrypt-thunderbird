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
Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /* global XPCOMUtils: false*/

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
   * Identify the case at the time of installation, 1) Autocrypt Setup Message Found 2) Sent Message with Autocrypt header Found 3)None of the above
   *
   *
   *
   * @return Object with Headers(Optional), value : For each case assigned value,
   */
  getMsgHeader: function() {
    return new Promise(async(resolve, reject) => {
      EnigmailLog.DEBUG("autocryptSetup.jsm: getMsgHeader()\n");

      let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(nsIMsgAccountManager);
      let folderService = Cc["@mozilla.org/mail/folder-lookup;1"].getService(nsIFolderLookupService);
      let returnMsgValue = {
        value: 3
      };

      var accounts = msgAccountManager.accounts;

      let autocryptHeaders = [];
      let autocryptSetupMessage = {};

      // If no account is configured
      if (accounts.length == 0 || accounts.length == 1) {
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
          EnigmailLog.DEBUG("autocryptSetup.jsm: getMsgHeader() Error : " + e + "\n");
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

            let checkHeaderValues = await checkHeaders(headerObj, msgHeader, msgAuthor, accountMsgServer, msgFolder, returnMsgValue, autocryptHeaders);


            autocryptHeaders = checkHeaderValues.autocryptHeaders;
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

      if (returnMsgValue.header) {
        resolve(returnMsgValue);
      }
      else {

        if (autocryptHeaders.length > 0) {
          returnMsgValue.value = 2;
          returnMsgValue.autocryptheaders = autocryptHeaders;
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
   * @param headerValue: Object - containing header and attachment of the latest Autocrypt Setup Message
   *
   */

  performAutocryptSetup: function(headerValue, passwordWindow = null, confirmWindow = null) {

    EnigmailLog.DEBUG("autocryptSetup.js: performAutocryptSetup()");
    if (headerValue.attachment.contentType.search(/^application\/autocrypt-setup$/i) === 0) {
      EnigmailAutocrypt.getSetupMessageData(headerValue.attachment.url).then(res => {
        let passwd = EnigmailWindows.autocryptSetupPasswd(passwordWindow, "input", res.passphraseFormat, res.passphraseHint);

        if ((!passwd) || passwd == "") {
          throw "noPasswd";
        }

        return EnigmailAutocrypt.handleBackupMessage(passwd, res.attachmentData, headerValue.header.author);
      }).
      then(res => {
        EnigmailDialog.info(confirmWindow, EnigmailLocale.getString("autocrypt.importSetupKey.success", headerValue.header.author));
      }).
      catch(err => {
        EnigmailLog.DEBUG("autocryptSetup.js: performAutocryptSetup got cancel status=" + err + "\n");

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
    EnigmailLog.DEBUG("autocryptSetup.js: processAutocryptHeader()");

    return new Promise(async(resolve, reject) => {
      for (let i = 0; i < headerValue.autocryptheaders.length; i++) {
        for (let j = 0; j < headerValue.autocryptheaders[i].msgData.length; j++) {
          let success = await EnigmailAutocrypt.processAutocryptHeader(headerValue.autocryptheaders[i].fromAddr, [headerValue.autocryptheaders[i].msgData[j]], headerValue.autocryptheaders[i]
            .date);
          if (success != 0) {
            EnigmailDialog.alert(win, EnigmailLocale.getString("acStartup.acHeaderFound.failure"));
            resolve(1);
          }
        }
      }
      EnigmailDialog.alert(win, EnigmailLocale.getString("acStartup.acHeaderFound.success"));
      resolve(0);
    });
  },

  startKeyGen: async function(headerValue) {

    return new Promise(async(resolve, reject) => {
      EnigmailLog.DEBUG("autocryptSetup.js: startKeyGen()");
      let userName = headerValue.userName,
        userEmail = headerValue.userEmail,
        expiry = 1825,
        keyLength = 4096,
        keyType = "RSA",
        passphrase = "",
        generateObserver = new genKeyObserver();

      try {
        let keygenRequest = await EnigmailKeyRing.generateKey(userName, "", userEmail, expiry, keyLength, keyType, passphrase, generateObserver);
        keygenRequest.wait();
        resolve(0);
      }
      catch (ex) {
        EnigmailLog.DEBUG("autocryptSetup.js: startKeyGen() error : " + ex);
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
        EnigmailLog.DEBUG("autocryptSetup.jsm: createStreamListener() : " + e + "\n");
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

function checkHeaders(headerObj, msgHeader, msgAuthor, accountMsgServer, msgFolder, returnMsgValue, autocryptHeaders) {
  return new Promise(async(resolve, reject) => {
    if (headerObj['autocrypt-setup-message'] && msgHeader.author == msgHeader.recipients) {

      // To extract Attachement for Autocrypt Setup Message

      returnMsgValue.attachment = await getStreamedMessage(msgFolder, msgHeader);

      if (!returnMsgValue.header) {
        returnMsgValue.value = 1;
        returnMsgValue.header = msgHeader;
      }
      else if (returnMsgValue.header.date < msgHeader.date) {
        returnMsgValue.header = msgHeader;
      }

    }
    else if (headerObj.autocrypt && msgAuthor == accountMsgServer.username) {
      if (autocryptHeaders.length == 0) {
        let addHeader = {
          'fromAddr': msgAuthor,
          'msgData': [headerObj.autocrypt],
          'date': headerObj.date[0]
        };
        autocryptHeaders.push(addHeader);
      }
      else {
        let fromHeaderExist = 0;
        for (let j = 0; j < autocryptHeaders.length; j++) {
          if (autocryptHeaders[j].fromAddr == msgAuthor) {
            if (!autocryptHeaders[j].msgData.includes(headerObj.autocrypt)) {
              autocryptHeaders[j].msgData.push(headerObj.autocrypt);
            }
            fromHeaderExist++;
            break;
          }
        }
        if (fromHeaderExist == 0) {
          let addHeader = {
            'fromAddr': msgAuthor,
            'msgData': [headerObj.autocrypt],
            'date': headerObj.date[0]
          };
          autocryptHeaders.push(addHeader);
        }
      }
    }

    resolve({
      'returnMsgValue': returnMsgValue,
      'autocryptHeaders': autocryptHeaders
    });
  });
}

function getStreamedHeaders(msgURI, mms) {

  return new Promise((resolve, reject) => {
    let headerObj = {};
    try {
      mms.streamHeaders(msgURI, createStreamListener(aRawString => {
        try {
          let re = '/\r?\n\s+/g';
          let str = aRawString.replace(re, " ");
          let lines = str.split(/\r?\n/);
          for (let line of lines) {
            let i = line.indexOf(":");
            if (i < 0)
              continue;
            let k = line.substring(0, i).toLowerCase();
            let v = line.substring(i + 1).trim();
            if (!(k in headerObj))
              headerObj[k] = [];
            headerObj[k].push(v);
          }
          if (headerObj.autocrypt) {
            /** This function does not stream headers correctly for long headers. Doing manually for Autocrypt.
             * TODO : Change this Function.
             */
            let autocryptString = aRawString.substring(aRawString.indexOf("Autocrypt: ") + 11, aRawString.indexOf(':', aRawString.indexOf("Autocrypt: ") + 12));
            let autocryptStrings = autocryptString.split('\n');
            let finalAutocryptString = autocryptString.substring(0, autocryptString.length - autocryptStrings[autocryptStrings.length - 1].length);
            headerObj.autocrypt = finalAutocryptString;
          }
        }
        catch (e) {
          reject({});
          EnigmailLog.DEBUG("autocryptSetup.jsm: getStreamedHeaders() Error : " + e + "\n");
        }
        resolve(headerObj);
      }), null, false);
    }
    catch (e) {
      reject({});
      EnigmailLog.DEBUG("autocryptSetup.jsm: getStreamedHeaders() Error : " + e + "\n");
    }
  });
}

function genKeyObserver() {}

genKeyObserver.prototype = {
  keyId: null,
  backupLocation: null,
  _state: 0,

  onDataAvailable: function(data) {},
  onStopRequest: function(exitCode) {}
};
