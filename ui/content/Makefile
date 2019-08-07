# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

DEPTH  = ../..

include $(DEPTH)/config/autoconf.mk

AM_FILES = am-enigprefs.xul

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
	commonWorkflows.js \
	dialogDeleteKey.xul \
	dialogDeleteKey.js \
	dialogKeyPassword.xul \
	dialogKeyPassword.js \
	dialogMissingKeys.xul \
	dialogMissingKeys.js \
	dialogBackupCode.xul \
	dialogBackupCode.js \
	enigmailCommon.js \
	enigmailAbContactsPanel.xul \
	enigmailAbOverlay.js \
	aboutEnigmail.html \
	aboutEnigmail.js \
	enigmailAddUidDlg.js \
	enigmailAddUidDlg.xul \
	enigmailMsgBox.js \
	enigmailMsgBox.xul \
	enigmailAttachmentsDialog.xul \
	enigmailAttachmentsDialog.js \
	enigmailAmIdEditOverlay.xul \
	enigmailCheckLanguage.xul \
	enigmailGenericDisplay.js \
	enigmailGenericDisplay.xul \
	enigmailGenericDisplay.htm \
	enigmailHelp.xul \
	enigmailHelp.js \
	am-enigprefs.xul \
	am-enigprefs.js \
	editSingleAccount.xul \
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
	enigmailWrapSelection.xul \
	enigmailWrapSelection.js \
	enigmailViewFile.js \
	enigmailViewFile.xul \
	enigRetrieveProgress.xul \
	enigRetrieveProgress.js \
	manageAllKeys.js \
	manageAllKeys.xul \
	upgradeInfo.html \
	setupWizardAutocrypt.js \
	setupWizardAutocrypt.xul
	
all: deploy

deploy: $(UIFILES) $(AM_FILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content/ui $(UIFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content $(AM_FILES)
