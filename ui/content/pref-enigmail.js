// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail");

var gMimeHashElement, gSendFlowedElement, gSendFlowedValue;
var gMimePartsElement, gMimePartsValue;

function prefOnLoad() {
   DEBUG_LOG("pref-enigmail.js: prefOnLoad\n");
   EnigDisplayPrefs(false, true, false);

   if (window.arguments) {
      if (! window.arguments[0].showBasic) {
          // hide basic tab
          document.getElementById("basic").setAttribute("collapsed", true);
          document.getElementById("basicTab").setAttribute("collapsed", true);
          var sendTab=document.getElementById("sendTab");
          sendTab.click();
          sendTab.setAttribute("selected", true);
      }

      if (window.arguments[0].clientType!="seamonkey") {
          document.getElementById("enigmail_disableSMIMEui").setAttribute("collapsed", true);
      }

      if ((typeof window.arguments[0].selectTab)=="string") {
          var selectTab=document.getElementById(window.arguments[0].selectTab);
          selectTab.click();
          selectTab.setAttribute("selected", true);
      }
   }
   EnigDisplayRadioPref("usePGPMimeOption", EnigGetPref("usePGPMimeOption"),
                        gUsePGPMimeOptionList);


   EnigDisplayRadioPref("recipientsSelectionOption", EnigGetPref("recipientsSelectionOption"),
                        gEnigRecipientsSelectionOptions);

   EnigDisplayRadioPref("perRecipientRules", EnigGetPref("perRecipientRules"),
                        gEnigPerRecipientRules);

   gMimeHashElement = document.getElementById("mimeHashList");
   gMimeHashElement.selectedIndex = EnigGetPref("mimeHashAlgorithm");

   gSendFlowedElement = document.getElementById("send_plaintext_flowed");

   try {
     gSendFlowedValue = gEnigPrefRoot.getBoolPref("mailnews.send_plaintext_flowed");
   } catch (ex) {
     gSendFlowedValue = true;
   }

   if (gSendFlowedValue) {
     gSendFlowedElement.setAttribute("checked", "true");
   } else {
     gSendFlowedElement.removeAttribute("checked");
   }

   gMimePartsElement = document.getElementById("mime_parts_on_demand");

   try {
     gMimePartsValue = gEnigPrefRoot.getBoolPref("mail.server.default.mime_parts_on_demand");
   } catch (ex) {
     gMimePartsValue = true;
   }

   if (gMimePartsValue) {
     gMimePartsElement.setAttribute("checked", "true");
   } else {
     gMimePartsElement.removeAttribute("checked");
   }

   var testEmailElement = document.getElementById("enigmail_test_email");
   var userIdValue = EnigGetPref("userIdValue");

   if (testEmailElement && userIdValue)
     testEmailElement.value = userIdValue;

   if (navigator.platform.search(/Win/i) == 0) {
     // Windows doesn't work ...
     var uninst = document.getElementById("uninstall");
     if (uninst) setAttribute("disabled", "true");
   }


}

function resetPrefs() {
  DEBUG_LOG("pref-enigmail.js: resetPrefs\n");

  EnigDisplayPrefs(true, true, false);

  EnigSetPref("configuredVersion", gEnigmailVersion);

  EnigDisplayRadioPref("usePGPMimeOption", EnigGetDefaultPref("usePGPMimeOption"),
                      gUsePGPMimeOptionList);
  EnigDisplayRadioPref("recipientsSelectionOption", EnigGetDefaultPref("recipientsSelectionOption"),
                      gEnigRecipientsSelectionOptions);
  EnigDisplayRadioPref("perRecipientRules", EnigGetPref("perRecipientRules"),
                      gEnigPerRecipientRules);
                      

  gMimeHashElement.selectedIndex = EnigGetDefaultPref("mimeHashAlgorithm");
}


function prefOnAccept() {

  DEBUG_LOG("pref-enigmail.js: prefOnAccept\n");

  EnigDisplayPrefs(false, false, true);

  EnigSetRadioPref("usePGPMimeOption", gUsePGPMimeOptionList);

  EnigSetPref("mimeHashAlgorithm", gMimeHashElement.selectedIndex);

  EnigSetRadioPref("recipientsSelectionOption", gEnigRecipientsSelectionOptions);

  EnigSetRadioPref("perRecipientRules", gEnigPerRecipientRules);

  if (gSendFlowedElement &&
      (gSendFlowedElement.checked != gSendFlowedValue) ) {

    gEnigPrefRoot.setBoolPref("mailnews.send_plaintext_flowed", (gSendFlowedElement.checked ? true : false));
  }

  if (gMimePartsElement &&
      (gMimePartsElement.checked != gMimePartsValue) ) {

    gEnigPrefRoot.setBoolPref("mail.server.default.mime_parts_on_demand", (gMimePartsElement.checked ? true : false));
  }

  EnigSetPref("configuredVersion", gEnigmailVersion);

  EnigSavePrefs();

  return true;
}



