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
 * The Initial Developer of the Original Code is Janosch Rux.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2014 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributors:
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
 * 'Components.utils.import("resource://enigmail/fixExchangeMsg.jsm");'
 */

try {
  // TB with omnijar
  Components.utils.import("resource:///modules/gloda/mimemsg.js");
  Components.utils.import("resource:///modules/gloda/utils.js");
}
catch (ex) {
  // "old style" TB
  Components.utils.import("resource://app/modules/gloda/mimemsg.js");
  Components.utils.import("resource://app/modules/gloda/utils.js");
}

try {
  Components.utils.import("resource://gre/modules/Promise.jsm");
} catch (ex) {
  Components.utils.import("resource://gre/modules/commonjs/sdk/core/promise.js");
}


Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");

const Ec = EnigmailCommon;
const EC = EnigmailCore;


var EXPORTED_SYMBOLS = ["EnigmailFixExchangeMsg"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Components.interfaces.nsIEnigmail;

/*
 *  Fix a broken message from MS-Exchange and replace it with the original message
 *
 * @param nsIMsgDBHdr hdr          Header of the message to fix (= pointer to message)
 * @param String destFolderUri     optional destination Folder URI
 *
 * @return Promise; upon success, the promise returns the messageKey
 */

// TODO: change to creating new object
EnigmailFixExchangeMsg = {
  fixExchangeMessage: function (hdr, destFolderUri) {
    var self = this;
    return new Promise(
      function fixExchangeMessage_p(resolve, reject) {

        let msgUriSpec = hdr.folder.getUriForMsg(hdr);
        EC.DEBUG_LOG("fixExchangeMsg.jsm: fixExchangeMessage: msgUriSpec: "+msgUriSpec+"\n");

        self.hdr = hdr;
        self.destFolder = hdr.folder;
        self.resolve = resolve;
        self.reject = reject;

        if (destFolderUri) {
          self.destFolder = MailUtils.getFolderForURI(destFolderUri, false)
        }


        let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
        self.msgSvc = messenger.messageServiceFromURI(msgUriSpec);

        let p = self.getMessageBody();
        p.then(
          function resolved(fixedMsgData) {
            EC.DEBUG_LOG("fixExchangeMsg.jsm: fixExchangeMessage: got fixedMsgData\n");
            self.copyToTargetFolder(fixedMsgData);
          });
        p.catch(
          function rejected(reason) {
            EC.DEBUG_LOG("fixExchangeMsg.jsm: fixExchangeMessage: caught rejection: " + reason + "\n");
            reject();
          });
      }
    );
  },

  getMessageBody: function() {
    EC.DEBUG_LOG("fixExchangeMsg.jsm: getMessageBody:\n");

    var self = this;

    return new Promise(
      function(resolve, reject) {
        let u = {}
        self.msgSvc.GetUrlForUri(self.hdr.folder.getUriForMsg(self.hdr), u, null)

        let op = (u.value.spec.indexOf("?") > 0 ? "&" : "?");
        let url = u.value.spec; // + op + 'part=' + part+"&header=enigmailConvert";

        EC.DEBUG_LOG("fixExchangeMsg.jsm: getting data from URL " + url +"\n");

        let s = Ec.newStringStreamListener(
          function analyzeData(data) {
            EC.DEBUG_LOG("fixExchangeMsg.jsm: analyzeDecryptedData: got " + data.length +" bytes\n");

            if (EnigmailCore.getLogLevel() > 5) {
              EC.DEBUG_LOG("*** start data ***\n'" + data +"'\n***end data***\n");
            }

            let hdrEnd = data.search(/\r?\n\r?\n/);

            if (hdrEnd <= 0) {
              // cannot find end of header data
              reject(0);
            }

            let hdrLines = data.substr(0, hdrEnd).split(/\r?\n/);
            let hdrObj = self.getFixedHeaderData(hdrLines);

            if (hdrObj.headers.length == 0 || hdrObj.boundary.length == 0) {
              reject(1);
            }

            let boundary = hdrObj.boundary.replace(/^(['"])(.*)(['"])/, "$2");
            let body = self.getCorrectedBodyData(data.substr(hdrEnd+2), boundary);

            if (body) {
              resolve(hdrObj.headers + "\r\n" + body);
            }
            else {
              reject(2);
            }
          }
        );

        var ioServ = Components.classes[Ec.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        try {
          var channel = ioServ.newChannel(url, null, null);
          channel.asyncOpen(s, null);
        }
        catch(e) {
          EC.DEBUG_LOG("fixExchangeMsg.jsm: getMessageBody: exception " + e +"\n")
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
  getFixedHeaderData: function (hdrLines) {
    EC.DEBUG_LOG("fixExchangeMsg.jsm: getFixedHeaderData: hdrLines[]:'"+ hdrLines.length +"'\n");
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
          if(hdrLines[i].search(/^[ \t]+?/) == 0) {
            contentTypeLine += hdrLines[i];
            i++;
          }
          else {
            // we got the complete content-type header
            contentTypeLine = contentTypeLine.replace(/[\r\n]/g, "");
            let h = EnigmailFuncs.getHeaderData(contentTypeLine);
            r.boundary = h["boundary"] || "";
            break;
          }
        }
      }
      else {
        r.headers += hdrLines[i] + "\r\n";
      }
    }

    r.headers += 'Content-Type: multipart/encrypted;\r\n'+
      '  protocol="application/pgp-encrypted";\r\n' +
      '  boundary=' + r.boundary + '\r\n' +
      'X-Enigmail-Info: Fixed broken MS-Exchange PGP/MIME message\r\n';

    return r;
  },


  getCorrectedBodyData: function(bodyData, boundary) {
    EC.DEBUG_LOG("fixExchangeMsg.jsm: getCorrectedBodyData: boundary='"+ boundary +"'\n");
    let boundRx = RegExp("^--" + boundary, "ym");
    let match = boundRx.exec(bodyData);

    if (match.index < 0) {
      EC.DEBUG_LOG("fixExchangeMsg.jsm: getCorrectedBodyData: did not find index of mime type to skip\n");
      return null;
    }

    let skipStart = match.index;
    // found first instance -- that's the message part to ignore
    match = boundRx.exec(bodyData);
    if (match.index <= 0) {
      EC.DEBUG_LOG("fixExchangeMsg.jsm: getCorrectedBodyData: did not find boundary of PGP/MIME version identification\n");
      return null;
    }

    let versionIdent = match.index;

    if (bodyData.substring(skipStart, versionIdent).search(/^content-type:[ \t]*text\/plain/mi) < 0) {
      EC.DEBUG_LOG("fixExchangeMsg.jsm: getCorrectedBodyData: first MIME part is not content-type text/plain\n");
      return null;
    }

    match = boundRx.exec(bodyData);
    if (match.index < 0) {
      EC.DEBUG_LOG("fixExchangeMsg.jsm: getCorrectedBodyData: did not find boundary of PGP/MIME encrypted data\n");
      return null;
    }

    let encData = match.index;
    let mimeHdr = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);
    mimeHdr.initialize(bodyData.substring(versionIdent, encData));
    let ct = mimeHdr.extractHeader("content-type", false);

    if (!ct || ct.search(/application\/pgp-encrypted/i) < 0) {
      EC.DEBUG_LOG("fixExchangeMsg.jsm: getCorrectedBodyData: wrong content-type of version-identification\n");
      EC.DEBUG_LOG("   ct = '"+ct+"'\n");
      return null;
    }

    mimeHdr.initialize(bodyData.substr(encData, 500));
    ct = mimeHdr.extractHeader("content-type", false);
    if (!ct || ct.search(/application\/octet-stream/i) < 0) {
      EC.DEBUG_LOG("fixExchangeMsg.jsm: getCorrectedBodyData: wrong content-type of PGP/MIME data\n");
      EC.DEBUG_LOG("   ct = '"+ct+"'\n");
      return null;
    }

    return bodyData.substr(versionIdent);
  },

  copyToTargetFolder: function (msgData) {
    var self = this;
    var tempFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
    tempFile.append("message.eml");
    tempFile.createUnique(0, 0600);

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
      QueryInterface : function(iid) {
        if (iid.equals(Ci.nsIMsgCopyServiceListener) ||iid.equals(Ci.nsISupports)){
          return this;
        }
        throw Components.results.NS_NOINTERFACE;
        return null;
      },
      msgKey: null,
      GetMessageId: function (messageId) {},
      OnProgress: function (progress, progressMax) {},
      OnStartCopy: function () {},
      SetMessageKey: function (key) {
        this.msgKey = key;
      },
      OnStopCopy: function (statusCode) {
        if (statusCode != 0) {
          EC.DEBUG_LOG("fixExchangeMsg.jsm: error copying message: "+ statusCode + "\n");
          tempFile.remove(false);
          self.reject(3);
          return;
        }
        EC.DEBUG_LOG("fixExchangeMsg.jsm: copy complete\n");

         EC.DEBUG_LOG("fixExchangeMsg.jsm: deleting message key="+self.hdr.messageKey+"\n");
        let msgArray = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
        msgArray.appendElement(self.hdr, false);

        self.hdr.folder.deleteMessages(msgArray, null, true, false,  null, false);
        EC.DEBUG_LOG("fixExchangeMsg.jsm: deleted original message\n");

        tempFile.remove(false);
        self.resolve(this.msgKey);
      }
    };

    let copySvc = Cc["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService);
    copySvc.CopyFileMessage(fileSpec, this.destFolder, null, false, this.hdr.flags, null, copyListener, null);

  }
};
