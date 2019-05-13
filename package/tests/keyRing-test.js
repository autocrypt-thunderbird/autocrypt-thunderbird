/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, */
/*global Components: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* eslint no-useless-concat: 0*/
"use strict";

/*global EnigmailFiles: false */
do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false, gKeyListObj: true */

let GnuPGKeyList = {};
do_load_module("chrome://enigmail/content/modules/cryptoAPI/gnupg-keylist.jsm", GnuPGKeyList); /*global appendKeyItems: false */
/*global createAndSortKeyList: false */

testing("keyRing.jsm"); /*global EnigmailKeyRing: false, EnigmailTrust: false, EnigmailLocale: false */

test(withTestGpgHome(withEnigmail(function shouldImportFromFileAndGetKeyDetails() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const errorMsgObj = {};
  const importedKeysObj = {};
  const importResult = EnigmailKeyRing.importKeyFromFile(publicKey, errorMsgObj, importedKeysObj);
  Assert.assertContains(importedKeysObj.value, "65537E212DC19025AD38EDB2781617319CE311C4");
  Assert.equal(importResult, 0, errorMsgObj);
  const keyDetails = EnigmailKeyRing.getValidUids("0xD535623BB60E9E71").join("\n");
  Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
})));


test(withTestGpgHome(withEnigmail(function shouldGetKeyFunctions() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(secretKey, {}, {});

  // search for key ID
  let k = EnigmailKeyRing.getKeyById("0x9CE311C4");
  Assert.equal(k.subKeys[0].keyId, "D535623BB60E9E71");

  // search for subkey ID
  k = EnigmailKeyRing.getKeyById("0xD535623BB60E9E71");
  Assert.equal(k.fpr, "65537E212DC19025AD38EDB2781617319CE311C4");

  Assert.equal(gKeyListObj.keySortList.length, 1);
  EnigmailKeyRing.clearCache();
  Assert.equal(gKeyListObj.keySortList.length, 0);

  // search for fingerprint
  k = EnigmailKeyRing.getKeyById("65537E212DC19025AD38EDB2781617319CE311C4");
  Assert.equal(k.fpr, "65537E212DC19025AD38EDB2781617319CE311C4");
  Assert.equal(k._sigList, null);

  let s = k.signatures;

  let fpr = "DB54FB278F6AE719DE0DE881B17D4C762F5752A9";
  Assert.equal(fpr in s, true);
  if (fpr in s) {
    Assert.equal(s[fpr].sigList[0].signerKeyId, "781617319CE311C4");
  }

  let ka = EnigmailKeyRing.getKeysByUserId("devtest@gmail.com>$");
  Assert.equal(ka.length, 1);

  ka = EnigmailKeyRing.getAllSecretKeys();
  Assert.equal(ka.length, 1);

  ka = EnigmailKeyRing.getKeyListById("0x9CE311C4 D535623BB60E9E71"); // the space is on purpose(!)
  Assert.equal(ka.length, 2);
})));

test(withTestGpgHome(withEnigmail(function shouldCleanupClearCache() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(secretKey, {}, {});
  EnigmailKeyRing.getAllKeys();
  Assert.notEqual(gKeyListObj.keyList.length, 0);
  EnigmailKeyRing.clearCache();
  Assert.equal(gKeyListObj.keyList.length, 0);
})));

