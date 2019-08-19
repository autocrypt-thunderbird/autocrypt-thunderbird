/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptWelcomeMessage"];

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").EnigmailFiles;
const EnigmailRNG = ChromeUtils.import("chrome://autocrypt/content/modules/rng.jsm").EnigmailRNG;

const nsMsgFolderFlags_Inbox = 0x00001000;

var AutocryptWelcomeMessage = {
  findInboxForAccount: function(account) {
    const rootFolder = account.incomingServer.rootFolder;
    if (!rootFolder.hasSubFolders) {
      return null;
    }

    let subFolders = rootFolder.subFolders;
    while (subFolders.hasMoreElements()) {
      const subFolder = subFolders.getNext().QueryInterface(Ci.nsIMsgFolder);
      if (subFolder.flags & nsMsgFolderFlags_Inbox) {
        return subFolder;
      }
    }
    return null;
  },

  sendWelcomeMessage: function(msgWindow) {
    EnigmailLog.DEBUG(`welcomeMessage.jsm: sendWelcomeMessage()\n`);
    if (!msgWindow) {
      msgWindow = null;
    }

    const account = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager).accounts.queryElementAt(0, Ci.nsIMsgAccount);

    const inboxFolder = this.findInboxForAccount(account);
    if (!inboxFolder) {
      EnigmailLog.DEBUG(`welcomeMessage.jsm: sendWelcomeMessage(): no inbox, aborting\n`);
      return;
    }

    const recipient = account.defaultIdentity.fullAddress;
    if (!recipient) {
      EnigmailLog.DEBUG(`welcomeMessage.jsm: sendWelcomeMessage(): no recipient, aborting\n`);
      return;
    }

    const tmpFile = EnigmailFiles.getTempDirObj();
    tmpFile.append('autocrypt-welcome.eml');

    const msg_id = EnigmailRNG.generateRandomString(27) + "-autocrypt";
    let date_str = new Date().toUTCString();
    let msgStr = `To: ${recipient}\r
From: Alice Autocrypt <alice@autocrypt.org>\r
Subject: Welcome to Autocrypt!\r
Date: ${date_str}\r
Message-Id: ${msg_id}\r
Content-Type: text/html\r
\r
<p>Autocrypt for Thunderbird was successfully configured!</p>\r
\r
<p>We set up everything to get you started, no further configuration is\r
necessary.</p>\r
<p>Just two things:</p>\r
<ul>\r
  <li>Encryption is automatically available for all contacts with Autocrypt-compatible clients.</li>\r
  <li>If you already have some keys and want to import them, check out the Autocrypt settings.</li>\r
</ul>\r
<p>\r
  While writing messages, just click this button:\r
  <img src="data:image/gif;base64,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" />\r
<p> - Alice, the Autocrypt bot</p>\r
\r
<p>PS: This message was generated locally by the Autocrypt extension.</p>\r
`;

    EnigmailFiles.writeFileContents(tmpFile, msgStr);

    // nsIMsgCopyServiceListener
    var deleteTmpFileOnFinishListener = {
      OnStartCopy : function() {},
      OnStopCopy : function() {
        // tmpFile.remove(false);
      }
    };

    var cs = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
      .getService(Components.interfaces.nsIMsgCopyService);
    cs.CopyFileMessage(tmpFile, inboxFolder, null, false, 0, "", deleteTmpFileOnFinishListener, msgWindow);
  }
};
