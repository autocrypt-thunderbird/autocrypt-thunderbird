// Install script for Enigmail en-US language pack

var err;

err = initInstall("Enigmail-en-US v0.51.0",  // name for install UI
                  "/enigmail-en-US",         // registered name
                  "0.51.0.0");               // package version

logComment("initInstall: " + err);

var fChrome = getFolder("Chrome");

// addDirectory: blank, archive_dir, install_dir, install_subdir
err = addDirectory("", "chrome",     fChrome,     "");
if (err != SUCCESS)
   cancelInstall(err);

// Register chrome
registerChrome( LOCALE | DELAYED_CHROME, getFolder("Chrome","enigmail-en-US.jar"), "locale/en-US/enigmail/");

if (getLastError() == SUCCESS)
    performInstall();
else {
   alert("Error detected during installation setup: "+getLastError());
   cancelInstall();
}
