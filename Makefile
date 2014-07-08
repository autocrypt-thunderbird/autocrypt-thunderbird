# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

XPI_MODULE	= enigmail
XPI_MODULE_VERS = 1.7

DEPTH		= .

include $(DEPTH)/config/autoconf.mk

DIRS = ipc public

DIRS += ui package lang

PLATFORM_STR = unknown

# Edit the lines below as needed, depending upon your platform(s)
ifeq ($(OS_TARGET),Linux)
PLATFORM_STR = linux
endif

ifeq ($(OS_TARGET),WIN95)
PLATFORM_STR = win32
endif

ifeq ($(OS_TARGET),WINNT)
PLATFORM_STR = win32
endif

ifeq ($(OS_CONFIG),SunOS)
PLATFORM_STR = sunos5
endif

ifeq ($(OS_TARGET),Darwin)
PLATFORM_STR = darwin
endif

ifeq ($(OS_TARGET),FreeBSD)
PLATFORM_STR = freebsd
endif

ifeq ($(OS_TARGET),OpenBSD)
PLATFORM_STR = openbsd
endif

ifeq ($(OS_TARGET),OS2)
PLATFORM_STR = os2
endif

ifeq ($(OS_TARGET),OSF1)
PLATFORM_STR = osf1
endif

XPIFILE = $(XPI_MODULE)-$(XPI_MODULE_VERS)-$(PLATFORM_STR)-$(CPU_ARCH).xpi

.PHONY: dirs $(DIRS)

all: dirs xpi

dirs: $(DIRS)

$(DIRS):
	$(MAKE) -C $@

xpi:
	$(srcdir)/util/genxpi $(XPIFILE) $(XPI_MODULE_VERS) $(OS_TARGET) $(CPU_ARCH) $(DIST) $(srcdir) $(XPI_MODULE) $(DLL_SUFFIX) $(DLL_PREFIX)

check:
	util/checkFiles.py

clean:
	rm -f build/$(XPIFILE)
	for dir in $(DIRS); do \
	  $(MAKE) -C $$dir clean; \
	done

distclean: clean
	rm -rf build/*
	rm -f config/autoconf.mk config.log config.status
