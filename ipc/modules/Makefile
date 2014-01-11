# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


DEPTH		= ../..

include $(DEPTH)/config/autoconf.mk


EXTRA_JS_MODULES =  \
                   subprocess.jsm \
                   subprocess_worker_win.js \
                   subprocess_worker_unix.js

all: $(EXTRA_JS_MODULES)
	$(DEPTH)/util/install -m 644 $(DIST)/modules $^

clean: $(EXTRA_JS_MODULES)
	$(DEPTH)/util/install -u $(DIST)/modules $^
