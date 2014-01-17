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
 * Copyright (C) 2005 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
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

Components.utils.import("resource://enigmail/commonFuncs.jsm");
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/keyManagement.jsm");

const Ec = EnigmailCommon;

var gCardData = {};

function onLoad() {
  var enigmailSvc = Ec.getService(window);
  if (!enigmailSvc) {
    Ec.dispatchEvent(failWithError, 0, Ec.getString("accessError"));
    return;
  }
  var exitCodeObj = new Object();
  var errorMsgObj = new Object();

  var dryRun=false;
  try {
    dryRun = Ec.getPref("dryRun");
  }
  catch(ex) {}

  var cardStr = enigmailSvc.getCardStatus(exitCodeObj, errorMsgObj);
  if (exitCodeObj.value == 0) {
    var statusList=cardStr.split(/[\r\n]+/);
    for (var i=0; i<statusList.length; i++) {
      var l=statusList[i].split(/:/);
      switch (l[0]) {
      case "name":
        setValue("firstname", Ec.convertGpgToUnicode(l[1]));
        setValue(l[0], Ec.convertGpgToUnicode(l[2]));
        break;
      case "vendor":
        setValue(l[0], Ec.convertGpgToUnicode(l[2].replace(/\\x3a/ig, ":")));
        break;
      case "sex":
      case "forcepin":
        var selItem = document.getElementById("card_"+l[0]+"_"+l[1]);
        document.getElementById("card_"+l[0]).selectedItem = selItem;
        gCardData[l[0]] = l[1];
        break;
      case "pinretry":
      case "maxpinlen":
        setValue(l[0], l[1]+" / "+l[2]+" / "+l[3]);
        break;
      case "fpr":
        setValue("key_fpr_1", EnigmailFuncs.formatFpr(l[1]));
        setValue("key_fpr_2", EnigmailFuncs.formatFpr(l[2]));
        setValue("key_fpr_3", EnigmailFuncs.formatFpr(l[3]));
        break;
      case "fprtime":
        setValue("key_created_1", Ec.getDateTime(l[1], true, false));
        setValue("key_created_2", Ec.getDateTime(l[2], true, false));
        setValue("key_created_3", Ec.getDateTime(l[3], true, false));
        break;
      default:
        if (l[0]) {
          setValue(l[0], Ec.convertGpgToUnicode(l[1].replace(/\\x3a/ig, ":")));
        }
      }
    }
  }
  else {
    if (! dryRun) {
      Ec.dispatchEvent(failWithError, 0, errorMsgObj.value);
    }
  }
  return;
}

function failWithError(errorMsg) {
  Ec.alert(window, errorMsg);
  window.close();
}


function setValue(attrib, value) {
  var elem = document.getElementById("card_"+attrib);
  if (elem) {
    elem.value = value;
  }
  gCardData[attrib] = value;
}

function getValue(attrib) {
  var elem = document.getElementById("card_"+attrib);
  if (elem) {
    return elem.value;
  }
  else {
    return "";
  }
}

function getSelection(attrib) {
  var elem = document.getElementById("card_"+attrib);
  if (elem) {
    return elem.selectedItem.value;
  }
  else {
    return "";
  }
}

function doEditData() {
  document.getElementById("bcEditMode").removeAttribute("readonly");
  document.getElementById("bcEnableMode").removeAttribute("disabled");
}

function doReset() {
  document.getElementById("bcEditMode").setAttribute("readonly", "true");
  document.getElementById("bcEnableMode").setAttribute("disabled", "true");
  onLoad();
}

function doSaveChanges() {
  document.getElementById("bcEditMode").setAttribute("readonly", "true");
  document.getElementById("bcEnableMode").setAttribute("disabled", "true");

  var enigmailSvc = Ec.getService(window);
  if (!enigmailSvc) {
    Ec.alert(window, Ec.getString("accessError"));
    window.close();
    return;
  }

  var forcepin = (getSelection("forcepin") == gCardData.forcepin ? 0 : 1);
  EnigmailKeyMgmt.cardAdminData(window,
                                  Ec.convertFromUnicode(getValue("name")),
                                  Ec.convertFromUnicode(getValue("firstname")),
                                  getValue("lang"),
                                  getSelection("sex"),
                                  Ec.convertFromUnicode(getValue("url")),
                                  getValue("login"),
                                  forcepin,
    function _cardAdminCb(exitCode, errorMsg) {
      if (exitCode != 0) {
        Ec.alert(window, errorMsg);
      }

      onLoad();
    });
}

function engmailGenerateCardKey() {
  window.openDialog("chrome://enigmail/content/enigmailGenCardKey.xul",
        "", "dialog,modal,centerscreen");

  var enigmailSvc = Ec.getService(window);
  if (enigmailSvc) {
    enigmailSvc.invalidateUserIdList();
  }
  onLoad();
}

function enigmailAdminPin() {
  window.openDialog("chrome://enigmail/content/enigmailSetCardPin.xul",
        "", "dialog,modal,centerscreen");
  onLoad();
}
