// Uses: chrome://enigmail/content/enigmailCommon.js

const ePrefString = 32;
const ePrefInt = 64;
const ePrefBool = 128;

var gEnigmailPrefDefaults = {"useremail":"",
                             "captureWebMail":false};

const NS_HTTPPROTOCOLHANDLER_CID_STR= "{4f47e42e-4d23-4dd3-bfda-eb29255e9ea3}";

var httpHandler = Components.classesByID[NS_HTTPPROTOCOLHANDLER_CID_STR].createInstance();
httpHandler = httpHandler.QueryInterface(Components.interfaces.nsIHttpProtocolHandler);

gOScpu = httpHandler.oscpu;
gPlatform = httpHandler.platform;

DEBUG_LOG("pref-enigmail.js: oscpu="+gOScpu+", platform="+gPlatform+"\n");

var gPrefObj =
   Components.classes["@mozilla.org/preferences;1"].createInstance();
if(!gPrefObj)
   throw ("Unable to create prefs object.");

gPrefObj = gPrefObj.QueryInterface(Components.interfaces.nsIPref);

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


function GetFileOfProperty(prop) {
  var dscontractid = "@mozilla.org/file/directory_service;1";
  var ds = Components.classes[dscontractid].getService();

  var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
  DEBUG_LOG("pref-enigmail.js: GetFileOfProperty: prop="+prop+"\n");
  var file = dsprops.get(prop, Components.interfaces.nsIFile);
  DEBUG_LOG("pref-enigmail.js: GetFileOfProperty: file="+file+"\n");
  return file;
}


function enigmailUninstall() {
  var delFiles = [];

  var confirm;

  confirm = EnigConfirm("Do you wish to delete all EnigMail-related files in the Mozilla component and chrome directories?");

  if (confirm) {
    var overlay1Removed = RemoveOverlay("communicator",
                          ["chrome://enigmail/content/pref-enigmailOverlay.xul"]);

    var overlay2Removed = RemoveOverlay("messenger",
                          ["chrome://enigmail/content/enigmailMsgComposeOverlay.xul",
                           "chrome://enigmail/content/enigmailMessengerOverlay.xul"]);

    if (!overlay1Removed || !overlay2Removed) {
      EnigAlert("Failed to uninstall EnigMail communicator overlay RDF; not deleting chrome jar file");

    } else {
      var chromeFile = GetFileOfProperty("AChrom");
      chromeFile.append("enigmail.jar");

      delFiles.push(chromeFile);
    }

    var compDir = GetFileOfProperty("ComsD");
    var compFiles = ["enigmail.js", "enigmail.xpt", "ipcserv.xpt"];
    if (gPlatform.search(/^win/i)==0) {
      compFiles.push("ipcserv.dll");
    } else {
      compFiles.push("libipcserv.so");
    }

    for (var k=0; k<compFiles.length; k++) {
      var compFile = compDir.clone();
      compFile.append(compFiles[k]);
      delFiles.push(compFile);
    }
  }

  // Need to unregister chrome: how???

  // Delete files
  for (var j=0; j<delFiles.length; j++) {
    var delFile = delFiles[j];
    if (delFile.exists()) {
      WRITE_LOG("pref-enigmail.js: UninstallPackage: Deleting "+delFile.path+"\n")
      try {
          delFile.remove(true);
      } catch (ex) {
          EnigError("Error in deleting file "+delFile.path)
      }
    }
  }

  // Close window
  window.close();
}


function RemoveOverlay(module, urls) {
   DEBUG_LOG("pref-enigmail.js: RemoveOverlay: module="+module+", urls="+urls.join(",")+"\n");

   var overlayFile = GetFileOfProperty("AChrom");
   overlayFile.append("overlayinfo");
   overlayFile.append(module);
   overlayFile.append("content");
   overlayFile.append("overlays.rdf");

   DEBUG_LOG("pref-enigmail.js: RemoveOverlay: overlayFile="+overlayFile.path+"\n");

   var overlayRemoved = false;

   try {
      var fileContents = ReadFileContents(overlayFile, -1);

      for (var j=0; j<urls.length; j++) {
         var overlayPat=new RegExp("\\s*<RDF:li>\\s*"+urls[j]+"\\s*</RDF:li>");

         while (fileContents.search(overlayPat) != -1) {

            fileContents = fileContents.replace(overlayPat, "");

            overlayRemoved = true;

            DEBUG_LOG("pref-enigmail.js: RemoveOverlay: removed overlay "+urls[j]+"\n");
         }
      }

      if (overlayRemoved)
         WriteFileContents(overlayFile, fileContents, 0);

   } catch (ex) {
   }

   return overlayRemoved;
}
