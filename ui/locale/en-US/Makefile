# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

DEPTH  = ../../..

include $(DEPTH)/config/autoconf.mk

LOCALEFILES = \
	enigmail.dtd \
	am-enigprefs.properties	\
	enigmail.properties

HELPFILES = \
	help/compose.html \
	help/help.html\
	help/messenger.html \
	help/sendingPrefs.html \
	help/editRcptRule.html \
	help/initError.html \
	help/rulesEditor.html
	
all: deploy

deploy: $(LOCALEFILES) $(HELPFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/locale/en-US $(LOCALEFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/locale/en-US/help $(HELPFILES)
