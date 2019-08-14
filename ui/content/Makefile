# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

DEPTH  = ../..

include $(DEPTH)/config/autoconf.mk

UIFILES = \
	autocryptInitiateBackup.xul \
	autocryptInitiateBackup.js \
	autocryptSetupPasswd.xul \
	autocryptSetupPasswd.js \
	autocryptSetup.xul \
	autocryptSetup.js \
	autocryptSettings.js \
	autocryptSettings.xul \
	columnOverlay.xul \
	columnOverlay.js \
	dialogDeleteKey.xul \
	dialogDeleteKey.js \
	dialogKeyPassword.xul \
	dialogKeyPassword.js \
	dialogMissingKeys.xul \
	dialogMissingKeys.js \
	dialogBackupCode.xul \
	dialogBackupCode.js \
	enigmailCommon.js \
	aboutEnigmail.html \
	aboutEnigmail.js \
	enigmailMsgBox.js \
	enigmailMsgBox.xul \
	enigmailCheckLanguage.xul \
	enigmailHelp.xul \
	enigmailHelp.js \
	enigmailMsgComposeOverlay.xul \
	enigmailMsgComposeOverlay-sm.xul \
	enigmailMsgComposeOverlay.js \
	enigmailMsgComposeHelper.js \
	messengerOverlay-tbird.xul \
	messengerOverlay-sm.xul \
	enigmailMessengerOverlay.xul \
	enigmailMessengerOverlay.js \
	enigmailMsgHdrViewOverlay.xul \
	enigmailMsgHdrViewOverlay.js \
	manageAllKeys.js \
	manageAllKeys.xul \
	setupWizardAutocrypt.js \
	setupWizardAutocrypt.xul
	
all: deploy

deploy: $(UIFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content/ui $(UIFILES)
