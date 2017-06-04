/*global Components: false */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Import into a JS component using
 * 'Components.utils.import("resource://firefogg/subprocess.jsm");'
 *
 * This object allows to start a process, and read/write data to/from it
 * using stdin/stdout/stderr streams.
 * Usage example:
 *
 *  var p = subprocess.call({
 *    command:     '/bin/foo',
 *    arguments:   ['-v', 'foo'],
 *    environment: [ "XYZ=abc", "MYVAR=def" ],
 *    charset: 'UTF-8',
 *    workdir: '/home/foo',
 *    //stdin: "some value to write to stdin\nfoobar",
 *    stdin: function(stdin) {
 *      stdin.write("some value to write to stdin\nfoobar");
 *      stdin.close();
 *    },
 *    stdout: function(data) {
 *      dump("got data on stdout:" + data + "\n");
 *    },
 *    stderr: function(data) {
 *      dump("got data on stderr:" + data + "\n");
 *    },
 *    done: function(result) {
 *      dump("process terminated with " + result.exitCode + "\n");
 *    },
 *    mergeStderr: false
 *  });
 *  p.wait(); // wait for the subprocess to terminate
 *            // this will block the main thread,
 *            // only do if you can wait that long
 *
 *
 * Description of parameters:
 * --------------------------
 * Apart from <command>, all arguments are optional.
 *
 * command:     either a |nsIFile| object pointing to an executable file or a
 *              String containing the platform-dependent path to an executable
 *              file.
 *
 * arguments:   optional string array containing the arguments to the command.
 *
 * environment: optional string array containing environment variables to pass
 *              to the command. The array elements must have the form
 *              "VAR=data". Please note that if environment is defined, it
 *              replaces any existing environment variables for the subprocess.
 *
 * charset:     Output is decoded with given charset and a string is returned.
 *              If charset is undefined, "UTF-8" is used as default.
 *              To get binary data, set this explicitly to null and the
 *              returned string is not decoded in any way.
 *
 * workdir:     optional; String containing the platform-dependent path to a
 *              directory to become the current working directory of the subprocess.
 *
 * stdin:       optional input data for the process to be passed on standard
 *              input. stdin can either be a string or a function.
 *              A |string| gets written to stdin and stdin gets closed;
 *              A |function| gets passed an object with write and close function.
 *              Please note that the write() function will return almost immediately;
 *              data is always written asynchronously on a separate thread.
 *
 * stdout:      an optional function that can receive output data from the
 *              process. The stdout-function is called asynchronously; it can be
 *              called mutliple times during the execution of a process.
 *              At a minimum at each occurance of \n or \r.
 *              Please note that null-characters might need to be escaped
 *              with something like 'data.replace(/\0/g, "\\0");'.
 *
 * stderr:      an optional function that can receive stderr data from the
 *              process. The stderr-function is called asynchronously; it can be
 *              called mutliple times during the execution of a process. Please
 *              note that null-characters might need to be escaped with
 *              something like 'data.replace(/\0/g, "\\0");'.
 *              (on windows it only gets called once right now)
 *
 *
 * done:        optional function that is called when the process has terminated.
 *              The exit code from the process available via result.exitCode. If
 *              stdout is not defined, then the output from stdout is available
 *              via result.stdout. stderr data is in result.stderr
 *              done() is guaranteed to be called before .wait() finishes
 *
 * mergeStderr: optional boolean value. If true, stderr is merged with stdout;
 *              no data will be provided to stderr. Default is false.
 *
 * bufferedOutput: optional boolean value. If true, stderr and stdout are buffered
 *              and will only deliver data when a certain amount of output is
 *              available. Enabling the option will give you some performance
 *              benefits if you read a lot of data. Don't enable this if your
 *              application works in a conversation-like mode. Default is false.
 *
 *
 * Description of object returned by subprocess.call(...)
 * ------------------------------------------------------
 * The object returned by subprocess.call offers a few methods that can be
 * executed:
 *
 * wait():         waits for the subprocess to terminate. It is not required to use
 *                 wait; done will be called in any case when the subprocess terminated.
 *
 * kill(hardKill): kill the subprocess. Any open pipes will be closed and
 *                 done will be called.
 *                 hardKill [ignored on Windows]:
 *                  - false: signal the process terminate (SIGTERM)
 *                  - true:  kill the process (SIGKILL)
 *
 *
 * Other methods in subprocess
 * ---------------------------
 *
 * registerDebugHandler(functionRef):   register a handler that is called to get
 *                                      debugging information
 * registerLogHandler(functionRef):     register a handler that is called to get error
 *                                      messages
 *
 * example:
 *    subprocess.registerLogHandler( function(s) { dump(s); } );
 */

'use strict';

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm"); /* global Services: false */
Cu.import("resource://gre/modules/Subprocess.jsm"); /* global Subprocess: false */
Cu.import("resource://gre/modules/Task.jsm"); /* global Task: false */

var EXPORTED_SYMBOLS = ["subprocess"];


const Runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
//const Environment = require("sdk/system/environment").env;
const DEFAULT_ENVIRONMENT = [];

var gDebugFunction = null;

function awaitPromise(promise) {
  let value;
  let resolved = null;
  promise.then(val => {
    resolved = true;
    value = val;
  }, val => {
    resolved = false;
    value = val;
  });

  while (resolved === null)
    Services.tm.mainThread.processNextEvent(true);

  if (resolved === true)
    return value;
  throw value;
}

let readAllData = Task.async(function*(pipe, read, callback) {
  /* eslint no-cond-assign: 0 */
  let string;
  while (string = yield read(pipe))
    callback(string);
});

let write = (pipe, data) => {
  let buffer = new Uint8Array(Array.from(data, c => c.charCodeAt(0)));
  return pipe.write(buffer);
};

var subprocess = {
  registerLogHandler: function(func) {
    gDebugFunction = func;
  },
  registerDebugHandler: function() {},

  call: function(options) {
    var result;
    let stdoutData = "";
    let stderrData = "";
    let completePromise = null;

    let procPromise = Task.spawn(function*() {
      let opts = {};

      if (options.mergeStderr) {
        opts.stderr = "stdout";
      }
      else {
        opts.stderr = "pipe";
      }

      if (options.command instanceof Ci.nsIFile) {
        opts.command = options.command.path;
      }
      else {
        opts.command = yield Subprocess.pathSearch(options.command);
      }

      if (options.workdir) {
        opts.workdir = options.workdir;
      }

      opts.arguments = options.arguments || [];


      // Set up environment

      let envVars = options.environment || DEFAULT_ENVIRONMENT;
      if (envVars.length) {
        let environment = {};
        for (let val of envVars) {
          let idx = val.indexOf("=");
          if (idx >= 0)
            environment[val.slice(0, idx)] = val.slice(idx + 1);
        }

        opts.environment = environment;
      }


      let proc = yield Subprocess.call(opts);

      Object.defineProperty(result, "pid", {
        value: proc.pid,
        enumerable: true,
        configurable: true
      });


      let promises = [];

      // Set up IO handlers.

      let read = pipe => pipe.readString();
      if (options.charset === null) {
        read = pipe => {
          // return pipe.read().then(buffer => {
          //   return String.fromCharCode(...buffer);
          // });

          return pipe.read().then(buffer => {
            try {
              if (buffer.byteLength > 0) {
                let d = new DataView(buffer);
                let r = "";
                for (let i = 0; i < d.byteLength; i++) {
                  r += String.fromCharCode(d.getUint8(i));
                }
                return r;
              }
            }
            catch (ex) {
              DEBUG_LOG("err: " + ex.toString());
            }
            return "";
          });
        };
      }

      if (options.stdout) {
        promises.push(readAllData(proc.stdout, read, options.stdout));
      }
      else {
        promises.push(readAllData(proc.stdout, read, function _f(data) {
          stdoutData += data;
        }));
      }

      if (proc.stderr) {
        if (options.stderr) {
          promises.push(readAllData(proc.stderr, read, options.stderr));
        }
        else {
          promises.push(readAllData(proc.stderr, read, function _f(data) {
            stderrData += data;
          }));
        }
      }

      // Process stdin

      if (typeof options.stdin === "string") {
        write(proc.stdin, options.stdin);
        proc.stdin.close();
      }

      // Handle process completion
      completePromise = new Promise(function _f(resolve, reject) {
        Promise.all(promises)
          .then(() => proc.wait())
          .then(result => {
            if (options.done) {
              let r = {
                stdout: stdoutData,
                stderr: stderrData,
                exitCode: result.exitCode
              };
              options.done(r);
            }
            resolve(result.exitCode);
          });
      });

      return proc;
    });

    procPromise.catch(e => {
      if (options.done)
        options.done({
          exitCode: -1,
          stdout: "",
          stderr: ""
        }, e);
      else
        Cu.reportError(e instanceof Error ? e : e.message || e);
    });

    if (typeof options.stdin === "function") {
      // Some callers (e.g. child_process.js) depend on this
      // being called synchronously.
      options.stdin({
        write(val) {
            procPromise.then(proc => {
              write(proc.stdin, val);
            });
          },

          close() {
            procPromise.then(proc => {
              proc.stdin.close();
            });
          }
      });
    }

    result = {
      get pid() {
        return awaitPromise(procPromise.then(proc => {
          return proc.pid;
        }));
      },

      wait() {
        return awaitPromise(procPromise.then(() => {
          return awaitPromise(completePromise);
        }).then(exitCode => {
          return exitCode;
        }));
      },

      kill(hard = false) {
        procPromise.then(proc => {
          proc.kill(hard ? 0 : undefined);
        });
      }
    };

    return result;
  }
};

function DEBUG_LOG(str) {
  if (gDebugFunction) {
    gDebugFunction("subprocess.jsm: " + str + "\n");
  }
}
