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

The Initial Developer of the Original Code is Ramalingam Saravanan.
Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.

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

// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("enigmailAbout");

function enigAboutLoad() {
  DEBUG_LOG("enigmailAbout.js: enigAboutLoad\n");

  var contentFrame = EnigGetFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var versionElement = contentFrame.document.getElementById('version');
  if (versionElement)
    versionElement.firstChild.data = EnigGetString("usingVersion",gEnigmailVersion);

  var enigmimeElement = contentFrame.document.getElementById('enigmime');

  try {
    var enigMimeService = Components.classes[ENIG_ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);

    var binaryVersion = enigMimeService.version.replace(/\.\d+\.\d+$/, "");
    var textVersion = gEnigmimeVersion.replace(/\.\d+\.\d+$/, "");

    if (binaryVersion != textVersion) {
      if (enigmimeElement)
        enigmimeElement.firstChild.data = EnigGetString("versionWarning",enigMimeService.version);
    }

    DEBUG_LOG("enigmailAbout.js: enigAboutLoad: EnigMime: "+binaryVersion+", "+textVersion+"\n");

  } catch (ex) {
    if (enigmimeElement)
      enigmimeElement.firstChild.data = EnigGetString("enigmimeWarning");
  }

  var enigmailSvc = GetEnigmailSvc();

  var agentStr;
  if (enigmailSvc) {
    agentStr = EnigGetString("usingAgent", enigmailSvc.agentType, enigmailSvc.agentPath.replace(/\\\\/g, "\\"));

  } else {
    agentStr = EnigGetString("agentError");

    if (gEnigmailSvc && gEnigmailSvc.initializationError)
      agentStr += "\n" + gEnigmailSvc.initializationError;
  }

  var agentElement = contentFrame.document.getElementById('agent');
  if (agentElement)
    agentElement.firstChild.data = agentStr;

}

window.onload = enigAboutLoad;
