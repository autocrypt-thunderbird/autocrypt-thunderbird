#!/bin/sh

# make-lang.sh v1.0.10
# this script is used to create a language-specifi XPI for Enigmail

# if you want to debug this script, set DEBUG to something >0
DEBUG=0

if [ $# -ne 2 ]; then
  echo "Usage: $0 xx-YY version"
  echo "       where: xx-YY   is the language and country code representing the"
  echo "                      translated language"
  echo "              version is the Enigmail version, e.g. 0.84.1"
  exit 1
fi

ENIGLANG=$1
export ENIGLANG

ENIGVERSION=$2
export ENIGVERSION

LANGDIR=${ENIGLANG}/chrome/locale/${ENIGLANG}/enigmail
HELPDIR=${LANGDIR}/help
cwd=`pwd`
rm -rf ${LANGDIR} >/dev/null 2>&1
mkdir -p ${LANGDIR} 
mkdir -p ${HELPDIR}

LANGHASH=`echo "${ENIGLANG}" | md5sum | awk '{ print substr($0,0,2)}'`
export LANGHASH

# create install.js
cat > ${ENIGLANG}/install.js <<EOT
// Install script for Enigmail ${ENIGLANG} language pack

var err;
const APP_VERSION="${ENIGVERSION}";

err = initInstall("Enigmail ${ENIGLANG} Language pack",  // name for install UI
                  "/enigmail-${ENIGLANG}",   // registered name
                  APP_VERSION+".0");         // package version

logComment("initInstall: " + err);

var srDest = 15;       // Disk space required for installation (KB)

var fProgram    = getFolder("Program");
logComment("fProgram: " + fProgram);

if (!verifyDiskSpace(fProgram, srDest)) {
  cancelInstall(INSUFFICIENT_DISK_SPACE);

} else {

  var fChrome     = getFolder("Chrome");

  // addDirectory: blank, archive_dir, install_dir, install_subdir
  addDirectory("", "chrome",        fChrome,     "");

  err = getLastError();
  if (err == ACCESS_DENIED) {
    alert("Unable to write to components directory "+fChrome+".\n You will need to restart the browser with administrator/root privileges to install this software. After installing as root (or administrator), you will need to restart the browser one more time, as a privileged user, to register the installed software.\n After the second restart, you can go back to running the browser without privileges!");

    cancelInstall(ACCESS_DENIED);

  } else if (err != SUCCESS) {
    cancelInstall(err);

  } else {
    // Register chrome

    registerChrome( LOCALE | DELAYED_CHROME, getFolder("Chrome","enigmail-${ENIGLANG}.jar"), "locale/${ENIGLANG}/enigmail/");

    err = getLastError();

    if (err != SUCCESS) {
      cancelInstall(err);

    } else {
      performInstall();
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
EOT

# create install.rdf for Thunderbird 0.7 and newer
cat > ${ENIGLANG}/install.rdf <<EOT
<?xml version="1.0"?>

<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
     xmlns:em="http://www.mozilla.org/2004/em-rdf#">

  <Description about="urn:mozilla:install-manifest">
    <em:id>{847b3a00-7b${LANGHASH}-11d4-8f02-006008948af5}</em:id>
    <em:version>${ENIGVERSION}</em:version>
    
    <!-- Target Application (Thunderbird) this extension can install into, 
        with minimum and maximum supported versions. --> 
    <em:targetApplication>
      <Description>
        <em:id>{3550f703-e582-4d05-9a08-453d09bdfdc6}</em:id>
        <em:minVersion>0.7</em:minVersion>
        <em:maxVersion>1.2</em:maxVersion>
      </Description>
    </em:targetApplication>
    
    <!-- Front End MetaData -->
    <em:name>Enigmail ${ENIGLANG}</em:name>
    <em:description>Enigmail ${ENIGLANG} language package</em:description>
    
    <!-- Author of the package, replace with your name if you like -->
    <em:creator>Enigmail Team</em:creator>
    
    <em:homepageURL>http://enigmail.mozdev.org/langpack.html</em:homepageURL>

    <!-- Front End Integration Hooks (used by Extension Manager)-->
    <em:optionsURL>chrome://enigmail/content/pref-enigmail.xul</em:optionsURL>
    <em:aboutURL>chrome://enigmail/content/enigmailAbout.xul</em:aboutURL>
    <em:iconURL>chrome://enigmail/skin/enigmail-about.png</em:iconURL>
    
    <!-- Packages, Skins and Locales that this extension registers -->
    <em:file>
      <Description about="urn:mozilla:extension:file:enigmail-${ENIGLANG}.jar">
        <em:locale>locale/${ENIGLANG}/enigmail/</em:locale>
      </Description>
    </em:file>
  </Description>      
</RDF>
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
  <RDF:Description about="urn:mozilla:locale:${ENIGLANG}"  chrome:name="${ENIGLANG}">

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

if [ -d help ]; then
  cd help
fi
pwd

for f in compose.html messenger.html rulesEditor.html editRcptRule.html ; do
  cp ${f} ${cwd}/${HELPDIR} 
done

cd ${cwd}/${ENIGLANG}/chrome
zip -r -D enigmail-${ENIGLANG}.jar locale
cd ..
zip ../enigmail-${ENIGLANG}-${ENIGVERSION}.xpi install.js install.rdf enigmail-${ENIGLANG}.spec chrome/enigmail-${ENIGLANG}.jar
cd ..

test $DEBUG -eq 0 && rm -rf ${ENIGLANG}
