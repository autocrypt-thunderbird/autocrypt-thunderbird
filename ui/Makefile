# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# makefile for ui directory

DEPTH = ..

include ../config/autoconf.mk

DIRS = content

.PHONY: dirs $(DIRS)

all: dirs jar

dirs: $(DIRS)

$(DIRS):
	$(MAKE) -C $@

MYJARFILE = enigmail.jar


jar: dirs
	$(PYTHON) ../util/JarMaker.py -j $(DIST)/chrome -t . -f jar jar.mn

clean:
	rm -f $(DIST)/chrome/enigmail.jar
