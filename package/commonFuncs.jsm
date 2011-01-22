/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
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
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org> are
 * Copyright (C) 2011 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */


/*
 * Common Enigmail crypto-related functionality
 *
 * Import into a JS component using
 * 'Components.utils.import("resource://enigmail/commonFuncs.jsm");'
 */

Components.utils.import("resource://enigmail/enigmailCommon.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailFuncs" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";


var EnigmailFuncs = {

  /**
   * download key(s) from a keyserver
   */
  downloadKeys: function (win, inputObj, resultObj)
  {
    EnigmailCommon.DEBUG_LOG("commonFuncs.jsm: downloadKeys: searchList="+inputObj.searchList+"\n");

    resultObj.importedKeys=0;

    var ioService = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
    if (ioService && ioService.offline) {
      EnigmailCommon.alert(win, EnigmailCommon.getString("needOnline"));
      return;
    }

    var valueObj = {};
    if (inputObj.searchList) {
      valueObj = { keyId: "<"+inputObj.searchList.join("> <")+">" };
    }

    var keysrvObj = new Object();

    win.openDialog("chrome://enigmail/content/enigmailKeyserverDlg.xul",
          "", "dialog,modal,centerscreen", valueObj, keysrvObj);
    if (! keysrvObj.value) {
      return;
    }

    inputObj.keyserver = keysrvObj.value;
    if (! inputObj.searchList) {
      inputObj.searchList = keysrvObj.email.split(/[,; ]+/);
    }

    win.openDialog("chrome://enigmail/content/enigmailSearchKey.xul",
          "", "dialog,modal,centerscreen", inputObj, resultObj);
  },

  /**
   * Format a key fingerprint
   */
  formatFpr: function (fingerprint)
  {
    // format key fingerprint
    var r="";
    var fpr = fingerprint.match(/(....)(....)(....)(....)(....)(....)(....)(....)(....)?(....)?/);
    if (fpr && fpr.length > 2) {
      fpr.shift();
      r=fpr.join(" ");
    }

    return r;
  },

  /**
   * get a list of plain email addresses without name or surrounding <>
   */
  stripEmail: function (mailAddrs)
  {

    var qStart, qEnd;
    while ((qStart = mailAddrs.indexOf('"')) != -1) {
       qEnd = mailAddrs.indexOf('"', qStart+1);
       if (qEnd == -1) {
         EnigmailCommon.ERROR_LOG("commonFuncs.jsm: stripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
         throw Components.results.NS_ERROR_FAILURE;
       }

       mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
    }

    // Eliminate all whitespace, just to be safe
    mailAddrs = mailAddrs.replace(/\s+/g,"");

    // Extract pure e-mail address list (stripping out angle brackets)
    mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

    return mailAddrs;
  }
};