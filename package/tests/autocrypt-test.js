/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global dump: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("autocrypt.jsm"); /*global EnigmailAutocrypt: false */

const pubkey1 =
  `mQENBFdGIzkBCADKys5q0rYiTr/FYdoupmNAJ0o20XWuFp/V58qsnQAMcAY2pCB/ydx9Y7
A80QjZPuVcE5QdROfvvkMXAA47ZxZrH79Kaqj11DS5XOgtLVtITGtWvrYqIFujxP42ICWB
h7LXUwrHfi93FX74ucXoWo/PZndbo+JBxc0ZsrHUdu24grTDuqLZQ8mRCx5U4tf+zEVIU6
kXubFzq8aPSnjfEg6MhXxSRictjIBKM0Ez2QwZmh1vAEmvn0kr0VaJJ7xVRgIH1CgNh/WW
tbr0lrblKCkFkTFnQfslWvSEko+LqvwgBSKyKg8VtWbYftnBkn8FPbP5Brp3wYgBc/c7mr
LROqAFABEBAAG0ImRldi10aWdlciA8ZGV2LXRpZ2VyQHRlc3Qubm90cmVhbD6JATcEEwEI
ACEFAldGIzkCGwMFCwkIBwIGFQgJCgsCBBYCAwECHgECF4AACgkQhDnhcEaXfEb3/gf/V0
da3gXN5TNOsWZKj/fI2FhQBglJ2vlEamnppwtnWZGktdFZ1h6ymzQ9PY3IidbKctqs/QQW
KtIBVh5k02fvUe99nsFZmINcLeajdu7IqvKxtFBuEwZAA1Bw9dhM3JRQM8z+l+CtbFh6dV
ufU7q5vVEXciCkhdn172QYTMAXNYE4Tfh7eaEAOdRyFcwiAGZ826pOp7Al52frK+MtaXa9
D2fRINlDXD9+IIR80sig2B4iBGeY+qAmE6bFuw7MtBya6uKupLjtAD/v48Z5wBYuU0jPld
4KH88IWksbQo1zW/O+1N7J1/U9ZGNwpvS+wtfyjlOpTS3YWGmY8sVturZqTrkBDQRXRiM5
AQgAsDN5j4viE5E8H5N9cfzQ9ZO5BUk66yI2DVEeasqZWFCkRA+uFHcTF6YpCoSn4/Jsvq
vUWVh63uV5vdAiU9+4sNFT8nkP7zD0LQthFtgEXqNo11NR7yvDRT3TOAnGaa+bLyoU/SLX
zSwctZksrQjzQJVSohQNznhj95XH3UEsUydHqje7ljp7NHWAJx+Tlp2Yh6q060/gwh37zs
fdVbaVtjeaAYECX3z6L7JB4KBb9KGlmDmOMngVUuR8XWWE+LEx0m7B+kZ+vZhUOSDDomBP
+8jGJmXlcIt8+LIBq0NeXs/YINCc89saUPw/V6X/NFRkekKFzIprCzwhg0LWl8oXAwARAQ
ABiQEfBBgBCAAJBQJXRiM5AhsMAAoJEIQ54XBGl3xGUvEH/jVTBoRfJ8ohc4Ahal8TyIm8
vdT/Ax/ddyyaLnCxkLFt0noBlA7062N1Fvv86Ts93EFrK9nF3g20gXKBKETo/vJRqtODIr
wtCMfzPbS/FkQweLtUDZXed0nq/Yaxk60H2HmWm+n9/126F3QIt7is0E3dY0e6DYJGRHnn
+lWnUs/8Ba16Zb/os3GgwEQwr4LPEty6CFQU2DNl5HmajeB1oEqmeDZ2f/y87GRpdCoTgu
dQiHMPdm2kPVbeAA6945W6Y2LSA5Hm+yS8s2dBs4+sEiW97owLz6vcak8Aw+7JFxL2JkoZ
uN28dueoVcFQw3uX0snoBXgo3LYsK71JoufrXhY=`;

const pubkey2 =
  `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
WAXKLBn4tb400iHp7byO85tF/H0OOI1K`;


/* global Sqlite */

test(function prepareDb() {
  // Drop autocrypt_keydata table (if it exists)
  do_test_pending();
  Sqlite.openConnection({
    path: "enigmail.sqlite",
    sharedMemoryCache: false
  }).
  then(connection => {
    connection.execute("drop table autocrypt_keydata;").then(ok => {
      connection.close();
      dump("dropped table\n");
      do_test_finished();
    }).catch(err => {
      do_test_finished();
    });
  });
  JSUnit.waitForAsyncTest(); // wait until that's done before starting the next test
});


// testing: extractMessageId
test(function processHeader() {

  const hdr0 = "type=1; addr=dev-tiger@test.notreal; keydata=" + pubkey1;
  const hdr1 = "type=1; addr=dev-tiger@test.notreal; keydata=" + pubkey2;

  let d0 = new Date();
  d0.setTime(Date.now() - 5 * 86400 * 1000); // 5 days ago
  const sentDate = d0.toUTCString();

  let d1 = new Date();
  d1.setTime(Date.now() - 4 * 86400 * 1000); // 4 days ago

  const updateDate = d1.toUTCString();

  do_test_pending();
  EnigmailAutocrypt.processAutocryptHeader("dev-tiger@test.notreal", [hdr0], sentDate).
  then(result => {
    Assert.equal(0, result);

    return EnigmailAutocrypt.getOpenPGPKeyForEmail(["dev-tiger@test.notreal"]);
  }).then(result => {
    Assert.equal(1, result.length);
    Assert.equal(sentDate, result[0].lastAutocrypt.toUTCString());
    Assert.equal("8C140834F2D683E9A016D3098439E17046977C46", result[0].fpr);
    Assert.equal(pubkey1.replace(/[\r\n ]/g, ""), result[0].keyData);

    return EnigmailAutocrypt.processAutocryptHeader("dev-tiger@test.notreal", [hdr1], updateDate);
  }).then(result => {
    Assert.equal(0, result);

    return EnigmailAutocrypt.getOpenPGPKeyForEmail(["dev-tiger@test.notreal"]);
  }).then(result => {
    Assert.equal(1, result.length);
    Assert.equal(updateDate, result[0].lastAutocrypt.toUTCString());
    Assert.equal("65537E212DC19025AD38EDB2781617319CE311C4", result[0].fpr);
    Assert.equal(pubkey2.replace(/[\r\n ]/g, ""), result[0].keyData);

    // this should not change anything, update in the past
    return EnigmailAutocrypt.processAutocryptHeader("dev-tiger@test.notreal", [hdr0], sentDate);
  }).then(result => {
    Assert.equal(0, result);

    return EnigmailAutocrypt.getOpenPGPKeyForEmail(["dev-tiger@test.notreal"]);
  }).then(result => {
    Assert.equal(1, result.length);
    Assert.equal(updateDate, result[0].lastAutocrypt.toUTCString());
    Assert.equal("65537E212DC19025AD38EDB2781617319CE311C4", result[0].fpr);
    Assert.equal(pubkey2.replace(/[\r\n ]/g, ""), result[0].keyData);

    do_test_finished();
  }).
  catch(err => {
    Assert.equal(err, 1);
    do_test_finished();
  });

});
