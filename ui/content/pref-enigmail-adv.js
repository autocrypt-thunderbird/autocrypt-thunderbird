// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail-adv");

var gMimeHashElement, gSendFlowedElement, gSendFlowedValue;

function AdvStartup() {
   DEBUG_LOG("pref-enigmail-adv.js: AdvStartup\n");
   DisplayPrefs(false, true, false);

   EnigDisplayRadioPref("usePGPMimeOption", EnigGetPref("usePGPMimeOption"),
                        gUsePGPMimeOptionList);

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

   var testEmailElement = document.getElementById("enigmail_test_email");
   var userIdValue = EnigGetPref("userIdValue");

   if (testEmailElement && userIdValue)
     testEmailElement.value = userIdValue;
}

function AdvResetPrefs() {
   DEBUG_LOG("pref-enigmail-adv.js: AdvReset\n");

   EnigDisplayRadioPref("usePGPMimeOption", gEnigmailPrefDefaults["usePGPMimeOption"],
                        gUsePGPMimeOptionList);

   gMimeHashElement.selectedIndex = gEnigmailPrefDefaults["mimeHashAlgorithm"];

   DisplayPrefs(true, true, false);
}


function AdvOnAccept() {

   DEBUG_LOG("pref-enigmail-adv.js: AdvOnAccept\n");

   DisplayPrefs(false, false, true);

   EnigSetRadioPref("usePGPMimeOption", gUsePGPMimeOptionList);

   EnigSetPref("mimeHashAlgorithm", gMimeHashElement.selectedIndex);

   dump("gSendFlowedElement.checked="+gSendFlowedElement.checked+"\n");

   if (gSendFlowedElement &&
       (gSendFlowedElement.checked != gSendFlowedValue) ) {

     if (gSendFlowedElement.checked) {
       gEnigPrefRoot.setBoolPref("mailnews.send_plaintext_flowed", true);
     } else {
       gEnigPrefRoot.setBoolPref("mailnews.send_plaintext_flowed", false);
     }
   }

  EnigSavePrefs();

  return true;
}

function DisplayPrefs(showDefault, showPrefs, setPrefs) {
   DEBUG_LOG("pref-enigmail-adv.js: DisplayPrefs\n");

   for (var prefName in gEnigmailPrefDefaults) {
      var prefElement = document.getElementById("enigmail_"+prefName);

      if (prefElement) {
         var defaultValue = gEnigmailPrefDefaults[prefName];
         var prefValue = showDefault ? defaultValue : EnigGetPref(prefName);

         DEBUG_LOG("pref-enigmail-adv.js: DisplayPrefs: "+prefName+"="+prefValue+"\n");

         switch (typeof defaultValue) {
         case "boolean":
            if (showPrefs) {
               if (prefValue) {
                  prefElement.setAttribute("checked", "true");
               } else {
                  prefElement.removeAttribute("checked");
               }
            }

            if (setPrefs) {
               if (prefElement.checked) {
                  EnigSetPref(prefName, true);
               } else {
                  EnigSetPref(prefName, false);
               }
            }

         break;

         case "number":
            if (showPrefs)
              prefElement.value = prefValue;

            if (setPrefs) {
               try {
                 EnigSetPref(prefName, 0+prefElement.value);
               } catch (ex) {
               }
            }
         break;

         case "string":
            if (showPrefs)
              prefElement.value = prefValue;
            if (setPrefs)
              EnigSetPref(prefName, prefElement.value);
            break;

         default:
         }
      }
   }
}


function EnigMimeTest() {
  CONSOLE_LOG("\n\nEnigMimeTest: START ********************************\n");
  var lines = ["--Boundary",
               "\r\nPart 1\r\n",
               " --Boundary\r\n\r\n",
               "--Boundary\r",
               "\nPart 2\r\nPL2\r\nx\r\n--Boundary--\r\n"];

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

    mimeFilter.init(listener, null, 4000, j != 1, j == 1);

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
    EnigAlert("EnigTest: Failed to access Enigmail service");
    return;
  }

  if (!toMailAddr) {

    try {
      EnigMimeTest();
    } catch (ex) {}

    EnigAlert("EnigTest: Please specify mail address for testing");
    return;
  }

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

  var cipherText = enigmailSvc.encryptMessage(window, uiFlags, plainText,
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

  var decryptedText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                      signatureObj, exitCodeObj,
                                      statusFlagsObj, keyIdObj, userIdObj,
                                      errorMsgObj);
  CONSOLE_LOG("\n************************************************\n");
  CONSOLE_LOG("EnigTest: DECRYPTION\n");
  CONSOLE_LOG("EnigTest: decryptedText = "+decryptedText+"\n");
  CONSOLE_LOG("EnigTest: exitCode  = "+exitCodeObj.value+"\n");
  CONSOLE_LOG("EnigTest: signature = "+signatureObj.value+"\n");
  CONSOLE_LOG("************************************************\n");
}
