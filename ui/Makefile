# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

# makefile for ui directory

DEPTH = ..

include ../config/autoconf.mk

DIRS = content skin locale/en-US

.PHONY: dirs $(DIRS)

all: dirs

dirs: $(DIRS)

$(DIRS):
	$(MAKE) -C $@

clean:
	rm -fr $(DIST)/chrome
