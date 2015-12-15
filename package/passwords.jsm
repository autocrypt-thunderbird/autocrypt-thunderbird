/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailPassword"];

const Cu = Components.utils;

Cu.import("resource://enigmail/lazy.jsm"); /*global EnigmailLazy: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */


const gpgAgent = EnigmailLazy.loader("enigmail/gpgAgent.jsm", "EnigmailGpgAgent");
const getDialog = EnigmailLazy.loader("enigmail/dialog.jsm", "EnigmailDialog");
const getLocale = EnigmailLazy.loader("enigmail/locale.jsm", "EnigmailLocale");

const EnigmailPassword = {
  /*
   * Get GnuPG command line options for receiving the password depending
   * on the various user and system settings (gpg-agent/no passphrase)
   *
   * @return: Array the GnuPG command line options
   */
  command: function() {
    if (gpgAgent().useGpgAgent()) {
      return ["--use-agent"];
    }
    else {
      if (!EnigmailPrefs.getPref("noPassphrase")) {
        return ["--passphrase-fd", "0", "--no-use-agent"];
      }
    }
    return [];
  },

  getMaxIdleMinutes: function() {
    try {
      return EnigmailPrefs.getPref("maxIdleMinutes");
    }
    catch (ex) {}

    return 5;
  },

  clearPassphrase: function(win) {
    // clear all passphrases from gpg-agent by reloading the config
    if (!EnigmailCore.getService()) return;

    if (!gpgAgent().useGpgAgent()) {
      return;
    }

    let exitCode = -1;
    let isError = 0;

    const proc = {
      command: gpgAgent().connGpgAgentPath,
      arguments: [],
      charset: null,
      environment: EnigmailCore.getEnvList(),
      stdin: function(pipe) {
        pipe.write("RELOADAGENT\n");
        pipe.write("/bye\n");
        pipe.close();
      },
      stdout: function(data) {
        if (data.search(/^ERR/m) >= 0) {
          ++isError;
        }
      },
      done: function(result) {
        exitCode = result.exitCode;
      }
    };

    try {
      subprocess.call(proc).wait();
    }
    catch (ex) {}

    if (isError === 0) {
      getDialog().alert(win, getLocale().getString("passphraseCleared"));
    }
    else {
      getDialog().alert(win, getLocale().getString("cannotClearPassphrase"));
    }
  }
};
