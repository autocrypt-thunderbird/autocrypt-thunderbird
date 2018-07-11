/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 This module is a shim module to make it easier to load
 the Gloda EnigmailMime utilities from the various potential sources
*/

"use strict";

var EXPORTED_SYMBOLS = ["msgHdrToMimeMessage",
  "MimeMessage", "MimeContainer",
  "MimeBody", "MimeUnknown",
  "MimeMessageAttachment"
];

const Cu = Components.utils;

/*global MsgHdrToMimeMessage: false */
try {
  // TB with omnijar
  Cu.import("resource:///modules/gloda/mimemsg.js");
}
catch (ex) {
  // "old style" TB
  Cu.import("resource://app/modules/gloda/mimemsg.js");
}

// The original naming is inconsistent with JS standards for classes vs functions
// Thus we rename it here.
const msgHdrToMimeMessage = MsgHdrToMimeMessage;

// We don't need to explicitly create the other variables, since they will be
// imported into the current namespace anyway
