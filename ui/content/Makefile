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
	autocryptSettings.js \
	autocryptSettings.xul \
	columnOverlay.xul \
	columnOverlay.js \
	commonWorkflows.js \
	enigmailCommon.js \
	enigmailAbCardViewOverlay.xul \
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
	enigmailCardDetails.js \
	enigmailCardDetails.xul \
	enigmailConsole.xul \
	enigmailConsole.js \
	enigmailConsole.htm \
	enigmailCustToolOverlay.xul \
	enigmailDispPhoto.js \
	enigmailDispPhoto.xul \
	enigmailEditIdentity.js \
	enigmailEditIdentity.xul \
	enigmailEditKeyExpiryDlg.js \
	enigmailEditKeyExpiryDlg.xul \
	enigmailEditKeyTrustDlg.js \
	enigmailEditKeyTrustDlg.xul \
	enigmailEncryptionDlg.xul \
	enigmailEncryptionDlg.js \
	enigmailGenCardKey.js \
	enigmailGenCardKey.xul \
	enigmailGenericDisplay.js \
	enigmailGenericDisplay.xul \
	enigmailGenericDisplay.htm \
	enigmailHelp.xul \
	enigmailHelp.js \
	enigmailImportPhoto.js \
	enigmailImportPhoto.xul \
	keyDetailsDlg.js \
	keyDetailsDlg.xul \
	enigmailManageUidDlg.js \
	enigmailManageUidDlg.xul \
	enigmailRulesEditor.xul \
	enigmailRulesEditor.js \
	enigmailSearchKey.js \
	enigmailSearchKey.xul \
	enigmailKeyImportInfo.js \
	enigmailKeyImportInfo.xul \
	enigmailSingleRcptSettings.js \
	enigmailSingleRcptSettings.xul \
	enigmailSelectRule.js \
	enigmailSelectRule.xul \
	enigmailSetCardPin.js \
	enigmailSetCardPin.xul \
	enigmailSignKeyDlg.js \
	enigmailSignKeyDlg.xul \
	pref-enigmail.xul \
	pref-enigmail.js \
	am-enigprefs.xul \
	am-enigprefs.js \
	editSingleAccount.xul \
	enigmailKeygen.xul \
	enigmailKeygen.js \
	enigmailKeygenConsole.htm \
	enigmailKeyserverDlg.xul \
	enigmailKeyserverDlg.js \
	enigmailKeySelection.xul \
	enigmailKeySelection.js \
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
	enigmailFilterEditorOverlay.xul \
	enigmailFilterEditorOverlay.js \
	enigmailWrapSelection.xul \
	enigmailWrapSelection.js \
	enigmailViewFile.js \
	enigmailViewFile.xul \
	enigRetrieveProgress.xul \
	enigRetrieveProgress.js \
	exportSettingsWizard.js \
	exportSettingsWizard.xul \
	importSettings.js \
	importSettings.xul \
	upgradeInfo.html \
	updateGnuPG.html \
	updateGnuPG.js \
	setupWizardAutocrypt.js \
	setupWizardAutocrypt.xul
	
all: deploy

deploy: $(UIFILES) $(AM_FILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content/ui $(UIFILES)
	$(DEPTH)/util/install -m 644 $(DIST)/chrome/content $(AM_FILES)
