// Tests nsIEnigMimeListener

const NS_ENIGMIMELISTENER_CONTRACTID = "@mozilla.org/enigmail/mime-listener;1";
const NS_PIPECONSOLE_CONTRACTID = "@mozilla.org/process/pipe-console;1";
const NS_IPCBUFFER_CONTRACTID   = "@mozilla.org/process/ipc-buffer;1";
const NS_PIPEFILTERLISTENER_CONTRACTID = "@mozilla.org/process/pipe-filter-listener;1";

function escape_cr(str) {
   return str.replace(/\r/g, "\\r");
}

dump("Testing EnigMimeListener et.\n");

listener = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

listener.open(2000, false);

var mimeListener = Components.classes[NS_ENIGMIMELISTENER_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeListener);

mimeListener.init(listener, null, 10000, true, false);

var lines = ["Content-Type: multipart/signed; micalg=pgp-sha1;\r\n",
             "	protocol=\"application/pgp-signature\"; boundary=\"9jxsPFA5p3P2qPhR\"\r\n",
             "\r\n",
             "Dummy\r\n",
             "--Boundary",
             "\r\nPart 1\r\n",
             " --Boundary\r\n\r\n",
             "--Boundary\r",
             "\nPart 2\r\nPL2\r\nx\r\n--Boundary--\r\n"];

for (var j=0; j<lines.length; j++) {
  mimeListener.write(lines[j], lines[j].length, null, null);
}
mimeListener.onStopRequest(null, null, 0);

dump("mimeListener.contentType="+mimeListener.contentType+"\n");
dump("mimeListener.contentMicalg="+mimeListener.contentMicalg+"\n");

dump("listener.getData()='"+escape_cr(listener.getData())+"'\n");

var linebreak = ["CRLF", "LF", "CR"];

for (var j=0; j<linebreak.length; j++) {
  listener = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);

  listener.open(2000, false);

  mimeListener = Components.classes[NS_ENIGMIMELISTENER_CONTRACTID].createInstance(Components.interfaces.nsIEnigMimeListener);

  mimeListener.init(listener, null, 10000, true, true);

  for (var k=0; k<lines.length; k++) {
    var line = lines[k];
    if (j == 1) line = line.replace(/\r/g, "");
    if (j == 2) line = line.replace(/\n/g, "");
    mimeListener.write(line, line.length, null, null);
  }

  mimeListener.onStopRequest(null, null, 0);

  dump(linebreak[j]+" mimeListener.contentType="+mimeListener.contentType+"\n");
}
