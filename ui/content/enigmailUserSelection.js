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
 * are Copyright (C) 2003 Patrick Brunschwig.
 * All Rights Reserved.
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

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailUserSelection");

const INPUT = 0;
const RESULT = 1;

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_TRUST=1;
const KEY_ID = 4;
const CREATED = 5;
const EXPIRY = 6;
const USER_ID = 9;

// key trust values for field 1 (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_EXPIRED="e";
const KEY_REVOKED="r";
const KEY_INVALID="i";
const KEY_DISABLED="d";
const KEY_NOT_VALID=KEY_EXPIRED+KEY_REVOKED+KEY_INVALID+KEY_DISABLED;

var gUserList;
var gResult;
var gImg0="chrome://enigmail/content/check0.png";
var gImg1="chrome://enigmail/content/check1.png";
var gImg2="chrome://enigmail/content/check2.png";
var gSendEncrypted=true;

// set the "active" flag and the corresponding image
function enigSetActive(element, status) {

  if (status==0) {
    element.setAttribute("active","0");
    element.setAttribute("src",gImg0);
  }
  else if (status==1) {
    element.setAttribute("active","1");
    element.setAttribute("src",gImg1);
  }
  else if (status==2) {
    element.setAttribute("active","2");
    element.setAttribute("src",gImg2);
  }
  else {
    element.setAttribute("active",-1);
  }
}

function enigmailUserSelLoad() {
   DEBUG_LOG("enigmailUserSelection.js: Load\n");
   enigmailBuildList(false);
}


function enigmailRefreshKeys() {
  var userTreeList = document.getElementById("enigmailUserIdSelection");
  var treeChildren = userTreeList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0]
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
  enigmailBuildList(true);
}


function enigGetUserList(secretOnly, refresh) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigGetUserList\n");

  try {
    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj = new Object();
    
    var enigmailSvc = GetEnigmailSvc();
    var userList = enigmailSvc.getUserIdList(secretOnly,
                                             refresh,
                                             exitCodeObj,
                                             statusFlagsObj,
                                             errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(errorMsgObj.value);
      return null;
    }
  } catch (ex) {
    ERROR_LOG("ERROR in enigmailUserSelection: enigGetUserList\n");
  }

  return userList.split(/\n/);
}


