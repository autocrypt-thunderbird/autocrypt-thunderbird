/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("autocrypt.jsm"); /*global EnigmailAutocrypt: false */

// testing: extractMessageId
test(function processHeader() {

  const keyData =
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

  const hdr = "addr=dev-tiger@test.notreal; type=1; keydata=" + keyData;

  let d = new Date();
  d.setTime(Date.now() - 5 * 86400 * 1000); // 5 days ago
  const sentDate = d.toUTCString();

  do_test_pending();
  EnigmailAutocrypt.processAutocryptHeader("dev-tiger@test.notreal", [hdr], sentDate).
  then(result => {
    Assert.equal(0, result);

    return EnigmailAutocrypt.getOpenPGPKeyForEmail(["dev-tiger@test.notreal"]);
  }).then(result => {
    Assert.equal(1, result.length);
    Assert.equal(sentDate, result[0].lastAutocrypt.toUTCString());
    Assert.equal("8C140834F2D683E9A016D3098439E17046977C46", result[0].fpr);
    Assert.equal(keyData.replace(/[\r\n ]/g, ""), result[0].keyData);

    do_test_finished();
  }).
  catch(err => {
    Assert.equal(err, 1);
    do_test_finished();
  });
});
