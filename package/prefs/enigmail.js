/*
   Default pref values for Enigmail
*/

// the last configured Enigmail version
pref("extensions.enigmail.configuredVersion","");

// additional parameter(s) to pass to GnuPG
pref("extensions.enigmail.agentAdditionalParam","--charset utf8");

// path to gpg executable
pref("extensions.enigmail.agentPath","");

// enable --always-trust for message sending
pref("extensions.enigmail.alwaysTrustSend",true);

// allow empty subject line without asking for confirmation
pref("extensions.enigmail.allowEmptySubject",false);

// not (yet) in use
pref("extensions.enigmail.autoCrypto",false);

// enable automatically decrypt/verify
pref("extensions.enigmail.autoDecrypt",true);


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

// Encrypt to self
pref("extensions.enigmail.encryptToSelf",true);

// warn if GnuPG <= v1.0.6 (countdown)
pref("extensions.enigmail.gpgVersionWarnCount",1);

// enable 'Decrypt & open' for double click on attachment (if possible)
pref("extensions.enigmail.handleDoubleClick",false);

// disable '<' and '>' around email addresses
pref("extensions.enigmail.hushMailSupport",false);

// countdown for 'failed to initialize enigmime'
pref("extensions.enigmail.initAlertCount",2);

// use -a for encrypting attachments for inline PGP
pref("extensions.enigmail.inlineAttachAsciiArmor",false);

// extension to append for encrypting attachments for inline PGP
pref("extensions.enigmail.inlineAttachExt",".pgp");

// debug log directory (if set, also enabled debugging)
pref("extensions.enigmail.logDirectory","");

// enable encrypten for replies to encrypted mails
pref("extensions.enigmail.keepSettingsForReply",true);

// list of keyservers to use
pref("extensions.enigmail.keyserver","random.sks.keyserver.penguin.de, pgp.dtype.org, keyserver.kjsl.com, ldap://certserver.pgp.com");

// keep passphrase for ... minutes
pref("extensions.enigmail.maxIdleMinutes",5);

// GnuPG hash algorithm (currently only 1 supported!)
pref("extensions.enigmail.mimeHashAlgorithm",1);

// no passphrase for GnuPG key needed
pref("extensions.enigmail.noPassphrase",false);

// parse all mime headers (do NOT change)
pref("extensions.enigmail.parseAllHeaders",true);

// enable per recipient rules (0=off / 2=ask for every unknown user)
pref("extensions.enigmail.perRecipientRules",1);

// show quoted printable warning message (and remember selected state)
pref("extensions.enigmail.quotedPrintableWarn",0);

// use http proxy settings as set in Mozilla/Thunderbird
pref("extensions.enigmail.respectHttpProxy",true);

// enable selection of keys for unkown recipients (0=off, 1=when necessary, 2=always)
pref("extensions.enigmail.recipientsSelectionOption",1);

// show "save draft encrypted" message (and remember selected state)
pref("extensions.enigmail.saveEncrypted",0);

// replacement of Mozilla's show all headers (because the original value is overriden)
pref("extensions.enigmail.show_headers",1);

// support different passwords for each key (not yet available)
pref("extensions.enigmail.supportMultiPass",false);

// use GnuPG's default comment for signed messages
pref("extensions.enigmail.useDefaultComment",false);

// use gpg passphrase agent for passphrase handling
pref("extensions.enigmail.useGpgAgent",false);

// use PGP/MIME (0=never, 1=allow, 2=always)
pref("extensions.enigmail.usePGPMimeOption",1);

// enable using gpgkeys_*
pref("extensions.enigmail.useGpgKeysTool",true);

// show "conflicting rules" message (and remember selected state)
pref("extensions.enigmail.warnOnRulesConflict",0);

// display a warning when the passphrase is cleared
pref("extensions.enigmail.warnClearPassphrase",true);

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


