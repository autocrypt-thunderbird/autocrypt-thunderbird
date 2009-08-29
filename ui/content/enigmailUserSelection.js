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
 * are Copyright (C) 2003-2005 Patrick Brunschwig.
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
const KEY_USE_FOR = 11;

// key trust values for field 1 (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_EXPIRED="e";
const KEY_REVOKED="r";
const KEY_INVALID="i";
const KEY_DISABLED="d";
const KEY_NOT_VALID=KEY_EXPIRED+KEY_REVOKED+KEY_INVALID+KEY_DISABLED;
const KEY_IS_GROUP="g";

// HKP related stuff
const ENIG_DEFAULT_HKP_PORT="11371";

const ENIG_IMG_NOT_SELECTED ="chrome://enigmail/content/check0.png";
const ENIG_IMG_SELECTED     ="chrome://enigmail/content/check1.png";
const ENIG_IMG_DISABLED     ="chrome://enigmail/content/check2.png";

var gUserList;
var gResult;
var gAlwaysTrust=false;
var gSendEncrypted=true;
var gAllowExpired=false;

var gEnigRemoveListener = false;
const EMPTY_UID = " -";



// set the "active" flag and the corresponding image
function enigSetActive(element, status) {

  if (status>=0)
    element.setAttribute("active", status.toString());

  switch (status)
  {
  case 0:
    element.setAttribute("src", ENIG_IMG_NOT_SELECTED);
    break;
  case 1:
    element.setAttribute("src", ENIG_IMG_SELECTED);
    break;
  case 2:
    element.setAttribute("src", ENIG_IMG_DISABLED);
    break;
  default:
    element.setAttribute("active", -1);
  }
}

function enigmailUserSelLoad() {
  DEBUG_LOG("enigmailUserSelection.js: Load\n");
  window.enigIpcRequest = null;
  if (window.arguments[INPUT].options.indexOf("private")>= 0) {
    document.getElementById("enigmailUserSelectionList").setAttribute("title", EnigGetString("userSel.secretKeySel.title"));
  }
  document.getElementById("enigmailUserIdSelection").addEventListener('click', onClickCallback, true);
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
    if (! enigmailSvc)
      return null;
    var userList = enigmailSvc.getUserIdList(secretOnly,
                                             refresh,
                                             exitCodeObj,
                                             statusFlagsObj,
                                             errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(errorMsgObj.value);
      return null;
    }
    
    if (! secretOnly) {
      var configString = enigmailSvc.getGnupgConfig(exitCodeObj, errorMsgObj);
      if (exitCodeObj.value != 0) {
        EnigAlert(errorMsgObj.value);
        return null;
      }                                             
      var configList = configString.split(/\n/);
      for (var i=0; i<configList.length;i++) {
        if (configList[i].indexOf("cfg:group") == 0) {
          var groupArr=configList[i].split(/:/);
          userList += "grp:"+groupArr[2]+":"+groupArr[3]+"\n";
        }
      }
    }
    else {
      userList = getPubkeysFromSecretKeys(userList);
    }    
  } catch (ex) {
    ERROR_LOG("ERROR in enigmailUserSelection: enigGetUserList\n");
  }

  return userList.split(/\n/);
}

// get (and display) the public keys for the found secret keys
function getPubkeysFromSecretKeys(keyString) {
  var secretList=keyString.split(/\n/);
  var aSecretKeys = new Array();
  for (var i=0; i<secretList.length; i++) {
    var listRow = secretList[i].split(/:/);
    if (listRow[0] == "sec") {
      aSecretKeys.push("0x"+listRow[KEY_ID]);
    }
  }
  
  var enigmailSvc = GetEnigmailSvc();
  if (! enigmailSvc)
    return null;
  var pubkeys = enigmailSvc.getKeyDetails(aSecretKeys.join(" "), false);
  return pubkeys;
}

