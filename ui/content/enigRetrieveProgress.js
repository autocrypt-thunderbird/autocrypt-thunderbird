/*global Components: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-invalid-this: 0 */

// Uses: chrome://enigmail/content/enigmailCommon.js

/* global EnigmailLog: false, doSetOKCancel: false, EnigmailLocale: false, EnigmailKeyServer: false */
/* global EnigmailErrorHandling: false */

// from enigmailCommon.js:
/* global GetEnigmailSvc: false, nsIEnigmail: false, EnigAlert: false, EnigConvertGpgToUnicode: false */

"use strict";

var msgCompDeliverMode = Components.interfaces.nsIMsgCompDeliverMode;

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
    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_START) {
      // dialog.progress.setAttribute( "value", 0 );
      // Put progress meter in undetermined mode.
      dialog.progress.setAttribute("mode", "undetermined");
    }

    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
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
    if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
      iid.equals(Components.interfaces.nsISupportsWeakReference) ||
      iid.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};


function onLoad() {
  // Set global variables.
  EnigmailLog.DEBUG("enigRetrieveProgress: onLoad\n");
  var inArg = window.arguments[0];
  var subject;
  window.arguments[1].result = false;

  dialog = {};
  dialog.strings = [];
  dialog.progress = document.getElementById("dialog.progress");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  // Set up dialog button callbacks.
  var object = this;
  doSetOKCancel("", function() {
    return object.onCancel();
  });


  var statTxt = document.getElementById("dialog.status2");
  if (inArg.accessType == nsIEnigmail.UPLOAD_KEY) {
    statTxt.value = EnigmailLocale.getString("keyserverProgress.uploading");
    subject = EnigmailLocale.getString("keyserverTitle.uploading");
  }
  else {
    statTxt.value = EnigmailLocale.getString("keyserverProgress.refreshing");
    subject = EnigmailLocale.getString("keyserverTitle.refreshing");
  }

  msgProgress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);

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
  msgProgress.onStateChange(null, null, Components.interfaces.nsIWebProgressListener.STATE_START, 0);
  gEnigCallbackFunc = inArg.cbFunc;

  var errorMsgObj = {};
  gProcess = EnigmailKeyServer.access(inArg.accessType, inArg.keyServer, inArg.keyList, procListener, errorMsgObj);
  if (!gProcess) {
    EnigAlert(EnigmailLocale.getString("sendKeysFailed") + "\n" + EnigConvertGpgToUnicode(errorMsgObj.value));
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
      progressBar.onStateChange(null, null, Components.interfaces.nsIWebProgressListener.STATE_STOP, 0);
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