test(withTestGpgHome(withEnigmail(function shouldImportFromTextAndGetKeyDetails() {
  EnigmailKeyRing.importKey(
    JSUnit.createStubWindow(),
    false,
    "-----BEGIN PGP PUBLIC KEY BLOCK-----" +
    "\n" +
    "\n" + "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" +
    "\n" + "snHSt1DRJA==" +
    "\n" + "=I9l9" +
    "\n" + "-----END PGP PUBLIC KEY BLOCK-----" +
    "\n" + "-----BEGIN PGP PRIVATE KEY BLOCK-----" +
    "\n" +
    "\n" + "lQdGBFVHm5sBEACs94Ln+RMdeyBpWQtTZ/NZnwntsB10Wd3HTgo5sdA/OOFOJrWe" +
    "\n" + "tJfAZ/HRxiSu1bwRaFVC8p061ftTbxf8bsdfsykYJQQqPODfcO0/oY2n/Z93ya8K" +
    "\n" + "TzjXR3qBQ1P7f5x71yeuo7Zrj7B0G44Xjfy+1L0eka9paBqmm3U5cUew5wSr772L" +
    "\n" + "cflipWfncWXD2rBqgRfR339lRHd3Vwo7V8jje8rlP9msOuTMWCvQuQvpEkfIioXA" +
    "\n" + "7QipP2f0aPzsavNjFnAfC9rm2FDs6lX4syTMVUWy8IblRYo6MjhNaJFlBJkTCl0b" +
    "\n" + "ugT9Ge0ZUifuAI0ihVGBpMSh4GF2B3ZPidwGSjgx1sojNHzU/3vBa9DuOmW95qrD" +
    "\n" + "Notvz61xYueTpOYK6ZeT880QMDvxXG9S5/H1KJxuOF1jx1DibAn9sfP4gtiQFI3F" +
    "\n" + "WMV9w3YrrqidoWSZBqyBO0Toqt5fNdRyH4ET6HlJAQmFQUbqqnZrc07s/aITZN36" +
    "\n" + "d9eupCZQfW6e80UkXRPCU53vhh0GQey9reDyVCsV7xi6oXk1fqlpDYigQwEr4+yJ" +
    "\n" + "+1qAjtSVHJhFE0inQWkUwc2nxef6n7v/M9HszhP/aABadVE49oDaRm54PtA1l0mC" +
    "\n" + "T8IHcVR4ZDkaNwrHJtidEQcQ/+YVV3g7UJI9+g2nPvgMhk86AzBIlGpG+wARAQAB" +
    "\n" + "/gcDArJ7Wicddqbq5aBonxpLZfUlRnCZfugyu7OPqno7mwK39Y/i2Fdr+Aqo4ISr" +
    "\n" + "mba7JnGd6J7XDpas78yqrFcbs7RBawKTML5SS0v1nSwco06wzf8ymFh8bP87dRmI" +
    "\n" + "7A/BaPMd+YL/UDrw0QFAZN+PEBcCg0A20rc8KKYpf8wv3PHhA+zPRULQVFpF1B0t" +
    "\n" + "cPUYXj5WpKO1dDPVxA+nhGIJQwvHqntH7lNThC1Lvo66j5LXQO+52RVoww+lIv96" +
    "\n" + "Qs1Y2LeQfdqq92Eq8JjlZ4N01eN3duPep+/cLqKytqjxvqu+JGYJTJ+JGv3cYH7k" +
    "\n" + "w5FTQpQvI0ftKINkTomBkLrcKLkJTGOnZOaBLtIcyeEE+/O+NtNdU6IftA1c9s/A" +
    "\n" + "BPwzjFmMrvrIf+eK1eUwbTOpMaQVsfP8CmfExtsld8JpMhMUxcjbhJKkYNEV5/I+" +
    "\n" + "XmMgKYnzrQU6hZKQQZ5qwa9P8Nv3CLXyjkxVy0gyrtFZLKdjjZE/KsiTxVe0Wk/a" +
    "\n" + "CXtd5JzZjJh8AO70qZpqEJQPfSSlnJS6R7q8CLAVYXsj2J/vfBM2/sBswL1czLdS" +
    "\n" + "sXVFEm6UhGPswUPOPgSq/tgxj5CRTBbY9krrPLkEJ5eTzG0Dj9VDmnhUY8Lf0Xer" +
    "\n" + "B4Gf48mh3M14KFAzrEB2Yd51b6HJ4wnBgd4k6S8s7qtn/yprEW5kZs+TWCi/I8dG" +
    "\n" + "M5NsowBReQP0P2MUJOhjlEYuuGNPhibya+ViK02bI/JsfDoRQuo2CQXjx7BODq5O" +
    "\n" + "BGCpKOcQbJvoqBkBkacKCG1vpkclzs7Lv6R3EF+tcePPzcEslfqIf6XHACg0AWA7" +
    "\n" + "IYult3eCChsi3PnAhHwqfMOanZKwT+XuyUiShd7hHy6A1DdM43GMbOnMNRjKiadO" +
    "\n" + "ekKsfWXOk6FNFVuR+Ew0Tp+CpQ5WVfVRGkRwuVZfc709jdlp7/MvbjCLVvS+2q1E" +
    "\n" + "R7i9BphqJYuGkHqvGS5lrXxctvd+IWIPh8Fe/Z6o2d+KiBsfxeoj5gOtgRZGZg2t" +
    "\n" + "FkECC5Cwo4aMj+oeJ6scTAYguaIwjtNBJfXVkaOAfaZKD1fR8ZZ+GXWmzevS4F0g" +
    "\n" + "0vvVznondT6GKvywcSyKRWI08kGiNVESQYWlhr9cQfOlet1cRm9oUyNFqReGXi4L" +
    "\n" + "pHA5Qn5moNwkxqXbvuwdu1WE9IpYsAEU65aCViQAvCQ2nP0cQXQEoH7pcnbyGff9" +
    "\n" + "1aoYn79pusi0jcM0u/WLFFrcH4WqhxrMRvr8aikiI25h9XdK5g/ojJygIebvFrwm" +
    "\n" + "/v8fMnpII7L/FZs9+kJL7lwUTeWEdRI79YmyBnPH+oJUIy562RG2cRAnu6/1Tr7u" +
    "\n" + "pWttOAU/bOh9jkEVX4Mc6dUzF1Y61H0M4wyxccmdpUfSSWLcWrZaVEmwiGa2wE65" +
    "\n" + "c7aItdfMExz/H+j22eDdCjTFaU0+UbpX8bxdX3Gye3LvDiLaZffFKhQLhJv+aK/j" +
    "\n" + "HAPPf0MyMmE/NBFPD8BRTVoJO5eif7IWa5LTBbkrRSg/57gH0BjNzm8dYrtS05cp" +
    "\n" + "haFCjyPWFBcNH/6/n12Ik07Uhtr8ssmo09MxYvQoEHTIDR8ZaPmB/tRX9nAVkZDj" +
    "\n" + "WTW1wRI0PSqvq6XYPQnHXVJLjn3kBZv3qSpPvCCgD6azFU1y5HzTURMDURQHwGmq" +
    "\n" + "SEVzD5NBgVYyVjUYbe72XiY+ovmgx/TcktKrqNmxZZATyIrheVIfQPtfNhIbn8rI" +
    "\n" + "o3K9/Oy+Il6IHbtlpoSRSJGB8veH9bQDwpzBbiiU6oeN1CuvsYLrCNe0K2Fub255" +
    "\n" + "bW91cyBzdHJpa2UgPHN0cmlrZS5kZXZ0ZXN0QGdtYWlsLmNvbT6JAk4EEwEIADgC" +
    "\n" + "GwMFCwkIBwMFFQoJCAsFFgIDAQACHgECF4AWIQRlU34hLcGQJa047bJ4FhcxnOMR" +
    "\n" + "xAUCW1X5/wAKCRB4FhcxnOMRxFZxD/sGKGOfuOJ23unDiK/2iCcexf898M9C19pr" +
    "\n" + "jArc0dIOr8sxsjnFH4+1XSPhoiNnGPkLgXf/qm+EK2FX0paIxzGWsvWu/3avkkkC" +
    "\n" + "q3VPib8KpgYZwq354iIOm7MaPtHLlUkrKscvWgVcOjpJ17gvkfzuW0f6W/LL0tLx" +
    "\n" + "M+CSdZXxGxHa+f8hav0c0uEoB0cQhcUYZ9hFpLtFFFgeY/TlMUV0XDKGrZVNZbw6" +
    "\n" + "CpgguRISicuAOjXZAQA67lD3AIrRNXaKf7LEED8eHkb9TCb67hKtb69Jbal1tiWC" +
    "\n" + "T/w6nki0NDWfpDT0nO7Kf0LM37vswl2t4Ag/1iWdTt5RzuHeIu2EdiZ+VjJc6U7n" +
    "\n" + "UzsCme+7hJ8WL+Or/0yU31cn23iWjW2Qa94CoGHzxdke+LKZEZgN/YUORPD8CF0i" +
    "\n" + "/xtV45siiJe7JqgPyVvt+DXpJruaxSP7T5n550kGvVgyB2Wh63LNweYYUVuosuIP" +
    "\n" + "ka9NF8PrIx2QL8hx9Fe2MwhNtnGk8wDY2u5iqBVeMXNpbvo6JOS+MRXgu350CIuk" +
    "\n" + "s2H2flL/Uq4HhArakfaLIlIUx3Ehwmwh8dORm44dizvjoNaqp3G+xDIwJeRtS1Rr" +
    "\n" + "aAfP/aYKDEPKZremJalGQC0zFX7phFm4EOwZd3tU1dhFWWbz6YIGKQtg3JFGeEzg" +
    "\n" + "t2RfHuJppp0HRgRVR5ubARAAwV9vG0eUMW6xjVT094zOtCE/pvxkyx+pZuDnGaJg" +
    "\n" + "Ho/16wTnF/9AWLTqqj+w7q/JNAPH3C5GQkgbHtZun73wAqPFW3rp7+CK0k+RYF4e" +
    "\n" + "22D2bHiMuVO159HS6qVVyUajLd1C0v0cMtfF8fI/bFySQwCiKmeDB8IAZJz3ngZw" +
    "\n" + "+GhumyQLgRCOkVuZYWxvFhSXwp4hbkZ4pvlQ+rnH/d8dzZC9E1mNJdD21HVvdrC3" +
    "\n" + "4iqdZ5s/tXUaAXJE+9NbDLNqZOPDuWP7z+jhA8xc4xnQNa/WJG5V4zfVcYUjdNFp" +
    "\n" + "ZnKtQ6hFN+vjKouGCELLhdzX0td/lNpYY5UeR6UcXQzHx4xWJZOYZTrbr6KbHmE5" +
    "\n" + "TMpBZfA+8tKkhSAIqlZeqXZUgVPOGzix6AlBnp7PlJe5tFEocGXVZjInxcP3ycCE" +
    "\n" + "mSPA+bxpDN6xO08axwEPztXyZxmTQUYJ/C452Y0RgP7tX8HqbRWNDcszuZTs01iO" +
    "\n" + "hwSZdYTGr3tpdL7cATy60W20Ycume+wTXxPWtsO2OGhXrIYxKVsRPG0CMjKwRmkW" +
    "\n" + "okNpaV5gOl2GcUPMTlH7LbAEdUzPiW6FyQ7k8PmIWlWtlu2f0c3bTZ2oVggo6bRa" +
    "\n" + "utA7oIC8ABp46+R3LaS4MLy1Sgng31PJ3IcwpC+x4pIdiwu8klEf1czkWoP05I8W" +
    "\n" + "EUcAEQEAAf4HAwKe83Kjr65hhOUJ+PV1tRHQu+AktfnJ1tOJqmYJ4KG0w8X6hc7G" +
    "\n" + "8iAX1cMZj5afeT057lhzRO7WaPhZZTs7k63zZxCgqoGYLVcMvGhXyosggvH6V+GB" +
    "\n" + "GilxPebohrRJFhyMoOURHGSVnCXseMNRB4XXqTEY2t9F5qForW+cNUYEfcdmENlc" +
    "\n" + "6PoqxyqYJAwLs2LKmqYjfNcF+GJZDiXM48gXKfjMTz9vR2rm7UtasujKD9XuZST7" +
    "\n" + "HKdXY1rYGhGaEvVTs8lVG+9BUgaR27l7FErK9Zi6RB7QbIV4K8b73bdstQjsdD8C" +
    "\n" + "OeTE/xF8Hqp9vT1ZJoAbjbKt8CXZsMYvS5d9LsKZLu6DVrDBEGunTUlCV/aMhTaT" +
    "\n" + "YrirAj1GcpIvumHAoIiTEKJ9Yy/6MjduQHoh5Zoe5vi80gW9CJsfG23YOPkOdSoo" +
    "\n" + "A2h2AakkiGcIasCasL0kwVyxeA2DVTW4Uep8vhQhVXM1Cefg8iCCeUbpTNYFmmMU" +
    "\n" + "/Hm6YbAGXrOVYpBVm91HDXu1dIigKwMEgabySHbcBDzUtO5K9B3T03mtd8mYpckl" +
    "\n" + "JKIL7T0ZrDx/VLZoQLz0HWlcP7tYXSGwmPUH3KPg8yvBo5ie2zDGaZnioSucFo6P" +
    "\n" + "9d3x+Ha8Qub1O/ukwERN6sxXglL0YurC+xho5utk+Qu71au5xH5ErbyVRTKiyFfY" +
    "\n" + "oJbShvYQGYFmaFXgh+oX8c27ji2Kw1I+dDxLxD+p5gm2UiSgJdr6M6suknFxGabl" +
    "\n" + "Ai5np/BwY390dX2Lo3lFBTMKCTaWbEahU+g1kS5p8i8lVwbp9YNPZxgQMVGaPVRa" +
    "\n" + "t7Wn1tcxO2vIHK3Nrb/g52/h75WfqqeznWQXXt882EE92WOq92YoYxOp6B3j5eHS" +
    "\n" + "erxpZywfQr+Ozb5/2SNpGYvcqKkXA4heCcweEbsWC0YZKMWvmZH/29atsgGz73Mt" +
    "\n" + "YrZrm1D/1XDPl/PN4yEqV8cIdYCJlvuE4Aw39AK760JctC8VjCm4PP4QvMe3Cq6g" +
    "\n" + "/U2XzlSTYg7a9ScsHYybPgOPaWYPFP0BLqJAwv6dNlJESaYzzPdLNndMIVuJjnRv" +
    "\n" + "ENCUA9x9hrAHkX5m3vTuOUHRIi3G9Vz8Tu8jbOAN99B923E4YAFiIIORDx+mFgsr" +
    "\n" + "j7jlqnWGb8Kb9wSezUtBCYAIBA1l59kfyzn4BqZ4jMvdxeTsLJLEwhyBN3Ii3PiB" +
    "\n" + "YzjyHPSL6dnhgBPJbS8vu9sZ+3GUBRcOetNuxai00OgcVi2Y40p0bxEiX5CsZvoh" +
    "\n" + "ixTjXvvLNDetyC42FgEScY/T9ziHgMem1AWzBHQd6AvUlPe28Onbxv5KCHJPJ3Ab" +
    "\n" + "89FY8uPcfaGth/c+145DrSn7UW1DOAo5wwq2GABNNj0xmt+UiAXB3z2xF7GU0nwc" +
    "\n" + "LtXNNfyBzC3yqIb/3KtxsdLhga3qwd4Y2yt3qk8Bywxv81dPnG7Tz1Ixh/NXxZT6" +
    "\n" + "pOJPIBDE7FjsTxqhTzZJwfDsOEoCktMIh5uRppWs+7keYrNomSCYj+xK84qEq1vS" +
    "\n" + "Cx5P9mvLIhmQclMzU4XMHqMviKPCQdir09hCz+CesHpngRNRTt+qkd+lZZR6qbRF" +
    "\n" + "Jcnv3hMnveKY5wpSFZAx+LDLgNLBzR/Syv8vk+11+oeqBFHnhkaA9tc6dNoRg6ZI" +
    "\n" + "mqdHA5/CcI2ho8eiK4/AbvN+VkmpkXAA5nc3vzS4N9Gwyh/VJlGnJ7parVCs9e/9" +
    "\n" + "jt3j8t8ggP9GkfcBnq1Zny1INaQeH5S/PIfFjczCVnTKtq3JrRswILvCImo5fvLI" +
    "\n" + "iQI2BBgBCAAgAhsMFiEEZVN+IS3BkCWtOO2yeBYXMZzjEcQFAltV+hQACgkQeBYX" +
    "\n" + "MZzjEcRAmBAAmg8OiRaoHRyOaR+6ZEWnvVYn+tzre1xJksVBqaI/6m82cvnJvZRH" +
    "\n" + "3DhwvXIoRWtBMBtVqRVMrs5fM/H+p7pSdr4ubpwtNOw/Mk+ZMC+72kPoHdSbXD58" +
    "\n" + "tyeqkWjcWNioZZJCxWBS0p6bf8ntEvx7gh+0YxtZWB4GvSlC6mAfqXaRZn5j8uqI" +
    "\n" + "KRx2ikLmH/8vckcspZpf643UU1jswmvC+stsut8vJpHBGb1Cf1lgMwppGv8ON7r9" +
    "\n" + "3z67ou8MzCw3gpEhKJm6GsfW4E6qrff2TT/R9I2u11DSIx0/M5/ofGJIwhwLqR0S" +
    "\n" + "Jbce2T2orGYs+kQP4sCBPq7ZK2BDsgi7Gh0/olzLDxVy2DzIEdbrCaoNjNws1XRp" +
    "\n" + "o15dP2Wc6OGvsCs5EQpwNSuGbCfz8tuEH6jSMPCcrGm/OklUqRqt2GwyLiiP+iOQ" +
    "\n" + "ki9+lpXw3LL8qa+jLxO1+faLRo/tas5pR7rHC/eRHISQDUSW01tfyB8NlTKkIUTE" +
    "\n" + "wSn7azHnYgv8T/cbZeFNw/Fsm5PoIUHcLlvcd0lvR/A6JYMwSN33R03r2QriSRXV" +
    "\n" + "4ZhMhGtnhHEYqHP982gBxk4RPvEp7APCLrqgC0+N8N29eC4s3JkVkHAZx+fj5YV2" +
    "\n" + "H9/5wJRJ1w+kwmazhpTQsy01kEwS4NZMPe8Uvz0MgoNuF7Jx0rdQ0SQ=" +
    "\n" + "=oVjy" +
    "\n" + "-----END PGP PRIVATE KEY BLOCK-----",
    null, {});
  const keyDetails = EnigmailKeyRing.getValidUids("0xD535623BB60E9E71").join("\n");
  Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
  EnigmailKeyRing.getAllKeys();
  Assert.notEqual(gKeyListObj.keyList.length, 0);

  // uses the key listing from shouldGetKeyValidityErrors
  let key = EnigmailKeyRing.getKeyById("D535623BB60E9E71");

  // this test is crucial as it depends on openpgp.js internal functions
  let pubKey = key.getMinimalPubKey();

  Assert.equal(pubKey.exitCode, 0);

  Assert.equal(pubKey.keyData.substr(3, 126),
    "NBFVHm5sBEACs94Ln+RMdeyBpWQtTZ/NZnwntsB10Wd3HTgo5sdA/OOFOJrWetJ" +
    "fAZ/HRxiSu1bwRaFVC8p061ftTbxf8bsdfsykYJQQqPODfcO0/oY2n/Z93ya8KT");

  if (pubKey.keyData.length === 3020) {
    Assert.equal(pubKey.keyData.substr(-52),
      "lEnXD6TCZrOGlNCzLTWQTBLg1kw97xS/PQyCg24XsnHSt1DRJA==");
  } else if (pubKey.keyData.length === 3080) {
    Assert.equal(pubKey.keyData.substr(-52),
      "wJRJ1w+kwmazhpTQsy01kEwS4NZMPe8Uvz0MgoNuF7Jx0rdQ0SQ=");
  } else {
    Assert.ok(false, "pubkey.keyData.length neither 3020 nor 3080");
  }
})));


