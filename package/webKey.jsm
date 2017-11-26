/*global Components: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-invalid-this: 0 */

/**
 * This module serves to integrate WKS (Webkey service) into Enigmail
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailWks"];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/files.jsm"); /* global EnigmailFiles: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/stdlib.jsm"); /*global EnigmailStdlib: false */
Cu.import("resource://enigmail/send.jsm"); /*global EnigmailSend: false */
Cu.import("resource://enigmail/msgCompFields.jsm"); /*global EnigmailMsgCompFields: false */

const GPG_WKS_CLIENT = "gpg-wks-client";

var EnigmailWks = {
  wksClientPath: null,

  /**
   * Get WKS Client path (gpg-wks-client)
   *
   * @param window  : Object - parent window for dialog display
   * @param cb      : Function(retValue) - callback function.
   *                   retValue: nsIFile Object to gpg-wks-client executable or NULL
   * @return        : Object - NULL or a process handle
   */
  getWksClientPathAsync: function(window, cb) {
    EnigmailLog.DEBUG("webKey.jsm: getWksClientPathAsync\n");

    if (EnigmailWks.wksClientPath === null) {
      let listener = EnigmailExecution.newSimpleListener(null, function(ret) {
        if (ret === 0) {
          try {
            let stdout = listener.stdoutData;

            let libexecdir = /^libexecdir:(.+?)$/m.exec(stdout)[1];
            if (libexecdir) {
              libexecdir = libexecdir.replace(/%3a/gi, ":");
            }
            else {
              libexecdir = "";
            }

            let wks_client = checkIfExists(libexecdir, GPG_WKS_CLIENT);
            if (!wks_client) {
              let bindir = /^bindir:(.+?)$/m.exec(stdout)[1];
              if (bindir) {
                bindir = bindir.replace(/%3a/gi, ":");
              }
              else {
                bindir = "";
              }
              wks_client = checkIfExists(bindir, GPG_WKS_CLIENT);

              if (!wks_client) {
                cb(null);
                return;
              }
            }

            EnigmailWks.wksClientPath = wks_client;
            cb(wks_client);
          }
          catch (e) {
            EnigmailLog.DEBUG("webKey.jsm: getWksClientPathAsync: " + e.toString() + "\n");
            cb(null);
          }
        }
        else {
          cb(null);
        }
      });

      return EnigmailExecution.execStart(EnigmailGpgAgent.gpgconfPath, ["--list-dirs"], false, window, listener, {
        value: null
      });
    }
    else {
      cb(EnigmailWks.wksClientPath);
      return null;
    }
  },

  /**
   * Determine if WKS is supported by email provider
   *
   * @param email : String - user's email address
   * @param window: Object - parent window of dialog display
   * @param cb    : Function(retValue) - callback function.
   *                   retValue: Boolean: true if WKS is supported / false otherwise
   * @return      : Object - process handle
   */
  isWksSupportedAsync: function(email, window, cb) {
    EnigmailLog.DEBUG("webKey.jsm: isWksSupportedAsync: email = " + email + "\n");
    return EnigmailWks.getWksClientPathAsync(window, function(wks_client) {
      if (wks_client === null) {
        cb(false);
      }
      let listener = EnigmailExecution.newSimpleListener(null, function(ret) {
        cb(ret === 0);
      });
      let proc = EnigmailExecution.execStart(wks_client, ["--supported", email], false, window, listener, {
        value: null
      });
      if (proc === null) {
        cb(false);
      }
    });
  },

  /**
   * Submit a key to the email provider (= send publication request)
   *
   * @param ident : nsIMsgIdentity - user's ID
   * @param key   : Enigmail KeyObject of user's key
   * @param window: Object - parent window of dialog display
   * @param cb    : Function(retValue) - callback function.
   *                   retValue: Boolean: true if submit was successful / false otherwise
   * @return      : Object - process handle
   */

  submitKey: function(ident, key, window, cb) {
    EnigmailLog.DEBUG("webKey.jsm: submitKey: email = " + ident.email + "\n");
    return EnigmailWks.getWksClientPathAsync(window, function(wks_client) {
      if (wks_client === null) {
        cb(false);
        return null;
      }
      let listener = EnigmailExecution.newSimpleListener(null, function(ret) {
        if (ret !== 0) {
          cb(false);
          return;
        }
        EnigmailLog.DEBUG("webKey.jsm: submitKey: send " + listener.stdoutData + "\n");
        let si = EnigmailMsgCompFields.createObject(null);
        let subject = listener.stdoutData.match(/^Subject:[ \t]*(.+)$/im);
        let to = listener.stdoutData.match(/^To:[ \t]*(.+)$/im);

        if (subject !== null && to !== null) {
          EnigmailMsgCompFields.setValue(si, "sendFlags", Ci.nsIEnigmail.SEND_VERBATIM);

          if (!EnigmailSend.simpleSendMessage({
                urls: [],
                identity: ident,
                to: to[1],
                subject: subject[1],
                securityInfo: si
              },
              listener.stdoutData,
              cb
            )) {
            cb(false);
          }
        }
        else {
          cb(false);
        }
      });
      return EnigmailExecution.execStart(wks_client, ["--create", key.fpr, ident.email], false, window, listener, {
        value: null
      });
    });
  },

  /**
   * Submit a key to the email provider (= send publication request)
   *
   * @param ident : nsIMsgIdentity - user's ID
   * @param body  : String -  complete message source of the confirmation-request email obtained
   *                    from the email provider
   * @param window: Object - parent window of dialog display
   * @param cb    : Function(retValue) - callback function.
   *                   retValue: Boolean: true if submit was successful / false otherwise
   * @return      : Object - process handle
   */

  confirmKey: function(ident, body, window, cb) {
    var sanitized = body.replace(/\r?\n/g, "\r\n");
    EnigmailLog.DEBUG("webKey.jsm: confirmKey: ident=" + ident.email + "\n");
    return EnigmailWks.getWksClientPathAsync(window, function(wks_client) {
      if (wks_client === null) {
        if (cb) {
          cb(false);
        }
        return;
      }
      let listener = EnigmailExecution.newSimpleListener(function(pipe) {
        try {
          pipe.write(sanitized);
          pipe.close();
        }
        catch (e) {
          if (cb) {
            cb(false);
          }
          EnigmailLog.DEBUG(e + "\n");
        }
      }, function(ret) {
        try {
          let si = EnigmailMsgCompFields.createObject(null);
          let subject = listener.stdoutData.match(/^Subject:[ \t]*(.+)$/im);
          let to = listener.stdoutData.match(/^To:[ \t]*(.+)$/im);

          if (subject !== null && to !== null) {
            EnigmailMsgCompFields.setValue(si, "sendFlags", Ci.nsIEnigmail.SEND_VERBATIM);

            if (!EnigmailSend.simpleSendMessage({
                  urls: [],
                  identity: ident,
                  to: to[1],
                  subject: subject[1],
                  securityInfo: si
                },
                listener.stdoutData,
                cb
              )) {
              cb(false);
            }
          }
        }
        catch (e) {
          if (cb) {
            cb(false);
          }
          EnigmailLog.DEBUG(e + "\n");
        }
      });
      EnigmailExecution.execStart(wks_client, ["--receive"], false, window, listener, {
        value: null
      });
    });
  }
};

/**
 * Check if a file exists and is executable
 *
 * @param path:         String - directory name
 * @param execFileName: String - executable name
 *
 * @return Object - nsIFile if file exists; NULL otherwise
 */

function checkIfExists(path, execFileName) {
  EnigmailLog.DEBUG("webKey.jsm checkIfExists() path=" + path + " execFileName=" + execFileName + "\n");

  let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);

  execFileName = EnigmailFiles.potentialWindowsExecutable(execFileName);
  EnigmailFiles.initPath(file, path);
  file.append(execFileName);
  if (file.exists() && file.isExecutable()) {
    return file;
  }
  else {
    return null;
  }
}
