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
 * Copyright (C) 2012 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Marius Stübs <marius.stuebs@riseup.net>
 *  Fan Jiang <fanjiang@thoughtworks.com>
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

const EXPORTED_SYMBOLS = [ "Key" ];

const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global Log: false */

function KeyEntry(key) {
    if (!(this instanceof KeyEntry)) {
        return new KeyEntry(key);
    }
    // same data as in packetlist but in structured form
    this.primaryKey = null;
    this.revocationSignature = null;
    this.directSignatures = null;
    this.users = null;
    this.subKeys = null;
    this.packetlist2structure(this.parsePackets(key));
    if (!this.primaryKey || !this.users) {
        throw new Error('Invalid key: need at least key and user ID packet');
    }
    return this;
}

KeyEntry.prototype = {
    parsePackets: function(key) {
        const packetHeaders = [":public key packet:",
            ":user ID packet:",
            ":public sub key packet:",
            ":secret sub key packet:",
            ":signature packet:",
            ":secret key packet:"];
        var _packets = [];
        function extractPackets(line){
            var is_packet_hr = false;
            packetHeaders.forEach(
                function (packet) {
                    if (line.search(packet) > -1) {
                        is_packet_hr = true;
                        var obj = {tag:packet,value:""};
                        _packets.push(obj);
                    }
                });
            if(!is_packet_hr) {
                var obj = _packets.pop();
                obj.value += line+"\n";
                _packets.push(obj);
            }
        }
        var lines = key.split("\n");
        for (var i in  lines) {
            if(!lines[i].startsWith("gpg:")) extractPackets(lines[i]);
        }
        return _packets;
    },

    packetlist2structure: function (packetlist) {
        for (var i = 0; i < packetlist.length; i++) {
            var user, subKey;

            switch (packetlist[i].tag) {
                case ":secret key packet:":
                    this.primaryKey = packetlist[i];
                    break;
                case ":user ID packet:":
                    if (!this.users) this.users = [];
                    user = packetlist[i];
                    this.users.push(user);
                    break;
                case ":public sub key packet:":
                case ":secret sub key packet:":
                    user = null;
                    if (!this.subKeys) this.subKeys = [];
                    subKey = packetlist[i];
                    this.subKeys.push(subKey);
                    break;
                case ":signature packet:":
                    break;
            }
        }
    }
};

const Key = {
    Entry: KeyEntry,

    /**
     * Format a key fingerprint
     * @fingerprint |string|  -  unformated OpenPGP fingerprint
     *
     * @return |string| - formatted string
     */
    formatFpr: function (fingerprint) {
        Log.DEBUG("key.jsm: Key.formatFpr(" + fingerprint + ")\n");
        // format key fingerprint
        let r="";
        const fpr = fingerprint.match(/(....)(....)(....)(....)(....)(....)(....)(....)(....)?(....)?/);
        if (fpr && fpr.length > 2) {
            fpr.shift();
            r=fpr.join(" ");
        }

        return r;
    },

    // Extract public key from Status Message
    extractPubkey: function (statusMsg) {
        const matchb = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);
        if (matchb && (matchb.length > 3)) {
            Log.DEBUG("enigmailCommon.jsm:: Enigmail.extractPubkey: NO_PUBKEY 0x"+matchb[3]+"\n");
            return matchb[2]+matchb[3];
        } else {
            return null;
        }
    }
};
