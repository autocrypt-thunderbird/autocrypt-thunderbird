/*global Components: false, escape: false, unescape: false */
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

const EXPORTED_SYMBOLS = [ "EnigmailAttachment" ];

const Cu = Components.utils;

Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/passwords.jsm"); /*global EnigmailPassword: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */

const EnigmailAttachment = {
    getFileName: function (parent, byteData) {
        EnigmailLog.DEBUG("attachment.jsm: getFileName\n");

        const args = EnigmailGpg.getStandardArgs(true).
                  concat(EnigmailPassword.command()).
                  concat(["--list-packets"]);

        const listener = EnigmailExecution.newSimpleListener(
            function _stdin (pipe) {
                EnigmailLog.DEBUG("attachment.jsm: getFileName: _stdin\n");
                pipe.write(byteData);
                pipe.write("\n");
                pipe.close();
            });

        const proc = EnigmailExecution.execStart(EnigmailGpgAgent.agentPath, args, false, parent, listener, {});

        if (!proc) {
            return null;
        }

        proc.wait();

        const matches = listener.stdoutData.match(/:literal data packet:\r?\n.*name="(.*)",/m);
        if (matches && (matches.length > 1)) {
            var filename = escape(matches[1]).replace(/%5Cx/g, "%");
            return EnigmailData.convertToUnicode(unescape(filename), "utf-8");
        } else {
            return null;
        }
    }
};
