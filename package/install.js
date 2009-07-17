// Install script for Enigmail

var err;
const APP_VERSION="0.97a.0";


const ABI_PLATFORM_LINUX="Linux_x86-gcc3";
const ABI_PLATFORM_WIN="WINNT_x86-msvc";
const ABI_PLATFORM_DARWIN_PPC="Darwin_ppc-gcc3";
const ABI_PLATFORM_DARWIN_X86="Darwin_x86-gcc3";
const ABI_PLATFORM_OS2="OS2_x86-gcc3";

const APP_PLATFORM_LINUX="linux";
const APP_PLATFORM_WIN="win";
const APP_PLATFORM_MAC="mac";
const APP_PLATFORM_OS2="os2";
const APP_PLATFORM_OTHER="other";


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
  var platformNode = "";

  if('platform' in Install) {
    platformStr = new String(Install.platform);

    if (!platformStr.search(/^Macintosh/))
      platformNode = APP_PLATFORM_MAC;
    else if (!platformStr.search(/^Win/))
      platformNode = APP_PLATFORM_WIN;
    else if (!platformStr.search(/Linux/))
      platformNode = APP_PLATFORM_LINUX;
    else if (!platformStr.search(/^OS\/2/))
      platformNode = APP_PLATFORM_OS2;
    else
      platformNode = APP_PLATFORM_OTHER;
  }

  return platformNode;
}

err = initInstall("Enigmail v"+APP_VERSION,  // name for install UI
                  "/enigmail",               // registered name
                  APP_VERSION);              // package version

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

  // workaround for Mozilla 1.8a3 and newer, failing to register enigmime correctly

  var delComps = [ "compreg.dat" ]; // Components registry

  for (var j=0; j<delComps.length; j++) {
     var delFile = getFolder(fComponents, delComps[j]);
     if (File.exists(delFile))
        File.remove(delFile);
  }

  switch (getPlatform()) {
  case APP_PLATFORM_LINUX:
    addDirectory("", "platform/"+ABI_PLATFORM_LINUX+"/components",    fComponents, "");
    break;
  case APP_PLATFORM_WIN:
    addDirectory("", "platform/"+ABI_PLATFORM_WIN+"/components",    fComponents, "");
    break;
  case APP_PLATFORM_MAC:
    addDirectory("", "platform/"+ABI_PLATFORM_DARWIN_PPC+"/components",    fComponents, "");
    addDirectory("", "platform/"+ABI_PLATFORM_DARWIN_X86+"/components",    fComponents, "");
    break;
  case APP_PLATFORM_OS2:
    addDirectory("", "platform/"+ABI_PLATFORM_OS2+"/components",    fComponents, "");
    break;
  }

  err = getLastError();
  if (err == DOES_NOT_EXIST) {
    // error code: file does not exist
    logComment("platform dependent directory does not exist: " + err);
    resetError();
  }
  else if (err != SUCCESS) {
    cancelInstall(err);
  }

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
    }
  }
}
