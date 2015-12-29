/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailKeyServer"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/httpProxy.jsm"); /*global EnigmailHttpProxy: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */

const nsIEnigmail = Ci.nsIEnigmail;

const EnigmailKeyServer = {
  /**
   * search, download or upload key on, from or to a keyserver
   *
   * @actionFlags: Integer - flags (bitmap) to determine the required action
   *                         (see nsIEnigmail - Keyserver action flags for details)
   * @keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @searchTerms: String  - space-separated list of search terms or key IDs
   * @listener:    Object  - execStart Listener Object. See execStart for details.
   * @errorMsgObj: Object  - object to hold error message in .value
   *
   * @return:      Subprocess object, or null in case process could not be started
   */
  access: function(actionFlags, keyserver, searchTerms, listener, errorMsgObj) {
    EnigmailLog.DEBUG("keyserver.jsm: access: " + searchTerms + "\n");

    if (!keyserver) {
      errorMsgObj.value = EnigmailLocale.getString("failNoServer");
      return null;
    }

    if (!searchTerms && !(actionFlags & nsIEnigmail.REFRESH_KEY)) {
      errorMsgObj.value = EnigmailLocale.getString("failNoID");
      return null;
    }

    const proxyHost = EnigmailHttpProxy.getHttpProxy(keyserver);
    let args = EnigmailGpg.getStandardArgs(true);

    if (actionFlags & nsIEnigmail.SEARCH_KEY) {
      args = EnigmailGpg.getStandardArgs(false).
      concat(["--command-fd", "0", "--fixed-list", "--with-colons"]);
    }
    if (proxyHost) {
      args = args.concat(["--keyserver-options", "http-proxy=" + proxyHost]);
    }
    args = args.concat(["--keyserver", keyserver.trim()]);

    //     if (actionFlags & nsIEnigmail.SEARCH_KEY | nsIEnigmail.DOWNLOAD_KEY | nsIEnigmail.REFRESH_KEY) {
    //       args = args.concat(["--command-fd", "0", "--fixed-list", "--with-colons"]);
    //     }

    let inputData = null;
    const searchTermsList = searchTerms.split(" ");

    if (actionFlags & nsIEnigmail.DOWNLOAD_KEY) {
      args.push("--recv-keys");
      args = args.concat(searchTermsList);
    }
    else if (actionFlags & nsIEnigmail.REFRESH_KEY) {
      args.push("--refresh-keys");
    }
    else if (actionFlags & nsIEnigmail.SEARCH_KEY) {
      args.push("--search-keys");
      args = args.concat(searchTermsList);
      inputData = "quit\n";
    }
    else if (actionFlags & nsIEnigmail.UPLOAD_KEY) {
      args.push("--send-keys");
      args = args.concat(searchTermsList);
    }

    const isDownload = actionFlags & (nsIEnigmail.REFRESH_KEY | nsIEnigmail.DOWNLOAD_KEY);

    EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(EnigmailGpgAgent.agentPath, args) + "\n");

    let proc = null;
    let exitCode = null;

    try {
      proc = subprocess.call({
        command: EnigmailGpgAgent.agentPath,
        arguments: args,
        environment: EnigmailCore.getEnvList(),
        charset: null,
        stdin: inputData,
        stdout: function(data) {
          listener.stdout(data);
        },
        stderr: function(data) {
          if (data.search(/^\[GNUPG:\] ERROR/m) >= 0) {
            exitCode = 4;
          }
          listener.stderr(data);
        },
        done: function(result) {
          try {
            if (result.exitCode === 0 && isDownload) {
              EnigmailKeyRing.clearCache();
            }
            if (exitCode === null) {
              exitCode = result.exitCode;
            }
            listener.done(exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    }
    catch (ex) {
      EnigmailLog.ERROR("keyserver.jsm: access: subprocess.call failed with '" + ex.toString() + "'\n");
      throw ex;
    }

    if (!proc) {
      EnigmailLog.ERROR("keyserver.jsm: access: subprocess failed due to unknown reasons\n");
      return null;
    }

    return proc;
  }
};
