/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@enigmail.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

/**
 * Default pref values for Enigmail
 */

// the last configured Enigmail version
pref("extensions.enigmail.configuredVersion","");

// Hide prefs and menu entries from non-advanced users
pref("extensions.enigmail.advancedUser",false);

// additional parameter(s) to pass to GnuPG
pref("extensions.enigmail.agentAdditionalParam","");

// path to gpg executable
pref("extensions.enigmail.agentPath","");

// enable --always-trust for message sending
pref("extensions.enigmail.alwaysTrustSend",true);

// allow empty subject line without asking for confirmation
pref("extensions.enigmail.allowEmptySubject",false);

// automatically download missing keys from keyserver
pref("extensions.enigmail.autoKeyRetrieve","");

// enable automatically decrypt/verify
pref("extensions.enigmail.autoDecrypt",true);

// enable X-Enigmail-xxx headers
pref("extensions.enigmail.addHeaders",false);

// countdown for alerts when composing inline PGP HTML msgs
pref("extensions.enigmail.composeHtmlAlertCount",3);

// enable confirm dialog before sending message
pref("extensions.enigmail.confirmBeforeSend",false);

// prefer S/MIME or PGP/MIME (0: PGP/MIME, 1: ask, 2: S/MIME)
pref("extensions.enigmail.mimePreferPgp",1);

// show warning message when clicking on sign icon
pref("extensions.enigmail.displaySignWarn",true);

// display warning as info for partially signed message
pref("extensions.enigmail.displayPartiallySigned",true);

// try to match secondary uid to from address
pref("extensions.enigmail.displaySecondaryUid",true);

// treat '-- ' as signature separator
pref("extensions.enigmail.doubleDashSeparator",true);

// last state of dialog to choose encryption method if there are attachments
pref("extensions.enigmail.encryptAttachments",1);

// skip the attachments dialog
pref("extensions.enigmail.encryptAttachmentsSkipDlg", 0);

// Encrypt to self
pref("extensions.enigmail.encryptToSelf",true);

// enable 'Decrypt & open' for double click on attachment (if possible)
pref("extensions.enigmail.handleDoubleClick",true);

// disable '<' and '>' around email addresses
pref("extensions.enigmail.hushMailSupport",false);

// display alert for 'failed to initialize enigmime'
pref("extensions.enigmail.initAlert",true);

// use -a for encrypting attachments for inline PGP
pref("extensions.enigmail.inlineAttachAsciiArmor",false);

// extension to append for inline-encrypted attachments
pref("extensions.enigmail.inlineAttachExt",".pgp");

// extension to append for inline-signed attachments
pref("extensions.enigmail.inlineSigAttachExt",".sig");

// debug log directory (if set, also enabled debugging)
pref("extensions.enigmail.logDirectory","");

// display all or no keys by default in the key manager
pref("extensions.enigmail.keyManShowAllKeys",true);


// list of keyservers to use
pref("extensions.enigmail.keyserver","pool.sks-keyservers.net, keys.gnupg.net, pgp.mit.edu");

// keep passphrase for ... minutes
pref("extensions.enigmail.maxIdleMinutes",5);

// GnuPG hash algorithm
// 0: automatic seletion (i.e. let GnuPG choose)
// 1: SHA1, 2: RIPEMD160, 3: SHA256, 4: SHA384, 5: SHA512, 6: SHA224
pref("extensions.enigmail.mimeHashAlgorithm",0);

// no passphrase for GnuPG key needed
pref("extensions.enigmail.noPassphrase",false);

// parse all mime headers (do NOT change)
pref("extensions.enigmail.parseAllHeaders",true);

// show quoted printable warning message (and remember selected state)
pref("extensions.enigmail.quotedPrintableWarn",0);

// use http proxy settings as set in Mozilla/Thunderbird
pref("extensions.enigmail.respectHttpProxy",true);

// selection for which encryption model to prefer
// 0: convenient encryption settings DEFAULT
// 1: manual encryption settings
pref("extensions.enigmail.encryptionModel",0);

// enable encryption for replies to encrypted mails
pref("extensions.enigmail.keepSettingsForReply",true);

// selection for which keys to accept
// 0: accept valid/authenticated keys
// 1: accept all keys (except disabled, ...) DEFAULT
pref("extensions.enigmail.acceptedKeys",1);

// selection for automatic send encrypted if all keys valid
// 0: never
// 1: if all keys found and accepted DEFAULT
pref("extensions.enigmail.autoSendEncrypted",1);

// ask to confirm before sending
// 0: never DEFAULT
// 1: always
// 2: if send encrypted
// 3: if send unencrypted
// 4: if send (un)encrypted due to rules
pref("extensions.enigmail.confirmBeforeSending",0);

// selection of keys for unkown recipients
// 1: rules only
// 2: rules & email addresses (normal)
// 3: email address only (no rules)
// 4: manually (always prompt, no rules)
// 5: no rules, no key selection
pref("extensions.enigmail.recipientsSelection",2);

// support different passwords for each key (not yet available)
pref("extensions.enigmail.supportMultiPass",false);

// use GnuPG's default instead of Enigmail/Mozilla comment of for signed messages
pref("extensions.enigmail.useDefaultComment",true);

// allow encryption to newsgroups
pref("extensions.enigmail.encryptToNews", false);
pref("extensions.enigmail.warnOnSendingNewsgroups",true);

// use gpg passphrase agent for passphrase handling
pref("extensions.enigmail.useGpgAgent",false);

// use PGP/MIME (0=never, 1=allow, 2=always)
// pref("extensions.enigmail.usePGPMimeOption",1); -- OBSOLETE, see mail.identity.default.pgpMimeMode

// enable using gpgkeys_*
pref("extensions.enigmail.useGpgKeysTool",true);

// show "conflicting rules" message (and remember selected state)
pref("extensions.enigmail.warnOnRulesConflict",0);

// display a warning when the passphrase is cleared
pref("extensions.enigmail.warnClearPassphrase",true);

// warn if gpg-agent is found and "remember passphrase for X minutes is active"
pref("extensions.enigmail.warnGpgAgentAndIdleTime",true);

// display a warning when all keys are to be refreshed
pref("extensions.enigmail.warnRefreshAll",true);

// display a warning when the keys for all contacts are downloaded
pref("extensions.enigmail.warnDownloadContactKeys",true);

// display a warning if the broken character set ISO-2022-JP is used (and remember selected state)
pref("extensions.enigmail.warnIso2022jp", 0);

// wrap HTML messages before sending inline PGP messages
pref("extensions.enigmail.wrapHtmlBeforeSend",true);

// enable experimental features.
// WARNING: such features may unfinished functions or tests that can break
// existing functionality in Enigmail and Thunderbird!
pref("extensions.enigmail.enableExperiments",false);


/*
   Default pref values for the enigmail per-identity
   settings
*/

pref("mail.identity.default.enablePgp",false);
pref("mail.identity.default.pgpkeyId",  "");
pref("mail.identity.default.pgpKeyMode", 0);
pref("mail.identity.default.pgpSignPlain", false);
pref("mail.identity.default.pgpSignEncrypted", false);
pref("mail.identity.default.defaultEncryptionPolicy", 0);
pref("mail.identity.default.openPgpHeaderMode", 0);
pref("mail.identity.default.openPgpUrlName", "");
pref("mail.identity.default.pgpMimeMode", false);
pref("mail.identity.default.attachPgpKey", false);
pref("mail.identity.default.autoEncryptDrafts", true);

/*
   Other settings (change Mozilla behaviour)
*/

// disable flowed text by default
pref("mailnews.send_plaintext_flowed", false);
