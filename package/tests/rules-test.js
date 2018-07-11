/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, EnigmailApp: false */
/*global component: false, withTestGpgHome: false, withEnigmail: false */
/*global EnigmailRules: false, rulesListHolder: false, EC: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("rules.jsm");
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: false */

// getRulesFile
test(function getRulesFileReturnsTheFile() {
  EnigmailRules.clearRules();
  let profD = EnigmailApp.getProfileDirectory().clone();
  profD.append("pgprules.xml");
  Assert.equal(profD.path, EnigmailRules.getRulesFile().path);
});

// loadRulesFile
test(function loadRulesFileReturnsFalseIfNoRulesFileExists() {
  EnigmailRules.clearRules();
  var result = EnigmailRules.loadRulesFile();
  Assert.ok(!result);
});

test(function loadRulesFileReturnsFalseIfTheFileExistsButIsEmpty() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/emptyRules.xml", false);
  }, function() {
    var result = EnigmailRules.loadRulesFile();
    Assert.ok(!result);
  });
});

test(function loadRulesFileReturnsTrueIfTheFileExists() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules.xml", false);
  }, function() {
    var result = EnigmailRules.loadRulesFile();
    Assert.ok(result);
  });
});

function xmlToData(x) {
  var result = [];
  var node = x.firstChild.firstChild;
  while (node) {
    let name = node.tagName;
    let res = {
      tagName: name
    };
    if (name) {
      let attrs = node.attributes;
      for (let i = 0; i < attrs.length; i++) {
        res[attrs[i].name] = attrs[i].value;
      }
      result.push(res);
    }
    node = node.nextSibling;
  }
  return result;
}

test(function loadRulesFileSetsRulesBasedOnTheFile() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    var d = xmlToData(rulesListHolder.rulesList);
    var expected = [{
      tagName: "pgpRule",
      email: "{user1@some.domain}",
      keyId: "0x1234ABCD",
      sign: "1",
      encrypt: "1",
      pgpMime: "1"
    }, {
      tagName: "pgpRule",
      email: "user2@some.domain",
      keyId: "0x1234ABCE",
      sign: "2",
      encrypt: "1",
      pgpMime: "0"
    }];
    Assert.deepEqual(expected, d);
  });
});

// getRulesData
test(function getRulesDataReturnsFalseAndNullIfNoRulesExist() {
  EnigmailRules.clearRules();
  var res = {};
  var ret = EnigmailRules.getRulesData(res);
  Assert.ok(!ret);
  Assert.equal(null, res.value);
});

test(function getRulesDataReturnsTrueAndTheRulesListIfExist() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules.xml", false);
  }, function() {
    var res = {};
    var ret = EnigmailRules.getRulesData(res);
    Assert.ok(ret);
    Assert.equal(rulesListHolder.rulesList, res.value);
  });
});


// *****************************************************
// test mapAddrsToKeys():
// *****************************************************

var EnigmailRulesTests = {
  testSingleEmailToKeys(addr, arg2, arg3) {
    // second argument is optional (extracted addr from initial addr)
    let expVal;
    let expAddr;
    if (typeof(arg3) === 'undefined') {
      expAddr = addr;
      expVal = arg2;
    }
    else {
      expAddr = arg2;
      expVal = arg3;
    }
    // perform test:
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(addr,
      false, null, matchedKeysRet, flagsRet);
    Assert.ok(ret);
    let expKL = [{
      orig: addr,
      addr: expAddr,
      keys: expVal
    }];
    Assert.deepEqual(matchedKeysRet.addrKeysList, expKL);
    Assert.equal(matchedKeysRet.value, expVal);
  }
};

