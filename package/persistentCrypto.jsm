/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailPersistentCrypto"];

const EnigmailLazy = ChromeUtils.import("chrome://enigmail/content/modules/lazy.jsm").EnigmailLazy;
const AddonManager = ChromeUtils.import("resource://gre/modules/AddonManager.jsm").AddonManager;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailArmor = ChromeUtils.import("chrome://enigmail/content/modules/armor.jsm").EnigmailArmor;
const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailExecution = ChromeUtils.import("chrome://enigmail/content/modules/execution.jsm").EnigmailExecution;
const GlodaUtils = ChromeUtils.import("chrome://enigmail/content/modules/glodaUtils.jsm").GlodaUtils;
const EnigmailTb60Compat = ChromeUtils.import("chrome://enigmail/content/modules/tb60compat.jsm").EnigmailTb60Compat;
const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailGpg = ChromeUtils.import("chrome://enigmail/content/modules/gpg.jsm").EnigmailGpg;
const EnigmailStreams = ChromeUtils.import("chrome://enigmail/content/modules/streams.jsm").EnigmailStreams;
const EnigmailPassword = ChromeUtils.import("chrome://enigmail/content/modules/passwords.jsm").EnigmailPassword;
const EnigmailMime = ChromeUtils.import("chrome://enigmail/content/modules/mime.jsm").EnigmailMime;
const EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
const EnigmailAttachment = ChromeUtils.import("chrome://enigmail/content/modules/attachment.jsm").EnigmailAttachment;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;
const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const EnigmailStdlib = ChromeUtils.import("chrome://enigmail/content/modules/stdlib.jsm").EnigmailStdlib;
const EnigmailEncryption = ChromeUtils.import("chrome://enigmail/content/modules/encryption.jsm").EnigmailEncryption;
const NetUtil = ChromeUtils.import("resource://gre/modules/NetUtil.jsm").NetUtil;

const {
  MimeBody,
  MimeUnknown,
  MimeMessageAttachment,
  MsgHdrToMimeMessage,
  MimeMessage,
  MimeContainer
} = ChromeUtils.import("resource:///modules/gloda/mimemsg.js");

const getGpgAgent = EnigmailLazy.loader("enigmail/gpgAgent.jsm", "EnigmailGpgAgent");
const getDecryption = EnigmailLazy.loader("enigmail/decryption.jsm", "EnigmailDecryption");
const getDialog = EnigmailLazy.loader("enigmail/dialog.jsm", "EnigmailDialog");

const STATUS_OK = 0;
const STATUS_FAILURE = 1;
const STATUS_NOT_REQUIRED = 2;

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

/*
 *  Decrypt a message and copy it to a folder
 *
 * @param nsIMsgDBHdr hdr   Header of the message
 * @param String destFolder   Folder URI
 * @param Boolean move      If true the original message will be deleted
 *
 * @return a Promise that we do that
 */
var EnigmailPersistentCrypto = {

  /***
   *  dispatchMessages
   *
   *  Because Thunderbird throws all messages at once at us thus we have to rate limit the dispatching
   *  of the message processing. Because there is only a negligible performance gain when dispatching
   *  several message at once we serialize to not overwhelm low power devices.
   *
   *  If targetFolder is null the message will be copied / moved in the same folder as the original
   *  message.
   *
   *  If targetKey is not null the message will be encrypted again to the targetKey.
   *
   *  The function is implemented asynchronously.
   *
   *  Parameters
   *   aMsgHdrs:     Array of nsIMsgDBHdr
   *   targetFolder: String; target folder URI or null
   *   copyListener: listener for async request (nsIMsgCopyServiceListener)
   *   move:         Boolean: type of action; true = "move" / false = "copy"
   *   targetKey:    KeyObject of target key if encryption is requested
   *
   **/

  dispatchMessages: function(aMsgHdrs, targetFolder, copyListener, move, targetKey) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: dispatchMessages()\n");

    if (copyListener) {
      copyListener.OnStartCopy();
    }
    let promise = EnigmailPersistentCrypto.cryptMessage(aMsgHdrs[0], targetFolder, move, targetKey);

    var processNext = function(data) {
      aMsgHdrs.splice(0, 1);
      if (aMsgHdrs.length > 0) {
        EnigmailPersistentCrypto.dispatchMessages(aMsgHdrs, targetFolder, copyListener, move, targetKey);
      } else {
        // last message was finished processing
        if (copyListener) {
          copyListener.OnStopCopy(0);
        }
        EnigmailLog.DEBUG("persistentCrypto.jsm: dispatchMessages - DONE\n");
      }
    };

    promise.then(processNext);

    promise.catch(function(err) {
      processNext(null);
    });
  },

  /***
   *  cryptMessage
   *
   *  Decrypts a message. If targetKey is not null it
   *  encrypts a message to the target key afterwards.
   *
   *  Parameters
   *   hdr:        nsIMsgDBHdr of the message to encrypt
   *   destFolder: String; target folder URI
   *   move:       Boolean: type of action; true = "move" / false = "copy"
   *   targetKey:  KeyObject of target key if encryption is requested
   **/
  cryptMessage: function(hdr, destFolder, move, targetKey) {
    return new Promise(
      function(resolve, reject) {
        let msgUriSpec = hdr.folder.getUriForMsg(hdr);

        const msgSvc = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger).messageServiceFromURI(msgUriSpec);

        const crypt = new CryptMessageIntoFolder(destFolder, move, resolve, targetKey);

        try {
          MsgHdrToMimeMessage(hdr, crypt, crypt.messageParseCallback, true, {
            examineEncryptedParts: false,
            partsOnDemand: false
          });
        } catch (ex) {
          reject("msgHdrsDeleteoMimeMessage failed");
        }
        return;
      }
    );
  }
};

