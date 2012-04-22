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
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org> are
 * Copyright (C) 2012 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
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

'use strict';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");


let EXPORTED_SYMBOLS = [ "PipeTransport" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const DEFAULT_BUF_SIZE = 2048;

var PipeTransport = {
  createInstance: function() {
    return new PipeObj();
  },

  registerDebugHandler: function(_fnc) {
    gDebugFunc = _fnc;
  }
}

var gDebugFunc = null;

function DEBUG_LOG (str) {
  if (gDebugFunc) gDebugFunc(str);
}

function PipeObj() {
}

PipeObj.prototype = {
  _command: null,
  _cwd: null,
  _stdinPipe: null,
  _pendingWriteData: "",
  _proc: null,
  _readStream: null,
  _readBytes: 0,
  _outputPipe: null,
  _inputPipe: null,
  _tmpStream: null,
  _writeThread: null,
  _writeBuffer: "",
  _readBuffer: "",

  QueryInterface: XPCOMUtils.generateQI( [Ci.nsIPipeTransport,
                                          Ci.nsIProcess,
                                          Ci.nsIPipeTransportListener,
                                          Ci.nsIOutputStream,
                                          Ci.nsIStreamListener,
                                          Ci.nsIInputStreamCallback,
                                          Ci.nsIOutputStreamCallback,
                                          Ci.nsIRequestObserver,
                                          Ci.nsIRequest]),

  // nsIPipeTransport API
  stderrConsole: null,
  listener: null,
  bufferSegmentSize: DEFAULT_BUF_SIZE,
  bufferMaxSize: DEFAULT_BUF_SIZE * 4,
  headersMaxSize: DEFAULT_BUF_SIZE * 2,

  initWithWorkDir: function(command, cwd, startupFlags) {
    DEBUG_LOG("initWithWorkDir");
    if (this._command) throw "ERROR_ALREADY_INITIALIZED";
    // startup flags are ignred
    this._command = command;
    this._cwd = cwd;
    this.name = command.leafName;
  },

  openPipe: function(args, argCount, env, envCount, timeoutMS, killString, mergeStderr, stderrConsole) {
    DEBUG_LOG("openPipe");

    var self = this;

    if (this._command == null) throw "ERROR_NOT_INITIALIZED";
    if (this._proc) throw "ERROR_ALREADY_INITIALIZED";
    if (typeof(killString) == "string" && killString.length > 0) throw "ERROR_NOT_SUPPORTED";
    if (timeoutMS != null && timeoutMS > 0) throw "ERROR_NOT_SUPPORTED";
    this.stderrConsole = stderrConsole;

    var callObj = {
      command:     this._command,
      arguments:   args,
      environment: env,
      charset: null,
      workdir: this._cwd,
      stdin: function(stdin) {
        self._stdinPipe = stdin;
        if (self._pendingWriteData.length > 0) {
          stdin.write(self._pendingWriteData);
          self._pendingWriteData = "";
        }
      },
      stdout: function(data) {
        DEBUG_LOG("got data on stdout: " + data.length);
        try {

          if (self._readStream) {
            var readStart = self._readBytes + data.length - self._readOffset;
            if ( readStart > 0 ) {
              DEBUG_LOG("writing to reader stream");
              if (! self._tmpStream)
                self._tmpStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
              self._tmpStream.setData(data, data.length);
              self._readStream.onDataAvailable(self, self._readCtxt, self._tmpStream, self._readBytes, data.length);
            }
          }

          if (self._outputPipe) {
            DEBUG_LOG("writing to output stream");
            self._outputPipe.readData(data, data.length);
          }
          self._readBytes += data.length;
        }
        catch(ex) {
          DEBUG_LOG("ERROR in stdout: "+ex.toString());
        }
      },

      stderr: function(data) {
        DEBUG_LOG("got data on stdout:" + data);
        try {
          if (self.stderrConsole) stderrConsole.write(data);
        }
        catch (ex) {
          DEBUG_LOG("ERROR in stderr: "+ex.toString());
        }
      },

      done: function(result) {
        DEBUG_LOG("done");
        try {
          self._proc = null;
          self.exitValue  = result.exitCode;
          if (self._readStream) {
            self._readStream.onStopRequest(self, self._readCtxt, result.exitCode);
          }
          if (self._outputPipe) {
            self._outputPipe.stopRequest(result.exitCode);
          }
          self._outputPipe = null;
          self._readStream = null;
          self._readCtxt = null;
          self._outputCtxt = null;
          self.isRunning = false;
          self.listener = null;
          self = null;
        }
        catch(ex) {
          DEBUG_LOG("ERROR in done: "+ex.toString());
        }
      },
      mergeStderr: mergeStderr
    };

    this.listener = self;
    this._proc = subprocess.call(callObj);
    this.isRunning = true;
  },

  openOutputStream: function (offset, count, flags) {
    DEBUG_LOG("openOutputStream NOT IMPLEMENTED");
    throw "ERROR_NOT_IMPLEMENTED";
  },

  asyncRead: function (listener, ctxt, offset, count, flags) {
    DEBUG_LOG("asyncRead");
    if (! this._proc) throw "ERROR_NOT_AVAILABLE";
    this._readStream = listener;
    this._readCtxt = ctxt;
    this._readOffset = offset || 0;
    this._readCount = count;

    this._readStream.onStartRequest(this, this._readCtxt);
  },

  readInputStream: function (listener) {
    DEBUG_LOG("asyncRead");
    if (! this._proc) throw "ERROR_NOT_AVAILABLE";

    this._outputPipe = listener;
  },

  join: function() {
    DEBUG_LOG("join");
    //if (! this._proc) throw "ERROR_NOT_AVAILABLE";
    this.close();
    if (this._proc) this._proc.wait();
  },

  terminate: function () {
    DEBUG_LOG("terminate");
    this.close();
    this.join();
  },

  writeSync: function(inputData,  inputLength) {
    this.write(inputData, inputLength);
  },

  closeStdin: function() {
    DEBUG_LOG("closeStdin");
    this.close();
  },

  writeAsync: function(aFromStream, aCount, closeAfterWrite) {
    DEBUG_LOG("writeAsync");

    let stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    stream.init(aFromStream);

    let count = aCount;
    while (count > 0) {
      let data = stream.readBytes(aCount);
      count -= data.length;
      //DEBUG_LOG("writeAsync: got "+data.length+" bytes - remaining: "+count);
      this.write(data, data.length);
    }

    if(closeAfterWrite) this.close();
  },

  readLine: function(maxOutputLen) {
    throw "ERROR_NOT_IMPLEMENTED";
  },

  // nsIProcess API

  pid: -1,        // PID is not supported
  exitValue: null,
  isRunning: null,

  init: function(command) {
    return this.initWithWorkDir(command, null, null);
  },


  kill: function() {
    DEBUG_LOG("terminate");
    if (! this._proc) throw "ERROR_NOT_AVAILABLE";
    return this._proc.kill(false);
  },

  run: function(blocking, args, count) {
    throw "ERROR_NOT_IMPLEMENTED";
  },
  runAsync: function(args, count, observer, holdWeak) {
    throw "ERROR_NOT_IMPLEMENTED";
  },
  runw: function(blocking, args, count) {
    throw "ERROR_NOT_IMPLEMENTED";
  },
  runwAsync: function(args, count, observer, holdWeak) {
    throw "ERROR_NOT_IMPLEMENTED";
  },

  // nsIPipeListener API

  joinable: true,
  overflowed: false,

  //observe: function (observer, ctxt) { },

  shutdown: function() {
    this.close();
    this._stdinPipe = null;
  },

  // nsIOutputStream API

  write: function(str, length) {
    if (this._stdinPipe) {
      if (this._writeBuffer.length + length >= DEFAULT_BUF_SIZE) {
        DEBUG_LOG("write "+ (this._writeBuffer.length + length) +" bytes");
        this._stdinPipe.write(this._writeBuffer+str.substr(0, length));
        this._writeBuffer = "";
      }
      else {
        this._writeBuffer += str.substr(0, length);
      }
    }
    else {
      DEBUG_LOG("write pending "+length+" bytes");
      this._pendingWriteData += str.substr(0, length);
    }
  },

  close: function() {
    DEBUG_LOG("close");
    if(this._stdinPipe) {
      this.flush();
      this._stdinPipe.close();
    }
  },

  flush: function () {
    DEBUG_LOG("flush "+this._writeBuffer.length+" bytes");
    if(this._stdinPipe && this._writeBuffer.length > 0) {
      this._stdinPipe.write(this._writeBuffer);
      this._writeBuffer = "";
    }
  },

  writeFrom: function(aFromStream, aCount) {
    throw "ERROR_NOT_IMPLEMENTED";
  },

  isNonBlocking: function() {
    return true;
  },

  // nsIStreamListener API
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    DEBUG_LOG("onDataAvailable");
    let stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    stream.init(aInputStream);
    var data = stream.read(aCount);
    try {
      this.write(data, data.length);
    }
    catch (ex) {}
    stream = null;
  },

  // nsIRequestObserver API
  onStartRequest: function (aRequest, aContext) {
    DEBUG_LOG("onStartRequest");
  },

  onStopRequest: function (aRequest, aContext,aStatusCode) {
    DEBUG_LOG("onStopRequest");
    this.close();
  },

  // nsIInputStreamCallback API

  onInputStreamReady: function(aStream) {
    DEBUG_LOG("onStartRequest");
  },

  // nsIOutputStreamCallback API
  asyncWait: function(aCallback, aFlags, aRequestedCount, aEventTarget) {
    DEBUG_LOG("asyncWait  NOT IMPLEMENTED");
    throw "ERROR_NOT_IMPLEMENTED";
  },

  // nsIRequest API
  name: "null",
  status: 0,
  loadGroup: null,
  loadFlags: Ci.nsIRequest.LOAD_NORMAL,

  isPending: function() {
    DEBUG_LOG("isPending");
    return false;
  },

  cancel: function(aStatus) {
    if (! this._proc) throw "ERROR_NOT_AVAILABLE";
    this.close();
  },

  suspend: function() {
    throw "ERROR_NOT_IMPLEMENTED";
  },

  resume: function() {
    throw "ERROR_NOT_IMPLEMENTED";
  }
}

