/*
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
 * The Original Code is IPC-Pipe.
 *
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org>
 * are Copyright (C) 2010 Patrick Brunschwig.
 * All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */


/*
 * Import into a JS component using
 * 'Components.utils.import("resource://gre/modules/subprocess.jsm");'
 *
 * As long as this code is not yet in Mozilla platform, use;
 * 'Components.utils.import("resource://enigmail/subprocess.jsm");'
 *
 * This object allows to start a process, and read/write data to/from it using stdin/stdout/stderr
 * streams.
 * Usage example:
 *
 *  var p = subprocess.call({
 *    command:     '/bin/foo',
 *    arguments:   ['-v', 'foo'],
 *    environment: [ "XYZ=abc", "MYVAR=def" ],
 *    workdir: '/home/foo',
 *    stdin: subprocess.WritablePipe(function() {
 *      this.write("Writing example data\n");
 *      this.close();
 *    }),
 *    stdout: subprocess.ReadablePipe(function(data) {
 *      dump("got data on stdout:" +data+"\n");
 *    }),
 *    stderr: subprocess.ReadablePipe(function(data) {
 *      dump("got data on stderr:" +data+"\n");
 *    }),
 *    onFinished: subprocess.Terminate(function() {
 *      dump("process terminated with " +this.exitCode + "\n");
 *    }),
 *    mergeStderr: false
 *  });
 *  p.wait(); // wait for the subprocess to terminate
 *
 *
 * Description of parameters:
 * --------------------------
 * Apart from <command>, all arguments are optional.
 *
 * command:     either a |nsIFile| object pointing to an executable file or a String containing the
 *              platform-dependent path to an executable file.
 *
 * arguments:   optional string array containing the arguments to the command.
 *
 * environment: optional string array containing environment variables to pass to the command.
 *              The array elements must have the form "VAR=data". Please note that if environment is
 *              defined, it replaces any existing environment variables for the subprocess.
 *
 * workdir:     optional; either a |nsIFile| object pointing to a directory or a String
 *              containing the platform-dependent path to a directory to become the current
 *              working directory of the subprocess.
 *
 * stdin:       optional input data for the process to be passed on standard input. stdin can either
 *              be a string or a function. If stdin is a string, then the string content is passed
 *              to the process. If stdin is a function defined using subprocess.WritablePipe, input
 *              data can be written synchronously to the process using this.write(string).
 *              The stream to the subprocess can be closed with this.close().
 *
 * stdout:      an optional function that can receive output data from the process. The stdout-function
 *              is called asynchronously; it can be called mutliple times during the execution of a
 *              process. Please note that null-characters might need to be escaped with something
 *              like 'data.replace(/\0/g, "\\0");'. stdout needs to be defined using subprocess.ReadablePipe.
 *
 * stderr:      an optional function that can receive output sent to stderr. The function is only
 *              called synchronously when the process has terminated. Again, null-characters
 *              might need to be escaped. stderr needs to be defined using subprocess.ReadablePipe.
 *
 * onFinished:  optional function that is called when the process has terminated. The exit code
 *              from the process available via this.exitCode. If stdout is not defined, then the
 *              output from stdout is available via this.stdoutData. onFinished needs to be
 *              defined using subprocess.Terminate.
 *
 * mergeStderr: optional boolean value. If true, stderr is merged with stdout; no data will be
 *              provided to stderr.
 *
 *
 * Description of object returned by subprocess.call(...)
 * ------------------------------------------------------
 * The object returned by subprocess.call offers a few methods that can be executed:
 *
 * wait():      waits for the subprocess to terminate. It is not required to use wait; onFinshed
 *              and stderr will be called in any case when the subprocess terminated.
 *
 * kill():      kill the subprocess. Any open pipes will be closed and onFinished will be called.
 *
 *
 * Important notes
 * ---------------
 *
 * Be careful if you create more than one subprocess in parallel. Because p.wait() is blocking
 * the termination of other processes, you cannot wait on the same thread for more than one
 * subprocess to terminate, unless you know the sequence in which the subprocesses finish. Therefore
 * it is safer to create new threads if you need to execute several subprocesses at the same time.
 *
 * The callbacks to ReadablePipe and Terminate are always dispatched to the main thread, no matter
 * from which thread you started the process.
 */


