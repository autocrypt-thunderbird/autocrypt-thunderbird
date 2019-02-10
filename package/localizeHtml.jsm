/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailLocalizeHtml"];



const EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
const EnigmailBuildDate = ChromeUtils.import("chrome://enigmail/content/modules/buildDate.jsm").EnigmailBuildDate;
const EnigmailApp = ChromeUtils.import("chrome://enigmail/content/modules/app.jsm").EnigmailApp;
const EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailGpgAgent = ChromeUtils.import("chrome://enigmail/content/modules/gpgAgent.jsm").EnigmailGpgAgent;

function getEnigmailVersion() {
  let versionStr = EnigmailApp.getVersion() + " (" + EnigmailBuildDate + ")";
  return EnigmailLocale.getString("usingVersion", versionStr);
}

function getGpgWorking() {
  var enigmailSvc = EnigmailCore.getService();

  var agentStr;
  if (enigmailSvc) {
    agentStr = EnigmailLocale.getString("usingAgent", [EnigmailGpgAgent.agentType, EnigmailGpgAgent.agentPath.path]);
  }
  else {
    agentStr = EnigmailLocale.getString("agentError");

    if (enigmailSvc && enigmailSvc.initializationError)
      agentStr += "\n" + enigmailSvc.initializationError;
  }

  return agentStr;
}

var EnigmailLocalizeHtml = {
  getAllElementsWithAttribute: function(doc, attribute) {
    let matchingElements = [];
    let allElements = doc.getElementsByTagName('*');
    for (let i = 0, n = allElements.length; i < n; i++) {
      if (allElements[i].getAttribute(attribute) !== null) {
        matchingElements.push(allElements[i]);
      }
    }
    return matchingElements;
  },


  onPageLoad: function(doc) {
    let elem = this.getAllElementsWithAttribute(doc, "txtId");

    for (let i = 0; i < elem.length; i++) {
      let node = elem[i];
      let txtId = node.getAttribute("txtId");
      let param = node.getAttribute("txtParam");

      switch (txtId) {
        case "FNC_enigmailVersion":
          node.innerHTML = getEnigmailVersion();
          break;
        case "FNC_isGpgWorking":
          node.innerHTML = getGpgWorking();
          break;
        default:
          node.innerHTML = EnigmailLocale.getString(txtId, param);
      }

    }
  }
};
