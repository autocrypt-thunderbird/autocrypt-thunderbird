#!/bin/sh

# this script is used to create a language-specifi XPI for Enigmail

# if you want to debug this script, set DEBUG to something >0
DEBUG=0

if [ $# -ne 2 ]; then
  echo "Usage: $0 xx-YY version"
  echo "       where: xx-YY   is the language and country code representing the"
  echo "                      translated language"
  echo "              version is the Enigmail version, e.g. 0.84.0"
  exit 1
fi

ENIGLANG=$1
export ENIGLANG

ENIGVERSION=$2
export ENIGVERSION

LANGDIR=${ENIGLANG}/locale/${ENIGLANG}/enigmail
HELPDIR=${LANGDIR}/help
rm -rf ${LANGDIR} >/dev/null 2>&1
mkdir -p ${LANGDIR} 
mkdir -p ${HELPDIR}

# create install.js
cat > ${ENIGLANG}/install.js <<EOT
// Install script for Enigmail ${ENIGLANG} language pack

var chromeNode = "${ENIGLANG}";

var vers = "${ENIGVERSION}.0";
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
EOT

# create enigmail-xx-YY.spec
cat > ${ENIGLANG}/enigmail-${ENIGLANG}.spec <<EOT
Name:      mozilla-enigmail-${ENIGLANG}
Version:   ${ENIGVERSION}
Release:   1
Requires:  mozilla-enigmail = ${ENIGVERSION}
Summary:   Language pack for Enigmail (${ENIGLANG})
Copyright: Mozilla Public License 1.1/GPL
Group:     Applications/Internet
Source:    http://enigmail.mozdev.org/source.html
URL:       http://enigmail.mozdev.org/
Vendor:    xmlterm.org
Packager:  R. Saravanan <svn@xmlterm.org>

%description

 mozilla-enigmail-${ENIGLANG}: Language pack for Enigmail (${ENIGLANG})

%prep
cd \$RPM_BUILD_DIR
rm -rf \${RPM_PACKAGE_NAME}-\${RPM_PACKAGE_VERSION}
mkdir \${RPM_PACKAGE_NAME}-\${RPM_PACKAGE_VERSION}
cd \${RPM_PACKAGE_NAME}-\${RPM_PACKAGE_VERSION}

unzip \${RPM_SOURCE_DIR}/enigmail-${ENIGLANG}-\${RPM_PACKAGE_VERSION}.xpi
if [ \$? -ne 0 ]; then
  exit \$?
fi

chown -R root.root .
chmod -R a+rX,g-w,o-w .

%build

%install
cd \${RPM_PACKAGE_NAME}-\${RPM_PACKAGE_VERSION}
install -m 755 enigmail-${ENIGLANG}.jar     /usr/lib/mozilla/chrome

%pre

%post

if [ -f /usr/lib/mozilla/chrome/installed-chrome.txt ]; then

  cat << EOF >> /usr/lib/mozilla/chrome/installed-chrome.txt
locale,install,url,jar:resource:/chrome/enigmail-${ENIGLANG}.jar!/locale/${ENIGLANG}/enigmail/
EOF

fi

if [ -f /usr/lib/mozilla/mozilla-rebuild-databases.pl ]; then
    /usr/lib/mozilla/mozilla-rebuild-databases.pl
fi

%postun

if [ -f /usr/lib/mozilla/mozilla-rebuild-databases.pl ]; then
    /usr/lib/mozilla/mozilla-rebuild-databases.pl
fi

%files

/usr/lib/mozilla/chrome/enigmail-${ENIGLANG}.jar

%changelog
EOT

cat >${LANGDIR}/contents.rdf <<EOT
<?xml version="1.0"?>
<RDF:RDF xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:chrome="http://www.mozilla.org/rdf/chrome#">

  <!-- list all the packages being supplied by this jar -->
  <RDF:Seq about="urn:mozilla:locale:root">
    <RDF:li resource="urn:mozilla:locale:${ENIGLANG}"/>
  </RDF:Seq>

  <!-- locale information -->
  <RDF:Description about="urn:mozilla:locale:${ENIGLANG}">

    <chrome:packages>
      <RDF:Seq about="urn:mozilla:locale:${ENIGLANG}:packages">
        <RDF:li resource="urn:mozilla:locale:${ENIGLANG}:enigmail"/>
      </RDF:Seq>
    </chrome:packages>

  </RDF:Description>

</RDF:RDF>
EOT

for f in enigmail.dtd enigmail.properties am-enigprefs.properties upgrade_080.html ; do
  cp ${f} ${LANGDIR}
done

for f in compose.html messenger.html rulesEditor.html editRcptRule.html ; do
  cp ${f} ${HELPDIR} >/dev/null 2>&1
done

cd ${ENIGLANG}
zip -r -D enigmail-${ENIGLANG}.jar locale
zip ../enigmail-${ENIGLANG}-${ENIGVERSION}.xpi install.js enigmail-${ENIGLANG}.spec enigmail-${ENIGLANG}.jar
cd ..

test $DEBUG -eq 0 && rm -rf ${ENIGLANG}