test(withTestGpgHome(withEnigmail(function mapAddrsToKeys_simpleFlags() {
  importKeys();
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let matchedKeysRet = {};
    let flagsRet = {};

    EnigmailRules.mapAddrsToKeys("sign@some.domain", false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "2",
      encrypt: "1",
      pgpMime: "1"
    };
    Assert.deepEqual(expectedFlags, flagsRet);

    EnigmailRules.mapAddrsToKeys("nosign@some.domain", false, null, matchedKeysRet, flagsRet);
    expectedFlags = {
      value: true,
      sign: "0",
      encrypt: "1",
      pgpMime: "1"
    };
    Assert.deepEqual(expectedFlags, flagsRet);

    EnigmailRules.mapAddrsToKeys("encrypt@some.domain", false, null, matchedKeysRet, flagsRet);
    expectedFlags = {
      value: true,
      sign: "1",
      encrypt: "2",
      pgpMime: "1"
    };
    Assert.deepEqual(expectedFlags, flagsRet);

    EnigmailRules.mapAddrsToKeys("noencrypt@some.domain", false, null, matchedKeysRet, flagsRet);
    expectedFlags = {
      value: true,
      sign: "1",
      encrypt: "0",
      pgpMime: "1"
    };
    Assert.deepEqual(expectedFlags, flagsRet);
  });
})));

test(withEnigmail(function mapAddrsToKeys_signAndEncrypt() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let emailAddrs = "sign@some.domain, encrypt@some.domain";
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(emailAddrs, false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "2",
      encrypt: "2",
      pgpMime: "1"
    };
    let expectedKeys = {
      value: "", // no matching key means no value
      addrKeysList: [],
      addrNoKeyList: [{
        orig: "sign@some.domain",
        addr: "sign@some.domain"
      }, {
        orig: "encrypt@some.domain",
        addr: "encrypt@some.domain"
      }]
    };
    Assert.ok(ret);
    Assert.deepEqual(expectedFlags, flagsRet);
    Assert.deepEqual(expectedKeys, matchedKeysRet);
  });
}));

test(withEnigmail(function mapAddrsToKeys_conflict() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let emailAddrs = "sign@some.domain, noencrypt@some.domain, nosign@some.domain, encrypt@some.domain";
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(emailAddrs, false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "99",
      encrypt: "99",
      pgpMime: "1"
    };
    let expectedKeys = {
      value: "", // no matching key means no value
      addrKeysList: [],
      addrNoKeyList: [{
        orig: "sign@some.domain",
        addr: "sign@some.domain"
      }, {
        orig: "noencrypt@some.domain",
        addr: "noencrypt@some.domain"
      }, {
        orig: "nosign@some.domain",
        addr: "nosign@some.domain"
      }, {
        orig: "encrypt@some.domain",
        addr: "encrypt@some.domain"
      }]
    };
    Assert.ok(ret);
    Assert.deepEqual(expectedFlags, flagsRet);
    Assert.deepEqual(expectedKeys, matchedKeysRet);
  });
}));

test(withEnigmail(function mapAddrsToKeys_twoKeysAndNoKey() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let emailAddrs = "two@some.domain, nokey@qqq.domain";
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(emailAddrs, false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "1",
      encrypt: "1",
      pgpMime: "1"
    };
    let expectedKeys = {
      value: "0x2222aaaa, 0x2222bbbb, nokey@qqq.domain",
      addrKeysList: [{
        orig: "two@some.domain",
        addr: "two@some.domain",
        keys: "0x2222aaaa, 0x2222bbbb"
      }],
      addrNoKeyList: [{
        orig: "nokey@qqq.domain",
        addr: "nokey@qqq.domain"
      }]
    };
    Assert.ok(ret);
    Assert.deepEqual(expectedFlags, flagsRet);
    Assert.deepEqual(expectedKeys, matchedKeysRet);
  });
}));

