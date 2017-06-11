/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/pEpAdapter.jsm"); /* global EnigmailPEPAdapter: false */
Cu.import("resource://enigmail/dialog.jsm"); /* global EnigmailDialog: false */
Cu.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false */
Cu.import("resource://enigmail/locale.jsm"); /* global EnigmailLocale: false */
Cu.import("resource://enigmail/windows.jsm"); /* global EnigmailWindows: false */

/*
Arguments:
- peers: {email, rating, user_id}
- direction: 0 - incoming / 1 - outgoing
- myself (email-address)
*/

var gInputArgs;

function onLoad() {
  gInputArgs = window.arguments[0];
  let userList = document.getElementById("userListRows");

  let directionLbl = gInputArgs.direction === 0 ? "handshakeDlg.label.incomingMessage" : "handshakeDlg.label.outgoingMessage";
  document.getElementById("messageType").setAttribute("value", EnigmailLocale.getString(directionLbl));

  gInputArgs.myself = gInputArgs.myself.toLowerCase();

  for (let i = 0; i < gInputArgs.peers.length; i++) {
    let p = gInputArgs.peers[i];
    if (p.email.toLowerCase() !== gInputArgs.myself) {
      userList.appendChild(createRow(i));
    }
  }

  displayOverallTrust();
}

function displayOverallTrust() {
  let minTrust = 9;
  for (let i = 0; i < gInputArgs.peers.length; i++) {
    let p = gInputArgs.peers[i];
    if (p.email.toLowerCase() !== gInputArgs.myself) {
      minTrust = Math.min(minTrust, p.rating);
    }
  }

  let color = EnigmailPEPAdapter.calculateColorFromRating(minTrust);
  let explanation = "pepPrivacyStatus.Rating" + EnigmailPEPAdapter.getRatingLabel(minTrust) + "Explanation";
  let suggestion = "pepPrivacyStatus.Rating" + EnigmailPEPAdapter.getRatingLabel(minTrust) + "Suggestion";
  let statusDesc = "pepPrivacyStatus.Rating" + EnigmailPEPAdapter.getRatingLabel(minTrust) + "Text";

  document.getElementById("statusExplanation").textContent = EnigmailLocale.getString(explanation);
  document.getElementById("pepSuggestion").textContent = EnigmailLocale.getString(suggestion);
  document.getElementById("overallStatusIcon").setAttribute("class", EnigmailPEPAdapter.getRatingClass(minTrust));
  let desc = document.getElementById("overallStatusDesc");
  desc.setAttribute("value", EnigmailLocale.getString(statusDesc));
  desc.setAttribute("color", color);


}

function createRow(index) {
  let emailAddr = gInputArgs.peers[index].email;
  let rating = gInputArgs.peers[index].rating;
  EnigmailLog.DEBUG("pepHandshake.js: createRow(" + emailAddr + ", " + rating + ")\n");
  let color = EnigmailPEPAdapter.calculateColorFromRating(rating);
  let funcName = getFuncNameFromColor(color);

  let row = document.createElement("row");
  let lblBox = document.createElement("hbox");
  lblBox.setAttribute("align", "center");
  lblBox.setAttribute("size", "medium");
  lblBox.setAttribute("flex", "1");
  lblBox.setAttribute("class", EnigmailPEPAdapter.getRatingClass(rating));
  lblBox.setAttribute("id", "emailRow_" + index);

  let label = document.createElement("label");
  label.setAttribute("value", emailAddr);
  lblBox.appendChild(label);

  let func = document.createElement("hbox");
  func.setAttribute("align", "center");
  if (funcName !== "") {
    let btn = document.createElement("button");
    let btnLabel = "handshakeDlg.button." + funcName;
    btn.setAttribute("label", EnigmailLocale.getString(btnLabel));
    btn.setAttribute("oncommand", "doHandshakeCommand('" + funcName + "', " + index + ")");
    btn.setAttribute("id", "hndshakeButton_" + index);
    func.appendChild(btn);
  }
  row.appendChild(lblBox);
  row.appendChild(func);
  return row;
}

function getFuncNameFromColor(color) {
  let funcName = "";
  switch (color) {
    case "yellow":
      funcName = "initHandshake";
      break;
    case "green":
      funcName = "stopTrust";
      break;
    case "red":
      funcName = "reTrust";
  }
  return funcName;
}

function doHandshakeCommand(funcName, index) {
  EnigmailLog.DEBUG("pepHandshake.js: doHandshakeCommand(" + funcName + ", " + gInputArgs.peers[index].email + ")\n");

  switch (funcName) {
    case "initHandshake":
      document.getElementById("hndshakeButton_" + index).setAttribute("disabled", "true");
      EnigmailWindows.verifyPepTrustWords(window, gInputArgs.peers[index].email, gInputArgs.myself).then(
        function _ok() {
          reloadEmail(index);
        }
      ).catch(
        function _err() {
          EnigmailDialog.alert(window, EnigmailLocale.getString("msgCompose.internalError"));
        });
      break;
    case "stopTrust":
    case "reTrust":
      if (EnigmailDialog.confirmDlg(window,
          EnigmailLocale.getString(funcName === "stopTrust" ? "pepRevokeTrust.question" : "pepRevokeMistrust.question",
            gInputArgs.peers[index].email),
          EnigmailLocale.getString("pepRevokeTrust.doRevoke"),
          EnigmailLocale.getString("dlg.button.close"))) {
        EnigmailPEPAdapter.pep.resetIdentityTrust(gInputArgs.peers[index].user_id).then(
          function _ok() {
            reloadEmail(index);
          }
        ).catch(
          function _err() {
            EnigmailDialog.alert(window, EnigmailLocale.getString("msgCompose.internalError"));
          });
      }
  }
}

function reloadEmail(index) {
  let rating = gInputArgs.peers[index].rating;

  EnigmailPEPAdapter.pep.getIdentityRating(gInputArgs.peers[index].user_id).then(
    function _gotRating(data) {
      if ("result" in data && Array.isArray(data.result.outParams) && typeof(data.result.outParams[0]) === "object" &&
        "rating" in data.result.outParams[0]) {
        rating = data.result.outParams[0].rating;
        gInputArgs.peers[index].rating = rating;
      }

      let color = EnigmailPEPAdapter.calculateColorFromRating(rating);
      let funcName = getFuncNameFromColor(color);

      let row = document.getElementById("emailRow_" + index);
      row.setAttribute("class", EnigmailPEPAdapter.getRatingClass(rating));

      let btn = document.getElementById("hndshakeButton_" + index);
      let btnLabel = "handshakeDlg.button." + funcName;
      btn.setAttribute("label", EnigmailLocale.getString(btnLabel));
      btn.setAttribute("oncommand", "doHandshakeCommand('" + funcName + "', " + index + ")");
      btn.removeAttribute("disabled");

      displayOverallTrust();
    });
}
