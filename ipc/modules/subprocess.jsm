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
 * The Original Code is Enigmail.
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
 *    command:   '/bin/foo',
 *    arguments: ['-v', 'foo'],
 *    envVars:   [ "XYZ=abc", "MYVAR=def" ],
 *    stdin: subprocess.WritablePipe(function() {
 *               subprocess.WriteToPipe("Writing example data\n");
 *    }),
 *    stdout: subprocess.ReadablePipe(function(data) {
 *      dump("Got data on stdout: " + data);
 *    }),
 *    stderr: subprocess.ErrorPipe(data) {
 *        dump("Got data on stderr: "+data+"\n");
 *    },
 *    onFinished: function(exitCode) {
 *      dump("Process finished with result code: " + exitCode+"\n");
 *    },
 *  });
 *
 * Apart from <command>, all arguments are optional.
 *
 * Description of parameters:
 * --------------------------
 * command:   either a |nsIFile| object pointing to an executable file or a String containing the
 *            platform-dependent path to an executable file.
 *
 * arguments: optional string array containing the arguments to the command.
 *
 * envVars:   optional string array containing environment variables to pass to the command.
 *            The array elements must have the form "VAR=data".
 *
 * stdin:     optional input data for the command to be passed on standard input. stdin can either
 *            be a string or a function. If stdin is a string, then the string contents is passed
 *            to the process. If stdin is a function, input data can be written to the command
 *            using subprocess.WriteToPipe(string). The function is automatically called when the
 *            process is created and ready to receive input.
 *
 * stdout:    an optional function that can receive output data from the process. The stdout-function
 *            is called asynchronously; it can be called mutliple times during the execution of a
 *            process. Please note that null-characters might need to be escaped with something
 *            like 'data.replace(/\0/g, "\\0");'
 *
 * stderr:    an optional function that can receive output sent to stderr. The function is only
 *            called synchronously when the process has terminated. Again, null-characters
 *            might need to be escaped.
 *
 * onFinished: optional function that is called when the process has terminated. The exit code
 *             from the process is passed as input parameter.
*/


var EXPORTED_SYMBOLS = [ "subprocess" ];

const NS_PIPETRANSPORT_CONTRACTID = "@mozilla.org/process/pipe-transport;1";
const NS_IPCBUFFER_CONTRACTID = "@mozilla.org/process/ipc-buffer;1";

var subprocess = {
  result: -1,
  _scInpStr: null,
  _pipeOut: null,
  _pipeIn: null,
  _pipeErr: null,
  _pipeTransport: null,

  call: function (commandObj) {

    function SimpleStreamListener(subprocess, cmdObj) {
      this._subprocess = subprocess;
      this._cmdObj = cmdObj;
      this._initializedStream = false;
    }

    SimpleStreamListener.prototype = {
      QueryInterface: function(aIID) {
        if (aIID.equals(Components.interfaces.nsISupports)
        || aIID.equals(Components.interfaces.nsIRequestObserver)
        || aIID.equals(Components.interfaces.nsIStreamListener))
          return this;
        throw Components.interfaces.NS_NOINTERFACE;
      },

      onStartRequest: function(aRequest, aContext) {
        this._scInpStr = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
      },

      onStopRequest: function(aRequest, aContext, aStatusCode) {
        try {
          this._scInpStr.close();
        }
        catch(ex) {}
      },

      onDataAvailable: function(aRequest, aContext, aInputStream, offset, count) {
        if (! this._initializedStream) {
          this._scInpStr.init(aInputStream);
          this._initializedStream = true;
        }
        var av = aInputStream.available();
        var data = this._scInpStr.read(av);

        if (this._subprocess._pipeOut != null) {
          this._subprocess._pipeOut(data);
        }
      }
    };


    var stderrData = null;
    if (this._pipeErr != null) {
      // create & open pipeListener
      stderrData = Components.classes[NS_IPCBUFFER_CONTRACTID].createInstance(Components.interfaces.nsIIPCBuffer);
      stderrData.open(-1, true);
    }


    if (typeof (commandObj.command) == "string") {
      var localfile= Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      localfile.initWithPath(commandObj.command);
      commandObj._commandFile = localfile.QueryInterface(Components.interfaces.nsIFile);
    }
    else {
      commandObj._commandFile = commandObj.command;
    }

    if (typeof (commandObj.workingDir) == "undefined") commandObj.workingDir = null;

    if (typeof (commandObj.arguments) != "object") commandObj.arguments = [];
    if (typeof (commandObj.envVars) != "object") commandObj.envVars = [];

    this._pipeTransport = Components.classes[NS_PIPETRANSPORT_CONTRACTID].createInstance(Components.interfaces.nsIPipeTransport);
    this._pipeTransport.initialize(commandObj._commandFile, commandObj.workingDir,
                            Components.interfaces.nsIPipeTransport.INHERIT_PROC_ATTRIBS);

    this._pipeTransport.open(commandObj.arguments, commandObj.arguments.length,
                              commandObj.envVars, commandObj.envVars.length,
                              0, "", true, false, stderrData);

    var stdoutListener = new SimpleStreamListener(this, commandObj);

    this._pipeTransport.asyncRead(stdoutListener, null, 0, -1, 0);

    if (typeof(this._pipeIn) == "string") {
      this._pipeTransport.writeSync(this._pipeIn, this._pipeIn.length);
    }
    else if (typeof(this._pipeIn) == "function") {
      this._pipeIn(); // wait for data from stdin function
    }

    this._pipeTransport.join(); // wait for command to complete
    this.result = this._pipeTransport.exitCode();

    if (this._pipeErr != null) this._pipeErr(stderrData.getData());

    if (typeof(commandObj.onFinished) == "function") commandObj.onFinished(this.result);

  },
  WriteToPipe: function(data) {
    this._pipeTransport.writeSync(data, data.length);
  },
  WritablePipe: function(func) { this._pipeIn = func },
  ReadablePipe: function(func) { this._pipeOut = func },
  ErrorPipe: function (func) { this._pipeErr = func }
};
