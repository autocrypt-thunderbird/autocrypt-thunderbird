// Uses: chrome://enigmail/content/enigmailCommon.js
// Uses: chrome://enigmail/content/pref-enigmail-adv.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail-seamonkey");

function init_pref_enigmail() {
  DEBUG_LOG("pref-enigmail.js: init_pref_enigmail\n");
  parent.initPanel('chrome://enigmail/content/pref-enigmail-seamonkey.xul');

  EnigSetDefaultPrefs();

  EnigSetPref("configuredVersion", gEnigmailVersion);

  setDisables(true);
}

function setDisables(initializing) {
  DEBUG_LOG("pref-enigmail.js: setDisables: "+initializing+"\n");

  var defaultEncryptionOptionElement = document.getElementById("enigmail_defaultEncryptionOption");
  var defaultEncryptionOption = initializing ? EnigGetPref("defaultEncryptionOption")
                                  : defaultEncryptionOptionElement.value;

  var autoCrypto = false;
  var autoCryptoElement = document.getElementById("autoCrypto");

  if (autoCryptoElement) {
    autoCrypto = initializing ? EnigGetPref("autoCrypto")
                              : autoCryptoElement.checked;

  }

  EnigDisplayRadioPref("defaultEncryptionOption", defaultEncryptionOption,
                        gEnigDefaultEncryptionOptions);

  var noPassphraseElement = document.getElementById("noPassphrase");
  var noPassphrase = initializing ? EnigGetPref("noPassphrase")
                              : noPassphraseElement.checked;

/*
  var maxIdleMinutesElement = document.getElementById("enigmail_maxIdleMinutes");
  if (noPassphrase)
    maxIdleMinutesElement.disabled = true;
*/
}


function enigmailPrefsHelp() {
   DEBUG_LOG("pref-enigmail.js: enigmailPrefsHelp:\n");
}

function enigmailResetPrefs() {
   DEBUG_LOG("pref-enigmail.js: enigmailResetPrefs\n");

   DisplayPrefs(true, true, false);

   setDisables(false);
}


/////////////////////////
// Uninstallation stuff
/////////////////////////

function GetFileOfProperty(prop) {
  var dscontractid = "@mozilla.org/file/directory_service;1";
  var ds = Components.classes[dscontractid].getService();

  var dsprops = ds.QueryInterface(Components.interfaces.nsIProperties);
  DEBUG_LOG("pref-enigmail.js: GetFileOfProperty: prop="+prop+"\n");
  var file = dsprops.get(prop, Components.interfaces.nsIFile);
  DEBUG_LOG("pref-enigmail.js: GetFileOfProperty: file="+file+"\n");
  return file;
}


function EnigUninstall() {
  var delFiles = [];

  var confirm;

  confirm = EnigConfirm("Do you wish to delete all EnigMail-related files in the Mozilla component and chrome directories?");

  if (!confirm)
    return;

  // Reset mail.show_headers pref to "original" value
  EnigShowHeadersAll(false);
  EnigSavePrefs();

  // Remove installed chrome entries
  var chromeEntryRemoved = RemoveInstalledChrome("enigmail");

  // Remove overlays
  var overlay1Removed = RemoveOverlay("communicator",
                ["chrome://enigmail/content/enigmailPrefsOverlay.xul"]);

  var overlay2Removed = RemoveOverlay("messenger",
                ["chrome://enigmail/content/enigmailMsgComposeOverlay.xul",
                 "chrome://enigmail/content/enigmailMessengerOverlay.xul",
                 "chrome://enigmail/content/enigmailMsgHdrViewOverlay.xul",
                 "chrome://enigmail/content/enigmailMsgPrintOverlay.xul"]);

  if (!overlay1Removed || !overlay2Removed) {
    EnigAlert("Failed to uninstall EnigMail communicator overlay RDF; not deleting chrome jar file");

  }

  try {
    if (overlay1Removed && overlay2Removed) {
      var chromeFile = GetFileOfProperty("AChrom");
      chromeFile.append("enigmail.jar");

      delFiles.push(chromeFile);
    }

    var compDir = GetFileOfProperty("ComsD");
    var compFilenames = ["enigmail.js", "enigmail.xpt",
                         "enigmime.xpt", "enigmime.dll", "libenigmime.so",
                         "ipc.xpt", "ipc.dll", "libipc.so"];

    for (var k=0; k<compFilenames.length; k++) {
      var compFile = compDir.clone();
      compFile.append(compFilenames[k]);
      delFiles.push(compFile);
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

    EnigAlert("Uninstalled EnigMail");

  } catch(ex) {
    EnigAlert("Failed to uninstall EnigMail");
  }

  // Close window
  window.close();
}


function RemoveOverlay(module, urls) {
   DEBUG_LOG("pref-enigmail.js: RemoveOverlay: module="+module+", urls="+urls.join(",")+"\n");

   var overlayRemoved = false;

   try {
     var overlayFile = GetFileOfProperty("AChrom");
     overlayFile.append("overlayinfo");
     overlayFile.append(module);
     overlayFile.append("content");
     overlayFile.append("overlays.rdf");

     DEBUG_LOG("pref-enigmail.js: RemoveOverlay: overlayFile="+overlayFile.path+"\n");

      var fileContents = EnigReadFileContents(overlayFile, -1);

      for (var j=0; j<urls.length; j++) {
         var overlayPat=new RegExp("\\s*<RDF:li>\\s*"+urls[j]+"\\s*</RDF:li>");

         while (fileContents.search(overlayPat) != -1) {

            fileContents = fileContents.replace(overlayPat, "");

            overlayRemoved = true;

            DEBUG_LOG("pref-enigmail.js: RemoveOverlay: removed overlay "+urls[j]+"\n");
         }
      }

      if (overlayRemoved)
         EnigWriteFileContents(overlayFile.path, fileContents, 0);

   } catch (ex) {
   }

   return overlayRemoved;
}


function RemoveInstalledChrome(module) {
   DEBUG_LOG("pref-enigmail.js: RemoveInstalledChrome: module="+module+"\n");

   var chromeEntryRemoved = false;

   try {
     var chromeListFile = GetFileOfProperty("AChrom");
     chromeListFile.append("installed-chrome.txt");

      var fileContents = EnigReadFileContents(chromeListFile, -1);

      var chromeEntryPat = new RegExp("(content|skin|locale),install,url,jar:resource:/chrome/"+module+".*\\r?\\n?");

      while (fileContents.search(chromeEntryPat) != -1) {

         fileContents = fileContents.replace(chromeEntryPat, "");

         chromeEntryRemoved = true;

         DEBUG_LOG("pref-enigmail.js: RemoveInstalledChrome: removed "+module+" entry from installed-chrome.txt\n");
      }

      if (chromeEntryRemoved)
         EnigWriteFileContents(chromeListFile.path, fileContents, 0);

   } catch (ex) {}

   return chromeEntryRemoved;
}
