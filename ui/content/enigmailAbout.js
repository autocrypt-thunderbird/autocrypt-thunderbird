/*global Components: false, EnigmailApp: false, EnigmailWindows: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js
//       chrome://enigmail/content/enigmailBuildDate.js


"use strict";

/* global EnigmailLog: false, EnigmailLocale: false, EnigmailCore: false, EnigmailGpgAgent: false */

/* global EnigBuildDate: false, EnigGetHttpUri: false, EnigOpenUrlExternally: false */

function enigAboutLoad() {
  EnigmailLog.DEBUG("enigmailAbout.js: enigAboutLoad\n");

  var contentFrame = EnigmailWindows.getFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var enigVersion = EnigmailApp.getVersion() + " (" + EnigBuildDate + ")";
  var versionElement = contentFrame.document.getElementById('version');
  if (versionElement)
    versionElement.firstChild.data = EnigmailLocale.getString("usingVersion", enigVersion);

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

  var agentElement = contentFrame.document.getElementById('agent');
  if (agentElement)
    agentElement.firstChild.data = agentStr;

}


function contentAreaClick(event) {
  let uri = EnigGetHttpUri(event);
  if (uri) {
    EnigOpenUrlExternally(uri);
    event.preventDefault();

    return false;
  }

  return true;
}
