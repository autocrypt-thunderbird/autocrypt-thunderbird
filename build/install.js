var err;

err = initInstall("Enigmime v0.60.0", // name for install UI
                  "/enigmime",         // registered name
                  "0.60.0.0");        // package version

logComment("initInstall: " + err);

var fComponents = getFolder("Components");

// addDirectory: blank, archive_dir, install_dir, install_subdir
err = addDirectory("", "components", fComponents, "");
if (err != SUCCESS)
   cancelInstall(err);

if (getLastError() == SUCCESS)
    performInstall();
else {
   alert("Error detected during installation setup: "+getLastError());
   cancelInstall();
}
