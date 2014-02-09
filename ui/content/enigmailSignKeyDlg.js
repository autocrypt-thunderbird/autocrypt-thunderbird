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
 *   Nils Maier <MaierMan@web.de>
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

Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/keyManagement.jsm");
const Ec = EnigmailCommon;


var gSignatureList = null;
var gUidCount = null;

function onLoad() {
  var key;
  var i;

  window.arguments[1].refresh = false;

  var enigmailSvc = Ec.getService(window);
  if (!enigmailSvc) {
    Ec.alert(window, Ec.getString("accessError"));
    window.close();
    return;
  }
  var keys = Ec.getSecretKeys(window);
  if (! keys) window.close();
  var menulist=document.getElementById("signWithKey");

  for each (key in keys) {
    menulist.appendItem(key.name + " - 0x"+key.id.substr(-8,8), key.id);
  }
  if (menulist.selectedIndex == -1) {
    menulist.selectedIndex = 0;
  }

  // determine keys that have already signed the key
  try {
    var exitCodeObj = new Object();
    var errorMsgObj = new Object();
    gSignatureList = new Array();
    gUidCount = new Array();
    var keyId = null;
    var fingerprint = "";
    var sigListStr = enigmailSvc.getKeySig("0x"+window.arguments[0].keyId, exitCodeObj, errorMsgObj);

    if (exitCodeObj.value == 0) {
      var sigList = sigListStr.split(/[\n\r]+/);
      var currKey = null;
      var currUID = null;

      for (i=0; i < sigList.length; i++) {
        var aLine=sigList[i].split(/:/);

        // Now inspect the splitted key packets
        switch (aLine[0]) {
        case "pub":
          keyId = aLine[4];
          break;

        case "uid":
          if (typeof(currKey) != "string") currKey = aLine[4];
          // Count all UIDs
          if (gUidCount[keyId]==undefined) {
            gUidCount[keyId]=1;
          }
          else {
            gUidCount[keyId]=gUidCount[keyId]+1;
          }
          break;

        case "sig":
          // Count signatures separately for each signing key
          if (gSignatureList[aLine[4]]==undefined) {
            gSignatureList[aLine[4]]=1;
          }
          else {
            gSignatureList[aLine[4]]=gSignatureList[aLine[4]]+1;
          }
          break;

        case "fpr":
          if (fingerprint=="") {
            Ec.DEBUG_LOG("enigmailSignKeyDlg.js: fpr:"+currKey+" -> "+aLine[9]+"\n");
            fingerprint = aLine[9];
          }
          break;
        default:
        }
      }
    }
    enigKeySelCb();
  } catch (ex) {}

  var keyDesc = window.arguments[0].userId+" - 0x"+ window.arguments[0].keyId.substr(-8,8);
  document.getElementById("keyId").value=keyDesc;
  if (fingerprint && fingerprint.length > 0) {
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

  var enigmailSvc = Ec.getService(window);
  if (!enigmailSvc) {
    Ec.alert(window, Ec.getString("accessError"));
    return true;
  }

  EnigmailKeyMgmt.signKey(window,
    "0x"+signWithKey.selectedItem.value,
    window.arguments[0].keyId,
    localSig.checked,
    trustLevel.selectedItem.value,
    function (exitCode, errorMsg) {
      if (exitCode != 0) {
        Ec.alert(window, Ec.getString("signKeyFailed")+"\n\n"+errorMsg);
      }
      else {
        window.arguments[1].refresh = true;
      }
      window.close();
    }
  );

  return false; // wait with closing until subprocess terminated
}

function enigKeySelCb() {
  var KeyToBeSigned = window.arguments[0].keyId;
  var KeyToBeSigned32 = KeyToBeSigned.substr(-8,8);
  var signWithKey = document.getElementById("signWithKey");
  var signWithKeyId = signWithKey.selectedItem.value;
  var alreadySigned = document.getElementById("alreadySigned");
  var acceptButton = document.getElementById("enigmailSignKeyDlg").getButton("accept");

  if (gSignatureList[signWithKeyId] == undefined){
    // No signature yet, Hide hint field and ENable OK button
    alreadySigned.setAttribute("collapsed", "true");
    acceptButton.disabled = false;
  }
  else if (gSignatureList[signWithKeyId]==gUidCount[KeyToBeSigned]) {
    // Signature count == UID count, so key is already fully signed and another signing operation makes no more sense
    // Here, we display a hint and DISable the OK button
    alreadySigned.setAttribute("value", Ec.getString("alreadySigned.label", "0x"+ KeyToBeSigned32));
    alreadySigned.removeAttribute("collapsed");
    acceptButton.disabled = true;
  }
  else if (gSignatureList[signWithKeyId] > 0) {
    // Signature count != UID count, so key is partly signed and another sign operation makes sense
    // Here, we display a hint and ENable the OK button
    alreadySigned.setAttribute("value", Ec.getString("partlySigned.label", "0x"+ KeyToBeSigned32));
    alreadySigned.removeAttribute("collapsed");
    acceptButton.disabled = false;
  }
  else {
    // Default catch for unforeseen cases. Hide hint field and enable OK button
    alreadySigned.setAttribute("collapsed", "true");
    acceptButton.disabled = false;
  }
}

