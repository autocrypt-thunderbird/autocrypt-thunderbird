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
Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.

Contributor(s):
Patrick Brunschwig <patrick.brunschwig@gmx.net>

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
// Uses: chrome://enigmail/content/pref-enigmail-adv.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail-seamonkey");

function initPrefSeamonkey() {
  DEBUG_LOG("pref-enigmail-seamonkey.js: initPrefSeamonkey\n");
  parent.initPanel('chrome://enigmail/content/pref-enigmail-seamonkey.xul');

  var prefsBox = document.getElementById("enigmailPrefsBox");
  EnigCollapseAdvanced(prefsBox, "hidden", null);

  enigDetermineGpgPath();

  EnigSetPref("configuredVersion", gEnigmailVersion);

  setDisables(true);
}

function setDisables(initializing) {
  DEBUG_LOG("pref-enigmail-seamonkey.js: setDisables: "+initializing+"\n");

  var noPassphraseElement = document.getElementById("noPassphrase");
  var noPassphrase = initializing ? EnigGetPref("noPassphrase")
                              : noPassphraseElement.checked;

  var overrideGpg = document.getElementById("enigOverrideGpg")
  if (EnigGetPref("agentPath")) {
    overrideGpg.checked = true;
  }
  else {
    overrideGpg.checked = false;
  }
  enigActivateDependent(overrideGpg, "enigmail_agentPath enigmail_browsePath");
}

function prefSeamonkeyOnClose() {
  DEBUG_LOG("pref-enigmail-seamonkey.js: prefSeamonkeyOnClose:\n");

  if (! document.getElementById("enigOverrideGpg").checked) {
    EnigSetPref("agentPath", "");
  }
}

