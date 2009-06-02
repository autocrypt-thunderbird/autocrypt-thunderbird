/*
   Default pref values for Enigmail
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

// not (yet) in use
pref("extensions.enigmail.autoCrypto",false);

// automatically download missing keys from keyserver
pref("extensions.enigmail.autoKeyRetrieve","");

// enable automatically decrypt/verify
pref("extensions.enigmail.autoDecrypt",true);

// enable X-Enigmail-xxx headers
pref("extensions.enigmail.addHeaders",true);

// countdown for alerts when composing inline PGP HTML msgs
pref("extensions.enigmail.composeHtmlAlertCount",3);

// enable confirm dialog before sending message
pref("extensions.enigmail.confirmBeforeSend",false);

// disable the S/MIME button
pref("extensions.enigmail.disableSMIMEui",false);

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

// warn if GnuPG <= v1.2.0 (countdown)
pref("extensions.enigmail.gpgVersionWarnCount",1);

// enable 'Decrypt & open' for double click on attachment (if possible)
pref("extensions.enigmail.handleDoubleClick",true);

// headers to be retrieved from the mail backend, but hidden from the users
pref("extensions.enigmail.hideHeaders", "x-enigmail-version openpgp content-transfer-encoding x-mimeole x-bugzilla-reason x-php-bug");

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

// enable encryption for replies to encrypted mails
pref("extensions.enigmail.keepSettingsForReply",true);

// display all or no keys by default in the key manager
pref("extensions.enigmail.keyManShowAllKeys",false);


// list of keyservers to use
pref("extensions.enigmail.keyserver","pool.sks-keyservers.net, subkeys.pgp.net, pgp.mit.edu, ldap://certserver.pgp.com");

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

// selection of keys for unkown recipients
// 1: rules only
// 2: rules & email addresses (normal)
// 3: email address only (no rules)
// 4: manually (always prompt, no rules)
// 5: no rules, no key selection
pref("extensions.enigmail.recipientsSelection",2);

// show "save draft encrypted" message (and remember selected state)
pref("extensions.enigmail.saveEncrypted",0);

// replacement of Mozilla's show all headers (because the original value is overriden)
// OBSOLETE
// pref("extensions.enigmail.show_headers",1);

// support different passwords for each key (not yet available)
pref("extensions.enigmail.supportMultiPass",false);

// use GnuPG's default comment for signed messages
pref("extensions.enigmail.useDefaultComment",false);

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

// display a warning if the broken character set ISO-2022-JP is used (and remember selected state)
pref("extensions.enigmail.warnIso2022jp", 0);

// wrap HTML messages before sending inline PGP messages
pref("extensions.enigmail.wrapHtmlBeforeSend",true);

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

/*
   Other settings (change Mozilla behaviour)
*/

// disable flowed text by default
pref("mailnews.send_plaintext_flowed", false);
