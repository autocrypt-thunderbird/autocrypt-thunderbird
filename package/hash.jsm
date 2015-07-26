/*global Components: false */
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
 *  Ramalingam Saravanan <svn@xmlterm.org>
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

const EXPORTED_SYMBOLS = ["EnigmailHash"];

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
      let exitCode2 = EnigmailEncryption.encryptMessageEnd(listener.stderrData, exitCode,
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