var EXPORTED_SYMBOLS = [ "subprocess" ];

const NS_PIPETRANSPORT_CONTRACTID = "@mozilla.org/process/pipe-transport;1";
const NS_IPCBUFFER_CONTRACTID = "@mozilla.org/process/ipc-buffer;1";
const Cc = Components.classes;
const Ci = Components.interfaces;

var subprocess = {

  call: function (commandObj) {
    var pipeObj = new PipeObj();
    pipeObj.init(commandObj);
    return pipeObj;
  },
  WritablePipe: function(func) {
    var pipeWriterObj = {
      _pipeTransport: null,
      write: function(data) {
        this._pipeTransport.writeSync(data, data.length);
      },
      close: function() {
        this._pipeTransport.closeStdin();
      },
      startWriting: func
    };
    return pipeWriterObj;
  },
  ReadablePipe: function(func) {
    var pipeReaderObj = {
      callbackFunction: func,
      onDataAvailable: function(data) {
        // onDataAvailable is called on a separate thread, dispatch to main thread
        mainThread.dispatch(new readablePipeMainThread(this.callbackFunction, data),
          Components.interfaces.nsIThread.DISPATCH_NORMAL);
      }
    }
    return pipeReaderObj;
  },
  Terminate: function(func) {
    var onFinishedObj = {
      stdoutData: null,
      callbackFunction: func,
      callback: function (exitCode) {
        // callback is called on a separate thread, dispatch to main thread
        mainThread.dispatch(new terminateMainThread(this.callbackFunction, exitCode, this.stdoutData),
          Components.interfaces.nsIThread.DISPATCH_NORMAL);
      }
    };
    return onFinishedObj;
  },
};

// the main thread, needed for dispatching events
var mainThread = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;


// object for dispatching ReadablePipe callbacks to main thread
var readablePipeMainThread = function(cbFunction, data) {
  this.cbFunction = cbFunction;
  this.data = data;
};

readablePipeMainThread.prototype = {

  run: function() {
    this.cbFunction(this.data);
  },

  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};



// object for dispatching Terminate callbacks to main thread

var terminateMainThread = function(cbFunction, exitCode, stdoutData) {
  this.cbFunction = cbFunction;
  this.stdoutData = stdoutData;
  this.exitCode = exitCode;
};

terminateMainThread.prototype = {

  run: function() {
    this.cbFunction();
  },

  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};


// Listener for handling stdout callbacks
function StdoutStreamListener(cmdObj) {
  this._cmdObj = cmdObj;
  this._observer = null;
}

StdoutStreamListener.prototype = {
  // a stream listener used for calling back to stdout
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsISupports)
    || aIID.equals(Ci.nsIRequestObserver)
    || aIID.equals(Ci.nsIStreamListener))
      return this;
    throw Ci.NS_NOINTERFACE;
  },

  observe: function (aObserver, aContext) {
    this._observer = aObserver;
  },

  onStartRequest: function(aRequest, aContext) {
    if (this._observer)
      this._observer.onStartRequest(aRequest, aContext);
  },

  onDataAvailable: function(aRequest, aContext, aInputStream, offset, count) {

    let sis = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    sis.init(aInputStream);
    try {
      if ("readBytes" in sis) {
         // Gecko > 2.0b4, supports NULL characters
        this._cmdObj.stdout.onDataAvailable(sis.readBytes(count));
      }
      else
        // Gecko <= 1.9.2
        this._cmdObj.stdout.onDataAvailable(sis.read(count));
    }
    catch (e) {
       // Adjust the stack so it throws at the caller's location.
       throw new Components.Exception(e.message, e.result,
                                      Components.stack.caller, e.data);
    }
    sis = null;
  },

  onStopRequest: function(aRequest, aContext, aStatusCode) {
    // call to stderr and onFinished from here to avoid mandatory use of p.waitFor()
    if (this._observer)
      this._observer.onStopRequest(aRequest, aContext, aStatusCode);

    // unset assigned variables to avoid memory leak
    this._observer=null;
    this._cmdObj=null;
  }
};

// Listener for handling subprocess termination
function OnFinishedListener(pipeObj) {
  this._pipeObj = pipeObj;
}

