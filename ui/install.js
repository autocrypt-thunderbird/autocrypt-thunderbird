// Install script for Enigmail en-US language pack

var chromeNode = "en-US";

var vers = "0.64.0.0";
var srDest = 10;       // Disk space required for installation (KB)

var prettyName = chromeNode + " language pack for Enigmail";
var regName    = "/enigmail-" + chromeNode;
var chromeName = "enigmail-"+chromeNode + ".jar";
var localeName = "locale/" + chromeNode + "/";

var err;

var platformNode = getPlatform();
logComment("initInstall: platformNode=" + platformNode);

err = initInstall(prettyName, regName, vers);
logComment("initInstall: " + err);

var fChrome = getFolder("Program", "chrome");
logComment("fChrome: " + fChrome);

if (!verifyDiskSpace(fChrome, srDest)) {
  cancelInstall(INSUFFICIENT_DISK_SPACE);

} else {

  // addFile: blank, archive_file, install_dir, install_subdir
  err = addFile("",  chromeName,   fChrome,     "");

  if (err == ACCESS_DENIED) {
    // Profile chrome does not really work right now; see bug 109044
    alert("Unable to write to chrome directory "+fChrome+".\n You will need to restart the browser with administrator/root privileges to install this software. After installing as root (or administrator), you will need to restart the browser one more time to register the installed software.\n After the second restart, you can go back to running the browser without privileges!");

    cancelInstall(ACCESS_DENIED);

  } else if (err != SUCCESS) {
    cancelInstall(err);

  } else {
    // Register chrome
    var chromeJar = getFolder(fChrome, chromeName);

    registerChrome( LOCALE | DELAYED_CHROME, chromeJar,
                    localeName+"enigmail/");

    err = getLastError();

    if (err != SUCCESS) {
      cancelInstall(err);

    } else {
      performInstall();
      logComment("performInstall() returned: " + err);

      if (err == SUCCESS) {
        alert("Installation finished. RESTART the browser to use this enigmail locale via Edit > Preferences > Appearance > Languages/Content.");

      } else if (err == 999) {
        alert("Installation finished. REBOOT your system to use this enigmail locale via Edit > Preferences > Appearance > Languages/Content.");

       resetError();
      }

    }
  }
}


// this function verifies disk space in kilobytes
function verifyDiskSpace(dirPath, spaceRequired) {
  var spaceAvailable;

  // Get the available disk space on the given path
  spaceAvailable = fileGetDiskSpaceAvailable(dirPath);

  // Convert the available disk space into kilobytes
  spaceAvailable = parseInt(spaceAvailable / 1024);

  // do the verification
  if(spaceAvailable < spaceRequired) {
    logComment("Insufficient disk space: " + dirPath);
    logComment("  required : " + spaceRequired + " K");
    logComment("  available: " + spaceAvailable + " K");
    return false;
  }

  return true;
}

// OS type detection
// which platform?
function getPlatform() {
  var platformStr;
  var platformNode;

  if('platform' in Install) {
    platformStr = new String(Install.platform);

    if (!platformStr.search(/^Macintosh/))
      platformNode = 'mac';
    else if (!platformStr.search(/^Win/))
      platformNode = 'win';
    else
      platformNode = 'unix';
  }
  else {
    var fOSMac  = getFolder("Mac System");
    var fOSWin  = getFolder("Win System");

    logComment("fOSMac: "  + fOSMac);
    logComment("fOSWin: "  + fOSWin);

    if(fOSMac != null)
      platformNode = 'mac';
    else if(fOSWin != null)
      platformNode = 'win';
    else
      platformNode = 'unix';
  }

  return platformNode;
}
