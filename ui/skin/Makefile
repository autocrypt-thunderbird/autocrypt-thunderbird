# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

DEPTH  = ../..

include $(DEPTH)/config/autoconf.mk

UIFILES = \
	images/logo.svg

SKIN_TB_LINUX = \
	tb-linux/enigmail.css \
	common/enigmail-common.css \
	common/enigmail-html.css \
	images/headerProtected-18.svg \
	images/headerUnprotected-18.svg \
	images/status-lock-14.svg \
	images/status-lock-18.svg \
	images/status-lock-bw-14.svg \
	images/status-lock-bw-16.svg \
	images/status-lock-darkgrey-16.svg \
	images/status-lock-disabled-18.svg \
	images/status-lock-error-18.svg \
	images/status-lock-unknown-18.svg \
	images/autocrypt-18.svg \
	images/autocrypt-bw-18.svg \
	images/autocrypt-bw-14.svg \
	images/autocrypt-inactive-18.svg \
	images/autocrypt-disabled-18.svg

	
all: deploy

deploy: $(UIFILES) $(SKIN_TB_LINUX)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content/ui $(UIFILES)
	# $(DEPTH)/util/install -m 644 $(DIST)/chrome/skin/tb-win-xp $(SKIN_TB_WIN_XP)
	# $(DEPTH)/util/install -m 644 $(DIST)/chrome/skin/aero $(SKIN_AERO)
	# $(DEPTH)/util/install -m 644 $(DIST)/chrome/skin/tb-mac $(SKIN_TB_MAC)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/skin/tb-linux $(SKIN_TB_LINUX)
	# $(DEPTH)/util/install -m 644 $(DIST)/chrome/skin/classic-seamonkey $(SKIN_CLASSIC_SEAMONKEY)
	# $(DEPTH)/util/install -m 644 $(DIST)/chrome/skin/modern $(SKIN_MODERN)