function CryptMessageIntoFolder(destFolder, move, resolve, targetKey) {
  this.destFolder = destFolder;
  this.move = move;
  this.resolve = resolve;
  this.targetKey = targetKey;

  this.foundPGP = 0;
  this.mime = null;
  this.hdr = null;
  this.decryptionTasks = [];
  this.subject = "";
}

CryptMessageIntoFolder.prototype = {
  messageParseCallback: function(hdr, mime) {
    this.hdr = hdr;
    this.mime = mime;
    var self = this;

    try {
      if (!mime) {
        this.resolve(true);
        return;
      }

      if (!("content-type" in mime.headers)) {
        mime.headers["content-type"] = ["text/plain"];
      }

      var ct = getContentType(getHeaderValue(mime, 'content-type'));
      var pt = getProtocol(getHeaderValue(mime, 'content-type'));

      this.subject = GlodaUtils.deMime(getHeaderValue(mime, 'subject'));

      if (!ct) {
        this.resolve(true);
        return;
      }


      this.walkMimeTree(this.mime, this.mime);

      this.decryptINLINE(this.mime);
      if (this.foundPGP < 0) {
        // decryption failed
        this.resolve(true);
        return;
      }


      for (let i in this.mime.allAttachments) {
        let a = this.mime.allAttachments[i];
        let suffixIndexEnd = a.name.toLowerCase().lastIndexOf('.pgp');
        if (suffixIndexEnd < 0) {
          suffixIndexEnd = a.name.toLowerCase().lastIndexOf('.asc');
        }

        if (suffixIndexEnd > 0 &&
          a.contentType.search(/application\/pgp-signature/i) < 0) {

          // possible OpenPGP attachment
          let p = self.decryptAttachment(a, a.name.substring(0, suffixIndexEnd));
          this.decryptionTasks.push(p);
        } else {
          let p = this.readAttachment(a);
          this.decryptionTasks.push(p);
        }
      }

      Promise.all(this.decryptionTasks).then(
        function(tasks) {
          self.allTasks = tasks;
          for (let a in tasks) {
            switch (tasks[a].status) {
              case STATUS_NOT_REQUIRED:
                tasks[a].name = tasks[a].origName;
                break;
              case STATUS_OK:
                ++self.foundPGP;
                break;
              case STATUS_FAILURE:
                // attachment did not decrypt successfully
                self.resolve(true);
                return;
              default:
                // no valid result?!
                tasks[a].name = tasks[a].origName;
            }
          }

          if (self.foundPGP === 0 && !self.targetKey) {
            self.resolve(true);
            return;
          }

          // No dest folder. Let's use the same folder.
          if (!self.destFolder) {
            // We need to use the URI and not the folderURL folderURL
            // would work for IMAP but fail for Local Folders.
            self.destFolder = hdr.folder.URI;
          }

          let rfc822Headers;
          if (self.targetKey) {
            // If we encrypt we don't want to include all headers
            // int the encrypted message. So we only pass
            // content headers and store the rest.
            rfc822Headers = mime.headers;
            var contentHeaders = [];

            contentHeaders["content-type"] = getHeaderValue(self.mime, 'content-type');
            contentHeaders["content-transfer-encoding"] = getHeaderValue(self.mime, 'content-transfer-encoding');
            contentHeaders["content-disposition"] = getHeaderValue(self.mime, 'content-disposition');
            self.mime.headers = contentHeaders;
          }

          // Build the new message
          let msg = "";
          if (self.foundPGP) {
            // A decrypted message
            msg = self.mimeToString(self.mime, true);
          } else {
            // Not found pgp. Copy the msg for encryption
            // we avoid mimeToString as mimeToString is not
            // really a direct conversion but has awareness of
            // crypto tasks and will not work properly for messages
            // that are not encrypted.
            EnigmailLog.DEBUG("persistentCrypto.jsm: did not find encryption. Using original.\n");
            var folder = hdr.folder;
            var stream = folder.getMsgInputStream(hdr, {});

            var messageSize = folder.hasMsgOffline(hdr.messageKey) ? hdr.offlineMessageSize : hdr.messageSize;
            var scriptInput = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance();
            try {
              msg = NetUtil.readInputStreamToString(stream, messageSize);
            } catch (ex) {
              EnigmailLog.DEBUG("persistentCrypto.jsm: failed to get plain data: " + ex + "\n");
              // Uhm,.. What to do? Ok let's give mimeToString a chance.
              msg = self.mimeToString(self.mime, true);
            }
            stream.close();
          }

          if (!msg || msg === "") {
            // no message data found
            self.resolve(true);
            return;
          }

          // Encrypt the message if a target key is given.
          if (self.targetKey) {
            msg = self.encryptToKey(rfc822Headers, msg);
            if (!msg) {
              // do nothing (still better than destroying the message)
              self.resolve(true);
              return;
            }
          }

          //XXX Do we wanna use the tmp for this?
          var tempFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
          tempFile.append("message.eml");
          tempFile.createUnique(0, 0o600);

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
          var fileSpec = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
          fileSpec.initWithPath(tempFile.path);

          const copySvc = Cc["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService);

          var copyListener = {
            QueryInterface: function(iid) {
              if (iid.equals(Ci.nsIMsgCopyServiceListener) || iid.equals(Ci.nsISupports)) {
                return this;
              }
              EnigmailLog.DEBUG("persistentCrypto.jsm: copyListener error\n");
              throw Components.results.NS_NOINTERFACE;
            },
            GetMessageId: function(messageId) {},
            OnProgress: function(progress, progressMax) {},
            OnStartCopy: function() {
              EnigmailLog.DEBUG("persistentCrypto.jsm: copyListener: OnStartCopy()\n");
            },
            SetMessageKey: function(key) {
              EnigmailLog.DEBUG("persistentCrypto.jsm: copyListener: SetMessageKey(" + key + ")\n");
            },
            OnStopCopy: function(statusCode) {
              EnigmailLog.DEBUG("persistentCrypto.jsm: copyListener: OnStopCopy()\n");
              if (statusCode !== 0) {
                EnigmailLog.DEBUG("persistentCrypto.jsm: Error copying message: " + statusCode + "\n");
                try {
                  tempFile.remove(false);
                } catch (ex) {
                  try {
                    fileSpec.remove(false);
                  } catch (e2) {
                    EnigmailLog.DEBUG("persistentCrypto.jsm: Could not delete temp file\n");
                  }
                }
                self.resolve(true);
                return;
              }
              EnigmailLog.DEBUG("persistentCrypto.jsm: Copy complete\n");

              if (self.move) {
                deleteOriginalMail(self.hdr);
              }

              try {
                tempFile.remove(false);
              } catch (ex) {
                try {
                  fileSpec.remove(false);
                } catch (e2) {
                  EnigmailLog.DEBUG("persistentCrypto.jsm: Could not delete temp file\n");
                }
              }

              EnigmailLog.DEBUG("persistentCrypto.jsm: Cave Johnson. We're done\n");
              self.resolve(true);
            }
          };

          EnigmailLog.DEBUG("persistentCrypto.jsm: copySvc ready for copy\n");
          try {
            if (self.mime.headers.subject) {
              self.hdr.subject = self.mime.headers.subject.join();
            }
          } catch (ex) {}

          copySvc.CopyFileMessage(fileSpec, EnigmailTb60Compat.getExistingFolder(self.destFolder), self.hdr,
            false, 0, "", copyListener, null);
        }
      ).catch(
        function catchErr(errorMsg) {
          EnigmailLog.DEBUG("persistentCrypto.jsm: Promise.catchErr: " + errorMsg + "\n");
          self.resolve(false);
        }
      );
    } catch (ex) {
      EnigmailLog.DEBUG("persistentCrypto.jsm: messageParseCallback: caught error " + ex.toString() + "\n");
      self.resolve(false);
    }
  },

  encryptToKey: function(rfc822Headers, inputMsg) {
    let exitCodeObj = {};
    let statusFlagsObj = {};
    let errorMsgObj = {};
    EnigmailLog.DEBUG("persistentCrypto.jsm: Encrypting message.\n");

    let encmsg = "";
    try {
      encmsg = EnigmailEncryption.encryptMessage(null,
        0,
        inputMsg,
        "0x" + this.targetKey.fpr,
        "0x" + this.targetKey.fpr,
        "",
        EnigmailConstants.SEND_ENCRYPTED | EnigmailConstants.SEND_ALWAYS_TRUST,
        exitCodeObj,
        statusFlagsObj,
        errorMsgObj
      );
    } catch (ex) {
      EnigmailLog.DEBUG("persistentCrypto.jsm: Encryption failed: " + ex + "\n");
      return null;
    }

    // Build the pgp-encrypted mime structure
    let msg = "";

    // First the original headers
    for (let header in rfc822Headers) {
      if (header != "content-type" &&
        header != "content-transfer-encoding" &&
        header != "content-disposition") {
        msg += prettyPrintHeader(header, rfc822Headers[header]) + "\n";
      }
    }
    // Then multipart/encrypted ct
    let boundary = EnigmailMime.createBoundary();
    msg += "Content-Transfer-Encoding: 7Bit\n";
    msg += "Content-Type: multipart/encrypted; ";
    msg += "boundary=\"" + boundary + "\"; protocol=\"application/pgp-encrypted\"\n\n";
    msg += "This is an OpenPGP/MIME encrypted message (RFC 4880 and 3156)\n";

    // pgp-encrypted part
    msg += "--" + boundary + "\n";
    msg += "Content-Type: application/pgp-encrypted\n";
    msg += "Content-Disposition: attachment\n";
    msg += "Content-Transfer-Encoding: 7Bit\n\n";
    msg += "Version: 1\n\n";

    // the octet stream
    msg += "--" + boundary + "\n";
    msg += "Content-Type: application/octet-stream; name=\"encrypted.asc\"\n";
    msg += "Content-Description: OpenPGP encrypted message\n";
    msg += "Content-Disposition: inline; filename=\"encrypted.asc\"\n";
    msg += "Content-Transfer-Encoding: 7Bit\n\n";
    msg += encmsg;

    // Bottom boundary
    msg += "\n--" + boundary + "--\n";

    // Fix up the line endings to be a proper dosish mail
    msg = msg.replace(/\r/ig, "").replace(/\n/ig, "\r\n");

    return msg;
  },

  readAttachment: function(attachment, strippedName) {
    return new Promise(
      function(resolve, reject) {
        EnigmailLog.DEBUG("persistentCrypto.jsm: readAttachment\n");
        let o;
        var f = function _cb(data) {
          EnigmailLog.DEBUG("persistentCrypto.jsm: readAttachment - got data (" + data.length + ")\n");
          o = {
            type: "attachment",
            data: data,
            name: strippedName ? strippedName : attachment.name,
            partName: attachment.partName,
            origName: attachment.name,
            status: STATUS_NOT_REQUIRED
          };
          resolve(o);
        };

        try {
          var bufferListener = EnigmailStreams.newStringStreamListener(f);
          var ioServ = Cc[IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
          var msgUri = ioServ.newURI(attachment.url, null, null);

          var channel = EnigmailStreams.createChannel(msgUri);
          channel.asyncOpen(bufferListener, msgUri);
        } catch (ex) {
          reject(o);
        }
      }
    );
  },

  decryptAttachment: function(attachment, strippedName) {
    var self = this;

    return new Promise(
      function(resolve, reject) {
        EnigmailLog.DEBUG("persistentCrypto.jsm: decryptAttachment\n");
        self.readAttachment(attachment, strippedName).then(
          function(o) {
            var attachmentHead = o.data.substr(0, 30);
            if (attachmentHead.match(/-----BEGIN PGP \w{5,10} KEY BLOCK-----/)) {
              // attachment appears to be a PGP key file, we just go-a-head
              resolve(o);
              return;
            }
            var enigmailSvc = EnigmailCore.getService();
            var args = EnigmailGpg.getStandardArgs(true);
            args = args.concat(EnigmailPassword.command());
            args.push("-d");

            var statusMsgObj = {};
            var cmdLineObj = {};
            var exitCode = -1;
            var statusFlagsObj = {};
            var errorMsgObj = {};
            statusFlagsObj.value = 0;

            var listener = EnigmailExecution.newSimpleListener(
              function _stdin(pipe) {

                // try to get original file name if file does not contain suffix
                if (strippedName.indexOf(".") < 0) {
                  let s = EnigmailAttachment.getFileName(null, o.data);
                  if (s)
                    o.name = s;
                }

                pipe.write(o.data);
                pipe.close();

              }
            );

            do {
              var proc = EnigmailExecution.execStart(getGpgAgent().agentPath, args, false, null, listener, statusFlagsObj);
              if (!proc) {
                resolve(o);
                return;
              }
              // Wait for child STDOUT to close
              proc.wait();
              EnigmailExecution.execEnd(listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);

              if ((listener.stdoutData && listener.stdoutData.length > 0) ||
                (statusFlagsObj.value & EnigmailConstants.DECRYPTION_OKAY)) {
                EnigmailLog.DEBUG("persistentCrypto.jsm: decryptAttachment: decryption OK\n");
                exitCode = 0;
              } else if (statusFlagsObj.value & (EnigmailConstants.DECRYPTION_FAILED | EnigmailConstants.MISSING_MDC)) {
                EnigmailLog.DEBUG("persistentCrypto.jsm: decryptAttachment: decryption without MDC protection\n");
                exitCode = 0;
              } else if (statusFlagsObj.value & EnigmailConstants.DECRYPTION_FAILED) {
                EnigmailLog.DEBUG("persistentCrypto.jsm: decryptAttachment: decryption failed\n");
                // since we cannot find out if the user wants to cancel
                // we should ask
                let msg = EnigmailLocale.getString("converter.decryptAtt.failed", [attachment.name, self.subject]);

                if (!getDialog().confirmDlg(null, msg,
                    EnigmailLocale.getString("dlg.button.retry"), EnigmailLocale.getString("dlg.button.skip"))) {
                  o.status = STATUS_FAILURE;
                  resolve(o);
                  return;
                }
              } else if (statusFlagsObj.value & EnigmailConstants.DECRYPTION_INCOMPLETE) {
                // failure; message not complete
                EnigmailLog.DEBUG("persistentCrypto.jsm: decryptAttachment: decryption incomplete\n");
                o.status = STATUS_FAILURE;
                resolve(o);
                return;
              } else {
                // there is nothing to be decrypted
                EnigmailLog.DEBUG("persistentCrypto.jsm: decryptAttachment: no decryption required\n");
                o.status = STATUS_NOT_REQUIRED;
                resolve(o);
                return;
              }

            } while (exitCode !== 0);


            EnigmailLog.DEBUG("persistentCrypto.jsm: decryptAttachment: decrypted to " + listener.stdoutData.length + " bytes\n");

            o.data = listener.stdoutData;
            o.status = STATUS_OK;

            resolve(o);
          }
        );
      }
    );
  },


  /*
   * The following functions walk the MIME message structure and decrypt if they find something to decrypt
   */

  // the sunny world of PGP/MIME

  walkMimeTree: function(mime, parent) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: walkMimeTree:\n");
    let ct = getContentType(getHeaderValue(mime, 'content-type'));

    EnigmailLog.DEBUG("persistentCrypto.jsm: walkMimeTree: part=" + mime.partName + " - " + ct + "\n");

    // assign part name on lowest possible level -> that's where the attachment
    // really belongs to
    for (let i in mime.allAttachments) {
      mime.allAttachments[i].partName = mime.partName;
    }
    if (this.isPgpMime(mime) || this.isSMime(mime)) {
      let p = this.decryptPGPMIME(parent, mime.partName);
      this.decryptionTasks.push(p);
    } else if (this.isBrokenByExchange(mime)) {
      let p = this.decryptAttachment(mime.parts[0].parts[2], "decrypted.txt");
      mime.isBrokenByExchange = true;
      mime.parts[0].parts[2].name = "ignore.txt";
      this.decryptionTasks.push(p);
    } else if (typeof(mime.body) == "string") {
      EnigmailLog.DEBUG("    body size: " + mime.body.length + "\n");
    }

    for (var i in mime.parts) {
      this.walkMimeTree(mime.parts[i], mime);
    }
  },

  /***
   *
   * Detect if mime part is PGP/MIME message that got modified by MS-Exchange:
   *
   * - multipart/mixed Container with
   *   - application/pgp-encrypted Attachment with name "PGPMIME Version Identification"
   *   - application/octet-stream Attachment with name "encrypted.asc" having the encrypted content in base64
   * - see:
   *   - https://www.enigmail.net/forum/viewtopic.php?f=4&t=425
   *  - https://sourceforge.net/p/enigmail/forum/support/thread/4add2b69/
   */

  isBrokenByExchange: function(mime) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: isBrokenByExchange:\n");

    try {
      if (mime.parts && mime.parts.length && mime.parts.length == 1 &&
        mime.parts[0].parts && mime.parts[0].parts.length && mime.parts[0].parts.length == 3 &&
        mime.parts[0].headers["content-type"][0].indexOf("multipart/mixed") >= 0 &&
        mime.parts[0].parts[0].size === 0 &&
        mime.parts[0].parts[0].headers["content-type"][0].search(/multipart\/encrypted/i) < 0 &&
        mime.parts[0].parts[0].headers["content-type"][0].indexOf("text/plain") >= 0 &&
        mime.parts[0].parts[1].headers["content-type"][0].indexOf("application/pgp-encrypted") >= 0 &&
        mime.parts[0].parts[1].headers["content-type"][0].search(/multipart\/encrypted/i) < 0 &&
        mime.parts[0].parts[1].headers["content-type"][0].search(/PGPMIME Versions? Identification/i) >= 0 &&
        mime.parts[0].parts[2].headers["content-type"][0].indexOf("application/octet-stream") >= 0 &&
        mime.parts[0].parts[2].headers["content-type"][0].indexOf("encrypted.asc") >= 0) {

        EnigmailLog.DEBUG("persistentCrypto.jsm: isBrokenByExchange: found message broken by MS-Exchange\n");
        return true;
      }
    } catch (ex) {}

    return false;
  },

  isPgpMime: function(mime) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: isPgpMime:\n");
    try {
      var ct = mime.contentType;
      if (!ct) return false;
      if (!('content-type' in mime.headers)) return false;

      var pt = getProtocol(getHeaderValue(mime, 'content-type'));
      if (!pt) return false;

      if (ct.toLowerCase() == "multipart/encrypted" && pt == "application/pgp-encrypted") {
        return true;
      }
    } catch (ex) {
      //EnigmailLog.DEBUG("persistentCrypto.jsm: isPgpMime:"+ex+"\n");
    }
    return false;
  },

  // smime-type=enveloped-data
  isSMime: function(mime) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: isSMime:\n");
    try {
      var ct = mime.contentType;
      if (!ct) return false;
      if (!('content-type' in mime.headers)) return false;

      var pt = getSMimeProtocol(getHeaderValue(mime, 'content-type'));
      if (!pt) return false;

      if (ct.toLowerCase() == "application/pkcs7-mime" && pt == "enveloped-data") {
        return true;
      }
    } catch (ex) {
      EnigmailLog.DEBUG("persistentCrypto.jsm: isSMime:" + ex + "\n");
    }
    return false;
  },

  decryptPGPMIME: function(mime, part) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: decryptPGPMIME: part=" + part + "\n");

    var self = this;

    return new Promise(
      function(resolve, reject) {
        var m = Cc["@mozilla.org/messenger/mimeheaders;1"].createInstance(Ci.nsIMimeHeaders);

        var messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
        let msgSvc = messenger.messageServiceFromURI(self.hdr.folder.getUriForMsg(self.hdr));
        let u = {};
        msgSvc.GetUrlForUri(self.hdr.folder.getUriForMsg(self.hdr), u, null);

        let op = (u.value.spec.indexOf("?") > 0 ? "&" : "?");
        let url = u.value.spec + op + 'part=' + part + "&header=enigmailConvert";

        EnigmailLog.DEBUG("persistentCrypto.jsm: getting data from URL " + url + "\n");

        let s = EnigmailStreams.newStringStreamListener(
          function analyzeDecryptedData(data) {
            EnigmailLog.DEBUG("persistentCrypto.jsm: analyzeDecryptedData: got " + data.length + " bytes\n");

            if (EnigmailLog.getLogLevel() > 5) {
              EnigmailLog.DEBUG("*** start data ***\n'" + data + "'\n***end data***\n");
            }


            let subpart = mime.parts[0];

            let o = {
              type: "mime",
              name: "",
              origName: "",
              data: "",
              partName: part,
              status: STATUS_OK
            };

            if (data.length === 0) {
              // fail if no data found
              o.status = STATUS_FAILURE;
              resolve(o);
              return;
            }

            let bodyIndex = data.search(/\n\s*\r?\n/);
            if (bodyIndex < 0) {
              bodyIndex = 0;
            } else {
              ++bodyIndex;
            }

            if (data.substr(bodyIndex).search(/\r?\n$/) === 0) {
              o.status = STATUS_FAILURE;
              resolve(o);
              return;

            }
            m.initialize(data.substr(0, bodyIndex));
            let ct = m.extractHeader("content-type", false) || "";

            if (part.length > 0 && part.search(/[^01.]/) < 0) {
              if (ct.search(/protected-headers/i) >= 0) {
                if (m.hasHeader("subject")) {
                  let subject = m.extractHeader("subject", false) || "";
                  self.mime.headers.subject = [subject];
                }
              } else if (self.mime.headers.subject.join("") === "p≡p") {
                let subject = getPepSubject(data);
                if (subject) {
                  self.mime.headers.subject = [subject];
                }
              }
            }

            let boundary = getBoundary(getHeaderValue(mime, 'content-type'));
            if (!boundary)
              boundary = EnigmailMime.createBoundary();

            // append relevant headers
            mime.headers['content-type'] = "multipart/mixed; boundary=\"" + boundary + "\"";

            o.data = "--" + boundary + "\r\n";
            o.data += "Content-Type: " + ct + "\r\n";

            let h = m.headerNames;
            while (h.hasMore()) {
              let hdr = h.getNext();
              if (hdr.search(/^content-type$/i) < 0) {
                try {
                  EnigmailLog.DEBUG("persistentCrypto.jsm: getUnstructuredHeader: hdr=" + hdr + "\n");
                  let hdrVal = m.getUnstructuredHeader(hdr.toLowerCase());
                  o.data += hdr + ": " + hdrVal + "\r\n";
                } catch (ex) {
                  try {
                    let hdrVal = m.getRawHeader(hdr.toLowerCase());
                    o.data += hdr + ": " + hdrVal + "\r\n";
                  } catch (ex) {
                    EnigmailLog.DEBUG("persistentCrypto.jsm: getUnstructuredHeader: exception " + ex.toString() + "\n");
                  }
                }
              }
            }

            EnigmailLog.DEBUG("persistentCrypto.jsm: getUnstructuredHeader: done\n");

            o.data += data.substr(bodyIndex);
            if (subpart) {
              subpart.body = undefined;
              subpart.headers['content-type'] = ct;
            }

            resolve(o);
          }
        );

        try {
          var channel = EnigmailStreams.createChannel(url);
          channel.asyncOpen(s, null);
        } catch (e) {
          EnigmailLog.DEBUG("persistentCrypto.jsm: decryptPGPMIME: exception " + e.toString() + "\n");
        }
      }
    );
  },

  //inline wonderland
  decryptINLINE: function(mime) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: decryptINLINE:\n");
    if (typeof mime.body !== 'undefined') {
      let ct = getContentType(getHeaderValue(mime, 'content-type'));

      if (ct == "text/html") {
        mime.body = this.stripHTMLFromArmoredBlocks(mime.body);
      }

      var exitCodeObj = {};
      var statusFlagsObj = {};
      var userIdObj = {};
      var sigDetailsObj = {};
      var errorMsgObj = {};
      var keyIdObj = {};
      var blockSeparationObj = {
        value: ""
      };
      var encToDetailsObj = {};
      var signatureObj = {};
      signatureObj.value = "";

      const uiFlags = EnigmailConstants.UI_INTERACTIVE | EnigmailConstants.UI_UNVERIFIED_ENC_OK |
        EnigmailConstants.UI_IGNORE_MDC_ERROR;

      var plaintexts = [];
      var blocks = EnigmailArmor.locateArmoredBlocks(mime.body);
      var tmp = [];

      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].blocktype == "MESSAGE") {
          tmp.push(blocks[i]);
        }
      }

      blocks = tmp;

      if (blocks.length < 1) {
        return 0;
      }

      let charset = "utf-8";

      for (let i = 0; i < blocks.length; i++) {
        let plaintext = null;
        do {
          let ciphertext = mime.body.substring(blocks[i].begin, blocks[i].end + 1);

          if (ciphertext.length === 0) {
            break;
          }

          let hdr = ciphertext.search(/(\r\r|\n\n|\r\n\r\n)/);
          if (hdr > 0) {
            let chset = ciphertext.substr(0, hdr).match(/^(charset:)(.*)$/mi);
            if (chset && chset.length == 3) {
              charset = chset[2].trim();
            }
          }
          plaintext = getDecryption().decryptMessage(null, uiFlags, ciphertext, signatureObj, exitCodeObj, statusFlagsObj,
            keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj, encToDetailsObj);
          if (!plaintext || plaintext.length === 0) {
            if (statusFlagsObj.value & EnigmailConstants.DISPLAY_MESSAGE) {
              getDialog().alert(null, errorMsgObj.value);
              this.foundPGP = -1;
              return -1;
            }

            if (statusFlagsObj.value & (EnigmailConstants.DECRYPTION_FAILED | EnigmailConstants.MISSING_MDC)) {
              EnigmailLog.DEBUG("persistentCrypto.jsm: decryptINLINE: no MDC protection, decrypting anyway\n");
            }
            if (statusFlagsObj.value & EnigmailConstants.DECRYPTION_FAILED) {
              // since we cannot find out if the user wants to cancel
              // we should ask
              let msg = EnigmailLocale.getString("converter.decryptBody.failed", this.subject);

              if (!getDialog().confirmDlg(null, msg,
                  EnigmailLocale.getString("dlg.button.retry"), EnigmailLocale.getString("dlg.button.skip"))) {
                this.foundPGP = -1;
                return -1;
              }
            } else if (statusFlagsObj.value & EnigmailConstants.DECRYPTION_INCOMPLETE) {
              this.foundPGP = -1;
              return -1;
            }
          }

          if (ct == "text/html") {
            plaintext = plaintext.replace(/\n/ig, "<br/>\n");
          }

          if (i == 0 && this.mime.headers.subject && this.mime.headers.subject[0] === "pEp" &&
            mime.partName.length > 0 && mime.partName.search(/[^01.]/) < 0) {

            let m = EnigmailMime.extractSubjectFromBody(plaintext);
            if (m) {
              plaintext = m.messageBody;
              this.mime.headers.subject = [m.subject];
            }
          }

          if (plaintext) {
            plaintexts.push(plaintext);
          }
        } while (!plaintext || plaintext === "");
      }



      var decryptedMessage = mime.body.substring(0, blocks[0].begin) + plaintexts[0];
      for (let i = 1; i < blocks.length; i++) {
        decryptedMessage += mime.body.substring(blocks[i - 1].end + 1, blocks[i].begin + 1) + plaintexts[i];
      }

      decryptedMessage += mime.body.substring(blocks[(blocks.length - 1)].end + 1);

      // enable base64 encoding if non-ASCII character(s) found
      let j = decryptedMessage.search(/[^\x01-\x7F]/); // eslint-disable-line no-control-regex
      if (j >= 0) {
        mime.headers['content-transfer-encoding'] = ['base64'];
        mime.body = EnigmailData.encodeBase64(decryptedMessage);
      } else {
        mime.body = decryptedMessage;
        mime.headers['content-transfer-encoding'] = ['8bit'];
      }

      let origCharset = getCharset(getHeaderValue(mime, 'content-type'));
      if (origCharset) {
        mime.headers['content-type'] = getHeaderValue(mime, 'content-type').replace(origCharset, charset);
      } else {
        mime.headers['content-type'] = getHeaderValue(mime, 'content-type') + "; charset=" + charset;
      }

      this.foundPGP = 1;
      return 1;
    }



    if (typeof mime.parts !== 'undefined' && mime.parts.length > 0) {
      var ret = 0;
      for (let part in mime.parts) {
        ret += this.decryptINLINE(mime.parts[part]);
      }

      return ret;
    }

    let ct = getContentType(getHeaderValue(mime, 'content-type'));
    EnigmailLog.DEBUG("persistentCrypto.jsm: Decryption skipped:  " + ct + "\n");

    return 0;
  },

  stripHTMLFromArmoredBlocks: function(text) {

    var index = 0;
    var begin = text.indexOf("-----BEGIN PGP");
    var end = text.indexOf("-----END PGP");

    while (begin > -1 && end > -1) {
      let sub = text.substring(begin, end);

      sub = sub.replace(/(<([^>]+)>)/ig, "");
      sub = sub.replace(/&[A-z]+;/ig, "");

      text = text.substring(0, begin) + sub + text.substring(end);

      index = end + 10;
      begin = text.indexOf("-----BEGIN PGP", index);
      end = text.indexOf("-----END PGP", index);
    }

    return text;
  },


  /******
   *
   *    We have the technology we can rebuild.
   *
   *    Function to reassemble the message from the MIME Tree
   *    into a String.
   *
   ******/

  mimeToString: function(mime, topLevel) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: mimeToString: part: '" + mime.partName + "', is of type '" + typeof(mime) + "'\n");

    let ct = getContentType(getHeaderValue(mime, 'content-type'));

    if (!ct) {
      return "";
    }

    let boundary = getBoundary(getHeaderValue(mime, 'content-type'));

    let msg = "";

    if (mime.isBrokenByExchange) {
      EnigmailLog.DEBUG("persistentCrypto.jsm: mimeToString: MS-Exchange fix\n");
      for (let j in this.allTasks) {
        if (this.allTasks[j].partName == mime.parts[0].partName) {

          boundary = EnigmailMime.createBoundary();

          msg += getRfc822Headers(mime.headers, ct, "content-type");
          msg += 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n';

          msg += "This is a multi-part message in MIME format.";
          msg += "\r\n--" + boundary + "\r\n";
          msg += this.allTasks[j].data;
          msg += "\r\n--" + boundary + "--\r\n";

          return msg;
        }
      }
    } else if (mime instanceof MimeMessageAttachment) {
      for (let j in this.allTasks) {
        if (this.allTasks[j].partName == mime.partName &&
          this.allTasks[j].origName == mime.name) {

          let a = this.allTasks[j];
          EnigmailLog.DEBUG("persistentCrypto.jsm: mimeToString: attaching " + j + " as '" + a.name + "'\n");

          for (let header in mime.headers) {
            if (!(a.status == STATUS_OK && header == "content-type")) {
              msg += prettyPrintHeader(header, mime.headers[header]) + "\r\n";
            }
          }

          if (a.type == "attachment") {
            if (a.status == STATUS_OK) {
              msg += "Content-Type: application/octet-stream; name=\"" + a.name + "\"\r\n";
              msg += "Content-Disposition: attachment; filename\"" + a.name + "\"\r\n";
            }

            msg += "Content-Transfer-Encoding: base64\r\n\r\n";
            msg += EnigmailData.encodeBase64(a.data) + "\r\n";

          }
        }
      }
    } else if (mime instanceof MimeContainer || mime instanceof MimeUnknown) {
      for (let j in this.allTasks) {
        if (this.allTasks[j].partName == mime.partName &&
          this.allTasks[j].type == "mime") {
          let a = this.allTasks[j];
          msg += a.data;
          mime.noBottomBoundary = true;
        }
      }
    } else if (mime instanceof MimeMessage && ct.substr(0, 5) == "text/") {
      let subct = mime.parts[0].headers['content-type'];
      if (subct) {
        mime.headers['content-type'] = subct;
      }

      subct = mime.parts[0].headers['content-transfer-encoding'];
      if (subct) {
        mime.headers['content-transfer-encoding'] = subct;
      }

      msg += getRfc822Headers(mime.headers, ct);

      msg += "\r\n" + mime.parts[0].body + "\r\n";

      return msg;
    } else {
      if (!topLevel && (mime instanceof MimeMessage)) {
        let mimeName = mime.name;
        if (!mimeName || mimeName === "") {
          mimeName = getHeaderValue(mime, 'subject') + ".eml";
        }

        msg += 'Content-Type: message/rfc822; name="' + EnigmailMime.encodeHeaderValue(mimeName) + '\r\n';
        msg += 'Content-Transfer-Encoding: 7bit\r\n';
        msg += 'Content-Disposition: attachment; filename="' + EnigmailMime.encodeHeaderValue(mimeName) + '"\r\n\r\n';
      }

      msg += getRfc822Headers(mime.headers, ct);

      msg += "\r\n";

      if (mime.body) {
        msg += mime.body + "\r\n";
      } else if ((mime instanceof MimeMessage) && ct.substr(0, 5) != "text/") {
        msg += "This is a multi-part message in MIME format.\r\n";
      }
    }

    for (let i in mime.parts) {
      let subPart = this.mimeToString(mime.parts[i], false);
      if (subPart.length > 0) {
        if (boundary && !(mime instanceof MimeMessage)) {
          msg += "--" + boundary + "\r\n";
        }
        msg += subPart + "\r\n";
      }
    }

    if (ct.indexOf("multipart/") === 0 && !(mime instanceof MimeContainer)) {
      if (!mime.noBottomBoundary) {
        msg += "--" + boundary + "--\r\n";
      }
    }
    return msg;
  }
};

