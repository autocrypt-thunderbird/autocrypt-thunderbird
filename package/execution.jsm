/*global Components: false, Data: false, Files: false, Log: false, subprocess: false, EnigmailErrorHandling: false, EnigmailCore: false */
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

const EXPORTED_SYMBOLS = [ "Execution" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/files.jsm");
Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/subprocess.jsm");
Cu.import("resource://enigmail/enigmailErrorHandling.jsm");
Cu.import("resource://enigmail/enigmailCore.jsm");
Cu.import("resource://enigmail/os.jsm"); /*global OS: false */

const nsIEnigmail = Ci.nsIEnigmail;

const Execution = {
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
    execStart: function (command, args, needPassphrase, domWindow, listener, statusFlagsObj) {
        Log.WRITE("execution.jsm: execStart: " +
                  "command = "+Files.formatCmdLine(command, args)+
                  ", needPassphrase="+needPassphrase+
                  ", domWindow="+domWindow+
                  ", listener="+listener+"\n");

        listener = listener || {};

        statusFlagsObj.value = 0;

        var proc = null;

        listener.command = command;

        Log.CONSOLE("enigmail> "+Files.formatCmdLine(command, args)+"\n");

        try {
            proc = subprocess.call({
                command:     command,
                arguments:   args,
                environment: EnigmailCore.getEnvList(),
                charset: null,
                bufferedOutput: true,
                stdin: function (pipe) {
                    if (listener.stdin) listener.stdin(pipe);
                },
                stdout: function(data) { listener.stdout(data); },
                stderr: function(data) { listener.stderr(data); },
                done: function(result) {
                    try {
                        listener.done(result.exitCode);
                    }
                    catch (ex) {
                        Log.writeException("execution.jsm", ex);
                    }
                },
                mergeStderr: false
            });
        } catch (ex) {
            Log.ERROR("execution.jsm: execStart: subprocess.call failed with '"+ex.toString()+"'\n");
            Log.DEBUG("  enigmail> DONE with FAILURE\n");
            return null;
        }
        Log.DEBUG("  enigmail> DONE\n");

        return proc;
    },

    /*
     requirements for listener object:
     exitCode
     stderrData
     */
    execEnd: function (listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj, blockSeparationObj) {
        Log.DEBUG("execution.jsm: execEnd:\n");

        cmdLineObj.value = listener.command;

        var exitCode = listener.exitCode;
        var errOutput = listener.stderrData;

        Log.DEBUG("execution.jsm: execEnd: exitCode = "+exitCode+"\n");
        Log.DEBUG("execution.jsm: execEnd: errOutput = "+errOutput+"\n");

        var retObj = {};
        errorMsgObj.value = EnigmailErrorHandling.parseErrorOutput(errOutput, retObj);
        statusFlagsObj.value = retObj.statusFlags;
        statusMsgObj.value = retObj.statusMsg;
        if (! blockSeparationObj) blockSeparationObj = {};
        blockSeparationObj.value = retObj.blockSeparation;

        if (errOutput.search(/jpeg image of size \d+/)>-1) {
            statusFlagsObj.value |= nsIEnigmail.PHOTO_AVAILABLE;
        }
        if (blockSeparationObj && blockSeparationObj.value.indexOf(" ") > 0) {
            exitCode = 2;
        }

        Log.CONSOLE(Data.convertFromUnicode(errorMsgObj.value)+"\n");

        return exitCode;
    },

    simpleExecCmd: function (command, args, exitCodeObj, errorMsgObj) {
        Log.WRITE("execution.jsm: Execution.simpleExecCmd: command = "+command+" "+args.join(" ")+"\n");

        var outputData = "";
        var errOutput  = "";

        Log.CONSOLE("enigmail> "+Files.formatCmdLine(command, args)+"\n");

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
            Log.ERROR("execution.jsm: Execution.simpleExecCmd: "+command.path+" failed\n");
            Log.DEBUG("  enigmail> DONE with FAILURE\n");
            exitCodeObj.value = -1;
        }
        Log.DEBUG("  enigmail> DONE\n");

        if (errOutput) {
            errorMsgObj.value  = errOutput;
        }

        Log.DEBUG("execution.jsm: Execution.simpleExecCmd: exitCode = "+exitCodeObj.value+"\n");
        Log.DEBUG("execution.jsm: Execution.simpleExecCmd: errOutput = "+errOutput+"\n");

        return outputData;
    },

    execCmd: function (command, args, input, exitCodeObj, statusFlagsObj, statusMsgObj,
                       errorMsgObj, retStatusObj) {
        Log.WRITE("execution.jsm: Execution.execCmd: subprocess = '"+command.path+"'\n");

        if ((typeof input) != "string") input = "";

        var preInput = "";
        var outputData = "";
        var errOutput  = "";
        Log.CONSOLE("enigmail> "+Files.formatCmdLine(command, args)+"\n");
        var procBuilder = new subprocess.ProcessBuilder();
        procBuilder.setCommand(command);
        procBuilder.setArguments(args);
        procBuilder.setEnvironment(EnigmailCore.getEnvList());
        procBuilder.setStdin(
            function (pipe) {
                if (input.length > 0 || preInput.length > 0) {
                    pipe.write(preInput + input);
                }
                pipe.close();
            }
        );
        procBuilder.setDone(
            function (result) {
                if (result.stdout) outputData = result.stdout;
                if (result.stderr) errOutput = result.stderr;
                exitCodeObj.value = result.exitCode;
            }
        );

        var proc = procBuilder.build();
        try {
            subprocess.call(proc).wait();
        } catch (ex) {
            Log.ERROR("execution.jsm: Execution.execCmd: subprocess.call failed with '"+ex.toString()+"'\n");
            Log.DEBUG("  enigmail> DONE with FAILURE\n");
            exitCodeObj.value = -1;
        }
        Log.DEBUG("  enigmail> DONE\n");

        if (proc.resultData) outputData = proc.resultData;
        if (proc.errorData) errOutput  = proc.errorData;

        Log.DEBUG("execution.jsm: Execution.execCmd: exitCode = "+exitCodeObj.value+"\n");
        Log.DEBUG("execution.jsm: Execution.execCmd: errOutput = "+errOutput+"\n");


        if (! retStatusObj) {
            retStatusObj = {};
        }

        errorMsgObj.value = EnigmailErrorHandling.parseErrorOutput(errOutput, retStatusObj);
        statusFlagsObj.value = retStatusObj.statusFlags;
        statusMsgObj.value = retStatusObj.statusMsg;
        var blockSeparation = retStatusObj.blockSeparation;

        exitCodeObj.value = Execution.fixExitCode(exitCodeObj.value, statusFlagsObj.value);

        if (blockSeparation.indexOf(" ") > 0) {
            exitCodeObj.value = 2;
        }

        Log.CONSOLE(errorMsgObj.value+"\n");

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
    fixExitCode: function (exitCode, statusFlags) {
        Log.DEBUG("execution.jsm: Execution.fixExitCode: agentType: " + Execution.agentType + " exitCode: " + exitCode + " statusFlags " + statusFlags + "\n");
        if (exitCode !== 0) {
            if ((statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
                (statusFlags & nsIEnigmail.DECRYPTION_OKAY )) {
                    Log.DEBUG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode for decrypted msg "+exitCode+"->0\n");
                    exitCode = 0;
                }
        }

        if ((Execution.agentType === "gpg") && (exitCode == 256) && (OS.getOS() == "WINNT")) {
            Log.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
            if (statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
                Log.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->2\n");
                exitCode = 2;
            } else {
                Log.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->0\n");
                exitCode = 0;
            }
        }

        return exitCode;
    },

    execCmd2: function (command, args, stdinFunc, stdoutFunc, doneFunc) {
        var procBuilder = new subprocess.ProcessBuilder();
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
                if(stdinFunc) {
                    stdinFunc(pipe);
                } else {
                    pipe.close();
                }
            },
            stdout: function(data) {
                simpleListener.stdoutData += data;
            },
            stderr: function (data) {
                simpleListener.stderrData += data;
            },
            done: function(exitCode) {
                simpleListener.exitCode = exitCode;
                if(doneFunc) {
                    doneFunc(exitCode);
                }
            }
        };

        return simpleListener;
    }
};
