/* global pref: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Default pref values for Enigmail
 */

// the last configured Enigmail version
pref("extensions.enigmail.configuredVersion", "");

// Hide prefs and menu entries from non-advanced users
pref("extensions.enigmail.advancedUser", false);

// additional parameter(s) to pass to GnuPG
pref("extensions.enigmail.agentAdditionalParam", "");

// path to gpg executable
pref("extensions.enigmail.agentPath", "");

// allow empty subject line without asking for confirmation
pref("extensions.enigmail.allowEmptySubject", false);

// ** enigmail keySel preferences:
// use rules to assign keys
pref("extensions.enigmail.assignKeysByRules", true);
// use email addresses to assign keys
pref("extensions.enigmail.assignKeysByEmailAddr", true);
// use manual dialog to assign missing keys
pref("extensions.enigmail.assignKeysManuallyIfMissing", true);
// always srats manual dialog for keys
pref("extensions.enigmail.assignKeysManuallyAlways", false);

// automatically download missing keys from keyserver
pref("extensions.enigmail.autoKeyRetrieve", "");

// enable automatically decrypt/verify
pref("extensions.enigmail.autoDecrypt", true);

// enable X-Enigmail-xxx headers
pref("extensions.enigmail.addHeaders", false);

// countdown for alerts when composing inline PGP HTML msgs
pref("extensions.enigmail.composeHtmlAlertCount", 3);

// prefer S/MIME or PGP/MIME (0: PGP/MIME, 1: ask, 2: S/MIME)
pref("extensions.enigmail.mimePreferPgp", 1);

// show warning message when clicking on sign icon
pref("extensions.enigmail.displaySignWarn", true);

// display warning as info for partially signed message
pref("extensions.enigmail.displayPartiallySigned", true);

// try to match secondary uid to from address
pref("extensions.enigmail.displaySecondaryUid", true);

// treat '-- ' as signature separator
pref("extensions.enigmail.doubleDashSeparator", true);

// last state of dialog to choose encryption method if there are attachments
pref("extensions.enigmail.encryptAttachments", 1);

// skip the attachments dialog
pref("extensions.enigmail.encryptAttachmentsSkipDlg", 0);

// Encrypt to self
pref("extensions.enigmail.encryptToSelf", true);

// enable 'Decrypt & open' for double click on attachment (if possible)
pref("extensions.enigmail.handleDoubleClick", true);

// disable '<' and '>' around email addresses
pref("extensions.enigmail.hushMailSupport", false);

// display alert for 'failed to initialize enigmime'
pref("extensions.enigmail.initAlert", true);

// use -a for encrypting attachments for inline PGP
pref("extensions.enigmail.inlineAttachAsciiArmor", false);

// extension to append for inline-encrypted attachments
pref("extensions.enigmail.inlineAttachExt", ".pgp");

// extension to append for inline-signed attachments
pref("extensions.enigmail.inlineSigAttachExt", ".sig");

// debug log directory (if set, also enabled debugging)
pref("extensions.enigmail.logDirectory", "");

// display all or no keys by default in the key manager
pref("extensions.enigmail.keyManShowAllKeys", true);


// list of keyservers to use
pref("extensions.enigmail.keyserver", "pool.sks-keyservers.net, keys.gnupg.net, pgp.mit.edu");

// auto select the first keyserver in the key server list
pref("extensions.enigmail.autoKeyServerSelection", true);

// keep passphrase for ... minutes
pref("extensions.enigmail.maxIdleMinutes", 5);

// GnuPG hash algorithm
// 0: automatic seletion (i.e. let GnuPG choose)
// 1: SHA1, 2: RIPEMD160, 3: SHA256, 4: SHA384, 5: SHA512, 6: SHA224
pref("extensions.enigmail.mimeHashAlgorithm", 0);

// no passphrase for GnuPG key needed
pref("extensions.enigmail.noPassphrase", false);

// show quoted printable warning message (and remember selected state)
pref("extensions.enigmail.quotedPrintableWarn", 0);

