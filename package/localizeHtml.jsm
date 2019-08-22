/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*global Components: false */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptLocalizeHtml"];

const AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
const AutocryptBuildDate = ChromeUtils.import("chrome://autocrypt/content/modules/buildDate.jsm").AutocryptBuildDate;
const AutocryptApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").AutocryptApp;
const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
const AutocryptGpgAgent = ChromeUtils.import("chrome://autocrypt/content/modules/gpgAgent.jsm").AutocryptGpgAgent;
const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

function getAutocryptVersion() {
  let versionStr = AutocryptApp.getVersion() + " (" + AutocryptBuildDate.built + ")";
  return AutocryptLocale.getString("usingVersion", versionStr);
}

function getGpgWorking() {
  var enigmailSvc = AutocryptCore.getService();

  var agentStr;
  if (enigmailSvc) {
    agentStr = AutocryptLocale.getString("usingAgent", [AutocryptGpgAgent.agentType, AutocryptGpgAgent.agentPath.path]);
  } else {
    agentStr = AutocryptLocale.getString("agentError");

    if (enigmailSvc && enigmailSvc.initializationError)
      agentStr += "\n" + enigmailSvc.initializationError;
  }

  return agentStr;
}

var AutocryptLocalizeHtml = {
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
          node.innerHTML = getAutocryptVersion();
          break;
        case "FNC_isGpgWorking":
          node.innerHTML = getGpgWorking();
          break;
        default:
          node.innerHTML = AutocryptLocale.getString(txtId, param);
      }

    }
  }
};
