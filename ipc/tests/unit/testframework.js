/**
 *  Helper framework if tests should be performed within a running app
 */
var gTestError=0;
var gTestPending=0;

function dumperr(str) {
  gTestError = 1;
	var consoleSvc = Components.classes["@mozilla.org/consoleservice;1"].
			getService(Components.interfaces.nsIConsoleService);
	consoleSvc.logStringMessage("IPC-Pipe Test: "+str);
}

function do_check_true(boolValue)
{
  if (! boolValue)
    dumperr("ERROR: found not true value");
}

function do_check_false(boolValue)
{
  if (boolValue)
    dumperr("ERROR: found true value");
}

function do_check_eq(a, b)
{
  if (! (a == b))
    dumperr("ERROR: found: '"+a+"' != '"+b+"'");
}

function do_check_neq(a, b)
{
  if (a == b)
    dumperr("ERROR: found: '"+a+"' == '"+b+"'");
}

function do_throw(txt) {
  dumperr(txt);
}


function do_get_cwd() {
  var fn="/Users/pbr/enigmail/tmp";

  var localfile = Components.classes["@mozilla.org/file/local;1"].createInstance(
        Components.interfaces.nsIFile);
  localfile.initWithPath(fn);

  return localfile;
}

function do_get_file(testdirRelativePath, allowNonexistent)
{

  var isLinux = ("@mozilla.org/gnome-gconf-service;1" in Components.classes);
  var fn="";

  if (isLinux)
    fn="/home/enigmail/tmp/"+testdirRelativePath;
  else
    fn="/Users/pbr/enigmail/tmp/"+testdirRelativePath;



  var localfile = Components.classes["@mozilla.org/file/local;1"].createInstance(
        Components.interfaces.nsILocalFile);
  localfile.initWithPath(fn);

  if (! (allowNonexistent || localfile.exists())) {
    dumperr("ERROR: file '"+fn+"' not found");
    return null;
  }
  return localfile;
}

function do_test_pending() {
  gTestPending=1;
  window.setTimeout(checkStillPending, 300);
}

function checkStillPending() {
  if (gTestPending)
    window.setTimeout(checkStillPending, 300);
}

function do_test_finished() {
  gTestPending = 0;

  if (gTestError == 0)
    alert("all tests succeeded OK");
  else
    alert("Test terminated with error");
}

function run_test_wrapper() {
  gTestError=0;

  try {
    run_test();
    if (! gTestPending) do_test_finished();
  }
  catch (ex) {
    dumperr(ex.toString());
    alert("Test created exception");
  }
  //dumperr("---- end -----");
}


