// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail");

const ePrefString = 32;
const ePrefInt = 64;
const ePrefBool = 128;

var gEnigmailPrefDefaults = {"userEmail":"",
                             "captureWebMail":false};

const NS_HTTPPROTOCOLHANDLER_CID_STR= "{4f47e42e-4d23-4dd3-bfda-eb29255e9ea3}";

var httpHandler = Components.classesByID[NS_HTTPPROTOCOLHANDLER_CID_STR].createInstance();
httpHandler = httpHandler.QueryInterface(Components.interfaces.nsIHttpProtocolHandler);

gOScpu = httpHandler.oscpu;
gPlatform = httpHandler.platform;

DEBUG_LOG("pref-enigmail.js: oscpu="+gOScpu+", platform="+gPlatform+"\n");

var gPrefObj;
try {
   gPrefObj = Components.classes["@mozilla.org/preferences;1"].createInstance(Components.interfaces.nsIPref);
} catch (ex) {
  ERROR_LOG("enigmailCommon.js: Error in instantiating PrefService\n");
  throw("enigmailCommon.js: Error in instantiating PrefService\n");
}

function enigmailGetPref(prefName) {
   DEBUG_LOG("pref-enigmail.js: enigmailGetPref: "+prefName+"\n");

   var defaultValue = gEnigmailPrefDefaults[prefName];
   var valueType = typeof defaultValue;

   switch (typeof defaultValue) {
      case "string":
         try {
             var prefValue = gPrefObj.GetCharPref(ENIGMAIL_PREFS_ROOT+prefName);
             return prefValue;
         } catch (ex) {
             return defaultValue;
         }
         break;

      case "boolean":
         try {
             var prefValue = gPrefObj.GetBoolPref(ENIGMAIL_PREFS_ROOT+prefName);
             return prefValue;
         } catch (ex) {
             return defaultValue;
         }
         break;

      case "number":
         try {
             var prefValue = gPrefObj.GetIntPref(ENIGMAIL_PREFS_ROOT+prefName);
             return prefValue;
         } catch (ex) {
             return defaultValue;
         }
         break;

      default:
         return undefined;
   }
}

function enigmailSetPref(prefName, value) {
   DEBUG_LOG("pref-enigmail.js: enigmailSetPref: "+prefName+", "+value+"\n");

   var defaultValue = gEnigmailPrefDefaults[prefName];
   var valueType = typeof defaultValue;

   switch (typeof defaultValue) {
      case "string":
         gPrefObj.SetCharPref(ENIGMAIL_PREFS_ROOT+prefName, value);
         return true;
         break;

      case "boolean":
         gPrefObj.SetBoolPref(ENIGMAIL_PREFS_ROOT+prefName, value);
         return true;
         break;

      case "number":
         gPrefObj.SetIntPref(ENIGMAIL_PREFS_ROOT+prefName, value);
         return true;
         break;

      default:
         return false;
   }
}


function enigmailPrefsHelp() {
   DEBUG_LOG("pref-enigmail.js: enigmailPrefsHelp:\n");
}

function enigmailResetPrefs() {
   DEBUG_LOG("pref-enigmail.js: enigmailResetPrefs:\n");

   for (var prefName in gEnigmailPrefDefaults) {
      enigmailSetPref(prefName, gEnigmailPrefDefaults[prefName]);
   }

   parent.doCancelButton();
}
