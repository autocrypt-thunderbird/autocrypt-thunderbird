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
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net> are
 * Copyright (C) 2004 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */

// helper functions for message composition

function getRecipientsKeys(emailAddrs, forceSelection, matchedKeysObj, flagsObj) {

  function getFlagVal(oldVal, newVal) {
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
    
  flagsObj.value = -1;
  matchedKeysObj.value = "";
  var encrypt=1;
  var sign   =1;
  var pgpMime=1;
  var addresses="{"+EnigStripEmail(emailAddrs.toLowerCase()).replace(/[, ]+/g, "}{")+"}";
  var keyList=new Array;

  var rulesListObj= new Object;
  var foundAddresses="";

  if (enigmailSvc.getRulesData(rulesListObj)) {

    var rulesList=rulesListObj.value;
  
    if (rulesList.firstChild.nodeName=="parsererror") {
      EnigAlert("Invalid enigmail.xml file:\n"+ rulesList.firstChild.textContent);
      return 0;
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
                sign   =getFlagVal(sign,    node.getAttribute("sign"));
                encrypt=getFlagVal(encrypt, node.getAttribute("encrypt"));
                pgpMime=getFlagVal(pgpMime, node.getAttribute("pgpMime"));
    
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
        if (foundAddresses.indexOf("{"+EnigStripEmail(addrList[i]).toLowerCase()+"}")==-1) {
          inputObj.toAddress="{"+addrList[i]+"}";
          inputObj.options="";
          window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
          if (resultObj.cancelled==true) return false;
          sign   =getFlagVal(sign,    resultObj.sign);
          encrypt=getFlagVal(encrypt, resultObj.encrypt);
          pgpMime=getFlagVal(pgpMime, resultObj.pgpMime);
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
  flagsObj.value = sign | (encrypt << 2) | (pgpMime << 4);

  return true;
}

