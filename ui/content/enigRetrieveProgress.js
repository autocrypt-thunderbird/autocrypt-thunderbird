/*global Components: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-invalid-this: 0, no-loop-func: 0 */

"use strict";

const Cu = Components.utils;
const Ci = Components.interfaces;
const Cc = Components.classes;
const nsIEnigmail = Ci.nsIEnigmail;

Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/keyserver.jsm"); /*global EnigmailKeyServer: false */
Cu.import("resource://enigmail/errorHandling.jsm"); /*global EnigmailErrorHandling: false */
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */

// dialog is just an array we'll use to store various properties from the dialog document...
var dialog;

// the msgProgress is a nsIMsgProgress object
var msgProgress = null;

// random global variables...
var targetFile;
var itsASaveOperation = false;
var gProcess = null;
var gEnigCallbackFunc = null;
var gErrorData = '';

// all progress notifications are done through the nsIWebProgressListener implementation...
var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
      // dialog.progress.setAttribute( "value", 0 );
      // Put progress meter in undetermined mode.
      dialog.progress.setAttribute("mode", "undetermined");
    }

    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
      // we are done transmitting
      // Indicate completion in status area.

      // Put progress meter at 100%.
      dialog.progress.setAttribute("value", 100);
      dialog.progress.setAttribute("mode", "normal");

      if (msgProgress.processCanceledByUser)
        enigSendKeyCancel();

      window.close();
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},

  onLocationChange: function(aWebProgress, aRequest, aLocation) {
    // we can ignore this notification
  },

  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
    // we can ignore this notification
  },

  onSecurityChange: function(aWebProgress, aRequest, state) {
    // we can ignore this notification
  },

  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIWebProgressListener) ||
      iid.equals(Ci.nsISupportsWeakReference) ||
      iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};


function onLoad() {
  // Set global variables.
  EnigmailLog.DEBUG("enigRetrieveProgress: onLoad\n");
  var inArg = window.arguments[0];
  window.arguments[1].result = false;

  dialog = {};
  dialog.strings = [];
  dialog.progress = document.getElementById("dialog.progress");

  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc)
    return;

  gEnigCallbackFunc = inArg.cbFunc;
  msgProgress = Cc["@mozilla.org/messenger/progress;1"].createInstance(Ci.nsIMsgProgress);

  if (inArg.accessType == nsIEnigmail.UPLOAD_WKD) {
    onLoadWkd(inArg);
  }
  else {
    onLoadGpg(inArg);
  }

}

function onLoadWkd(inArg) {
  let statTxt = document.getElementById("dialog.status2");
  statTxt.value = EnigmailLocale.getString("keyserverTitle.uploading");
  document.getElementById("progressWindow").setAttribute("title", EnigmailLocale.getString("keyserverTitle.uploading"));

  let progressDlg = document.getElementById("dialog.progress");
  progressDlg.setAttribute("mode", "undetermined");

  msgProgress.processCanceledByUser = false;
  EnigmailKeyServer.performWkdUpload(inArg,
    function _progress(completionRate) {
      progressDlg.setAttribute("value", completionRate);
      progressDlg.setAttribute("mode", "normal");
    },
    function _onComplete(completionStatus, errorMessage, displayError) {
      if (completionStatus !== 0) {
        window.close();
        gEnigCallbackFunc(completionStatus, errorMessage, displayError);
      }
      else {
        EnigmailDialog.info(window, EnigmailLocale.getString("keyserverProgress.wksUploadCompleted"));
        window.close();
      }
    },
    window,
    msgProgress);
}

