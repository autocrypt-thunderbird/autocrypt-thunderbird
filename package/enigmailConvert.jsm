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
 * Portions created by Janosch Rux <rux@informatik.uni-luebeck.de> are
 * Copyright (C) 2014 Janosch Rux. All Rights Reserved.
 *
 * Contributors:
 *  Patrick Brunschwig <patrick@enigmail.net>
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
 * 'Components.utils.import("resource://enigmail/enigmailConvert.jsm");'
 */

Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");
Components.utils.import("resource://enigmail/pipeConsole.jsm");

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
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");
var Ec = EnigmailCommon;


var EXPORTED_SYMBOLS = ["EnigmailDecryptPermanently"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Components.interfaces.nsIEnigmail;

const STATUS_OK = 0;
const STATUS_FAILURE = 1;
const STATUS_NOT_REQUIRED = 2;
/*
 *  Decrypt a message and copy it to a folder
 *
 * @param nsIMsgDBHdr hdr   Header of the message
 * @param String destFolder   Folder URI
 * @param Boolean move      If true the original message will be deleted
 *
 * @return a Promise that we do that
 */
function EnigmailDecryptPermanently(hdr, destFolder, move) {
  return new Promise(
    function(resolve, reject) {
      let msgUriSpec = hdr.folder.getUriForMsg(hdr);

      Ec.DEBUG_LOG("enigmailConvert.jsm: EnigmailDecryptPermanently: MessageUri: "+msgUriSpec+"\n");

      var messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
      var msgSvc = messenger.messageServiceFromURI(msgUriSpec);

      var obj = new Object();
      obj.destFolder = destFolder;
      obj.move = move;
      obj.resolve = resolve;

      Ec.DEBUG_LOG("enigmailConvert.jsm: EnigmailDecryptPermanently: Calling MsgHdrToMimeMessage\n");
      MsgHdrToMimeMessage(hdr, obj, decryptMessageIntoFolder, true, {examineEncryptedParts: false});
      return;
    }
  );
};


function decryptMessageIntoFolder(hdr, mime) {
  var enigmailSvc = Ec.getService();
  var move = this.move;
  var destFolder = this.destFolder;
  var resolve = this.resolve;
  var foundPGP = 0;

  if (mime == null) {
    Ec.DEBUG_LOG("enigmailConvert.jsm: decryptMessageIntoFolder: MimeMessage is null");
    resolve(true);
    return;
  }

  var ct = getContentType(mime.headers['content-type']);
  var pt = getProtocol(mime.headers['content-type']);
  var subject = GlodaUtils.deMime(mime.headers['subject'].join(" "));

  if (ct == null) {
    Ec.DEBUG_LOG("enigmailConvert.jsm: content-type is null");
    resolve(true);
    return;
  }


  var attachments = [];

  walkMimeTree(attachments, hdr, mime, "", 1, mime);

  foundPGP = decryptINLINE(mime, subject);
  if (foundPGP < 0) {
    // decryption failed
    return;
  }


  for (let i in mime.allAttachments) {
    let a =  mime.allAttachments[i];
    let suffixIndexEnd = a.name.toLowerCase().lastIndexOf('.pgp');
    if (suffixIndexEnd < 0) {
      suffixIndexEnd = a.name.toLowerCase().lastIndexOf('.asc');
    }

    if (suffixIndexEnd > 0 &&
        a.contentType.search(/application\/pgp-signature/i) < 0) {

      // possible OpenPGP attachment
      let p = decryptAttachment(a.url, subject, a.name.substring(0, suffixIndexEnd), a.name)
      attachments.push(p);
    }
    else {
      let p = readAttachment(a.url, a.name);
      attachments.push(p);
    }
  }


  Promise.all(attachments).then(
    function (attachments) {
      Ec.DEBUG_LOG("enigmailConvert.jsm: all attachments done\n");


      for (let a in attachments) {

        switch (attachments[a].status) {
        case STATUS_NOT_REQUIRED:
          attachments[a].name = attachments[a].origName;
          break;
        case STATUS_OK:
          ++foundPGP;
          break;
        case STATUS_FAILURE:
          // attachment did not decrypt successfully
          resolve(true);
          return;
        default:
          // no valid result?!
          attachments[a].name = attachments[a].origName;
        }
      }

      if (foundPGP == 0) {
        Ec.DEBUG_LOG("enigmailConvert.jsm: Appears to be no PGP message\n");
        resolve(true);
        return;
      }


      var msg = mimeToString(mime, attachments);

      if (msg == null) {
        // no message data found
        resolve(true);
        return;
      }

      //XXX Do we wanna use the tmp for this?
      var tempFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
      tempFile.append("message.eml");
      tempFile.createUnique(0, 0600);

      // ensure that file gets deleted on exit, if something goes wrong ...
      var extAppLauncher = Cc["@mozilla.org/mime;1"].getService(Ci.nsPIExternalAppLauncher);

      var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      foStream.init(tempFile, 2, 0x200, false); // open as "write only"
      foStream.write(msg, msg.length);
      foStream.close();

      extAppLauncher.deleteTemporaryFileOnExit(tempFile);

      //
      //  This was taken from the HeaderToolsLite Example Addon "original by Frank DiLecce"
      //
      // this is interesting: nsIMsgFolder.copyFileMessage seems to have a bug on Windows, when
      // the nsIFile has been already used by foStream (because of Windows lock system?), so we
      // must initialize another nsIFile object, pointing to the temporary file
      var fileSpec = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      fileSpec.initWithPath(tempFile.path);
      var extService = Cc['@mozilla.org/uriloader/external-helper-app-service;1'].getService(Ci.nsPIExternalAppLauncher);

      const copySvc = Cc["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService);

      var copyListener = {
        QueryInterface : function(iid) {
          if (iid.equals(Ci.nsIMsgCopyServiceListener) ||iid.equals(Ci.nsISupports)){
            return this;
          }
          Ec.DEBUG_LOG("enigmailConvert.jsm: copyListener error\n");
          throw Components.results.NS_NOINTERFACE;
          return 0;
        },
        GetMessageId: function (messageId) {},
        OnProgress: function (progress, progressMax) {},
        OnStartCopy: function () {},
        SetMessageKey: function (key) {},
        OnStopCopy: function (statusCode) {
          if (statusCode != 0) {
            //XXX complain?
            Ec.DEBUG_LOG("enigmailConvert.jsm: Error copying message: "+ statusCode + "\n");
            tempFile.remove(false);
            resolve(true);
            return;
          }
          Ec.DEBUG_LOG("enigmailConvert.jsm: Copy complete\n");

          if (move) {
            Ec.DEBUG_LOG("enigmailConvert.jsm: Delete original\n");
            var folderInfoObj = new Object();
            hdr.folder.getDBFolderInfoAndDB(folderInfoObj).DeleteMessage(hdr.messageKey, null, true);
          }

          tempFile.remove(false);
          Ec.DEBUG_LOG("enigmailConvert.jsm: Cave Johnson. We're done\n");
          resolve(true);
        }
      };

      copySvc.CopyFileMessage(fileSpec, MailUtils.getFolderForURI(destFolder, false), hdr,
          false, 0, null, copyListener, null);
    }
  );

};

function readAttachment(msgUrl, name, origName) {
  return new Promise(
    function(resolve, reject) {
      Ec.DEBUG_LOG("enigmailConvert.jsm: readAttachment\n");
      var f = function _cb(data) {
          Ec.DEBUG_LOG("enigmailConvert.jsm: readAttachment - got data ("+ data.length+")\n");
          var o = {
            type: "attachment",
            data: data,
            name: name,
            origName: origName ? origName : name,
            status: STATUS_NOT_REQUIRED
          }
          resolve(o);
      };

      var bufferListener = EnigmailCommon.newStringStreamListener(f);
      var ioServ = Cc[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
      var msgUri = ioServ.newURI(msgUrl, null, null);

      var channel = ioServ.newChannelFromURI(msgUri);
      channel.asyncOpen(bufferListener, msgUri);
    }
  );
};


function decryptAttachment(msgUrl, subject, name, origName) {
  return new Promise(
    function(resolve, reject) {
      Ec.DEBUG_LOG("enigmailConvert.jsm: decryptAttachment\n");
      readAttachment(msgUrl, name, origName).then(
        function (o) {
          var attachmentHead = o.data.substr(0,30);
          if (attachmentHead.match(/\-\-\-\-\-BEGIN PGP \w+ KEY BLOCK\-\-\-\-\-/)) {
            // attachment appears to be a PGP key file, we just go-a-head
            resolve(o);
            return;
          }
          var enigmailSvc = Ec.getService();
          var args = Ec.getAgentArgs(true);
          args = args.concat(Ec.passwdCommand());
          args.push("-d");

          var passphrase = null;
          var passwdObj = {};
          var useAgentObj = {};
          var statusMsgObj = {};
          var cmdLineObj   = {};
          var exitCode = -1;
          var statusFlagsObj = {};
          var errorMsgObj = {};
          statusFlagsObj.value = 0;

          var listener = Ec.newSimpleListener(
            function _stdin(pipe) {
              if (Ec.requirePassword()) {
                pipe.write(passphrase+"\n");
              }
              pipe.write(o.data);
              pipe.close();
            }
          );


          do {

            if (!Ec.getPassphrase(null, passwdObj, useAgentObj, 0)) {
              Ec.ERROR_LOG("enigmailConvert.jsm:  Error - no passphrase supplied\n");
              o.status = STATUS_FAILURE;
              resolve(o);
              return;
            }

            passphrase = passwdObj.value;

            var proc = Ec.execStart(enigmailSvc.agentPath, args, false, null, listener, statusFlagsObj);
            if (!proc) {
              resolve(o);
              return;
            }
            // Wait for child STDOUT to close
            proc.wait();
            Ec.execEnd(listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);

            if ((listener.stdoutData && listener.stdoutData.length > 0) ||
                (statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY)) {
              Ec.DEBUG_LOG("enigmailConvert.jsm: decryptAttachment: decryption OK\n");
              exitCode = 0;
            }
            else if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_FAILED) {
              Ec.DEBUG_LOG("enigmailConvert.jsm: decryptAttachment: decryption failed\n");
              if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
                Ec.clearCachedPassphrase();
              }
              if (enigmailSvc.useGpgAgent()) {
                // since we cannot find out via getPassphrase if the user wants to cancel
                // we should ask
                let msg = Ec.getString("converter.decryptAtt.failed", [ origName , subject ]);

                if (!Ec.confirmDlg(null, msg,
                    Ec.getString("dlg.button.retry"), Ec.getString("dlg.button.skip"))) {
                  o.status = STATUS_FAILURE;
                  resolve(o);
                  return;
                }
              }

            }
            else if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_INCOMPLETE) {
              // failure; message not complete
              Ec.DEBUG_LOG("enigmailConvert.jsm: decryptAttachment: decryption incomplete\n");
              o.status = STATUS_FAILURE;
              resolve(o);
              return;
            }
            else {
              // there is nothing to be decrypted
              Ec.DEBUG_LOG("enigmailConvert.jsm: decryptAttachment: no decryption required\n");
              o.status = STATUS_NOT_REQUIRED;
              resolve(o);
              return;
            }

          } while (exitCode != 0);


          Ec.DEBUG_LOG("enigmailConvert.jsm: decryptAttachment: decrypted to "+listener.stdoutData.length +" bytes\n");

          o.data = listener.stdoutData;
          o.status = STATUS_OK;

          // TODO: try to get real attachment name
          resolve(o);
        }
      );
    }
  );
};


