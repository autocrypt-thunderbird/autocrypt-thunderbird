/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/**
 *  Module for dealing with received Autocrypt headers, level 0
 *  See details at https://github.com/mailencrypt/autocrypt
 */

var EXPORTED_SYMBOLS = ["EnigmailAutocrypt", "AUTOCRYPT_RECOMMEND"];

const Cr = Components.results;

Components.utils.importGlobalProperties(["crypto"]); /* global crypto: false */

const jsmime = ChromeUtils.import("resource:///modules/jsmime.jsm").jsmime;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").EnigmailFuncs;
const EnigmailMime = ChromeUtils.import("chrome://autocrypt/content/modules/mime.jsm").EnigmailMime;
const EnigmailKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").EnigmailKeyRing;
const sqlite = ChromeUtils.import("chrome://autocrypt/content/modules/sqliteDb.jsm").EnigmailSqliteDb;

const DAY_IN_MILLIS = 24 * 60 * 60 * 1000;
const AUTOCRYPT_DISCOURAGE_THRESHOLD_MILLIS = 35 * DAY_IN_MILLIS;

const AUTOCRYPT_PARAM_ADDR = "addr";
const AUTOCRYPT_PARAM_KEY_DATA = "keydata";

const AUTOCRYPT_PARAM_TYPE = "type";
const AUTOCRYPT_TYPE_1 = "1";

const AUTOCRYPT_PARAM_PREFER_ENCRYPT = "prefer-encrypt";
const AUTOCRYPT_PREFER_ENCRYPT_MUTUAL = "mutual";

const AUTOCRYPT_STATE = {
  MANUAL: 'manual',
  MUTUAL: 'mutual'
};

// critical parameters: {param: mandatory}
const CRITICAL = [ 'addr', 'type', 'keydata', 'type', 'prefer-encrypt' ];

const AUTOCRYPT_RECOMMEND = {
  DISABLE: '10-disable',
  DISCOURAGED: '20-discouraged',
  DISCOURAGED_OLD: '25-discouraged_old',
  DISCOURAGED_GOSSIP: '30-discouraged_gossip',
  AVAILABLE: '40-available',
  MUTUAL: '50-mutual'
};

function AutocryptKeyRecommendation(email, recommendation, fpr_primary) {
  this.email = email;
  this.recommendation = recommendation;
  this.fpr_primary = fpr_primary;
}

function AutocryptHeader(parameters, addr, key_data, is_prefer_encrypt_mutual) {
  this.addr = addr;
  this.key_data = key_data;
  this.is_prefer_encrypt_mutual = is_prefer_encrypt_mutual;
  this.parameters = parameters;
}