test(withEnigmail(function mapAddrsToKeys_noKeyAndSomeKeysReverse() { // important to test reverse order than in rules
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let emailAddrs = "nokey@qqq.domain, two@some.domain, one@some.domain";
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(emailAddrs, false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "1",
      encrypt: "1",
      pgpMime: "1"
    };
    let expectedKeys = {
      value: "0x11111111, 0x2222aaaa, 0x2222bbbb, nokey@qqq.domain",
      addrKeysList: [{
        orig: "one@some.domain",
        addr: "one@some.domain",
        keys: "0x11111111"
      }, {
        orig: "two@some.domain",
        addr: "two@some.domain",
        keys: "0x2222aaaa, 0x2222bbbb"
      }],
      addrNoKeyList: [{
        orig: "nokey@qqq.domain",
        addr: "nokey@qqq.domain"
      }]
    };
    Assert.ok(ret);
    Assert.deepEqual(expectedFlags, flagsRet);
    Assert.deepEqual(expectedKeys, matchedKeysRet);
  });
}));

test(withEnigmail(function mapAddrsToKeys_spaces() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let emailAddrs = "    ,,oneRule,;;; , ;";
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(emailAddrs, false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "1",
      encrypt: "1",
      pgpMime: "1"
    };
    let expectedKeys = {
      value: "",
      addrKeysList: [],
      addrNoKeyList: [{
        orig: "oneRule",
        addr: "onerule"
      }]
    };
    Assert.ok(ret);
    Assert.deepEqual(expectedFlags, flagsRet);
    Assert.deepEqual(expectedKeys, matchedKeysRet);
  });
}));

test(withEnigmail(function mapAddrsToKeys_manyKeys() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let emailAddrs = "one@some.domain, two@some.domain, nokey@qqq.domain, nosign@some.domain, nofurtherrules@some.domain, nofurtherrules2@some.domain";
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(emailAddrs, false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "0",
      encrypt: "1",
      pgpMime: "99"
    };
    let expectedKeys = {
      value: "0x11111111, 0x2222aaaa, 0x2222bbbb, nofurtherrules@some.domain, nofurtherrules2@some.domain, nokey@qqq.domain, nosign@some.domain",
      addrKeysList: [{
        orig: "one@some.domain",
        addr: "one@some.domain",
        keys: "0x11111111"
      }, {
        orig: "two@some.domain",
        addr: "two@some.domain",
        keys: "0x2222aaaa, 0x2222bbbb"
      }],
      addrNoKeyList: [{
        orig: "nofurtherrules@some.domain",
        addr: "nofurtherrules@some.domain"
      }, {
        orig: "nofurtherrules2@some.domain",
        addr: "nofurtherrules2@some.domain"
      }, {
        orig: "nokey@qqq.domain",
        addr: "nokey@qqq.domain"
      }, {
        orig: "nosign@some.domain",
        addr: "nosign@some.domain"
      }]
    };
    Assert.ok(ret);
    Assert.deepEqual(expectedFlags, flagsRet);
    Assert.deepEqual(expectedKeys, matchedKeysRet);
    Assert.deepEqual(expectedKeys.value, matchedKeysRet.value);
    Assert.deepEqual(expectedKeys.addrKeysList, matchedKeysRet.addrKeysList);
    Assert.deepEqual(expectedKeys.addrNoKeyList, matchedKeysRet.addrNoKeyList);
  });
}));

