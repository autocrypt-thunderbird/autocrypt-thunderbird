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

const pepServerPath = "/usr/local/bin/pep-mt-server";
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
var gPepServerStdin = null;
var gPepServerStdout = "";

var EnigmailpEp = {

  /**
   * get the pEp version number
   *
   * @return: Promise.
   *  then:  String - version identifier
   *  catch: String, String - failure code, error description
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
      let jsonData = EnigmailFiles.readFile(fileHandle);

      if (jsonData.length > 0) {
        try {
          gConnectionInfo = JSON.parse(jsonData);
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
   * get the path to the GnuPG executable
   *
   * @return: Promise.
   *  then:  String - Full path to gpg executable
   *  catch: String, String - failure code, error description
   */
  getGpgPath: function() {

    let onLoad = function(responseObj) {
      let path = null;

      if ("result" in responseObj) {
        path = responseObj.result[0];
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
   *  catch: String, String - failure code, error description
   */
  encryptMessage: function(fromAddr, toAddrList, subject, message, pEpMode) {

    let deferred = Promise.defer();
    let self = this;

    if (pEpMode === null) pEpMode = 5;
    if (!toAddrList) toAddrList = [];
    if (typeof(toAddrList) === "string") toAddrList = [toAddrList];

    this._withSession(deferred,
      function(sessionId) {
        try {
          let msgId = "enigmail-" + String(gRequestId++);
          let params = [
            sessionId, // session
            { // src message
              "id": msgId,
              "dir": 1,
              "shortmsg": subject,
              "longmsg": message,
              "from": {
                "user_id": "",
                "username": "name",
                "address": fromAddr,
              },
              to: toAddrList.reduce(function _f(p, addr) {
                p.push({
                  "user_id": "",
                  "username": "name",
                  "address": addr,
                });
                return p;
              }, [])
            },
            [], // extra
            ["OP"], // dest
            pEpMode // encryption_format
          ];

          return self._callPepFunction(FT_CALL_FUNCTION, "encrypt_message", params);

        }
        catch (ex) {
          deferred.reject(makeError("PEP-ERROR", ex));
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
   * @param sender    : String          - sender email address
   *
   * @return: Promise.
   *  then:  returned result
   *  catch: String, String - failure code, error description
   */
  decryptMessage: function(message, sender) {

    let deferred = Promise.defer();
    let self = this;

    if (!sender) sender = "unknown@localhost";

    this._withSession(deferred,
      function(sessionId) {
        try {
          let msgId = "enigmail-" + String(gRequestId++);
          let params = [
            sessionId, // session
            { // src message
              "id": msgId,
              "dir": 0,
              "shortmsg": "",
              "longmsg": message,
              "from": {
                "address": sender
              },
              "to": []
            },
            ["OP"], // msg Output
            ["OP"], // StringList Output
            ["OP"], // pep color Output
            ["OP"] // undefined
          ];

          return self._callPepFunction(FT_CALL_FUNCTION, "decrypt_message", params);


        }
        catch (ex) {
          deferred.reject(makeError("PEP-ERROR", ex));
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
   *  catch: String, String - failure code, error description
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
          deferred.reject(makeError("PEP-ERROR", ex));
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
   *  catch: String, String - failure code, error description
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
          deferred.reject(makeError("PEP-ERROR", ex));
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
          deferred.reject("PEP-ERROR", null, "Invalid response: " + JSON.stringify(responseObj));
          return null;
        }
        sessionId = responseObj.session;

        return sessionFunc(sessionId);
      }
      catch (ex) {
        deferred.reject(makeError("PEP-ERROR", ex, JSON.stringify(responseObj)));
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
      function(reason) {
        deferred.reject(reason);
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
   * @param onErrorListene  - function: if the call fails, callback function of the form:
   *            funcName(responseText)
   * @param deferred         - object: optional Promise.defer() object
   *
   * @return Object - a Promise
   */
  _callPepFunction: function(funcType, functionName, paramsArr, onLoadListener, onErrorListener, deferred) {
    if (!deferred) deferred = Promise.defer();
    let self = this;

    // TODO: check if security_token is valid

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
        let parsedObj = JSON.parse(this.responseText);
        let r = onLoadListener(parsedObj);

        if ("error" in r) {
          if (r.error.code === -32600) {
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

    let conn = self.getConnectionInfo();
    oReq.open("POST", conn + funcType);
    oReq.send(JSON.stringify(functionCall));

    return deferred.promise;
  },

  /**
   * internal function to start pEp server if not available
   */

  _startPepServer: function(funcType, deferred, functionCall, onLoadListener) {
    let self = this;

    let exec = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    exec.initWithPath(pepServerPath);

    try {
      if (!exec.isExecutable()) {
        deferred.reject(makeError("PEP-unavailable", null, "Cannot find JSON-PEP executable"));
        return;
      }

      EnigmailCore.getService(null, true);
      observeShutdown();

      let process = subprocess.call({
        command: exec,
        charset: null,
        environment: EnigmailCore.getEnvList(),
        mergeStderr: false,
        stdin: function(stdin) {
          gPepServerStdin = stdin;
        },
        stdout: function(data) {
          // do nothing
        },
        stderr: function(data) {
          // do nothing
        }
      });

      EnigmailTimer.setTimeout(function _f() {
          let oReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

          oReq.addEventListener("load", function _onload() {
            try {
              let parsedObj = JSON.parse(this.responseText);
              let r = onLoadListener(parsedObj);

              deferred.resolve(r);
            }
            catch (ex) {
              deferred.reject(makeError("PEP-ERROR", ex, this.responseText));
            }
          });

          oReq.addEventListener("error", function(e) {
              deferred.reject(makeError("PEP-unavailable", null, "Cannot establish connection to PEP service"));
            },
            false);

          oReq.open("POST", self.getConnectionInfo() + funcType);
          oReq.send(JSON.stringify(functionCall));
        },
        1500);
    }
    catch (ex) {
      deferred.reject("PEP-unavailable", ex.toString());
    }
  }
};


// Mozilla-specific shutdown observer to stop pep mt-server
function observeShutdown() {
  // Register to observe XPCOM shutdown
  const NS_OBSERVERSERVICE_CONTRACTID = "@mozilla.org/observer-service;1";
  const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";

  const obsServ = Cc[NS_OBSERVERSERVICE_CONTRACTID].getService().
  QueryInterface(Ci.nsIObserverService);
  obsServ.addObserver({
      observe: function(aSubject, aTopic, aData) {
        if (aTopic == NS_XPCOM_SHUTDOWN_OBSERVER_ID) {
          // XPCOM shutdown
          if (gPepServerStdin) {
            gPepServerStdin.write("q\n");
            gPepServerStdin.close();
          }
        }
      }
    },
    NS_XPCOM_SHUTDOWN_OBSERVER_ID,
    false);
}

function makeError(str, ex, msg) {
  let o = {
    code: str,
    exception: ex,
    message: (msg ? msg : (ex ? ex.toString() : ""))
  };

  return o;
}
