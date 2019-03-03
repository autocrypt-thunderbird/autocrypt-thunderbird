/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailGnuPGUpdate"];

const EnigmailPrefs = ChromeUtils.import("chrome://enigmail/content/modules/prefs.jsm").EnigmailPrefs;
const InstallGnuPG = ChromeUtils.import("chrome://enigmail/content/modules/installGnuPG.jsm").InstallGnuPG;
const EnigmailOS = ChromeUtils.import("chrome://enigmail/content/modules/os.jsm").EnigmailOS;
const EnigmailGpg = ChromeUtils.import("chrome://enigmail/content/modules/gpg.jsm").EnigmailGpg;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailVersioning = ChromeUtils.import("chrome://enigmail/content/modules/versioning.jsm").EnigmailVersioning;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const EnigmailDialog = ChromeUtils.import("chrome://enigmail/content/modules/dialog.jsm").EnigmailDialog;

var EnigmailGnuPGUpdate = {
  isUpdateAvailable: async function() {
    EnigmailLog.DEBUG(`gnupgUpdate.jsm: isUpdateAvailable()\n`);

    if (!this.isGnuPGUpdatable()) return false;

    let now = Math.floor(Date.now() / 1000);
    let lastCheck = Number(EnigmailPrefs.getPref("gpgLastUpdate"));
    if (now > lastCheck) {
      EnigmailPrefs.setPref("gpgLastUpdate", String(now));
    }

    let newVer = await InstallGnuPG.getAvailableInstaller();

    if (newVer && EnigmailVersioning.greaterThan(newVer.gpgVersion, EnigmailGpg.agentVersion)) {
      // new version is available
      return true;
    }

    return false;
  },

  isUpdateCheckNeeded: function() {
    // check once a week
    let now = Math.floor(Date.now() / 1000);
    return (now < Number(EnigmailPrefs.getPref("gpgLastUpdate")) + 604800);
  },

  stopCheckingForUpdate: function() {
    // set the last check date to Dec 31, 2299
    EnigmailPrefs.setPref("gpgLastUpdate", String(Math.floor(Date.parse('31 Dec 2299') / 1000)));
  },

  enableCheckingForUpdate: function() {
    // set the last check date "now"
    let now = Math.floor(Date.now() / 1000);
    EnigmailPrefs.setPref("gpgLastUpdate", String(now));
  },

  isAutoCheckEnabled: function() {
    let farAway = Math.floor(Date.parse('31 Dec 2299') / 1000);
    return Number(EnigmailPrefs.getPref("gpgLastUpdate")) < farAway;
  },


  isGnuPGUpdatable: function() {
    try {
      switch (EnigmailOS.getOS()) {
        case "Darwin":
          return isGpgOsxInstalled();
        case "WINNT":
          return isGpg4WinInstalled();
      }
    } catch (x) {}

    return false;
  },

  runUpdateCheck: function() {
    EnigmailLog.DEBUG(`gnupgUpdate.jsm: runUpdateCheck()\n`);
    if (!this.isGnuPGUpdatable() || !this.isUpdateCheckNeeded()) {
      EnigmailLog.DEBUG(`gnupgUpdate.jsm: runUpdateCheck: no action required\n`);
      return;
    }

    let self = this;
    let timeoutSec = 3600 + Math.floor(Math.random() * 1800) - 900;

    EnigmailLog.DEBUG(`gnupgUpdate.jsm: runUpdateCheck: check needed; waiting for ${timeoutSec} seconds\n`);

    EnigmailTimer.setTimeout(async function f() {
      if (await self.isUpdateAvailable()) {
        EnigmailLog.DEBUG(`gnupgUpdate.jsm: runUpdateCheck: check available\n`);
        let w = ChromeUtils.import("chrome://enigmail/content/modules/windows.jsm").EnigmailWindows;
        w.openGnuPGUpdate();
      }
    }, timeoutSec * 1000);
  }
};

function isGpg4WinInstalled() {
  const reg = ["Software\\Gpg4win", "Software\\GNU\\Gpg4win"];

  for (let i in reg) {
    let s = EnigmailOS.getWinRegistryString(reg[i], "Installer Language", Ci.nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE);
    if (s.length > 0) return true;
  }

  return false;
}

function isGpgOsxInstalled() {
  // check the installation path of GnuPG
  return (EnigmailGpg.agentPath.path.search(/^\/usr\/local\/gnupg-2.[12]\//) === 0);
}


function performUpdate() {
  EnigmailDialog.info(null, "GnuPG will be downloaded in the background. Once complete, the setup process will start automatically");

  InstallGnuPG.startInstaller(null);
}