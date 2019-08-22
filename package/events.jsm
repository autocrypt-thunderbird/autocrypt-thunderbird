/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["AutocryptEvents"];





const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptTimer = ChromeUtils.import("chrome://autocrypt/content/modules/timer.jsm").AutocryptTimer;

/**** DEPRECATED - use AutocryptTimer instead *****/

var AutocryptEvents = {
  /**
   * dispatch event aynchronously to the main thread
   *
   * @callbackFunction: Function - any function specification
   * @sleepTimeMs:      Number - optional number of miliseconds to delay
   *                             (0 if not specified)
   * @arrayOfArgs:      Array - arguments to pass to callbackFunction
   */
  dispatchEvent: function(callbackFunction, sleepTimeMs, arrayOfArgs) {
    AutocryptLog.DEBUG("enigmailCommon.jsm: dispatchEvent f=" + callbackFunction.name + "\n");

    return AutocryptTimer.setTimeout(() => {
      callbackFunction(arrayOfArgs);
    }, sleepTimeMs);
  }
};
