// enigmailNavigatorOverlay.js

window.addEventListener("load", enigNavigatorStartup, false);

var gEnigCurrentSite;
var gEnigNavButton1;
var gEnigCurrentHandlerNavButton1;
var gEnigTest = true;

function enigNavigatorStartup() {
  WRITE_LOG("enigmailNavigatorOverlay.js: enigNavigatorStartup:\n");
  var contentArea = document.getElementById("appcontent");
  //contentArea.addEventListener("load",   enigDocLoadHandler, true);
  contentArea.addEventListener("unload", enigDocUnloadHandler, true);

  gEnigCurrentSite = null;
  gEnigCurrentHandlerNavButton1 = enigConfigWindow;
  gEnigNavButton1 = document.getElementById("enig-nav-button1");
}

function enigHandlerNavButton1()
{
  WRITE_LOG("enigmailNavigatorOverlay.js: enigHandlerNavButton1:\n");

  if (gEnigCurrentHandlerNavButton1) {
    gEnigCurrentHandlerNavButton1();

  } else {
    WRITE_LOG("enigmailNavigatorOverlay.js: enigHandlerNavButton1: No button handler!\n");
  }
}

function enigDocLoadHandler(event) {
  WRITE_LOG("enigmailNavigatorOverlay.js: enigDocLoadHandler:\n");

  enigUpdateUI(_content.location);
}

function enigFrameLoadHandler(event) {
 WRITE_LOG("enigmailNavigatorOverlay.js: enigFrameLoadHandler: "+event.target.location.href+"\n");
}

function enigFrameUnloadHandler(event) {
 WRITE_LOG("enigmailNavigatorOverlay.js: enigFrameUnloadHandler: "+event.target.location.href+"\n");
}

function enigDocUnloadHandler(event) {
  WRITE_LOG("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Next URL="+event.target.location.href+"\n");

  enigUpdateUI(_content.location);

  if (event.target == _content.document) {
      // Handle events for content document only
    WRITE_LOG("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Main doc\n");
  }
}

function enigConfigWindow() {
  WRITE_LOG("enigmailNavigatorOverlay.js: enigConfigWIndow:\n");
  toOpenWindowByType("tools:enigmail", "chrome://enigmail/content/enigmail.xul");
}

function enigResetUI() {
  gEnigCurrentSite = null;
  gEnigNavButton1.setAttribute("hidden", "true");
}

function enigUpdateUI(loc) {

  WRITE_LOG("enigmailNavigatorOverlay.js: enigUpdateUI: "+loc.href+"\n");

  if (!loc.host) {
    enigResetUI();
    return;
  }

  // Extract hostname from URL (lower case)
  var host = loc.host.toLowerCase();

  if (host.search(/mail.yahoo.com$/) != -1) {
    gEnigNavButton1.setAttribute("hidden", "false");
    gEnigCurrentSite = "mail.yahoo.com";
    enigYahooUpdateUI();

  } else if (host.search(/hotmail.msn.com$/) != -1) {
    gEnigNavButton1.setAttribute("hidden", "false");
    gEnigCurrentSite = "hotmail.msn.com";
    enigHotmailUpdateUI();

  } else if (loc.href.search(/^file:/) != -1) {
    gEnigCurrentSite = "TEST";
    if (gEnigTest) {
      gEnigTest = false;
      enigTest();
    }

  } else {
    enigResetUI();
  }
}

// *** YAHOO SPECIFIC STUFF ***

function enigYahooUpdateUI() {

  WRITE_LOG("enigmailYahoo.js: enigYahooUpdateUI:\n");

  var msgFrame = enigYahooLocateMessageFrame();
  WRITE_LOG("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  WRITE_LOG("pathname = "+pathname+"\n");

  if (pathname.search(/ShowLetter$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooShowLetter;
    gEnigNavButton1.label = "Decrypt/Verify";

  } else if (pathname.search(/Compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooCompose;
    gEnigNavButton1.label = "Sign & Encrypt";

  } else {
    gEnigCurrentHandlerNavButton1 = enigConfigWindow;
    gEnigNavButton1.label = "Enigmail";
  }
}

function enigYahooLocateMessageFrame() {
  WRITE_LOG("enigmailYahoo.js: enigYahooLocateMessageFrame:\n");

  var msgFrame;

  if (_content.frames.length) {
    // Locate message frame
    for (var j=0; j<_content.frames.length; j++) {
      WRITE_LOG("frame "+j+" = "+_content.frames[j].name+"\n");
      if (_content.frames[j].name == "wmailmain")
        msgFrame = _content.frames[j];
    }
  } else {
    msgFrame = _content;
  }

  return msgFrame;
}

function enigYahooCompose() {
  WRITE_LOG("enigmailYahoo.js: enigYahooCompose:\n");

  var msgFrame = enigYahooLocateMessageFrame();

  var plainText = msgFrame.document.Compose.Body.value;
  WRITE_LOG("enigYahooCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.Compose.To.value;
  WRITE_LOG("enigYahooCompose: To="+toAddr+"\n");

  var statusLineObj = new Object();
  var cipherText = EnigEncryptMessage(plainText, toAddr, statusLineObj); 

  msgFrame.document.Compose.Body.value = cipherText;

}


function enigYahooShowLetter() {
  WRITE_LOG("enigmailYahoo.js: enigYahooShowLetter:\n");

  var msgFrame = enigYahooLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //WRITE_LOG("enigYahooShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement);

  WRITE_LOG("enigYahooShowLetter: cipherText='"+cipherText+"'\n");

  var statusLineObj = new Object();
  var plainText = EnigDecryptMessage(cipherText, statusLineObj);

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
  
}

// *** HOTMAIL SPECIFIC STUFF ***

function enigHotmailUpdateUI() {

  WRITE_LOG("enigmailHotmail.js: enigHotmailUpdateUI:\n");

  var msgFrame = enigHotmailLocateMessageFrame();
  WRITE_LOG("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  WRITE_LOG("pathname = "+pathname+"\n");

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
  WRITE_LOG("enigmailHotmail.js: enigHotmailLocateMessageFrame:\n");

  return _content;
}


function enigHotmailCompose() {
  WRITE_LOG("enigmailHotmail.js: enigHotmailCompose:\n");

  var msgFrame = enigHotmailLocateMessageFrame();

  var plainText = msgFrame.document.composeform.body.value;
  WRITE_LOG("enigHotmailCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.composeform.to.value;
  WRITE_LOG("enigHotmailCompose: To="+toAddr+"\n");

  var statusLineObj = new Object();
  var cipherText = EnigEncryptMessage(plainText, toAddr, statusLineObj); 

  msgFrame.document.composeform.body.value = cipherText;

}


function enigHotmailShowLetter() {
  WRITE_LOG("enigmailHotmail.js: enigHotmailShowLetter:\n");

  var msgFrame = enigHotmailLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //WRITE_LOG("enigHotmailShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement);

  WRITE_LOG("enigHotmailShowLetter: cipherText='"+cipherText+"'\n");

  var statusLineObj = new Object();
  var plainText = EnigDecryptMessage(cipherText, statusLineObj);

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
}