// use http proxy settings as set in Mozilla/Thunderbird
pref("extensions.enigmail.respectHttpProxy", true);

// selection for which encryption model to prefer
// 0: convenient encryption settings DEFAULT
// 1: manual encryption settings
pref("extensions.enigmail.encryptionModel", 0);

// enable encryption for replies to encrypted mails
pref("extensions.enigmail.keepSettingsForReply", true);

// Warn if a key expires in less than N days.
// 0 will disable the check
pref("extensions.enigmail.warnKeyExpiryNumDays", 30);

// holds the last result of the dayily key expiry check
pref("extensions.enigmail.keyCheckResult", "");


// selection for which keys to accept
// 0: accept valid/authenticated keys
// 1: accept all keys (except disabled, ...) DEFAULT
pref("extensions.enigmail.acceptedKeys", 1);

// selection for automatic send encrypted if all keys valid
// 0: never
// 1: if all keys found and accepted DEFAULT
pref("extensions.enigmail.autoSendEncrypted", 1);

// ask to confirm before sending
// 0: never DEFAULT
// 1: always
// 2: if send encrypted
// 3: if send unencrypted
// 4: if send (un)encrypted due to rules
pref("extensions.enigmail.confirmBeforeSending", 0);

// use GnuPG's default instead of Enigmail/Mozilla comment of for signed messages
pref("extensions.enigmail.useDefaultComment", true);

// allow encryption to newsgroups
pref("extensions.enigmail.encryptToNews", false);
pref("extensions.enigmail.warnOnSendingNewsgroups", true);

// use gpg passphrase agent for passphrase handling
pref("extensions.enigmail.useGpgAgent", false);

// use PGP/MIME (0=never, 1=allow, 2=always)
// pref("extensions.enigmail.usePGPMimeOption",1); -- OBSOLETE, see mail.identity.default.pgpMimeMode

// enable using gpgkeys_*
pref("extensions.enigmail.useGpgKeysTool", true);

// show "conflicting rules" message (and remember selected state)
pref("extensions.enigmail.warnOnRulesConflict", 0);

// display a warning when the passphrase is cleared
pref("extensions.enigmail.warnClearPassphrase", true);

// display a warning if the GnuPG version is deprecated
pref("extensions.enigmail.warnDeprecatedGnuPG", true);

// warn if gpg-agent is found and "remember passphrase for X minutes is active"
pref("extensions.enigmail.warnGpgAgentAndIdleTime", true);

// display a warning when all keys are to be refreshed
pref("extensions.enigmail.warnRefreshAll", true);

// display a warning when the keys for all contacts are downloaded
pref("extensions.enigmail.warnDownloadContactKeys", true);

// wrap HTML messages before sending inline PGP messages
pref("extensions.enigmail.wrapHtmlBeforeSend", true);

// enable encryption/signing of headers like subject, from, to
pref("extensions.enigmail.protectHeaders", false);
pref("extensions.enigmail.protectedSubjectText", "");

// enable experimental features.
// WARNING: such features may unfinished functions or tests that can break
// existing functionality in Enigmail and Thunderbird!
pref("extensions.enigmail.enableExperiments", false);


/*
   Default pref values for the enigmail per-identity
   settings
*/

pref("mail.identity.default.enablePgp", false);
pref("mail.identity.default.pgpkeyId", "");
pref("mail.identity.default.pgpKeyMode", 0);
pref("mail.identity.default.pgpSignPlain", false);
pref("mail.identity.default.pgpSignEncrypted", false);
pref("mail.identity.default.defaultSigningPolicy", 0);
pref("mail.identity.default.defaultEncryptionPolicy", 0);
pref("mail.identity.default.openPgpHeaderMode", 0);
pref("mail.identity.default.openPgpUrlName", "");
pref("mail.identity.default.pgpMimeMode", true);
pref("mail.identity.default.attachPgpKey", false);
pref("mail.identity.default.autoEncryptDrafts", true);

/*
   Other settings (change Mozilla behaviour)
*/

// disable flowed text by default
pref("mailnews.send_plaintext_flowed", false);
