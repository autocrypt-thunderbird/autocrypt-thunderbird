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
    enigCloseDialog();
    return false;
  }
  
  var valueObj = { keyId: "<"+window.arguments[INPUT].searchList.join("> <")+">" };
  var checkObj = new Object();
  var keyserver = null;
  
  while (! keyserver) {
    window.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
          "", "dialog,modal,centerscreen", valueObj, checkObj);
  
    if (! checkObj.value) {
      enigCloseDialog();
      return false;
    }
    keyserver = checkObj.value;
  }
  
  var protocol="";
  if (keyserver.search(/[a-zA-Z0-9\-\_\.]+:\/\//)==0) {
    protocol=keyserver.replace(/^([a-zA-Z0-9\-\_\.]+)(:\/\/.*)/, "$1");
    if (protocol.search(/hkp/i) >= 0) {
      protocol="hkp";
    }
    keyserver=keyserver.replace(/^[a-zA-Z0-9\-\_\.]+:\/\//, "");
  }
  else {
    protocol="hkp";
  }
  
  var port = ENIG_DEFAULT_HKP_PORT;
  var m = keyserver.match(/^(.+)(:)(\d+)$/);
  if (m && m.length==4) {
    keyserver = m[1];
    port = m[3];
  }
  
  window.enigRequest = {
    searchList: window.arguments[INPUT].searchList,
    keyNum: 0,
    keyserver: keyserver,
    port: port,
    protocol: protocol,
    keyList: [],
    requestType: (EnigGetPref("useGpgKeysTool") ? ENIG_CONN_TYPE_GPGKEYS : ENIG_CONN_TYPE_HTTP),
    gpgkeysRequest: null,
    progressMeter: document.getElementById("dialog.progress"),
    httpInProgress: false
  };

  switch (window.enigRequest.requestType) {
  case ENIG_CONN_TYPE_HTTP:
    enigNewHttpRequest(nsIEnigmail.SEARCH_KEY, enigScanKeys);
    break;
  case ENIG_CONN_TYPE_GPGKEYS:
    enigNewGpgKeysRequest(nsIEnigmail.SEARCH_KEY, enigScanKeys);
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
    switch (window.enigRequest.requestType) {
    case ENIG_CONN_TYPE_HTTP:
      enigNewHttpRequest(nsIEnigmail.DOWNLOAD_KEY, enigImportKeys);
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      enigNewGpgKeysRequest(nsIEnigmail.DOWNLOAD_KEY, enigImportKeys);
      break;
    }

    // do not yet close the window, so that we can display some progress info
    return false;
  }

  return true;
}


function onCancel() {
  if (window.enigRequest.httpInProgress) {
    // stop download
    try {
      if ((typeof(window.enigHttpReq) == "object") && 
          (window.enigHttpReq.readyState != 4)) {
          window.enigHttpReq.abort();
      }
      window.enigRequest.httpInProgress=false;
      if (window.enigRequest.gpgkeysRequest) {
        enigGpgkeysCloseRequest();
      }
    }
    catch (ex) {}
  }
  window.close();
}


function enigStatusError () {
  DEBUG_LOG("enigmailSearchKey.js: enigStatusError\n");
  window.enigRequest.httpInProgress=false;
  EnigAlert(EnigGetString("noKeyserverConn", this.channel.originalURI.prePath));
  enigCloseDialog();
}

function enigCloseDialog() {
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
    enigCloseDialog();
    return;
  }
  
}


function enigImportKeys (connType, txt) {
  DEBUG_LOG("enigmailSearchKey.js: enigImportKeys\n");
  
  window.enigRequest.keyNum++;
  window.enigRequest.progressMeter.mode = "determined";
  window.enigRequest.progressMeter.value = (100 * window.enigRequest.keyNum / window.enigRequest.dlKeyList.length).toFixed(0);

  if (!enigImportHtmlKeys(txt)) return;

  if (window.enigRequest.dlKeyList.length > window.enigRequest.keyNum) {
    switch (connType) {
      case ENIG_CONN_TYPE_HTTP:
        enigNewHttpRequest(nsIEnigmail.DOWNLOAD_KEY, window.enigHttpReq.requestCallbackFunc);
        break;
      case ENIG_CONN_TYPE_GPGKEYS:
        enigNewGpgKeysRequest(nsIEnigmail.DOWNLOAD_KEY, window.enigRequest.callbackFunction);
    }
    return;
  }
  
  window.enigRequest.httpInProgress=false;
  
  enigCloseDialog();
}

