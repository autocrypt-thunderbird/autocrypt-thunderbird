/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for interfacing to pEp (Enigmal-specific functions)
 */


const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/pEp.jsm"); /*global EnigmailpEp: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Cu.import("resource://gre/modules/jsmime.jsm"); /*global jsmime: false*/


var gPepVersion = null;

var EXPORTED_SYMBOLS = ["EnigmailPEPAdapter"];

var EnigmailPEPAdapter = {

  pep: EnigmailpEp,

  /**
   * Get the pEp JSON server version number.
   *
   * @return String:
   *     - null if the module is not initialized
   *     - a non-empty string if pEp is available
   *     - "" in case pEp is not available
   */
  getPepVersion: function() {
    return gPepVersion;
  },

  /**
   * Determine if pEp is available
   *
   * @return: Boolean: true - pEp is available / false - pEp is not usable
   */
  usingPep: function() {
    if (!this.getPepJuniorMode()) return false;

    if ((typeof(gPepVersion) === "string") && gPepVersion.length > 0) {
      return true;
    }

    return false;
  },

  /**
   * Determine if pEp should be used or Enigmail
   *
   * @return: Boolean: true - use pEp  / false - use Enigmail
   */
  getPepJuniorMode: function() {

    let mode = EnigmailPrefs.getPref("juniorMode");
    if (mode === 2) return true;
    if (mode === 0) return false;

    // automatic mode: go through all identities
    let amService = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
    amService.LoadAccounts();
    let ids = amService.allIdentities;

    for (let i = 0; i < ids.length; i++) {
      let msgId = ids.queryElementAt(i, Ci.nsIMsgIdentity);

      if ((msgId.getUnicharAttribute("signing_cert_name") !== "") ||
        (msgId.getUnicharAttribute("encryption_cert_name") !== "") ||
        msgId.getBoolAttribute("enablePgp")) {
        return false;
      }
    }

    return true;
  },

  initialize: function() {
    EnigmailpEp.getPepVersion().then(function success(data) {
      if (Array.isArray(data)) {
        gPepVersion = data[0];
      }
    }).
    catch(function failed(data) {
      gPepVersion = "";
    });
  },

  getMsgStringFromResult: function(resultObj) {
    EnigmailLog.DEBUG("pEpAdapter.jsm: getMsgStringFromResult: " + typeof(resultObj[0]) + "\n");
    if ((typeof(resultObj[0]) === "object") && ("dir" in resultObj[0])) {
      if (resultObj[0].enc_format === 3) {
        // PGP/MIME
        let i;
        let boundary = EnigmailMime.createBoundary();
        let att = resultObj[0].attachments;
        let r = 'Content-Type: multipart/encrypted;\r\n  protocol="application/pgp-encrypted";\r\n  boundary="' + boundary + '";\r\n\r\n';

        r += 'This is an OpenPGP/MIME encrypted message (RFC 4880 and 3156)\r\n';
        r += 'This message was encrypted with pEp https://pEp-project.org\r\n\r\n';
        for (i = 0; i < att.length; i++) {

          r += "--" + boundary + "\r\n";
          r += "Content-Type: " + att[i].mime_type + "\r\n";
          let decodedValue = "";

          try {
            // try to decode the value from base 64.
            decodedValue = atob(att[i].value);
          }
          catch (ex) {
            r += 'Content-Transfer-Encoding: 8bit\r\n\r\n';
          }
          if ("filename" in att[i]) {
            r += 'Content-Disposition: attachment; filename="' + att[i].filename + '"\r\n';
          }
          r += "\r\n";
          if (decodedValue !== "") {
            r += decodedValue;
          }
          else {
            r += att[i].value;
          }
          r += "\r\n\r\n";
        }

        r += "--" + boundary + "--\r\n";

        return r;
      }
      else if (resultObj[0].enc_format === 1) {
        // inline PGP
        let i;
        let boundary = EnigmailMime.createBoundary();
        let att = resultObj[0].attachments;
        let r = 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n';

        r += "--" + boundary + "\r\n";
        r += 'Content-Type: text/plain; charset="utf-8"\r\n';
        r += 'Content-Transfer-Encoding: 8bit\r\n\r\n';
        r += resultObj[0].longmsg + '\r\n\r\n';

        for (i = 0; i < att.length; i++) {
          r += "--" + boundary + "\r\n";
          r += "Content-Type: " + att[i].mime_type + "\r\n";
          r += "Content-Transfer-Encoding: base64\r\n";
          if ("filename" in att[i]) {
            r += 'Content-Disposition: attachment; filename="' + att[i].filename + '"\r\n';
          }
          r += "\r\n";
          r += att[i].value.replace(/(.{68})/g, "$1\r\n") + "\r\n\r\n";
        }

        r += "--" + boundary + "--\r\n";

        return r;

      }
    }

    return "";
  }

};
