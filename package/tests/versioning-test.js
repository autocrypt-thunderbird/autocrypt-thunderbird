/*global testing: false, do_load_module: false, do_get_cwd: false, test: false, Assert:false, component: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, withEnigmail: false, withTestGpgHome: false */

testing("versioning.jsm"); /*global EnigmailVersioning: false, greaterThanOrEqual: false, createVersionRequest:false, versionFoundMeetsMinimumVersionRequired:false, greaterThan: false, lessThan: false */
component("enigmail/execution.jsm"); /*global EnigmailExecution:false */

test(function checkCurlVersionIsOver() {
  const curl749 = "curl 7.49.1 (x86_64-pc-linux-gnu) libcurl/7.49.1 OpenSSL/1.0.2h zlib/1.2.8 libidn/1.32 libssh2/1.7.0\n" +
    "Protocols: dict file ftp ftps gopher http https imap imaps pop3 pop3s rtsp scp sftp smb smbs smtp smtps telnet tftp\n" +
    "Features: AsynchDNS IDN IPv6 Largefile GSS-API Kerberos SPNEGO NTLM NTLM_WB SSL libz TLS-SRP UnixSockets\n";

  TestHelper.resetting(EnigmailExecution, "resolveAndSimpleExec", function() {
    return curl749;
  }, function() {
    const minimumCurlVersion = "7.21.7";
    Assert.equal(versionFoundMeetsMinimumVersionRequired("curl", minimumCurlVersion), true);
  });
});

test(function checkCurlVersionIsLess() {
  const curl749 = "curl 7.49.1 (x86_64-pc-linux-gnu) libcurl/7.49.1 OpenSSL/1.0.2h zlib/1.2.8 libidn/1.32 libssh2/1.7.0\n" +
    "Protocols: dict file ftp ftps gopher http https imap imaps pop3 pop3s rtsp scp sftp smb smbs smtp smtps telnet tftp\n" +
    "Features: AsynchDNS IDN IPv6 Largefile GSS-API Kerberos SPNEGO NTLM NTLM_WB SSL libz TLS-SRP UnixSockets\n";

  TestHelper.resetting(EnigmailExecution, "resolveAndSimpleExec", function() {
    return curl749;
  }, function() {
    const absurdlyHighCurlRequirement = "100.100.100";
    Assert.equal(versionFoundMeetsMinimumVersionRequired("curl", absurdlyHighCurlRequirement), false);
  });
});

test(function versionIsGreaterOrEqual() {
  Assert.equal(greaterThanOrEqual("7.12", "7.30"), false);
  Assert.equal(greaterThanOrEqual("7.12", "7.12"), true);
  Assert.equal(greaterThanOrEqual("7.12", "7.1"), true);
});

test(function versionIsGreater() {
  Assert.equal(greaterThan("1.1", "1.0"), true);
  Assert.equal(greaterThan("1.0", "1.0"), false);
  Assert.equal(greaterThan("1.0", "1.1"), false);
});

test(function versionIsLessThan() {
  Assert.equal(lessThan("1.1", "1.0"), false);
  Assert.equal(lessThan("1.0", "1.0"), false);
  Assert.equal(lessThan("1.0", "1.1"), true);
});
