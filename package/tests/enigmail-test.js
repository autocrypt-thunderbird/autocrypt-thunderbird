/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


function run_test() {
    var md = do_get_cwd().parent;
    md.append("enigmail.js");
    do_load_module("file://" + md.path);
    shouldNotUseGpgAgent_test();
    shouldUseGpgAgent_test();
    shouldLocateArmoredBlock_test();
    shouldExtractSignaturePart_test();
    shouldGetKeyDetails_test();
}

function shouldNotUseGpgAgent_test() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    var isuseGpgAgent = enigmail.useGpgAgent();
    Assert.equal(false, isuseGpgAgent);
}

function initalizeService(enigmail) {
    window = JSUnit.createStubWindow();
    enigmail.initialize(window, "", EnigmailCore.prefBranch);
    return enigmail;
}

function shouldUseGpgAgent_test() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    Assert.equal(true, enigmail.useGpgAgent());
}

function shouldLocateArmoredBlock_test() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    var text = ""
        + "    -----BEGIN PGP SIGNATURE-----\n"
        + "    Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n"
        + "    Comment: GPGTools - https://gpgtools.org\n"
        + "\n"
        + "    iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n"
        + "    6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n"
        + "    R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n"
        + "    95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n"
        + "    xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n"
        + "    9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n"
        + "    4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n"
        + "    yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n"
        + "    j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n"
        + "    kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n"
        + "    P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n"
        + "    o29CFuiGhiz3ISDRKrtH\n"
        + "    =MeaY\n"
        + "    -----END PGP SIGNATURE-----";
    var beginIndexObj = {};
    var endIndexObj = {};
    var indentStrObj = {};
    var indentStr = "";
    var blockType = enigmail.locateArmoredBlock(text, 0, indentStr, beginIndexObj, endIndexObj, indentStrObj);
    Assert.equal(0, beginIndexObj.value);
    Assert.equal("    ", indentStrObj.value);
    Assert.equal("SIGNATURE", blockType);
}

function shouldExtractSignaturePart_test() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    const signature = {
        text: "Hello I'm here.\n please contact me via this email! \n",
        header: "Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n"
        + "Comment: GPGTools - https://gpgtools.org\n",
        armor: "iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n"
        + "6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n"
        + "R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n"
        + "95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n"
        + "xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n"
        + "9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n"
        + "4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n"
        + "yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n"
        + "j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n"
        + "kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n"
        + "P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n"
        + "o29CFuiGhiz3ISDRKrtH\n"
        + "=MeaY"
    };
    var signature_block = "\n\n"
        + signature.text
        + "-----BEGIN PGP SIGNATURE-----\n"
        + signature.header
        + "\n"
        + signature.armor
        + "\n"
        + "-----END PGP SIGNATURE-----";

    var signature_text = enigmail.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_TEXT);
    var signature_headers = enigmail.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_HEADERS);
    var signature_armor = enigmail.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_ARMOR);
    Assert.equal(signature.text, signature_text);
    Assert.equal(signature.header, signature_headers);
    Assert.equal(signature.armor.replace(/\s*/g, ""), signature_armor);
}

function shouldGetKeyDetails_test() {
    do_print("testing should get key details ");
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    EC.setLogLevel(5);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    var importResult = enigmail.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    Assert.equal(importResult, 0, errorMsgObj);
    var keyDetails = enigmail.getKeyDetails("0xD535623BB60E9E71", false, true);
    Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
}

Assert.assertContains =  function(actual, expected, message) {
    var msg = message || "Searching for <".concat(expected).concat("> to be contained within actual string.");
    Assert.equal(actual.search(expected) > -1, true, msg);
};
