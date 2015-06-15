/*global Components: false */
/*jshint -W097 */
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
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Ramalingam Saravanan <svn@xmlterm.org>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
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

"use strict";

const EXPORTED_SYMBOLS = [ "KeyServer" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/httpProxy.jsm"); /*global HttpProxy: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */

const nsIEnigmail = Ci.nsIEnigmail;

const KeyServer = {
    /**
     * search, download or upload key on, from or to a keyserver
     *
     * @actionFlags: Integer - flags (bitmap) to determine the required action
     *                         (see nsIEnigmail - Keyserver action flags for details)
     * @keyserver:   String  - keyserver URL (optionally incl. protocol)
     * @searchTerms: String  - space-separated list of search terms or key IDs
     * @listener:    Object  - execStart Listener Object. See execStart for details.
     * @errorMsgObj: Object  - object to hold error message in .value
     *
     * @return:      Subprocess object, or null in case process could not be started
     */
    access: function (actionFlags, keyserver, searchTerms, listener, errorMsgObj) {
        Log.DEBUG("keyserver.jsm: access: "+searchTerms+"\n");

        if (!keyserver) {
            errorMsgObj.value = Locale.getString("failNoServer");
            return null;
        }

        if (!searchTerms && ! (actionFlags & nsIEnigmail.REFRESH_KEY)) {
            errorMsgObj.value = Locale.getString("failNoID");
            return null;
        }

        const proxyHost = HttpProxy.getHttpProxy(keyserver);
        let args = Gpg.getStandardArgs(true);

        if (actionFlags & nsIEnigmail.SEARCH_KEY) {
            args = Gpg.getStandardArgs(false).
                concat(["--command-fd", "0", "--fixed-list", "--with-colons"]);
        }
        if (proxyHost) {
            args = args.concat(["--keyserver-options", "http-proxy="+proxyHost]);
        }
        args = args.concat(["--keyserver", keyserver]);

        //     if (actionFlags & nsIEnigmail.SEARCH_KEY | nsIEnigmail.DOWNLOAD_KEY | nsIEnigmail.REFRESH_KEY) {
        //       args = args.concat(["--command-fd", "0", "--fixed-list", "--with-colons"]);
        //     }

        let inputData = null;
        const searchTermsList = searchTerms.split(" ");

        if (actionFlags & nsIEnigmail.DOWNLOAD_KEY) {
            args.push("--recv-keys");
            args = args.concat(searchTermsList);
        } else if (actionFlags & nsIEnigmail.REFRESH_KEY) {
            args.push("--refresh-keys");
        } else if (actionFlags & nsIEnigmail.SEARCH_KEY) {
            args.push("--search-keys");
            args = args.concat(searchTermsList);
            inputData = "quit\n";
        } else if (actionFlags & nsIEnigmail.UPLOAD_KEY) {
            args.push("--send-keys");
            args = args.concat(searchTermsList);
        }

        const isDownload = actionFlags & (nsIEnigmail.REFRESH_KEY | nsIEnigmail.DOWNLOAD_KEY);

        Log.CONSOLE("enigmail> "+Files.formatCmdLine(EnigmailGpgAgent.agentPath, args)+"\n");

        let proc = null;
        let exitCode = null;

        try {
            proc = subprocess.call({
                command:     EnigmailGpgAgent.agentPath,
                arguments:   args,
                environment: EnigmailCore.getEnvList(),
                charset: null,
                stdin: inputData,
                stdout: function(data) {
                    listener.stdout(data);
                },
                stderr: function(data) {
                    if (data.search(/^\[GNUPG:\] ERROR/m) >= 0) {
                        exitCode = 4;
                    }
                    listener.stderr(data);
                },
                done: function(result) {
                    try {
                        if (result.exitCode === 0 && isDownload) {
                            KeyRing.invalidateUserIdList();
                        }
                        if (exitCode === null) {
                            exitCode = result.exitCode;
                        }
                        listener.done(exitCode);
                    } catch (ex) {}
                },
                mergeStderr: false
            });
        } catch (ex) {
            Log.ERROR("keyserver.jsm: access: subprocess.call failed with '"+ex.toString()+"'\n");
            throw ex;
        }

        if (!proc) {
            Log.ERROR("keyserver.jsm: access: subprocess failed due to unknown reasons\n");
            return null;
        }

        return proc;
    }
};
