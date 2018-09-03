/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global do_load_module: false, do_get_cwd: false */
// load testHelper.js from package/tests into the current scope
do_load_module("file://" + do_get_cwd().parent.parent.path + "/package/tests/testHelper.js");

// all functions from .../package/testHelper.js are available
