// Uses: chrome://enigmail/content/enigmailCommon.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail-adv");

var gPrefList = {"autoDecrypt":"", "captureWebMail":""};

function AdvStartup() {
   DEBUG_LOG("pref-enigmail-adv.js: AdvStartup\n");
   DisplayPrefs(false, true, false);

   var testEmailElement = document.getElementById("enigmail_test_email");
   var userIdValue = EnigGetPref("userIdValue");

   if (testEmailElement && userIdValue)
     testEmailElement.value = userIdValue;
}

function AdvResetPrefs() {
   DEBUG_LOG("pref-enigmail-adv.js: AdvReset\n");

   DisplayPrefs(true, true, false);
}


function AdvOnAccept() {

   DEBUG_LOG("pref-enigmail-adv.js: AdvOnAccept\n");

   DisplayPrefs(false, false, true);

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


function EnigTest() {
  var plainText = "TEST MESSAGE 123\nTEST MESSAGE 345\n";
  var testEmailElement = document.getElementById("enigmail_test_email");
  var toMailAddr = testEmailElement.value;

  if (!toMailAddr) {
    EnigAlert("EnigTest: Please specify mail address for testing");
    return;
  }

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert("EnigTest: Failed to access Enigmail service");
    return;
  }

  CONSOLE_LOG("\n\nEnigTest: START ********************************\n");
  CONSOLE_LOG("EnigTest: To: "+toMailAddr+"\n"+plainText+"\n");

  var uiFlags = nsIEnigmail.UI_INTERACTIVE;

  var exitCodeObj = new Object();
  var errorMsgObj = new Object();

  var cipherText = enigmailSvc.encryptMessage(window, uiFlags, plainText,
                                              "", toMailAddr,
                                              nsIEnigmail.SEND_SIGNED,
                                              exitCodeObj, errorMsgObj);
  CONSOLE_LOG("************************************************\n");
  CONSOLE_LOG("EnigTest: SIGNING ONLY\n");
  CONSOLE_LOG("EnigTest: cipherText = "+cipherText+"\n");
  CONSOLE_LOG("EnigTest: exitCode = "+exitCodeObj.value+"\n");
  CONSOLE_LOG("************************************************\n");

  var signatureObj   = new Object();
  var statusFlagsObj = new Object();
  var keyIdObj        = new Object();
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
                                              exitCodeObj, errorMsgObj);
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
