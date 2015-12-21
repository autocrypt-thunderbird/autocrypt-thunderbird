/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailHash"];

const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/encryption.jsm"); /*global EnigmailEncryption: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */

const Ci = Components.interfaces;

const nsIEnigmail = Ci.nsIEnigmail;

const keyAlgorithms = [];
const mimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5"];

const EnigmailHash = {
  determineAlgorithm: function(win, uiFlags, fromMailAddr, hashAlgoObj) {
    EnigmailLog.DEBUG("hash.jsm: determineAlgorithm\n");

    if (!win) {
      win = EnigmailWindows.getMostRecentWindow();
    }

    const sendFlags = nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED;
    const hashAlgo = mimeHashAlgorithms[EnigmailPrefs.getPref("mimeHashAlgorithm")];

    if (typeof(keyAlgorithms[fromMailAddr]) != "string") {
      // hash algorithm not yet known

      const testUiFlags = nsIEnigmail.UI_TEST;
      const listener = {
        stdoutData: "",
        stderrData: "",
        exitCode: -1,
        stdin: function(pipe) {
          pipe.write("Dummy Test");
          pipe.close();
        },
        stdout: function(data) {
          this.stdoutData += data;
        },
        stderr: function(data) {
          this.stderrData += data;
        },
        done: function(exitCode) {
          this.exitCode = exitCode;
        }
      };

      const proc = EnigmailEncryption.encryptMessageStart(win, testUiFlags, fromMailAddr, "",
        "", hashAlgo, sendFlags,
        listener, {}, {});

      if (!proc) {
        return 1;
      }

      proc.wait();

      const msgText = listener.stdoutData;
      const exitCode = listener.exitCode;

      const retStatusObj = {};
      let exitCode2 = EnigmailEncryption.encryptMessageEnd(fromMailAddr, listener.stderrData, exitCode,
        testUiFlags, sendFlags, 10,
        retStatusObj);

      if ((exitCode2 === 0) && !msgText) exitCode2 = 1;
      // if (exitCode2 > 0) exitCode2 = -exitCode2;

      if (exitCode2 !== 0) {
        // Abormal return
        if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
          // "Unremember" passphrase on error return
          retStatusObj.errorMsg = EnigmailLocale.getString("badPhrase");
        }
        EnigmailDialog.alert(win, retStatusObj.errorMsg);
        return exitCode2;
      }

      let hashAlgorithm = "sha1"; // default as defined in RFC 4880, section 7 is MD5 -- but that's outdated

      const m = msgText.match(/^(Hash: )(.*)$/m);
      if (m && (m.length > 2) && (m[1] == "Hash: ")) {
        hashAlgorithm = m[2].toLowerCase();
      }
      else {
        EnigmailLog.DEBUG("hash.jsm: determineAlgorithm: no hashAlgorithm specified - using MD5\n");
      }

      for (let i = 1; i < mimeHashAlgorithms.length; i++) {
        if (mimeHashAlgorithms[i] === hashAlgorithm) {
          EnigmailLog.DEBUG("hash.jsm: determineAlgorithm: found hashAlgorithm " + hashAlgorithm + "\n");
          keyAlgorithms[fromMailAddr] = hashAlgorithm;
          hashAlgoObj.value = hashAlgorithm;
          return 0;
        }
      }

      EnigmailLog.ERROR("hash.jsm: determineAlgorithm: no hashAlgorithm found\n");
      return 2;
    }
    else {
      EnigmailLog.DEBUG("hash.jsm: determineAlgorithm: hashAlgorithm " + keyAlgorithms[fromMailAddr] + " is cached\n");
      hashAlgoObj.value = keyAlgorithms[fromMailAddr];
    }

    return 0;
  }
};
