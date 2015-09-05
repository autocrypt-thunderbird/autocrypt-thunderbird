var window;
var document;

function trustAllKeys_test() {
  // test functionality of trustAllKeys
  Enigmail.msg.trustAllKeys = true;
  Enigmail.msg.tempTrustAllKeys();
  Assert.equal(Enigmail.msg.trustAllKeys, false, "check trustAllKeys is false");

  Enigmail.msg.tempTrustAllKeys();
  Assert.equal(Enigmail.msg.trustAllKeys, true, "check trustAllKeys is true");


}

function run_test() {
  window = JSUnit.createStubWindow();
  window.document = JSUnit.createDOMDocument();
  document = window.document;

  do_load_module("chrome://enigmail/content/enigmailMsgComposeOverlay.js");

  trustAllKeys_test();
}
