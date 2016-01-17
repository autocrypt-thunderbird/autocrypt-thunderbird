/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";


Components.utils.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/keyEditor.jsm"); /*global EnigmailKeyEditor: false */
Components.utils.import("resource://enigmail/key.jsm"); /*global EnigmailKey: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */
Components.utils.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Components.utils.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Components.utils.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Components.utils.import("resource://enigmail/time.jsm"); /*global EnigmailTime: false */
Components.utils.import("resource://enigmail/events.jsm"); /*global EnigmailEvents: false */
Components.utils.import("resource://enigmail/card.jsm"); /*global EnigmailCard: false */

var gCardData = {};

function onLoad() {
  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc) {
    EnigmailEvents.dispatchEvent(failWithError, 0, EnigmailLocale.getString("accessError"));
    return;
  }
  var exitCodeObj = {};
  var errorMsgObj = {};

  var dryRun = false;
  try {
    dryRun = EnigmailPrefs.getPref("dryRun");
  }
  catch (ex) {}

  var cardStr = EnigmailCard.getCardStatus(exitCodeObj, errorMsgObj);
  if (exitCodeObj.value === 0) {
    var statusList = cardStr.split(/[\r\n]+/);
    for (var i = 0; i < statusList.length; i++) {
      var l = statusList[i].split(/:/);
      switch (l[0]) {
        case "name":
          setValue("firstname", EnigmailData.convertGpgToUnicode(l[1]));
          setValue(l[0], EnigmailData.convertGpgToUnicode(l[2]));
          break;
        case "vendor":
          setValue(l[0], EnigmailData.convertGpgToUnicode(l[2].replace(/\\x3a/ig, ":")));
          break;
        case "sex":
        case "forcepin":
          var selItem = document.getElementById("card_" + l[0] + "_" + l[1]);
          document.getElementById("card_" + l[0]).selectedItem = selItem;
          gCardData[l[0]] = l[1];
          break;
        case "pinretry":
        case "maxpinlen":
          setValue(l[0], l[1] + " / " + l[2] + " / " + l[3]);
          break;
        case "fpr":
          setValue("key_fpr_1", EnigmailKey.formatFpr(l[1]));
          setValue("key_fpr_2", EnigmailKey.formatFpr(l[2]));
          setValue("key_fpr_3", EnigmailKey.formatFpr(l[3]));
          break;
        case "fprtime":
          setValue("key_created_1", EnigmailTime.getDateTime(l[1], true, false));
          setValue("key_created_2", EnigmailTime.getDateTime(l[2], true, false));
          setValue("key_created_3", EnigmailTime.getDateTime(l[3], true, false));
          break;
        default:
          if (l[0]) {
            setValue(l[0], EnigmailData.convertGpgToUnicode(l[1].replace(/\\x3a/ig, ":")));
          }
      }
    }
  }
  else {
    if (!dryRun) {
      EnigmailEvents.dispatchEvent(failWithError, 0, errorMsgObj.value);
    }
  }
  return;
}

function failWithError(errorMsg) {
  EnigmailDialog.alert(window, errorMsg);
  window.close();
}


function setValue(attrib, value) {
  var elem = document.getElementById("card_" + attrib);
  if (elem) {
    elem.value = value;
  }
  gCardData[attrib] = value;
}

function getValue(attrib) {
  var elem = document.getElementById("card_" + attrib);
  if (elem) {
    return elem.value;
  }
  else {
    return "";
  }
}

function getSelection(attrib) {
  var elem = document.getElementById("card_" + attrib);
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

  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("accessError"));
    window.close();
    return;
  }

  var forcepin = (getSelection("forcepin") == gCardData.forcepin ? 0 : 1);
  var dialogname = getValue("name");
  var dialogfirstname = getValue("firstname");
  if ((dialogname.search(/^[A-Za-z0-9\.\-,\?_ ]*$/) !== 0) || (dialogfirstname.search(/^[A-Za-z0-9\.\-,\?_ ]*$/) !== 0)) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("Carddetails.NoASCII"));
    onLoad();
    doEditData();
  }
  else {
    EnigmailKeyEditor.cardAdminData(window,
      EnigmailData.convertFromUnicode(dialogname),
      EnigmailData.convertFromUnicode(dialogfirstname),
      getValue("lang"),
      getSelection("sex"),
      EnigmailData.convertFromUnicode(getValue("url")),
      getValue("login"),
      forcepin,
      function _cardAdminCb(exitCode, errorMsg) {
        if (exitCode !== 0) {
          EnigmailDialog.alert(window, errorMsg);
        }

        onLoad();
      });
  }
}

function engmailGenerateCardKey() {
  window.openDialog("chrome://enigmail/content/enigmailGenCardKey.xul",
    "", "dialog,modal,centerscreen");

  EnigmailKeyRing.clearCache();
  onLoad();
}

function enigmailAdminPin() {
  window.openDialog("chrome://enigmail/content/enigmailSetCardPin.xul",
    "", "dialog,modal,centerscreen");
  onLoad();
}
