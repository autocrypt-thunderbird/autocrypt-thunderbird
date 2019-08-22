/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["AutocryptLazy"];


var AutocryptLazy = {
  loader: function(component, name) {
    let holder = null;
    return function() {
      if (holder === null) {
        component = component.replace(/^autocrypt\//, "");
        const into = ChromeUtils.import("chrome://autocrypt/content/modules/" + component);
        holder = into[name];
      }
      return holder;
    };
  }
};
