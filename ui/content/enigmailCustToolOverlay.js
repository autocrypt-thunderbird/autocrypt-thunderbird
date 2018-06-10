/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var Enigmail = {
  onLoad: function() {
    // required for macOS only
    const Ci = Components.interfaces;

    let domWindowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    domWindowUtils.loadSheetUsingURIString("chrome://enigmail/skin/enigmail.css", 1);
  }
};

Enigmail.onLoad();