function enigImportHtmlKeys(txt) {
  var errorMsgObj = new Object();
  
  var enigmailSvc = GetEnigmailSvc();
  if (! enigmailSvc) 
    return false;
  
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


function enigNewHttpRequest(requestType, requestCallbackFunc) {
  DEBUG_LOG("enigmailSearchKey.js: enigNewHttpRequest\n");
  
  switch (window.enigRequest.protocol) {
  case "hkp":
    window.enigRequest.protocol = "http";
  case "http":
  case "https":
    break;
  default:
    var msg=EnigGetString("protocolNotSupported", window.enigRequest.protocol);
    if (! EnigGetPref("useGpgKeysTool"))
      msg += " "+EnigGetString("gpgkeysDisabled");
    EnigAlert(msg);
    enigCloseDialog();
    return;
  }

  var httpReq = new XMLHttpRequest();
  var reqCommand;
  switch (requestType) {
  case nsIEnigmail.SEARCH_KEY:
    var pubKey = escape("<"+trim(window.enigRequest.searchList[window.enigRequest.keyNum])+">");
    reqCommand = window.enigRequest.protocol+"://"+window.enigRequest.keyserver+":"+window.enigRequest.port+"/pks/lookup?search="+pubKey+"&op=index";
    break;
  case nsIEnigmail.DOWNLOAD_KEY:
    var keyId = escape(trim(window.enigRequest.dlKeyList[window.enigRequest.keyNum]));
    reqCommand = window.enigRequest.protocol+"://"+window.enigRequest.keyserver+":"+window.enigRequest.port+"/pks/lookup?search="+keyId+"&op=get";
    break;
  default:
    EnigAlert("Unknown request type "+requestType);
    return;
  }

  window.enigRequest.httpInProgress=true;
  httpReq.open("GET", reqCommand);
  httpReq.onerror=enigStatusError;
  httpReq.onload=enigStatusLoaded;
  httpReq.requestCallbackFunc = requestCallbackFunc;
  window.enigHttpReq = httpReq;
  httpReq.send("");
}


function enigScanKeys(connType, htmlTxt) {
  DEBUG_LOG("enigmailSearchKey.js: enigScanKeys\n");

  window.enigRequest.keyNum++;
  window.enigRequest.progressMeter.mode = "determined";
  window.enigRequest.progressMeter.value = (100 * window.enigRequest.keyNum / window.enigRequest.searchList.length).toFixed(0);

  switch (connType) {
    case ENIG_CONN_TYPE_HTTP:
      // interpret HTML codes (e.g. &lt;)
      var domParser = new DOMParser();
      // needs improvement: result is max. 4096 bytes long!
      var htmlNode = domParser.parseFromString("<p>" + htmlTxt + "</p>", "text/xml");
    
      if (htmlNode.firstChild.nodeName=="parsererror") {
        EnigAlert("internalError");
        return false;
      }
      enigScanHtmlKeys(htmlNode.firstChild.firstChild.data);
      break;
    case ENIG_CONN_TYPE_GPGKEYS:
      enigScanGpgKeys(EnigConvertGpgToUnicode(htmlTxt));
      break;
    default:
      ERROR_LOG("bizarre connType: "+connType+"\n");
  }

  if (window.enigRequest.searchList.length > window.enigRequest.keyNum) {
    switch (connType) {
      case ENIG_CONN_TYPE_HTTP:
        enigNewHttpRequest(nsIEnigmail.SEARCH_KEY, window.enigHttpReq.requestCallbackFunc);
        break;
      case  ENIG_CONN_TYPE_GPGKEYS:
        enigNewGpgKeysRequest(nsIEnigmail.SEARCH_KEY, window.enigRequest.callbackFunction);
    }
    return true;
  }
  
  window.enigRequest.httpInProgress=false;
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


function enigScanGpgKeys(txt) {
  DEBUG_LOG("enigmailSearchKey.js: enigScanGpgKeys\n");
  
  var lines=txt.split(/(\r\n|\n|\r)/);
  var inputPart=0;
  var key;
  for (i=0; i<lines.length; i++) {
    if (lines[i].search(/^COUNT \d+\s*$/)==0) {
      inputPart=1;
      continue;
    }
    if (inputPart==1 && (lines[i].search(/^([a-fA-F0-9]{8}){1,2}:/))==0) {
      // new key
      var m=lines[i].split(/:/);
      if (m && m.length>0 ) {
        if (key) {
          if (key.keyId == m[0]) {
            key.uid.push(trim(m[1]));
          }
          else {
            window.enigRequest.keyList.push(key);
            key=null;
          }
        }
        if (! key) {
          var dat=new Date(m[3]*1000);
          var month=String(dat.getMonth()+101).substr(1);
          var day=String(dat.getDate()+100).substr(1);
          key={
            keyId: m[0],
            created: dat.getFullYear()+"-"+month+"-"+day,
            uid: [m[1]]
          };
        }
      }
    }
  }
  
  // append prev. key to keylist
  if (key) {
    window.enigRequest.keyList.push(key);
  }
}

// interaction with gpgkeys_xxx

function enigNewGpgKeysRequest(requestType, callbackFunction) {
  DEBUG_LOG("enigmailGpgkeys.js: enigNewGpgKeysRequest\n");
  
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    return;
  }
  
  window.enigRequest.callbackFunction = callbackFunction;
  var requestObserver = new EnigRequestObserver(enigmailGpgkeysTerminate, null);
  var errorMsgObj = new Object();
  var ipcRequest = null;
  window.enigRequest.gpgkeysRequest = null;
  
  try {
  
    if (requestType == nsIEnigmail.SEARCH_KEY) {
      var keyValue = window.enigRequest.searchList[window.enigRequest.keyNum];
    }
    else {
      keyValue = window.enigRequest.dlKeyList[window.enigRequest.keyNum];
    }
  
    ipcRequest = enigmailSvc.searchKey(requestType,
                                       window.enigRequest.protocol, 
                                       window.enigRequest.keyserver, 
                                       window.enigRequest.port, 
                                       keyValue,
                                       requestObserver, 
                                       errorMsgObj);
  } catch (ex) {}
  
  if (!ipcRequest) {
    // calling gpgkeys_xxx failed, let's try builtin http variant
    switch (window.enigRequest.protocol) {
    case "hkp":
    case "http":
    case "https":
      window.enigRequest.requestType = ENIG_CONN_TYPE_HTTP;
      enigNewHttpRequest(requestType, enigScanKeys);
      return;
    default:
      EnigAlert(EnigGetString("gpgKeysFailed", window.enigRequest.protocol));
      enigCloseDialog();
      return;
    }
  }
  
  window.enigRequest.gpgkeysRequest = ipcRequest;
  
  WRITE_LOG("enigmailGpgkeys.js: Start: window.enigRequest.gpgkeysRequest = "+window.enigRequest.gpgkeysRequest+"\n");
}



function enigGpgkeysCloseRequest() {
  DEBUG_LOG("enigmailKeygen.js: CloseRequest\n");

  if (window.enigRequest.gpgkeysRequest) {
    try {
      var keygenProcess = window.enigRequest.gpgkeysRequest.pipeTransport;
      if (keygenProcess)
        keygenProcess.terminate();
    } catch(ex) {}

    window.enigRequest.gpgkeysRequest.close(true);
    window.enigRequest.gpgkeysRequest = null;
  }
}

function enigmailGpgkeysTerminate(terminateArg, ipcRequest) {
   DEBUG_LOG("enigmailGpgkeys.js: Terminate: "+ipcRequest+"\n");

   var GpgkeysProcess = ipcRequest.pipeTransport;

   if (GpgkeysProcess && !GpgkeysProcess.isAttached) {
     GpgkeysProcess.terminate();
     var exitCode = GpgkeysProcess.exitCode();
     DEBUG_LOG("enigmailGpgkeysConsole: exitCode = "+exitCode+"\n");
   }

  var console = window.enigRequest.gpgkeysRequest.stdoutConsole;

  try {
    console = console.QueryInterface(Components.interfaces.nsIPipeConsole);
    var txt = null;

    if (console && console.hasNewData()) {
      DEBUG_LOG("enigmailGpgkeys.js: enigRefreshConsole(): hasNewData\n");
      txt = console.getData();
    }
    
    ipcRequest.close(true);
    enigGpgkeysCloseRequest();

    if (txt)
      window.enigRequest.callbackFunction(ENIG_CONN_TYPE_GPGKEYS, txt);
  } catch (ex) {}
}

// GUI related stuff

function enigPopulateList(keyList) {
  DEBUG_LOG("enigmailSearchKey.js: enigPopulateList\n");
  
  var sortUsers = function (a,b) {
     if (a.uid[0]<b.uid[0]) { return -1; } else {return 1; }
  }
 
  keyList.sort(sortUsers);

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
