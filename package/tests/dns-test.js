/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global Cu: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("dns.jsm");

/*global EnigmailDns: false, gHandler: true, gResolverExecutable: true */

/*global DigHandler: false, HostHandler: false, NsLookupHandler: false, NsLookupHandler_Windows: false, GenericHandler: false */

test(function testDig() {
  let h = new DigHandler(null);
  h.recordType = "MX";
  h.hostName = "enigmail.net";

  let a = h.getCmdArgs();
  Assert.equal(a.join(" "), "-t MX +short enigmail.net", "dig parameters don't match");

  let stdoutData = "10 mx2.mail.hostpoint.ch.\n10 mx1.mail.hostpoint.ch.\n";

  let srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "mx2.mail.hostpoint.ch|mx1.mail.hostpoint.ch");

  h.recordType = "SRV";
  stdoutData = "10 100 4711 t1.enigmail.net.\n10 100 4712 t2.enigmail.net.\n";

  srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "t1.enigmail.net:4711|t2.enigmail.net:4712");
});

test(function testHost() {
  let h = new HostHandler(null);
  h.recordType = "MX";
  h.hostName = "enigmail.net";

  let a = h.getCmdArgs();
  Assert.equal(a.join(" "), "-t MX enigmail.net", "host parameters don't match");

  let stdoutData = "enigmail.net mail is handled by 10 mx2.mail.hostpoint.ch.\nenigmail.net mail is handled by 10 mx1.mail.hostpoint.ch.\n";

  let srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "mx2.mail.hostpoint.ch|mx1.mail.hostpoint.ch");

  h.recordType = "SRV";
  stdoutData = "enigmail.net has SRV record 10 100 4711 t1.enigmail.net.\nenigmail.net has SRV record 10 100 4712 t2.enigmail.net.\n";

  srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "t1.enigmail.net:4711|t2.enigmail.net:4712");

});

test(function testNsLookup() {
  let h = new NsLookupHandler(null);
  h.recordType = "MX";
  h.hostName = "enigmail.net";

  let a = h.getCmdArgs();
  Assert.equal(a.join(" "), "-type=MX enigmail.net", "nslookup parameters don't match");

  let stdoutData =
    `Server:		172.17.28.1
Address:	172.17.28.1#53

Non-authoritative answer:
enigmail.net\tmail exchanger = 10 mx2.mail.hostpoint.ch.
enigmail.net\tmail exchanger = 10 mx1.mail.hostpoint.ch.

Authoritative answers can be found from:
.	nameserver = h.root-servers.net.
.	nameserver = g.root-servers.net.
.	nameserver = d.root-servers.net.
`;

  let srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "mx2.mail.hostpoint.ch|mx1.mail.hostpoint.ch");

  h.recordType = "SRV";
  stdoutData =
    `Server:		172.17.28.1
Address:	172.17.28.1#53

Non-authoritative answer:
_http._tcp.enigmail.net	service = 10 100 4711 t1.enigmail.net.
_http._tcp.enigmail.net	service = 10 100 4712 t2.enigmail.net.

Authoritative answers can be found from:
enigmail.net	nameserver = example1.invalid.
enigmail.net	nameserver = example1.invalid.
`;

  srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "t1.enigmail.net:4711|t2.enigmail.net:4712");
});


test(function testNsLookupWin() {
  let h = new NsLookupHandler_Windows(null);
  h.recordType = "MX";
  h.hostName = "enigmail.net";

  let a = h.getCmdArgs();
  Assert.equal(a.join(" "), "-type=MX enigmail.net", "nslookup parameters don't match");

  let stdoutData =
    `Server:  UnKnown
Address:  172.17.28.1

enigmail.net\tMX preference = 10, mail exchanger = mx2.mail.hostpoint.ch
enigmail.net\tMX preference = 10, mail exchanger = mx1.mail.hostpoint.ch

(root)	nameserver = c.root-servers.net
(root)	nameserver = a.root-servers.net
`;

  let srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "mx2.mail.hostpoint.ch|mx1.mail.hostpoint.ch");

  h.recordType = "SRV";
  stdoutData =
    `Server:  UnKnown
Address:  172.17.28.1

wkd.enigmail.org	SRV service location:
\tpriority       = 100
\tweight         = 100
\tport           = 4711
\tsvr hostname   = t1.enigmail.net
wkd.enigmail.org	SRV service location:
\tpriority       = 100
\tweight         = 100
\tport           = 4712
\tsvr hostname   = t2.enigmail.net

(root)	nameserver = i.root-servers.net
(root)	nameserver = h.root-servers.net
(root)	nameserver = k.root-servers.net
`;

  srv = h.parseResult(stdoutData);
  Assert.equal(srv.join("|"), "t1.enigmail.net:4711|t2.enigmail.net:4712");
});
test(function testExecute() {
  class TestHandler extends GenericHandler {
    constructor() {
      let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);

      let plPath = env.get("PL_PATH");
      Assert.ok(plPath.length > 0, "PL_PATH length is > 0");
      if (plPath.length === 0) throw "perl path undefined";

      super(plPath);
      this.handlerType = "test";
    }

    getCmdArgs() {
      let tinyPl = do_get_file("resources/tiny.pl", false);
      return [tinyPl.path];
    }

    parseResult(stdoutData) {
      Assert.equal(stdoutData.search(/^OK/), 0);
      return 0;
    }
  }

  let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(Ci.nsIJSInspector);

  gHandler = TestHandler;
  EnigmailDns.lookup("mx", "enigmail.net").then(x => {
    inspector.exitNestedEventLoop();
  }).catch(x => {
    Assert.ok(false, `Got exception ${x}`);
    inspector.exitNestedEventLoop();
  });

  inspector.enterNestedEventLoop(0);
});
