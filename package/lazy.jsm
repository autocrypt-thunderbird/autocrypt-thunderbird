/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailLazy"];

const Cu = Components.utils;

const EnigmailLazy = {
  loader: function(component, name) {
    let holder = null;
    return function() {
      if (holder === null) {
        const into = {};
        Cu.import("resource://" + component, into);
        holder = into[name];
      }
      return holder;
    };
  }
};
