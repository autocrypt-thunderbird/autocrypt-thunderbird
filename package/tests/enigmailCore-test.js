/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


function run_test() {

    var md = do_get_cwd().parent;
    md.append("enigmailCore.jsm");
    do_load_module("file://" + md.path);
    shouldReadProperty_test();
    shouldSetGetPreference_test()
    shouldCreateLogFile_test()
}

function shouldReadProperty_test() {
    var importBtnProp = "enigHeader";
    var importBtnValue = EnigmailCore.getString(importBtnProp);
    Assert.equal("Enigmail:", importBtnValue);
}

function shouldSetGetPreference_test() {
    var prefName = "mypref";
    EnigmailCore.setPref(prefName, "yourpref");
    Assert.equal("yourpref", EnigmailCore.getPref(prefName));
}

function shouldCreateLogFile_test() {
    EnigmailCore.setLogDirectory(do_get_cwd().path);
    EnigmailCore.setLogLevel(5);
    EnigmailCore.createLogFiles();
    var filePath = EnigmailCore._logDirectory + "enigdbug.txt";
    var localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
    initPath(localFile, filePath);

    Assert.equal(localFile.exists(), true);
    if (localFile.exists()) {
        localFile.remove(false)
    }
}
