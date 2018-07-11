/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("armor.jsm"); /*global EnigmailArmor: false */
component("enigmail/constants.jsm"); /*global EnigmailConstants: fales */

test(function shouldLocateEnigmailArmoredBlock() {
  const text = "    -----BEGIN PGP SIGNATURE-----\n" +
    "    Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n" +
    "    Comment: GPGTools - https://gpgtools.org\n" +
    "\n" +
    "    iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n" +
    "    6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n" +
    "    R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n" +
    "    95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n" +
    "    xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n" +
    "    9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n" +
    "    4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n" +
    "    yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n" +
    "    j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n" +
    "    kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n" +
    "    P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n" +
    "    o29CFuiGhiz3ISDRKrtH\n" +
    "    =MeaY\n" +
    "    -----END PGP SIGNATURE-----";
  const beginIndexObj = {};
  const endIndexObj = {};
  const indentStrObj = {};
  const indentStr = "";
  const blockType = EnigmailArmor.locateArmoredBlock(text, 0, indentStr, beginIndexObj, endIndexObj, indentStrObj);
  Assert.equal(0, beginIndexObj.value);
  Assert.equal("    ", indentStrObj.value);
  Assert.equal("SIGNATURE", blockType);
});

test(function shouldExtractSignaturePart() {
  const signature = {
    text: "Hello I'm here.\n please contact me via this email! \n",
    header: "Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n" +
      "Comment: GPGTools - https://gpgtools.org\n",
    armor: "iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n" +
      "6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n" +
      "R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n" +
      "95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n" +
      "xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n" +
      "9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n" +
      "4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n" +
      "yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n" +
      "j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n" +
      "kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n" +
      "P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n" +
      "o29CFuiGhiz3ISDRKrtH\n" +
      "=MeaY"
  };
  const signature_block = "\n\n" +
    signature.text +
    "-----BEGIN PGP SIGNATURE-----\n" +
    signature.header +
    "\n" +
    signature.armor +
    "\n" +
    "-----END PGP SIGNATURE-----";

  const signature_text = EnigmailArmor.extractSignaturePart(signature_block, EnigmailConstants.SIGNATURE_TEXT);
  const signature_headers = EnigmailArmor.extractSignaturePart(signature_block, EnigmailConstants.SIGNATURE_HEADERS);
  const signature_armor = EnigmailArmor.extractSignaturePart(signature_block, EnigmailConstants.SIGNATURE_ARMOR);
  Assert.equal(signature.text, signature_text);
  Assert.equal(signature.header, signature_headers);
  Assert.equal(signature.armor.replace(/\s*/g, ""), signature_armor);
});


test(function shouldGetArmorHeaders() {
  const text = "> -----BEGIN PGP SIGNATURE-----\n" +
    "> Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n" +
    "> Comment: GPGTools - https://gpgtools.org\n" +
    "> \n" +
    "> iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n" +
    "> 6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n" +
    "> R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n" +
    "> 95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n" +
    "> xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n" +
    "> 9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n" +
    "> 4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n" +
    "> yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n" +
    "> j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n" +
    "> kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n" +
    "> P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n" +
    "> o29CFuiGhiz3ISDRKrtH\n" +
    "> =MeaY\n" +
    "> -----END PGP SIGNATURE-----";

  let hdr = EnigmailArmor.getArmorHeaders(text);

  Assert.ok("version" in hdr);
  Assert.ok("comment" in hdr);
  Assert.equal(hdr.comment, "GPGTools - https://gpgtools.org");
});
