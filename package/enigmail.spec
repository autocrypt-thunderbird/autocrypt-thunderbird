Name:      mozilla-enigmail
Version:   0.82.1
Release:   1
Requires:  mozilla = 1.0.1, mozilla-mail = 1.0.1, mozilla-enigmime = 0.82.1
Summary:   Enigmail: GPG/PGP integration in Mozilla
Copyright: Mozilla Public License 1.1/GPL
Group:     Applications/Internet
Source:    http://enigmail.mozdev.org/source.html
URL:       http://enigmail.mozdev.org/
Vendor:    xmlterm.org
Packager:  R. Saravanan <svn@xmlterm.org>

%description

 mozilla-enigmail: GPG/PGP integration in Mozilla

%prep
cd $RPM_BUILD_DIR
rm -rf ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
mkdir ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
cd ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}

unzip ${RPM_SOURCE_DIR}/enigmail-${RPM_PACKAGE_VERSION}.xpi
if [ $? -ne 0 ]; then
  exit $?
fi

chown -R root.root .
chmod -R a+rX,g-w,o-w .

%build

%install
cd ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
install -m 755 components/enigmail.xpt /usr/lib/mozilla-1.0.1/components
install -m 755 components/enigmail.js  /usr/lib/mozilla-1.0.1/components
install -m 755 chrome/enigmail.jar     /usr/lib/mozilla-1.0.1/chrome

%pre

%post

if [ -f /usr/lib/mozilla-1.0.1/chrome/installed-chrome.txt ]; then

  cat << EOF >> /usr/lib/mozilla-1.0.1/chrome/installed-chrome.txt
content,install,url,jar:resource:/chrome/enigmail.jar!/content/enigmail/
skin,install,url,jar:resource:/chrome/enigmail.jar!/skin/modern/enigmail/
skin,install,url,jar:resource:/chrome/enigmail.jar!/skin/classic/enigmail/
locale,install,url,jar:resource:/chrome/enigmail.jar!/locale/en-US/enigmail/
EOF

fi

if [ -f /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl ]; then
    /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl
fi

%postun

if [ -f /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl ]; then
    /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl
fi

%files

/usr/lib/mozilla-1.0.1/components/enigmail.xpt
/usr/lib/mozilla-1.0.1/components/enigmail.js
/usr/lib/mozilla-1.0.1/chrome/enigmail.jar

%changelog
