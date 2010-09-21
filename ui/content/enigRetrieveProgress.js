/*
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net>
 * are Copyright (C) 2005 Patrick Brunschwig.
 * All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */

// Uses: chrome://enigmail/content/enigmailCommon.js

Components.utils.import("resource://enigmail/enigmailCommon.jsm");

// Initialize enigmailCommon
EnigInitCommon("enigRetrieveProgress");

var msgCompDeliverMode = Components.interfaces.nsIMsgCompDeliverMode;

// dialog is just an array we'll use to store various properties from the dialog document...
var dialog;

// the msgProgress is a nsIMsgProgress object
var msgProgress = null;

// random global variables...
var targetFile;
var itsASaveOperation = false;
var gEnigIpcRequest = null;
var gEnigCallbackFunc = null;

// all progress notifications are done through the nsIWebProgressListener implementation...
var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus)
  {
    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_START)
    {
      // dialog.progress.setAttribute( "value", 0 );
      // Put progress meter in undetermined mode.
      dialog.progress.setAttribute( "mode", "undetermined" );
    }

    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
    {
      // we are done transmitting
      // Indicate completion in status area.

      // Put progress meter at 100%.
      dialog.progress.setAttribute( "value", 100 );
      dialog.progress.setAttribute( "mode", "normal" );

      if (msgProgress.processCanceledByUser)
        enigSendKeyCancel(msgProgress);

      window.close();
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
  {
  },

  onLocationChange: function(aWebProgress, aRequest, aLocation)
  {
    // we can ignore this notification
  },

  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage)
  {
    // we can ignore this notification
  },

  onSecurityChange: function(aWebProgress, aRequest, state)
  {
    // we can ignore this notification
  },

  QueryInterface : function(iid)
  {
    if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};


function onLoad() {
  // Set global variables.
  var inArg = window.arguments[0];
  window.arguments[1].result=false;

  dialog = new Object;
  dialog.strings = new Array;
  dialog.progress    = document.getElementById("dialog.progress");

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  // Set up dialog button callbacks.
  var object = this;
  doSetOKCancel("", function () { return object.onCancel();});


  var statTxt=document.getElementById("dialog.status2");
  if (inArg.accessType == nsIEnigmail.UPLOAD_KEY) {
    statTxt.value=EnigCommon.getString("keyserverProgress.uploading");
    subject = EnigCommon.getString("keyserverTitle.uploading");
  }
  else {
    statTxt.value=EnigCommon.getString("keyserverProgress.refreshing");
    var subject = EnigCommon.getString("keyserverTitle.refreshing");
  }

  msgProgress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
  var requestObserver = new EnigRequestObserver(enigSendKeyTerminate, {'progressBar': msgProgress, 'callType': 1});

  msgProgress.registerListener(progressListener);
  msgProgress.onStateChange(null, null, Components.interfaces.nsIWebProgressListener.STATE_START, 0)
  gEnigCallbackFunc = inArg.cbFunc;

  var errorMsgObj={};
  gEnigIpcRequest = enigmailSvc.receiveKey(inArg.accessType, inArg.keyServer, inArg.keyList, requestObserver, errorMsgObj);
  if (gEnigIpcRequest == null) {
    EnigAlert(EnigCommon.getString("sendKeysFailed")+"\n"+EnigConvertGpgToUnicode(errorMsgObj.value));
  }

  window.title = subject;
}

function onUnload()
{
  if (msgProgress)
  {
   try
   {
     msgProgress.unregisterListener(progressListener);
     msgProgress = null;
   }

   catch( exception ) {}
  }
}

// If the user presses cancel, tell the app launcher and close the dialog...
function onCancel ()
{

  try
  {
    msgProgress.processCanceledByUser = true;
  }
  catch( ex ) {return true;}

  // don't Close up dialog by returning false, the backend will close the dialog when everything will be aborted.
  return false;
}

function enigSendKeyTerminate (terminateArg, ipcRequest) {
  EnigCommon.DEBUG_LOG("enigmailRetrieveProgress.js: enigSendKeyTerminate\n");

  if (gEnigIpcRequest) {
    var cbFunc = gEnigCallbackFunc;
    var keyRetrProcess = gEnigIpcRequest.pipeTransport;
    var exitCode;

    var enigmailSvc = GetEnigmailSvc();
    if (keyRetrProcess && !keyRetrProcess.isRunning) {
      keyRetrProcess.terminate();
      exitCode = keyRetrProcess.exitValue;
      EnigCommon.DEBUG_LOG("enigmailRetrieveProgress.js: enigSendKeyTerminate: exitCode = "+exitCode+"\n");
      if (enigmailSvc) {
        exitCode = enigmailSvc.fixExitCode(exitCode, 0);
      }
    }

    var statusText=cbFunc(exitCode, "", false);

    var errorMsg="";
    try {
      var gpgConsole = gEnigIpcRequest.stderrConsole.QueryInterface(Components.interfaces.nsIPipeConsole);

      if (gpgConsole && gpgConsole.hasNewData()) {
        errorMsg = gpgConsole.getByteData(new Object());
        if (enigmailSvc) {
          var statusFlagsObj=new Object();
          var statusMsgObj=new Object();
          errorMsg=EnigCommon.parseErrorOutput(errorMsg, statusFlagsObj, statusMsgObj);
        }
      }
    } catch (ex) {}

    EnigCommon.DEBUG_LOG("enigmailRetrieveProgress.js: enigSendKeyTerminate: errorMsg="+errorMsg);
    if (errorMsg.search(/ec=\d+/i)>=0) {
      exitCode=-1;
    }
    statusText=cbFunc(exitCode, "", false);
    cbFunc(exitCode, errorMsg, true);
    if (exitCode == 0) {
        window.arguments[1].result=true;
    }

    gEnigIpcRequest.close(true);
  }

  if (terminateArg && terminateArg.progressBar) {
    try {
      terminateArg.progressBar.onStateChange(null, null, Components.interfaces.nsIWebProgressListener.STATE_STOP, 0);
    }
    catch (ex) {}
  }
}

function enigSendKeyCancel() {
  var keyRetrProcess = gEnigIpcRequest.pipeTransport;

  if (keyRetrProcess && !keyRetrProcess.isRunning) {
    keyRetrProcess.terminate();
  }
  gEnigIpcRequest.close(true);
  gEnigIpcRequest=null;
  gEnigCallbackFunc=null;
}
