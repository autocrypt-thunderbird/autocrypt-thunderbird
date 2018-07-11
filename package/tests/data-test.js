/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global EnigmailData: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("data.jsm");

// testing: extractMessageId
test(function extractMessageIdExtractsARegularMessageId() {
  var result = EnigmailData.extractMessageId("enigmail:message/foobar");
  Assert.equal("foobar", result);
});

test(function extractMessageIdReturnsAnEmptyStringWhenItCantMatch() {
  var result = EnigmailData.extractMessageId("enigmail:mime-message/foobar");
  Assert.equal("", result);
});

// testing: extractMimeMessageId
test(function extractMimeMessageIdExtractsARegularMessageId() {
  var result = EnigmailData.extractMimeMessageId("enigmail:mime-message/fluff");
  Assert.equal("fluff", result);
});

test(function extractMimeMessageIdReturnsAnEmptyStringWhenItCantMatch() {
  var result = EnigmailData.extractMimeMessageId("enigmail:message/mess");
  Assert.equal("", result);
});