function enigmailBuildList(refresh) {
   DEBUG_LOG("enigmailUserSelection.js: enigmailBuildList\n");
   
   var sortUsers = function (a,b) {

     if (a.userId<b.userId) { return -1;} else {return 1; }

   }

   window.arguments[RESULT].cancelled=true;

   var secretOnly = (window.arguments[INPUT].options.indexOf("private")>= 0);
   var hideExpired = (window.arguments[INPUT].options.indexOf("hidexpired")>= 0);
   var allowExpired = (window.arguments[INPUT].options.indexOf("allowexpired")>= 0);
   var aGpgUserList = enigGetUserList(secretOnly, refresh);

   if (!aGpgUserList) return;

   try {
     if (window.arguments[INPUT].dialogHeader) {
       var dialogHeader = document.getElementById("dialogHeader");
       dialogHeader.setAttribute("label", window.arguments[INPUT].dialogHeader);
       dialogHeader.removeAttribute("collapsed");
     }
   } catch (ex) {}

   if (secretOnly) {
      // rename expired row to created
      document.getElementById("expCol").setAttribute("label",EnigGetString("createdHeader"));
   }
   gUserList = document.getElementById("enigmailUserIdSelection");
   gUserList.currentItem=null;

   if (window.arguments[INPUT].options.indexOf("notsigned")>= 0) {
      var plainText = document.getElementById("enigmailUserSelPlainText");
      plainText.setAttribute("label", plainText.getAttribute("noSignLabel"));
   }
   if ((window.arguments[INPUT].options.indexOf("rulesOption")>= 0)) {
      var rulesOption = document.getElementById("perRecipientsOption");
      rulesOption.removeAttribute("collapsed");
   }
   
   var descNotFound = document.getElementById("usersNotFoundDesc");
   var notFoundCapt = document.getElementById("usersNotFoundCapt");
   var treeChildren=gUserList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];

   if (window.arguments[INPUT].options.indexOf("multisel")< 0) {
     // single key selection -> hide selection col
     var selColumn=document.getElementById("selectionCol");
     selColumn.setAttribute("collapsed", "true");
     gUserList.setAttribute("hidecolumnpicker", "true");
   }

   if (window.arguments[INPUT].options.indexOf("nosending")>= 0) {
      // hide not found recipients, hide "send unencrypted"
      document.getElementById("dialogHeadline").setAttribute("collapsed", "true");
      document.getElementById("enigmailUserSelPlainText").setAttribute("collapsed", "true");
   }
   else if (window.arguments[INPUT].options.indexOf("noforcedisp")>=0) {
      document.getElementById("displayNoLonger").removeAttribute("collapsed");
   }


   if (window.arguments[INPUT].options.indexOf("forUser")>=0) {
      descNotFound.firstChild.data=EnigGetString("keysToUse", window.arguments[INPUT].forUser);      
      notFoundCapt.setAttribute("collapsed", "true");
   }
   var aUserList = new Array();
   var userObj = new Object();
   var i;
   for (i=0; i<aGpgUserList.length; i++) {
     var listRow=aGpgUserList[i].split(/:/);
     if (listRow.length>=0) {
       if (listRow[0] == "pub" || listRow[0] == "sec") {
         userObj = new Object();
         userObj.expiry=listRow[EXPIRY];
         userObj.created=listRow[CREATED];
         userObj.userId=listRow[USER_ID];
         userObj.keyId=listRow[KEY_ID];
         userObj.keyTrust=listRow[KEY_TRUST];
         userObj.SubUserIds=new Array();
         aUserList.push(userObj);
       }
       /*else if (listRow[0] == "sub") {
         // this might override the key above (which is correct)
         userObj.keyId=listRow[KEY_ID];
       } */
       else if (listRow[0] == "uid") {
         var userId=listRow[USER_ID];
         userObj.SubUserIds.push(userId);
       }
     }
   }

   var toAddr = "";
   try {
     if (typeof(window.arguments[INPUT].toAddr)=="string")
       toAddr=EnigStripEmail(window.arguments[INPUT].toAddr)+" ";
   }
   catch (ex) {}
   
   var toKeys = "";
   try{
     if (typeof(window.arguments[INPUT].toKeys)=="string") {
        toKeys=window.arguments[INPUT].toKeys;
     }
   }
   catch (ex) {}

   aUserList.sort(sortUsers);

   var d = new Date();
   // create an ANSI date string (YYYYMMDD) for "now"
   var now=(d.getDate()+100*(d.getMonth()+1)+10000*(d.getYear()+1900)).toString();
   var aValidUsers = new Array();


   var mailAddr, escapedMailAddr;
   var s1, s2;
   // Replace any non-text character c with \\c
   var escapeRegExp = new RegExp("([^a-zA-Z0-9])","g");

   try {
      // Activate found keys
      for (i=0; i<aUserList.length; i++) {

          var activeState= (allowExpired ? 0 : 2);

          if (((!aUserList[i].keyTrust) ||
              KEY_NOT_VALID.indexOf(aUserList[i].keyTrust)<0) &&
              ((!aUserList[i].expiry.length) ||
              (aUserList[i].expiry.length && aUserList[i].expiry.replace(/\-/g, "") >= now))) {
              // key still valid
              try {
                mailAddr = EnigStripEmail(aUserList[i].userId);
              }
              catch (ex) {
                mailAddr = EnigStripEmail(aUserList[i].userId.replace(/\"/g,""));
              }
              aValidUsers.push(mailAddr);
              escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");
              s1=new RegExp("[, ]?"+escapedMailAddr+"[, ]","i");
              s2=new RegExp("[, ]"+escapedMailAddr+"[, ]?","i");
              activeState=(toAddr.search(s1)>=0 || toAddr.search(s2)>=0) ? 1 : 0;
              if (activeState==0 && toKeys.length>0) {
                activeState=(toKeys.indexOf("0x"+aUserList[i].keyId)>=0 ? 1 : 0)
              }
          }

          var treeItem=null;
          if (! hideExpired || activeState<2) {
            // do not show if expired keys are hidden
            if (secretOnly) {
              treeItem=enigUserSelCreateRow(aUserList[i], activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].created, "")
            }
            else {
              treeItem=enigUserSelCreateRow(aUserList[i], activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].expiry, aUserList[i].keyTrust)
            }
            if (aUserList[i].SubUserIds.length) {
              treeItem.setAttribute("container", "true");
              var subChildren=document.createElement("treechildren");
              for (var user=0; user<aUserList[i].SubUserIds.length; user++) {
                var subItem=enigUserSelCreateRow(aUserList[i], -1, aUserList[i].SubUserIds[user], "", "", "");
                subChildren.appendChild(subItem);
                if (activeState<2 || allowExpired) {
                  // add uid's for valid keys
                  try {
                    mailAddr = EnigStripEmail(aUserList[i].userId);
                  }
                  catch (ex) {
                    mailAddr = EnigStripEmail(aUserList[i].userId.replace(/\"]/g,""));
                  }
                  aValidUsers.push(mailAddr);
                  escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");
                  s1=new RegExp("[, ]?"+escapedMailAddr+"[, ]","i");
                  s2=new RegExp("[, ]"+escapedMailAddr+"[, ]?","i");
                  if (toAddr.search(s1)>=0 || toAddr.search(s2)>=0) {
                    enigSetActive(treeItem.getElementsByAttribute("id","indicator")[0], 1);
                  }
                }
              }

              treeItem.appendChild(subChildren);
            }
          }

          if (treeItem)
            treeChildren.appendChild(treeItem);

      }
   }
   catch (ex) {
      ERROR_LOG("ERROR in enigmailUserSelection: enigmailUserSelLoad:\n");
      ERROR_LOG("  userId="+aUserList[i].userId+" expiry="+ aUserList[i].expiry+"\n");
      if ((typeof user)=="number" && (typeof aUserList[i].SubUserIds[user])=="string") {
        ERROR_LOG("  subUserId="+aUserList[i].SubUserIds[user]+"\n");
      }
   }
   gUserList.appendChild(treeChildren);

   if (window.arguments[INPUT].options.indexOf("forUser")<0) {
     // Build up list of not found recipients
     var aNotFound=new Array();
     var toAddrList = toAddr.split(/,/);
     var j;
     for (i=0; i<toAddrList.length; i++) {
        for (j=0; j<aValidUsers.length; j++) {
           if (aValidUsers[j].toLowerCase() == toAddrList[i].toLowerCase()) {
              j=aValidUsers.length + 3;
           }
        }
        if (j==aValidUsers.length) {
           aNotFound.push(toAddrList[i]);
        }
     }
     descNotFound.firstChild.data = aNotFound.join(", ");
     window.arguments[INPUT].notFoundList=aNotFound;
   }
}


// create a (sub) row for the user tree
function enigUserSelCreateRow (userObj, activeState, userId, keyValue, dateField, trustStatus) {
    var selectCol=document.createElement("treecell");
    selectCol.setAttribute("id", "indicator");
    enigSetActive(selectCol, activeState);
    var expCol=document.createElement("treecell");
    var userCol=document.createElement("treecell");
    userCol.setAttribute("id", "name");
    if (trustStatus.charAt(0)==KEY_EXPIRED) {
      expCol.setAttribute("label", EnigGetString("selKeyExpired", dateField));
    }
    else {
      expCol.setAttribute("label", dateField);
    }

    switch (trustStatus.charAt(0)) {
      case KEY_REVOKED:
        userId+= " - "+EnigGetString("prefRevoked");
        break;
      case KEY_INVALID:
        userId+= " - "+EnigGetString("keyInvalid");
        break;
      case KEY_DISABLED:
        userId+= " - "+EnigGetString("keyDisabled");
        break;
    }
    expCol.setAttribute("id", "expiry");
    userCol.setAttribute("label", userId);
    var keyCol=document.createElement("treecell");
    keyCol.setAttribute("label", keyValue.substring(8,16));
    keyCol.setAttribute("id", "keyid");
    if ((userObj.keyTrust.length>0) &&
        (KEY_NOT_VALID.indexOf(userObj.keyTrust.charAt(0))>=0)) {
      userCol.setAttribute("properties", "enigKeyInactive");
      expCol.setAttribute("properties", "enigKeyInactive");
      keyCol.setAttribute("properties", "enigKeyInactive");
    }

    var userRow=document.createElement("treerow");
    userRow.appendChild(selectCol);
    userRow.appendChild(userCol);
    userRow.appendChild(expCol);
    userRow.appendChild(keyCol);
    var treeItem=document.createElement("treeitem");
    treeItem.setAttribute("id", "0x"+userObj.keyId);
    treeItem.appendChild(userRow);
    return treeItem;
}

function enigmailUserSelAccept() {
  DEBUG_LOG("enigmailUserSelection.js: Accept\n");

  var resultObj=window.arguments[RESULT];
  resultObj.userList = new Array();
  resultObj.perRecipientRules=false;
  var t = new String();
  gUserList = document.getElementById("enigmailUserIdSelection");
  var treeChildren=gUserList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];

  if (window.arguments[INPUT].options.indexOf("multisel")<0) {
    if (gUserList.currentItem)
      resultObj.userList.push(gUserList.currentItem.getAttribute("id"));
  }
  else {
    var item=treeChildren.firstChild;
    while (item) {
      var aRows = item.getElementsByAttribute("id","indicator")
      if (aRows.length) {
        var elem=aRows[0];
        if (elem.getAttribute("active") == "1") {
          resultObj.userList.push(item.getAttribute("id"));
        }
      }
      item = item.nextSibling;
    }
  }

  if (document.getElementById("displayNoLonger").checked) {
    EnigSetPref("recipientsSelectionOption", 0);
  }
  if (resultObj.userList.length == 0 && gSendEncrypted) {
    EnigAlert(EnigGetString("atLeastOneKey"));
    return false;
  }
  resultObj.cancelled=false;

  resultObj.encrypt = gSendEncrypted;
  return true;
}

