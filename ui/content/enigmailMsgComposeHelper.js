/*global Components: false, EnigmailDialog: false */
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
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
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


/**
 * helper functions for message composition
 */

Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/funcs.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/prefs.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Components.utils.import("resource://enigmail/trust.jsm"); /*global EnigmailTrust: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */

if (!Enigmail) var Enigmail = {};

Enigmail.hlp = {

  /* try to find valid key to passed email address
   * @return: list of all found key (with leading "0x") or null
   *          details in details parameter
   */
  validKeysForAllRecipients: function(emailsOrKeys, details) {
    EnigmailLog.DEBUG("=====> validKeysForAllRecipients()\n");
    EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): emailsOrKeys='" + emailsOrKeys + "'\n");

    // check whether to use our internal cache
    var resultingArray = null;
    resultingArray = this.doValidKeysForAllRecipients(emailsOrKeys, details);

    EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): return '" + resultingArray + "'\n");
    EnigmailLog.DEBUG("  <=== validKeysForAllRecipients()\n");
    return resultingArray;
  },


  /* doValidKeysForAllRecipients()
   *
   */
  doValidKeysForAllRecipients: function(emailsOrKeys, details) {
    EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): emailsOrKeys='" + emailsOrKeys + "'\n");

    // check which keys are accepted
    var minTrustLevel;
    var acceptedKeys = EnigmailPrefs.getPref("acceptedKeys");
    switch (acceptedKeys) {
      case 0: // accept valid/authenticated keys only
        minTrustLevel = "f"; // first value for trusted keys
        break;
      case 1: // accept all but revoked/disabled/expired keys
        minTrustLevel = "?"; // value between invalid and unknown keys
        break;
      default:
        EnigmailLog.DEBUG("enigmailMsgComposeOverlay.js: doValidKeysForAllRecipients(): return null (INVALID VALUE for acceptedKeys: \"" + acceptedKeys + "\")\n");
        return null;
    }

    const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
    var minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf(minTrustLevel);
    EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): find keys with minTrustLevel=\"" + minTrustLevel + "\"\n");

    var resultingArray = []; // resulting key list (if all valid)
    var keyMissing;
    try {
      // ****** DEBUG ************** print keyList (debug issue)
      //EnigmailLog.DEBUG("                   keyList:\n");
      //EnigmailLog.DEBUG("                   length:  "+ keySortList.length + "\n");
      //for (var idx=0; idx<keySortList.length; idx++) { // note: we have sorted acc. to validity
      //  var keyObj = keyList[keySortList[idx].keyId];
      //  EnigmailLog.DEBUG("                   [" + idx + "].keyId:  "+ keyObj.keyId + "\n");
      //  EnigmailLog.DEBUG("                   [" + idx + "].userId: "+ keyObj.userId + "\n");
      //}

      // create array of address elements (email or key)
      var addresses = EnigmailFuncs.stripEmail(emailsOrKeys).split(',');

      var gpgGroups = EnigmailGpg.getGpgGroups();

      // resolve GnuPG groups
      for (let i = 0; i < addresses.length; i++) {
        let addr = addresses[i].toLowerCase();
        for (let j = 0; j < gpgGroups.length; j++) {
          if (addr == gpgGroups[j].alias.toLowerCase() ||
            "<" + addr + ">" == gpgGroups[j].alias.toLowerCase()) {
            // replace address with keylist
            var grpList = gpgGroups[j].keylist.split(/;/);
            addresses[i] = grpList[0];
            for (var k = 1; k < grpList.length; k++) {
              addresses.push(grpList[k]);
            }
          }
        }
      }

      // check whether each address is or has a key:
      keyMissing = false;
      if (details) {
        details.errArray = [];
      }
      for (let i = 0; i < addresses.length; i++) {
        let addr = addresses[i];
        // try to find current address in key list:
        var found = false;
        var errMsg = null;
        if (addr.indexOf('@') >= 0) {
          // try email match:
          var addrErrDetails = {};
          let key = EnigmailKeyRing.getValidKeyForRecipient(addr, minTrustLevelIndex, addrErrDetails);
          if (details && addrErrDetails.msg) {
            errMsg = addrErrDetails.msg;
          }
          if (key) {
            found = true;
            resultingArray.push("0x" + key.toUpperCase());
          }
        }
        else {
          // try key match:
          let key = addr;
          if (addr.search(/^0x/i) === 0) {
            key = addr.substring(2); // key list has elements without leading "0x"
          }
          var keyObj = keyList[key.toUpperCase()]; // note: keylist has keys with uppercase only

          if (!keyObj && addr.search(/^0x[A-F0-9]{8}([A-F0-9]{8})*$/i) === 0) {
            // we got a key ID, probably from gpg.conf?

            key = key.substr(-16, 16);

            for (let j in keyList) {
              if (j.endsWith(key)) {
                keyObj = keyList[j];
                break;
              }
            }
          }
          if (keyObj) {
            var keyTrust = keyObj.keyTrust;
            // if found, check whether the trust level is enough
            if (TRUSTLEVELS_SORTED.indexOf(keyTrust) >= minTrustLevelIndex) {
              found = true;
              resultingArray.push(addr);
            }
          }
        }
        if (!found) {
          // no key for this address found
          keyMissing = true;
          if (details) {
            if (!errMsg) {
              errMsg = "ProblemNoKey";
            }
            var detailsElem = {};
            detailsElem.addr = addr;
            detailsElem.msg = errMsg;
            details.errArray.push(detailsElem);
          }
          EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): return null (no single valid key found for=\"" + addr + "\" with minTrustLevel=\"" + minTrustLevel +
            "\")\n");
        }
      }
    }
    catch (ex) {
      EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): return null (exception: " + ex.description + ")\n");
      return null;
    }
    EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): return \"" + resultingArray + "\"\n");
    if (keyMissing) {
      return null;
    }
    return resultingArray;
  },



  /**
   * processConflicts
   * - handle sign/encrypt/pgpMime conflicts if any
   * - NOTE: conflicts result into disabling the feature (0/never)
   * Input parameters:
   *  @encrypt: email would currently get encrypted
   *  @sign:    email would currently get signed
   * @return:  false if error occurred or processing was canceled
   */
  processConflicts: function(encrypt, sign) {
    // process message about whether we still sign/encrypt
    var msg = "";
    msg += "\n" + "- " + EnigmailLocale.getString(encrypt ? "encryptYes" : "encryptNo");
    msg += "\n" + "- " + EnigmailLocale.getString(sign ? "signYes" : "signNo");
    if (EnigmailPrefs.getPref("warnOnRulesConflict") == 2) {
      EnigmailPrefs.setPref("warnOnRulesConflict", 0);
    }
    if (!EnigmailDialog.confirmPref(window, EnigmailLocale.getString("rulesConflict", [msg]), "warnOnRulesConflict")) {
      return false;
    }
    return true;
  },


  /**
   * determine invalid recipients as returned from GnuPG
   *
   * @gpgMsg: output from GnuPG
   *
   * @return: space separated list of invalid addresses
   */
  getInvalidAddress: function(gpgMsg) {
    EnigmailLog.DEBUG("enigmailMsgComposeHelper.js: getInvalidAddress(): gpgMsg=\"" + gpgMsg + "\"\n\n");
    var invalidAddr = [];
    var lines = gpgMsg.split(/[\n\r]+/);
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^(INV_RECP \d+ )(.*)$/);
      if (m && m.length == 3) {
        invalidAddr.push(EnigmailFuncs.stripEmail(m[2].toLowerCase()));
      }
    }
    return invalidAddr.join(" ");
  }

};