function EnigMimeTest() {
  CONSOLE_LOG("\n\nEnigMimeTest: START ********************************\n");

  var lines = ["content-type: multipart/mixed;\r",
               "\n boundary=\"ABCD\"",
               "\r\n\r\nmultipart\r\n--ABCD\r",
               "\ncontent-type: text/html \r\n",
               "\r\n<html><body><b>TEST CONTENT1<b></body></html>\r\n\r",
               "\n--ABCD\r\ncontent-type: text/plain\r\ncontent-disposition:",
               " attachment; filename=\"abcd.txt\"\r\n",
               "\r\nFILE CONTENTS\r\n--ABCD--\r\n"];

  var linebreak = ["CRLF", "LF", "CR"];

  for (var j=0; j<linebreak.length; j++) {
    var listener = Components.classes[ENIG_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

    listener.open(2000, false);

    var mimeFilter = Components.classes[ENIG_ENIGMIMELISTENER_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeListener);

    mimeFilter.init(listener, null, 4000, j != 1, j == 1, false);

    for (var k=0; k<lines.length; k++) {
      var line = lines[k];
      if (j == 1) line = line.replace(/\r/g, "");
      if (j == 2) line = line.replace(/\n/g, "");
      mimeFilter.write(line, line.length, null, null);
    }

    mimeFilter.onStopRequest(null, null, 0);

    CONSOLE_LOG(linebreak[j]+" mimeFilter.contentType='"+mimeFilter.contentType+"'\n");
    CONSOLE_LOG(linebreak[j]+" listener.getData()='"+listener.getData().replace(/\r/g, "\\r")+"'\n");
  }

  CONSOLE_LOG("************************************************\n");
}

function EnigTest() {
  var plainText = "TEST MESSAGE 123\nTEST MESSAGE 345\n";
  var testEmailElement = document.getElementById("enigmail_test_email");
  var toMailAddr = testEmailElement.value;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("testNoSvc"));
    return;
  }

  if (!toMailAddr) {

    try {
      EnigMimeTest();
    } catch (ex) {}

    EnigAlert(EnigGetString("testNoEmail"));
    return;
  }

  try {
    CONSOLE_LOG("\n\nEnigTest: START ********************************\n");
    CONSOLE_LOG("EnigTest: To: "+toMailAddr+"\n"+plainText+"\n");

    var uiFlags = nsIEnigmail.UI_INTERACTIVE;

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();

    var cipherText = enigmailSvc.encryptMessage(window, uiFlags, plainText,
                                                "", toMailAddr,
                                                nsIEnigmail.SEND_SIGNED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("EnigTest: SIGNING ONLY\n");
    CONSOLE_LOG("EnigTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("EnigTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    var signatureObj   = new Object();
    var keyIdObj       = new Object();
    var userIdObj      = new Object();

    var decryptedText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        errorMsgObj);
    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("EnigTest: VERIFICATION\n");
    CONSOLE_LOG("EnigTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("EnigTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("EnigTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    cipherText = enigmailSvc.encryptMessage(window, uiFlags, plainText,
                                                "", toMailAddr,
                                                nsIEnigmail.SEND_SIGNED|
                                                nsIEnigmail.SEND_ENCRYPTED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("EnigTest: SIGNING + ENCRYPTION\n");
    CONSOLE_LOG("EnigTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("EnigTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    decryptedText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        errorMsgObj);
    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("EnigTest: DECRYPTION\n");
    CONSOLE_LOG("EnigTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("EnigTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("EnigTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    EnigAlert(EnigGetString("testSucceeded"));
  }
  catch (ex) {
    EnigAlert("error");
  }
}

function enigLocateGpg() {
  var fileName="gpg";
  var ext="";
  if (navigator.platform.search(/Win/i) == 0) {
    ext=".exe";
  }
  var filePath = EnigFilePicker(EnigGetString("locateGpg"),
                           "", false, ext,
                           fileName+ext, null);
  if (filePath) {
    document.getElementById("enigmail_agentPath").value = filePath.path;
  }
}