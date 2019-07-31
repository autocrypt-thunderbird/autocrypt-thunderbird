/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

const EXPORTED_SYMBOLS = ["EnigmailExecution"];

const EnigmailFiles = ChromeUtils.import("chrome://autocrypt/content/modules/files.jsm").EnigmailFiles;
const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const subprocess = ChromeUtils.import("chrome://autocrypt/content/modules/subprocess.jsm").subprocess;
const EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;

var EnigmailExecution = {
  /**
   * Execute a command and asynchronously, and return a Promise
   * Accepts input and returns error message and statusFlags.
   *
   * @param {String/nsIFile}  command: either full path to executable
   *                                    or: object referencing executable
   * @param {Array of Strings}   args: command line parameters for executable
   * @param {String}            input: data to pass to subprocess via stdin
   * @param {Object} subprocessHandle: handle to subprocess. The subprocess may be
   *                        killed via subprocessHandle.value.killProcess();
   *
   * @return {Promise<Object>}: Object with:
   *        - {Number} exitCode
   *        - {String} stdoutData  - unmodified data from stdout
   *        - {String} stderrData  - unmodified data from stderr
   *        - {String} errorMsg    - error message from parseErrorOutput()
   *        - {Number} statusFlags
   *        - {String} statusMsg   - pre-processed status messages (without [GNUPG:])
   *        - blockSeparation
   *        - isKilled: 0
   */

  execAsync: function(command, args, input, subprocessHandle = null) {
    EnigmailLog.WRITE("execution.jsm: execAsync: command = '" + command + "'\n");

    if ((typeof input) != "string") input = "";

    let outputData = "";
    let errOutput = "";
    let returnObj = {
      exitCode: -1,
      stdoutData: "",
      stderrData: "",
      errorMsg: "",
      statusFlags: 0,
      statusMsg: "",
      blockSeparation: "",
      isKilled: 0
    };

    EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(command, args) + "\n");

    const procBuilder = new EnigmailExecution.processBuilder();
    procBuilder.setCommand(command);
    procBuilder.setArguments(args);
    procBuilder.setEnvironment(EnigmailCore.getEnvList());
    procBuilder.setStdin(
      function(pipe) {
        if (input.length > 0) {
          pipe.write(input);
        }
        pipe.close();
      }
    );
    procBuilder.setStdout(
      function(data) {
        outputData += data;
      }
    );
    procBuilder.setStderr(
      function(data) {
        errOutput += data;
      }
    );

    return new Promise((resolve, reject) => {
      procBuilder.setDone(
        function(result) {
          let exitCode = result.exitCode;
          EnigmailLog.DEBUG("  enigmail> DONE\n");
          EnigmailLog.DEBUG("execution.jsm: execAsync: exitCode = " + exitCode + "\n");
          EnigmailLog.DEBUG("execution.jsm: execAsync: stderrData = " + errOutput + "\n");
          EnigmailLog.DEBUG("execution.jsm: execAsync: stdoutData = " + outputData.length + " bytes\n");

          returnObj.exitCode = exitCode;
          returnObj.stdoutData = outputData;
          returnObj.stderrData = errOutput;

          resolve(returnObj);
        }
      );
      const proc = procBuilder.build();
      try {
        let p = subprocess.call(proc);
        if (subprocessHandle) {
          p.killProcess = function(hardKill) {
            returnObj.isKilled = 1;
            this.kill(hardKill);
          };
          subprocessHandle.value = p;
        }
      }
      catch (ex) {
        EnigmailLog.ERROR("execution.jsm: execAsync: subprocess.call failed with '" + ex.toString() + "'\n");
        EnigmailLog.DEBUG("  enigmail> DONE with FAILURE\n");
        reject(returnObj);
      }
    });
  },

  processBuilder: function() {
    this.process = {};
    this.setCommand = function(command) {
      this.process.command = command;
    };
    this.setArguments = function(args) {
      this.process.arguments = args;
    };
    this.setEnvironment = function(envList) {
      this.process.environment = envList;
    };
    this.setStdin = function(stdin) {
      this.process.stdin = stdin;
    };
    this.setStdout = function(stdout) {
      this.process.stdout = stdout;
    };
    this.setStderr = function(stderr) {
      this.process.stderr = stderr;
    };
    this.setDone = function(done) {
      this.process.done = done;
    };
    this.build = function() {
      this.process.charset = null;
      this.process.mergeStderr = false;
      this.process.resultData = "";
      this.process.errorData = "";
      this.process.exitCode = -1;
      return this.process;
    };
    return this;
  },
};
