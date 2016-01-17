/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

/* global Components: false, DirPaneHasFocus: false, GetSelectedAddressesFromDirTree: false, GetSelectedAddresses: false */

Components.utils.import("resource://enigmail/funcs.jsm"); /*global EnigmailFuncs: false */
Components.utils.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */

var Enigmail = {
  createRuleFromAddress: function(emailAddressNode) {
    if (emailAddressNode) {
      var r = new RegExp("^" + emailAddressNode.protocol);
      var emailAddress = emailAddressNode.href.replace(r, "");
      EnigmailWindows.createNewRule(window, emailAddress);
    }
  },

  createRuleFromCard: function() {
    var emailAddress = "";
    if (DirPaneHasFocus())
      emailAddress = GetSelectedAddressesFromDirTree();
    else
      emailAddress = GetSelectedAddresses();

    if (emailAddress)
      EnigmailWindows.createNewRule(window, EnigmailFuncs.stripEmail(emailAddress).replace(/,/g, " "));
  }
};
