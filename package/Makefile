# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


DEPTH		= ..

include $(DEPTH)/config/autoconf.mk

TST = 

ifeq ($(TESTS),yes)
  TST = tst
endif

PREF_JS_EXPORTS = $(srcdir)/prefs/enigmail.js

COMPFILES = \
            enigmail.js \
            mimeDecrypt.js \
            mimeEncrypt.js \
            enigprefs-service.js \
            enigMsgCompFields.js

PREFFILES = prefs/enigmail.js

MODFILES = \
           commonFuncs.jsm \
           gpgAgentHandler.jsm \
           keyManagement.jsm \
           pipeConsole.jsm \
           enigmailCommon.jsm \
           enigmailConvert.jsm \
           installGnuPG.jsm \
           mimeVerify.jsm

all: deploy $(TST)

tst:
	$(MAKE) -C tests

deploy: $(PREFFILES) $(COMPFILES) $(MODFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/components $(COMPFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/defaults/preferences $(PREFFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/modules $(MODFILES)


clean:
	$(DEPTH)/util/install -u $(DIST)/components $(COMPFILES)
	$(DEPTH)/util/install -u $(DIST)/defaults/preferences $(PREFFILES)
	$(DEPTH)/util/install -u $(DIST)/modules $(MODFILES)
