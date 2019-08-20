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

    const account = Cc["@mozilla.org/messenger/account-manager;1"]
      .getService(Ci.nsIMsgAccountManager)
      .accounts
      .queryElementAt(0, Ci.nsIMsgAccount);
    if (!account) {
      EnigmailLog.DEBUG(`welcomeMessage.jsm: sendWelcomeMessage(): no account, aborting\n`);
      return;
    }

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

    const msg_id = EnigmailRNG.generateRandomString(27) + "-autocrypt";

    const tmpFile = EnigmailFiles.getTempDirObj();
    tmpFile.append(`${msg_id}.eml`);

    let date_str = new Date().toUTCString();
    let msgStr = `To: ${recipient}
From: Alice Autocrypt <bot@autocrypt.org>
Subject: Welcome to Autocrypt!
Date: ${date_str}
Message-Id: ${msg_id}
Content-Type: text/html
Autocrypt: addr=bot@autocrypt.org; keydata=
 mQGNBF1Q6h8BDACVe/xFAf5gSGwce2IMlKyOWooXOt6pzYzKEQcrFNR2g0hml7NuMOvCLe2ldBajbE
 81k8g96W221XFISNZwmSiUWbQhS6NtQzKl9EqBxAcTX/seOpUpWRM25gnrfqbdkDd8C2WzzR85IN1Z
 J7YHq31bmJKiRJYF3zZxy6ts68WeUL4BYLplUn4XNbh1MMo9IzHolPGflEhSgTRjDjv7fDNdaN4Y0o
 MW8SwdjZ9n4n0QP7ZaPbWekyJAkLzX+35KP1j8f1+0LkHcqQ0OsGK7eg1oPveXmjTQChPoH6l87P9e
 Cv4J6OMaj2jS/c2tSwFs0yh2tQJvPNynmhw6gSO/ugJFqiTOt6nG39Tf+0eYCKTwBqxWLKFRct4CF9
 xfN+66U7NCeIE0cDIzry0Vthdfr4IcMKMs6jBxPMoF1pLFNo8LzjfZQ5qxIGKrvT1KSs3oLt9Xbb+3
 eLs/qGRhC1VkT4ZAsI7epSE4bIbkQVShTkxKvS9Bs+RHqpAyOExdgxMW108AEQEAAbQ3IDwyY2U3Nz
 dhNGYwN2E0ZjU5YjZlYzNkNTljMDc0OWIzZUByYW5kb20ubXVhY3J5cHQub3JnPokBzgQTAQgAOBYh
 BEaWl2FUTz16XcfzDcDyfPtgGOGVBQJdUOofAhsDBQsJCAcCBhUICQoLAgQWAgMBAh4BAheAAAoJEM
 DyfPtgGOGVir4L/3e7E4c0lmgw7Izkta+kZqlpc15D+QbR7JE4UJsvwVs8vofbmYQZX/n+BGK0r/60
 Q3YqbDz3PRtlpn3nW0ttuA81laXHAGSCIpGO514jke4euNc7tttfqehAbaFnUuozF3sY5BE17lh8EJ
 dqWOBtU4HZWboauXpBPVbb8eTkgeeNrn9bmCcovmnLyrc8/MY3YLLrqLGH8J0h04asqvtgKsZsmNbw
 2v4zA0f5pBA0bssf0yMIQIMrD0n7gkLzohVfJG9AfyrgnliYJIZ/waH13c4S2B0GBejx+d+fw03l4W
 uPC8Esz1a69Qt1mDhrB5kIpawiGUh40Ccv2aCarOitxNkvmdBkXra1vYVNiNmL0wE/Y2eaoXBVBU+2
 o1v4ayum073n22RVZiTyUGJwH15YfB3HLRR+aerKyuW61BhxzVB8wII2bhEZYOh6ew09f7aeuoZXaJ
 YAwy14+MVx4Tm11jwaiDSYEZJozy//IwlUhrAFcOZW7p17CS8uQ2yWpw3plrkBjQRdUOofAQwAqpb+
 +qnG3Bwvik6mM7Ycf78+7Hlqpb6sY+bVPMHNGm6QICFPc+U/oOOAruESJT/XNv5QUAXxQ+osIjQi+3
 UD8WavjfUI714sEXtrT4ss+BVNXVsZarf362usEbJ4bxfwcwF2hmXcIOTddvLSXnERTlat0WMwNb4p
 avj33DB6wwscu0ej1vSW1QCbOncXb0E4uxoxxDuV1BOJ2dmHoyAqEHQJ81dQV8CtKMBzVW98AmeP2v
 6N/xhxBkS5puoQDSEjQ+kn8pIThE+iEoe486EfflbEGe3IA0aV8CHGUWpfedXi8qBHFj5ZAalsDF24
 9v2lMebviQW85Q/hGoNnD/9+42jeVGv1xi6mrAAMctrCspxwgkKMhwxaPgVIaMbjpBzi5+BRQ+zP/u
 0ozJU9hsMRqJsDE9FVgo0WTZ2uOYx/aLzwePT3D1e0Ot6xnllrpBIXCBGCYZbXXfJr7GR2gOCRiX+C
 m4CtrstVw4T++kJzURpaiAUwyRxJNE52IHEKEqMHABEBAAGJAbYEGAEIACAWIQRGlpdhVE89el3H8w
 3A8nz7YBjhlQUCXVDqHwIbDAAKCRDA8nz7YBjhlQbTC/0QhcjXEk0FAZu22DilUv3SP5IJk1O5tuCA
 cq2Pcy1TWLHM2jMvgS25hNvrHl1d/vYcnhS6+VtjcLnlNolNNM2ny2WbV+hVndH+mpl6xNjG/P62Iv
 fruUGyjDYlFW+LgTpYPYBzcr2LP59iV8DqxI+mqwFWaGoXJzP5njtsFfxJ4Ivj7S3n6sq7EnqrE8KT
 pxZ23kXVakCGe4VPRGlyPviUus0L7EvMgrnrO2493cvphpbYpANssq65GhKdF6iP1/TCtNsGIfyDZu
 LMZpHVsCpvs/eiNhPUb9jbMIvArqoeMiFJLIBPHIal+6U1Hgbzb5UHPsk2JU5A11zLttbkgfDRewds
 w3JH/nlohLPqg4hveq8qNUwrFP/8fKm1CyriX0sMxg96xMQu1dEKiBl16gWTfZqWwujcc7iICQ7ALZ
 Pz8/MgqR1IqIUigmanEMZLNjkGdSeaYPbnyKiLVihTiRUYw7dfiv5HTnfpQMeROuLlNPlYdUx2DO/N
 JnFGQVbZCS8=

<pre wrap="">
Autocrypt for Thunderbird was successfully configured!

Everything is ready to go, no further configuration necessary. Encryption is
automatically available for all contacts with Autocrypt-compatible clients!

You can reply to this message, and I'll answer you encrypted! To encrypt to me,
simply click the button that looks like this in the compose window:

                           <img src="data:image/gif;base64,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" />

That's it. I'll get out of your way now.

 - Alice, the Autocrypt bot

PS: This message was generated locally by the Autocrypt extension.

PPS: This message, and bot replies, are still a work in progress :)
</pre>
`.replace(/\n/gm, '\r\n');

    EnigmailFiles.writeFileContents(tmpFile, msgStr);

    // nsIMsgCopyServiceListener
    var deleteTmpFileOnFinishListener = {
      OnStartCopy : function() {},
      OnStopCopy : function() {
        tmpFile.remove(false);
      }
    };

    var cs = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
      .getService(Components.interfaces.nsIMsgCopyService);
    cs.CopyFileMessage(tmpFile, inboxFolder, null, false, 0, "", deleteTmpFileOnFinishListener, msgWindow);
  }
};
