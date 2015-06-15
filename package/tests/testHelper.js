/*global do_load_module: false, do_get_cwd: false, Components: false, Assert: false,  CustomAssert: false, FileUtils: false, JSUnit: false, Files: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const osUtils = {};
Components.utils.import("resource://gre/modules/osfile.jsm", osUtils);
Components.utils.import("resource://gre/modules/FileUtils.jsm", osUtils);

var TestHelper = {
    loadDirectly: function(name) {
        do_load_module("file://" + do_get_cwd().parent.path + "/" + name);
    },

    loadModule: function(name) {
        Components.utils.import("resource://" + name);
    },

    testing: function(name) {
        TestHelper.currentlyTesting = name;
    },

    registerTest: function(fn) {
        TestHelper.allTests = TestHelper.allTests || [];
        TestHelper.allTests.push(fn);
    },

    resetting: function(on, prop, val, f) {
        let orgVal = on[prop];
        on[prop] = val;
        try {
            return f();
        } finally {
            on[prop] = orgVal;
        }
    },

    runTests: function() {
        if(TestHelper.currentlyTesting) {
            TestHelper.loadDirectly(TestHelper.currentlyTesting);
        }
        if(TestHelper.allTests) {
            for(var i=0; i < TestHelper.allTests.length; i++) {
                TestHelper.allTests[i]();
            }
        }
    },

    initalizeGpgHome: function() {
        component("enigmail/files.jsm");
        var homedir = osUtils.OS.Path.join(Files.getTempDir(), ".gnupgTest");
        var workingDirectory = new osUtils.FileUtils.File(homedir);
        if (!workingDirectory.exists()) {
            workingDirectory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 448);
        }

        var file = workingDirectory.clone();
        file.append("gpg-agent.conf");
        if (!file.exists()) {
            file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 384);
        }
        var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
            createInstance(Components.interfaces.nsIFileOutputStream);
        foStream.init(file, 0x02 | 0x08 | 0x20, 384, 0);
        var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
            createInstance(Components.interfaces.nsIConverterOutputStream);
        converter.init(foStream, "UTF-8", 0, 0);
        converter.writeString("pinentry-program "+do_get_cwd().path+"/pinentry-auto");
        converter.close();

        var environment = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);

        environment.set("GNUPGHOME", workingDirectory.path);
        return homedir;
    },

    removeGpgHome: function(homedir){
        var workingDirectory = new osUtils.FileUtils.File(homedir);
        if(workingDirectory.exists()) workingDirectory.remove(true);
    }
};

TestHelper.loadDirectly("tests/customAssert.jsm");

var testing = TestHelper.testing;
var component = TestHelper.loadModule;
var run_test = TestHelper.runTests;
var test = TestHelper.registerTest;
var resetting = TestHelper.resetting;
var initalizeGpgHome = TestHelper.initalizeGpgHome;
var removeGpgHome = TestHelper.removeGpgHome;

function withEnvironment(vals, f) {
    var environment = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
    var oldVals = {};
    for(let key in vals) {
        oldVals[key] = environment.get(key);
        environment.set(key, vals[key]);
    }
    try {
        return f(environment);
    } finally {
        for(let key in oldVals) {
            environment.set(key, oldVals[key]);
        }
    }
}

function withTestGpgHome(f){
    return function(){
        const homedir = initalizeGpgHome();
        try{
            f();
        } finally {
            removeGpgHome(homedir);
        }
    };
}

Components.utils.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
function withEnigmail(f) {
    return function() {
        try {
            const enigmail = Components.classes["@mozdev.org/enigmail/enigmail;1"].
                      createInstance(Components.interfaces.nsIEnigmail);
            const window = JSUnit.createStubWindow();
            enigmail.initialize(window, "");
            return f(EnigmailCore.getEnigmailService(), window);
        } finally {
            EnigmailCore.setEnigmailService(null);
        }
    };
}

CustomAssert.registerExtraAssertionsOn(Assert);
