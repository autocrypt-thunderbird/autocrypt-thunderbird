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

const connectAddress = "http://127.0.0.1:2369";
const baseUrl = "/ja/0.1/";

const FT_CALL_FUNCTION = "callFunction";
const FT_CREATE_SESSION = "createSession";

const pepServerPath = "/Users/pbr/enigmail/pEp/pEpJSONServerAdapter/server/mt-server";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://enigmail/promise.jsm"); /*global Promise: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */

var gRequestId = 1;

var EnigmailpEp = {

  /**
   * get the pEp version number
   *
   * @return: Promise.
   *  then:  String - version identifier
   *  catch: String, String - failure code, errer description
   */
  getPepVersion: function() {

    let onLoad = function(responseObj) {
      let version = null;

      if ("result" in responseObj) {
        version = responseObj.result;
      }
      return version;
    };

    return this._callPepFunction(FT_CALL_FUNCTION, "version", [], onLoad);

  },


  /**
   * get the path to the GnuPG executable
   *
   * @return: Promise.
   *  then:  String - Full path to gpg executable
   *  catch: String, String - failure code, errer description
   */
  getGpgPath: function() {

    let onLoad = function(responseObj) {
      let path = null;

      if ("result" in responseObj) {
        path = responseObj; //.result[0];
      }
      return path;
    };

    return this._callPepFunction(FT_CALL_FUNCTION, "get_gpg_path", [
      ["OP"]
    ], onLoad);

  },


  /**
   * encrypt a message using the pEp server
   *
   * @param fromAddr  : String          - sender Email address
   * @param toAddrList: Array of String - array with all recipients
   * @param message   : String          - the message to encrypt
   * @param pEpMode   : Number          - the PEP encryption mode (0-5)
   *
   * @return: Promise.
   *  then:  returned result (message Object)
   *  catch: String, String - failure code, errer description
   */
  encryptMessage: function(fromAddr, toAddrList, message, pEpMode) {

    let deferred = Promise.defer();
    let self = this;

    if (!toAddrList) toAddrList = [];

    this._withSession(deferred,
      function(sessionId) {
        try {
          let msgId = "enigmail-" + String(gRequestId++);
          let params = [
            sessionId, // session
            { // src message
              "id": msgId,
              "dir": 1,
              "shortmsg": message,
              "from": {
                "user_id": "",
                "username": "",
                "address": fromAddr,
                "fpr": ""
              },
              to: toAddrList.reduce(function _f(p, addr) {
                p.push({
                  "user_id": "",
                  "username": "",
                  "address": addr,
                  "fpr": ""
                });
                return p;
              }, [])
            },
            [""], // extra
            [""], // dest
            pEpMode // encryption_format
          ];

          return self._callPepFunction(FT_CALL_FUNCTION, "encrypt_message", params);

        }
        catch (ex) {
          deferred.reject("PEP-ERROR", ex.toString());
        }

        return null;
      }
    );

    return deferred.promise;
  },

  /**
   * decrypt a message using the pEp server
   *
   * @param message   : String          - the message to decrypt
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: String, String - failure code, errer description
   */
  decryptMessage: function(message) {

    let deferred = Promise.defer();
    let self = this;

    this._withSession(deferred,
      function(sessionId) {
        try {
          let msgId = "enigmail-" + String(gRequestId++);
          let params = [
            sessionId, // session
            { // src message
              "id": msgId,
              "dir": 0,
              "longmsg": message
            },
            ["xyz"], // extra
            ["OP"], // dest
            ["c"] // color
          ];

          return self._callPepFunction(FT_CALL_FUNCTION, "decrypt_message", params);

        }
        catch (ex) {
          deferred.reject("PEP-ERROR", ex.toString());
        }

        return null;
      }
    );

    return deferred.promise;
  },

  /**
   * determine the trust color of a pEp Identity
   *
   * @param mailAddr  : String          - Email address to check
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: String, String - failure code, errer description
   */

  identityColor: function(mailAddr) {
    let deferred = Promise.defer();
    let self = this;

    let pepId = {
      "user_id": "",
      "username": "",
      "address": mailAddr,
      "fpr": ""
    };

    this._withSession(deferred,
      function(sessionId) {
        try {
          let params = [
            sessionId, // session
            pepId, [""] // color
          ];

          return self._callPepFunction(FT_CALL_FUNCTION, "identity_color", params);

        }
        catch (ex) {
          deferred.reject("PEP-ERROR", ex.toString());
        }

        return null;
      }
    );

    return deferred.promise;
  },

  /**
   * determine the trust color that an outgoing message would receive
   *
   * @param fromAddr  : String          - sender Email address
   * @param toAddrList: Array of String - array with all recipients
   * @param message   : String          - the message to encrypt
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: String, String - failure code, errer description
   */
  outgoingMessageColor: function(fromAddr, toAddrList, message) {

    let deferred = Promise.defer();
    let self = this;

    if (!toAddrList) toAddrList = [];

    this._withSession(deferred,
      function(sessionId) {
        try {
          let msgId = "enigmail-" + String(gRequestId++);
          let params = [
            sessionId, // session
            { // src message
              "id": msgId,
              "dir": 1,
              "longmsg": message,
              "from": {
                "user_id": "",
                "username": "",
                "address": fromAddr,
                "fpr": ""
              },
              to: toAddrList.reduce(function _f(p, addr) {
                p.push({
                  "user_id": "",
                  "username": "",
                  "address": addr,
                  "fpr": ""
                });
                return p;
              }, [])
            },
            "O"
          ];

          return self._callPepFunction(FT_CALL_FUNCTION, "outgoing_message_color", params);

        }
        catch (ex) {
          deferred.reject("PEP-ERROR", ex.toString());
        }

        return null;
      }
    );

    return deferred.promise;
  },

  /******************* internal (private) methods *********************/
  /**
   * Create a session , execute a function within the session and release
   * the session at the end.
   *
   * @param deferred    - Object  : a Promise.defer()-ed Object
   * @param sessionFunc - function: a function definition of the form:
   *            funcName(sessionId)   - sessionId will contain the initialied session
   *
   * @return a Promise object
   */

  _withSession: function(deferred, sessionFunc) {
    let self = this;
    let sessionId = "";

    this._callPepFunction(FT_CREATE_SESSION, "createSession", ['.']).
    then(function(responseObj) {
      try {

        if (!("session" in responseObj)) {
          deferred.reject("PEP-ERROR", "invalid response: " + JSON.stringify(responseObj));
          return null;
        }
        sessionId = responseObj.session;

        return sessionFunc(sessionId);
      }
      catch (ex) {
        deferred.reject("PEP-ERROR", ex.toString());
      }
      return null;
    }).
    then(
      function(responseObj) {
        let params = [sessionId];
        deferred.resolve(responseObj);

        return self._callPepFunction(FT_CALL_FUNCTION, "releaseSession", params);
      }
    ).
    catch(
      function(response, desc) {
        deferred.reject(response, desc);
      }
    );

    return deferred.promise;
  },

  /**
   * Asynchronously call a pEp function
   *
   * @param funcType     -      String: one of FT_CALL_FUNCTION and FT_CREATE_SESSION
   * @param functionName      - String: the pEp function name
   * @param paramsArr         - Array : parameter array for pEp function
   * @param onLoadListener  - function: if the call is successful, callback function of the form:
   *            funcName(responseObj)
   * @param onErrorListener - function: if the call fails, callback function of the form:
   *            funcName(responseText)
   *
   * @return Object - a Promise
   */
  _callPepFunction: function(funcType, functionName, paramsArr, onLoadListener, onErrorListener) {
    let deferred = Promise.defer();
    let self = this;

    let functionCall = {
      "method": functionName,
      "params": paramsArr,
      "id": gRequestId++,
      "jsonrpc": "2.0"
    };

    // create a XMLHttpRequest() in Mozilla priviledged environment
    let oReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

    if (!onLoadListener) {
      onLoadListener = function(txt) {
        return txt;
      };
    }

    oReq.addEventListener("load", function _f() {
      try {
        let parsedObj = JSON.parse(this.responseText);
        let r = onLoadListener(parsedObj);
        deferred.resolve(r);
      }
      catch (ex) {

      }
    });

    if (!onErrorListener) {
      onErrorListener = function(txt) {
        return txt;
      };
    }

    oReq.addEventListener("error", function(e) {
        self._startPepServer(funcType, deferred, functionCall, function _f() {
          let r = onErrorListener(this.responseText);
          deferred.resolve(r);
        });
      },
      false);


    oReq.open("POST", connectAddress + baseUrl + funcType);
    oReq.send(JSON.stringify(functionCall));

    return deferred.promise;
  },

  /**
   * internal function to start pEp server if not available
   */

  _startPepServer: function(funcType, deferred, functionCall, onLoadListener) {
    let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

    let exec = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    exec.initWithPath(pepServerPath);

    try {
      if (!exec.isExecutable()) {
        deferred.reject("PEP-unavailable", "Cannot find JSON-PEP executable");
        return;
      }

      process.init(exec);
      process.run(false, [], 0);

      EnigmailTimer.setTimeout(function _f() {
          let oReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

          oReq.addEventListener("load", onLoadListener);

          oReq.addEventListener("error", function(e) {
              deferred.reject("PEP-unavailable", "Cannot establish connection to PEP service");
            },
            false);

          oReq.open("POST", connectAddress + baseUrl + funcType);
          oReq.send(JSON.stringify(functionCall));
        },
        1500);
    }
    catch (ex) {
      deferred.reject("PEP-unavailable", ex.toString());
    }
  }
};
