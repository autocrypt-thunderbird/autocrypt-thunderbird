/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

const EXPORTED_SYMBOLS = ["EnigmailVersioning"];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */

let vc = null;

function getVersionComparator() {
  if (vc === null) {
    vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
  }
  return vc;
}

function getVersion(stdout, executable) {
  const m = stdout.match(/\b(\d+\.\d+\.\d+)\b/);
  if (m) {
    const versionResponse = m[1];

    EnigmailLog.DEBUG(executable + " version found: " + versionResponse + "\n");

    return versionResponse;
  }
  else {
    return null;
  }
}

/**
 * Test the version number of any application (not gpg)
 */
function versionFoundMeetsMinimumVersionRequired(executable, minimumVersion) {
  const args = ["--version"];
  const exitCodeObj = {
    value: null
  };
  const stdout = EnigmailExecution.resolveAndSimpleExec(executable, args, exitCodeObj, {});
  if (!stdout || exitCodeObj.value < 0) {
    EnigmailLog.DEBUG("executable not found: " + executable + "\n");
    return false;
  }

  const version = getVersion(stdout, executable);
  if (!version) {
    EnigmailLog.DEBUG("couldn't find a version in the output from " + executable + " - total output: " + stdout + "\n");
    return false;
  }

  return greaterThanOrEqual(version, minimumVersion);
}

function greaterThanOrEqual(left, right) {
  return getVersionComparator().compare(left, right) >= 0;
}

function greaterThan(left, right) {
  return getVersionComparator().compare(left, right) > 0;
}

function lessThan(left, right) {
  return getVersionComparator().compare(left, right) < 0;
}

const EnigmailVersioning = {
  greaterThanOrEqual: greaterThanOrEqual,
  greaterThan: greaterThan,
  lessThan: lessThan,
  versionFoundMeetsMinimumVersionRequired: versionFoundMeetsMinimumVersionRequired
};
