const NS_IPCSERVICE_CONTRACTID =
    "@mozilla.org/protozilla/ipc-service;1";

var ipcService;
try {
  ipcService = Components.classes[NS_IPCSERVICE_CONTRACTID].createInstance();
  ipcService = ipcService.QueryInterface(Components.interfaces.nsIIPCService);

} catch (ex) {
}

dump("enigmailOverlay.js: ipcService = "+ipcService+"\n");

window.addEventListener("load", enigStartup, false);

var gEnigCurrentSite;
var gEnigNavButton1;
var gEnigCurrentHandlerNavButton1;
var gEnigTest = true;

function enigStartup() {
  dump("enigmailOverlay.js: enigStartup:\n");
  var contentArea = document.getElementById("appcontent");
  contentArea.addEventListener("load",   enigDocLoadHandler,   true);
  contentArea.addEventListener("unload", enigDocUnloadHandler, true);

  gEnigCurrentSite = null;
  gEnigCurrentHandlerNavButton1 = enigConfigWindow;
  gEnigNavButton1 = document.getElementById("enig-nav-button1");
}

function enigHandlerNavButton1()
{
  dump("enigmailOverlay.js: enigHandlerNavButton1:\n");

  if (gEnigCurrentHandlerNavButton1) {
    gEnigCurrentHandlerNavButton1();

  } else {
    dump("enigmailOverlay.js: enigHandlerNavButton1: No button handler!\n");
  }

  //toOpenWindowByType("tools:enigmail", "chrome://enigmail/content/enigmail.xul");
}

function enigDocLoadHandler(event) {
  dump("enigmailOverlay.js: enigDocLoadHandler:\n");

  // Handle events for content document only
  if (event.target != _content.document)
      return;

  enigUpdateUI(_content.location);
}

function enigDocUnloadHandler(event) {
  dump("enigmailOverlay.js: enigDocUnloadHandler: Next URL="+event.target.location.href+"\n");

  enigUpdateUI(_content.location);

  if (event.target == _content.document) {
      // Handle events for content document only
    dump("enigmailOverlay.js: enigDocUnloadHandler: Main doc\n");
  }
}

function enigConfigWindow() {
  dump("enigmailOverlay.js: enigConfigWIndow:\n");
  toOpenWindowByType("tools:enigmail", "chrome://enigmail/content/enigmail.xul");
}

