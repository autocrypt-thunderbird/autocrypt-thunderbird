/*global Components: false, EnigmailCore: false, EnigmailLog: false, EnigmailPrefs: false, EnigmailApp: false, EnigmailLocale: false, EnigmailDialog: false */
/*jshint -W097 */
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
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
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

"use strict";

const EXPORTED_SYMBOLS = [ "EnigmailEncryption" ];

Components.utils.import("resource://enigmail/core.jsm");
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/prefs.jsm");
Components.utils.import("resource://enigmail/app.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Components.utils.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Components.utils.import("resource://enigmail/errorHandling.jsm"); /*global EnigmailErrorHandling: false */
Components.utils.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Components.utils.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Components.utils.import("resource://enigmail/passwords.jsm"); /*global EnigmailPassword: false */

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

var EC = EnigmailCore;

const gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5" ];

const ENC_TYPE_MSG = 0;
const ENC_TYPE_ATTACH_BINARY = 1;
const ENC_TYPE_ATTACH_ASCII = 2;

const GPG_COMMENT_OPT = "Using GnuPG with %s - http://www.enigmail.net/";

// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email address
function stripEmailAdr(mailAddrs) {
    var qStart, qEnd;
    while ((qStart = mailAddrs.indexOf('"')) != -1) {
        qEnd = mailAddrs.indexOf('"', qStart+1);
        if (qEnd == -1) {
            EnigmailLog.ERROR("enigmailCommon.jsm:: stripEmailAdr: Unmatched quote in mail address: "+mailAddrs+"\n");
            mailAddrs=mailAddrs.replace(/\"/g, "");
            break;
        }

        mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
    }

    // Eliminate all whitespace, just to be safe
    mailAddrs = mailAddrs.replace(/\s+/g,"");

    // Extract pure e-mail address list (stripping out angle brackets)
    mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

    return mailAddrs;
}

const EnigmailEncryption = {
    getEncryptCommand: function (fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj) {
        EnigmailLog.DEBUG("encryption.jsm: getEncryptCommand: hashAlgorithm="+hashAlgorithm+"\n");

        try {
            fromMailAddr = stripEmailAdr(fromMailAddr);
            toMailAddr = stripEmailAdr(toMailAddr);
            bccMailAddr = stripEmailAdr(bccMailAddr);

        } catch (ex) {
            errorMsgObj.value = EnigmailLocale.getString("invalidEmail");
            return null;
        }

        var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
        var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
        var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;
        var usePgpMime =  sendFlags & nsIEnigmail.SEND_PGP_MIME;

        var useDefaultComment = false;
        try {
            useDefaultComment = EnigmailPrefs.getPref("useDefaultComment");
        } catch(ex) { }

        var hushMailSupport = false;
        try {
            hushMailSupport = EnigmailPrefs.getPref("hushMailSupport");
        } catch(ex) { }

        var detachedSig = (usePgpMime || (sendFlags & nsIEnigmail.SEND_ATTACHMENT)) && signMsg && !encryptMsg;

        var toAddrList = toMailAddr.split(/\s*,\s*/);
        var bccAddrList = bccMailAddr.split(/\s*,\s*/);
        var k;

        var encryptArgs = EnigmailGpg.getStandardArgs(true);

        if (!useDefaultComment)
            encryptArgs = encryptArgs.concat(["--comment", GPG_COMMENT_OPT.replace(/\%s/, EnigmailApp.getName())]);

        var angledFromMailAddr = ((fromMailAddr.search(/^0x/) === 0) || hushMailSupport) ?
                fromMailAddr : "<" + fromMailAddr + ">";
        angledFromMailAddr = angledFromMailAddr.replace(/([\"\'\`])/g, "\\$1");

        if (signMsg && hashAlgorithm) {
            encryptArgs = encryptArgs.concat(["--digest-algo", hashAlgorithm]);
        }

        if (encryptMsg) {
            switch (isAscii) {
            case ENC_TYPE_MSG:
                encryptArgs.push("-a");
                encryptArgs.push("-t");
                break;
            case ENC_TYPE_ATTACH_ASCII:
                encryptArgs.push("-a");
            }

            encryptArgs.push("--encrypt");

            if (signMsg)
                encryptArgs.push("--sign");

            if (sendFlags & nsIEnigmail.SEND_ALWAYS_TRUST) {
                encryptArgs.push("--trust-model");
                encryptArgs.push("always");
            }
            if ((sendFlags & nsIEnigmail.SEND_ENCRYPT_TO_SELF) && fromMailAddr)
                encryptArgs = encryptArgs.concat(["--encrypt-to", angledFromMailAddr]);

            for (k=0; k<toAddrList.length; k++) {
                toAddrList[k] = toAddrList[k].replace(/\'/g, "\\'");
                if (toAddrList[k].length > 0) {
                    encryptArgs.push("-r");
                    if (toAddrList[k].search(/^GROUP:/) === 0) {
                        // groups from gpg.conf file
                        encryptArgs.push(toAddrList[k].substr(6));
                    }
                    else {
                        encryptArgs.push((hushMailSupport || (toAddrList[k].search(/^0x/) === 0)) ? toAddrList[k]
                                         :"<" + toAddrList[k] + ">");
                    }
                }
            }

            for (k=0; k<bccAddrList.length; k++) {
                bccAddrList[k] = bccAddrList[k].replace(/\'/g, "\\'");
                if (bccAddrList[k].length > 0) {
                    encryptArgs.push("--hidden-recipient");
                    encryptArgs.push((hushMailSupport || (bccAddrList[k].search(/^0x/) === 0)) ? bccAddrList[k]
                                     :"<" + bccAddrList[k] + ">");
                }
            }

        } else if (detachedSig) {
            encryptArgs = encryptArgs.concat(["-s", "-b"]);

            switch (isAscii) {
            case ENC_TYPE_MSG:
                encryptArgs = encryptArgs.concat(["-a", "-t"]);
                break;
            case ENC_TYPE_ATTACH_ASCII:
                encryptArgs.push("-a");
            }

        } else if (signMsg) {
            encryptArgs = encryptArgs.concat(["-t", "--clearsign"]);
        }

        if (fromMailAddr) {
            encryptArgs = encryptArgs.concat(["-u", angledFromMailAddr]);
        }

        return encryptArgs;
    },

    encryptMessageStart: function(win, uiFlags, fromMailAddr, toMailAddr, bccMailAddr,
                                  hashAlgorithm, sendFlags, listener, statusFlagsObj, errorMsgObj) {
        EnigmailLog.DEBUG("enigmailCommon.jsm: encryptMessageStart: uiFlags="+uiFlags+", from "+fromMailAddr+" to "+toMailAddr+", hashAlgorithm="+hashAlgorithm+" ("+EnigmailData.bytesToHex(EnigmailData.pack(sendFlags,4))+")\n");

        var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;

        var hashAlgo = gMimeHashAlgorithms[EnigmailPrefs.getPref("mimeHashAlgorithm")];

        if (hashAlgorithm) {
            hashAlgo = hashAlgorithm;
        }

        errorMsgObj.value = "";

        if (!sendFlags) {
            EnigmailLog.DEBUG("enigmailCommon.jsm: encryptMessageStart: NO ENCRYPTION!\n");
            errorMsgObj.value = EnigmailLocale.getString("notRequired");
            return null;
        }

        if (!EnigmailCore.getService(win)) {
            EnigmailLog.ERROR("enigmailCommon.jsm: encryptMessageStart: not yet initialized\n");
            errorMsgObj.value = EnigmailLocale.getString("notInit");
            return null;
        }

        var encryptArgs = EnigmailEncryption.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, hashAlgo, sendFlags, ENC_TYPE_MSG, errorMsgObj);
        if (! encryptArgs)
            return null;

        var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;

        var proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath, encryptArgs, signMsg, win, listener, statusFlagsObj);

        if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
            EnigmailLog.ERROR("enigmailCommon.jsm: encryptMessageStart: Error - no passphrase supplied\n");

            errorMsgObj.value = "";
        }

        if (pgpMime && errorMsgObj.value) {
            EnigmailDialog.alert(win, errorMsgObj.value);
        }

        return proc;
    },

    encryptMessageEnd: function (stderrStr, exitCode, uiFlags, sendFlags, outputLen, retStatusObj) {
        EnigmailLog.DEBUG("enigmailCommon.jsm: encryptMessageEnd: uiFlags="+uiFlags+", sendFlags="+EnigmailData.bytesToHex(EnigmailData.pack(sendFlags,4))+", outputLen="+outputLen+"\n");

        var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;
        var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
        var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
        var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

        retStatusObj.statusFlags = 0;
        retStatusObj.errorMsg    = "";
        retStatusObj.blockSeparation  = "";

        if (!EnigmailCore.getService().initialized) {
            EnigmailLog.ERROR("enigmailCommon.jsm: encryptMessageEnd: not yet initialized\n");
            retStatusObj.errorMsg = EnigmailLocale.getString("notInit");
            return -1;
        }

        EnigmailErrorHandling.parseErrorOutput(stderrStr, retStatusObj);

        exitCode = EnigmailExecution.fixExitCode(exitCode, retStatusObj.statusFlags);
        if ((exitCode === 0) && !outputLen) {
            exitCode = -1;
        }

        if (exitCode !== 0 && (signMsg || encryptMsg)) {
            // GnuPG might return a non-zero exit code, even though the message was correctly
            // signed or encryped -> try to fix the exit code

            var correctedExitCode = 0;
            if (signMsg) {
                if (! (retStatusObj.statusFlags & nsIEnigmail.SIG_CREATED)) correctedExitCode = exitCode;
            }
            if (encryptMsg) {
                if (! (retStatusObj.statusFlags & nsIEnigmail.END_ENCRYPTION)) correctedExitCode = exitCode;
            }
            exitCode = correctedExitCode;
        }

        if (exitCode === 0) {
            // Normal return
            return 0;
        }

        // Error processing
        EnigmailLog.DEBUG("enigmailCommon.jsm: encryptMessageEnd: command execution exit code: "+exitCode+"\n");


        if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
            retStatusObj.errorMsg = EnigmailLocale.getString("badPhrase");
        }
        else if (retStatusObj.statusFlags & nsIEnigmail.INVALID_RECIPIENT) {
            retStatusObj.errorMsg = retStatusObj.statusMsg;
        }
        else if (retStatusObj.statusFlags & nsIEnigmail.DISPLAY_MESSAGE) {
            retStatusObj.errorMsg = retStatusObj.statusMsg;
        }
        else {
            retStatusObj.errorMsg = EnigmailLocale.getString("badCommand");
        }

        return exitCode;
    },

    encryptMessage: function (parent, uiFlags, plainText, fromMailAddr, toMailAddr, bccMailAddr, sendFlags,
                              exitCodeObj, statusFlagsObj, errorMsgObj) {
        EnigmailLog.DEBUG("enigmail.js: Enigmail.encryptMessage: "+plainText.length+" bytes from "+fromMailAddr+" to "+toMailAddr+" ("+sendFlags+")\n");

        exitCodeObj.value    = -1;
        statusFlagsObj.value = 0;
        errorMsgObj.value    = "";

        if (!plainText) {
            EnigmailLog.DEBUG("enigmail.js: Enigmail.encryptMessage: NO ENCRYPTION!\n");
            exitCodeObj.value = 0;
            EnigmailLog.DEBUG("  <=== encryptMessage()\n");
            return plainText;
        }

        var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
        var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
        var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

        if (encryptMsg) {
            // First convert all linebreaks to newlines
            plainText = plainText.replace(/\r\n/g, "\n");
            plainText = plainText.replace(/\r/g,   "\n");

            // we need all data in CRLF according to RFC 4880
            plainText = plainText.replace(/\n/g, "\r\n");
        }

        var inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

        var listener = EnigmailExecution.newSimpleListener(
            function _stdin (pipe) {
                pipe.write(plainText);
                pipe.close();
            },
            function _done(exitCode) {
                // unlock wait
                if (inspector.eventLoopNestLevel > 0) {
                    inspector.exitNestedEventLoop();
                }
            });


        var proc = EnigmailEncryption.encryptMessageStart(parent, uiFlags,
                                                  fromMailAddr, toMailAddr, bccMailAddr,
                                                  null, sendFlags,
                                                  listener, statusFlagsObj, errorMsgObj);
        if (! proc) {
            exitCodeObj.value = -1;
            EnigmailLog.DEBUG("  <=== encryptMessage()\n");
            return "";
        }

        // Wait for child pipes to close
        inspector.enterNestedEventLoop(0);

        var retStatusObj = {};
        exitCodeObj.value = EnigmailEncryption.encryptMessageEnd(EnigmailData.getUnicodeData(listener.stderrData), listener.exitCode,
                                                         uiFlags, sendFlags,
                                                         listener.stdoutData.length,
                                                         retStatusObj);

        statusFlagsObj.value = retStatusObj.statusFlags;
        errorMsgObj.value = retStatusObj.errorMsg;


        if ((exitCodeObj.value === 0) && listener.stdoutData.length === 0)
            exitCodeObj.value = -1;

        if (exitCodeObj.value === 0) {
            // Normal return
            EnigmailLog.DEBUG("  <=== encryptMessage()\n");
            return EnigmailData.getUnicodeData(listener.stdoutData);
        }

        // Error processing
        EnigmailLog.DEBUG("enigmail.js: Enigmail.encryptMessage: command execution exit code: "+exitCodeObj.value+"\n");
        return "";
    },

    encryptAttachment: function (parent, fromMailAddr, toMailAddr, bccMailAddr, sendFlags, inFile, outFile,
                                 exitCodeObj, statusFlagsObj, errorMsgObj) {
        EnigmailLog.DEBUG("encryption.jsm: EnigmailEncryption.encryptAttachment infileName="+inFile.path+"\n");

        statusFlagsObj.value = 0;
        sendFlags |= nsIEnigmail.SEND_ATTACHMENT;

        let asciiArmor = false;
        try {
            asciiArmor = EnigmailPrefs.getPrefBranch().getBoolPref("inlineAttachAsciiArmor");
        } catch (ex) {}

        const asciiFlags = (asciiArmor ? ENC_TYPE_ATTACH_ASCII : ENC_TYPE_ATTACH_BINARY);
        let args = EnigmailEncryption.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, "", sendFlags, asciiFlags, errorMsgObj);

        if (! args) {
            return null;
        }

        const signMessage = (sendFlags & nsIEnigmail.SEND_SIGNED);

        if (signMessage ) {
            args = args.concat(EnigmailPassword.command());
        }

        const inFilePath  = EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePathReadonly(inFile.QueryInterface(Ci.nsIFile)));
        const outFilePath = EnigmailFiles.getEscapedFilename(EnigmailFiles.getFilePathReadonly(outFile.QueryInterface(Ci.nsIFile)));

        args = args.concat(["--yes", "-o", outFilePath, inFilePath ]);

        let cmdErrorMsgObj = {};

        const msg = EnigmailExecution.execCmd(EnigmailGpgAgent.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, cmdErrorMsgObj);
        if (exitCodeObj.value !== 0) {
            if (cmdErrorMsgObj.value) {
                errorMsgObj.value = EnigmailFiles.formatCmdLine(EnigmailGpgAgent.agentPath, args);
                errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
            } else {
                errorMsgObj.value = "An unknown error has occurred";
            }

            return "";
        }

        return msg;
    },

    registerOn: function(target) {
        target.encryptMessage = EnigmailEncryption.encryptMessage;
        target.encryptAttachment = EnigmailEncryption.encryptAttachment;
    }
};
