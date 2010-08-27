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
 * This object allows to start a process, and read/write data to/from it using stdin/stour/stderr
 * streams.
 * Usage example:
 *
 *  var p = subprocess.call({
 *    command:     '/bin/foo',
 *    arguments:   ['-v', 'foo'],
 *    environment: [ "XYZ=abc", "MYVAR=def" ],
 *    stdin: subprocess.WritablePipe(function() {
 *      this.write("Writing example data\n");
 *    }),
 *    stdout: subprocess.ReadablePipe(function(data) {
 *      dump("Got data on stdout: " + data+"\n");
 *    }),
 *    stderr: subprocess.ReadablePipe(function(data) {
 *      dump("Got data on stderr: "+data+"\n");
 *    )},
 *    onFinished: subprocess.Terminate(function() {
 *      dump("Process finished with result code: "+this.exitCode+"\n");
 *    },
 *    mergeStderr: false
 *  });
 *  p.waitFor(); // wait for the subprocess to terminate
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
 * stdin:       optional input data for the process to be passed on standard input. stdin can either
 *              be a string or a function. If stdin is a string, then the string content is passed
 *              to the process. If stdin is a function defined using subprocess.WritablePipe, input
 *              data can be written synchronously to the process using this.write(string).
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
 * waitFor():   waits for the subprocess to terminate. It is not required to use waitFor,
 *              however onFinished and stderr will only be called if waitFor is called or if
 *              stdout is defined.
 *
 * kill():      kill the subprocess. Any open pipes will be closed and onFinished will be called.
*/


var EXPORTED_SYMBOLS = [ "subprocess" ];

const NS_PIPETRANSPORT_CONTRACTID = "@mozilla.org/process/pipe-transport;1";
const NS_IPCBUFFER_CONTRACTID = "@mozilla.org/process/ipc-buffer;1";
const Cc = Components.classes;
const Ci = Components.interfaces;

var subprocess = {
  result: -1,
  _pipeTransport: null,
  stdoutData: null,

  call: function (commandObj) {

    function StdoutStreamListener(cmdObj, pipeTransport, stderrData) {
      this._cmdObj = cmdObj;
      this._pipeTransport = pipeTransport;
      this.stderrData = stderrData;
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

      onStartRequest: function(aRequest, aContext) {
        this._inputStream = null;
      },

      onDataAvailable: function(aRequest, aContext, aInputStream, offset, count) {

        if (! this._inputStream) {
          // we are using nsIBinaryInputStream in order to ensure correct handling in case the subprocess
          // feeds special characters like NULL
          this._inputStream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
          this._inputStream.setInputStream(aInputStream);
        }
        var av = aInputStream.available();
        this._cmdObj.stdout.onDataAvailable(this._inputStream.readBytes(av));
      },

      onStopRequest: function(aRequest, aContext, aStatusCode) {
        try {
          this._inputStream.close();
        }
        catch(ex) {}

        // call to stderr and onFinished from here to avoid mandatory use of p.waitFor()
        callFinalCallbacks(this);
      }
    };

    this.pipeObj = {
      stderrData: null,

      init: function(cmdObj) {
        this._cmdObj = cmdObj;
        if (typeof(cmdObj.stderr) == "object") {
          // create & open pipeListener
          this.stderrData = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
          this.stderrData.open(-1, true);
        }


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

        this._pipeTransport = Cc[NS_PIPETRANSPORT_CONTRACTID].createInstance(Ci.nsIPipeTransport);
        this._pipeTransport.initWithWorkDir(cmdObj._commandFile, null,
                                Ci.nsIPipeTransport.INHERIT_PROC_ATTRIBS);

        this.stdoutListener = null;
        if (typeof(cmdObj.stdout) == "object") {
          // add listener for asynchronous processing of data
          this.stdoutListener = new StdoutStreamListener(cmdObj, this._pipeTransport, this.stderrData);
        }
        else {
          this.stdoutListener = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
          this.stdoutListener.open(-1, true);
        }

        this._pipeTransport.openPipe(cmdObj.arguments, cmdObj.arguments.length,
                                     cmdObj.environment, cmdObj.environment.length,
                                     0, "", true, cmdObj.mergeStderr ? true : false,
                                     this.stderrData);

        this._pipeTransport.asyncRead(this.stdoutListener, null, 0, -1, 0);

        if (typeof(cmdObj.stdin) == "string") {
          this._pipeTransport.writeSync(cmdObj.stdin, cmdObj.stdin.length);
        }
        else if (typeof(cmdObj.stdin) == "object") {
          cmdObj.stdin._pipeTransport = this._pipeTransport;
          cmdObj.stdin.startWriting();
        }
      }, // init

      waitFor: function () {
        this._pipeTransport.join(); // wait for subprocess to complete
        this.result = this._pipeTransport.exitValue;

        if (this._cmdObj.stdout == null && typeof(this._cmdObj.onFinished) == "object") {
          this._cmdObj.onFinished.stdoutData = this.stdoutListener.getData();
          this.stdoutListener.shutdown();
        }


        if (typeof(this._cmdObj.stdout) != "object") {
          // call stderr and onFinished if not using StdoutStreamListener
          callFinalCallbacks(this);
        }
      }, // waitFor

      kill: function() {
        try {
          this._pipeTransport.kill();
        }
        catch(ex) {
          dump(ex.toString())
        }
      }
    }
    this.pipeObj.init(commandObj);
    return this.pipeObj;

  },
  WritablePipe: function(func) {
    var pipeWriterObj = {
      _pipeTransport: null,
      write: function(data) {
        this._pipeTransport.writeSync(data, data.length);
      },
      startWriting: func
    };
    return pipeWriterObj;
  },
  ReadablePipe: function(func) {
    var pipeReaderObj = {
      onDataAvailable: func
    }
    return pipeReaderObj;
  },
  Terminate: function(func) {
    var onFinishedObj = {
      stdoutData: null,
      exitCode: -1,
      callback: func
    };
    return onFinishedObj;
  },
};


function callFinalCallbacks(aObj) {
  if (typeof(aObj._cmdObj.stderr) == "object" && (! aObj._cmdObj.mergeStderr)) {
    aObj._cmdObj.stderr.onDataAvailable(aObj.stderrData.getData());
    aObj.stderrData.shutdown();
  }

  if (typeof(aObj._cmdObj.onFinished) == "object") {
    aObj._cmdObj.onFinished.exitCode = aObj._pipeTransport.exitValue;
    aObj._cmdObj.onFinished.callback();
  }
}

/*

// working example:

Components.utils.import("resource://enigmail/subprocess.jsm");

function logMsg(str) {
  try {
    var consoleSvc = Cc["@mozilla.org/consoleservice;1"].
        getService(Ci.nsIConsoleService);

    var scriptError = Cc["@mozilla.org/scripterror;1"]
                                .createInstance(Ci.nsIScriptError);
    scriptError.init(str, null, null, 0,
                     0, scriptError.errorFlag, "Enigmail");
    consoleSvc.logMessage(scriptError);

  }
  catch (ex) {}
}

function enigmailKeyManagerLoad() {
   var p = subprocess.call({
     command:   '/Users/pbr/enigmail/tmp/test.sh',
     arguments: ['-v', 'foo'],
     environment:   [ "XYZ=abc", "MYVAR=def" ],
     stdin: subprocess.WritablePipe(function() {
          this.write("Writing example data\n");
     }),

     stdout: subprocess.ReadablePipe(function(data) {
       logMsg("*** Got data on stdout: '"+ data+"'\n");
     }),
     stderr: subprocess.ReadablePipe(function(data) {
       logMsg("*** Got data on stderr: '"+data+"'\n");
     }),
     onFinished: subprocess.Terminate(function() {
       logMsg("*** Process finished with result code: " + this.exitCode + "\n");
       logMsg("got data: "+this.stdoutData);
     }),
     mergeStderr: false
   });

}
*/