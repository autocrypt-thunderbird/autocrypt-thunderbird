/*
  The contents of this file are subject to the Mozilla Public
  License Version 1.1 (the "MPL"); you may not use this file
  except in compliance with the MPL. You may obtain a copy of
  the MPL at http://www.mozilla.org/MPL/

  Software distributed under the MPL is distributed on an "AS
  IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
  implied. See the MPL for the specific language governing
  rights and limitations under the MPL.

  The Original Code is Enigmail.

  The Initial Developer of this code is Patrick Brunschwig.
  Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net>
  are Copyright (C) 2005 Patrick Brunschwig.
  All Rights Reserved.

  Contributor(s):

  Alternatively, the contents of this file may be used under the
  terms of the GNU General Public License (the "GPL"), in which case
  the provisions of the GPL are applicable instead of
  those above. If you wish to allow use of your version of this
  file only under the terms of the GPL and not to allow
  others to use your version of this file under the MPL, indicate
  your decision by deleting the provisions above and replace them
  with the notice and other provisions required by the GPL.
  If you do not delete the provisions above, a recipient
  may use your version of this file under either the MPL or the
  GPL.
*/

EnigInitCommon("enigmailCardDetails");

var gCardData = {};

function onLoad() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    window.close();
    return;
  }
  var exitCodeObj = new Object();
  var errorMsgObj = new Object();

  var dryRun=false;
  try {
    dryRun = EnigGetPref("dryRun");
  }
  catch(ex) {}

  var cardStr = enigmailSvc.getCardStatus(exitCodeObj, errorMsgObj);
  if (exitCodeObj.value == 0) {
    var statusList=cardStr.split(/[\r\n]+/);
    for (var i=0; i<statusList.length; i++) {
      var l=statusList[i].split(/:/);
      switch (l[0]) {
      case "name":
        setValue("firstname", EnigConvertGpgToUnicode(l[1]));
        setValue(l[0], EnigConvertGpgToUnicode(l[2]));
        break;
      case "vendor":
        setValue(l[0], EnigConvertGpgToUnicode(l[2].replace(/\\x3a/ig, ":")));
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
        setValue("key_fpr_1", EnigFormatFpr(l[1]));
        setValue("key_fpr_2", EnigFormatFpr(l[2]));
        setValue("key_fpr_3", EnigFormatFpr(l[3]));
        break;
      case "fprtime":
        setValue("card_key_created_1", EnigGetDateTime(l[1]), true, false);
        setValue("card_key_created_2", EnigGetDateTime(l[2]), true, false);
        setValue("card_key_created_3", EnigGetDateTime(l[3]), true, false);
        break;
      default:
        if (l[0]) {
          setValue(l[0], EnigConvertGpgToUnicode(l[1].replace(/\\x3a/ig, ":")));
        }
      }
    }
  }
  else {
    if (! dryRun) {
      EnigAlert(errorMsgObj.value);
      window.close();
    }
  }
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

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    window.close();
    return;
  }

  var forcepin = (getSelection("forcepin") == gCardData.forcepin ? 0 : 1);
  var errorMsgObj = new Object();
  var r = enigmailSvc.cardAdminData(window,
                                    EnigConvertFromUnicode(getValue("name")),
                                    EnigConvertFromUnicode(getValue("firstname")),
                                    getValue("lang"),
                                    getSelection("sex"),
                                    EnigConvertFromUnicode(getValue("url")),
                                    getValue("login"),
                                    forcepin,
                                    errorMsgObj);
  if (r != 0) {
    EnigAlert(errorMsgObj.value);
  }

  onLoad();
}

function engmailGenerateCardKey() {
  window.openDialog("chrome://enigmail/content/enigmailGenCardKey.xul",
        "", "dialog,modal,centerscreen");

  var enigmailSvc = GetEnigmailSvc();
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
