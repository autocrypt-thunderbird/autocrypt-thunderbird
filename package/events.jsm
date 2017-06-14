/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailEvents"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */

/**** DEPRECATED - use EnigmailTimer instead *****/

const EnigmailEvents = {
  /**
   * dispatch event aynchronously to the main thread
   *
   * @callbackFunction: Function - any function specification
   * @sleepTimeMs:      Number - optional number of miliseconds to delay
   *                             (0 if not specified)
   * @arrayOfArgs:      Array - arguments to pass to callbackFunction
   */
  dispatchEvent: function(callbackFunction, sleepTimeMs, arrayOfArgs) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: dispatchEvent f=" + callbackFunction.name + "\n");

    return EnigmailTimer.setTimeout(() => {
      callbackFunction(arrayOfArgs);
    }, sleepTimeMs);
  }
};
