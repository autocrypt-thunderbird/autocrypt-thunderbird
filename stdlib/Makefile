# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.


DEPTH		= ..

include $(DEPTH)/config/autoconf.mk

MODFILES = \
           compose.jsm \
           misc.jsm \
           msgHdrUtils.jsm \
           openpgp-lib.jsm \
           openpgp.worker.js \
           web-streams.jsm

all: deploy

createlib: openpgp-lib-head.js openpgp-lib.js openpgp-lib-tail.js
	cat openpgp-lib-head.js openpgp-lib.js openpgp-lib-tail.js > openpgp-lib.jsm

deploy: createlib $(MODFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content/modules/stdlib $(MODFILES)


clean:
	$(DEPTH)/util/install -u $(DIST)/chrome/content/modules/stdlib $(MODFILES)