test(withEnigmail(function mapAddrsToKeys_multipleMatches() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    let emailAddrs = "one@some.domain, nico@xx.com, patrick@xx.com, one@some.domain";
    let matchedKeysRet = {};
    let flagsRet = {};
    let ret = EnigmailRules.mapAddrsToKeys(emailAddrs, false, null, matchedKeysRet, flagsRet);
    let expectedFlags = {
      value: true,
      sign: "1",
      encrypt: "1",
      pgpMime: "1"
    };
    let expectedKeys = {
      value: "0x11111111, 0x11111111, 0xDOTCOMORDOTDE, 0xDOTCOMORDOTDE",
      addrKeysList: [{
        orig: "one@some.domain",
        addr: "one@some.domain",
        keys: "0x11111111"
      }, {
        orig: "one@some.domain",
        addr: "one@some.domain",
        keys: "0x11111111"
      }, {
        orig: "nico@xx.com",
        addr: "nico@xx.com",
        keys: "0xDOTCOMORDOTDE"
      }, {
        orig: "patrick@xx.com",
        addr: "patrick@xx.com",
        keys: "0xDOTCOMORDOTDE"
      }],
      addrNoKeyList: []
    };
    Assert.ok(ret);
    Assert.deepEqual(expectedFlags, flagsRet);
    Assert.deepEqual(expectedKeys, matchedKeysRet);
    //Assert.deepEqual(expectedKeys.value, matchedKeysRet.value);
    //Assert.deepEqual(expectedKeys.addrNoKeyList, matchedKeysRet.addrNoKeyList);
    //Assert.deepEqual(expectedKeys.addrKeysList, matchedKeysRet.addrKeysList);
    //Assert.deepEqual(expectedKeys.addrKeysList[0], matchedKeysRet.addrKeysList[0]);
    //Assert.deepEqual(expectedKeys.addrKeysList[1], matchedKeysRet.addrKeysList[1]);
    //Assert.deepEqual(expectedKeys.addrKeysList[2], matchedKeysRet.addrKeysList[2]);
    //Assert.deepEqual(expectedKeys.addrKeysList[3], matchedKeysRet.addrKeysList[3]);
  });
}));

test(withEnigmail(function mapAddrsToKeys_infix() {
  EnigmailRules.clearRules();
  resetting(EnigmailRules, 'getRulesFile', function() {
    return do_get_file("resources/rules2.xml", false);
  }, function() {
    EnigmailRules.loadRulesFile();
    EnigmailRulesTests.testSingleEmailToKeys("company@suffix.qqq",
      "0xCOMPREFIX");
    EnigmailRulesTests.testSingleEmailToKeys("hello@computer.qqq",
      "0xCOMINFIX");
    EnigmailRulesTests.testSingleEmailToKeys("hello@komputer.dcom",
      "0xCOMSUFFIX");
    EnigmailRulesTests.testSingleEmailToKeys("company@postfix.dcom",
      "0xCOMSUFFIX");
    EnigmailRulesTests.testSingleEmailToKeys("company@postfix.com",
      "0xDOTCOMORDOTDE");
    EnigmailRulesTests.testSingleEmailToKeys("hello@komputer.de",
      "0xDOTCOMORDOTDE");
    EnigmailRulesTests.testSingleEmailToKeys("aa@qqq.domain",
      "0xAAAAAAAA, 0xBBBBBBBB");
    EnigmailRulesTests.testSingleEmailToKeys("xx@qqq.bb",
      "0xAAAAAAAA, 0xBBBBBBBB");
    EnigmailRulesTests.testSingleEmailToKeys("aa@qqq.bb",
      "0xAAAAAAAA, 0xBBBBBBBB");
    EnigmailRulesTests.testSingleEmailToKeys("hello@komputer.DE",
      "hello@komputer.de",
      "0xDOTCOMORDOTDE");
    EnigmailRulesTests.testSingleEmailToKeys("xx@qqq.BB",
      "xx@qqq.bb",
      "0xAAAAAAAA, 0xBBBBBBBB");
  });
}));


function importKeys() {
  var publicKey = do_get_file("resources/dev-strike.asc", false);
  //var secretKey = do_get_file("resources/dev-strike.sec", false);
  var errorMsgObj = {};
  var importedKeysObj = {};
  var publicImportResult = EnigmailKeyRing.importKeyFromFile(publicKey, errorMsgObj, importedKeysObj);
  //  var secretImportResult = EnigmailKeyRing.importKeyFromFile(secretKey, errorMsgObj, importedKeysObj);
  return [publicImportResult /*, secretImportResult */ ];
}
