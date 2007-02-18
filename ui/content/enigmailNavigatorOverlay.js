/*
The contents of this file are subject to the Mozilla Public
License Version 1.1 (the "MPL"); you may not use this file
except in compliance with the MPL. You may obtain a copy of
the MPL at http://www.mozilla.org/MPL/

Software distributed under the MPL is distributed on an "AS
IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
implied. See the MPL for the specific language governing
rights and limitations under the MPL.

The Original Code is Enigmail.

The Initial Developer of the Original Code is Ramalingam Saravanan.
Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.

Contributor(s):

Alternatively, the contents of this file may be used under the
terms of the GNU General Public License (the "GPL"), in which case
the provisions of the GPL are applicable instead of
those above. If you wish to allow use of your version of this
file only under the terms of the GPL and not to allow
others to use your version of this file under the MPL, indicate
your decision by deleting the provisions above and replace them
with the notice and other provisions required by the GPL.
If you do not delete the provisions above, a recipient
may use your version of this file under either the MPL or the
GPL.
*/

// Uses: chrome://enigmail/content/enigmailCommon.js
// Uses: chrome://global/content/nsUserSettings.js

var gEnigCurrentSite;
var gEnigNavButton1;
var gEnigCurrentHandlerNavButton1;
var gEnigTest = true;
var gEnigCaptureWebMail = true;

// Initialize enigmailCommon etc.
EnigInitCommon("enigmailNavigatorOverlay");
window.addEventListener("load", enigNavigatorStartup, false);

function enigNavigatorStartup() {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigNavigatorStartup:\n");

  var contentArea = document.getElementById("appcontent");
  contentArea.addEventListener("load",   enigDocLoadHandler, true);
  contentArea.addEventListener("unload", enigDocUnloadHandler, true);

  gEnigCurrentSite = null;
  gEnigCurrentHandlerNavButton1 = enigConfigWindow;
  gEnigNavButton1 = document.getElementById("button-enigmail-decrypt");
}

function enigHandlerNavButton()
{
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigHandlerNavButton1:\n");

  if (gEnigCurrentHandlerNavButton1) {
    gEnigCurrentHandlerNavButton1();

  } else {
    DEBUG_LOG("enigmailNavigatorOverlay.js: enigHandlerNavButton1: No button handler!\n");
  }
}

function enigDocLoadHandler(event) {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigDocLoadHandler:\n");

  enigUpdateUI(_content.location);
}

function enigFrameLoadHandler(event) {
 DEBUG_LOG("enigmailNavigatorOverlay.js: enigFrameLoadHandler: "+event.target.location.href+"\n");
}

function enigFrameUnloadHandler(event) {
 DEBUG_LOG("enigmailNavigatorOverlay.js: enigFrameUnloadHandler: "+event.target.location.href+"\n");
}

function enigDocUnloadHandler(event) {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Next URL="+event.target.location.href+"\n");

  enigUpdateUI(_content.location);

  if (event.target == _content.document) {
      // Handle events for content document only
    DEBUG_LOG("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Main doc\n");
  }
}

function enigConfigWindow() {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigConfigWindow:\n");
  toOpenWindowByType("tools:enigmail", "chrome://enigmail/content/enigmail.xul");
}

function enigResetUI() {
  gEnigCurrentSite = null;
  gEnigNavButton1.setAttribute("hidden", "true");
}

function enigUpdateUI(loc) {

  DEBUG_LOG("enigmailNavigatorOverlay.js: enigUpdateUI: "+loc.href+"\n");

  var host;
  try {
    // Extract hostname from URL (lower case)
    host = loc.host.toLowerCase();

  } catch(ex) {
    enigResetUI();
    return;
  }

  if (host.search(/mail.yahoo.com$/) != -1) {
    gEnigNavButton1.setAttribute("hidden", "false");
    gEnigCurrentSite = "mail.yahoo.com";
    enigYahooUpdateUI();

  } else if (host.search(/hotmail.msn.com$/) != -1) {
    gEnigNavButton1.setAttribute("hidden", "false");
    gEnigCurrentSite = "hotmail.msn.com";
    enigHotmailUpdateUI();
/*
  }  else if (loc.href.search(/^file:/) != -1) {
    gEnigCurrentSite = "TEST";
    if (gEnigTest) {
      gEnigTest = false;
      enigTest();
    }
*/
  } else {
    gEnigNavButton1.setAttribute("hidden", "false");
    gEnigCurrentSite = "-generic-";
    enigGenericUpdateUI();
  }
}

