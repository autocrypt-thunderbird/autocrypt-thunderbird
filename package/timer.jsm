/*global Components: false, EnigmailLog: false, EnigmailPrefs: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailTimer"];

const Cc = Components.classes;
const Ci = Components.interfaces;

const EnigmailTimer = {
  /**
   * wait a defined number of miliseconds, then call a callback function
   * asynchronously
   *
   * @callbackFunction: Function - any function specification
   * @sleepTimeMs:      Number - optional number of miliseconds to delay
   *                             (0 if not specified)
   */
  setTimeout: function(callbackFunction, sleepTimeMs) {
    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback(callbackFunction,
      sleepTimeMs || 0,
      Ci.nsITimer.TYPE_ONE_SHOT);
    return timer;
  }
};
