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
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net> are
 * Copyright (C) 2003 Patrick Brunschwig. All Rights Reserved.
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

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_ID = 4;
const CREATED = 5;
const EXPIRY = 6;
const USER_ID = 9;

var gUserList;
var gArguments=arguments;
var gResult;
var gImg0="chrome://enigmail/skin/check0.png";
var gImg1="chrome://enigmail/skin/check1.png";
var gImg2="chrome://enigmail/skin/check2.png";

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

   var sortUsers = function (a,b) {

     if (a.userId<b.userId) { return -1;} else {return 1; }

   }

   window.arguments[1].cancelled=true;
   var exitCodeObj = new Object();
   var statusFlagsObj = new Object();
   var errorMsgObj = new Object();

   var secretOnly = (window.arguments[0].options.indexOf("private")>= 0);
   var hideExpired = (window.arguments[0].options.indexOf("hidexpired")>= 0);
   var allowExpired = (window.arguments[0].options.indexOf("allowexpired")>= 0);

   var aGpgUserList = enigGetUserList(window,
                                   secretOnly,
                                   exitCodeObj,
                                   statusFlagsObj,
                                   errorMsgObj);

   if (!aGpgUserList) return;

   try {
     if (window.arguments[0].dialogHeader) {
       var dialogHeader = document.getElementById("dialogHeader");
       dialogHeader.setAttribute("label", window.arguments[0].dialogHeader);
       dialogHeader.setAttribute("collapsed", "false");
     }
   } catch (ex) {}

   if (secretOnly) {
      // rename expired row to created
      document.getElementById("expCol").setAttribute("label",EnigGetString("createdHeader"));
   }
   gUserList = document.getElementById("enigmailUserIdSelection");
   var descNotFound=document.getElementById("usersNotFoundDesc");
   var treeChildren=gUserList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];

   if (window.arguments[0].options.indexOf("multisel")< 0) {
     // single key selection -> hide selection col
     var selColumn=document.getElementById("selectionCol");
     selColumn.setAttribute("collapsed", "true");
     gUserList.setAttribute("hidecolumnpicker", "true");
   }

   if (window.arguments[0].options.indexOf("nosending")>= 0) {
      // hide not found recipients, hide "send unencrypted"
      document.getElementById("keygenConsoleBox").setAttribute("collapsed", "true");
      document.getElementById("enigmailUserSelPlainText").setAttribute("collapsed", "true");
   }

   var aUserList = new Array();
   var userObj = new Object();
   var i;
   for (i=0; i<aGpgUserList.length; i++) {
     if (aGpgUserList[i][0] == "pub" || aGpgUserList[i][0] == "sec") {
       userObj = new Object();
       userObj.expiry=aGpgUserList[i][EXPIRY];
       userObj.created=aGpgUserList[i][CREATED];
       userObj.userId=aGpgUserList[i][USER_ID];
       userObj.keyId=aGpgUserList[i][KEY_ID];
       userObj.SubUserIds=new Array();
       aUserList.push(userObj);
     }
     else if (aGpgUserList[i][0] == "sub") {
       // this might override the key above (which is correct)
       userObj.keyId=aGpgUserList[i][KEY_ID];
     }
     else if (aGpgUserList[i][0] == "uid") {
       var userId=aGpgUserList[i][USER_ID];
       userObj.SubUserIds.push(userId);
     }
   }

   var toAddr = "";
   try {
     toAddr=enigStripEmail(gArguments[0].toAddr);
   }
   catch (ex) {}


   aUserList.sort(sortUsers);
   var d = new Date();
   // create an ANSI date string (YYYYMMDD)
   var now=(d.getDate()+100*(d.getMonth()+1)+10000*(d.getYear()+1900)).toString();
   var aValidUsers = new Array();


   var mailAddr, escapedMailAddr;
   var s1, s2;
   var escapeRegExp = new RegExp("([\\(\\$\\)\\/\\[\\]\\^])","g");

   for (i=0; i<aUserList.length; i++) {

      var activeState= (allowExpired ? 0 : 2);
      var expired=true;
      if ((!aUserList[i].expiry.length) || (aUserList[i].expiry.length && aUserList[i].expiry.replace(/\-/g, "") >= now)) {
          // key still valid
          mailAddr = enigStripEmail(aUserList[i].userId);
          aValidUsers.push(mailAddr);
          escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");
          s1=new RegExp("[, ]?"+escapedMailAddr+"[, ]");
          s2=new RegExp("[, ]"+escapedMailAddr+"[, ]?");
          activeState=(toAddr.search(s1)>=0 || toAddr.search(s2)>=0) ? 1 : 0;
          expired=false;
      }

      if (! hideExpired || activeState<2) {
        // do not show if expired keys are hidden
        var treeItem=null;
        if (secretOnly) {
          treeItem=enigUserSelCreateRow(activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].created, false)
        }
        else {
          treeItem=enigUserSelCreateRow(activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].expiry, expired)
        }
        if (aUserList[i].SubUserIds.length) {
          treeItem.setAttribute("container", "true");
          var subChildren=document.createElement("treechildren");
          for (var user=0; user<aUserList[i].SubUserIds.length; user++) {
            var subItem=enigUserSelCreateRow(-1, aUserList[i].SubUserIds[user], "", "")
            subChildren.appendChild(subItem);
            if (activeState<2 || allowExpired) {
              // add uid's for valid keys
              mailAddr = enigStripEmail(aUserList[i].SubUserIds[user]);
              aValidUsers.push(mailAddr);
              escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");
              s1=new RegExp("[, ]?"+escapedMailAddr+"[, ]");
              s2=new RegExp("[, ]"+escapedMailAddr+"[, ]?");
              if (toAddr.search(s1)>=0 || toAddr.search(s2)>=0) {
                enigSetActive(treeItem.getElementsByAttribute("id","indicator")[0], 1);
              }
            }
          }

          treeItem.appendChild(subChildren);
        }
      }

      treeChildren.appendChild(treeItem);

   }
   gUserList.appendChild(treeChildren);

   var aNotFound=new Array();
   var toAddrList = toAddr.split(/,/);
   var j;
   for (i=0; i<toAddrList.length; i++) {
      for (j=0; j<aValidUsers.length; j++) {
         if (aValidUsers[j] == toAddrList[i]) {
            j=aValidUsers.length + 3;
         }
      }
      if (j==aValidUsers.length) {
         aNotFound.push(toAddrList[i]);
      }
   }
   descNotFound.firstChild.data = aNotFound.join(", ");
}


