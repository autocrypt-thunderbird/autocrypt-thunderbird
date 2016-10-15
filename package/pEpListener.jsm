/*global Components: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * This module serves to integrate pEp into Enigmail
 *
 * The module is still a prototype - not ready for daily use!
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailpEpListener"];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

const MIN_PORT_NUM = 15900;
const MAX_PORT_NUM = 15991;

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */


function PepListener(callBackFunction) {
  this.callBackFunction = callBackFunction;
}

PepListener.prototype = {

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIServerSocketListener]),

  reader: {
    self: null,

    onInputStreamReady: function(input) {
      let sin = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      sin.init(input);
      //sin.available();
      let requestData = "";
      while (sin.available()) {
        requestData = requestData + sin.read(512);
      }
      EnigmailLog.DEBUG("pEpListener.onInputStreamReady: got data '" + requestData + "'\n");

      let s;

      if (requestData.replace(/[\r\n]/g, "") === "quit") {
        EnigmailLog.DEBUG("pEpListener.onInputStreamReady: got QUIT\n");
        s = "OK, goodbye\n";
        this.self.output.write(s, s.length);
        this.self.output.close();
        this.self.input.close();
        return;
      }
      s = "got data!\n";
      this.self.output.write(s, s.length);
      this.self.output.flush();

      if (this.self.callBackFunction) {
        this.self.callBackFunction(requestData);
      }

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
    EnigmailLog.DEBUG("pEpListener.onStopListening: Closing connection on " + serverSocket.port+ "\n");
  }
};

var EnigmailpEpListener = {

  /**
   *  returns port number or -1 in case of failure
   */
  createListener: function(callBackFunction) {
    let serverSocket = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);

    let portNum = MIN_PORT_NUM;
    while (portNum < MAX_PORT_NUM) {
      try {
        serverSocket.init(portNum, true, -1);
        let l = new PepListener(callBackFunction);
        serverSocket.asyncListen(l);
        EnigmailLog.DEBUG("pEpListener.createListener: Listening on port " + portNum+ "\n");
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
