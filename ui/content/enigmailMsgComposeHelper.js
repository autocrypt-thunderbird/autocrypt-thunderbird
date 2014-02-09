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

Enigmail.hlp = {

  /**
    *  check for the attribute of type "sign"/"encrypt"/"pgpMime" of the passed node
    *  and combine its value with oldVal and check for conflicts
    *    values might be: 0='never', 1='maybe', 2='always'
    *  @oldVal:      original input value
    *  @node:        node of the rule in the DOM tree
    *  @type:        rule type name
    *  @conflictObj: if a conflict is found, returns 1 for the corresponding type.
    *
    *  @return: result value after applying the rule (0/1/2)
    */
  getFlagVal: function (oldVal, node, type, conflictObj)
  {
    var newVal = Number(node.getAttribute(type));
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeHelper.js:   getFlagVal(): oldVal="+oldVal+" newVal="+newVal+" type=\""+type+"\"\n");

    // 'never' and 'always' triggers conflict:
    // - NOTE: we return 'never' on conflicts
    if ((oldVal==2 && newVal==0) || (oldVal==0 && newVal==2)) {
      conflictObj[type] = 1;
      return 0;
    }

    // if there is any 'never' return 'never'
    // - thus: 'never' and 'maybe' => 'never'
    if (oldVal==0 || newVal==0) {
      return 0;
    }

    // if there is any 'always' return 'always'
    // - thus: 'always' and 'maybe' => 'always'
    if (oldVal==2 || newVal==2) {
      return 2;
    }

    // here, both values are 'maybe', which we return then
    return 1;
  },


  /**
    * get keys and resulting sign/encryp/pgpMime mode for passed emailAddrs
    * Input parameters:
    *  @interactive:            false: skip all interaction
    *  @forceRecipientSettings: force recipients settings for each missing key (if interactive==true)
    *
    * output parameters:
    *   @matchedKeysObj: return value for matched keys
    *   @flagsObj:       return value for combined sign/encrype/pgpMime mode
    *
    * @return:  true, if keys found without error;  false if error occurred or processing was canceled
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
    var conflicts = { sign: 0, encrypt: 0, pgpMime: 0};  // no conflicts yet

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

                    sign    = this.getFlagVal(sign,    node, "sign", conflicts);
                    encrypt = this.getFlagVal(encrypt, node, "encrypt", conflicts);
                    pgpMime = this.getFlagVal(pgpMime, node, "pgpMime", conflicts);

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
                  sign    = this.getFlagVal(sign,    node, "sign", conflicts);
                  encrypt = this.getFlagVal(encrypt, node, "encrypt", conflicts);
                  pgpMime = this.getFlagVal(pgpMime, node, "pgpMime", conflicts);
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
              sign    = this.getFlagVal(sign,    resultObj, "sign",    conflicts);
              encrypt = this.getFlagVal(encrypt, resultObj, "encrypt", conflicts);
              pgpMime = this.getFlagVal(pgpMime, resultObj, "pgpMime", conflicts);
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

    // handle encrypt and sign conflicts
    // - NOTE: pgpMime conflicts silently return into pgpMime = 'never' (see getFlagVal())
    if (interactive && (!EnigmailCommon.getPref("confirmBeforeSend")) && (conflicts.encrypt || conflicts.sign)) {
      if (sign<2) sign = (sign & (Enigmail.msg.sendMode & nsIEnigmail.SEND_SIGNED));
      if (encrypt<2) encrypt = (encrypt & (Enigmail.msg.sendMode & nsIEnigmail.SEND_ENCRYPTED ? 1 : 0));
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
