/*global Components: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * This module serves to integrate pEp into Enigmail
 *
 * The module is still a prototype - not ready for daily use!
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailpEpListener"];





const MIN_PORT_NUM = 15900;
const MAX_PORT_NUM = 15991;

const EnigmailTb60Compat = ChromeUtils.import("chrome://enigmail/content/modules/tb60compat.jsm").EnigmailTb60Compat;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailData = ChromeUtils.import("chrome://enigmail/content/modules/data.jsm").EnigmailData;

const HTTP_OK = "200";
const HTTP_ERR_BAD_REQUEST = "400";
const HTTP_ERR_UNAUTHORIZED = "401";
const HTTP_ERR_INTERNAL_ERROR = "500";
const HTTP_ERR_NOT_IMPLEMENTED = "501";

function PepListener(callBackFunction, securityToken) {
  this.callBackFunction = callBackFunction;
  this.securityToken = securityToken;
}

function getHttpBody(req) {
  let i = req.search(/\r?\n\r?\n/);
  if (i > 0) {
    ++i;
    return req.substr(i);
  }

  return req;
}

/**
 * Create a HTTP resonse to send back
 */
function createHttpResponse(statusCode, messageData) {
  let dt = new Date();

  let retObj;
  let statusMsg;

  if (statusCode === HTTP_OK) {
    retObj = {
      jsonrpc: "2.0",
      result: {
        outParams: [],
        return: {
          status: 0,
          hex: "PEP_STATUS_OK"
        }
      },
      id: messageData
    };
    statusMsg = "OK";
  }
  else {
    retObj = {
      jsonrpc: "2.0",
      error: {
        code: -statusCode,
        message: messageData
      }
    };
    statusMsg = messageData;
  }

  let data = JSON.stringify(retObj);

  let msg = "HTTP/1.1 " + statusCode + " " + statusMsg + "\r\n" +
    "Content-Type: text/plain\r\n" +
    "Date: " + dt.toUTCString() + "\r\n" +
    "Content-Length: " + (data.length + 2) + "\r\n\r\n" + data + "\r\n";

  return msg;
}


PepListener.prototype = {

  QueryInterface: EnigmailTb60Compat.generateQI(["nsIServerSocketListener"]),

  reader: {
    self: null,

    onInputStreamReady: function(input) {
      let sin = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      sin.init(input);
      let requestData = "";

      try {
        while (sin.available()) {
          requestData += sin.read(512);
        }
      }
      catch (ex) {
        EnigmailLog.DEBUG("pEpListener.onInputStreamReady: input stream closed\n");
        return;
      }

      EnigmailLog.DEBUG("pEpListener.onInputStreamReady: got data '" + requestData + "'\n");

      let responseData = this.self.handleHttpRequest(requestData);

      EnigmailLog.DEBUG("pEpListener.onInputStreamReady: sending response '" + responseData + "'\n");

      this.self.output.write(responseData, responseData.length);
      this.self.output.flush();

      let tm = Cc["@mozilla.org/thread-manager;1"].getService();
      input.asyncWait(this.self.reader, 0, 0, tm.mainThread);
    }
  },

  onSocketAccepted: function(serverSocket, clientSocket) {
    EnigmailLog.DEBUG("pEpListener.onSocketAccepted: New connection on " + serverSocket.port + "\n");
    this.clientSocket = clientSocket;
    this.serverSocket = serverSocket;
    this.input = clientSocket.openInputStream(0, 0, 0).QueryInterface(Ci.nsIAsyncInputStream);
    this.output = clientSocket.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);
    this.reader.self = this;
    let tm = Cc["@mozilla.org/thread-manager;1"].getService();
    this.input.asyncWait(this.reader, 0, 0, tm.mainThread);

  },

  onStopListening: function(serverSocket, status) {
    EnigmailLog.DEBUG("pEpListener.onStopListening: Closing connection on " + serverSocket.port + "\n");
  },

  /**
   * handle a HTTP request and return the HTTP response message string
   *
   * @param requestData - String: HTTP request
   *
   * @return String: HTTP response
   */
  handleHttpRequest: function(requestData) {
    let responseData = "";
    let obj;

    if (requestData.search(/^POST/i) === 0) {
      requestData = getHttpBody(requestData);

      requestData = EnigmailData.convertToUnicode(requestData, "utf-8");

      try {
        obj = JSON.parse(requestData);
      }
      catch (ex) {
        return createHttpResponse(HTTP_ERR_BAD_REQUEST, "Bad request: no proper JSON object.");
      }

      try {
        let tok = this.securityToken;
        if ("security_token" in obj && obj.security_token === this.securityToken) {
          let msgId = 1;
          if ("id" in obj) {
            msgId = obj.id;
          }

          if (this.callBackFunction) {
            let r = this.callBackFunction(obj);
            if (r === 0) {
              return createHttpResponse(HTTP_OK, msgId);
            }
            return createHttpResponse(HTTP_ERR_NOT_IMPLEMENTED, "Method not implemented.");
          }

          return createHttpResponse(HTTP_OK, msgId);
        }
        else {
          return createHttpResponse(HTTP_ERR_UNAUTHORIZED, "Wrong security token.");
        }
      }
      catch (ex) {
        EnigmailLog.writeException("pEpListener.handleHttpRequest", ex);
        return createHttpResponse(HTTP_ERR_INTERNAL_ERROR, "Internal exception.");
      }
    }

    return createHttpResponse(HTTP_ERR_BAD_REQUEST, "Bad request: unsupported HTTP method.");
  }
};

var EnigmailpEpListener = {

  /**
   *  returns port number or -1 in case of failure
   */
  createListener: function(callBackFunction, securityToken) {
    let serverSocket = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);

    let portNum = MIN_PORT_NUM;
    while (portNum < MAX_PORT_NUM) {
      try {
        serverSocket.init(portNum, true, -1);
        let l = new PepListener(callBackFunction, securityToken);
        serverSocket.asyncListen(l);
        EnigmailLog.DEBUG("pEpListener.createListener: Listening on port " + portNum + "\n");
        return portNum;
      }
      catch (ex) {
        if (ex.name === "NS_ERROR_SOCKET_ADDRESS_IN_USE") {
          ++portNum;
        }
        else
          portNum = MAX_PORT_NUM + 1;
      }
    }

    return -1;
  }
};