/**
 * Format a mime header
 *
 * e.g. content-type -> Content-Type
 */

function formatHeader(headerLabel) {
  return headerLabel.replace(/^.|(-.)/g, function(match) {
    return match.toUpperCase();
  });
}

function formatMimeHeader(headerLabel, headerValue) {
  if (headerLabel.search(/^(sender|from|reply-to|to|cc|bcc)$/i) === 0) {
    return formatHeader(headerLabel) + ": " + EnigmailMime.formatHeaderData(EnigmailMime.formatEmailAddress(headerValue));
  } else {
    return formatHeader(headerLabel) + ": " + EnigmailMime.formatHeaderData(EnigmailMime.encodeHeaderValue(headerValue));
  }
}


function prettyPrintHeader(headerLabel, headerData) {
  let hdrData = "";
  if (Array.isArray(headerData)) {
    let h = [];
    for (let i in headerData) {
      h.push(formatMimeHeader(headerLabel, GlodaUtils.deMime(headerData[i])));
    }
    return h.join("\r\n");
  } else {
    return formatMimeHeader(headerLabel, GlodaUtils.deMime(String(headerData)));
  }
}

function getHeaderValue(mimeStruct, header) {
  EnigmailLog.DEBUG("persistentCrypto.jsm: getHeaderValue: '" + header + "'\n");

  try {
    if (header in mimeStruct.headers) {
      if (typeof mimeStruct.headers[header] == "string") {
        return mimeStruct.headers[header];
      } else {
        return mimeStruct.headers[header].join(" ");
      }
    } else {
      return "";
    }
  } catch (ex) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: getHeaderValue: header not present\n");
    return "";
  }
}

