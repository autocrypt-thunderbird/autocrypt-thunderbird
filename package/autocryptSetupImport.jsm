"use strict";

var EXPORTED_SYMBOLS = ["AutocryptSetupImport"];

const AutocryptArmor = ChromeUtils.import("chrome://autocrypt/content/modules/armor.jsm").AutocryptArmor;
const AutocryptCryptoAPI = ChromeUtils.import("chrome://autocrypt/content/modules/cryptoAPI.jsm").AutocryptCryptoAPI;
const AutocryptDialog = ChromeUtils.import("chrome://autocrypt/content/modules/dialog.jsm").AutocryptDialog;
const AutocryptFuncs = ChromeUtils.import("chrome://autocrypt/content/modules/funcs.jsm").AutocryptFuncs;
const AutocryptKeyRing = ChromeUtils.import("chrome://autocrypt/content/modules/keyRing.jsm").AutocryptKeyRing;
const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptStreams = ChromeUtils.import("chrome://autocrypt/content/modules/streams.jsm").AutocryptStreams;

var AutocryptSetupImport = {
  importSetupMessage: async function(win, url) {
    const content = await AutocryptStreams.getDataFromUrl(url);
    return this.importContent(win, content);
  },

  importContent: async function(win, content) {
    let armored_blocks = AutocryptArmor.locateArmoredBlocks(content);
    let importOk = false;
    for (let armored_block of armored_blocks) {
      let data = content.substring(armored_block.begin, armored_block.end);
      if (await this.importArmoredBlock(win, data, armored_block.blocktype)) {
        importOk = true;
      }
    }
    return importOk;
  },

  importArmoredBlock: async function(win, armoredBlock, blocktype) {
    AutocryptLog.DEBUG(`importArmoredBlock(): input type: ${blocktype}\n`);

    switch (blocktype) {
      case 'MESSAGE': {
        return await this.decryptEncryptedBlock(win, armoredBlock);
      }
      case 'PRIVATE KEY BLOCK': {
        return await this.importTransferableSecretKey(win, armoredBlock);
      }
      default: {
        AutocryptLog.DEBUG(`importArmoredBlock(): ignoring block of type ${blocktype}\n`);
      }
    }
    return false;
  },

  decryptEncryptedBlock: async function(win, armoredBlock) {
    let armorHdr = AutocryptArmor.getArmorHeaders(armoredBlock);
    let passphraseFormat = "generic";
    if ("passphrase-format" in armorHdr) {
      passphraseFormat = armorHdr["passphrase-format"];
    }
    let passphraseHint = "";
    if ("passphrase-begin" in armorHdr) {
      passphraseHint = armorHdr["passphrase-begin"];
    }

    const decryptResult = {
      data: null
    };

    const cApi = AutocryptCryptoAPI();
    const attempt = async password => {
      try {
        decryptResult.data = await cApi.decryptSymmetric(armoredBlock, password);
        return true;
      } catch (ex) {
        AutocryptLog.DEBUG(`decryptEncryptedBlock(): decryption failure: ${ex}\n`);
        return false;
      }
    };
    const args = {
      format: passphraseFormat,
      hint: passphraseHint,
      attempt: attempt
    };

    win.openDialog("chrome://autocrypt/content/ui/dialogBackupCode.xul", "",
      "chrome,dialog,modal,centerscreen", args);

    if (decryptResult.data) {
      await this.importContent(win, decryptResult.data);
    }

    return true;
  },

  importTransferableSecretKey: async function(win, armoredBlock) {
    AutocryptLog.DEBUG(`importTransferableSecretKey()\n`);
    const cApi = AutocryptCryptoAPI();
    try {
      let openpgp_secret_keys = await cApi.parseOpenPgpKeys(armoredBlock);
      for (let openpgp_secret_key of openpgp_secret_keys) {
        await this.importOpenPgpSecretKey(win, openpgp_secret_key);
      }
      return true;
    } catch (ex) {
      AutocryptLog.DEBUG(`importTransferableSecretKey(): ${ex}\n`);
      AutocryptDialog.alert(win, "Error parsing key format!");
      return true;
    }
  },

  importOpenPgpSecretKey: async function(win, openpgp_secret_key) {
    let dialog_shown = false;
    if (!openpgp_secret_key.isDecrypted()) {
      AutocryptLog.DEBUG(`onClickImport(): key is encrypted - asking for password\n`);
      let attempt = async password => {
        try {
          await openpgp_secret_key.decrypt(password);
          return true;
        } catch (ex) {
          AutocryptLog.DEBUG(`onClickImport(): decryption failure: ${ex}\n`);
          return false;
        }
      };
      let uids = openpgp_secret_key.getUserIds();
      let args = {
        uid: uids && uids.length ? uids[0] : null,
        attempt: attempt
      };

      win.openDialog("chrome://autocrypt/content/ui/dialogKeyPassword.xul", "",
        "chrome,dialog,modal,centerscreen", args);
      dialog_shown = true;
    }

    if (openpgp_secret_key.isDecrypted()) {
      await AutocryptKeyRing.insertSecretKey(openpgp_secret_key);

      let fpr = openpgp_secret_key.getFingerprint().toUpperCase();
      let fpr_string = AutocryptFuncs.formatFpr(fpr);
      AutocryptDialog.info(win, "Key import ok");

      return true;
    }

    return dialog_shown;
  }
};
