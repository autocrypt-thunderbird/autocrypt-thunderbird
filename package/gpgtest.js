// Tests gpg

load("ipc.js");

dump("Testing GPG\n");

var cmd1 = "gpg --always-trust --batch --no-tty --passphrase-fd 0 --status-fd 2 -a -s -e -u saravn@mozdev.org -r svn@ncar.ucar.edu";

var cmd2 = "command.com /c " + cmd1;

var cmd3 = "c:\\\\WINNT\\\\gpg.exe --batch --no-tty --version";

var cmda = "cat";

var cmdb = "command.com /c " + cmda;

var cmdc = "winipc.exe";

var command = cmd1;

var useShell = false;

var inputData = "passphrase\ntest message\n";
var outStrObj = new Object();
var outLenObj = new Object();
var errStrObj = new Object();
var errLenObj = new Object();

// Create temporary file
dump("\nTesting execPipe('"+command+"', ...)\n");
dump("  exitCode="+ipcService.execPipe(command, useShell, inputData, inputData.length, [], 0, outStrObj, outLenObj, errStrObj, errLenObj)+"\n");

dump("  STDOUT = '"+outStrObj.value+"'\n");
dump("  STDERR = '"+errStrObj.value+"'\n");

