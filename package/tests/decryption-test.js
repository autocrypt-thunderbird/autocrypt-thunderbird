/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("decryption.jsm"); /*global EnigmailDecryption: false */
component("enigmail/keyRing.jsm"); /*global EnigmailKeyRing: fales */
component("enigmail/armor.jsm"); /*global EnigmailArmor: fales */
component("enigmail/constants.jsm"); /*global EnigmailConstants: fales */

test(withTestGpgHome(withEnigmail(function shouldDecryptMessage() {
  let secretKeyFile = do_get_file("resources", false);
  secretKeyFile.append("dev-strike.sec");
  const importedKeysObj = {};
  let r = EnigmailKeyRing.importKeyFromFile(secretKeyFile, {}, importedKeysObj);
  Assert.equal(0, r);
  var encryptResult = "-----BEGIN PGP MESSAGE-----\n" +
    "Version: GnuPG v2.0.22 (GNU/Linux)\n" +
    "\n" +
    "hQIMA9U1Yju2Dp5xAQ//eeoS38nAWPdJslfVaEuUhthZk4WxAua97+JNGX9vDiae\n" +
    "jKJbjmQ5T2Sl2wvSqwjEIKzzjRAzr6SYuL9xaRkt3/BbMpSm/aSjc/cWNgcKtbHt\n" +
    "u8u9Ha016XZke3/EpjLqMcXmK1eT9oa+UqR8u+B3ggOjz5BrjW+FMR+zfyiWv1cb\n" +
    "6U4KO0YHuOq7G0lO4i3ro0ckhzZqCBLfCiQSfnF8R7p/KfQdUFBIdB41OALP0q4x\n" +
    "UD+CNWhbIjyhfE0VX5KUn/5S5Se31VjKjfeo+5fN8HRUVQYu8uj2F+gPvALF5KKW\n" +
    "an63O3IcUvZo6yOSoMjkMVJBHZRY6An2if+GXm330yQD3CDaonuihR+e+k6sd0kj\n" +
    "hpwQs+4/uE96slRMqQMx573krc/p/WUWwG5qexOvwxzcqEdE5LYPEMKdH1fUX3tC\n" +
    "kktNpSU8gJqluTk6cvtjCfMSwcEyKFmM13/RoitAw22DVOdLlcTHxbaNsIoxeRk/\n" +
    "rxpsraIEs2H4uyF19K1nLioGkyubeUKPnBTB6qAwp0ZhZ1RleMwHRTFQU+jpbi51\n" +
    "t87E+JI0UuLd14pDb7YJUKenHvAqa1jHAZKEfa2XFMfT/1MZzohlwjNpcPhYFWeB\n" +
    "zq3cg/m/J5sb+FpdD42nfYnLsSYu7CwcTX8MU2vrSwHyHnmux6SjDXGrAaddWsrS\n" +
    "RwGvjZsiFW/E82l2eMj5Zpm6HXY8kZx9TBSbWLSgU44nBhDvX1MrIGdd+rmYT2xt\n" +
    "j4KAKpyV51VzmJUOqHrb7bPv70ncMx0w\n" +
    "=uadZ\n" +
    "-----END PGP MESSAGE-----\n\n";

  const parentWindow = JSUnit.createStubWindow();
  const exitCodeObj = {};
  const statusFlagObj = {};
  const errorMsgObj = {};
  const decryptResult = EnigmailDecryption.decryptMessage(parentWindow,
    EnigmailConstants.UI_TEST,
    encryptResult, {},
    exitCodeObj,
    statusFlagObj, {}, {}, {},
    errorMsgObj, {}, {},
    "STRIKEfreedom@Qu1to"
  );
  Assert.equal(0, exitCodeObj.value);
  Assert.equal(0, errorMsgObj.value);
  Assert.equal("Hello there!", decryptResult);
  Assert.equal(true, (statusFlagObj.value & (EnigmailConstants.DISPLAY_MESSAGE | EnigmailConstants.DECRYPTION_OKAY)) !== 0);
  const blockType = EnigmailArmor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
  Assert.equal("MESSAGE", blockType);
})));
