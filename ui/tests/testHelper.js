/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/**
 * @param {Array<Object>} overwriteArr:
 - obj {Object}: target Object
 - fn  {String}: function name
 - new {Function}: new function
 */
function withOverwriteFuncs(overwriteArr, callbackFunc) {
  let origFuncs = [];
  for (let f in overwriteArr) {
    origFuncs.push({
      obj: overwriteArr[f].obj,
      fn: overwriteArr[f].fn,
      origFunc: overwriteArr[f].obj[overwriteArr[f].fn]
    });
    overwriteArr[f].obj[overwriteArr[f].fn] = overwriteArr[f].new;
  }

  try {
    callbackFunc();
  }
  catch (x) {}

  for (let i in origFuncs) {
    origFuncs[i].obj[origFuncs[i].fn] = origFuncs[i].origFunc;
  }
}