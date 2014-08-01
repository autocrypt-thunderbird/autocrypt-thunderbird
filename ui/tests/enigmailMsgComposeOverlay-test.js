function trustAllKeys() {
  // test functionality of trustAllKeys
  Enigmail.msg.trustAllKeys = true;
  Enigmail.msg.tempTrustAllKeys();
  Assert.equal(Enigmail.msg.trustAllKeys, false, "check trustAllKeys is false");

  Enigmail.msg.tempTrustAllKeys();
  Assert.equal(Enigmail.msg.trustAllKeys, true, "check trustAllKeys is true");


}

function run_test() {
  window = JSUnit.createHiddenWindow();
  document = window.document;

  do_load_module("chrome://enigmail/content/enigmailMsgComposeOverlay.js");

  trustAllKeys();
}
