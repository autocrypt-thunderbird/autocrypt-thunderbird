# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


DEPTH		= ..

include $(DEPTH)/config/autoconf.mk

PREFFILES = prefs/defaultPrefs.js

MODFILES = \
           addrbook.jsm \
           amPrefsService.jsm \
           app.jsm \
           armor.jsm \
           attachment.jsm \
           autocrypt.jsm \
           card.jsm \
           clipboard.jsm \
           commandLine.jsm \
           configBackup.jsm \
           configure.jsm \
           constants.jsm \
           core.jsm \
           data.jsm \
           decryption.jsm \
           persistentCrypto.jsm \
           dialog.jsm \
           encryption.jsm \
           errorHandling.jsm \
           events.jsm \
           execution.jsm \
           funcs.jsm \
           files.jsm \
           filters.jsm \
           filtersWrapper.jsm \
           fixExchangeMsg.jsm \
           gpgAgent.jsm \
           glodaMime.jsm \
           glodaUtils.jsm \
           gpg.jsm \
           hash.jsm \
           httpProxy.jsm \
           installGnuPG.jsm \
           installPep.jsm \
           key.jsm \
           keyEditor.jsm \
           keyRing.jsm \
           keyUsability.jsm \
           keyRefreshService.jsm \
           keyserver.jsm \
           keyserverUris.jsm \
           lazy.jsm \
           locale.jsm \
           localizeHtml.jsm \
           log.jsm \
           mime.jsm \
           mimeDecrypt.jsm \
           mimeEncrypt.jsm \
           mimeVerify.jsm \
           msgCompFields.jsm \
           msgRead.jsm \
           os.jsm \
           openpgp.jsm \
           overlays.jsm \
           passwordCheck.jsm \
           passwords.jsm \
           pEp.jsm \
           pEpAdapter.jsm \
           pEpDecrypt.jsm \
           pEpFilter.jsm \
           pEpListener.jsm \
           pEpKeySync.jsm \
           pgpmimeHandler.jsm \
           pipeConsole.jsm \
           prefs.jsm \
           protocolHandler.jsm \
           rng.jsm \
           rules.jsm \
           send.jsm \
           singletons.jsm \
           socks5Proxy.jsm \
           stdlib.jsm \
           streams.jsm \
           system.jsm \
           time.jsm \
           timer.jsm \
           tor.jsm \
           trust.jsm \
           uris.jsm \
           verify.jsm \
           versioning.jsm \
           webKey.jsm \
           wkdLookup.jsm \
           windows.jsm \
           wksMimeHandler.jsm \
           zbase32.jsm

DATE_FMT = +%Y%m%d-%H%M
SOURCE_DATE_EPOCH ?= $(shell date +%s)

# first try GNU /bin/date syntax; if that doesn't work, try BSD
# /bin/date syntax.  If that still fails, ignore SOURCE_DATE_EPOCH
ENIG_BUILD_DATE=$(shell TZ=UTC date $(DATE_FMT) -d "@$(SOURCE_DATE_EPOCH)" 2>/dev/null || \
                        TZ=UTC date -r "$(SOURCE_DATE_EPOCH)" $(DATE_FMT) || \
                        TZ=UTC date $(DATE_FMT) )

all: deploy

deploy: $(PREFFILES) $(MODFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/modules/preferences $(PREFFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/modules $(MODFILES)
	echo '"use strict";' > $(DIST)/modules/buildDate.jsm
	echo 'var EXPORTED_SYMBOLS = ["EnigmailBuildDate"];' >> $(DIST)/modules/buildDate.jsm
	echo 'const EnigmailBuildDate = "$(ENIG_BUILD_DATE)";' >> $(DIST)/modules/buildDate.jsm


clean:
	$(DEPTH)/util/install -u $(DIST)/modules/preferences $(PREFFILES)
	$(DEPTH)/util/install -u $(DIST)/modules $(MODFILES)