function enigGetUserList(window, secretOnly, exitCodeObj, statusFlagsObj, errorMsgObj) {
  DEBUG_LOG("enigmailMessengerOverlay.js: enigGetUserList\n");

  var aUserList = new Array();
  try {
    var enigmailSvc = GetEnigmailSvc();
    var userText = enigmailSvc.getUserIdList(window,
                                            secretOnly,
                                            exitCodeObj,
                                            statusFlagsObj,
                                            errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(errorMsgObj.value);
      return null;
    }

    userText.replace(/\r\n/g, "\n");
    userText.replace(/\r/g, "\n");
    var removeIndex=userText.indexOf("----\n");
    userText = userText.substring(removeIndex + 5);

    while (userText.length >0) {
        var theLine=userText.substring(0,userText.indexOf("\n"));
        theLine.replace(/\n/, "");
        if (theLine.length>0) {
          aUserList.push(theLine.split(/\:/)); ///
        }
        userText=userText.substring(theLine.length+1);
    }
  } catch (ex) {}

  return aUserList;
}


// create a (sub) row for the user tree
function enigUserSelCreateRow (activeState, userId, keyId, dateField, expired) {
    var selectCol=document.createElement("treecell");
    selectCol.setAttribute("id", "indicator");
    enigSetActive(selectCol, activeState);
    var userCol=document.createElement("treecell");
    userCol.setAttribute("id", "name");
    userCol.setAttribute("label", userId);
    var expCol=document.createElement("treecell");
    if (expired) {
      expCol.setAttribute("label", EnigGetString("selKeyExpired", dateField));
    }
    else {
      expCol.setAttribute("label", dateField);
    }
    expCol.setAttribute("id", "expiry");
    var keyCol=document.createElement("treecell");
    keyCol.setAttribute("label", keyId.substring(8,16));
    keyCol.setAttribute("id", "keyid");
    var userRow=document.createElement("treerow");
    userRow.appendChild(selectCol);
    userRow.appendChild(userCol);
    userRow.appendChild(expCol);
    userRow.appendChild(keyCol);
    var treeItem=document.createElement("treeitem");
    treeItem.setAttribute("id", "0x"+keyId);
    treeItem.appendChild(userRow);
    return treeItem;
}

function enigmailUserSelAccept() {
  DEBUG_LOG("enigmailUserSelection.js: Accept\n");

  var resultObj=window.arguments[1];
  resultObj.cancelled=false;
  resultObj.userList = new Array();
  var t = new String();
  gUserList = document.getElementById("enigmailUserIdSelection");
  var treeChildren=gUserList.getElementsByAttribute("id", "enigmailUserIdSelectionChildren")[0];

  var singleSel = (window.arguments[0].options.indexOf("multisel")<0);
  var rowCount = 0;
  var item=treeChildren.firstChild;
  while (item) {
    if (singleSel) {
      if (gUserList.currentIndex == rowCount) {
        resultObj.userList.push(item.getAttribute("id"));
      }
    }
    else {
      var aRows = item.getElementsByAttribute("id","indicator")
      if (aRows.length) {
        var elem=aRows[0];
        if (elem.getAttribute("active") == "1") {
          resultObj.userList.push(item.getAttribute("id"));
        }
      }
    }
    item = item.nextSibling;
    ++rowCount;
  }

  var encrypt = document.getElementById("enigmailUserSelPlainText");
  resultObj.encrypt = !(encrypt && encrypt.checked==true);

}

function enigmailUserSelCallback(event) {
  var Tree = document.getElementById("enigmailUserIdSelection");
  var row = {};
  var col = {};
  var elt = {};
  Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
  if (row.value == -1)
    return;

  if (col.value != "selectionCol")
    return;

  var treeItem = Tree.contentView.getItemAtIndex(row.value);

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
