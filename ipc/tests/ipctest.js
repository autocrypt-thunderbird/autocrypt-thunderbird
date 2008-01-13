// Tests nsIProcessInfo, nsIIPCService

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
