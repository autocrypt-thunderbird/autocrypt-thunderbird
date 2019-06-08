/*global Components: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* eslint no-invalid-this: 0, no-loop-func: 0 */

"use strict";

var EnigmailCore = ChromeUtils.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
var EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
var EnigmailLocale = ChromeUtils.import("chrome://enigmail/content/modules/locale.jsm").EnigmailLocale;
var EnigmailKeyServer = ChromeUtils.import("chrome://enigmail/content/modules/keyserver.jsm").EnigmailKeyServer;
var EnigmailErrorHandling = ChromeUtils.import("chrome://enigmail/content/modules/errorHandling.jsm").EnigmailErrorHandling;
var EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;
var EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;
var EnigmailConstants = ChromeUtils.import("chrome://enigmail/content/modules/constants.jsm").EnigmailConstants;

// dialog is just an array we'll use to store various properties from the dialog document...
var gDialog;

// the msgProgress is a nsIMsgProgress object
var msgProgress = null;

// Progress Listener Object
var gProgressListener = {
  onCancel: function() {
    // onCancel will be overwritten by callee
  },

  onStart: function() {
    gDialog.progress.removeAttribute("value");
  },

  onStop: function() {
    // we are done transmitting
    // Indicate completion in status area.

    // Put progress meter at 100%.
    gDialog.progress.setAttribute("value", "100");

    window.close();
  },

  onProgress: function(percentage) {
    gDialog.progress.setAttribute("value", percentage);
  }
};


function onLoad() {
  // Set global variables.
  EnigmailLog.DEBUG("enigRetrieveProgress: onLoad\n");

  var inArg = window.arguments[0];
  window.arguments[1].result = false;

  gDialog = {};
  gDialog.strings = [];
  gDialog.progress = document.getElementById("dialog.progress");

  var enigmailSvc = EnigmailCore.getService(window);
  if (!enigmailSvc)
    return;

  msgProgress = Cc["@mozilla.org/messenger/progress;1"].createInstance(Ci.nsIMsgProgress);

  if (inArg.accessType !== EnigmailConstants.UPLOAD_WKD) {
    performKeyServerOperation(inArg);
  }
}


function performKeyServerOperation(inArg) {
  EnigmailLog.DEBUG("enigRetrieveProgress.js: performKeyServerOperation()\n");
  var subject;
  var statTxt = document.getElementById("dialog.status2");
  if (inArg.accessType == EnigmailConstants.UPLOAD_KEY || inArg.accessType == EnigmailConstants.UPLOAD_WKD) {
    statTxt.value = EnigmailLocale.getString("keyserverProgress.uploading");
    subject = EnigmailLocale.getString("keyserverTitle.uploading");
  } else {
    statTxt.value = EnigmailLocale.getString("keyserverProgress.refreshing");
    subject = EnigmailLocale.getString("keyserverTitle.refreshing");
  }

  let promise;
  switch (inArg.accessType) {
    case EnigmailConstants.DOWNLOAD_KEY:
      promise = EnigmailKeyServer.download(inArg.keyId.join(" "), inArg.keyServer, gProgressListener);
      break;
    case EnigmailConstants.UPLOAD_KEY:
      promise = EnigmailKeyServer.upload(inArg.keyId.join(" "), inArg.keyServer, gProgressListener);
      break;
    case EnigmailConstants.REFRESH_KEY:
      promise = EnigmailKeyServer.refresh(inArg.keyServer, gProgressListener);
      break;
  }

  promise.then(result => {
    processEnd(0, result);
  }).catch(errorMsg => {
    processEnd(1, errorMsg);
    window.close();
  });

  document.getElementById("progressWindow").setAttribute("title", subject);
}

function onUnload() {
  if (msgProgress) {
    try {
      msgProgress.unregisterListener(gProgressListener);
      msgProgress = null;
    } catch (exception) {}
  }
}

// If the user presses cancel, tell the app launcher and close the dialog...
function onCancel() {
  gProgressListener.onCancel();
  gProgressListener.onStop();
  return true;
}

function processEnd(resultStatus, details) {
  EnigmailLog.DEBUG(`enigmailRetrieveProgress.js: processEnd(): resultStatus=${resultStatus}\n`);

  let returnObj = window.arguments[1];
  let inArg = window.arguments[0];

  let accessType = inArg.accessType;
  let message = "";
  returnObj.exitCode = resultStatus;

  if (resultStatus === 0) {
    returnObj.result = true;

    switch (accessType) {
      case EnigmailConstants.DOWNLOAD_KEY:
      case EnigmailConstants.REFRESH_KEY:
        if (details.keyList.length === 0) {
          EnigmailDialog.info(window, EnigmailLocale.getString("keyserver.result.download.none"));
        } else if (details.keyList.length === 1 && inArg.keyId.length === 1) {
          EnigmailDialog.info(window, EnigmailLocale.getString("keyserver.result.download.1of1"));
        } else if (details.keyList.length === 1 && inArg.keyId.length > 1) {
          EnigmailDialog.info(window, EnigmailLocale.getString("keyserver.result.download.1ofN", [inArg.keyId.length]));
        } else {
          EnigmailDialog.info(window, EnigmailLocale.getString("keyserver.result.download.NofN", [details.keyList.length, inArg.keyId.length]));
        }
        break;
      case EnigmailConstants.UPLOAD_KEY:
        if (details.keyList.length === 1) {
          message = EnigmailLocale.getString("keyserver.result.uploadOne");
        } else {
          message = EnigmailLocale.getString("keyserver.result.uploadMany", [details.keyList.length]);
        }

        if (("numEmails" in details) && details.numEmails >= 0) {
          message += "\n\n" + EnigmailLocale.getString("keyUpload.verifyEmails");
        }
        EnigmailDialog.info(window, message);
    }
  } else {
    switch (accessType) {
      case EnigmailConstants.DOWNLOAD_KEY:
      case EnigmailConstants.REFRESH_KEY:
        message = EnigmailLocale.getString("receiveKeysFailed");
        break;
      case EnigmailConstants.UPLOAD_KEY:
      case EnigmailConstants.UPLOAD_WKD:
        message = EnigmailLocale.getString("sendKeysFailed");
    }
    EnigmailDialog.alert(window, message + "\n" + details.errorDetails);
  }
  gProgressListener.onStop();
}