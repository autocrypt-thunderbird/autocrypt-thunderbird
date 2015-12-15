/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailFixExchangeMsg"];

const Cu = Components.utils;

Cu.import("resource:///modules/MailUtils.js"); /*global MailUtils: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/promise.jsm"); /*global Promise: false */
Cu.import("resource://enigmail/streams.jsm"); /*global EnigmailStreams: false */

const EC = EnigmailCore;

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Components.interfaces.nsIEnigmail;

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

/*
 *  Fix a broken message from MS-Exchange and replace it with the original message
 *
 * @param nsIMsgDBHdr hdr          Header of the message to fix (= pointer to message)
 * @param String brokenByApp       Type of app that created the message. Currently one of
 *                                  exchange, iPGMail
 * @param String destFolderUri     optional destination Folder URI
 *
 * @return Promise; upon success, the promise returns the messageKey
 */
const EnigmailFixExchangeMsg = {
  fixExchangeMessage: function(hdr, brokenByApp, destFolderUri) {
    var self = this;
    return new Promise(
      function fixExchangeMessage_p(resolve, reject) {

        let msgUriSpec = hdr.folder.getUriForMsg(hdr);
        EnigmailLog.DEBUG("fixExchangeMsg.jsm: fixExchangeMessage: msgUriSpec: " + msgUriSpec + "\n");

        self.hdr = hdr;
        self.destFolder = hdr.folder;
        self.resolve = resolve;
        self.reject = reject;
        self.brokenByApp = brokenByApp;

        if (destFolderUri) {
          self.destFolder = MailUtils.getFolderForURI(destFolderUri, false);
        }


        let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
        self.msgSvc = messenger.messageServiceFromURI(msgUriSpec);

        let p = self.getMessageBody();
        p.then(
          function resolved(fixedMsgData) {
            EnigmailLog.DEBUG("fixExchangeMsg.jsm: fixExchangeMessage: got fixedMsgData\n");
            self.copyToTargetFolder(fixedMsgData);
          });
        p.catch(
          function rejected(reason) {
            EnigmailLog.DEBUG("fixExchangeMsg.jsm: fixExchangeMessage: caught rejection: " + reason + "\n");
            reject();
            return;
          });
      }
    );
  },

  getMessageBody: function() {
    EnigmailLog.DEBUG("fixExchangeMsg.jsm: getMessageBody:\n");

    var self = this;

    return new Promise(
      function(resolve, reject) {
        let u = {};
        self.msgSvc.GetUrlForUri(self.hdr.folder.getUriForMsg(self.hdr), u, null);

        let op = (u.value.spec.indexOf("?") > 0 ? "&" : "?");
        let url = u.value.spec; // + op + 'part=' + part+"&header=enigmailConvert";

        EnigmailLog.DEBUG("fixExchangeMsg.jsm: getting data from URL " + url + "\n");

        let s = EnigmailStreams.newStringStreamListener(
          function analyzeData(data) {
            EnigmailLog.DEBUG("fixExchangeMsg.jsm: analyzeDecryptedData: got " + data.length + " bytes\n");

            if (EnigmailLog.getLogLevel() > 5) {
              EnigmailLog.DEBUG("*** start data ***\n'" + data + "'\n***end data***\n");
            }

            let hdrEnd = data.search(/\r?\n\r?\n/);

            if (hdrEnd <= 0) {
              // cannot find end of header data
              reject(0);
              return;
            }

            let hdrLines = data.substr(0, hdrEnd).split(/\r?\n/);
            let hdrObj = self.getFixedHeaderData(hdrLines);

            if (hdrObj.headers.length === 0 || hdrObj.boundary.length === 0) {
              reject(1);
              return;
            }

            let boundary = hdrObj.boundary;
            let body;

            switch (self.brokenByApp) {
              case "exchange":
                body = self.getCorrectedExchangeBodyData(data.substr(hdrEnd + 2), boundary);
                break;
              case "iPGMail":
                body = self.getCorrectediPGMailBodyData(data.substr(hdrEnd + 2), boundary);
                break;
              default:
                EnigmailLog.ERROR("fixExchangeMsg.jsm: getMessageBody: unknown appType " + self.brokenByApp + "\n");
                reject(99);
                return;
            }

            if (body) {
              resolve(hdrObj.headers + "\r\n" + body);
              return;
            }
            else {
              reject(2);
              return;
            }
          }
        );

        var ioServ = Components.classes[IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        try {
          var channel = ioServ.newChannel(url, null, null);
          channel.asyncOpen(s, null);
        }
        catch (e) {
          EnigmailLog.DEBUG("fixExchangeMsg.jsm: getMessageBody: exception " + e + "\n");
        }
      }
    );
  },

  /**
   *  repair header data, such that they are working for PGP/MIME
   *
   *  @return: object: {
   *        headers:  String - all headers ready for appending to message
   *        boundary: String - MIME part boundary (incl. surrounding "" or '')
   *      }
   */
  getFixedHeaderData: function(hdrLines) {
    EnigmailLog.DEBUG("fixExchangeMsg.jsm: getFixedHeaderData: hdrLines[]:'" + hdrLines.length + "'\n");
    let r = {
      headers: "",
      boundary: ""
    };

    for (let i = 0; i < hdrLines.length; i++) {
      if (hdrLines[i].search(/^content-type:/i) >= 0) {
        // Join the rest of the content type lines together.
        // See RFC 2425, section 5.8.1
        let contentTypeLine = hdrLines[i];
        i++;
        while (i < hdrLines.length) {
          // Does the line start with a space or a tab, followed by something else?
          if (hdrLines[i].search(/^[ \t]+?/) === 0) {
            contentTypeLine += hdrLines[i];
            i++;
          }
          else {
            // we got the complete content-type header
            contentTypeLine = contentTypeLine.replace(/[\r\n]/g, "");
            let h = EnigmailFuncs.getHeaderData(contentTypeLine);
            r.boundary = h.boundary || "";
            break;
          }
        }
      }
      else {
        r.headers += hdrLines[i] + "\r\n";
      }
    }

    r.boundary = r.boundary.replace(/^(['"])(.*)(['"])/, "$2");

    r.headers += 'Content-Type: multipart/encrypted;\r\n' +
      '  protocol="application/pgp-encrypted";\r\n' +
      '  boundary="' + r.boundary + '"\r\n' +
      'X-Enigmail-Info: Fixed broken PGP/MIME message\r\n';

    return r;
  },


  /**
   * Get corrected body for MS-Exchange messages
   */
  getCorrectedExchangeBodyData: function(bodyData, boundary) {
    EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectedExchangeBodyData: boundary='" + boundary + "'\n");
    let boundRx = new RegExp("^--" + boundary, "gm");
    let match = boundRx.exec(bodyData);

    if (match.index < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectedExchangeBodyData: did not find index of mime type to skip\n");
      return null;
    }

    let skipStart = match.index;
    // found first instance -- that's the message part to ignore
    match = boundRx.exec(bodyData);
    if (match.index <= 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectedExchangeBodyData: did not find boundary of PGP/MIME version identification\n");
      return null;
    }

    let versionIdent = match.index;

    if (bodyData.substring(skipStart, versionIdent).search(/^content-type:[ \t]*text\/plain/mi) < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectedExchangeBodyData: first MIME part is not content-type text/plain\n");
      return null;
    }

    match = boundRx.exec(bodyData);
    if (match.index < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectedExchangeBodyData: did not find boundary of PGP/MIME encrypted data\n");
      return null;
    }

    let encData = match.index;
    let mimeHdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    mimeHdr.initialize(bodyData.substring(versionIdent, encData));
    let ct = mimeHdr.extractHeader("content-type", false);

    if (!ct || ct.search(/application\/pgp-encrypted/i) < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectedExchangeBodyData: wrong content-type of version-identification\n");
      EnigmailLog.DEBUG("   ct = '" + ct + "'\n");
      return null;
    }

    mimeHdr.initialize(bodyData.substr(encData, 500));
    ct = mimeHdr.extractHeader("content-type", false);
    if (!ct || ct.search(/application\/octet-stream/i) < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectedExchangeBodyData: wrong content-type of PGP/MIME data\n");
      EnigmailLog.DEBUG("   ct = '" + ct + "'\n");
      return null;
    }

    return bodyData.substr(versionIdent);
  },


  /**
   * Get corrected body for iPGMail messages
   */
  getCorrectediPGMailBodyData: function(bodyData, boundary) {
    EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectediPGMailBodyData: boundary='" + boundary + "'\n");
    let boundRx = new RegExp("^--" + boundary, "gm");
    let match = boundRx.exec(bodyData);

    if (match.index < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectediPGMailBodyData: did not find index of mime type to skip\n");
      return null;
    }

    let skipStart = match.index;
    // found first instance -- that's the message part to ignore
    match = boundRx.exec(bodyData);
    if (match.index <= 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectediPGMailBodyData: did not find boundary of text/plain msg part\n");
      return null;
    }

    let encData = match.index;

    match = boundRx.exec(bodyData);
    if (match.index < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectediPGMailBodyData: did not find end boundary of PGP/MIME encrypted data\n");
      return null;
    }

    let mimeHdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);

    mimeHdr.initialize(bodyData.substr(encData, 500));
    let ct = mimeHdr.extractHeader("content-type", false);
    if (!ct || ct.search(/application\/pgp-encrypted/i) < 0) {
      EnigmailLog.DEBUG("fixExchangeMsg.jsm: getCorrectediPGMailBodyData: wrong content-type of PGP/MIME data\n");
      EnigmailLog.DEBUG("   ct = '" + ct + "'\n");
      return null;
    }

    return "--" + boundary + "\r\n" +
      "Content-Type: application/pgp-encrypted\r\n" +
      "Content-Description: PGP/MIME version identification\r\n\r\n" +
      "Version: 1\r\n\r\n" +
      bodyData.substring(encData, match.index).
    replace(/^Content-Type: +application\/pgp-encrypted/im,
        "Content-Type: application/octet-stream") +
      "--" + boundary + "--\r\n";
  },

  copyToTargetFolder: function(msgData) {
    var self = this;
    var tempFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
    tempFile.append("message.eml");
    tempFile.createUnique(0, 384); // octal 0600 - since octal is deprected in JS

    // ensure that file gets deleted on exit, if something goes wrong ...
    var extAppLauncher = Cc["@mozilla.org/mime;1"].getService(Ci.nsPIExternalAppLauncher);

    var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
    foStream.init(tempFile, 2, 0x200, false); // open as "write only"
    foStream.write(msgData, msgData.length);
    foStream.close();

    extAppLauncher.deleteTemporaryFileOnExit(tempFile);

    // note: nsIMsgFolder.copyFileMessage seems to have a bug on Windows, when
    // the nsIFile has been already used by foStream (because of Windows lock system?), so we
    // must initialize another nsIFile object, pointing to the temporary file
    var fileSpec = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    fileSpec.initWithPath(tempFile.path);


    var copyListener = {
      QueryInterface: function(iid) {
        if (iid.equals(Ci.nsIMsgCopyServiceListener) || iid.equals(Ci.nsISupports)) {
          return this;
        }
        throw Components.results.NS_NOINTERFACE;
      },
      msgKey: null,
      GetMessageId: function(messageId) {},
      OnProgress: function(progress, progressMax) {},
      OnStartCopy: function() {},
      SetMessageKey: function(key) {
        this.msgKey = key;
      },
      OnStopCopy: function(statusCode) {
        if (statusCode !== 0) {
          EnigmailLog.DEBUG("fixExchangeMsg.jsm: error copying message: " + statusCode + "\n");
          tempFile.remove(false);
          self.reject(3);
          return;
        }
        EnigmailLog.DEBUG("fixExchangeMsg.jsm: copy complete\n");

        EnigmailLog.DEBUG("fixExchangeMsg.jsm: deleting message key=" + self.hdr.messageKey + "\n");
        let msgArray = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
        msgArray.appendElement(self.hdr, false);

        self.hdr.folder.deleteMessages(msgArray, null, true, false, null, false);
        EnigmailLog.DEBUG("fixExchangeMsg.jsm: deleted original message\n");

        tempFile.remove(false);
        self.resolve(this.msgKey);
        return;
      }
    };

    let copySvc = Cc["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService);
    copySvc.CopyFileMessage(fileSpec, this.destFolder, null, false, this.hdr.flags, null, copyListener, null);

  }
};
