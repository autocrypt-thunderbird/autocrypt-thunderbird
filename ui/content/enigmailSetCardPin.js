/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

Components.utils.import("resource://enigmail/keyEditor.jsm"); /* global EnigmailKeyEditor: false */
Components.utils.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false */
Components.utils.import("resource://enigmail/locale.jsm"); /* global EnigmailLocale: false */
Components.utils.import("resource://enigmail/dialog.jsm"); /* global EnigmailDialog: false */
Components.utils.import("resource://enigmail/gpgAgent.jsm"); /* global EnigmailGpgAgent: false */
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */

const nsIEnigmail = Components.interfaces.nsIEnigmail;
const Ci = Components.interfaces;

const CHANGE_PIN = 'P';
const ADMIN_PIN = 'A';
const UNBLOCK_PIN = 'U';

var gAction = null;

function onLoad() {
  setDlgContent(CHANGE_PIN);
}

function onAccept() {
  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc)
    return false;

  var pinItem1;
  var pinItem2;
  var minLen = 0;
  var action;

  switch (gAction) {
    case CHANGE_PIN:
      pinItem1 = "pinTxt";
      pinItem2 = "pinRepeatTxt";
      minLen = 6;
      action = nsIEnigmail.CARD_PIN_CHANGE;
      break;
    case UNBLOCK_PIN:
      pinItem1 = "pinTxt";
      pinItem2 = "pinRepeatTxt";
      minLen = 6;
      action = nsIEnigmail.CARD_PIN_UNBLOCK;
      break;
    case ADMIN_PIN:
      pinItem1 = "adminPinTxt";
      pinItem2 = "adminPinRepeatTxt";
      minLen = 8;
      action = nsIEnigmail.CARD_ADMIN_PIN_CHANGE;
      break;
  }
  var adminPin = "";
  var oldPin = "";
  var newPin = "";

  if (!EnigmailGpgAgent.useGpgAgent()) {
    adminPin = document.getElementById("currAdmPinTxt").value;
    oldPin = document.getElementById("currPinTxt").value;
    newPin = document.getElementById(pinItem1).value;

    if (newPin.length < minLen) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("cardPin.minLength", minLen));
      return false;
    }
    if (newPin != document.getElementById(pinItem2).value) {
      EnigmailDialog.alert(window, EnigmailLocale.getString("cardPin.dontMatch"));
      return false;
    }
  }

  var pinObserver = new changePinObserver();

  EnigmailKeyEditor.cardChangePin(window,
    action,
    oldPin,
    newPin,
    adminPin,
    pinObserver,
    function _ChangePinCb(exitCode, errorMsg) {
      if (exitCode !== 0) {
        EnigmailDialog.alert(window, EnigmailLocale.getString("cardPin.processFailed") + "\n" + pinObserver.result);
      }
      else
        window.close();
    });

  return false;
}

function dlgEnable(item) {
  document.getElementById(item).removeAttribute("collapsed");
}

function dlgDisable(item) {
  document.getElementById(item).setAttribute("collapsed", "true");
}

function setDlgContent(sel) {
  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc)
    return;

  gAction = sel;

  if (EnigmailGpgAgent.useGpgAgent()) {
    dlgDisable("currAdminPinRow");
    dlgDisable("adminPinRow");
    dlgDisable("adminPinRepeatRow");
    dlgDisable("currPinRow");
    dlgDisable("pinRow");
    dlgDisable("pinRepeatRow");
    return;
  }

  switch (sel) {
    case 'P':
      dlgDisable("currAdminPinRow");
      dlgDisable("adminPinRow");
      dlgDisable("adminPinRepeatRow");
      dlgEnable("currPinRow");
      dlgEnable("pinRow");
      dlgEnable("pinRepeatRow");
      break;
    case 'A':
      dlgEnable("currAdminPinRow");
      dlgEnable("adminPinRow");
      dlgEnable("adminPinRepeatRow");
      dlgDisable("currPinRow");
      dlgDisable("pinRow");
      dlgDisable("pinRepeatRow");
      break;
    case 'U':
      dlgEnable("currAdminPinRow");
      dlgDisable("adminPinRow");
      dlgDisable("adminPinRepeatRow");
      dlgDisable("currPinRow");
      dlgEnable("pinRow");
      dlgEnable("pinRepeatRow");
      break;
  }
}

function changePinObserver() {}

changePinObserver.prototype = {
  _data: "",
  result: "",

  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIEnigMimeReadCallback) ||
      iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  onDataAvailable: function(data) {
    var ret = "";
    EnigmailLog.DEBUG("enigmailSetCardPin: changePinObserver.onDataAvailable: data=" + data + "\n");
    if (data.indexOf("[GNUPG:] SC_OP_FAILURE") >= 0) {
      this.result = this._data;
    }
    else if (data.indexOf("[GNUPG:] BAD_PASSPHRASE") >= 0) {
      this.result = EnigmailLocale.getString("badPhrase");
      return data;
    }
    else {
      this._data = data;
    }
    return "";
  }
};