function parseAutocryptHeader(raw_header_value) {
  EnigmailLog.DEBUG("autocrypt: parseAutocryptHeader()\n");
  // fix keydata value for mime header parser, by manually quoting it
  let header_value = raw_header_value.replace(/[\r\n \t]/g, "");
  let k = header_value.search(/keydata=/);
  if (k > 0) {
    let d = header_value.substr(k);
    if (d.search(/"/) < 0) {
      header_value = header_value.replace(/keydata=/, 'keydata="') + '"';
    }
  }

  let parameters = EnigmailMime.getAllParameters(header_value);

  if (AUTOCRYPT_PARAM_TYPE in parameters) {
    if (!AUTOCRYPT_TYPE_1.equals(parameters[AUTOCRYPT_PARAM_TYPE])) {
        EnigmailLog.DEBUG("autocrypt: parseAutocryptHeader(): unsupported type parameter " + parameters[AUTOCRYPT_PARAM_TYPE] + "\n");
        return null;
    }
    delete parameters[AUTOCRYPT_PARAM_TYPE];
  }

  let base64KeyData = parameters[AUTOCRYPT_PARAM_KEY_DATA];
  delete parameters[AUTOCRYPT_PARAM_KEY_DATA];
  if (!base64KeyData) {
      EnigmailLog.DEBUG("autocrypt: parseAutocryptHeader(): missing key parameter\n");
      return null;
  }

  let key_data = atob(base64KeyData);
  if (!key_data) {
      EnigmailLog.DEBUG("autocrypt: parseAutocryptHeader(): error parsing base64 data\n");
      return null;
  }

  let addr = parameters[AUTOCRYPT_PARAM_ADDR];
  delete parameters[AUTOCRYPT_PARAM_ADDR];
  if (!addr) {
      EnigmailLog.DEBUG("autocrypt: parseAutocryptHeader(): no addr header!\n");
      return null;
  }
  addr = addr.toLowerCase();

  let isPreferEncryptMutual = false;
  let preferEncrypt = parameters[AUTOCRYPT_PARAM_PREFER_ENCRYPT];
  if (preferEncrypt && preferEncrypt.toLowerCase() == AUTOCRYPT_PREFER_ENCRYPT_MUTUAL) {
    delete parameters[AUTOCRYPT_PARAM_PREFER_ENCRYPT];
    isPreferEncryptMutual = true;
  }

  if (hasCriticalParameters(parameters)) {
      EnigmailLog.DEBUG("autocrypt: parseAutocryptHeader(): unknown critical parameter!\n");
      return null;
  }

  EnigmailLog.DEBUG(`autocrypt: parseAutocryptHeader(): ok (for ${addr})\n`);
  return new AutocryptHeader(parameters, addr, key_data, isPreferEncryptMutual);
}

function hasCriticalParameters(parameters) {
    for (const c of CRITICAL) {
        if (c in parameters) {
            return true;
        }
    }
    return false;
}

var EnigmailAutocrypt = {
  determineAutocryptRecommendations: async function(emails) {
    EnigmailLog.DEBUG(`autocrypt.jsm: determineAutocryptRecommendations(): ${emails.join(', ')}\n`);
    let peer_rows = await sqlite.retrieveAutocryptRows(emails);
    let peers = await Promise.all(peer_rows.map(row =>
      this.determineSingleAutocryptRecommendation(row)));

    EnigmailLog.DEBUG(`autocrypt.jsm: determineAutocryptRecommendations(): found ${peers.length} Autocrypt rows\n`);

    var group_recommendation = null;
    if (emails.length > peers.length) {
      group_recommendation = AUTOCRYPT_RECOMMEND.DISABLE;
    } else {
      for (const r of peers) {
        if (!group_recommendation || (r.recommendation && r.recommendation < group_recommendation)) {
          group_recommendation = r.recommendation;
        }
      }
    }

    EnigmailLog.DEBUG(`autocrypt.jsm: group recommendation: ${group_recommendation}\n`);

    return {
      group_recommendation: group_recommendation,
      peers: peers
    };
  },

  determineSingleAutocryptRecommendation: async function(row) {
    EnigmailLog.DEBUG(`autocrypt.jsm: determineSingleAutocryptRecommendation(): row=${JSON.stringify(row)}\n`);
    if (row.fpr_primary) {
      let isLastSeenOlderThanDiscourageTimespan = row.last_seen_message &&
        row.last_seen_key &&
        row.last_seen_key < (row.last_seen_message.getTime() - AUTOCRYPT_DISCOURAGE_THRESHOLD_MILLIS);

      let recommendation;
      if (isLastSeenOlderThanDiscourageTimespan) {
        recommendation = AUTOCRYPT_RECOMMEND.DISCOURAGED_OLD;
      } else if (row.is_mutual) {
        recommendation = AUTOCRYPT_RECOMMEND.MUTUAL;
      } else {
        recommendation = AUTOCRYPT_RECOMMEND.AVAILABLE;
      }
      return new AutocryptKeyRecommendation(row.email, recommendation, row.fpr_primary);
    } else if (row.fpr_primary_gossip) {
      let recommendation = AUTOCRYPT_RECOMMEND.DISCOURAGED_GOSSIP;
      return new AutocryptKeyRecommendation(row.email, recommendation, row.fpr_primary_gossip);
    } else {
      return new AutocryptKeyRecommendation(row.email, AUTOCRYPT_RECOMMEND.DISABLE, null);
    }
  },

  updateAutocryptPeerState: async function(from_addr, effective_date, autocrypt_header) {
    let current_peer = await sqlite.retrieveAutocryptRows([from_addr]);
    current_peer = current_peer && current_peer.length ? current_peer[0] : null;

    // 1. If the message’s effective date is older than the peers[from-addr].autocrypt_timestamp value, then no changes are required, and the update process terminates.
    let last_seen_key = current_peer !== null ? current_peer.last_seen_key : null;
    if (last_seen_key !== null && effective_date <= last_seen_key) {
        return;
    }

    // 2. If the message’s effective date is more recent than peers[from-addr].last_seen then set peers[from-addr].last_seen to the message’s effective date.
    let last_seen_message = current_peer !== null ? current_peer.last_seen_message : null;
    if (last_seen_message === null || effective_date > last_seen_message) {
        await sqlite.autocryptInsertOrUpdateLastSeenMessage(from_addr, effective_date);
    }

    // 3. If the Autocrypt header is unavailable, no further changes are required and the update process terminates.
    if (!autocrypt_header.key_data) {
        return;
    }

    let fpr_primary = await EnigmailKeyRing.insertOrUpdate(autocrypt_header.key_data);
    if (!fpr_primary) {
        return;
    }

    // 4. Set peers[from-addr].autocrypt_timestamp to the message’s effective date.
    // 5. Set peers[from-addr].public_key to the corresponding keydata value of the Autocrypt header.
    // 6. Set peers[from-addr].prefer_encrypt to the corresponding prefer-encrypt value of the Autocrypt header.
    await sqlite.autocryptUpdateKey(from_addr, effective_date, fpr_primary, autocrypt_header.is_prefer_encrypt_mutual);
  },

  updateAutocryptGossipPeerState: async function(effective_date, autocrypt_header) {
    if (!autocrypt_header.key_data) {
        return;
    }

    let from_addr = autocrypt_header.addr;

    // 1. If gossip-addr does not match any recipient in the mail’s To or Cc header, the update process terminates (i.e., header is ignored).
    // -> This is taken care of already!
    let current_peer = await sqlite.retrieveAutocryptRows([from_addr]);
    current_peer = current_peer && current_peer.length ? current_peer[0] : null;

    // 2. If peers[gossip-addr].gossip_timestamp is more recent than the message’s effective date, then the update process terminates.
    let last_seen_gossip = current_peer !== null ? current_peer.last_seen_gossip : null;
    if (last_seen_gossip !== null && last_seen_gossip > effective_date) {
        return;
    }

    // 3. Set peers[gossip-addr].gossip_timestamp to the message’s effective date.
    // 4. Set peers[gossip-addr].gossip_key to the value of the keydata attribute.
    await sqlite.autocryptUpdateKeyGossip(from_addr, effective_date, autocrypt_header.key_data);
  },

  processAutocryptHeaders: async function(from_addr, headerDataArr, dateSent) {
    EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader(): from=" + from_addr + "\n");

    let autocrypt_headers = headerDataArr
      .map(header => parseAutocryptHeader(header))
      .filter(x => x);
    if (autocrypt_headers.length != 1) {
      EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader(): found more than one autocrypt header\n");
      return;
    }
    let autocrypt_header = autocrypt_headers[0];

    try {
      from_addr = EnigmailFuncs.stripEmail(from_addr).toLowerCase();
    } catch (ex) {
      EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader(): error mail address\n");
      return;
    }

    if (autocrypt_header.addr != from_addr) {
      EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptHeader(): wrong mail address (got " + autocrypt_header.addr + ", expected " + from_addr + ")\n");
      return;
    }

    let effective_date;
    if (typeof dateSent === "string") {
      effective_date = jsmime.headerparser.parseDateHeader(dateSent);
    } else {
      effective_date = new Date(dateSent * 1000);
    }

    await this.updateAutocryptPeerState(from_addr, effective_date, autocrypt_header);
  },

  processAutocryptGossipHeaders: async function(headerDataArr, dateSent) {
    EnigmailLog.DEBUG(`autocrypt.jsm: processAutocryptGossipHeader(): ${headerDataArr.length} headers\n`);

    let autocrypt_headers = headerDataArr
      .map(header => parseAutocryptHeader(header))
      .filter(x => x);
    if (!autocrypt_headers.length) {
      EnigmailLog.DEBUG("autocrypt.jsm: processAutocryptGossipHeader(): no valid gossip headers\n");
      return;
    }

    let effective_date;
    if (typeof dateSent === "string") {
      effective_date = jsmime.headerparser.parseDateHeader(dateSent);
    } else {
      effective_date = new Date(dateSent * 1000);
    }

    Promise.all(autocrypt_headers.map(autocrypt_header =>
      this.updateAutocryptGossipPeerState(effective_date, autocrypt_header)));
  },

  getAutocryptSettingsByFingerprint: async function(fingerprint) {
    const autocrypt_rows = await sqlite.retrieveAutocryptRowsByFingerprint(fingerprint);
    return autocrypt_rows.filter(row => row.is_secret);
  },

  getAutocryptSettingsForIdentity: async function(fromAddr) {
    const address = EnigmailFuncs.stripEmail(fromAddr).toLowerCase();

    const autocrypt_rows = await sqlite.retrieveAutocryptRows([fromAddr]);
    if (autocrypt_rows && autocrypt_rows.length) {
      const autocrypt_row = autocrypt_rows[0];
      if (autocrypt_row.is_secret) {
        return autocrypt_row;
      }
    }

    return false;
  },

  getAutocryptHeaderContentFor: async function(email, include_preference) {
    EnigmailLog.DEBUG(`autocrypt.jsm: getAutocryptHeaderContentFor(): ${email}\n`);
    let key_data_b64 = await EnigmailKeyRing.getPublicKeyBase64ForEmail(email);
    if (!key_data_b64) {
      EnigmailLog.DEBUG(`autocrypt.jsm: getAutocryptHeaderContentFor(): no data\n`);
      return null;
    }

    let preference = "";
    if (include_preference) {
      let settings = this.getAutocryptSettingsForIdentity(email);
      if (settings && settings.is_mutual) {
        preference = "prefer-encrypt=mutual; ";
      }
    }

    EnigmailLog.DEBUG(`autocrypt.jsm: getAutocryptHeaderContentFor(): ok\n`);
    let key_data_wrapped = " " + key_data_b64.replace(/(.{72})/g, "$1\r\n ").replace(/\r\n $/, "");
    return `addr=${email}; ${preference}keydata=\r\n` + key_data_wrapped;
  }
};
