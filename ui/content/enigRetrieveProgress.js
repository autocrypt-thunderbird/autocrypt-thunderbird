/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * The contents of this file are subject to the Netscape Public License
 * Version 1.0 (the "License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Communicator client code, 
 * released March 31, 1998. 
 *
 * The Initial Developer of the Original Code is Netscape Communications 
 * Corporation.  Portions created by Netscape are 
 * Copyright (C) 1998 Netscape Communications Corporation.  All Rights
 * Reserved.
 *
 * Contributors:
 *     William A. ("PowerGUI") Law <law@netscape.com>
 *     Scott MacGregor <mscott@netscape.com>
 *     jean-Francois Ducarroz <ducarroz@netscape.com>
 */

var msgCompDeliverMode = Components.interfaces.nsIMsgCompDeliverMode;

// dialog is just an array we'll use to store various properties from the dialog document...
var dialog;

// the msgProgress is a nsIMsgProgress object
var msgProgress = null;

// random global variables...
var targetFile;
var itsASaveOperation = false;

// all progress notifications are done through the nsIWebProgressListener implementation...
var progressListener = {
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus)
    {
      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_START)
      {
        // Put progress meter in undetermined mode.
        // dialog.progress.setAttribute( "value", 0 );
        dialog.progress.setAttribute( "mode", "undetermined" );
      }

      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
      {
        // we are done sending/saving the message...
        // Indicate completion in status area.

        // Put progress meter at 100%.
        dialog.progress.setAttribute( "value", 100 );
        dialog.progress.setAttribute( "mode", "normal" );
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
      /*if (aMessage != "")
        dialog.status.setAttribute("value", aMessage); */
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


function loadDialog()
{
}

function onLoad() {
    // Set global variables.
    var subject = "";
    msgProgress = window.arguments[0];
    if (window.arguments[1])
    {
      var progressParams = window.arguments[1].QueryInterface(Components.interfaces.nsIMsgComposeProgressParams)
      if (progressParams)
      {
        itsASaveOperation = (progressParams.deliveryMode != msgCompDeliverMode.Now);
        subject = progressParams.subject;
      }
    }

    if ( !msgProgress ) {
        dump( "Invalid argument to downloadProgress.xul\n" );
        window.close()
        return;
    }

    dialog = new Object;
    dialog.strings = new Array;
    dialog.progress    = document.getElementById("dialog.progress");

    // Set up dialog button callbacks.
    var object = this;
    doSetOKCancel("", function () { return object.onCancel();});

    // Fill dialog.
    loadDialog();

    // set our web progress listener on the helper app launcher
    msgProgress.registerListener(progressListener);
    moveToAlertPosition();

    //We need to delay the set title else dom will overwrite it
    //window.setTimeout(SetTitle, 0, subject);
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
