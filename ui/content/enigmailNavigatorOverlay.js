// enigmailNavigatorOverlay.js

window.addEventListener("load", enigNavigatorStartup, false);

var gEnigCurrentSite;
var gEnigNavButton1;
var gEnigCurrentHandlerNavButton1;
var gEnigTest = true;

function enigNavigatorStartup() {
  dump("enigmailNavigatorOverlay.js: enigNavigatorStartup:\n");
  var contentArea = document.getElementById("appcontent");
  //contentArea.addEventListener("load",   enigDocLoadHandler, true);
  contentArea.addEventListener("unload", enigDocUnloadHandler, true);

  gEnigCurrentSite = null;
  gEnigCurrentHandlerNavButton1 = enigConfigWindow;
  gEnigNavButton1 = document.getElementById("enig-nav-button1");
}

function enigHandlerNavButton1()
{
  dump("enigmailNavigatorOverlay.js: enigHandlerNavButton1:\n");

  if (gEnigCurrentHandlerNavButton1) {
    gEnigCurrentHandlerNavButton1();

  } else {
    dump("enigmailNavigatorOverlay.js: enigHandlerNavButton1: No button handler!\n");
  }
}

function enigDocLoadHandler(event) {
  dump("enigmailNavigatorOverlay.js: enigDocLoadHandler:\n");

  enigUpdateUI(_content.location);
}

function enigFrameLoadHandler(event) {
 dump("enigmailNavigatorOverlay.js: enigFrameLoadHandler: "+event.target.location.href+"\n");
}

function enigFrameUnloadHandler(event) {
 dump("enigmailNavigatorOverlay.js: enigFrameUnloadHandler: "+event.target.location.href+"\n");
}

function enigDocUnloadHandler(event) {
  dump("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Next URL="+event.target.location.href+"\n");

  enigUpdateUI(_content.location);

  if (event.target == _content.document) {
      // Handle events for content document only
    dump("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Main doc\n");
  }
}

function enigConfigWindow() {
  dump("enigmailNavigatorOverlay.js: enigConfigWIndow:\n");
  toOpenWindowByType("tools:enigmail", "chrome://enigmail/content/enigmail.xul");
}

function enigUpdateUI(loc) {

  dump("enigmailNavigatorOverlay.js: enigUpdateUI: "+loc.href+"\n");

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
    gEnigCurrentSite = null;
    gEnigNavButton1.setAttribute("hidden", "true");
  }
}

// *** YAHOO SPECIFIC STUFF ***

function enigYahooUpdateUI() {

  dump("enigmailYahoo.js: enigYahooUpdateUI:\n");

  var msgFrame = enigYahooLocateMessageFrame();
  dump("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  dump("pathname = "+pathname+"\n");

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
  dump("enigmailYahoo.js: enigYahooLocateMessageFrame:\n");

  var msgFrame;

  if (_content.frames.length) {
    // Locate message frame
    for (var j=0; j<_content.frames.length; j++) {
      dump("frame "+j+" = "+_content.frames[j].name+"\n");
      if (_content.frames[j].name == "wmailmain")
        msgFrame = _content.frames[j];
    }
  } else {
    msgFrame = _content;
  }

  return msgFrame;
}

function enigYahooCompose() {
  dump("enigmailYahoo.js: enigYahooCompose:\n");

  var msgFrame = enigYahooLocateMessageFrame();

  var plainText = msgFrame.document.Compose.Body.value;
  dump("enigYahooCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.Compose.To.value;
  dump("enigYahooCompose: To="+toAddr+"\n");

  var statusLineObj = new Object();
  var cipherText = EnigEncryptMessage(plainText, toAddr, statusLineObj); 

  msgFrame.document.Compose.Body.value = cipherText;

}


function enigYahooShowLetter() {
  dump("enigmailYahoo.js: enigYahooShowLetter:\n");

  var msgFrame = enigYahooLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //dump("enigYahooShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement);

  dump("enigYahooShowLetter: cipherText='"+cipherText+"'\n");

  var statusLineObj = new Object();
  var plainText = EnigDecryptMessage(cipherText, statusLineObj);

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
  
}

// *** HOTMAIL SPECIFIC STUFF ***

function enigHotmailUpdateUI() {

  dump("enigmailHotmail.js: enigHotmailUpdateUI:\n");

  var msgFrame = enigHotmailLocateMessageFrame();
  dump("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  dump("pathname = "+pathname+"\n");

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
  dump("enigmailHotmail.js: enigHotmailLocateMessageFrame:\n");

  return _content;
}


function enigHotmailCompose() {
  dump("enigmailHotmail.js: enigHotmailCompose:\n");

  var msgFrame = enigHotmailLocateMessageFrame();

  var plainText = msgFrame.document.composeform.body.value;
  dump("enigHotmailCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.composeform.to.value;
  dump("enigHotmailCompose: To="+toAddr+"\n");

  var statusLineObj = new Object();
  var cipherText = EnigEncryptMessage(plainText, toAddr, statusLineObj); 

  msgFrame.document.composeform.body.value = cipherText;

}


function enigHotmailShowLetter() {
  dump("enigmailHotmail.js: enigHotmailShowLetter:\n");

  var msgFrame = enigHotmailLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //dump("enigHotmailShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement);

  dump("enigHotmailShowLetter: cipherText='"+cipherText+"'\n");

  var statusLineObj = new Object();
  var plainText = EnigDecryptMessage(cipherText, statusLineObj);

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
}
