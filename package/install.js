// Install script for Enigmail

var err;

err = initInstall("Enigmail v0.15",  // name for install UI
                  "/enigmail",       // registered name
                  "0.15.0.0");       // package version

logComment("initInstall: " + err);

var fChrome     = getFolder("Chrome");
var fComponents = getFolder("Components");
var fProfile    = getFolder("Profile");

// addDirectory: blank, archive_dir, install_dir, install_subdir
err = addDirectory("", "chrome",     fChrome,     "");
if (err != SUCCESS)
   cancelInstall(err);

err = addDirectory("", "components", fComponents, "");
if (err != SUCCESS)
   cancelInstall(err);

///err = addDirectory("", "enigmail",   fProfile,    "enigmail");
///if (err != SUCCESS)
///   cancelInstall(err);

// Register chrome
registerChrome(PACKAGE | DELAYED_CHROME, getFolder("Chrome","enigmail.jar"), "content/enigmail/");

registerChrome(   SKIN | DELAYED_CHROME, getFolder("Chrome","enigmail.jar"), "skin/modern/enigmail/");

registerChrome( LOCALE | DELAYED_CHROME, getFolder("Chrome","enigmail.jar"), "locale/en-US/enigmail/");

if (getLastError() == SUCCESS)
    performInstall();
else {
   alert("Error detected during installation setup: "+getLastError());
   cancelInstall();
}
