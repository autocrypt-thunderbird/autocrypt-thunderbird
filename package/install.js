// Install script for Enigmail

var err;
const APP_VERSION="0.84.1";

err = initInstall("Enigmail v"+APP_VERSION,  // name for install UI
                  "/enigmail",               // registered name
                  APP_VERSION+".0");         // package version

logComment("initInstall: " + err);

var srDest = 500;       // Disk space required for installation (KB)

var fProgram    = getFolder("Program");
logComment("fProgram: " + fProgram);

if (!verifyDiskSpace(fProgram, srDest)) {
  cancelInstall(INSUFFICIENT_DISK_SPACE);

} else {

  var fChrome     = getFolder("Chrome");
  var fComponents = getFolder("Components");
  var fDefaults   = getFolder("Program", "defaults/pref");

  // addDirectory: blank, archive_dir, install_dir, install_subdir
  addDirectory("", "components",    fComponents, "");
  addDirectory("", "chrome",        fChrome,     "");
  addDirectory("", "defaults/pref", fDefaults,   "");

  err = getLastError();
  if (err == ACCESS_DENIED) {
    alert("Unable to write to components directory "+fComponents+".\n You will need to restart the browser with administrator/root privileges to install this software. After installing as root (or administrator), you will need to restart the browser one more time, as a privileged user, to register the installed software.\n After the second restart, you can go back to running the browser without privileges!");

    cancelInstall(ACCESS_DENIED);

  } else if (err != SUCCESS) {
    cancelInstall(err);

  } else {
    // Register chrome

    var isTbird = false;
    var execFile = 'thunderbird' + (getPlatform() == "win" ? '.exe' : '-bin');
    if (File.exists(getFolder(getFolder('Program'), execFile))) {
      isTbird = confirm("Detected installation on Thunderbird. Is this correct?");
    }
    else {
      isTbird = !confirm("Detected installation on Mozilla or Netscape. Is this correct?");
    }
//  old way:
//  var isTbird = !confirm("Which Theme do you want to install for Enigmail? Click:\n[ OK ] for Mozilla\n[ Cancel ] for Thunderbird");

    registerChrome(PACKAGE | DELAYED_CHROME, getFolder("Chrome","enigmail.jar"), "content/enigmail/");

    if (! isTbird) {
      registerChrome(   SKIN | DELAYED_CHROME, getFolder("Chrome","enigmail-skin.jar"), "skin/modern/enigmail/");

      registerChrome(   SKIN | DELAYED_CHROME, getFolder("Chrome","enigmail-skin.jar"), "skin/classic/enigmail/");
    }
    else {
      registerChrome(   SKIN | DELAYED_CHROME, getFolder("Chrome","enigmail-skin-tbird.jar"), "skin/classic/enigmail/");
    }
    registerChrome( LOCALE | DELAYED_CHROME, getFolder("Chrome","enigmail.jar"), "locale/en-US/enigmail/");

    err = getLastError();

    if (err != SUCCESS) {
      cancelInstall(err);

    } else {
      performInstall();
      if (isTbird) {
        var xulFile="XUL."+(getPlatform() == "win" ? 'mfl' : 'mfasl');
        alert("Enigmail v"+APP_VERSION+" has been successfully installed. Install the EnigMime module and then restart Thunderbird.\n\n ********** IMPORTANT **********\nIf you upgraded from a previous version of Thunderbird, you *must* delete "+xulFile+" and the chrome folder in your profile directory, or Thunderbird/Enigmail may not work properly and may even *crash* !");
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
