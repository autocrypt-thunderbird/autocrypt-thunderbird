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

LANGHASH=`echo "${ENIGLANG}" | md5sum | awk '{ print substr($0,1,2)}'`
export LANGHASH

# create chrome.manifest for Thunderbird 3.1 and newer
cat > ${ENIGLANG}/chrome.manifest <<EOT
locale      enigmail    ${ENIGLANG}       jar:chrome/enigmail-${ENIGLANG}.jar!/locale/${ENIGLANG}/enigmail/
EOT

# create install.rdf for Thunderbird 1.0 and newer
cat > ${ENIGLANG}/install.rdf <<EOT
<?xml version="1.0"?>

<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
     xmlns:em="http://www.mozilla.org/2004/em-rdf#">

  <Description about="urn:mozilla:install-manifest">
    <em:id>enigmail-${ENIGLANG}@www.enigmail.net</em:id>
    <em:version>${ENIGVERSION}</em:version>

    <!-- Target Application (Thunderbird) this extension can install into,
        with minimum and maximum supported versions. -->
    <em:targetApplication>
      <Description>
        <em:id>{3550f703-e582-4d05-9a08-453d09bdfdc6}</em:id>
        <em:minVersion>3.1</em:minVersion>
        <em:maxVersion>3.1.*</em:maxVersion>
      </Description>
      <Description>
        <!-- Seamonkey -->
        <em:id>{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}</em:id>
        <em:minVersion>2.0</em:minVersion>
        <em:maxVersion>2.1.*</em:maxVersion>
      </Description>
    </em:targetApplication>

    <!-- Front End MetaData -->
    <em:name>Enigmail ${ENIGLANG}</em:name>
    <em:description>Enigmail ${ENIGLANG} language package</em:description>

    <!-- Author of the package, replace with your name if you like -->
    <em:creator>Enigmail Team</em:creator>

    <em:homepageURL>http://www.enigmail.net/langpack.html</em:homepageURL>

    <!-- Front End Integration Hooks (used by Extension Manager)-->
    <em:optionsURL>chrome://enigmail/content/pref-enigmail.xul</em:optionsURL>
    <em:aboutURL>chrome://enigmail/content/enigmailAbout.xul</em:aboutURL>
    <em:iconURL>chrome://enigmail/skin/enigmail-about.png</em:iconURL>

  </Description>
</RDF>
EOT

for f in enigmail.dtd enigmail.properties am-enigprefs.properties upgrade_080.html ; do
  cp ${f} ${LANGDIR}
done

if [ -d help ]; then
  cd help
fi
pwd

for f in compose.html editRcptRule.html initError.html messenger.html rulesEditor.html sendingPrefs ; do
  cp ${f} ${cwd}/${HELPDIR}
done

cd ${cwd}/${ENIGLANG}/chrome
zip -r -D enigmail-${ENIGLANG}.jar locale
cd ..
zip ../enigmail-${ENIGLANG}-${ENIGVERSION}.xpi install.rdf chrome.manifest chrome/enigmail-${ENIGLANG}.jar
cd ..

test $DEBUG -eq 0 && rm -rf ${ENIGLANG}
