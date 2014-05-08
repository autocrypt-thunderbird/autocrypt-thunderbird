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

Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");

if (! Enigmail) var Enigmail = {};

var enigValidityKeyList = null;
var enigValidityKeySortList = null;

Enigmail.hlp = {

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
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js:   getFlagVal(): oldVal="+oldVal+" newVal="+newVal+" type=\""+type+"\"\n");

    // conflict remains conflict
    if (oldVal==3) {
      return 3;  // conflict
    }

    // 'never' and 'always' triggers conflict:
    if ((oldVal==2 && newVal==0) || (oldVal==0 && newVal==2)) {
      return 3;  // conflict
    }

    // if there is any 'never' return 'never'
    // - thus: 'never' and 'maybe' => 'never'
    if (oldVal==0 || newVal==0) {
      return 0;  // never
    }

    // if there is any 'always' return 'always'
    // - thus: 'always' and 'maybe' => 'always'
    if (oldVal==2 || newVal==2) {
      return 2;  // always
    }

    // here, both values are 'maybe', which we return then
    return 1;  // maybe
  },


  /**
    * process resulting sign/encryp/pgpMime mode for passed emailAddrs and
    * use rules and interactive dialog to replace emailAddrs by known keys
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
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: getRecipientsKeys(): emailAddrs=\""+emailAddrs+"\" interactive="+interactive+" forceRecipientSettings="+forceRecipientSettings+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var enigmailSvc = EnigmailCommon.getService();
    if (!enigmailSvc) {
      return false;
    }

    // initialize return value and the helper variables for them:
    matchedKeysObj.value = "";
    flagsObj.value = 0;
    var sign   =1;  // default sign flag is: maybe
    var encrypt=1;  // default encrypt flag is: maybe
    var pgpMime=1;  // default pgpMime flag is: maybe

    var addresses="{"+EnigmailFuncs.stripEmail(emailAddrs.toLowerCase()).replace(/[, ]+/g, "}{")+"}";
    var keyList=new Array;

    var rulesListObj= new Object;
    var foundAddresses="";

    // process recipient rules
    if (enigmailSvc.getRulesData(rulesListObj)) {

      var rulesList=rulesListObj.value;

      if (rulesList.firstChild.nodeName=="parsererror") {
        EnigmailCommon.alert(window, "Invalid pgprules.xml file:\n"+ rulesList.firstChild.textContent);
        return false;
      }
      EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: getRecipientsKeys(): rules successfully loaded; now process them\n");

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
                for(var addrIndex=0; addrIndex < addrList.length; addrIndex++) {
                  var email=addrList[addrIndex];
                  var i=addresses.indexOf(email);
                  while (i>=0) {
                    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: getRecipientsKeys(): got matching rule for \""+email+"\"\n");

                    sign    = this.getFlagVal(sign,    node, "sign");
                    encrypt = this.getFlagVal(encrypt, node, "encrypt");
                    pgpMime = this.getFlagVal(pgpMime, node, "pgpMime");

                    // extract found address
                    var keyIds=node.getAttribute("keyId");

                    var start=addresses.substring(0,i+email.length).lastIndexOf("{");
                    var end=start+addresses.substring(start).indexOf("}")+1;
                    foundAddresses+=addresses.substring(start,end);
                    if (keyIds) {
                      if (keyIds != ".") {
                        keyList.push(keyIds.replace(/[ ,;]+/g, ", "));
                      }
                      addresses=addresses.substring(0,start)+addresses.substring(end);
                      i=addresses.indexOf(email);
                    }
                    else {
                      var oldMatch=i;
                      i=addresses.substring(oldMatch+email.length).indexOf(email);
                      if (i>=0) i+=oldMatch+email.length;
                    }
                  }
                }
              }
              else {
                // "not" rule
                addrList = addresses.replace(/\}\{/g, "},{").split(/,/);
                for (i=0; i<addrList.length; i++) {
                  if (nodeText.toLowerCase().indexOf(addrList[i])>=0) {
                    i=addrList.length+2;
                    break;
                  }
                }
                if (i==addrList.length) {
                  // no matching address; apply rule
                  sign    = this.getFlagVal(sign,    node, "sign");
                  encrypt = this.getFlagVal(encrypt, node, "encrypt");
                  pgpMime = this.getFlagVal(pgpMime, node, "pgpMime");
                  keyIds=node.getAttribute("keyId");
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
      var inputObj=new Object;
      var resultObj=new Object;
      for (i=0; i<addrList.length; i++) {
        if (addrList[i].length>0) {
          var theAddr=EnigmailFuncs.stripEmail(addrList[i]).toLowerCase();
          if ((foundAddresses.indexOf("{"+theAddr+"}")==-1) &&
              (! (theAddr.indexOf("0x")==0 && theAddr.indexOf("@")==-1))) {
            inputObj.toAddress="{"+theAddr+"}";
            inputObj.options="";
            inputObj.command = "add";
            window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
            if (resultObj.cancelled==true) {
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
                var replaceAddr=new RegExp("{"+addrList[i]+"}", "g");
                addresses=addresses.replace(replaceAddr, "");
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
      matchedKeysObj.value += addresses.replace(/\{/g, ", ").replace(/\}/g, "");
    }

    // return result from combining flags
    flagsObj.sign = sign;
    flagsObj.encrypt = encrypt;
    flagsObj.pgpMime = pgpMime;
    flagsObj.value = 1;

    return true;
  },

  /* try to find valid key to passed email address
   * @return: list of all found key (with leading "0x") or null
   */
  validKeysForAllRecipients: function (emailAddrs, refresh)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): emailAddrs=\""+emailAddrs+"\" refresh=\""+refresh+"\"\n");
    if (emailAddrs.indexOf('@') < 0) {
      return null;
    }

    // check whether and how auto-encryption is enabled
    var autoSendEncrypted = EnigmailCommon.getPref("autoSendEncrypted");
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: validKeysForAllRecipients(): autoSendEncrypted=\""+autoSendEncrypted+"\"\n");
    if (!autoSendEncrypted) {
      return null;
    }
    var acceptedKeys = EnigmailCommon.getPref("acceptedKeys");
    var minTrustLevel;
    switch (autoSendEncrypted) {
      case 0:  // EncNever
        return null;
        break;
      case 1:  // EncIfValid
        switch (acceptedKeys) {
          case 0: // accept valid/authenticated keys only
            minTrustLevel = "f";
            break; 
          case 1: // accept all but revoked/disabled/expired keys
            minTrustLevel = "-";
            break; 
          default:
            EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: validKeysForAllRecipients(): INVALID VALUE for acceptedKeys: \""+acceptedKeys+"\"\n");
            return null;
            break;
        }
        break;
      default:
        EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: validKeysForAllRecipients(): INVALID VALUE for autoSendEncrypted: \""+autoSendEncrypted+"\"\n");
        return null;
        break;
    }

    const TRUSTLEVEL_SORTED="indDrego-qmfu"; // trust level sorted by increasing level of trust (see commonFuncs.jsm)
    var minTrustLevelIndex = TRUSTLEVEL_SORTED.indexOf(minTrustLevel);
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): with minTrustLevel=\""+minTrustLevel+"\"\n");

    var resultingArray = new Array;  // resulting key list (if all valid)
    try {
      // get list of known keys
      if (!keyList || refresh) {
        var keyListObj = {};
        EnigmailFuncs.loadKeyList(window, 
                                  false,        // do not refresh key infos,
                                  keyListObj,   // returned list
                                  "validity",   // sorted acc. to key validity
                                  -1);          // descending
        enigValidityKeyList = keyListObj.keyList;
        enigValidityKeySortList = keyListObj.keySortList;
      }
      var keyList = enigValidityKeyList;
      var keySortList = enigValidityKeySortList;

      // create array of address elements (email or key)
      var addresses=EnigmailFuncs.stripEmail(emailAddrs).split(',');

      // check whether each address is or has a key:
      for (var i=0; i < addresses.length; i++) {
        var addr = addresses[i];
        // try to find current address in key list: 
        var found = false;
        if (addr.indexOf('@') >= 0) {
          // try email match:
          var key = this.getValidKeyForRecipient (addr, minTrustLevelIndex, keyList, keySortList);
          if (key) {
            found = true;
            resultingArray.push("0x"+key);
          }
        }
        else {
          // try key match:
          var key = addr.substring(2);  // key list has elements without leading "0x"
          var keyObj = keyList[key];
          //var userId = keyObj.userId;
          var keyTrust = keyObj.keyTrust;
          //var ownerTrust = keyObj.ownerTrust;
          // if found, check whether the trust level is enough
          if (TRUSTLEVEL_SORTED.indexOf(keyTrust) >= minTrustLevelIndex) {
            found = true;
            resultingArray.push(addr);
          }
        }
        if (! found) {
          // no key for this address found
          EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): no valid key found for=\""+addr+"\" with minTrustLevel=\""+minTrustLevel+"\"\n");
          return null;
        }
      }
    }
    catch (ex) {
      EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): exception: "+ex.description+"\n");
      return null;
    }
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: validKeysForAllRecipients(): return: resultingArray=\""+resultingArray+"\"\n");
    return resultingArray;
  },

  /* try to find valid key to passed email address
   * @return: found key (without leading "0x") or null
   */
  getValidKeyForRecipient: function (emailAddr, minTrustLevelIndex, keyList, keySortList)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: getValidKeyForRecipient(): emailAddr=\""+emailAddr+"\"\n");
    const TRUSTLEVEL_SORTED="oidreDn-qmfu"; // trust level sorted by increasing level of trust (see commonFuncs.jsm)

    for (var idx=0; idx<keySortList.length; idx++) { // note: we have sorted acc. to validity
      var keyObj = keyList[keySortList[idx].keyId];
      var keyTrust = keyObj.keyTrust;
      // end of loop: key trust (our sort criterion) too low?
      if (TRUSTLEVEL_SORTED.indexOf(keyTrust) < minTrustLevelIndex) {
        return null;  // NOT FOUND (below requested trust level)
      }

      //var ownerTrust = keyObj.ownerTrust;
      //var expired = keyObj.expiry;
      var userId = keyObj.userId;
      if (userId && userId.indexOf(emailAddr) >= 0 
          && TRUSTLEVEL_SORTED.indexOf(keyTrust) >= minTrustLevelIndex) { 
        return keyObj.keyId; // FOUND 
      }

      // check whether matching subkeys exist
      // - Note: subkeys have NO owner trust
      for (var subkey=0; subkey<keyObj.SubUserIds.length; subkey++) {
        var subKeyObj = keyObj.SubUserIds[subkey];
        var subUserId = subKeyObj.userId;
        var subKeyTrust = subKeyObj.keyTrust;
        //var subExpired = subKeyObj.expiry;
        if (subUserId && subUserId.indexOf(emailAddr) >= 0) {
          if (TRUSTLEVEL_SORTED.indexOf(subKeyTrust) >= minTrustLevelIndex) {
            return keyObj.keyId; // FOUND 
          }
        }
      }
    }
    return null;  // not found
  },

  /**
    * processConflicts
    * - handle sign/encrypt/pgpMime conflicts if any
    * - NOTE: conflicts result into disabling the feature (0/never)
    * Input parameters:
    *  @flagsObj:       combined sign/encrype/pgpMime mode
    *                   values might be: 0='never', 1='maybe', 2='always', 3='conflict'
    *  @interactive:    false: skip all interaction
    * Output parameters:
    *  @flagsObj:       resulting sign/encrype/pgpMime mode
    *
    * @return:  false if error occurred or processing was canceled
    */
  processConflicts: function (flagsObj, interactive)
  {
    // - pgpMime conflicts always result into pgpMime = 0/'never'
    if (flagsObj.pgpMime == 3) {
      flagsObj.pgpMime = 0;
    }
    // - encrypt/sign conflicts result into result 0/'never'
    //   with possible dialog to give a corresponding feedback
    var conflictFound = false;
    if (flagsObj.sign == 3) {
      flagsObj.sign = 0;
      conflictFound = true;
    }
    if (flagsObj.encrypt == 3) {
      flagsObj.encrypt = 0;
      conflictFound = true;
    }
    if (interactive && conflictFound) {
      var sign = flagsObj.sign;
      var encrypt = flagsObj.encrypt;
      // process message about whether we still sign/encrypt
      // - if the sign flag is 1/maybe, signing depends on the general setting
      if (sign==1) sign = (Enigmail.msg.sendMode & nsIEnigmail.SEND_SIGNED ? 2 : 0);
      // - if the encrypt flag is 1/maybe, encrypting depends on the general setting
      if (encrypt==1) encrypt = (Enigmail.msg.sendMode & nsIEnigmail.SEND_ENCRYPTED ? 2 : 0);
      var msg = "\n"+"- " + EnigmailCommon.getString(sign>0 ? "signYes" : "signNo");
      msg += "\n"+"- " + EnigmailCommon.getString(encrypt>0 ? "encryptYes" : "encryptNo");
      if (EnigmailCommon.getPref("warnOnRulesConflict")==2) {
        EnigmailCommon.setPref("warnOnRulesConflict", 0);
      }
      if (!EnigmailCommon.confirmPref(window, EnigmailCommon.getString("rulesConflict", [ msg ]), "warnOnRulesConflict")) {
        return false;
      }
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
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js: getInvalidAddress(): gpgMsg=\""+gpgMsg+"\"\n\n");
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