/***
 * get the formatted headers for MimeMessage objects
 *
 * @headerArr:        Array of headers (key/value pairs), such as mime.headers
 * @ignoreHeadersArr: Array of headers to exclude from returning
 *
 * @return:   String containing formatted header list
 */
function getRfc822Headers(headerArr, contentType, ignoreHeadersArr) {
  let hdrs = "";

  let ignore = [];
  if (contentType.indexOf("multipart/") >= 0) {
    ignore = ['content-transfer-encoding',
      'content-disposition',
      'content-description'
    ];
  }

  if (ignoreHeadersArr) {
    ignore = ignore.concat(ignoreHeadersArr);
  }

  for (let i in headerArr) {
    if (ignore.indexOf(i) < 0) {
      hdrs += prettyPrintHeader(i, headerArr[i]) + "\r\n";
    }
  }

  return hdrs;
}

function getContentType(shdr) {
  try {
    shdr = String(shdr);
    return shdr.match(/([A-z-]+\/[A-z-]+)/)[1].toLowerCase();
  } catch (e) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: getContentType: " + e + "\n");
    return null;
  }
}

// return the content of the boundary parameter
function getBoundary(shdr) {
  try {
    shdr = String(shdr);
    return EnigmailMime.getBoundary(shdr);
  } catch (e) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: getBoundary: " + e + "\n");
    return null;
  }
}