test(withTestGpgHome(withEnigmail(function shouldExportKey() {
  const publicKey = do_get_file("resources/dev-strike.asc", false);
  const secretKey = do_get_file("resources/dev-strike.sec", false);
  EnigmailKeyRing.importKeyFromFile(publicKey, {}, {});
  EnigmailKeyRing.importKeyFromFile(secretKey, {}, {});
  EnigmailKeyRing.getAllKeys();

  let pub = EnigmailKeyRing.extractKey(false, "0x781617319CE311C4", null, {}, {}).replace(/\r\n/g, "\n");
  Assert.equal(pub.substr(-50), "t1DRJA==\n=I9l9\n-----END PGP PUBLIC KEY BLOCK-----\n");

  let pubAndSec = EnigmailKeyRing.extractKey(true, "strike.devtest@gmail.com", null, {}, {}).replace(/\r\n/g, "\n");
  Assert.equal(pubAndSec.substr(-37), "\n-----END PGP PRIVATE KEY BLOCK-----\n");
  Assert.equal(pubAndSec.split(/\n/).length, 161);
})));


const KeyRingHelper = {
  loadTestKeyList: function() {
    const pkFile = do_get_file("resources/pub-keys.asc", false);
    let publicKeys = EnigmailFiles.readFile(pkFile);
    let rows = publicKeys.split("\n");
    let testKeyList = [];
    for (let i = 0; i < rows.length; ++i) {
      let row = rows[i];
      if (row !== "" && row[0] != "#") {
        testKeyList.push(row);
      }
    }

    let keyList = {
      keys: [],
      index: []
    };
    GnuPGKeyList.appendKeyItems(testKeyList, keyList);

    createAndSortKeyList(keyList.keys,
      "validity", // sorted acc. to key validity
      -1); // descending

    let keyListObj = gKeyListObj;
    Assert.notEqual(keyListObj, null);
    Assert.notEqual(keyListObj.keySortList, null);
    Assert.notEqual(keyListObj.keySortList.length, null);
  }
};

