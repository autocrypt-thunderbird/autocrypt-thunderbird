# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


DEPTH		= ..

include $(DEPTH)/config/autoconf.mk

MODFILES = \
           compose.jsm \
           misc.jsm \
           msgHdrUtils.jsm \
           send.jsm

all: deploy

deploy: $(MODFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/modules/stdlib $(MODFILES)


clean:
	$(DEPTH)/util/install -u $(DIST)/modules/stdlib $(MODFILES)
