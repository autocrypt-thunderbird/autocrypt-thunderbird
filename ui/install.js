// Install script for Enigmail en-US language pack

var err;

var lang = "en-US";
var vers = "0.51.0.0";

err = initInstall("Enigmail-"+lang+" v"+vers,  // name for install UI
                  "/enigmail-"+lang,           // registered name
                  vers);                       // package version

logComment("initInstall: " + err);

var fChrome = getFolder("Chrome");

// addFile: blank, archive_file, install_dir, install_subdir
err = addFile("", "enigmail-"+lang+".jar",     fChrome,     "");
if (err != SUCCESS)
   cancelInstall(err);

// Register chrome
registerChrome( LOCALE | DELAYED_CHROME,
                getFolder("Chrome","enigmail-"+lang+".jar"),
                "locale/"+lang+"/enigmail/");

if (getLastError() == SUCCESS)
    performInstall();
else {
   alert("Error detected during installation setup: "+getLastError());
   cancelInstall();
}