test(function testGetValidKeyForOneRecipient() {
  KeyRingHelper.loadTestKeyList();

  const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
  let minTrustLevelIndex = null;
  let details = null;
  let key = null;

  // unknown key:
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("unknown@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, null);
  //Assert.equal(details.msg, "undefined");

  // ordinary full trusted key:
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("full@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0003AAAA00010001");
  Assert.equal(details.msg, null);
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("full@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0003AAAA00010001");
  Assert.equal(details.msg, null);

  // key not valid for encryption:
  // - no details because it would take time to check details of such a key
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("no-encrypt@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, null);

  // disabled key:
  // - no details because it would take time to check details of such a key
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {
    all: ""
  };
  key = EnigmailKeyRing.getValidKeyForRecipient("disabled@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, null);

  // multiple non-trusted and one full trusted keys
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-onefull@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0030AAAA00020001");
  Assert.equal(details.msg, null);

  // multiple non-trusted and two full trusted keys (first taken)
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-twofull@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0034AAAA00020001");
  Assert.equal(details.msg, null);

  // multiple non-trusted and one marginal trusted keys
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("f");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-onemarginal@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, "ProblemNoKey");
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-onemarginal@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0031AAAA00020001");
  Assert.equal(details.msg, null);

  // multiple non-trusted keys with same trust level
  // (faked keys case if no special trust given)
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("multiple-nofull@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, null);
  Assert.equal(details.msg, "ProblemMultipleKeys");

  // some key with subkey that encrypts:
  // we return first main key
  minTrustLevelIndex = TRUSTLEVELS_SORTED.indexOf("?");
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("withsubkey-uid1@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0040EEEE00010001");
  Assert.equal(details.msg, null);
  details = {};
  key = EnigmailKeyRing.getValidKeyForRecipient("withsubkey-uid2@enigmail-test.de", minTrustLevelIndex, details);
  Assert.equal(key, "0040EEEE00010001");
  Assert.equal(details.msg, null);
});

test(function testGetValidKeysForMultipleRecipients() {
  KeyRingHelper.loadTestKeyList();

  const TRUSTLEVELS_SORTED = EnigmailTrust.trustLevelsSorted();
  let minTrustLevel = null;
  let details = null;
  let addrs = null;
  let keys = null;
  let keyMissing = null;

  // some matching keys:
  minTrustLevel = "?";
  addrs = ["full@enigmail-test.de",
    "multiple-onefull@enigmail-test.de",
    "multiple-twofull@enigmail-test.de",
    "multiple-onemarginal@enigmail-test.de",
    "withsubkey-uid1@enigmail-test.de",
    "withsubkey-uid2@enigmail-test.de"
  ];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, false);
  Assert.notEqual(keys, null);
  Assert.equal(keys.length, 6);
  Assert.equal(keys[0], "0x0003AAAA00010001");
  Assert.equal(keys[1], "0x0030AAAA00020001");
  Assert.equal(keys[2], "0x0034AAAA00020001");
  Assert.equal(keys[3], "0x0031AAAA00020001");
  Assert.equal(keys[4], "0x0040EEEE00010001");
  Assert.equal(keys[5], "0x0040EEEE00010001");
  Assert.equal(details.errArray.length, 0);

  // some non-matching keys:
  minTrustLevel = "?";
  addrs = ["no-encrypt@enigmail-test.de",
    "disabled@enigmail-test.de",
    "multiple-nofull@enigmail-test.de"
  ];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, true);
  Assert.equal(keys.length, 0);
  Assert.notEqual(details, null);
  Assert.equal(details.errArray.length, 3);
  Assert.equal(details.errArray[0].msg, "ProblemNoKey");
  Assert.equal(details.errArray[1].msg, "ProblemNoKey");
  Assert.equal(details.errArray[2].msg, "ProblemMultipleKeys");

  // just two keys:
  minTrustLevel = "?";
  addrs = ["0x0040EEEE00010001",
    "0x0003AAAA00010001",
    "0003AAAA00010001"
  ];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, false);
  Assert.notEqual(keys, null);
  Assert.equal(keys.length, 3);
  Assert.equal(keys[0], "0x0040EEEE00010001");
  Assert.equal(keys[1], "0x0003AAAA00010001");
  Assert.equal(keys[2], "0x0003AAAA00010001");
  Assert.equal(details.errArray.length, 0);

  // disabled key:
  // - this BEHAVIOR is PROBABLY WRONG:
  minTrustLevel = "?";
  addrs = ["0005AAAA00010001"];
  details = {};
  keys = [];
  keyMissing = EnigmailKeyRing.getValidKeysForAllRecipients(addrs, minTrustLevel, details, keys);
  Assert.equal(keyMissing, false);
  Assert.notEqual(keys, null);
  Assert.equal(keys.length, 1);
  Assert.equal(keys[0], "0x0005AAAA00010001");
  Assert.equal(details.errArray.length, 0);
});

