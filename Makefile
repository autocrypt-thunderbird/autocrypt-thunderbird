# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

XPI_MODULE	= enigmail
XPI_MODULE_VERS = 2.1

DEPTH		= .

include $(DEPTH)/config/autoconf.mk

DIRS = ipc ui package lang stdlib

ALL = dirs xpi

ifeq ($(TESTS),yes)
ALL += test
endif

XPIFILE = $(XPI_MODULE)-$(XPI_MODULE_VERS).xpi

.PHONY: dirs $(DIRS) test

all: $(ALL)

dirs: $(DIRS)

$(DIRS):
	$(MAKE) -C $@

xpi: $(DIRS)
	$(srcdir)/util/genxpi $(XPIFILE) $(XPI_MODULE_VERS) $(DIST) $(srcdir) $(XPI_MODULE) $(ENABLE_LANG)

check:
	util/checkFiles.py

eslint:
	static_analysis/eslint ipc
	static_analysis/eslint package
	static_analysis/eslint ui

unit:
	make -C ipc/tests
	make -C package/tests
	make -C ui/tests

test: eslint check unit

clean:
	rm -f build/$(XPIFILE) .eslintcache
	for dir in $(DIRS); do \
		if [ "$${dir}x" != "checkx" ]; then \
		$(MAKE) -C $$dir clean; fi; \
	done

distclean: clean
	rm -rf build/*
	rm -f config/autoconf.mk config.log config.status
