/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailKeyRefreshService"];

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";
const ONE_HOUR_IN_MILLISEC = 60 * 60 * 1000;

let gTimer = null;

function getTimer() {
  if (gTimer === null) gTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  return gTimer;
}

const SECONDS_MIN_DELAY = "refreshMinDelaySeconds";

function calculateWaitTimeInMilliseconds() {
  return 16 * ONE_HOUR_IN_MILLISEC;
}

function refreshKey() {
  const timer = getTimer();
  // TODO
}

function restartTimerInOneHour(timer) {
  timer.initWithCallback(refreshKey,
    ONE_HOUR_IN_MILLISEC,
    Ci.nsITimer.TYPE_ONE_SHOT);
}

function setupNextRefresh(timer, waitTime) {
  timer.initWithCallback(refreshKey,
    waitTime,
    Ci.nsITimer.TYPE_ONE_SHOT);
}

function start() {
  EnigmailLog.DEBUG("keyRefreshService.jsm: Started\n");
  // TODO
  // const timer = getTimer();
  // restartTimerInOneHour(timer);
}

var EnigmailKeyRefreshService = {
  start: start
};
