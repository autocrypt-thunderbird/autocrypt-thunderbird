/*global Components: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-invalid-this: 0 */

/**
 * This module serves to integrate pEp into Enigmail
 *
 * The module is still a prototype - not ready for daily use!
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailpEp"];

const FT_CALL_FUNCTION = "callFunction";
const FT_CREATE_SESSION = "createSession";

var gPepHome = null;

var gPepServerPath = null;
var gLogFunction = null;
var gShuttingDown = false;

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.importGlobalProperties(["XMLHttpRequest"]);
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://gre/modules/PromiseUtils.jsm"); /* global PromiseUtils: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */

var gRequestId = 1;
var gConnectionInfo = null;
var gRetryCount = 0;
var gTbListener = null;
var gRequestQueue = [];
var gXmlReq;


var EnigmailpEp = {

  /**
   * In case of failures, an error object with the following structure is returned to the
   * catch() method of the promise:
   *   code     : String, one of: PEP-ERROR, PEP-unavailable
   *   exception: JavaScript exception object (may be null)
   *   message  : an error message describing the failure
   */

  /*
   * pEpPerson:
   *  - user_id
   *  - username
   *  - address
   */

  /**
   * get the pEp version number
   *
   * @return: Promise.
   *  then:  String - version identifier
   *  catch: Error object (see above)
   */
  getPepVersion: function() {
    DEBUG_LOG("getPepVersion()");
    let onLoad = function(responseObj) {
      let version = null;

      if ("result" in responseObj) {
        version = responseObj.result.return;
      }
      return version;
    };

    return this._callPepFunction(FT_CALL_FUNCTION, "serverVersion", [], onLoad);
  },

  getPepHomeDir: function() {
    if (gPepHome) return gPepHome;
    let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    let pepHomeDir = env.get("PEPHOME");
    if (pepHomeDir === "") {
      if (EnigmailOS.isDosLike) {
        pepHomeDir = (env.get("LocalAppData") + "\\pEp");
      }
      else {
        pepHomeDir = (env.get("HOME") + "/.pEp");
      }
    }
    DEBUG_LOG("pEpAdapter.jsm: getPepHomeDir() = '" + pepHomeDir + "'");
    gPepHome = pepHomeDir;
    return pepHomeDir;
  },

  /**
   * Provide the pEp Connection info. If necessary, load the data from file
   *
   * @return String - URL to connecto to pEp JSON Server
   */
  getConnectionInfo: function() {
    DEBUG_LOG("getConnectionInfo()");
    if (!gConnectionInfo) {
      let fileHandle = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      EnigmailFiles.initPath(fileHandle, this.getPepHomeDir());
      fileHandle.append("json-token");

      if (!fileHandle.exists()) {
        /* try legacy place for up to (30) Krombach */
        let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
        let tmpDir = env.get("TEMP");
        let userName = env.get("USER");

        fileHandle = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        EnigmailFiles.initPath(fileHandle, (tmpDir !== "" ? tmpDir : "/tmp"));
        fileHandle.append("pEp-json-token-" + (userName !== "" ? userName : "XXX"));
      }

      let jsonData = EnigmailFiles.readBinaryFile(fileHandle);

      if (jsonData.length > 0) {
        try {
          // we cannot use parseJSON here, it won't work before TB has finished initialization
          gConnectionInfo = this.parseJSON(jsonData);
          if (gConnectionInfo.address === "0.0.0.0") {
            gConnectionInfo.address = "127.0.0.1";
          }
        }
        catch (ex) {}
      }
    }

    let o = gConnectionInfo;

    if (!gConnectionInfo) {
      o = {
        // provide a default (that should fail)
        address: "127.0.0.1",
        port: 0,
        path: "/none/",
        pathQueryRef: "/none/",
        security_token: ""
      };
    }

    return "http://" + o.address + ":" + o.port + ("path" in o ? o.path : o.pathQueryRef);
  },


  /**
   * get the path to the GnuPG executable, and the env. variables GNUPGHOME and GPG_AGENT_INFO
   *
   * @return: Promise.
   *  then:  String - Full path to gpg executable
   *  catch: Error object (see above)
   */
  getGpgEnv: function() {
    DEBUG_LOG("getGpgEnv()");
    let onLoad = function(responseObj) {
      if ("result" in responseObj) {
        return responseObj.result.return;
      }

      return responseObj;
    };

    return this._callPepFunction(FT_CALL_FUNCTION, "getGpgEnvironment", [], onLoad);

  },


  /**
   * Register a debugging log function.
   * The log function must have the form f(logDataStr)
   *
   * @param logFunction: function - the function to register
   */

  registerLogHandler: function(logFunction) {
    gLogFunction = logFunction;
    DEBUG_LOG("registered log handler");
  },

  /**
   * encrypt a message using the pEp server
   *
   * @param fromAddr  : String          - sender Email address
   * @param toAddrList: Array of String - array with all recipients
   * @param subject   : String          - the message subject
   * @param message   : String          - the message to encrypt
   * @param pEpMode   : optional Number - the PEP encryption mode:
   *                        0: none - message is not encrypted
   *                        1: inline PGP + PGP extensions
   *                        2: S/MIME (RFC5751)
   *                        3: PGP/MIME (RFC3156)
   *                        4: pEp encryption format
   *
   * @return: Promise.
   *  then:  returned result (message Object)
   *  catch: Error object (see above)
   */
  encryptMessage: function(fromAddr, toAddrList, subject, messageObj, pEpMode) {
    DEBUG_LOG("encryptMessage (" + fromAddr + ")");

    if (pEpMode === null) pEpMode = 4;
    if (!toAddrList) toAddrList = [];
    if (typeof(toAddrList) === "string") toAddrList = [toAddrList];

    messageObj.from = {
      "user_id": "",
      "username": "anonymous",
      "address": fromAddr
    };

    messageObj.to = toAddrList.reduce(function _f(p, addr) {
      p.push({
        "user_id": "",
        "username": "anonymous",
        "address": addr
      });
      return p;
    }, []);

    let msgId = "enigmail-" + String(gRequestId++);

    messageObj.shortmsg = subject;
    messageObj.id = msgId;
    messageObj.dir = 1;

    try {
      let params = [
        messageObj, // pep messge object
        [], // extra
        ["OP"], // dest
        pEpMode, // encryption_format
        0 // encryption flags
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "encrypt_message", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }

  },

  /**
   * encrypt a message using the pEp server
   *
   * @param mimeStr  : String          - complete MIME message
   * @param pEpMode   : optional Number - the PEP encryption mode:
   *                        0: none - message is not encrypted
   *                        1: inline PGP + PGP extensions
   *                        2: S/MIME (RFC5751)
   *                        3: PGP/MIME (RFC3156)
   *                        4: pEp encryption format
   * @param encryptFlags: optional Number - bitmap for encryption modes
   *                        0x0: default
   *                        0x1: force encryption
   *                        0x2: force unsigned message
   *                        0x4: do not attach own key
   *
   * @return: Promise.
   *  then:  returned result (message Object)
   *  catch: Error object (see above)
   */
  encryptMimeString: function(mimeStr, pEpMode, encryptFlags = 0) {
    DEBUG_LOG("encryptMimeString()");

    if (pEpMode === null) pEpMode = 4;

    try {
      let params = [
        mimeStr, // mimetext
        mimeStr.length, // size
        [], // extra
        ["OP"], // resulting data
        pEpMode, // encryption_format
        encryptFlags // encryption flags
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "MIME_encrypt_message", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }

  },

  /**
   * decrypt a message using the pEp server
   *
   * @param message   : String            - the message to decrypt
   * @param sender    : pEpPerson          - sender information
   * @param to        : Array of pEpPerson - recipients (To) information
   * @param sender    : Array of pEpPerson - recipients (Cc) information
   * @param replyTo   : Array of pEpPerson - Reply-to  information
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  decryptMessage: function(message, sender, to, cc, replyTo) {
    DEBUG_LOG("decryptMessage()");

    if (!sender) sender = "*";

    let msgId = "enigmail-" + String(gRequestId++);
    if (typeof(message) === "object") {
      message.shortmsg = "pEp";
      message.longmsg = "RFC 3156 message";
      message.msgId = msgId;
      message.dir = 0;
    }
    else {
      message = {
        // src message
        "shortmsg": "pEp",
        "longmsg": message,
        msgId: msgId,
        dir: 0
      };
    }

    message.from = sender;
    message.to = to;
    if (cc) {
      message.cc = cc;
    }
    if (replyTo) {
      message.reply_to = replyTo;
    }


    try {
      let params = [
        message, // pEp Message Obj
        ["OP"], // msg Output
        ["OP"], // StringList Output
        ["OP"], // pep rating Output
        ["OP"] // flags
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "decrypt_message", params);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },


  /**
   * decrypt a complete mime string using the pEp server
   *
   * @param mimeStr  : String          - complete MIME message
   *
   * @return: Promise.
   *  then:  returned result (message Object)
   *  catch: Error object (see above)
   */
  decryptMimeString: function(mimeStr) {
    DEBUG_LOG("decryptMimeString()");

    try {
      let params = [
        mimeStr, // mimetext
        mimeStr.length, // size
        ["OP"], // extra
        ["OP"], // resulting data
        ["OP"], // rating
        ["OP"] // decryption flags
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "MIME_decrypt_message", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }

  },

  /**
   * determine the rating (=trust level) of a pEp Identity
   *
   * @param userId    : Object          - pEp Identity to check
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */

  getIdentityRating: function(userId) {
    DEBUG_LOG("getIdentityRating()");
    try {
      let params = [{
          "address": userId.address
        },
        [""] // rating
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "identity_rating", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }

  },

  /**
   * tell pEp our own user identity
   *
   * @param idObject -  Object:
   *  - address: email Address
   *  - user_id: user ID (usually TOFU_email@address)
   *  - username: name of person (Firstname Lastname),
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */

  setMyself: function(idObject) {
    DEBUG_LOG("setMyself()");
    try {
      idObject.user_id = "pEp_own_userId";
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "myself", params);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * Update an identity
   *
   * @param idObject -  Object:
   *  - address: email Address
   *  - user_id: user ID (usually TOFU_email@address)
   *  - username: name of person (Firstname Lastname)
   */

  updateIdentity: function(idObject) {
    DEBUG_LOG("updateIdentity()");
    try {
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "update_identity", params);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * get a user identity from pEp
   *
   * @param emailAddress: String          - the email address
   * @param userId      : String          - unique C string to identify person that identity is refering to
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  getIdentity: function(emailAddress, userId) {
    DEBUG_LOG("getIdentity()");
    if (!userId) userId = "";
    if (!emailAddress) emailAddress = "";

    try {
      let params = [
        emailAddress,
        userId, ["OP"]
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "get_identity", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },


  /**
   * get all own identities from pEp
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  getOwnIdentities: function() {
    DEBUG_LOG("getOwnIdentities()");

    try {
      let params = [
        ["OP"]
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "own_identities_retrieve", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * check the trustwords for a pair of keys
   *
   * @param id1:      Object          - the 1st pEp ID to check
   * @param id2:      Object          - the 2nd pEp ID to check
   * @param language: String          - language (2-letter ISOCODE)
   * @param longList: Boolean         - if true, return complete list of trustWords, otherwise
   *                                     return short list (default = false)
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  getTrustWords: function(id1, id2, language, longList = false) {
    DEBUG_LOG("getTrustWords()");

    try {
      let params = [
        id1,
        id2,
        language.toUpperCase(), ["OP"], // words
        ["OP"], // words_size
        longList
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "get_trustwords", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * set the trust level of a user identity in pEp to "trusted"
   *
   * @param idObject: Object          - pEp Identity object
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  trustIdentity: function(idObject) {
    DEBUG_LOG("trustIdentity()");
    try {

      if ("comm_type" in idObject) {
        delete idObject.comm_type;
      }
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "trust_personal_key", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * reset the trust level of a user identity in pEp
   *
   * @param idObject: Object          - pEp Identity object
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  resetIdentityTrust: function(idObject) {
    DEBUG_LOG("resetIdentityTrust()");
    try {

      if ("comm_type" in idObject) {
        delete idObject.comm_type;
      }
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "key_reset_trust", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },


  /**
   * reset the trust level of a user identity in pEp
   *
   * @param idObject: Object          - pEp Identity object
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  mistrustIdentity: function(idObject) {
    DEBUG_LOG("mistrustIdentity()");
    try {
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "key_mistrusted", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * reset the trust level of a user identity in pEp
   *
   * @param partnerId:   Object - pEp Identity object of partner
   * @param resultValue: Number - Handshake result value (from pEp sync.h):
   *                    SYNC_HANDSHAKE_CANCEL  = -1
   *                    SYNC_HANDSHAKE_ACCEPTED = 0
   *                    SYNC_HANDSHAKE_REJECTED = 1
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  deliverHandshakeResult: function(partnerId, resultValue) {
    DEBUG_LOG("deliverHandshakeResult()");
    try {
      let params = [partnerId, resultValue];

      return this._callPepFunction(FT_CALL_FUNCTION, "deliverHandshakeResult", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * get list of languaes for which pEp trustwords are available
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  getLanguageList: function() {
    DEBUG_LOG("getLanguageList()");

    try {
      let params = [
        ["OP"] // list of languages
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "get_languagelist", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * Process the output from pEp for the language list and return an array of languages
   *
   * @param languageStr - String: string of pEp output
   *
   * @return Array of Object:
   *            - short: 2-Letter ISO-Codes
   *            - long:  Language name in the language
   *            - desc:  Describing sentence in the language
   */
  processLanguageList: function(languageStr) {

    if ((typeof(languageStr) === "object") && ("result" in languageStr)) {
      let inArr = languageStr.result.outParams[0].split(/\n/);
      let outArr = inArr.reduce(function _f(p, langLine) {
        let y = langLine.split(/","/);
        if (langLine.length > 0) p.push({
          short: y[0].replace(/^"/, ""),
          long: y[1],
          desc: y[2].replace(/"$/, "")
        });
        return p;
      }, []);
      return outArr;
    }
    return [];
  },

  /**
   * determine the trust rating that an outgoing message would receive
   *
   * @param from:    Object (pEpPerson)          - sender
   * @param to:      Array of Object (pEpPerson) - array with all recipients
   * @param message: String                      - the message to encrypt
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  outgoingMessageRating: function(from, to, message) {
    DEBUG_LOG("outgoingMessageRating()");

    if (!to) to = [];

    try {
      let msgId = "enigmail-" + String(gRequestId++);
      let params = [{ // src message
          "id": msgId,
          "dir": 1,
          "longmsg": message,
          "from": from,
          "to": to
        },
        "O"
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "outgoing_message_rating", params);

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * Get list of all blaclisted keys (fpr)
   */
  blacklistGetKeyList: function() {
    DEBUG_LOG("blacklistGetKeyList()");
    try {
      let params = [
        "O"
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "blacklist_retrieve", params);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  blacklistAddKey: function(fpr) {
    DEBUG_LOG("blacklistAddKey()");
    try {
      let params = [
        fpr
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "blacklist_add", params);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  blacklistDeleteKey: function(fpr) {
    DEBUG_LOG("blacklistDeleteKey()");
    try {
      let params = [
        fpr
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "blacklist_delete", params);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },


  startKeyserverLookup: function() {
    DEBUG_LOG("startKeyserverLookup()");
    try {
      return this._callPepFunction(FT_CALL_FUNCTION, "startKeyserverLookup", []);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  stopKeyserverLookup: function() {
    DEBUG_LOG("stopKeyserverLookup()");
    try {
      return this._callPepFunction(FT_CALL_FUNCTION, "stopKeyserverLookup", []);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  startKeySync: function() {
    DEBUG_LOG("startKeySync()");
    try {
      return this._callPepFunction(FT_CALL_FUNCTION, "startKeySync", []);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  stopKeySync: function() {
    DEBUG_LOG("stopKeySync()");
    try {
      return this._callPepFunction(FT_CALL_FUNCTION, "stopKeySync", []);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },


  /**
   * Enable or disable the passive mode for pEp.
   * Passive mode means that no key is attached to a message
   *
   * @param isPassive: Boolean - true: enable passive mode / false: disable passive mode
   */
  setPassiveMode: function(isPassive) {
    DEBUG_LOG("setPassiveMode()");
    try {
      let params = [
        isPassive
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "config_passive_mode", params);
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * Stop the pEp adapter.
   *
   * @return: Promise.
   */

  shutdown: function() {
    DEBUG_LOG("shutdown()");

    let deferred = PromiseUtils.defer();

    gShuttingDown = true;
    let onLoad = function() {
      dropXmlRequest();
      gConnectionInfo = null;
      gShuttingDown = false;
      return 0;
    };

    return this._callPepFunction(FT_CALL_FUNCTION, "shutdown", [], onLoad, onLoad).
    then(x => {
      onLoad();
    }).
    catch(x => {
      onLoad();
    });
  },

  registerTbListener: function(port, securityToken) {
    gTbListener = {
      port: port,
      securityToken: securityToken
    };

    return this.registerListener();
  },


  registerListener: function() {
    DEBUG_LOG("registerListener()");

    try {
      if (gTbListener) {
        let params = [
          "127.0.0.1",
          gTbListener.port,
          gTbListener.securityToken
        ];

        return this._callPepFunction(FT_CALL_FUNCTION, "registerEventListener", params);
      }
      else {
        let deferred = PromiseUtils.defer();
        deferred.resolve(0);
        return deferred.promise;
      }

    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  unregisterListener: function(port, securityToken) {
    DEBUG_LOG("unregisterListener()");

    gShuttingDown = true;

    try {

      if (gTbListener) {
        let params = [
          "127.0.0.1",
          gTbListener.port,
          gTbListener.securityToken
        ];

        return this._callPepFunction(FT_CALL_FUNCTION, "unregisterEventListener", params);
      }
      else {
        let deferred = PromiseUtils.defer();
        deferred.resolve(0);
        return deferred.promise;
      }
    }
    catch (ex) {
      let deferred = PromiseUtils.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  /**
   * parse a JSON string. Ensure that character codes < 32 are correctly escaped first
   *
   * @param str - String: string in JSON notation
   *
   * @return whatever JSON.parse returns
   */
  parseJSON: function(str) {
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) < 32) {
        let c = str.charCodeAt(i);
        if (!(c == 13 || c == 10)) {
          str = str.substr(0, i) + "\\u" + c.toLocaleString("en-US", {
            useGrouping: false,
            minimumIntegerDigits: 4
          }) + str.substr(i + 1);
        }
      }
    }

    try {
      return JSON.parse(str);
    }
    catch (x) {
      return null;
    }

  },

  setServerPath: function(pathName) {
    DEBUG_LOG("setServerPath() = " + pathName);

    gPepServerPath = pathName;
  },

  /******************* internal (private) methods *********************/
  /**
   * Asynchronously call a pEp function
   *
   * @param funcType     -      String: one of FT_CALL_FUNCTION and FT_CREATE_SESSION
   * @param functionName      - String: the pEp function name
   * @param paramsArr         - Array : parameter array for pEp function
   * @param onLoadListener  - function: if the call is successful, callback function of the form:
   *            funcName(responseObj)
   * @param onErrorListene  - function: if the call fails, callback function of the form:
   *            funcName(responseText)
   * @param deferred         - object: optional PromiseUtils.defer() object
   *
   * @return Object - a Promise
   */
  _callPepFunction: function(funcType, functionName, paramsArr, onLoadListener, onErrorListener, deferred) {
    DEBUG_LOG("_callPepFunction(" + funcType + ", " + functionName + ")");

    if (!deferred) deferred = PromiseUtils.defer();
    let self = this;

    let conn = this.getConnectionInfo();

    let functionCall = {
      "security_token": (gConnectionInfo ? gConnectionInfo.security_token : ""),
      "method": functionName,
      "params": paramsArr,
      "id": gRequestId++,
      "jsonrpc": "2.0"
    };

    let loadListener = onLoadListener;
    if (!onLoadListener) {
      loadListener = function(obj) {
        return obj;
      };
    }

    let errorListener = onErrorListener;
    if (!onErrorListener) {
      errorListener = function(txt) {
        return txt;
      };
    }

    let onloadFunc = function _f() {
      try {
        DEBUG_LOG("XMLHttpRequest: onload()");
        let parsedObj = self.parseJSON(this.responseText);

        if ((typeof(parsedObj) === "object") && ("error" in parsedObj)) {
          if (parsedObj.error.code === -32600) {
            // wrong security token
            gConnectionInfo = null;

            self.getConnectionInfo();
            ++gRetryCount;

            if (gRetryCount < 2) {
              self.registerListener()
                .then(function _f() {
                  self._callPepFunction(funcType, functionName, paramsArr, loadListener, errorListener, deferred);
                });
              return;
            }
          }
        }
        else {
          gRetryCount = 0;
        }

        let r = loadListener(parsedObj);
        deferred.resolve(r);
      }
      catch (ex) {
        deferred.reject(makeError("PEP-ERROR", ex, this.responseText));
      }
    };

    let onerrorFunc = function(e) {
      DEBUG_LOG("XMLHttpRequest: got error: " + e);

      dropXmlRequest();
      if (!gShuttingDown) {
        self._startPepServer(funcType, deferred, functionCall, onLoadListener, function _f() {
          let r = errorListener(this.responseText);
          deferred.resolve(r);
        });
      }
      else {
        deferred.resolve({
          result: -1
        });
      }
    };

    let url = conn + funcType;
    let data = JSON.stringify(functionCall);
    executeXmlRequest(url, data, onloadFunc, onerrorFunc);

    return deferred.promise;
  },

  /**
   * internal function to start pEp server if not available
   */

  _startPepServer: function(funcType, deferred, functionCall, onLoadListener) {
    DEBUG_LOG("_startPepServer:(" + funcType + ")");

    let self = this;

    if (!gPepServerPath) {
      DEBUG_LOG("_startPepServer: cannot find executable");
      deferred.reject(makeError("PEP-unavailable", null, "Cannot find JSON-PEP executable"));
    }

    let exec = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);

    try {
      exec.initWithPath(gPepServerPath);
      if ((!exec.exists()) || (!exec.isExecutable())) {
        DEBUG_LOG("_startPepServer: executable not available");
        deferred.reject(makeError("PEP-unavailable", null, "Cannot find JSON-PEP executable"));
        return;
      }

      EnigmailCore.getService(null, true);

      let resourcesDir = exec.parent.parent;
      resourcesDir.append("share");
      resourcesDir.append("pEp");

      let resDirPath = undefined;

      if (resourcesDir && resourcesDir.exists()) {
        resDirPath = resourcesDir.path;
      }

      let env = [];
      let envAppData = null,
        envUserProfile = null;
      let envHome = null,
        envGnuPgHome = null;

      EnigmailCore.getEnvList().map(function(item) {

        if (item.startsWith("APPDATA="))
          envAppData = item.substr(8);
        else if (item.startsWith("USERPROFILE="))
          envUserProfile = item.substr(12);
        else if (item.startsWith("HOME="))
          envHome = item.substr(5);
        else if (item.startsWith("GNUPGHOME="))
          envGnuPgHome = item.substr(10);

        env.push(item);
      });
      if (EnigmailOS.isDosLike) {
        if (envHome === null) {
          envHome = (envUserProfile === null ? "\\" : envUserProfile);
          env.push("HOME=" + envHome);
        }
        if (envGnuPgHome === null) {
          envGnuPgHome = (envAppData === null ? "" : envAppData) + "\\gnupg";
          env.push("GNUPGHOME=" + envGnuPgHome);
        }
      }

      let foundGnuPG = true;

      let stderrData = "";
      let process = subprocess.call({
        workdir: resDirPath,
        command: exec,
        charset: null,
        environment: env,
        mergeStderr: false,
        stdin: function(stdin) {
          // do nothing
        },
        stdout: function(data) {
          DEBUG_LOG("stdout from pep-json-server: " + data);
        },
        stderr: function(data) {
          if (stderrData.length < 2048) {
            stderrData += data;

            if (stderrData.length > 0) {
              if (stderrData.search(/PEP_INIT_(CANNOT_DETERMINE_GPG_VERSION|UNSUPPORTED_GPG_VERSION|GPGME_INIT_FAILED|CANNOT_LOAD_GPGME)/) >= 0) {
                foundGnuPG = false;
                deferred.reject(makeError("GNUPG-UNAVAILABLE", null, "gpg not found"));
              }
            }
          }
        }
      });

      if (!EnigmailOS.isDosLike) process.wait();
      DEBUG_LOG("_startPepServer: JSON startup done");

      if (!foundGnuPG) {
        return;
      }

      DEBUG_LOG("_startPepServer: JSON server started");

      gConnectionInfo = null;

      // wait trying to access the pEp server for 1 second such that it can open the connection
      // and write the connection info file

      EnigmailTimer.setTimeout(function _f() {
        self.getConnectionInfo();
        functionCall.security_token = (gConnectionInfo ? gConnectionInfo.security_token : "");

        let url = self.getConnectionInfo() + funcType;

        let onloadFunc = function _onload() {
          DEBUG_LOG("XMLHttpRequest: onload()");
          try {
            let parsedObj = self.parseJSON(this.responseText);
            let r = onLoadListener(parsedObj);

            deferred.resolve(r);
          }
          catch (ex) {
            deferred.reject(makeError("PEP-ERROR", ex, this.responseText));
          }
        };

        let onerrorFunc = function(e) {
          DEBUG_LOG("XMLHttpRequest: got error: " + e);

          dropXmlRequest();

          deferred.reject(makeError("PEP-unavailable", null, "Cannot establish connection to PEP service"));
        };

        let data = JSON.stringify(functionCall);
        executeXmlRequest(url, data, onloadFunc, onerrorFunc);

      }, 1000);
    }
    catch (ex) {
      deferred.reject(makeError("PEP-unavailable", ex, "Cannot start PEP service"));
    }
  }
};

function DEBUG_LOG(logStr) {
  if (gLogFunction) gLogFunction("pEp.jsm: " + logStr + "\n");
}


function makeError(str, ex, msg) {
  let o = {
    code: str,
    exception: ex,
    message: (msg ? msg : (ex ? ex.toString() : ""))
  };

  return o;
}

function dropXmlRequest() {
  if (gXmlReq) {
    gXmlReq.abort();
  }
  gXmlReq = null;
}

/**
 * Establish connection to pEp JSON server and send request.
 * The connection is kept open to allow for per-connection settings in pEp;
 * All requests are queued and processed one after the other.
 *
 * @param url:        String - the URL to call, using POST
 * @param data:       String - JSON object to send
 * @param onloadFunc  Function - onload function of XMLHttpRequest
 * @param onerrorFunc Function - onerror function of XMLHttpRequest
 */
function executeXmlRequest(url, data, onloadFunc, onerrorFunc) {
  DEBUG_LOG("executeXmlRequest(" + url + ")");

  let req = {
    url: url,
    data: data,
    onloadFunc: onloadFunc,
    onerrorFunc: onerrorFunc,
    reqId: gRequestId
  };

  gRequestQueue.push(req);

  if (!gXmlReq) {
    gXmlReq = new XMLHttpRequest();
    gXmlReq.onloadend = function() {
      DEBUG_LOG("executeXmlRequest: onloadEnd");
      processNextXmlRequest();
    };
  }

  processNextXmlRequest();
}

/**
 * Process next request from request queue
 */
function processNextXmlRequest() {
  DEBUG_LOG("processNextXmlRequest(): length = " + gRequestQueue.length);
  if (gXmlReq && gRequestQueue.length > 0) {
    DEBUG_LOG("processNextXmlRequest: readyState == " + gXmlReq.readyState);
    if (gXmlReq.readyState === 0 || gXmlReq.readyState === 4) {
      let r = gRequestQueue.shift();

      gXmlReq.onload = r.onloadFunc.bind(gXmlReq);
      gXmlReq.onerror = r.onerrorFunc.bind(gXmlReq);
      gXmlReq.open("POST", r.url);
      gXmlReq.send(r.data);
    }
  }
}
