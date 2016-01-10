/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-undef: 2, block-scoped-var: 2 */

"use strict";

if (!Enigmail) var Enigmail = {};

window.addEventListener("load", function() {
    Enigmail.edit.onLoadEditor();
  },
  false);
