// Uses: chrome://enigmail/content/enigmailCommon.js
// Uses: chrome://enigmail/content/pref-enigmail-adv.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail-seamonkey");

function init_pref_enigmail() {
  DEBUG_LOG("pref-enigmail.js: init_pref_enigmail\n");
  parent.initPanel('chrome://enigmail/content/pref-enigmail-seamonkey.xul');

  EnigSetDefaultPrefs();

  EnigSetPref("configuredVersion", gEnigmailVersion);

  if (navigator.platform.search(/Win/i) == 0) {
    // Windows doesn't work ... 
    document.getElementById("uninstall").setAttribute("disabled", "true");
  }


  setDisables(true);
}

function setDisables(initializing) {
  DEBUG_LOG("pref-enigmail.js: setDisables: "+initializing+"\n");

  var noPassphraseElement = document.getElementById("noPassphrase");
  var noPassphrase = initializing ? EnigGetPref("noPassphrase")
                              : noPassphraseElement.checked;

}


function enigmailPrefsHelp() {
   DEBUG_LOG("pref-enigmail.js: enigmailPrefsHelp:\n");
}

function enigmailResetPrefs() {
   DEBUG_LOG("pref-enigmail.js: enigmailResetPrefs\n");

   DisplayPrefs(true, true, false);

   setDisables(false);
}
