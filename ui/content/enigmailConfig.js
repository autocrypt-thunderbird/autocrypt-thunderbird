// Uses: chrome://enigmail/content/enigmailCommon.js

function OnLoadEnigConfig() {
  DEBUG_LOG("enigmailConfig.js: OnLoadEnigConfig\n");
}

function OnUnloadEnigConfig() {
  DEBUG_LOG("enigmailConfig.js: OnUnloadEnigConfig\n");
}

function RemoveOverlay(urlSpec) {
   var overlayFile = window.pzilla.getFileOfProperty("AChrom");
   overlayFile.append("overlayinfo");
   overlayFile.append("communicator");
   overlayFile.append("content");
   overlayFile.append("overlays.rdf");

   DEBUG_LOG("enigmailConfig.js: RemoveOverlay: url = "+urlSpec+"\n");
   var overlayRemoved = false;
   try {
      var fileContents = window.pzilla.readFileContents(overlayFile, -1);

      var overlayPat = new RegExp("\\s*<RDF:li>\\s*"+urlSpec+"\\s*</RDF:li>");

      var overlayMatch = fileContents.search(overlayPat);

      DEBUG_LOG("enigmailConfig.js: RemoveOverlay: overlayMatch = "+overlayMatch+"\n");

      if (overlayMatch != -1) {

         var newFileContents = fileContents.replace(overlayPat, "");

         window.pzilla.writeFileContents(overlayFile, newFileContents, 0);

         overlayRemoved = true;
      }
   } catch (ex) {
   }

   return overlayRemoved;
}
