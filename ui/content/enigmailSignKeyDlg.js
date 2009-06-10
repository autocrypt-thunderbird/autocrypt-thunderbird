/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/

 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.

 * The Original Code is Enigmail.

 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net>
 * are Copyright (C) 2004 Patrick Brunschwig.
 * All Rights Reserved.

 * Contributor(s):
 *   Nils Maier <MaierMan@web.de>

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


EnigInitCommon("enigmailSignKeyDlg");

var gSignatureList = null;
function onLoad() {
  window.arguments[1].refresh = false;
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    window.close();
    return;
  }
  var exitCodeObj = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj = new Object();
  var keyList=enigmailSvc.getUserIdList(true, false, exitCodeObj, statusFlagsObj, errorMsgObj);

  if (exitCodeObj.value != 0) {
    EnigAlert(errorMsgObj.value);
    window.close();
    return;
  }

  var userList=keyList.split(/\n/);

  var menulist=document.getElementById("signWithKey");
  var keyId = null;
  var keys = [];
  for (var i=0; i < userList.length; i++) {
    switch(userList[i].substr(0,4)){
    case "sec:":
      keyId = userList[i].split(/:/)[4];
      break;
    case "uid:":
      if (keyId == null) {
        break;
       }
      try {
        // try to get the calculated trust
        var calculatedTrust = enigmailSvc.getKeyDetails(keyId, false).split(/\r?\n/)[1].split(':')[1];
        if (calculatedTrust != 'u') {
          // do not offer signing with keys that do not have ultimate calculated trust
          break;
        }
      }
      catch (ex) {
        // cannot get validity... no-op?
      }
      keys.push({name: EnigConvertGpgToUnicode(userList[i].split(/:/)[9]).replace(/\\e3A/g, ":") + " - 0x"+keyId.substr(-8,8), id: keyId});
      keyId = null;
      break;
    }
  }
  keys.sort(function(a,b) { return a.name == b.name ? (a.id < b.id ? -1 : 1) : (a.name < b.name ? -1 : 1); });
  for each (key in keys) {
    menulist.appendItem(key.name, key.id);
  }
  if (menulist.selectedIndex == -1) {
    menulist.selectedIndex = 0;
  }

  // determine keys that have already signed the key
  try {
    gSignatureList = new Array();
    var fingerprint = "";
    var sigListStr = enigmailSvc.getKeySig("0x"+window.arguments[0].keyId, exitCodeObj, errorMsgObj);
    if (exitCodeObj.value == 0) {
      var sigList = sigListStr.split(/[\n\r]+/);
      var currKey = null;
      for (i=0; i < sigList.length; i++) {
        var aLine=sigList[i].split(/:/);
        switch (aLine[0]) {
        case "uid":
          if (typeof(currKey) != "string") currKey = aLine[4];
          break;
        case "sig":
          gSignatureList[aLine[4]] = 1;
          break;
        case "fpr":
          DEBUG_LOG("fpr:"+currKey+" -> "+aLine[9]+"\n");
          fingerprint = aLine[9];
          break;
        }
      }
    }
    enigKeySelCb();
  } catch (ex) {}

  var keyDesc = window.arguments[0].userId+" - 0x"+ window.arguments[0].keyId.substr(-8,8);
  document.getElementById("keyId").value=keyDesc;
  if (fingerprint) {
    var fpr = fingerprint.match(/(....)(....)(....)(....)(....)(....)(....)(....)(....)?(....)?/);
    if (fpr && fpr.length > 2) {
      fpr.shift();
      document.getElementById("fingerprint").value=fpr.join(" ");
    }
  }
}

function onAccept() {
  var trustLevel = document.getElementById("trustLevel");
  var localSig = document.getElementById("localSig");
  var signWithKey = document.getElementById("signWithKey");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    return;
  }

  var errorMsgObj = new Object();

  var r = enigmailSvc.signKey(window,
                            "0x"+signWithKey.selectedItem.value,
                            window.arguments[0].keyId,
                            localSig.checked,
                            trustLevel.selectedItem.value,
                            errorMsgObj);

  if (r != 0) {
    EnigAlert(EnigGetString("signKeyFailed")+"\n\n"+errorMsgObj.value);
    return;
  }
  else {
    window.arguments[1].refresh = true;
  }
}

function enigKeySelCb() {
  var signWithKey = document.getElementById("signWithKey");
  var alreadySigned = document.getElementById("alreadySigned");
  var acceptButton = document.getElementById("enigmailSignKeyDlg").getButton("accept");
  if (gSignatureList[signWithKey.selectedItem.value]) {
    alreadySigned.removeAttribute("collapsed");
    acceptButton.disabled = true;
  }
  else {
    alreadySigned.setAttribute("collapsed", "true");
    acceptButton.disabled = false;
  }
}