test(function shouldGetKeyValidityErrors() {
  // from: gpg2 --with-fingerprint --fixed-list-mode --with-colons --list-keys
  let keyInfo = [
    // Key 1: Revoked key
    "tru::1:1443339321:1451577200:3:1:5",
    "pub:r:4096:1:DEF9FC808A3FF001:1388513885:1546188604::u:::sca:",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:r::::1389038412::44F73158EF0F47E4595B1FD8EC740519DE24B994::User ID 1 <user1@enigmail-test.net>:",
    "sub:r:4096:1:E2DEDFFB80C14584:1388513885:1546188603:::::e:",

    // Key 2: valid public key, usable for signing, with expired subkeys for encryption
    "pub:u:1024:17:F05B29A5CEFE4B70:1136219252:::u:::scaSCA:::::::",
    "fpr:::::::::6D67E7817D588BEA263F41B9F05B29A5CEFE4B70:",
    "uid:u::::1446568426::560DE55D9C611718F777EDD11A84F126CCD71965::User ID 2 <user2@enigmail-test.net>:::::::::",
    "sub:e:2048:1:B2417304FFC57041:1136219469:1199291469:::::e::::::",
    "sub:e:2048:1:770EA47A1DB0E8B0:1136221524:1293901524:::::s::::::",
    "sub:e:2048:1:805B29A5CEFB2B70:1199298291:1262370291:::::e::::::",
    "sub:e:2048:1:0F6B6901667E633C:1262537932:1325437132:::::e::::::",

    // Key 3: valid public key, usable subkey for encryption, no secret key
    "pub:u:1024:17:86345DFA372ADB32:1136219252:::u:::scESC:::::::",
    "fpr:::::::::9876E7817D588BEA263F41B986345DFA372ADB32:",
    "uid:u::::1446568426::560DE55D9C611718F777EDD11A84F126CCD71965::User ID 3 <user3@enigmail-test.net>:::::::::",
    "sub:u:2048:1:B2417304FFC57041:1136219469::::::s::::::",
    "sub:u:2048:1:770EA47A1DB0E8B0:1136221524::::::e::::::"
  ];

  // from: gpg2 --with-fingerprint --fixed-list-mode --with-colons --list-secret-keys
  let secKeyInfo = [
    // Key 1
    "sec::4096:1:DEF9FC808A3FF001:1388513885:1546188604:::::::::",
    "fpr:::::::::EA25EF48BF2001E41FAB0C1CDEF9FC808A3FF001:",
    "uid:::::::44F73158EF0F47E4595B1FD8EC740519DE24B994::User ID 1 <user1@enigmail-test.net>:",
    "ssb::4096:1:E2DEDFFB80C14584:1388513885::::::::::",
    // Key 2
    "sec:u:1024:17:F05B29A5CEFE4B70:1136219252:1507997328::u:::scaSCA:::::::",
    "fpr:::::::::6D67E7817D588BEA263F41B9F05B29A5CEFE4B70:",
    "uid:u::::1446568426::560DE55D9C611718F777EDD11A84F126CCD71965::User ID 2 <user2@enigmail-test.net>:::::::::",
    "ssb:e:2048:1:B2417304FFC57041:1136219469:1199291469:::::e::::::",
    "ssb:e:2048:1:770EA47A1DB0E8B0:1136221524:1293901524:::::s::::::",
    "ssb:e:2048:1:805B29A5CEFB2B70:1199298291:1262370291:::::e::::::",
    "ssb:e:2048:1:0F6B6901667E633C:1262537932:1325437132:::::e::::::"
    // NO Key 3
  ];

  let keyList = {
    keys: [],
    index: []
  };

  GnuPGKeyList.appendKeyItems(keyInfo, keyList);
  GnuPGKeyList.appendKeyItems(secKeyInfo, keyList);

  createAndSortKeyList(keyList.keys,
    "validity", // sorted acc. to key validity
    -1); // descending

  let key = EnigmailKeyRing.getKeyById("DEF9FC808A3FF001");
  let result = key.getSigningValidity();
  Assert.equal(result.reason, EnigmailLocale.getString("keyRing.pubKeyRevoked", [key.userId, "0x" + key.keyId]));

  key = EnigmailKeyRing.getKeyById("F05B29A5CEFE4B70");
  result = key.getEncryptionValidity();
  Assert.equal(result.keyValid, false);
  Assert.equal(result.reason, EnigmailLocale.getString("keyRing.encSubKeysExpired", [key.userId, "0x" + key.keyId]));

  result = key.getSigningValidity();
  Assert.equal(result.keyValid, true);

  key = EnigmailKeyRing.getKeyById("86345DFA372ADB32");
  result = key.getSigningValidity();
  Assert.equal(result.keyValid, false);
  Assert.equal(result.reason, EnigmailLocale.getString("keyRing.noSecretKey", [key.userId, "0x" + key.keyId]));

  result = key.getEncryptionValidity();
  Assert.equal(result.keyValid, true);
});

test(function shouldGetKeyExpiry() {
  // uses the key listing from shouldGetKeyValidityErrors
  let key = EnigmailKeyRing.getKeyById("DEF9FC808A3FF001");
  Assert.equal(key.getKeyExpiry(), 1546188603);

  key = EnigmailKeyRing.getKeyById("F05B29A5CEFE4B70");
  Assert.equal(key.getKeyExpiry(), 1325437132);

  key = EnigmailKeyRing.getKeyById("86345DFA372ADB32");
  Assert.equal(key.getKeyExpiry(), Number.MAX_VALUE);
});

test(function shouldClone() {
  // uses the key listing from shouldGetKeyValidityErrors
  let key = EnigmailKeyRing.getKeyById("DEF9FC808A3FF001");

  let cp = key.clone();

  Assert.equal(cp.fprFormatted, "EA25 EF48 BF20 01E4 1FAB 0C1C DEF9 FC80 8A3F F001");
  Assert.equal(cp.getEncryptionValidity().keyValid, false);
});