function enigmailUserSelCallback(event) {
  if (!gSendEncrypted)
    return;

  var Tree = document.getElementById("enigmailUserIdSelection");
  var row = {};
  var col = {};
  var elt = {};
  Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
  if (row.value == -1)
    return;


  var treeItem = Tree.contentView.getItemAtIndex(row.value);
  Tree.currentItem=treeItem;
  if (col.value != "selectionCol")
    return;

  var aRows = treeItem.getElementsByAttribute("id","indicator")

  if (aRows.length) {
    var elem=aRows[0];
    if (elem.getAttribute("active") == "1") {
      enigSetActive(elem, 0);
    } else if (elem.getAttribute("active") == "0") {
      enigSetActive(elem, 1);
    }
  }
}

function plainTextCallback() {
  gSendEncrypted = (! gSendEncrypted);
  displayNoLonger();
  disableList();
}

function displayNoLonger() {
  var dispMsg = document.getElementById("displayNoLonger");
  if (gSendEncrypted) {
    dispMsg.setAttribute("disabled", "true");
  }
  else {
    dispMsg.removeAttribute("disabled");
  }

}

function disableList() {
  var Tree=document.getElementById("enigmailUserIdSelection");
  var node = Tree.firstChild.firstChild;
  while (node) {
    // set the background of all colums to gray
    if (node.localName == "treecol") {
      if (gSendEncrypted) {
        node.removeAttribute("properties");
      }
      else {
        node.setAttribute("properties", "enigDontEncrypt");
      }
    }
    node=node.nextSibling;
  }
}

function enigmailNewRecipientRule () {
  if (EnigGetPref("perRecipientRules")==0) {
    EnigSetPref("perRecipientRules", 1);
  }

  var resultObj=window.arguments[RESULT];
  resultObj.userList = new Array();
  resultObj.perRecipientRules=true;
  resultObj.cancelled=false;
  resultObj.encrypt = "";
  window.close();
  return true;
}

function enigmailImportMissingKeys () {
/*
  var keyserver = EnigGetPref("keyserver");

  var pubKeyId = "'<"+window.arguments[INPUT].notFoundList.join(">' '<")+">'";
  if (EnigConfirm("Try to download the following keys?\n"+window.arguments[INPUT].notFoundList.join(", "))) {
    var recvErrorMsgObj = new Object();
    var recvFlags = nsIEnigmail.UI_INTERACTIVE;

    var enigmailSvc = GetEnigmailSvc();
    var exitStatus = enigmailSvc.receiveKey(window, recvFlags, pubKeyId,
                                            recvErrorMsgObj);

    if (exitStatus == 0) {
      enigmailUserSelLoad;
    } else {
      EnigAlert(EnigGetString("keyImportError")+recvErrorMsgObj.value);
    }
  }
*/
}

