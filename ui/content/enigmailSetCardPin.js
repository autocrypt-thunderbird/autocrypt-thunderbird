/*
 * ***** BEGIN LICENSE BLOCK *****
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
 * ***** END LICENSE BLOCK ***** *
 */


Components.utils.import("resource://enigmail/keyEditor.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/gpgAgent.jsm");
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
    return false;

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
