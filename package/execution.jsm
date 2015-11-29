/*global Components: false, EnigmailData: false, EnigmailFiles: false, EnigmailLog: false, subprocess: false, EnigmailErrorHandling: false, EnigmailCore: false */
/*jshint -W097 */
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
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Ramalingam Saravanan <svn@xmlterm.org>
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
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

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailExecution"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/files.jsm");
Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/subprocess.jsm");
Cu.import("resource://enigmail/errorHandling.jsm");
Cu.import("resource://enigmail/core.jsm");
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/system.jsm"); /*global EnigmailSystem: false */

const nsIEnigmail = Ci.nsIEnigmail;

const EnigmailExecution = {
  agentType: "",

  /**
   * execStart Listener Object
   *
   * The listener object must implement at least the following methods:
   *
   *  stdin(pipe)    - OPTIONAL - write data to subprocess stdin via |pipe| hanlde
   *  stdout(data)   - receive |data| from subprocess stdout
   *  stderr(data)   - receive |data| from subprocess stderr
   *  done(exitCode) - receive signal when subprocess has terminated
   */

  /**
   *  start a subprocess (usually gpg) that gets and/or receives data via stdin/stdout/stderr.
   *
   * @command:        either: String - full path to executable
   *                  or:     nsIFile object referencing executable
   * @args:           Array of Strings: command line parameters for executable
   * @needPassphrase: Boolean - is a passphrase required for the action?
   *                    if true, the password may be promted using a dialog
   *                    (unless alreday cached or gpg-agent is used)
   * @domWindow:      nsIWindow - window on top of which password dialog is shown
   * @listener:       Object - Listener to interact with subprocess; see spec. above
   * @statusflagsObj: Object - .value will hold status Flags
   *
   * @return:         handle to suprocess
   */
  execStart: function(command, args, needPassphrase, domWindow, listener, statusFlagsObj) {
    EnigmailLog.WRITE("execution.jsm: execStart: " +
      "command = " + EnigmailFiles.formatCmdLine(command, args) +
      ", needPassphrase=" + needPassphrase +
      ", domWindow=" + domWindow +
      ", listener=" + listener + "\n");

    listener = listener || {};

    statusFlagsObj.value = 0;

    var proc = null;

    listener.command = command;

    EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(command, args) + "\n");

    try {
      proc = subprocess.call({
        command: command,
        arguments: args,
        environment: EnigmailCore.getEnvList(),
        charset: null,
        bufferedOutput: true,
        stdin: function(pipe) {
          if (listener.stdin) listener.stdin(pipe);
        },
        stdout: function(data) {
          listener.stdout(data);
        },
        stderr: function(data) {
          listener.stderr(data);
        },
        done: function(result) {
          try {
            listener.done(result.exitCode);
          }
          catch (ex) {
            EnigmailLog.writeException("execution.jsm", ex);
          }
        },
        mergeStderr: false
      });
    }
    catch (ex) {
      EnigmailLog.ERROR("execution.jsm: execStart: subprocess.call failed with '" + ex.toString() + "'\n");
      EnigmailLog.DEBUG("  enigmail> DONE with FAILURE\n");
      return null;
    }
    EnigmailLog.DEBUG("  enigmail> DONE\n");

    return proc;
  },

  /*
   requirements for listener object:
   exitCode
   stderrData
   */
  execEnd: function(listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj, blockSeparationObj) {
    EnigmailLog.DEBUG("execution.jsm: execEnd:\n");

    cmdLineObj.value = listener.command;

    var exitCode = listener.exitCode;
    var errOutput = listener.stderrData;

    EnigmailLog.DEBUG("execution.jsm: execEnd: exitCode = " + exitCode + "\n");
    EnigmailLog.DEBUG("execution.jsm: execEnd: errOutput = " + errOutput + "\n");

    var retObj = {};
    errorMsgObj.value = EnigmailErrorHandling.parseErrorOutput(errOutput, retObj);
    statusFlagsObj.value = retObj.statusFlags;
    statusMsgObj.value = retObj.statusMsg;
    if (!blockSeparationObj) blockSeparationObj = {};
    blockSeparationObj.value = retObj.blockSeparation;

    if (errOutput.search(/jpeg image of size \d+/) > -1) {
      statusFlagsObj.value |= nsIEnigmail.PHOTO_AVAILABLE;
    }
    if (blockSeparationObj && blockSeparationObj.value.indexOf(" ") > 0) {
      exitCode = 2;
    }

    EnigmailLog.CONSOLE(EnigmailData.convertFromUnicode(errorMsgObj.value) + "\n");

    return exitCode;
  },

  simpleExecCmd: function(command, args, exitCodeObj, errorMsgObj) {
    EnigmailLog.WRITE("execution.jsm: EnigmailExecution.simpleExecCmd: command = " + command + " " + args.join(" ") + "\n");

    var outputData = "";
    var errOutput = "";

    EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(command, args) + "\n");

    try {
      subprocess.call({
        command: command,
        arguments: args,
        charset: null,
        environment: EnigmailCore.getEnvList(),
        done: function(result) {
          exitCodeObj.value = result.exitCode;
          outputData = result.stdout;
          errOutput = result.stderr;
        },
        mergeStderr: false
      }).wait();
    }
    catch (ex) {
      EnigmailLog.ERROR("execution.jsm: EnigmailExecution.simpleExecCmd: " + command.path + " failed\n");
      EnigmailLog.DEBUG("  enigmail> DONE with FAILURE\n");
      exitCodeObj.value = -1;
    }
    EnigmailLog.DEBUG("  enigmail> DONE\n");

    if (errOutput) {
      errorMsgObj.value = errOutput;
    }

    EnigmailLog.DEBUG("execution.jsm: EnigmailExecution.simpleExecCmd: exitCode = " + exitCodeObj.value + "\n");
    EnigmailLog.DEBUG("execution.jsm: EnigmailExecution.simpleExecCmd: errOutput = " + errOutput + "\n");

    return outputData;
  },

  execCmd: function(command, args, input, exitCodeObj, statusFlagsObj, statusMsgObj,
    errorMsgObj, retStatusObj) {
    EnigmailLog.WRITE("execution.jsm: EnigmailExecution.execCmd: subprocess = '" + command.path + "'\n");

    if ((typeof input) != "string") input = "";

    var preInput = "";
    var outputData = "";
    var errOutput = "";
    EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(command, args) + "\n");
    var procBuilder = new EnigmailExecution.processBuilder();
    procBuilder.setCommand(command);
    procBuilder.setArguments(args);
    procBuilder.setEnvironment(EnigmailCore.getEnvList());
    procBuilder.setStdin(
      function(pipe) {
        if (input.length > 0 || preInput.length > 0) {
          pipe.write(preInput + input);
        }
        pipe.close();
      }
    );
    procBuilder.setDone(
      function(result) {
        if (result.stdout) outputData = result.stdout;
        if (result.stderr) errOutput = result.stderr;
        exitCodeObj.value = result.exitCode;
      }
    );

    var proc = procBuilder.build();
    try {
      subprocess.call(proc).wait();
    }
    catch (ex) {
      EnigmailLog.ERROR("execution.jsm: EnigmailExecution.execCmd: subprocess.call failed with '" + ex.toString() + "'\n");
      EnigmailLog.DEBUG("  enigmail> DONE with FAILURE\n");
      exitCodeObj.value = -1;
    }
    EnigmailLog.DEBUG("  enigmail> DONE\n");

    if (proc.resultData) outputData = proc.resultData;
    if (proc.errorData) errOutput = proc.errorData;

    EnigmailLog.DEBUG("execution.jsm: EnigmailExecution.execCmd: exitCode = " + exitCodeObj.value + "\n");
    EnigmailLog.DEBUG("execution.jsm: EnigmailExecution.execCmd: errOutput = " + errOutput + "\n");


    if (!retStatusObj) {
      retStatusObj = {};
    }

    errorMsgObj.value = EnigmailErrorHandling.parseErrorOutput(errOutput, retStatusObj);

    statusFlagsObj.value = retStatusObj.statusFlags;
    statusMsgObj.value = retStatusObj.statusMsg;
    var blockSeparation = retStatusObj.blockSeparation;

    exitCodeObj.value = EnigmailExecution.fixExitCode(exitCodeObj.value, statusFlagsObj.value);

    if (blockSeparation.indexOf(" ") > 0) {
      exitCodeObj.value = 2;
    }

    EnigmailLog.CONSOLE(errorMsgObj.value + "\n");

    return outputData;
  },

  /**
   * Fix the exit code of GnuPG (which may be wrong in some circumstances)
   *
   * @exitCode:    Number - the exitCode obtained from GnuPG
   * @statusFlags: Numebr - the statusFlags as calculated by parseErrorOutput()
   *
   * @return: Number - fixed exit code
   */
  fixExitCode: function(exitCode, statusFlags) {
    EnigmailLog.DEBUG("execution.jsm: EnigmailExecution.fixExitCode: agentType: " + EnigmailExecution.agentType + " exitCode: " + exitCode + " statusFlags " + statusFlags + "\n");
    if (exitCode !== 0) {
      if ((statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
        (statusFlags & nsIEnigmail.DECRYPTION_OKAY)) {
        EnigmailLog.DEBUG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode for decrypted msg " + exitCode + "->0\n");
        exitCode = 0;
      }
    }

    if ((EnigmailExecution.agentType === "gpg") && (exitCode == 256) && (EnigmailOS.getOS() == "WINNT")) {
      EnigmailLog.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
      if (statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
        EnigmailLog.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->2\n");
        exitCode = 2;
      }
      else {
        EnigmailLog.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->0\n");
        exitCode = 0;
      }
    }

    return exitCode;
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

  execCmd2: function(command, args, stdinFunc, stdoutFunc, doneFunc) {
    var procBuilder = new EnigmailExecution.processBuilder();
    procBuilder.setCommand(command);
    procBuilder.setArguments(args);
    procBuilder.setEnvironment(EnigmailCore.getEnvList());
    procBuilder.setStdin(stdinFunc);
    procBuilder.setStdout(stdoutFunc);
    procBuilder.setDone(doneFunc);
    var proc = procBuilder.build();
    subprocess.call(proc).wait();
  },


  /**
   * simple listener for using with execStart
   *
   * stdinFunc: optional function to write to stdin
   * doneFunc : optional function that is called when the process is terminated
   */
  newSimpleListener: function(stdinFunc, doneFunc) {
    let simpleListener = {
      stdoutData: "",
      stderrData: "",
      exitCode: -1,
      stdin: function(pipe) {
        if (stdinFunc) {
          stdinFunc(pipe);
        }
        else {
          pipe.close();
        }
      },
      stdout: function(data) {
        simpleListener.stdoutData += data;
      },
      stderr: function(data) {
        simpleListener.stderrData += data;
      },
      done: function(exitCode) {
        simpleListener.exitCode = exitCode;
        if (doneFunc) {
          doneFunc(exitCode);
        }
      }
    };

    return simpleListener;
  }
};