function enigUpdateUI(loc) {

  dump("enigmailOverlay.js: enigUpdateUI: "+loc.href+"\n");

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

function enigTest() {
  var plainText = "TEST MESSAGE 123\n";
  var toMailAddr = "r_sarava@yahoo.com";

  var cipherText = enigEncryptMessage(plainText, toMailAddr);
  dump("enigmailOverlay.js: enigTest: cipherText = "+cipherText+"\n");

  var decryptedText = enigDecryptMessage(cipherText);
  dump("enigmailOverlay.js: enigTest: decryptedText = "+decryptedText+"\n");
}

function enigAlert(mesg) {
  return window.prompter.alert("Enigmail Alert", mesg);
}

function enigConfirm(mesg) {
  return window.prompter.confirm("Enigmail Confirm", mesg);
}

function enigSignClearText(plainText) {
  dump("enigmailOverlay.js: enigSignClearText: \n");

  var signedText;

  signedText = "*** SIGNED ***\n"+plainText;

  return signedText;
}

function enigGetPassPhrase() {
  var passwdObj = new Object();

  var success = window.prompter.promptPassword("Enigmail",
                               "Please type in your GPG passphrase",
                               "",
                               0,
                               passwdObj);
  if (!success)
    return "";

  dump("enigmailOverlay.js: enigGetPassPhrase: "+passwdObj.value+"\n");

  return passwdObj.value;
}


function enigExecGPG(command, input, errMessages, status) {
  dump("enigmailOverlay.js: enigExecGPG: command = "+command+"\n");

  var errObj = new Object();
  if ((typeof input) != "string") input = "";
  var output = ipcService.execPipe(command, input, input.length, errObj);
  var errOutput = errObj.value;

  dump("enigmailOverlay.js: enigExecGPG: errOutput = "+errOutput+"\n");

  var errLines = errOutput.split(/\r?\n/);

  // Discard last null string, if any
  if ((errLines.length > 1) && !errLines[errLines.length-1])
    errLines.pop();

  var errArray    = new Array();
  var statusArray = new Array();

  var statusPat = /^\[GNUPG:\] /;

  for (var j=0; j<errLines.length; j++) {
    if (errLines[j].search(statusPat) == 0) {
      statusArray.push(errLines[j].replace(statusPat,""));

    } else {
      errArray.push(errLines[j]);
    }
  }

  errMessages = errArray.join("\n");
  status      = statusArray.join("\n");

  dump("enigmailOverlay.js: enigExecGPG: status = "+status+"\n");
  return output;
}


function enigEncryptMessage(plainText, toMailAddr) {
  dump("enigmailOverlay.js: enigEncryptMessage: To "+toMailAddr+"\n");

  var encryptCommand = "gpg --batch --no-tty --encrypt --armor --sign --passphrase-fd 0 --status-fd 2 --recipient "+toMailAddr;

  var passphrase = enigGetPassPhrase();

  if (!passphrase)
    return;

  var errMessages, status;
  var cipherText = enigExecGPG(encryptCommand,
                               passphrase+"\n"+plainText, errMessages, status);

  return cipherText;
}

function enigDecryptMessage(cipherText) {
  dump("enigmailOverlay.js: enigDecryptMessage: \n");

  var decryptCommand = "gpg --batch --no-tty --decrypt --passphrase-fd 0 --status-fd 2";

  var passphrase = enigGetPassPhrase();

  if (!passphrase)
    return;

  var errMessages, status;
  var plainText = enigExecGPG(decryptCommand,
                               passphrase+"\n"+cipherText, errMessages,status);

  return plainText;
}

function enigGetDeepText(node) {
  if (node.nodeType == Node.TEXT_NODE)
    return node.data;

  var text = "";

  if (node.hasChildNodes()) {
    // Loop over the children
    var children = node.childNodes;
    for (var count = 0; count < children.length; count++) {
      dump("loop: "+node.tagName+"\n");
      text += enigGetDeepText(children[count]);
    }
  }

  return text;
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
    gEnigNavButton1.value = "Decrypt";

  } else if (pathname.search(/Compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooCompose;
    gEnigNavButton1.value = "Encrypt";

  } else {
    gEnigCurrentHandlerNavButton1 = enigConfigWindow;
    gEnigNavButton1.value = "Enigmail";
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

  var cipherText = enigEncryptMessage(plainText, toAddr); 

  msgFrame.document.Compose.Body.value = cipherText;

}


function enigYahooShowLetter() {
  dump("enigmailYahoo.js: enigYahooShowLetter:\n");

  var msgFrame = enigYahooLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //dump("enigYahooShowLetter: "+preElement+"\n");

  var cipherText = enigGetDeepText(preElement);

  dump("enigYahooShowLetter: cipherText='"+cipherText+"'\n");

  var plainText = enigDecryptMessage(cipherText);

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
    gEnigNavButton1.value = "EnigShow";

  } else if (pathname.search(/compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigHotmailCompose;
    gEnigNavButton1.value = "EnigCompose";

  } else {
    gEnigCurrentHandlerNavButton1 = null;
    gEnigNavButton1.value = "EnigMoz";
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

  var cipherText = enigEncryptMessage(plainText, toAddr); 

  msgFrame.document.composeform.body.value = cipherText;

}


function enigHotmailShowLetter() {
  dump("enigmailHotmail.js: enigHotmailShowLetter:\n");

  var msgFrame = enigHotmailLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //dump("enigHotmailShowLetter: "+preElement+"\n");

  var cipherText = enigGetDeepText(preElement);

  dump("enigHotmailShowLetter: cipherText='"+cipherText+"'\n");

  var plainText = enigDecryptMessage(cipherText);

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
}
