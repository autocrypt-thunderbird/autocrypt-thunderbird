Name:      mozilla-enigmime
Version:   0.81.4
Release:   1
Requires:  mozilla = 1.0.1, mozilla-mail = 1.0.1, mozilla-psm = 1.0.1
Summary:   MIME and Inter-Process Communication for Enigmail/Mozilla
Copyright: Mozilla Public License 1.1/GPL
Group:     Applications/Internet
Source:    http://enigmail.mozdev.org/source.html
URL:       http://enigmail.mozdev.org/
Vendor:    xmlterm.org
Packager:  R. Saravanan <svn@xmlterm.org>

%description

 mozilla-enigmime: MIME and Inter-Process Communication for Enigmail/Mozilla

%prep
cd $RPM_BUILD_DIR
rm -rf ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
mkdir ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
cd ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}

unzip ${RPM_SOURCE_DIR}/enigmime-${RPM_PACKAGE_VERSION}-linux.xpi
if [ $? -ne 0 ]; then
  exit $?
fi

chown -R root.root .
chmod -R a+rX,g-w,o-w .

%build

%install
cd ${RPM_PACKAGE_NAME}-${RPM_PACKAGE_VERSION}
install -m 755 components/ipc.xpt   /usr/lib/mozilla-1.0.1/components
install -m 755 components/enigmime.xpt   /usr/lib/mozilla-1.0.1/components
install -m 755 components/libenigmime.so /usr/lib/mozilla-1.0.1/components

%pre

%post

# run ldconfig before regxpcom
/sbin/ldconfig >/dev/null 2>/dev/null

if [ -f /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl ]; then
    /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl
fi

%postun

# run ldconfig before regxpcom
/sbin/ldconfig >/dev/null 2>/dev/null

if [ -f /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl ]; then
    /usr/lib/mozilla-1.0.1/mozilla-rebuild-databases.pl
fi

%files

/usr/lib/mozilla-1.0.1/components/ipc.xpt
/usr/lib/mozilla-1.0.1/components/libenigmime.so
/usr/lib/mozilla-1.0.1/components/enigmime.xpt

%changelog
