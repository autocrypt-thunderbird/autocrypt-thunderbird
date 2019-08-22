/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptURIs = ChromeUtils.import("chrome://autocrypt/content/modules/uris.jsm").AutocryptURIs;

var EXPORTED_SYMBOLS = ["AutocryptMessageCache"];

var AutocryptMessageCache = {
  message_cache: [],
  current_folder: null,
  disabled: false,

  setDisabled(disabled) {
    this.disabled = disabled;
  },

  shouldCacheByStatus: function(verify_status) {
    return verify_status && (verify_status.isDecryptOk() || verify_status.isSignOk());
  },

  maybeHandleFolderSwitch: function(folder) {
    if (this.current_folder && this.current_folder === folder) {
      return;
    }
    if (this.current_folder) {
      AutocryptLog.DEBUG(`messageCache.jsm: maybeHandleFolderSwitch(): dropping cache for folder ${this.current_folder}\n`);
      this.message_cache = [];
    }
    this.current_folder = folder;
  },

  getCachedMessage: function(uri) {
    AutocryptLog.DEBUG(`messageCache.jsm: getCachedMessage(): ${uri}\n`);
    if (this.disabled) {
      AutocryptLog.DEBUG(`messageCache.jsm: getCachedMessage(): cache is disabled\n`);
      return null;
    }
    if (!uri || uri.spec.search(/[&?]header=enigmailConvert/) >= 0) {
      return null;
    }
    let msg_identifier = getMsgIdentifier(uri);
    if (!msg_identifier) {
      return null;
    }
    for (let cache_entry of this.message_cache) {
      if (msg_identifier.folder === cache_entry.msg_identifier.folder && cache_entry.msg_identifier.msgNum === msg_identifier.msgNum) {
        AutocryptLog.DEBUG(`messageCache.jsm: getCachedMessage(): ok\n`);
        return cache_entry.decrypted_message;
      }
    }
    AutocryptLog.DEBUG(`messageCache.jsm: getCachedMessage(): not cached\n`);
    return null;
  },

  putCachedMessage: function(uri, decrypted_message) {
    if (!uri || uri.spec.search(/[&?]header=enigmailConvert/) >= 0) {
      return;
    }
    if (this.getCachedMessage(uri)) {
      return;
    }
    AutocryptLog.DEBUG(`messageCache.jsm: putCachedMessage(): ${uri}\n`);
    let msg_identifier = getMsgIdentifier(uri);
    if (!msg_identifier) {
      return;
    }
    this.maybeHandleFolderSwitch(msg_identifier.folder);
    this.message_cache.push({msg_identifier: msg_identifier, decrypted_message: decrypted_message});
  }
};

function getMsgIdentifier(uri) {
  let msg_identifier = AutocryptURIs.msgIdentificationFromUrl(uri);
  AutocryptLog.DEBUG(`messageCache.jsm: getMsgIdentifier(): ${JSON.stringify(msg_identifier)}\n`);
  return msg_identifier;
}
