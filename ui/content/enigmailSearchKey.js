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
EnigInitCommon("enigmailSearchKey");

const INPUT = 0;
const RESULT = 1;

const ENIG_DEFAULT_HKP_PORT="11371";

const ENIG_IMG_NOT_SELECTED ="chrome://enigmail/content/check0.png";
const ENIG_IMG_SELECTED     ="chrome://enigmail/content/check1.png";
const ENIG_IMG_DISABLED     ="chrome://enigmail/content/check2.png";

const ENIG_CONN_TYPE_HTTP    = 1;
const ENIG_CONN_TYPE_GPGKEYS = 2;

const KEY_EXPIRED="e";
const KEY_REVOKED="r";
const KEY_INVALID="i";
const KEY_DISABLED="d";
const KEY_NOT_VALID=KEY_EXPIRED+KEY_REVOKED+KEY_INVALID+KEY_DISABLED;


function trim(str) {
  return str.replace(/^(\s*)(.*)/, "$2").replace(/\s+$/,"");
}

function onLoad () {

  window.arguments[RESULT].importedKeys=0;
  var ioService = Components.classes[ENIG_IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
  if (ioService && ioService.offline) {
    EnigAlert(EnigGetString("needOnline"));
    enigCancelDialog();
    return false;
  }
  
  var valueObj = { keyId: "<"+window.arguments[INPUT].searchList.join("> <")+">" };
  var checkObj = new Object();
  var keyserver = null;
  
  while (! keyserver) {
    window.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
          "", "dialog,modal,centerscreen", valueObj, checkObj);
  
    if (! checkObj.value) {
      enigCancelDialog();
      return false;
    }
    if (checkObj.value.toLowerCase().indexOf("ldap://")==0) {
      EnigAlert(EnigGetString("noLdapSupport"));
    }
    else{
      keyserver = checkObj.value;
    }
  }
  
  var protocol="";
  if (keyserver.search(/[a-zA-Z0-9\-\_\.]+:\/\//)==0) {
    var protocol=keyserver.replace(/^([a-zA-Z0-9\-\_\.]+)(:\/\/.*)/, "$1");
    if (protocol.search(/hkp/i) >= 0) {
      protocol="http";
    }
    keyserver=keyserver.replace(/^[a-zA-Z0-9\-\_\.]+:\/\//, "");
  }
  else {
    protocol="http";
  }
  
  if (keyserver.search(/^.*:\d+$/)<0) {
    keyserver+=":"+ENIG_DEFAULT_HKP_PORT;
  }
  
  window.enigRequest = {
    searchList: window.arguments[INPUT].searchList,
    keyNum: 0,
    keyserver: protocol+"://"+keyserver,
    keyList: [],
    requestType: ENIG_CONN_TYPE_HTTP,
    progressMeter: document.getElementById("dialog.progress"),
    downloading: true
  };

  switch (window.enigRequest.requestType) {
  case ENIG_CONN_TYPE_HTTP:
    enigNewHttpSearchRequest(enigScanKeys);
    break;
  case ENIG_CONN_TYPE_GPGKEYS:
    EnigAlert("Use of gpgkeys is not yet available");
    break;
  }
  return true;
}


function onAccept () {
  DEBUG_LOG("enigmailSearchKey.js: onAccept\n");

  var keySelList = document.getElementById("enigmailKeySel");
  var treeChildren=keySelList.getElementsByAttribute("id", "enigmailKeySelChildren")[0];

  window.enigRequest.dlKeyList = [];
  var item=treeChildren.firstChild;
  while (item) {
    var aRows = item.getElementsByAttribute("id","indicator")
    if (aRows.length) {
      var elem=aRows[0];
      if (elem.getAttribute("active") == "1") {
        window.enigRequest.dlKeyList.push(item.getAttribute("id"));
      }
    }
    item = item.nextSibling;
  }

  if (window.enigRequest.dlKeyList.length>0) {
    window.enigRequest.progressMeter.value = 0;
    window.enigRequest.progressMeter.mode = "determined";
    document.getElementById("progress.box").removeAttribute("hidden");
    document.getElementById("dialog.accept").setAttribute("disabled", "true");
    window.enigRequest.keyNum = 0;
    window.enigRequest.downloading=true;
    switch (window.enigRequest.requestType) {
    case ENIG_CONN_TYPE_HTTP:
      enigNewHttpDownloadRequest(enigImportKeys);
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      EnigAlert("Use of gpgkeys is not yet available");
      break;
    }

    // do not yet close the window, so that we can display some progress info
    return false;
  }

  return true;
}


function onCancel() {
  if (window.enigRequest.downloading) {
    // stop download
    try {
      if ((typeof(window.enigHttpReq) == "object") && 
          (window.enigHttpReq.readyState != 4)) {
          window.enigHttpReq.abort();
      }
      window.enigRequest.downloading=false;
    }
    catch (ex) {}
  }
  window.close();
}


function enigStatusError () {
  DEBUG_LOG("enigmailSearchKey.js: enigStatusError\n");
  window.enigRequest.downloading=false;
  EnigAlert(EnigGetString("noKeyserverConn", this.channel.originalURI.prePath));
  enigCancelDialog();
}

function enigCancelDialog() {
  document.getElementById("enigmailSearchKeyDlg").cancelDialog();
  window.close();
}

function enigStatusLoaded (event) {
  DEBUG_LOG("enigmailSearchKey.js: enigStatusLoaded\n");
    
  if (this.status == 200) {
    // de-HTMLize the result
    var htmlTxt = this.responseText.replace(/<([^<>]+)>/g, "");
    
    if (!this.requestCallbackFunc(ENIG_CONN_TYPE_HTTP, htmlTxt)) 
      return;
  }
  else if (this.statusText!="OK") {
    EnigAlert(EnigGetString("keyDownloadFailed", this.statusText));
    enigCancelDialog();
    return;
  }
  
}


function enigNewHttpDownloadRequest (requestCallbackFunc) {
  DEBUG_LOG("enigmailSearchKey.js: enigNewHttpDownloadRequest\n");

  var keyId = escape(trim(window.enigRequest.dlKeyList[window.enigRequest.keyNum]));

  var httpReq = new XMLHttpRequest();
  httpReq.open("GET", window.enigRequest.keyserver+"/pks/lookup?search="+keyId+"&op=get");

  httpReq.onerror=enigStatusError;
  httpReq.onload=enigStatusLoaded;
  httpReq.requestCallbackFunc = requestCallbackFunc;
  window.enigHttpReq = httpReq;
  httpReq.send("");
}


function enigImportKeys (connType, txt) {
  DEBUG_LOG("enigmailSearchKey.js: enigScanKeys\n");
  
  window.enigRequest.keyNum++;
  window.enigRequest.progressMeter.mode = "determined";
  window.enigRequest.progressMeter.value = (100 * window.enigRequest.keyNum / window.enigRequest.dlKeyList.length).toFixed(0);

  switch (connType) {
    case ENIG_CONN_TYPE_HTTP:
      if (!enigImportHtmlKeys(txt)) return;
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      break;
    default:
      ERROR_LOG("bizarre connType: "+connType+"\n");
  }

  if (window.enigRequest.dlKeyList.length > window.enigRequest.keyNum) {
    enigNewHttpDownloadRequest(window.enigHttpReq.requestCallbackFunc);
    return;
  }
  
  window.enigRequest.downloading=false;
  
  enigCancelDialog();
}

function enigImportHtmlKeys(txt) {
  var errorMsgObj = new Object();
  
  var enigmailSvc = GetEnigmailSvc();
  if (! enigmailSvc) 
    return;
  
  var uiFlags = nsIEnigmail.UI_ALLOW_KEY_IMPORT;
  var r = enigmailSvc.importKey(window, uiFlags, txt, 
                        window.enigRequest.dlKeyList[window.enigRequest.keyNum-1], 
                        errorMsgObj);
  if (errorMsgObj.value)
    EnigAlert(errorMsgObj.value);
  if (r == 0) {
    window.arguments[RESULT].importedKeys++;
    return true;
  }
  return false;
}


function enigNewHttpSearchRequest(requestCallbackFunc) {
  DEBUG_LOG("enigmailSearchKey.js: enigNewHttpSearchRequest\n");
  
  var pubKey = escape("<"+trim(window.enigRequest.searchList[window.enigRequest.keyNum])+">");

  var httpReq = new XMLHttpRequest();
  httpReq.open("GET", window.enigRequest.keyserver+"/pks/lookup?search="+pubKey+"&op=index");

  httpReq.onerror=enigStatusError;
  httpReq.onload=enigStatusLoaded;
  httpReq.requestCallbackFunc = requestCallbackFunc;
  window.enigHttpReq = httpReq;
  httpReq.send("");
}


function enigScanKeys(connType, htmlTxt) {
  DEBUG_LOG("enigmailSearchKey.js: enigScanKeys\n");

  // interpret HTML codes (e.g. &lt;)
  var domParser = new DOMParser();
  // needs improvement: result is max. 4096 bytes long!
  var htmlNode = domParser.parseFromString("<p>" + htmlTxt + "</p>", "text/xml");

  if (htmlNode.firstChild.nodeName=="parsererror") {
    EnigAlert("internalError");
    return false;
  }
  
  window.enigRequest.keyNum++;
  window.enigRequest.progressMeter.mode = "determined";
  window.enigRequest.progressMeter.value = (100 * window.enigRequest.keyNum / window.enigRequest.searchList.length).toFixed(0);

  switch (connType) {
    case ENIG_CONN_TYPE_HTTP:
      enigScanHtmlKeys(htmlNode.firstChild.firstChild.data);
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      break;
    default:
      ERROR_LOG("bizarre connType: "+connType+"\n");
  }

  if (window.enigRequest.searchList.length > window.enigRequest.keyNum) {
    enigNewHttpSearchRequest(window.enigHttpReq.requestCallbackFunc);
    return true;
  }
  
  window.enigRequest.downloading=false;
  enigPopulateList(window.enigRequest.keyList);
  document.getElementById("progress.box").setAttribute("hidden", "true");
  document.getElementById("dialog.accept").removeAttribute("disabled");
  
  return true;
}

function enigScanHtmlKeys (txt) {
  DEBUG_LOG("enigmailSearchKey.js: enigScanHtmlKeys\n");
  
  var lines=txt.split(/(\n\r|\n|\r)/);
  var key;
  for (i=0; i<lines.length; i++) {
    if (lines[i].search(/^\s*pub /)==0) {
      // new key
      if (key) {
        // first, append prev. key to keylist
        window.enigRequest.keyList.push(key);
      }
      key = null;
      var m=lines[i].match(/(\d+[a-zA-Z]?\/)([0-9a-fA-F]+)(\s+[\d\/\-\.]+\s+)(.*)/);
      if (m && m.length>0 ) {
        key={
          keyId: m[2],
          created: m[3],
          uid: []
        };
        if (m[4].search(/.+<.+@.+>/)>=0) {
          key.uid.push(trim(m[4]));
        }
        else if (m[4].search(/key (revoked|expired|disabled)/i)>=0) {
          DEBUG_LOG("revoked key id "+m[4]+"\n");
          key=null;
        }
      }
    }
    else {
      // amend to key
      if (key) {
        var uid = trim(lines[i]);
        if (uid.length>0)
          key.uid.push(uid);
      }
    }
  }
  
  // append prev. key to keylist
  if (key) {
    window.enigRequest.keyList.push(key);
  }
}


function enigPopulateList(keyList) {
  DEBUG_LOG("enigmailSearchKey.js: enigPopulateList\n");
  
  var treeList = document.getElementById("enigmailKeySel");
  var treeChildren=treeList.getElementsByAttribute("id", "enigmailKeySelChildren")[0];
  var treeItem;
  
  for (var i=0; i<keyList.length; i++) {
    treeItem = enigUserSelCreateRow(keyList[i].keyId, false, keyList[i].uid[0], keyList[i].created, "");
    if (keyList[i].uid.length>1) {
      treeItem.setAttribute("container", "true");
      var subChildren=document.createElement("treechildren");
      for (j=1; j<keyList[i].uid.length; j++) {
        var subItem=enigUserSelCreateRow(keyList[i].keyId, true, keyList[i].uid[j], "", "");
        subChildren.appendChild(subItem);
      }
      treeItem.appendChild(subChildren);
    }
    treeChildren.appendChild(treeItem);
  }
}

function enigUserSelCreateRow (keyId, subKey, userId, dateField, trustStatus) {
    var selectCol=document.createElement("treecell");
    selectCol.setAttribute("id", "indicator");
    var expCol=document.createElement("treecell");
    var userCol=document.createElement("treecell");
    userCol.setAttribute("id", "name");
    if (trustStatus.charAt(0)==KEY_EXPIRED) {
      expCol.setAttribute("label", EnigGetString("selKeyExpired", dateField));
    }
    else {
      expCol.setAttribute("label", dateField);
    }

    expCol.setAttribute("id", "expiry");
    userCol.setAttribute("label", userId);
    var keyCol=document.createElement("treecell");
    keyCol.setAttribute("id", "keyid");
    if (subKey) {
      enigSetActive(selectCol, -1);
      keyCol.setAttribute("label", "");
    }
    else  {
      enigSetActive(selectCol, 0);
      keyCol.setAttribute("label", keyId.substr(-8));
    }
    

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

function enigmailKeySelCallback(event) {
  DEBUG_LOG("enigmailSearchKey.js: enigmailKeySelCallback\n");
  
  var Tree = document.getElementById("enigmailKeySel");
  var row = {};
  var col = {};
  var elt = {};
  Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
  if (row.value == -1)
    return;


  var treeItem = Tree.contentView.getItemAtIndex(row.value);
  Tree.currentItem=treeItem;
  if (typeof(col.value) == "string") {
    // mozilla <= 1.7
    if (col.value != "selectionCol")
      return;
  }
  else {
    // mozilla >= 1.8a1
    if (col.value.id != "selectionCol")
      return;
  }
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