// *** YAHOO SPECIFIC STUFF ***

function enigYahooUpdateUI() {

  DEBUG_LOG("enigmailYahoo.js: enigYahooUpdateUI:\n");

  var msgFrame = enigYahooLocateMessageFrame();
  DEBUG_LOG("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  DEBUG_LOG("pathname = "+pathname+"\n");

  if (pathname.search(/ShowLetter$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooShowLetter;
    gEnigNavButton1.label = "Decrypt/verify";

  } else if (pathname.search(/Compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooCompose;
    gEnigNavButton1.label = "Sign/encrypt";

  } else {
    gEnigCurrentHandlerNavButton1 = enigConfigWindow;
    gEnigNavButton1.label = "Enigmail";
  }
}

function enigYahooLocateMessageFrame() {
  DEBUG_LOG("enigmailYahoo.js: enigYahooLocateMessageFrame:\n");

  var msgFrame;

  if (_content.frames.length) {
    // Locate message frame
    for (var j=0; j<_content.frames.length; j++) {
      DEBUG_LOG("frame "+j+" = "+_content.frames[j].name+"\n");
      if (_content.frames[j].name == "wmailmain")
        msgFrame = _content.frames[j];
    }
  } else {
    msgFrame = _content;
  }

  return msgFrame;
}

function enigYahooCompose() {
  DEBUG_LOG("enigmailYahoo.js: enigYahooCompose:\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var msgFrame = enigYahooLocateMessageFrame();

  var plainText = msgFrame.document.Compose.Body.value;
  DEBUG_LOG("enigYahooCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.Compose.To.value;
  DEBUG_LOG("enigYahooCompose: To="+toAddr+"\n");

  var fromAddr = msgFrame.document.Compose.From.value;
  DEBUG_LOG("enigYahooCompose: From="+fromAddr+"\n");

  var userIdValue = EnigGetPref("userIdValue");

  if (!EnigGetPref("userIdFromAddr") && userIdValue)
    fromAddr = userIdValue;

  var encryptFlags = nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED;

  if (EnigGetPref("alwaysTrustSend"))
     encryptFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;

  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj    = new Object();
  var uiFlags = nsIEnigmail.UI_INTERACTIVE;

  var cipherText = enigmailSvc.encryptMessage(window, uiFlags, null, plainText,
                                              fromAddr, toAddr,
                                              encryptFlags,
                                              exitCodeObj, statusFlagsObj,
                                              errorMsgObj);

  var exitCode = exitCodeObj.value;
  var errorMsg  = errorMsgObj.value;

  if (exitCode != 0) {
    EnigAlert(EnigGetString("navEncryptError")+errorMsg);
    return;
  }

  msgFrame.document.Compose.Body.value = cipherText;

}


function enigYahooShowLetter() {
  DEBUG_LOG("enigmailYahoo.js: enigYahooShowLetter:\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var msgFrame = enigYahooLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //DEBUG_LOG("enigYahooShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement, "");

  DEBUG_LOG("enigYahooShowLetter: cipherText='"+cipherText+"'\n");

  var exitCodeObj    = new Object();
  var errorMsgObj    = new Object();
  var signatureObj   = new Object();
  var statusFlagsObj = new Object();
  var keyIdObj       = new Object();
  var userIdObj      = new Object();
  var sigDetailsObj  = new Object();
  var blockSeparationObj  = new Object();

  var uiFlags = nsIEnigmail.UI_INTERACTIVE;
  var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                          signatureObj, exitCodeObj,
                                          statusFlagsObj, keyIdObj, userIdObj,
                                          sigDetailsObj, errorMsgObj,
                                          blockSeparationObj);

  var exitCode = exitCodeObj.value;
  var errorMsg = errorMsgObj.value;

  if (exitCode != 0) {
    EnigAlert(EnigGetString("navDecryptError")+errorMsg);
    return;
  }

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);

}

// *** Generic Handling STUFF ***

function enigGenericUpdateUI() {

  DEBUG_LOG("enigmailYahoo.js: enigGenericUpdateUI:\n");

  var msgFrame = enigGenericLocateMessageFrame();
  var pathname = "";
  if (msgFrame) {
    DEBUG_LOG("msgFrame.name = "+msgFrame.name+"\n")

    // Extract pathname from message frame URL
    pathname = msgFrame.location.pathname;

    DEBUG_LOG("pathname = "+pathname+"\n");
  }

  if (true) { //pathname.search(/ShowLetter$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigGenericShowLetter;
    gEnigNavButton1.label = "Decrypt/verify";

  } else if (pathname.search(/Compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooCompose;
    gEnigNavButton1.label = "Sign/encrypt";

  } else {
    gEnigCurrentHandlerNavButton1 = enigConfigWindow;
    gEnigNavButton1.label = "Enigmail";
  }
}

function enigGenericLocateMessageFrame() {
  DEBUG_LOG("enigmailNavigator.js: enigGenericLocateMessageFrame:\n");

  var msgFrame;

  if (_content.frames.length) {
    // Locate message frame
    for (var j=0; j<_content.frames.length; j++) {
      DEBUG_LOG("frame "+j+" = "+_content.frames[j].name+"\n");
      if (_content.frames[j].name.search(/main/) >= 0)
        msgFrame = _content.frames[j];
    }
  } else {
    msgFrame = _content;
  }

  return msgFrame;
}

function enigGetClibpoardData() {
  var clipBoard = Components.classes[ENIG_CLIPBOARD_CONTRACTID].getService(Components.interfaces.nsIClipboard);
  // get the clipboard content
  var transferable = Components.classes[ENIG_TRANSFERABLE_CONTRACTID].createInstance(Components.interfaces.nsITransferable);
  var xferTypes = [ "text/unicode", "text/html" ];

  for (var i=0; i < xferTypes.length; i++) {
    transferable.addDataFlavor(xferTypes[i]);
  }

  var clipData = {};
  clipData.flavour = {};
  clipData.data = {};
  clipData.length = {};

  try {
    clipBoard.getData(transferable, clipBoard.kGlobalClipboard);
    transferable.getAnyTransferData(clipData.flavour, clipData.data, clipData.length);
    return clipData;
  }
  catch (ex) {
    return null;
  }
}


function enigGenericShowLetter() {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigGenericShowLetter:\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var cipherText;
  var elem;
  var preElements

  var msgFrame = enigGenericLocateMessageFrame();

  if (msgFrame) {
    preElements = msgFrame.document.getElementsByTagName("pre");
  }
  else {
    preElements = [];
  }

  if (preElements.length > 0) {
    elem = preElements[0];
    cipherText = EnigGetDeepText(elem, "");

    //DEBUG_LOG("enigGenericShowLetter: "+elem+"\n");

    cipherText = EnigGetDeepText(elem, "");
  }
  else {
    goDoCommand('cmd_selectAll');
    var origClipBoard = enigGetClibpoardData();
    goDoCommand('cmd_copy');
    var htmlCopy = enigGetClibpoardData();

    restoreClipboard = Components.classes[ENIG_CLIPBOARD_HELPER_CONTRACTID].getService(Components.interfaces.nsIClipboardHelper);

    try {
      cipherText = htmlCopy.data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    }
    catch (ex) {
      return;
    }

    try{
      var data = origClipBoard.data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
      restoreClipboard.copyStringToClipboard(data, clipBoard.kGlobalClipboard);
    }
    catch (ex) {
    }

  }



  DEBUG_LOG("enigGenericShowLetter: cipherText='"+cipherText+"'\n");

  var exitCodeObj    = new Object();
  var errorMsgObj    = new Object();
  var signatureObj   = new Object();
  var statusFlagsObj = new Object();
  var keyIdObj       = new Object();
  var userIdObj      = new Object();
  var sigDetailsObj  = new Object();
  var blockSeparationObj  = new Object();

  var uiFlags = nsIEnigmail.UI_INTERACTIVE;
  var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                          signatureObj, exitCodeObj,
                                          statusFlagsObj, keyIdObj, userIdObj,
                                          sigDetailsObj, errorMsgObj,
                                          blockSeparationObj);

  var exitCode = exitCodeObj.value;
  var errorMsg = errorMsgObj.value;

  if (exitCode != 0) {
    EnigAlert(EnigGetString("navDecryptError")+errorMsg);
    return;
  }

  if (preElements.length > 0) {
    while (elem.hasChildNodes())
        elem.removeChild(elem.childNodes[0]);

    var newTextNode = msgFrame.document.createTextNode(plainText);
    elem.appendChild(newTextNode);
  }
  else {

    var x = _content.document.createTextNode(plainText);
    enigViewDecryptedMsg(x);
  }
}


// *** HOTMAIL SPECIFIC STUFF ***

function enigHotmailUpdateUI() {

  DEBUG_LOG("enigmailHotmail.js: enigHotmailUpdateUI:\n");

  var msgFrame = enigHotmailLocateMessageFrame();
  DEBUG_LOG("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  DEBUG_LOG("pathname = "+pathname+"\n");

  if (pathname.search(/getmsg$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigHotmailShowLetter;
    gEnigNavButton1.label = "EnigShow";

  } else if (pathname.search(/compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigHotmailCompose;
    gEnigNavButton1.label = "EnigCompose";

  } else {
    gEnigCurrentHandlerNavButton1 = null;
    gEnigNavButton1.label = "EnigMoz";
  }
}

function enigHotmailLocateMessageFrame() {
  DEBUG_LOG("enigmailHotmail.js: enigHotmailLocateMessageFrame:\n");

  return _content;
}


function enigHotmailCompose() {
  DEBUG_LOG("enigmailHotmail.js: enigHotmailCompose:\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var msgFrame = enigHotmailLocateMessageFrame();

  var plainText = msgFrame.document.composeform.body.value;
  DEBUG_LOG("enigHotmailCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.composeform.to.value;
  DEBUG_LOG("enigHotmailCompose: To="+toAddr+"\n");

  var fromAddr = msgFrame.document.composeform.from.value;
  DEBUG_LOG("enigHotmailCompose: From="+fromAddr+"\n");

  var userIdValue = EnigGetPref("userIdValue");

  if (!EnigGetPref("userIdFromAddr") && userIdValue)
    fromAddr = userIdValue;

  var encryptFlags = nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED;

  if (EnigGetPref("alwaysTrustSend"))
     encryptFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;

  var exitCodeObj    = new Object();
  var statusFlagsObj = new Object();
  var errorMsgObj    = new Object();
  var uiFlags = nsIEnigmail.UI_INTERACTIVE;

  var cipherText = enigmailSvc.encryptMessage(window, uiFlags, null, plainText,
                                              fromAddr, toAddr,
                                              encryptFlags,
                                              exitCodeObj, statusFlagsObj,
                                              errorMsgObj);

  var exitCode = exitCodeObj.value;
  var errorMsg  = errorMsgObj.value;

  if (exitCode != 0) {
    EnigAlert(EnigGetString("navEncryptError")+errorMsg);
    return;
  }

  msgFrame.document.composeform.body.value = cipherText;

}


function enigHotmailShowLetter() {
  DEBUG_LOG("enigmailHotmail.js: enigHotmailShowLetter:\n");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  var msgFrame = enigHotmailLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //DEBUG_LOG("enigHotmailShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement, "");

  DEBUG_LOG("enigHotmailShowLetter: cipherText='"+cipherText+"'\n");

  var exitCodeObj    = new Object();
  var errorMsgObj    = new Object();
  var signatureObj   = new Object();
  var statusFlagsObj = new Object();
  var keyIdObj       = new Object();
  var userIdObj      = new Object();
  var sigDetailsObj  = new Object();
  var blockSeparationObj  = new Object();

  var uiFlags = nsIEnigmail.UI_INTERACTIVE;
  var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                          signatureObj, exitCodeObj,
                                          statusFlagsObj, keyIdObj, userIdObj,
                                          sigDetailsObj, errorMsgObj,
                                          blockSeparationObj);
  var exitCode = exitCodeObj.value;
  var errorMsg = errorMsgObj.value;

  if (exitCode != 0) {
    EnigAlert("Error in decrypting message.\n"+errorMsg);
    return;
  }

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
}

function enigViewNaviConsole() {
  DEBUG_LOG("enigmailNavigator.js: EnigViewConsole\n");

  EnigOpenWin("enigmail:console",
              "chrome://enigmail/content/enigmailNaviConsole.xul",
              "resizable,centerscreen");
}

function enigViewDecryptedMsg(param) {
  DEBUG_LOG("enigmailNavigator.js: enigViewDecryptedMsg\n");

  window.openDialog("chrome://enigmail/content/enigmailGenericDisplay.xul",
              "", "resizable,centerscreen", param);
}
