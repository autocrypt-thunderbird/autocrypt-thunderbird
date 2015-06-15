/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, App: false */
/*global Rules: false, rulesListHolder: false, EC: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("rules.jsm");

// getRulesFile
test(function getRulesFileReturnsTheFile() {
    Rules.clearRules();
    Assert.equal(App.getProfileDirectory().path + "/pgprules.xml", Rules.getRulesFile().path);
});

// loadRulesFile
test(function loadRulesFileReturnsFalseIfNoRulesFileExists() {
    Rules.clearRules();
    var result = Rules.loadRulesFile();
    Assert.ok(!result);
});

test(function loadRulesFileReturnsFalseIfTheFileExistsButIsEmpty() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/emptyRules.xml", false);
    }, function() {
        var result = Rules.loadRulesFile();
        Assert.ok(!result);
    });
});

test(function loadRulesFileReturnsTrueIfTheFileExists() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        var result = Rules.loadRulesFile();
        Assert.ok(result);
    });
});

function xmlToData(x) {
    var result = [];
    var node = x.firstChild.firstChild;
    while(node) {
        let name = node.tagName;
        let res = {tagName: name};
        if(name) {
            let attrs = node.attributes;
            for(let i = 0; i < attrs.length; i++) {
                res[attrs[i].name] = attrs[i].value;
            }
            result.push(res);
        }
        node = node.nextSibling;
    }
    return result;
}

test(function loadRulesFileSetsRulesBasedOnTheFile() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        Rules.loadRulesFile();
        var d = xmlToData(rulesListHolder.rulesList);
        var expected = [
            {tagName: "pgpRule",
             email: "{user1@some.domain}",
             keyId: "0x1234ABCD",
             sign: "1",
             encrypt: "1",
             pgpMime: "1"},
            {tagName: "pgpRule",
             email: "user2@some.domain",
             keyId: "0x1234ABCE",
             sign: "2",
             encrypt: "1",
             pgpMime: "0"}
        ];
        Assert.deepEqual(expected, d);
    });
});

// getRulesData
test(function getRulesDataReturnsFalseAndNullIfNoRulesExist() {
    Rules.clearRules();
    var res = {};
    var ret = Rules.getRulesData(res);
    Assert.ok(!ret);
    Assert.equal(null, res.value);
});

test(function getRulesDataReturnsTrueAndTheRulesListIfExist() {
    Rules.clearRules();
    resetting(Rules, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        var res = {};
        var ret = Rules.getRulesData(res);
        Assert.ok(ret);
        Assert.equal(rulesListHolder.rulesList, res.value);
    });
});
