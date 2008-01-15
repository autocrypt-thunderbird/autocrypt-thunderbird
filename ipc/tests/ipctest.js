/*
 * buftest.js
 * Test and demo application for:
 * nsIIPCService (runPipe, run)
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
 * The Original Code is protoZilla.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@mozilla-enigmail.org>
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

load("ipc.js");

dump("Testing IPC service etc.\n");

// Test getEnv
dump("\nTesting getEnv('PATH')\n");
dump("  PATH="+getEnv('PATH')+"\n");

// Test runSh
dump("\nTesting runSh('echo ECHO-OUTPUT')\n");
dump("-->  "+runSh('echo ECHO-OUTPUT'));

function escape_nul(str) {
   return str.replace(/\0/g, "\\0");
}

var tempFile = "ipctemp.dat"
var inputData = "TEST \0DATA WITH \0NULS";
var command = "cat";
var outStrObj = new Object();
var outLenObj = new Object();
var errStrObj = new Object();
var errLenObj = new Object();

// Test cat
dump("\nTesting runPipe('"+command+"', '', inputData, ...)\n");
dump("  inputData='"+escape_nul(inputData)+"'\n");
dump("  inputData.length="+inputData.length+"\n");
dump("  exitCode="+ipcService.runPipe(gShell, [gShellParam, command], 2, '', inputData, inputData.length, [], 0, outStrObj, outLenObj, errStrObj, errLenObj)+"\n");

dump("  STDOUT = '"+escape_nul(outStrObj.value)+"'\n");
dump("  STDERR = '"+escape_nul(errStrObj.value)+"'\n");


// Create temporary file
command = "cat > "+tempFile;
dump("\nTesting runPipe('"+command+"', '', inputData, ...)\n");
dump("  inputData='"+escape_nul(inputData)+"'\n");
dump("  inputData.length="+inputData.length+"\n");
dump("  exitCode="+ipcService.runPipe(gShell, [gShellParam, command], 2, '', inputData, inputData.length, [], 0, outStrObj, outLenObj, errStrObj, errLenObj)+"\n");

dump("  STDOUT = '"+escape_nul(outStrObj.value)+"'\n");
dump("  STDERR = '"+escape_nul(errStrObj.value)+"'\n");

// Testing runSh (read from temporary file)
dump("\nTesting runSh('cat "+tempFile+"')\n");
dump("  STDOUT = '"+escape_nul(runSh('cat '+tempFile))+"'\n");

// Read from temporary file to STDOUT
inputData = "";
command = "cat "+ tempFile;

dump("\nTesting runPipe('"+command+"', '', inputData, ...)\n");
dump("  exitCode="+ipcService.runPipe(gShell, [gShellParam, command], 2, '', inputData, inputData.length, [], 0, outStrObj, outLenObj, errStrObj, errLenObj)+"\n");

dump("  outputData.length="+outStrObj.value.length+"\n");
dump("  STDOUT = '"+escape_nul(outStrObj.value)+"'\n");
dump("  STDERR = '"+escape_nul(errStrObj.value)+"'\n");

// Read from temporary file to STDERR
command = "cat 1>&2 "+tempFile;

dump("\nTesting runPipe('"+command+"', '', inputData, ...)\n");
dump("  exitCode="+ipcService.runPipe(gShell, [gShellParam, command], 2, '', inputData, inputData.length, [], 0, outStrObj, outLenObj, errStrObj, errLenObj)+"\n");

dump("  errorData.length="+errStrObj.value.length+"\n");
dump("  STDOUT = '"+escape_nul(outStrObj.value)+"'\n");
dump("  STDERR = '"+escape_nul(errStrObj.value)+"'\n");