OnFinishedListener.prototype = {
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsISupports)
    || aIID.equals(Ci.nsIRequestObserver))
      return this;
    throw Ci.NS_NOINTERFACE;
  },

  onStartRequest: function(aRequest, aContext) { },

  onStopRequest: function(aRequest, aContext, aStatusCode) {

    // call to stderr and onFinished from here to avoid mandatory use of p.waitFor()
    if (typeof(this._pipeObj._cmdObj.stderr) == "object" && (! this._pipeObj._cmdObj.mergeStderr)) {
      this._pipeObj._cmdObj.stderr.onDataAvailable(this._pipeObj.stderrData.getData());
      this._pipeObj.stderrData.shutdown();
    }

    if (typeof(this._pipeObj._cmdObj.onFinished) == "object") {
      if (this._pipeObj._cmdObj.stdout == null) {
        this._pipeObj._cmdObj.onFinished.stdoutData = this._pipeObj.stdoutListener.getData();
        this._pipeObj.stdoutListener.shutdown();
      }

      this._pipeObj._cmdObj.onFinished.callback(this._pipeObj._pipeTransport.exitValue);
    }

    // unset assigned variables to avoid memory leak
    this._pipeObj = null;
  }
}


// Class to represent a running process
function PipeObj() {
}

PipeObj.prototype = {
  stderrData: null,

  init: function(cmdObj) {
    this._cmdObj = cmdObj;

    // create & open pipeListener for stderr, no matter if needed or not
    this.stderrData = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
    this.stderrData.open(-1, true);


    if (typeof (cmdObj.command) == "string") {
      var localfile= Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      localfile.initWithPath(cmdObj.command);
      cmdObj._commandFile = localfile.QueryInterface(Ci.nsIFile);
    }
    else {
      cmdObj._commandFile = cmdObj.command;
    }
    if (typeof (cmdObj.arguments) != "object") cmdObj.arguments = [];
    if (typeof (cmdObj.environment) != "object") cmdObj.environment = [];
    if (typeof (cmdObj.workdir) == "string") {
      var localfile= Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      localfile.initWithPath(cmdObj.workdir);
      cmdObj._cwd = localfile.QueryInterface(Ci.nsIFile);
    }
    else if (typeof (cmdObj.workdir) == "object") {
      cmdObj._cwd = cmdObj.workdir;
    }
    else {
      cmdObj._cwd = null;
    }

    this._pipeTransport = Cc[NS_PIPETRANSPORT_CONTRACTID].createInstance(Ci.nsIPipeTransport);
    this._pipeTransport.initWithWorkDir(cmdObj._commandFile, cmdObj._cwd,
                            Ci.nsIPipeTransport.INHERIT_PROC_ATTRIBS);

    this.stdoutListener = null;
    if (typeof(cmdObj.stdout) == "object") {
      // add listener for asynchronous processing of data
      this.stdoutListener = new StdoutStreamListener(cmdObj);
    }
    else {
      this.stdoutListener = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
      this.stdoutListener.open(-1, true);
    }

    if (typeof(cmdObj.stderr) == "object" || typeof(cmdObj.onFinished) == "object")
      this.stdoutListener.observe(new OnFinishedListener(this), null);

    this._pipeTransport.openPipe(cmdObj.arguments, cmdObj.arguments.length,
                                 cmdObj.environment, cmdObj.environment.length,
                                 0, "", true, cmdObj.mergeStderr ? true : false,
                                 this.stderrData);

    this._pipeTransport.asyncRead(this.stdoutListener, null, 0, -1, 0);

    if (typeof(cmdObj.stdin) == "string") {
      this._pipeTransport.writeSync(cmdObj.stdin, cmdObj.stdin.length);
      this._pipeTransport.closeStdin();
    }
    else if (typeof(cmdObj.stdin) == "object") {
      cmdObj.stdin._pipeTransport = this._pipeTransport;
      cmdObj.stdin.startWriting();
    }
  }, // init

  wait: function () {
    this._pipeTransport.join(); // wait for subprocess to complete
  }, // wait

  kill: function() {
    try {
      this._pipeTransport.kill();
    }
    catch(ex) {
      // do nothing with it
    }
  }
}; // PipeObj
