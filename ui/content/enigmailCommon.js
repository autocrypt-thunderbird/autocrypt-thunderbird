// enigmailCommon.js: shared JS functions for Enigmail

var gLogLevel = 3;     // Output only errors/warnings by default

function DEBUG_LOG(str) {
  if (gLogLevel >= 4)
    dump(str);
}

function WARNING_LOG(str) {
  if (gLogLevel >= 3)
    dump(str);
}

function ERROR_LOG(str) {
  if (gLogLevel >= 2)
    dump(str);
}

function EnigAlert(mesg) {
  return window.prompter.alert("Enigmail Alert", mesg);
}

function EnigConfirm(mesg) {
  return window.prompter.confirm("Enigmail Confirm", mesg);
}

function EnigError(mesg) {
  return window.prompter.alert("Enigmail Error", mesg);
}

function RemoveOverlay(urlSpec) {
   var overlayFile = window.pzilla.getFileOfProperty("AChrom");
   overlayFile.append("overlayinfo");
   overlayFile.append("communicator");
   overlayFile.append("content");
   overlayFile.append("overlays.rdf");

   DEBUG_LOG("enigmailCommon.js: RemoveOverlay: url = "+urlSpec+"\n");
   var overlayRemoved = false;
   try {
      var fileContents = window.pzilla.readFileContents(overlayFile, -1);

      var overlayPat = new RegExp("\\s*<RDF:li>\\s*"+urlSpec+"\\s*</RDF:li>");

      var overlayMatch = fileContents.search(overlayPat);

      DEBUG_LOG("enigmailCommon.js: RemoveOverlay: overlayMatch = "+overlayMatch+"\n");

      if (overlayMatch != -1) {

         var newFileContents = fileContents.replace(overlayPat, "");

         window.pzilla.writeFileContents(overlayFile, newFileContents, 0);

         overlayRemoved = true;
      }
   } catch (ex) {
   }

   return overlayRemoved;
}

