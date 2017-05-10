# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


DEPTH		= ..

include $(DEPTH)/config/autoconf.mk

PREF_JS_EXPORTS = $(srcdir)/prefs/enigmail.js

COMPFILES = \
            enigmail.js \
            pgpmimeHandler.js \
            mimeEncrypt.js \
            prefs-service.js \
            msgCompFields.js

PREFFILES = prefs/enigmail.js

MODFILES = \
           addrbook.jsm \
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
           decryptPermanently.jsm \
           dialog.jsm \
           encryption.jsm \
           errorHandling.jsm \
           events.jsm \
           execution.jsm \
           funcs.jsm \
           files.jsm \
           filters.jsm \
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
           log.jsm \
           mime.jsm \
           mimeDecrypt.jsm \
           mimeVerify.jsm \
           os.jsm \
           passwordCheck.jsm \
           passwords.jsm \
           pEp.jsm \
           pEpAdapter.jsm \
           pEpDecrypt.jsm \
           pEpFilter.jsm \
           pEpListener.jsm \
           pEpMessage.jsm \
           pEpMessageHist.jsm \
           pipeConsole.jsm \
           prefs.jsm \
           promise.jsm \
           protocolHandler.jsm \
           rng.jsm \
           rules.jsm \
           send.jsm \
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
           windows.jsm \
           wksMimeHandler.jsm \
           zbase32.jsm

all: deploy

deploy: $(PREFFILES) $(COMPFILES) $(MODFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/components $(COMPFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/defaults/preferences $(PREFFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/modules $(MODFILES)


clean:
	$(DEPTH)/util/install -u $(DIST)/components $(COMPFILES)
	$(DEPTH)/util/install -u $(DIST)/defaults/preferences $(PREFFILES)
	$(DEPTH)/util/install -u $(DIST)/modules $(MODFILES)