/*
 * The following functions walk the MIME message structure and decrypt if they find something to decrypt
 */

// the sunny world of PGP/MIME

function walkMimeTree(promiseArray, hdr, mime, prefix, level, parent) {
  Ec.DEBUG_LOG("enigmailConvert.jsm: walkMimeTree: part="+prefix+"."+level+" - "+ mime.contentType+"\n");

  var partId = prefix+"."+level;
  if (isPgpMime(mime)) {
    var p = decryptPGPMIME(hdr, parent, partId.substr(3));
    promiseArray.push(p);
  }

  for (var i in mime.parts) {
    walkMimeTree(promiseArray, hdr, mime.parts[i], partId, Number(i)+1, mime);
  }
}


function isPgpMime(mime) {
  try {
    var ct = mime.contentType;
    if (!ct || ct == undefined) return false;

    var pt = getProtocol(mime.headers['content-type'].join(" "));
    if (!pt || pt == undefined) return false;

    if (ct.toLowerCase() == "multipart/encrypted" && pt == "application/pgp-encrypted") {
      return true;
    }
  }
  catch(ex) {
    Ec.DEBUG_LOG("enigmailConvert.jsm: walkMimeTree:"+ex+"\n");
  }
  return false;
}

function decryptPGPMIME(hdr, mime, part) {
  Ec.DEBUG_LOG("enigmailConvert.jsm: decryptPGPMIME: part="+part+"\n");

  return new Promise(
    function(resolve, reject) {
      var m = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);

      var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
      let msgSvc = messenger.messageServiceFromURI(hdr.folder.getUriForMsg(hdr));
      let u = {}
      msgSvc.GetUrlForUri(hdr.folder.getUriForMsg(hdr), u, null)
      let url = u.value.spec+'&part=' + part;

      let s = Ec.newStringStreamListener(
        function analyzeDecryptedData(data) {
          Ec.DEBUG_LOG("enigmailConvert.jsm: analyzeDecryptedData: got " + data.length +" bytes\n");

          let subpart = mime.parts[0];

          let o = {
            type: "mime",
            name: "",
            origName: "",
            data: "",
            status: STATUS_OK
          }


          let bodyIndex = data.search(/\n\s*\r?\n/);
          if (bodyIndex < 0) {
            bodyIndex = data.length;
          }
          else {
            ++bodyIndex;
          }

          if (data.substr(bodyIndex).search(/\r?\n$/) == 0) {
            o.status = STATUS_FAILURE;
            resolve(o);
            return;

          }
          m.initialize(data.substr(0, bodyIndex));
          let ct = m.extractHeader("content-type", false) || "";

          let boundary = getBoundary(mime.headers['content-type']);

          // append relevant headers
          mime.headers['content-type'] = "multipart/mixed; boundary=\""+boundary+"\"";

          o.data = "--"+boundary+"\n";
          o.data += "Content-Type: " + ct +"\n";

          let h = m.extractHeader("content-transfer-encoding", false);
          if (h) o.data += "content-transfer-encoding: "+ h +"\n";

          h = m.extractHeader("content-description", true);
          if (h) o.data += "content-description: "+ h+ "\n";

          o.data += data.substr(bodyIndex);
          if (subpart) {
            subpart.body = undefined;
            subpart.headers['content-type'] = ct;
          }

          resolve(o);
        }
      );

      var ioServ = Components.classes[Ec.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
      try {
        var channel = ioServ.newChannel(url, null, null);
        channel.asyncOpen(s, null);
      }
      catch(e) {
        Ec.DEBUG_LOG("enigmailConvert.jsm: decryptPGPMIME: exception " + e +"\n")
      }
    }
  );
}


