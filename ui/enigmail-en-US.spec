Name:      mozilla-enigmail-en-US
Version:   0.82.4
Release:   1
Requires:  mozilla-enigmail = 0.82.4
Summary:   Language pack for Enigmail (en-US)
Copyright: Mozilla Public License 1.1/GPL
Group:     Applications/Internet
Source:    http://enigmail.mozdev.org/source.html
URL:       http://enigmail.mozdev.org/
Vendor:    xmlterm.org
Packager:  R. Saravanan <svn@xmlterm.org>

%description

 mozilla-enigmail-en-US: Language pack for Enigmail (en-US)

%prep
cd $RPM_BUILD_DIR
rm -rf ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
mkdir ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
cd ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}

unzip ${RPM_SOURCE_DIR}/enigmail-en-US-${RPM_PACKAGE_VERSION}.xpi
if [ $? -ne 0 ]; then
  exit $?
fi

chown -R root.root .
chmod -R a+rX,g-w,o-w .

%build

%install
cd ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
install -m 755 enigmail-en-US.jar     /usr/lib/mozilla/chrome

%pre

%post

if [ -f /usr/lib/mozilla/chrome/installed-chrome.txt ]; then

  cat << EOF >> /usr/lib/mozilla/chrome/installed-chrome.txt
locale,install,url,jar:resource:/chrome/enigmail-en-US.jar!/locale/en-US/enigmail/
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

/usr/lib/mozilla/chrome/enigmail-en-US.jar

%changelog