function getCharset(shdr) {
  try {
    shdr = String(shdr);
    return EnigmailMime.getParameter(shdr, 'charset').toLowerCase();
  } catch (e) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: getCharset: " + e + "\n");
    return null;
  }
}

function getProtocol(shdr) {
  try {
    shdr = String(shdr);
    return EnigmailMime.getProtocol(shdr).toLowerCase();
  } catch (e) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: getProtocol: " + e + "\n");
    return "";
  }
}

function getSMimeProtocol(shdr) {
  try {
    shdr = String(shdr);
    return shdr.match(/smime-type="?([A-z0-9'()+_,-./:=?]+)"?/)[1].toLowerCase();
  } catch (e) {
    EnigmailLog.DEBUG("persistentCrypto.jsm: getSMimeProtocol: " + e + "\n");
    return "";
  }
}

function getPepSubject(mimeString) {
  EnigmailLog.DEBUG("persistentCrypto.jsm: getPepSubject()\n");

  let subject = null;

  let emitter = {
    ct: "",
    firstPlainText: false,
    startPart: function(partNum, headers) {
      EnigmailLog.DEBUG("persistentCrypto.jsm: getPepSubject.startPart: partNum=" + partNum + "\n");
      try {
        this.ct = String(headers.getRawHeader("content-type")).toLowerCase();
        if (!subject && !this.firstPlainText) {
          let s = headers.getRawHeader("subject");
          if (s) {
            subject = String(s);
            this.firstPlainText = true;
          }
        }
      } catch (ex) {
        this.ct = "";
      }
    },

    endPart: function(partNum) {},

    deliverPartData: function(partNum, data) {
      EnigmailLog.DEBUG("persistentCrypto.jsm: getPepSubject.deliverPartData: partNum=" + partNum + " ct=" + this.ct + "\n");
      if (!this.firstPlainText && this.ct.search(/^text\/plain/) === 0) {
        // check data
        this.firstPlainText = true;

        let o = EnigmailMime.extractSubjectFromBody(data);
        if (o) {
          subject = o.subject;
        }
      }
    }
  };

  let opt = {
    strformat: "unicode",
    bodyformat: "decode"
  };

  try {
    let p = new jsmime.MimeParser(emitter, opt);
    p.deliverData(mimeString);
  } catch (ex) {}

  return subject;
}

/**
 * Lazy deletion of original messages
 */
function deleteOriginalMail(msgHdr) {
  EnigmailLog.DEBUG("persistentCrypto.jsm: deleteOriginalMail(" + msgHdr.messageKey + ")\n");

  let delMsg = function() {
    try {
      EnigmailLog.DEBUG("persistentCrypto.jsm: deleting original message " + msgHdr.messageKey + "\n");
      EnigmailStdlib.msgHdrsDelete([msgHdr]);
    } catch (e) {
      EnigmailLog.DEBUG("persistentCrypto.jsm: deletion failed. Error: " + e.toString() + "\n");
    }
  };

  EnigmailTimer.setTimeout(delMsg, 500);
}