//inline wonderland
function decryptINLINE(mime, subject) {

  if (typeof mime.body !== 'undefined') {
    var ct = getContentType(mime.headers['content-type']);

    if (ct == "text/html") {
      mime.body = stripHTMLFromArmoredBlocks(mime.body);
    }


    var enigmailSvc = Ec.getService();
    var passwdObj = {};
    var useAgentObj = {};
    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var userIdObj      = new Object();
    var sigDetailsObj  = new Object();
    var errorMsgObj = new Object();
    var keyIdObj    = new Object();
    var blockSeparationObj = { value: "" };
    var signatureObj = new Object();
    signatureObj.value = "";

    var uiFlags = nsIEnigmail.UI_INTERACTIVE | nsIEnigmail.UI_UNVERIFIED_ENC_OK;

    var plaintexts = [];
    var blocks = enigmailSvc.locateArmoredBlocks(mime.body);
    var tmp = [];

    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].blocktype == "MESSAGE") {
        tmp.push(blocks[i]);
      }
    }

    blocks = tmp;

    if (blocks.length < 1) {
      return 0;
    }


    for (var i = 0; i < blocks.length; i++) {
      let plaintext = null;
      do {
        let ciphertext = mime.body.substring(blocks[i].begin, blocks[i].end+1);

        if (ciphertext.length == 0) {
          break;
        }

        if (!Ec.getPassphrase(null, passwdObj, useAgentObj, 0)) {
          Ec.ERROR_LOG("enigmailConvert.jsm:  Error - no passphrase supplied\n");
          resolve(o);
          return -1;
        }

        plaintext = enigmailSvc.decryptMessage(null, uiFlags, ciphertext, signatureObj, exitCodeObj, statusFlagsObj,
                                                           keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj);
        if (!plaintext || plaintext.length == 0) {
          if (statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) {
            Ec.alert(null, errorMsgObj.value);
            return -1;
          }

          if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_FAILED) {
            if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
              Ec.clearCachedPassphrase();
            }

            if (enigmailSvc.useGpgAgent()) {
              // since we cannot find out via getPassphrase if the user wants to cancel
              // we should ask
              let msg = Ec.getString("converter.decryptBody.failed", subject);

              if (!Ec.confirmDlg(null, msg,
                  Ec.getString("dlg.button.retry"), Ec.getString("dlg.button.skip"))) {
                return -1;
              }
            }
          }
          else if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_INCOMPLETE) {
            return -1;
          }
        }

        if (ct == "text/html") {
          plaintext = plaintext.replace(/\n/ig,"<br/>\n");
        }

        if (plaintext) {
          plaintexts.push(plaintext);
        }
      } while (plaintext == null || plaintext == "");
    }



    var decryptedMessage = mime.body.substring(0, blocks[0].begin) + plaintexts[0];
    for (let i = 1; i < blocks.length; i++) {
      decryptedMessage +=  mime.body.substring(blocks[i-1].end+1, blocks[i].begin+1) + plaintexts[i];
    }

    decryptedMessage += mime.body.substring(blocks[(blocks.length-1)].end);

    mime.body = decryptedMessage;

    return 1;
  }



  if (typeof mime.parts !== 'undefined'  && mime.parts.length > 0) {
    var ret = 0;
    for (let part in mime.parts) {
      ret += decryptINLINE(mime.parts[part], subject);
    }

    return ret;
  }

  var ct = getContentType(mime.headers['content-type']);
  Ec.DEBUG_LOG("enigmailConvert.jsm: Decryption skipped:  "+ct+"\n");

  return 0;
}

