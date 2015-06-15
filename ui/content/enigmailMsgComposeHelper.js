dump("loading: enigmailMsgComposeHelper.js\n");
/*global Components: false, Dialog: false */
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

Components.utils.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/enigmailFuncs.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/prefs.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Components.utils.import("resource://enigmail/trust.jsm"); /*global Trust: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global Constants: false */

if (! Enigmail) var Enigmail = {};

Enigmail.hlp = {

  enigValidityKeyList: null,
  enigValidityKeySortList: null,

  /**
    *  check for the attribute of type "sign"/"encrypt"/"pgpMime" of the passed node
    *  and combine its value with oldVal and check for conflicts
    *    values might be: 0='never', 1='maybe', 2='always', 3='conflict'
    *  @oldVal:      original input value
    *  @node:        node of the rule in the DOM tree
    *  @type:        rule type name
    *  @return: result value after applying the rule (0/1/2)
    *           and combining it with oldVal
    */
  getFlagVal: function (oldVal, node, type)
  {
    var newVal = Number(node.getAttribute(type));
    Log.DEBUG("enigmailMsgComposeHelper.js:    getFlagVal(): oldVal="+oldVal+" newVal="+newVal+" type=\""+type+"\"\n");

    // conflict remains conflict
    if (oldVal === Constants.ENIG_CONFLICT) {
      return Constants.ENIG_CONFLICT;
    }

    // 'never' and 'always' triggers conflict:
    if ((oldVal === Constants.ENIG_NEVER && newVal === Constants.ENIG_ALWAYS) || (oldVal === Constants.ENIG_ALWAYS && newVal === Constants.ENIG_NEVER)) {
      return Constants.ENIG_CONFLICT;
    }

    // if there is any 'never' return 'never'
    // - thus: 'never' and 'maybe' => 'never'
    if (oldVal === Constants.ENIG_NEVER || newVal === Constants.ENIG_NEVER) {
      return Constants.ENIG_NEVER;
    }

    // if there is any 'always' return 'always'
    // - thus: 'always' and 'maybe' => 'always'
    if (oldVal === Constants.ENIG_ALWAYS || newVal === Constants.ENIG_ALWAYS) {
      return Constants.ENIG_ALWAYS;
    }

    // here, both values are 'maybe', which we return then
    return Constants.ENIG_UNDEF;  // maybe
  },


  /**
    * process resulting sign/encryp/pgpMime mode for passed emailAddrs and
    * use rules and interactive rule dialog to replace emailAddrs by known keys
    * Input parameters:
    *  @interactive:            false: skip all interaction
    *  @forceRecipientSettings: force recipients settings for each missing key (if interactive==true)
    * Output parameters:
    *   @matchedKeysObj: return value for matched keys and remaining email addresses for which no key was found
    *   @flagsObj:       return value for combined sign/encrype/pgpMime mode
    *                    values might be: 0='never', 1='maybe', 2='always', 3='conflict'
    *
    * @return:  false if error occurred or processing was canceled
    */
  getRecipientsKeys: function (emailAddrs, interactive, forceRecipientSettings, matchedKeysObj, flagsObj)
  {
    Log.DEBUG("enigmailMsgComposeHelper.js: getRecipientsKeys(): emailAddrs=\""+emailAddrs+"\" interactive="+interactive+" forceRecipientSettings="+forceRecipientSettings+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var enigmailSvc = EnigmailCore.getService();
    if (!enigmailSvc) {
      return false;
    }

    // initialize return value and the helper variables for them:
    matchedKeysObj.value = "";
    flagsObj.value = false;
    var sign    = Constants.ENIG_UNDEF;  // default sign flag is: maybe
    var encrypt = Constants.ENIG_UNDEF;  // default encrypt flag is: maybe
    var pgpMime = Constants.ENIG_UNDEF;  // default pgpMime flag is: maybe

    // list of addresses not processed
    // - string with { and } around each email to enable pattern matching with rules
    var openAddresses = "{"+EnigmailFuncs.stripEmail(emailAddrs.toLowerCase()).replace(/[, ]+/g, "}{")+"}";
    var foundAddresses = "";  // string of found addresses with { and } around
    var keyList = [];  // list of keys found for all Addresses

    var rulesListObj= {};

    var i;
    // process recipient rules
    if (enigmailSvc.getRulesData(rulesListObj)) {

      var rulesList=rulesListObj.value;

      if (rulesList.firstChild.nodeName=="parsererror") {
        Dialog.alert(window, "Invalid pgprules.xml file:\n"+ rulesList.firstChild.textContent);
        return false;
      }
      Log.DEBUG("enigmailMsgComposeHelper.js: getRecipientsKeys(): rules successfully loaded; now process them\n");
      // go through all rules to find match with email addresses
      var node=rulesList.firstChild.firstChild;
      while (node) {
        if (node.tagName=="pgpRule") {
          try {
            var nodeText=node.getAttribute("email");
            if (nodeText) {
              var negateRule = false;
              if (node.getAttribute("negateRule")) {
                negateRule = Number(node.getAttribute("negateRule"));
              }
              if (! negateRule) {
                // normal rule
                addrList=nodeText.toLowerCase().split(/[ ,;]+/);
                for (var addrIndex=0; addrIndex < addrList.length; addrIndex++) {
                  var email = addrList[addrIndex];
                  let idx = openAddresses.indexOf(email);
                  while (idx >= 0) {
                    Log.DEBUG("enigmailMsgComposeHelper.js: getRecipientsKeys(): got matching rule for \""+email+"\"\n");

                    // process sign/sncrypt/ppgMime settings
                    sign    = this.getFlagVal(sign,    node, "sign");
                    encrypt = this.getFlagVal(encrypt, node, "encrypt");
                    pgpMime = this.getFlagVal(pgpMime, node, "pgpMime");

                    // process keys
                    let keyIds = node.getAttribute("keyId");
                    if (keyIds) {
                      if (keyIds != ".") {  // if NOT "do not check further rules for this address"
                        keyList.push(keyIds.replace(/[ ,;]+/g, ", "));
                      }
                      let start = openAddresses.substring(0, idx+email.length).lastIndexOf("{");
                      let end   = start + openAddresses.substring(start).indexOf("}")+1;
                      foundAddresses += openAddresses.substring(start,end);
                      openAddresses = openAddresses.substring(0,start) + openAddresses.substring(end);
                      idx = openAddresses.indexOf(email);
                    }
                    else {
                      var oldMatch = idx;
                      idx = openAddresses.substring(oldMatch+email.length).indexOf(email);
                      if (idx>=0) {
                        idx += oldMatch + email.length;
                      }
                    }
                  }
                }
              }
              else {
                // "not" rule
                addrList = openAddresses.replace(/\}\{/g, "},{").split(/,/);
                var idx;
                for (idx = 0; idx < addrList.length; idx++) {
                  if (nodeText.toLowerCase().indexOf(addrList[idx])>=0) {
                    idx = addrList.length+2;
                    break;
                  }
                }
                if (idx == addrList.length) {
                  // no matching address; apply rule
                  sign    = this.getFlagVal(sign,    node, "sign");
                  encrypt = this.getFlagVal(encrypt, node, "encrypt");
                  pgpMime = this.getFlagVal(pgpMime, node, "pgpMime");
                  let keyIds=node.getAttribute("keyId");
                  if (keyIds) {
                    if (keyIds != ".") {
                      keyList.push(keyIds.replace(/[ ,;]+/g, ", "));
                    }
                  }
                }
              }
            }
         }
         catch (ex) {}
        }
        node = node.nextSibling;
      }
    }

    // if interactive and requested: start individual recipient settings dialog for each missing key
    if (interactive && forceRecipientSettings) {
      var addrList=emailAddrs.split(/,/);
      var inputObj={};
      var resultObj={};
      for (i=0; i<addrList.length; i++) {
        if (addrList[i].length>0) {
          var theAddr=EnigmailFuncs.stripEmail(addrList[i]).toLowerCase();
          if ((foundAddresses.indexOf("{"+theAddr+"}")==-1) &&
              (! (theAddr.indexOf("0x")===0 && theAddr.indexOf("@")==-1))) {
            inputObj.toAddress="{"+theAddr+"}";
            inputObj.options="";
            inputObj.command = "add";
            window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
            if (resultObj.cancelled===true) {
              return false;
            }

            // create a getAttribute() function for getFlagVal to work normally
            resultObj.getAttribute = function(attrName) {
              return this[attrName];
            };
            if (!resultObj.negate) {
              sign    = this.getFlagVal(sign,    resultObj, "sign");
              encrypt = this.getFlagVal(encrypt, resultObj, "encrypt");
              pgpMime = this.getFlagVal(pgpMime, resultObj, "pgpMime");
              if (resultObj.keyId.length>0) {
                keyList.push(resultObj.keyId);
                var replaceAddr = new RegExp("{"+addrList[i]+"}", "g");
                openAddresses = openAddresses.replace(replaceAddr, "");
              }
              else {
                // no key -> no encryption
                encrypt=0;
              }
            }
          }
        }
      }
    }

    if (keyList.length>0) {
      // sort key list and make it unique?
      matchedKeysObj.value = keyList.join(", ");
      matchedKeysObj.value += openAddresses.replace(/\{/g, ", ").replace(/\}/g, "");
    }

    // return result from combining flags
    flagsObj.sign = sign;
    flagsObj.encrypt = encrypt;
    flagsObj.pgpMime = pgpMime;
    flagsObj.value = true;

    return true;
  },


  /* try to find valid key to passed email address
   * @return: list of all found key (with leading "0x") or null
   *          details in details parameter
   */
  validKeysForAllRecipients: function (emailsOrKeys, details)
  {
    Log.DEBUG("=====> validKeysForAllRecipients()\n");
    Log.DEBUG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): emailsOrKeys='"+emailsOrKeys+"'\n");

    // check whether to use our internal cache
    var resultingArray = null;
    resultingArray = this.doValidKeysForAllRecipients(emailsOrKeys,details);

    Log.DEBUG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): return '"+resultingArray+"'\n");
    Log.DEBUG("  <=== validKeysForAllRecipients()\n");
    return resultingArray;
  },

  doValidKeysForAllRecipients: function (emailsOrKeys, details)
  {
    Log.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): emailsOrKeys='"+emailsOrKeys+"'\n");

    // check which keys are accepted
    var minTrustLevel;
    var acceptedKeys = Prefs.getPref("acceptedKeys");
    switch (acceptedKeys) {
      case 0: // accept valid/authenticated keys only
        minTrustLevel = "f";  // first value for trusted keys
        break;
      case 1: // accept all but revoked/disabled/expired keys
        minTrustLevel = "?";  // value between invalid and unknown keys
        break;
      default:
        Log.DEBUG("enigmailMsgComposeOverlay.js: doValidKeysForAllRecipients(): return null (INVALID VALUE for acceptedKeys: \""+acceptedKeys+"\")\n");
        return null;
    }

    const TRUSTLEVELS_SORTED = Trust.trustLevelsSorted();
    var minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf(minTrustLevel);
    Log.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): find keys with minTrustLevel=\""+minTrustLevel+"\"\n");

    var resultingArray = [];  // resulting key list (if all valid)
    var keyMissing;
    try {
      // get list of known keys
      if (!keyList) {
        var keyListObj = {};
        KeyRing.loadKeyList(window,
                            false,      // refresh key infos if required
                            keyListObj,   // returned list
                            "validity",   // sorted acc. to key validity
                            -1);          // descending
        this.enigValidityKeyList = keyListObj.keyList;
        this.enigValidityKeySortList = keyListObj.keySortList;
      }
      var keyList = this.enigValidityKeyList;
      var keySortList = this.enigValidityKeySortList;

      // ****** DEBUG ************** print keyList (debug issue)
      //Log.DEBUG("                   keyList:\n");
      //Log.DEBUG("                   length:  "+ keySortList.length + "\n");
      //for (var idx=0; idx<keySortList.length; idx++) { // note: we have sorted acc. to validity
      //  var keyObj = keyList[keySortList[idx].keyId];
      //  Log.DEBUG("                   [" + idx + "].keyId:  "+ keyObj.keyId + "\n");
      //  Log.DEBUG("                   [" + idx + "].userId: "+ keyObj.userId + "\n");
      //}

      // create array of address elements (email or key)
      var addresses=EnigmailFuncs.stripEmail(emailsOrKeys).split(',');

      var gpgGroups = Gpg.getGpgGroups();

      // resolve GnuPG groups
      for (let i=0; i < addresses.length; i++) {
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
      for (let i=0; i < addresses.length; i++) {
        let addr = addresses[i];
        // try to find current address in key list:
        var found = false;
        var errMsg = null;
        if (addr.indexOf('@') >= 0) {
          // try email match:
          var addrErrDetails = {};
          let key = this.getValidKeyForRecipient (addr, minTrustLevelIndex, keyList, keySortList, addrErrDetails);
          if (details && addrErrDetails.msg) {
            errMsg = addrErrDetails.msg;
          }
          if (key) {
            found = true;
            resultingArray.push("0x"+key.toUpperCase());
          }
        }
        else {
          // try key match:
          let key = addr;
          if (addr.search(/^0x/i) === 0) {
            key = addr.substring(2);  // key list has elements without leading "0x"
          }
          var keyObj = keyList[key.toUpperCase()];  // note: keylist has keys with uppercase only

          if (! keyObj && addr.search(/^0x[A-F0-9]{8}([A-F0-9]{8})*$/i) === 0) {
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
        if (! found) {
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
          Log.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): return null (no single valid key found for=\""+addr+"\" with minTrustLevel=\""+minTrustLevel+"\")\n");
        }
      }
    }
    catch (ex) {
      Log.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): return null (exception: "+ex.description+")\n");
      return null;
    }
    Log.DEBUG("enigmailMsgComposeHelper.js: doValidKeysForAllRecipients(): return \""+resultingArray+"\"\n");
    if (keyMissing) {
      return null;
    }
    return resultingArray;
  },


  /* try to find valid key for encryption to passed email address
   * @param details if not null returns error in details.msg
   * @return: found key (without leading "0x") or null
   */
  getValidKeyForRecipient: function (emailAddr, minTrustLevelIndex, keyList, keySortList, details)
  {
    Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient(): emailAddr=\""+emailAddr+"\"\n");
    const TRUSTLEVELS_SORTED = Trust.trustLevelsSorted();
    const fullTrustIndex = TRUSTLEVELS_SORTED.indexOf("f");

    emailAddr = emailAddr.toLowerCase();
    var embeddedEmailAddr = "<" + emailAddr +">";

    // note: we can't take just the first matched because we might have faked keys as duplicates
    var foundKeyId = null;
    var foundTrustLevel = null;

    // **** LOOP to check against each key
    // - note: we have sorted the keys according to validity
    //         to abort the loop as soon as we reach keys that are not valid enough
    for (var idx=0; idx<keySortList.length; idx++) {
      var keyObj = keyList[keySortList[idx].keyId];
      var keyTrust = keyObj.keyTrust;
      var keyTrustIndex = TRUSTLEVELS_SORTED.indexOf(keyTrust);
      //Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  check key " + keyObj.keyId + "\n");

      // key trust (our sort criterion) too low?
      // => *** regular END of the loop
      if (keyTrustIndex < minTrustLevelIndex) {
        if (!foundKeyId) {
          if (details) {
            details.msg = "ProblemNoKey";
          }
          let msg = "no key with enough trust level for '" + emailAddr + "' found";
          Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  " + msg + "\n");
        }
        return foundKeyId;  // **** regular END OF LOOP (return NULL or found single key)
      }

      // key valid for encryption?
      if (keyObj.keyUseFor.indexOf("E") < 0) {
        //Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  skip key " + keyObj.keyId + " (not provided for encryption)\n");
        continue;  // not valid for encryption => **** CONTINUE the LOOP
      }
      // key disabled?
      if (keyObj.keyUseFor.indexOf("D") >= 0) {
        //Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  skip key " + keyObj.keyId + " (disabled)\n");
        continue;  // disabled => **** CONTINUE the LOOP
      }

      // check against the user ID
      var userId = keyObj.userId.toLowerCase();
      if (userId && (userId == emailAddr || userId.indexOf(embeddedEmailAddr) >= 0)) {
        if (keyTrustIndex < minTrustLevelIndex) {
          Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  matching key="+keyObj.keyId+" found but not enough trust\n");
        }
        else {
          // key with enough trust level found
          Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  key="+keyObj.keyId+" keyTrust=\""+keyTrust+"\" found\n");

          // immediately return if a fully or ultimately trusted key is found
          // (faked keys should not be an issue here, so we don't have to check other keys)
          if (keyTrustIndex >= fullTrustIndex) {
            return keyObj.keyId;
          }

          if (foundKeyId != keyObj.keyId) {
            // new matching key found (note: might find same key via subkeys)
            if (foundKeyId) {
              // different matching keys found
              if (foundKeyTrustIndex > keyTrustIndex) {
                return foundKeyId;   // OK, previously found key has higher trust level
              }
              // error because we have two keys with same trust level
              // => let the user decide (to prevent from using faked keys with default trust level)
              if (details) {
                details.msg = "ProblemMultipleKeys";
              }
              let msg = "multiple matching keys with same trust level found for '" + emailAddr + "' ";
              Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  " + msg +
                                       " trustLevel=\"" + keyTrust + "\" (0x" + foundKeyId + " and 0x" + keyObj.keyId + ")\n");
              return null;
            }
            // save found key to compare with other matching keys (handling of faked keys)
            foundKeyId = keyObj.keyId;
            foundKeyTrustIndex = keyTrustIndex;
          }
          continue;  // matching key found (again) => **** CONTINUE the LOOP (don't check Sub-UserIDs)
        }
      }

      // check against the sub user ID
      // (if we are here, the primary user ID didn't match)
      // - Note: sub user IDs have NO owner trust
      for (var subUidIdx=0; subUidIdx<keyObj.SubUserIds.length; subUidIdx++) {
        var subUidObj = keyObj.SubUserIds[subUidIdx];
        var subUserId = subUidObj.userId.toLowerCase();
        var subUidTrust = subUidObj.keyTrust;
        var subUidTrustIndex = TRUSTLEVELS_SORTED.indexOf(subUidTrust);
        //Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  check subUid " + subUidObj.keyId + "\n");

        if (subUserId && (subUserId == emailAddr || subUserId.indexOf(embeddedEmailAddr) >= 0)) {
          if (subUidTrustIndex < minTrustLevelIndex) {
            Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  matching subUid="+keyObj.keyId+" found but not enough trust\n");
          }
          else {
            // subkey with enough trust level found
            Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  matching subUid in key="+keyObj.keyId+" keyTrust=\""+keyTrust+"\" found\n");

            if (keyTrustIndex >= fullTrustIndex) {
              // immediately return if a fully or ultimately trusted key is found
              // (faked keys should not be an issue here, so we don't have to check other keys)
              return keyObj.keyId;
            }

            if (foundKeyId != keyObj.keyId) {
              // new matching key found (note: might find same key via different subkeys)
              if (foundKeyId) {
                // different matching keys found
                if (foundKeyTrustIndex > subUidTrustIndex) {
                  return foundKeyId;   // OK, previously found key has higher trust level
                }
                // error because we have two keys with same trust level
                // => let the user decide (to prevent from using faked keys with default trust level)
                if (details) {
                  details.msg = "ProblemMultipleKeys";
                }
                let msg = "multiple matching keys with same trust level found for '" + emailAddr + "' ";
                Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  " + msg +
                                         " trustLevel=\"" + keyTrust + "\" (0x" + foundKeyId + " and 0x" + keyObj.keyId + ")\n");
                return null;
              }
              // save found key to compare with other matching keys (handling of faked keys)
              foundKeyId = keyObj.keyId;
              foundKeyTrustIndex = subUidTrustIndex;
            }
          }
        }
      }

    } // **** LOOP to check against each key

    if (!foundKeyId) {
      Log.DEBUG("enigmailMsgComposeHelper.js: getValidKeyForRecipient():  no key for '" + emailAddr + "' found\n");
    }
    return foundKeyId;
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
  processConflicts: function (encrypt, sign)
  {
    // process message about whether we still sign/encrypt
    var msg = "";
    msg += "\n"+"- " + Locale.getString(encrypt ? "encryptYes" : "encryptNo");
    msg += "\n"+"- " + Locale.getString(sign ? "signYes" : "signNo");
    if (Prefs.getPref("warnOnRulesConflict")==2) {
      Prefs.setPref("warnOnRulesConflict", 0);
    }
    if (!Dialog.confirmPref(window, Locale.getString("rulesConflict", [ msg ]), "warnOnRulesConflict")) {
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
  getInvalidAddress: function (gpgMsg)
  {
    Log.DEBUG("enigmailMsgComposeHelper.js: getInvalidAddress(): gpgMsg=\""+gpgMsg+"\"\n\n");
    var invalidAddr = [];
    var lines = gpgMsg.split(/[\n\r]+/);
    for (var i=0; i < lines.length; i++) {
      var m = lines[i].match(/^(INV_RECP \d+ )(.*)$/);
      if (m && m.length == 3) {
        invalidAddr.push(EnigmailFuncs.stripEmail(m[2].toLowerCase()));
      }
    }
    return invalidAddr.join(" ");
  }

};
