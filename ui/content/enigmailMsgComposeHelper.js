/*
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
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net>
 * are Copyright (C) 2004 Patrick Brunschwig.
 * All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL") or the GNU 
 * Lesser General Public License (the "LGPL"), in which case
 * the provisions of the GPL or the LGPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL or the LGPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL or the 
 * LGPL respectively.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL, the
 * GPL or the LGPL.
 */


// helper functions for message composition

function getRecipientsKeys(emailAddrs, forceSelection, matchedKeysObj, flagsObj) {
  DEBUG_LOG("enigmailMsgComposeHelper.js: getRecipientsKeys: emailAddrs="+emailAddrs+"\n");

  function getFlagVal(oldVal, node, type, conflictObj) {
    var newVal = Number(node.getAttribute(type));

    if ((oldVal==2 && newVal==0) || (oldVal==0 && newVal==2)) {
      conflictObj[type] = 1;
    }
    
    if (oldVal==0 || newVal==0) {
      return 0;
    }
    else {
      return (oldVal < newVal ? newVal: oldVal);
    }
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return false;
    
  flagsObj.value = 0;
  matchedKeysObj.value = "";
  var encrypt=1;
  var sign   =1;
  var pgpMime=1;
  var conflicts = { sign: 0, encrypt: 0, pgpMime: 0};
  var addresses="{"+EnigStripEmail(emailAddrs.toLowerCase()).replace(/[, ]+/g, "}{")+"}";
  var keyList=new Array;

  var rulesListObj= new Object;
  var foundAddresses="";

  if (enigmailSvc.getRulesData(rulesListObj)) {

    var rulesList=rulesListObj.value;
  
    if (rulesList.firstChild.nodeName=="parsererror") {
      EnigAlert("Invalid enigmail.xml file:\n"+ rulesList.firstChild.textContent);
      return true;
    }
    DEBUG_LOG("enigmailMsgComposeHelper.js: getRecipientsKeys: keys loaded\n");
    var node=rulesList.firstChild.firstChild;
    while (node) {
      if (node.tagName=="pgpRule") {
        try {
          var nodeText=node.getAttribute("email");
          if (nodeText) {
            addrList=nodeText.toLowerCase().split(/[ ,;]+/);
            for(var addrIndex=0; addrIndex < addrList.length; addrIndex++) {
              var email=addrList[addrIndex];
              var i=addresses.indexOf(email);
              while (i>=0) {
                sign   =getFlagVal(sign,    node, "sign", conflicts);
                encrypt=getFlagVal(encrypt, node, "encrypt", conflicts);
                pgpMime=getFlagVal(pgpMime, node, "pgpMime", conflicts);
    
                // extract found address
                var keyIds=node.getAttribute("keyId");
                // EnigAlert("Found match with: "+email);
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
       }
       catch (ex) {}
      }
      node = node.nextSibling;
    }
  }
    
  if (EnigGetPref("perRecipientRules")>1 || forceSelection) {
    var addrList=emailAddrs.split(/,/);
    var inputObj=new Object;
    var resultObj=new Object;
    for (i=0; i<addrList.length; i++) {
      if (addrList[i].length>0) {
        var theAddr=EnigStripEmail(addrList[i]).toLowerCase();
        if (foundAddresses.indexOf("{"+theAddr+"}")==-1) {
          inputObj.toAddress="{"+theAddr+"}";
          inputObj.options="";
          inputObj.command = "add";
          window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
          if (resultObj.cancelled==true) return false;
          
          // create a getAttribute() function for getFlagVal to work normally
          resultObj.getAttribute = function(attrName) {
            return this[attrName]; 
          }
          sign   =getFlagVal(sign,    resultObj, "sign",    conflicts);
          encrypt=getFlagVal(encrypt, resultObj, "encrypt", conflicts);
          pgpMime=getFlagVal(pgpMime, resultObj, "pgpMime", conflicts);
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
  
  if (keyList.length>0) {
    // sort key list and make it unique?
    matchedKeysObj.value = keyList.join(", ");
    matchedKeysObj.value += addresses.replace(/\{/g, ", ").replace(/\}/g, "");
  }
  flagsObj.sign = sign;
  flagsObj.encrypt = encrypt;
  flagsObj.pgpMime = pgpMime;
  flagsObj.value = 1;

  if ((!EnigGetPref("confirmBeforeSend")) && (conflicts.encrypt ||conflicts.sign)) {
    if (sign<2) sign = (sign & (gEnigSendMode & ENIG_SIGN));
    if (encrypt<2) encrypt = (encrypt & (gEnigSendMode & ENIG_ENCRYPT ? 1 : 0));
    var msg = "\n"+"- " + EnigGetString(sign>0 ? "signYes" : "signNo");
    msg += "\n"+"- " + EnigGetString(encrypt>0 ? "encryptYes" : "encryptNo");
    if (EnigGetPref("warnOnRulesConflict")==2) {
      EnigSetPref("warnOnRulesConflict", 0);
    }
    if (!EnigConfirmPref(EnigGetString("rulesConflict", msg), "warnOnRulesConflict"))
      return false;
  }
  return true;
}