function stripHTMLFromArmoredBlocks(text) {

  var index = 0;
  var begin = text.indexOf("-----BEGIN PGP");
  var end   = text.indexOf("-----END PGP");

  while(begin > -1 && end > -1) {
    let sub = text.substring(begin, end);

    sub = sub.replace(/(<([^>]+)>)/ig,"");
    sub = sub.replace(/&[A-z]+;/ig,"");

    text = text.substring(0, begin) + sub + text.substring(end);

    index = end + 10;
    begin = text.indexOf("-----BEGIN PGP", index);
    end = text.indexOf("-----END PGP", index);
  }

  return text;
}


/******
 *
 *    We have the technology we can rebuild.
 *
 *    Functions to reassemble the message from the MIME Tree
 *    into a String.
 *
 ******/

//Thunderbird 'fucks up' the header and removes \r\n<space>
function fixHeader(header) {
  header = header+""; //Trololol
  header = header.split(" ");
  var line = "";
  var lines = [];

  for(let i = 0; i < header.length; i++) {
    if(line.length + header[i].length >= 72) {
      lines.push(line+"\r\n");
      line = " "+header[i];
    }
    else {
      line +=  " " + header[i];
    }

  }

  lines.push(line);

  header = "";
  for(let i in lines) {
    header += lines[i];
  }

  return header;
}

