# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

DEPTH		= ..

include $(DEPTH)/config/autoconf.mk

DIRS            = modules

.PHONY: dirs $(DIRS)

all: dirs

dirs: $(DIRS)

$(DIRS):
	$(MAKE) -C $@

clean:
	for dir in $(DIRS); do \
	  $(MAKE) -C $$dir clean; \
	done
	
