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