function base64WithWidthCompliance(data) {
  var block = btoa(data).replace(/(.{72})/g, "$1\r\n");
  return block;
};

function getContentType(shdr) {
  try {
    shdr += "";
    return shdr.match(/([A-z-]+\/[A-z-]+)/)[1].toLowerCase();
  }
  catch (e) {
    Ec.DEBUG_LOG("enigmailConvert.jsm: getContentType: "+e+"\n");
    return null;
  }
};

function getBoundary(shdr) {
  try {
    shdr += "";
    return shdr.match(/boundary="?([A-z0-9'()+_,-.\/:=?]+)"?/)[1].toLowerCase();
  }
  catch (e) {
    Ec.DEBUG_LOG("enigmailConvert.jsm: getBoundary: "+e+"\n");
    return null;
  }
};

function getProtocol(shdr) {
  try {
    shdr += "";
    return shdr.match(/protocol="?([A-z0-9'()+_,-.\/:=?]+)"?/)[1].toLowerCase();
  }
  catch (e) {
    Ec.DEBUG_LOG("enigmailConvert.jsm: getProtocol: "+e+"\n");
    return "";
  }
}

function mimeToString(mime, attachments) {
  var ct = getContentType(mime.headers['content-type']);

  if (ct == null) {
    return null;
  }

  //text/*
  if ( ct.indexOf("text/") == 0) {
    return mimeToStringRec(mime, null);
  //multipart/*
  }
  else if (ct.indexOf("multipart/") == 0) {
    let msg = "";
    let boundary = getBoundary(mime.headers['content-type']);
    if(boundary == null) {
      Ec.DEBUG_LOG("enigmailConvert.jsm: Mutlipart with no boundary\n");
      return null;
    }

    if (typeof mime.parts !== 'undefined') {
      delete mime.parts[0].headers['content-type'];
    }


    msg =  mimeToStringRec(mime, boundary) + "\r\n";

    for (let i in attachments) {
      let a = attachments[i];
      if (a.type == "attachment") {
        msg +=  "\r\n--"+boundary+"\r\n";
        msg += "Content-Type: application/octet-stream; name=\""+a.name+"\"\r\n";
        msg += "Content-Transfer-Encoding: base64\r\n";
        msg += "Content-Disposition: attachment; filename\""+a.name+"\"\r\n\r\n";

        msg += base64WithWidthCompliance(a.data)+"\r\n";
      }
      else {
        msg += a.data;
      }

    }

    return msg + "--" + boundary +"--\r\n";



  }
  else {
    Ec.DEBUG_LOG("enigmailConvert.jsm: Unkown root content-type: "+ct+"\n");
  }


  return null;
};

function mimeToStringRec(mime, boundary) {
  var msg = "";
  var tmp = null;

  if (boundary != null) {

    tmp  = getBoundary(mime.headers['content-type']);
    if (tmp != null && tmp != boundary) {
      msg += "\r\n--" + boundary + "\r\n";
      boundary = tmp;
    }
  }

  if (typeof mime.body !== 'undefined') {

    if (boundary) {
      msg += "\r\n--"+ boundary + "\r\n";
    }

    for (let header in mime.headers) {
      msg += header + ":"+fixHeader(mime.headers[header])+"\r\n";
    }

    msg +=  "\r\n"+mime.body+"\r\n";

    return msg;
  }

  if (typeof mime.parts !== 'undefined'  && mime.parts.length > 0) {
    for (let header in mime.headers) {
      msg += header + ":"+fixHeader(mime.headers[header])+"\r\n";
    }

    for (let part in mime.parts) {
      msg += mimeToStringRec(mime.parts[part], boundary);
    }

    return msg;
  }

  var ct = getContentType(mime.headers['content-type']);
  Ec.DEBUG_LOG("enigmailConvert.jsm:  Serialization skipped: "+ct+"\n");

  return "";
};
