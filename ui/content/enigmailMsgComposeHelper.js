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

function getRecipientsKeys(emailAddrs, matchedKeysObj, flagsObj) {

  function getFlagVal(oldVal, newVal, valType) {
    if (oldVal==0 || newVal==0) {
      return 0;
    }
    else {
      return (oldVal < newVal ? newVal: oldVal);
    }
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;
    
  flagsObj.value = -1;
  matchedKeysObj.value = "";
  var encrypt=1;
  var sign   =1;
  var pgpMime=1;
  var addresses="{"+EnigStripEmail(emailAddrs.toLowerCase()).replace(/[, ]+/g, "}{")+"}";
  var keyList=new Array;

  var userListObj= new Object;
  if (! enigmailSvc.getUserList(userListObj)) {
    return 0;
  }

  var userList=userListObj.value;

  if (userList.firstChild.nodeName=="parsererror") {
    EnigAlert("Invalid enigmail.xml file:\n"+ userList.firstChild.textContent);
    return 0;
  }
  DEBUG_LOG("enigmail.js: getRecipientsKeys: keys loaded\n");
  var node=userList.firstChild.firstChild;
  while (node) {
    if (node.tagName=="pgpRule") {
      try {
        var nodeText=node.getAttribute("email");
        if (! nodeText) continue;
        addrList=nodeText.toLowerCase().split(/[ ,;]+/);
        for(var addrIndex=0; addrIndex < addrList.length; addrIndex++) {
          var email=addrList[addrIndex];
          var i=addresses.indexOf(email);
          while (i>=0) {
            sign   =getFlagVal(sign,    node.getAttribute("sign"), 0);
            encrypt=getFlagVal(encrypt, node.getAttribute("encrypt"), 1);
            pgpMime=getFlagVal(pgpMime, node.getAttribute("pgpMime"), 2);

            // extract found address
            var keyIds=node.getAttribute("keyId");
            // EnigAlert("Found match with: "+email);
            if (keyIds) {
              keyList.push(keyIds.replace(/[ ,;]/g, ", "));
              var start=addresses.substring(0,i+email.length).lastIndexOf("{");
              var end=start+addresses.substring(start).indexOf("}")+1;
              addresses=addresses.substring(0,start-1)+addresses.substring(end);
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
     catch (ex) {}
    }
    node = node.nextSibling;
  }

  if (keyList.length>0) {
    // sort key list and make it unique?
    matchedKeysObj.value = keyList.join(", ");
    addresses.replace(/\{/g, ", ").replace(/\}/g, "");
    matchedKeysObj.value += addresses.replace(/\{/g, ", ").replace(/\}/g, "");
  }
  flagsObj.value = sign | (encrypt << 2) | (pgpMime << 4);
//  EnigAlert("List: \n"+matchedKeysObj.value+"\nFlags:"+flagsObj.value);

  return 0;
}