function onLoadGpg(inArg) {
  EnigmailLog.DEBUG("enigRetrieveProgress: onLoadGpg\n");
  var subject;
  var statTxt = document.getElementById("dialog.status2");
  if (inArg.accessType == nsIEnigmail.UPLOAD_KEY || inArg.accessType == nsIEnigmail.UPLOAD_WKD) {
    statTxt.value = EnigmailLocale.getString("keyserverProgress.uploading");
    subject = EnigmailLocale.getString("keyserverTitle.uploading");
  }
  else {
    statTxt.value = EnigmailLocale.getString("keyserverProgress.refreshing");
    subject = EnigmailLocale.getString("keyserverTitle.refreshing");
  }

  var procListener = {
    done: function(exitCode) {
      EnigmailLog.DEBUG("enigRetrieveProgress: subprocess terminated with " + exitCode + "\n");
      processEnd(msgProgress, exitCode);
    },
    stdout: function(data) {
      EnigmailLog.DEBUG("enigRetrieveProgress: got data on stdout: '" + data + "'\n");
    },
    stderr: function(data) {
      EnigmailLog.DEBUG("enigRetrieveProgress: got data on stderr: '" + data + "'\n");
      gErrorData += data;
    }
  };

  msgProgress.registerListener(progressListener);
  msgProgress.onStateChange(null, null, Ci.nsIWebProgressListener.STATE_START, 0);

  var errorMsgObj = {};
  gProcess = EnigmailKeyServer.access(inArg.accessType, inArg.keyServer, inArg.keyList, procListener, errorMsgObj);
  if (!gProcess) {
    EnigmailDialog.alert(window, EnigmailLocale.getString("sendKeysFailed") + "\n" + EnigmailData.convertGpgToUnicode(errorMsgObj.value));
  }

  document.getElementById("progressWindow").setAttribute("title", subject);
}

function onUnload() {
  if (msgProgress) {
    try {
      msgProgress.unregisterListener(progressListener);
      msgProgress = null;
    }

    catch (exception) {}
  }
}

// If the user presses cancel, tell the app launcher and close the dialog...
function onCancel() {

  try {
    msgProgress.processCanceledByUser = true;
  }
  catch (ex) {
    return true;
  }

  // don't Close up dialog by returning false, the backend will close the dialog when everything will be aborted.
  return false;
}

function processEnd(progressBar, exitCode) {
  EnigmailLog.DEBUG("enigmailRetrieveProgress.js: processEnd\n");
  var errorMsg;
  if (gProcess) {
    gProcess = null;
    EnigmailLog.DEBUG("enigmailRetrieveProgress.js: processEnd: exitCode = " + exitCode + "\n");

    var statusText = gEnigCallbackFunc(exitCode, "", false);

    errorMsg = "";
    try {
      if (gErrorData.length > 0) {
        var statusFlagsObj = {};
        var statusMsgObj = {};
        errorMsg = EnigmailErrorHandling.parseErrorOutput(gErrorData, statusFlagsObj, statusMsgObj);
      }
    }
    catch (ex) {}

    EnigmailLog.DEBUG("enigmailRetrieveProgress.js: processEnd: errorMsg=" + errorMsg);
    if (errorMsg.search(/ec=\d+/i) >= 0) {
      exitCode = -1;
    }

    let j = errorMsg.search(/^\[GNUPG:\] IMPORT_RES/m);

    if (j >= 0) {
      let m = errorMsg.substr(j, 35).match(/^(\[GNUPG:\] IMPORT_RES +)([0-9]+)/);
      if (m && m.length > 2) {
        if (m[2] == "0") {
          // no keys imported
          exitCode = -2;
        }
        else {
          exitCode = 0;
        }
      }
    }

    statusText = gEnigCallbackFunc(exitCode, "", false);

    if (exitCode === 0) {
      window.arguments[1].result = true;
    }
  }

  if (progressBar) {
    try {
      progressBar.onStateChange(null, null, Ci.nsIWebProgressListener.STATE_STOP, 0);
    }
    catch (ex) {}
  }
  gEnigCallbackFunc(exitCode, errorMsg, true);
}

function enigSendKeyCancel() {
  if (gProcess) {
    var p = gProcess;
    gEnigCallbackFunc = null;
    gProcess = null;
    p.kill(false);
  }
}
