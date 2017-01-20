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

var gPepServerPath = null;
const pepSecurityInfo = "/pEp-json-token-";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/promise.jsm"); /*global Promise: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */

var gRequestId = 1;
var gConnectionInfo = null;
var gRetryCount = 0;

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

    let onLoad = function(responseObj) {
      let version = null;

      if ("result" in responseObj) {
        version = responseObj.result;
      }
      return version;
    };

    return this._callPepFunction(FT_CALL_FUNCTION, "get_engine_version", [], onLoad);

  },

  /**
   * Provide the pEp Connection info. If necessary, load the data from file
   *
   * @return String - URL to connecto to pEp JSON Server
   */
  getConnectionInfo: function() {
    if (!gConnectionInfo) {
      let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);

      let tmpDir = env.get("TEMP");
      let userName = env.get("USER");

      let fileName = (tmpDir !== "" ? tmpDir : "/tmp") +
        pepSecurityInfo + (userName !== "" ? userName : "XXX");

      let fileHandle = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      EnigmailFiles.initPath(fileHandle, fileName);
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
        port: 1234,
        path: "/none/",
        security_token: ""
      };
    }

    return "http://" + o.address + ":" + o.port + o.path;
  },


  /**
   * get the path to the GnuPG executable, and the env. variables GNUPGHOME and GPG_AGENT_INFO
   *
   * @return: Promise.
   *  then:  String - Full path to gpg executable
   *  catch: Error object (see above)
   */
  getGpgEnv: function() {

    let onLoad = function(responseObj) {
      if ("result" in responseObj) {
        return responseObj.result[0];
      }

      return responseObj;
    };

    return this._callPepFunction(FT_CALL_FUNCTION, "getGpgEnvironment", [], onLoad);

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
      let deferred = Promise.defer();
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
   *
   * @return: Promise.
   *  then:  returned result (message Object)
   *  catch: Error object (see above)
   */
  encryptMimeString: function(mimeStr, pEpMode) {

    if (pEpMode === null) pEpMode = 4;

    try {
      let params = [
        mimeStr, // mimetext
        mimeStr.length, // size
        [], // extra
        ["OP"], // resulting data
        pEpMode, // encryption_format
        0 // encryption flags
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "MIME_encrypt_message", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
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
        ["OP"], // pep color Output
        ["OP"] // flags
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "decrypt_message", params);
    }
    catch (ex) {
      let deferred = Promise.defer();
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
   *
   * @return: Promise.
   *  then:  returned result (message Object)
   *  catch: Error object (see above)
   */
  decryptMimeString: function(mimeStr) {

    try {
      let params = [
        mimeStr, // mimetext
        mimeStr.length, // size
        [], // extra
        ["OP"], // resulting data
        ["OP"], // rating
        ["OP"] // decryption flags
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "MIME_decrypt_message", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }

  },

  /**
   * determine the rating (=trust level) of a pEp Identity
   *
   * @param userId    : Object          - pEp Identity to check
   *
   * one of mailAddr/userId may be null
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */

  getIdentityRating: function(userId) {
    try {
      let params = [
        userId, [""] // color
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "identity_rating", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }

  },

  /**
   * set a user identity in pEp
   *
   * @param idObject -  Object:
   *  - address: email Address
   *  - fpr: fingerprint
   *  - user_id: user ID (usually TOFU_email@address)
   *  - username: name of person (Firstname Lastname),
   *  - comm_type: type of communication (and trust)
   *  - me: is this myself?
   *  - flags
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: Error object (see above)
   */
  setIdentity: function(idObject) {
    try {
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "set_identity", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
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
      let deferred = Promise.defer();
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

    try {
      let params = [
        ["OP"]
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "own_identities_retrieve", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
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
      let deferred = Promise.defer();
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
    try {

      if ("comm_type" in idObject) {
        delete idObject.comm_type;
      }
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "trust_personal_key", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
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
    try {

      if ("comm_type" in idObject) {
        delete idObject.comm_type;
      }
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "key_reset_trust", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
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
    try {
      let params = [idObject];

      return this._callPepFunction(FT_CALL_FUNCTION, "key_mistrusted", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
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

    try {
      let params = [
        ["OP"] // list of languages
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "get_languagelist", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },


  /**
   * determine the trust color (rating) that an outgoing message would receive
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
      let deferred = Promise.defer();
      deferred.reject(makeError("PEP-ERROR", ex));
      return deferred.promise;
    }
  },

  registerListener: function(port, securityToken) {

    try {
      let params = [
        "127.0.0.1",
        port,
        securityToken
      ];

      return this._callPepFunction(FT_CALL_FUNCTION, "registerEventListener", params);

    }
    catch (ex) {
      let deferred = Promise.defer();
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
   * @param deferred         - object: optional Promise.defer() object
   *
   * @return Object - a Promise
   */
  _callPepFunction: function(funcType, functionName, paramsArr, onLoadListener, onErrorListener, deferred) {
    if (!deferred) deferred = Promise.defer();
    let self = this;

    let conn = this.getConnectionInfo();

    let functionCall = {
      "security_token": (gConnectionInfo ? gConnectionInfo.security_token : ""),
      "method": functionName,
      "params": paramsArr,
      "id": gRequestId++,
      "jsonrpc": "2.0"
    };

    // create a XMLHttpRequest() in Mozilla priviledged environment
    let oReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

    if (!onLoadListener) {
      onLoadListener = function(obj) {
        return obj;
      };
    }

    oReq.addEventListener("load", function _f() {
      try {
        let parsedObj = self.parseJSON(this.responseText);

        if ((typeof(parsedObj) === "object") && ("error" in parsedObj)) {
          if (parsedObj.error.code === -32600) {
            // wrong security token
            gConnectionInfo = null;

            self.getConnectionInfo();
            ++gRetryCount;

            if (gRetryCount < 2) {
              self._callPepFunction(funcType, functionName, paramsArr, onLoadListener, onErrorListener, deferred);
              return;
            }
          }
        }
        else {
          gRetryCount = 0;
        }

        let r = onLoadListener(parsedObj);
        deferred.resolve(r);
      }
      catch (ex) {
        deferred.reject(makeError("PEP-ERROR", ex, this.responseText));
      }
    });

    if (!onErrorListener) {
      onErrorListener = function(txt) {
        return txt;
      };
    }

    oReq.addEventListener("error", function(e) {
        self._startPepServer(funcType, deferred, functionCall, onLoadListener, function _f() {
          let r = onErrorListener(this.responseText);
          deferred.resolve(r);
        });
      },
      false);

    oReq.open("POST", conn + funcType);
    oReq.send(JSON.stringify(functionCall));

    return deferred.promise;
  },

  /**
   * internal function to start pEp server if not available
   */

  _startPepServer: function(funcType, deferred, functionCall, onLoadListener) {
    let self = this;

    if (!gPepServerPath) {
      deferred.reject(makeError("PEP-unavailable", null, "Cannot find JSON-PEP executable"));
    }

    let exec = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);

    try {
      exec.initWithPath(gPepServerPath);
      if ((!exec.exists()) || (!exec.isExecutable())) {
        deferred.reject(makeError("PEP-unavailable", null, "Cannot find JSON-PEP executable"));
        return;
      }

      EnigmailCore.getService(null, true);

      let process = subprocess.call({
        command: exec,
        charset: null,
        environment: EnigmailCore.getEnvList(),
        mergeStderr: false,
        stdin: function(stdin) {
          // do nothing
        },
        stdout: function(data) {
          // do nothing
        },
        stderr: function(data) {
          // do nothing
        }
      });

      process.wait();

      gConnectionInfo = null;

      // wait trying to access the pEp server for 1 second such that it can open the connection
      // and write the connection info file

      EnigmailTimer.setTimeout(function _f() {
        self.getConnectionInfo();
        functionCall.security_token = (gConnectionInfo ? gConnectionInfo.security_token : "");

        let oReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

        oReq.addEventListener("load", function _onload() {
          try {
            let parsedObj = self.parseJSON(this.responseText);
            let r = onLoadListener(parsedObj);

            deferred.resolve(r);
          }
          catch (ex) {
            deferred.reject(makeError("PEP-ERROR", ex, this.responseText));
          }
        });

        oReq.addEventListener("error", function(e) {
            let status = oReq.channel.QueryInterface(Ci.nsIRequest).status;

            deferred.reject(makeError("PEP-unavailable", null, "Cannot establish connection to PEP service"));
          },
          false);

        oReq.open("POST", self.getConnectionInfo() + funcType);
        oReq.send(JSON.stringify(functionCall));
      }, 1000);
    }
    catch (ex) {
      deferred.reject(makeError("PEP-unavailable", ex, "Cannot start PEP service"));
    }
  }
};


function makeError(str, ex, msg) {
  let o = {
    code: str,
    exception: ex,
    message: (msg ? msg : (ex ? ex.toString() : ""))
  };

  return o;
}
