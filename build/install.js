var err;

err = initInstall("Enigmime v0.99.10", // name for install UI
                  "/enigmime",         // registered name
                  "0.99.10.0");        // package version

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