function enigmailBuildList(refresh) {
   DEBUG_LOG("enigmailUserSelection.js: enigmailBuildList\n");

   const TRUSTLEVEL_SORTED="oidre-qnmfu"; // trust level sorted by increasing level of trust
   var sortUsers = function (a,b) {
     var r = 0;
     if ((a.activeState == 1 || b.activeState == 1) && (a.activeState != b.activeState)) {
       r = (a.activeState == 1 ? -1 : 1);
     }
     else if (a.userId.toLowerCase()<b.userId.toLowerCase()) {
       r = -1;
     }
     else {
       r = 1;
     }

     return r;
   }

   window.arguments[RESULT].cancelled=true;

   var secretOnly = (window.arguments[INPUT].options.indexOf("private")>= 0);
   var hideExpired = (window.arguments[INPUT].options.indexOf("hidexpired")>= 0);
   gAllowExpired = (window.arguments[INPUT].options.indexOf("allowexpired")>= 0);
   
   var aGpgUserList = enigGetUserList(secretOnly, refresh);

   if (!aGpgUserList) return;

   gAlwaysTrust = EnigGetPref("alwaysTrustSend");
   if (gAlwaysTrust) {
     var uidNotValid="";
   }
   else {
     uidNotValid="o-qn";
   }

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
   if ((window.arguments[INPUT].options.indexOf("rulesOption") < 0)) {
      // var rulesOption = document.getElementById("perRecipientsOption");
      // rulesOption.removeAttribute("collapsed");
      var rulesOption = document.getElementById("enigmailUserSelectionList").getButton("extra1");
      rulesOption.setAttribute("hidden", "true");
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
      document.getElementById("importMissingKeys").setAttribute("collapsed", "true");
   }
   else if (window.arguments[INPUT].options.indexOf("noforcedisp")>=0) {
      document.getElementById("displayNoLonger").removeAttribute("collapsed");
   }

   if (window.arguments[INPUT].options.indexOf("noplaintext")>= 0) {
      // hide hide "send unencrypted"
      document.getElementById("enigmailUserSelPlainText").setAttribute("collapsed", "true");
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
       switch(listRow[0]) {
       case "pub":
       case "sec":
         userObj = new Object();
         userObj.expiry=listRow[EXPIRY];
         userObj.created=listRow[CREATED];
         userObj.keyId=listRow[KEY_ID];
         userObj.keyTrust=listRow[KEY_TRUST];
         if (listRow[KEY_USE_FOR].indexOf("D")>=0) {
           userObj.keyTrust=KEY_DISABLED;
         }
         userObj.valid=false;
         userObj.uidValid=true;
         userObj.subkeyOK=(listRow[KEY_USE_FOR].indexOf("e") >= 0 || secretOnly);
         userObj.SubUserIds=new Array();
         aUserList.push(userObj);
         break;
       case "grp":
         // groups
         userObj = new Object();
         userObj.expiry="";
         userObj.created=1;
         userObj.keyTrust=KEY_IS_GROUP;
         userObj.valid=true;
         userObj.uidValid=true;
         userObj.subkeyOK=true;
         userObj.userId=EnigConvertGpgToUnicode(listRow[1]).replace(/\\e3A/g, ":");
         userObj.keyId=userObj.userId;
         userObj.SubUserIds=new Array();
         var grpMembers=EnigConvertGpgToUnicode(listRow[2]).replace(/\\e3A/g, ":").split(/[,;]/);
         for (var grpIdx=0; grpIdx<grpMembers.length; grpIdx++) {
           userObj.SubUserIds.push({ userId: grpMembers[grpIdx], trustLevel: "q" });
         }
         aUserList.push(userObj);
         break;
       case "uid":
         if (listRow[USER_ID].length == 0) {
            listRow[USER_ID] = EMPTY_UID;
         }
         if (typeof(userObj.userId) != "string") {
           // primary UID
           userObj.userId=EnigConvertGpgToUnicode(listRow[USER_ID]).replace(/\\e3A/g, ":");
            if (TRUSTLEVEL_SORTED.indexOf(listRow[KEY_TRUST]) < TRUSTLEVEL_SORTED.indexOf(userObj.keyTrust)) {
            // reduce key trust if primary UID is less trusted than public key
            userObj.keyTrust = listRow[KEY_TRUST];
          }           
         }
         else {
           var userId = {
             userId: EnigConvertGpgToUnicode(listRow[USER_ID]).replace(/\\e3A/g, ":"),
             trustLevel: listRow[KEY_TRUST]
           };
           userObj.SubUserIds.push(userId);
         }
         break;
       case "sub":
         if ((listRow[KEY_USE_FOR].indexOf("e")>=0) &&
             (KEY_NOT_VALID.indexOf(listRow[KEY_TRUST])<0)) {
           userObj.subkeyOK=true;
         }
         break;
       case "tru":
         if (listRow[1].indexOf("t") >=0) {
            gAlwaysTrust=true;
         }
       }
     }
   }

   var toKeys = "";
   try{
     if (typeof(window.arguments[INPUT].toKeys)=="string") {
        toKeys=window.arguments[INPUT].toKeys;
     }
   }
   catch (ex) {}

   var invalidAddr = "";
   try{
     if (typeof(window.arguments[INPUT].invalidAddr)=="string") {
        invalidAddr=" "+window.arguments[INPUT].invalidAddr+" ";
     }
   }
   catch (ex) {}

   // sort out PGP keys in toAddr
   var toAddrList = getToAddrList();
   for (i=0; i<toAddrList.length; i++) {
    if (toAddrList[i].search(/^0x([0-9A-Fa-f]{8}|[0-9A-Fa-f]{16})$/)>=0) {
      var newKey=toAddrList.splice(i,1);
      toKeys += " "+newKey
      i--;
    }
   }
   var toAddr=toAddrList.join(",")+" ";

   var d = new Date();
   var now=d.valueOf() / 1000;
   var aValidUsers = new Array();

   var mailAddr, escapedMailAddr;
   var s1, s2;
   // Replace any non-text character c with \\c
   var escapeRegExp = new RegExp("([^a-zA-Z0-9])","g");

   try {
      // delete "empty" entries
      for (i=0; i<aUserList.length; i++) {
        if (typeof(aUserList[i].userId) != "string") {
          aUserList.splice(i, 1);
        }
      }
      // find and activate keys
      for (i=0; i<aUserList.length; i++) {
        aUserList[i].activeState = (gAllowExpired ? 0 : 2);
        if (aUserList[i].keyTrust != KEY_IS_GROUP) {
          // handling of "normal" keys
          if (((!aUserList[i].keyTrust) ||
                KEY_NOT_VALID.indexOf(aUserList[i].keyTrust)<0) &&
                aUserList[i].subkeyOK &&
                ((!aUserList[i].expiry>0) ||
                (aUserList[i].expiry >= now))) {
              // key still valid
              try {
                mailAddr = EnigStripEmail(aUserList[i].userId).toLowerCase();
              }
              catch (ex) {
                mailAddr = EnigStripEmail(aUserList[i].userId.replace(/\"/g,"")).toLowerCase();
              }
              aUserList[i].valid=true;
              escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");
              s1=new RegExp("[, ]?"+escapedMailAddr+"[, ]","i");
              s2=new RegExp("[, ]"+escapedMailAddr+"[, ]?","i");
              if ((mailAddr != EMPTY_UID) && (invalidAddr.indexOf(" "+mailAddr+" ")<0)) {
                aValidUsers.push(mailAddr);
                aUserList[i].activeState =(toAddr.search(s1)>=0 || toAddr.search(s2)>=0) ? 1 : 0;
              }
              else {
                aUserList[i].uidValid = false;
                aUserList[i].activeState = 0;
              }
              if (aUserList[i].activeState==0 && toKeys.length>0) {
                aUserList[i].activeState=(toKeys.indexOf("0x"+aUserList[i].keyId)>=0 ? 1 : 0)
              }
          }
        }
        else {
          // special handling for gpg groups
          mailAddr = EnigStripEmail(aUserList[i].userId).toLowerCase();
          aValidUsers.push(mailAddr);
          aUserList[i].valid = true;
          aUserList[i].uidValid = true;
          if (toKeys.length > 0) {
            aUserList[i].activeState=(toKeys.indexOf("GROUP:"+aUserList[i].keyId+",")>=0 ? 1 : 0)
          }
          else
            aUserList[i].activeState = 0;
        }
        
        if (! hideExpired || aUserList[i].activeState < 2) {
          if ((aUserList[i].keyTrust != KEY_IS_GROUP) && aUserList[i].SubUserIds.length) {
            for (var user=0; user<aUserList[i].SubUserIds.length; user++) {
              if (KEY_NOT_VALID.indexOf(aUserList[i].SubUserIds[user].trustLevel)<0) {
                if (aUserList[i].activeState < 2 || gAllowExpired) {
                  // add uid's for valid keys
                  try {
                    mailAddr = EnigStripEmail(aUserList[i].SubUserIds[user].userId);
                  }
                  catch (ex) {
                    mailAddr = EnigStripEmail(aUserList[i].SubUserIds[user].userId.replace(/\"/g,""));
                  }
                  if (uidNotValid.indexOf(aUserList[i].SubUserIds[user].trustLevel)<0) {
                    aValidUsers.push(mailAddr);
                    aUserList[i].valid=true;
                    escapedMailAddr=mailAddr.replace(escapeRegExp, "\\$1");
                    s1=new RegExp("[, ]?"+escapedMailAddr+"[, ]","i");
                    s2=new RegExp("[, ]"+escapedMailAddr+"[, ]?","i");
                    if ((mailAddr != EMPTY_UID) && (toAddr.search(s1)>=0 || toAddr.search(s2)>=0)) {
                      aUserList[i].activeState = 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
   }
   catch (ex) {
      ERROR_LOG("ERROR in enigmailUserSelection: enigmailUserSelLoad:\n");
      ERROR_LOG("  userId="+aUserList[i].userId+" expiry="+ aUserList[i].expiry+"\n");
      if ((typeof user)=="number" && (typeof aUserList[i].SubUserIds[user].userId)=="string") {
        ERROR_LOG("  subUserId="+aUserList[i].SubUserIds[user].userId+"\n");
      }
   }

   aUserList.sort(sortUsers);

  // Build up key treeView
  for (i=0; i<aUserList.length; i++) {
      var treeItem=null;
      if (! hideExpired || aUserList[i].activeState<2) {
        // do not show if expired keys are hidden
        if (secretOnly) {
          treeItem=enigUserSelCreateRow(aUserList[i], aUserList[i].activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].created, "", true)
        }
        else {
          treeItem=enigUserSelCreateRow(aUserList[i], aUserList[i].activeState, aUserList[i].userId, aUserList[i].keyId, aUserList[i].expiry, aUserList[i].keyTrust, aUserList[i].uidValid)
        }
        if (aUserList[i].SubUserIds.length) {
          var subChildren=document.createElement("treechildren");
          for (user=0; user<aUserList[i].SubUserIds.length; user++) {
            if (KEY_NOT_VALID.indexOf(aUserList[i].SubUserIds[user].trustLevel)<0) {
              var subItem=enigUserSelCreateRow(aUserList[i], -1, aUserList[i].SubUserIds[user].userId, "", "", aUserList[i].SubUserIds[user].trustLevel, true);
              subChildren.appendChild(subItem);
            }
          }
          if (subChildren.hasChildNodes()) {
            treeItem.setAttribute("container", "true");
            treeItem.appendChild(subChildren);
          }
        }
      }
      if (treeItem)
        treeChildren.appendChild(treeItem);
   }

   // Build up list of not found recipients
   var aNotFound=new Array();
   toAddrList = toAddr.split(/[, ]+/);
   var j;
   for (i=0; i<toAddrList.length; i++) {
     if (toAddrList[i].length>0) {
        for (j=0; j<aValidUsers.length; j++) {
           if (aValidUsers[j].toLowerCase() == toAddrList[i].toLowerCase()) {
              j=aValidUsers.length + 3;
           }
        }
        if (j==aValidUsers.length) {
           aNotFound.push(toAddrList[i]);
        }
     }
   }
   var toKeyList=toKeys.split(/[, ]+/);
   for (i=0; i<toKeyList.length; i++) {
      if (toKeyList[i].length>0) {
        for (j=0; j<aUserList.length; j++) {
           if (aUserList[j].valid && "0x"+aUserList[j].keyId == toKeyList[i]) {
              j=aValidUsers.length + 3;
           }
        }
        if (j==aUserList.length) {
           aNotFound.push("Key Id '"+toKeyList[i]+"'");
        }
      }
   }
   window.arguments[INPUT].notFoundList=aNotFound;

   if (window.arguments[INPUT].options.indexOf("forUser")<0) {
     descNotFound.firstChild.data = aNotFound.join(", ");
   }
}


// create a (sub) row for the user tree
function enigUserSelCreateRow (userObj, activeState, userId, keyValue, dateField, trustStatus, uidValid) {
  var selectCol=document.createElement("treecell");
  selectCol.setAttribute("id", "indicator");
  var trustCol=document.createElement("treecell");
  var expCol=document.createElement("treecell");
  var userCol=document.createElement("treecell");

  userCol.setAttribute("id", "name");
  expCol.setAttribute("id", "expiry");
  trustCol.setAttribute("id", "trust");

  userCol.setAttribute("label", userId);
  expCol.setAttribute("label", EnigGetDateTime(dateField,true, false));

  var keyCol=document.createElement("treecell");
  if (userObj.keyTrust != KEY_IS_GROUP) {
    keyCol.setAttribute("label", keyValue.substring(8,16));
  }
  else
    keyCol.setAttribute("label", EnigGetString("keyTrust.group"));
  keyCol.setAttribute("id", "keyid");

  var trust=EnigGetTrustLabel(trustStatus.charAt(0));
  if (!uidValid) {
    userCol.setAttribute("properties", "enigKeyInactive");
    trustCol.setAttribute("properties", "enigKeyInactive");
    expCol.setAttribute("properties", "enigKeyInactive");
    keyCol.setAttribute("properties", "enigKeyInactive");
    trust=EnigGetString("keyTrust.untrusted");
  }
  if (!userObj.subkeyOK && KEY_NOT_VALID.indexOf(trustStatus.charAt(0))<0) {
    trust=EnigGetString("keyValid.noSubkey");
  }
  if (((userObj.keyTrust.length>0) &&
      (KEY_NOT_VALID.indexOf(userObj.keyTrust.charAt(0))>=0)) ||
      (!userObj.subkeyOK) ||
      ((!gAlwaysTrust) && ("mfu".indexOf(userObj.keyTrust.charAt(0))<0)) ||
      ((!gAlwaysTrust) && trustStatus.length>0 &&
        ("o-qn".indexOf(trustStatus.charAt(0))>=0))) {
    userCol.setAttribute("properties", "enigKeyInactive");
    trustCol.setAttribute("properties", "enigKeyInactive");
    expCol.setAttribute("properties", "enigKeyInactive");
    keyCol.setAttribute("properties", "enigKeyInactive");
    if (!gAllowExpired && activeState>=0) activeState=2;
  }

  enigSetActive(selectCol, activeState);
  trustCol.setAttribute("label", trust);
  var userRow=document.createElement("treerow");
  userRow.appendChild(selectCol);
  userRow.appendChild(userCol);
  userRow.appendChild(trustCol);
  userRow.appendChild(expCol);
  userRow.appendChild(keyCol);
  var treeItem=document.createElement("treeitem");
  if (userObj.keyTrust == KEY_IS_GROUP) {
    treeItem.setAttribute("id", "GROUP:"+userObj.keyId);
  }
  else {
    treeItem.setAttribute("id", "0x"+userObj.keyId);
  }
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
    if (gUserList.currentIndex >= 0) {
      resultObj.userList.push(gUserList.view.getItemAtIndex(gUserList.currentIndex).getAttribute("id"));
      // resultObj.userList.push(gUserList.currentItem.getAttribute("id"));
    }
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
    EnigSetPref("recipientsSelection", 2);
  }
  if (resultObj.userList.length == 0 && gSendEncrypted) {
    EnigAlert(EnigGetString("atLeastOneKey"));
    return false;
  }
  
  if ((resultObj.userList.length < getToAddrList().length) && gSendEncrypted) {
    if (! EnigConfirm(EnigGetString("fewerKeysThanRecipients"), EnigGetString("dlg.button.continue"), EnigGetString("userSel.button.goBack")))
      return false;
  }
  
  resultObj.cancelled=false;

  resultObj.encrypt = gSendEncrypted;
  return true;
}

function getToAddrList() {
  var toAddrList
  try {
    toAddrList=EnigStripEmail(window.arguments[INPUT].toAddr).split(/[ ,]+/);
  }
  catch(ex) {
    toAddrList = new Array();
  }
  return toAddrList;
}

function onClickCallback(event) {

  enigmailUserSelCallback(event);
}

function enigmailUserSelCallback(event) {
  if (!gSendEncrypted)
    return;

  var row = {};
  var col = {};
  var elt = {};
  var Tree;
  if (event.type == "keypress") {
    // key event
    if (event.charCode == 32) {
      Tree = event.target;
      if (Tree.view.selection.count > 0) {
        row.value = Tree.view.selection.currentIndex;
      }
    }
    else {
      return;
    }
  }
  else if (event.type == "click") {
    // Mouse event
    Tree = document.getElementById("enigmailUserIdSelection");
    Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);

    if ((event.detail == 1) && (col.value.id != "selectionCol"))
      return; // single clicks are only relvant for the selection column

    event.stopPropagation();

  }

  if (row.value == -1)
    return;
  var treeItem = Tree.contentView.getItemAtIndex(row.value);
  Tree.currentItem=treeItem;
  var aRows = treeItem.getElementsByAttribute("id","indicator")

  if (event.detail == 2) {
    if (window.arguments[INPUT].options.indexOf("multisel")< 0) {
      document.getElementById("enigmailUserSelectionList").acceptDialog();
      return;
    }
  }

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
  if (EnigGetPref("recipientsSelection")>2) {
    EnigSetPref("recipientsSelection", 2);
  }

  var resultObj=window.arguments[RESULT];
  resultObj.userList = new Array();
  resultObj.perRecipientRules=true;
  resultObj.cancelled=false;
  resultObj.encrypt = "";
  window.close();
  return true;
}

function enigmailSearchMissingKeys () {

  var inputObj = {
    searchList : window.arguments[INPUT].notFoundList
  };
  var resultObj = new Object();

  EnigDownloadKeys(inputObj, resultObj);

  if (resultObj.importedKeys > 0) {
    enigmailRefreshKeys();
  }

}
