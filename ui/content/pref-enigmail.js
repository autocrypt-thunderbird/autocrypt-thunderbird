// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail");

const ePrefString = 32;
const ePrefInt = 64;
const ePrefBool = 128;

const NS_HTTPPROTOCOLHANDLER_CID_STR= "{4f47e42e-4d23-4dd3-bfda-eb29255e9ea3}";

var httpHandler = Components.classesByID[NS_HTTPPROTOCOLHANDLER_CID_STR].createInstance();
httpHandler = httpHandler.QueryInterface(Components.interfaces.nsIHttpProtocolHandler);

gOScpu = httpHandler.oscpu;
gPlatform = httpHandler.platform;

DEBUG_LOG("pref-enigmail.js: oscpu="+gOScpu+", platform="+gPlatform+"\n");

function init_pref_enigmail() {
  dump("pref-enigmail.js: init_pref_enigmail\n");
  parent.initPanel('chrome://enigmail/content/pref-enigmail.xul');

  dump("pref-enigmail.js: init_pref_enigmail\n");
  EnigSetDefaultPrefs();

  EnigSetPref("configuredVersion", gEnigmailVersion);

  dump("pref-enigmail.js: init_pref_enigmail\n");
  setDisables(true);
}

function setDisables(initializing) {
  dump("pref-enigmail.js: setDisables: "+initializing+"\n");

  var passivePrivacy  = document.getElementById("passivePrivacy");
  var userIdSource    = document.getElementById("userIdSource");

  var passivePrivacyChecked = initializing ? EnigGetPref("passivePrivacy")
                                           : passivePrivacy.checked;

  var userIdSourceValue = initializing ? EnigGetPref("userIdSource")
                                       : userIdSource.value;

  if (passivePrivacyChecked)
    userIdSourceValue = 0;

  var userIdOpts = ["userIdSpecified", "userIdDefault", "userIdFromAddr"];

  var element;
  for (var j=0; j<userIdOpts.length; j++) {
    element = document.getElementById(userIdOpts[j]);
    element.removeAttribute("selected");
    element.checked = false;
    element.disabled = passivePrivacyChecked;
  }

  element = document.getElementById(userIdOpts[userIdSourceValue]);
  element.disabled = false;
  element.checked = true;
  element.setAttribute("selected", "true");

  userIdSource.value = userIdSourceValue;

  var timeoutEnabled = document.getElementById("timeoutEnabled");
  var maxIdleMinutes = document.getElementById("maxIdleMinutes");

  var timeoutEnabledChecked = initializing ? EnigGetPref("timeoutEnabled")
                                           : timeoutEnabled.checked;

  dump("pref-enigmail.js: timeoutEnabledChecked="+timeoutEnabledChecked+"\n");
  maxIdleMinutes.disabled = !timeoutEnabledChecked;

  if (parent.hPrefWindow.getPrefIsLocked(maxIdleMinutes.getAttribute("prefstring")) )
    maxIdleMinutes.disabled = true;
}


function enigmailPrefsHelp() {
   DEBUG_LOG("pref-enigmail.js: enigmailPrefsHelp:\n");
}


function enigmailResetPrefs() {
   DEBUG_LOG("pref-enigmail.js: enigmailResetPrefs:\n");

   for (var prefName in gEnigmailPrefDefaults) {
      var checkBox = document.getElementById("enigmail_"+prefName);

      if (gEnigmailPrefDefaults[prefName]) {
         checkBox.setAttribute("checked", "true");
      } else {
         checkBox.removeAttribute("checked");
      }
   }
}
