# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


DEPTH		= ../..

include $(DEPTH)/config/autoconf.mk

MODFILES = \
	gnupg.js \
	openpgp-js.js \
	interface.js	

all: deploy

deploy: $(MODFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content/modules/cryptoAPI $(MODFILES)


clean:
	$(DEPTH)/util/install -u $(DIST)/chrome/content/modules/cryptoAPI $(MODFILES)
